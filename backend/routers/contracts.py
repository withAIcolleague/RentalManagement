from datetime import date, timedelta
from typing import Optional, List
import io
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlmodel import Session, select, col, func
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment

from database import get_session
from models import (Contract, ContractRead, ContractWrite,
                    AddressHistory, AddressHistoryRead,
                    ContractSummary, VendorSummary, CorporationSummary)

router = APIRouter(prefix="/contracts", tags=["contracts"])


@router.get("/", response_model=List[ContractRead])
def list_contracts(
    session: Session = Depends(get_session),
    corporation: Optional[str] = Query(None),
    vendor: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    item: Optional[str] = Query(None),
    expiring_days: Optional[int] = Query(None, description="만료까지 N일 이내"),
    q: Optional[str] = Query(None, description="키워드 검색"),
    sort_by: str = Query("end_date", description="정렬 필드"),
    sort_dir: str = Query("asc", description="asc|desc"),
    limit: int = Query(500),
    offset: int = Query(0),
):
    stmt = select(Contract)

    if corporation:
        stmt = stmt.where(Contract.corporation == corporation)
    if vendor:
        stmt = stmt.where(Contract.vendor == vendor)
    if status:
        stmt = stmt.where(Contract.status == status)
    if item:
        stmt = stmt.where(Contract.item == item)
    if expiring_days is not None:
        today = date.today().isoformat()
        deadline = (date.today() + timedelta(days=expiring_days)).isoformat()
        stmt = stmt.where(Contract.end_date >= today).where(Contract.end_date <= deadline)
    if q:
        kw = f"%{q}%"
        stmt = stmt.where(
            col(Contract.item).like(kw)
            | col(Contract.serial_no).like(kw)
            | col(Contract.address).like(kw)
            | col(Contract.notes).like(kw)
            | col(Contract.corporation).like(kw)
            | col(Contract.vendor).like(kw)
        )

    # Sorting
    sort_col = getattr(Contract, sort_by, Contract.end_date)
    if sort_dir == "desc":
        stmt = stmt.order_by(col(sort_col).desc())
    else:
        stmt = stmt.order_by(col(sort_col).asc())

    stmt = stmt.offset(offset).limit(limit)
    return session.exec(stmt).all()


@router.get("/summary", response_model=ContractSummary)
def get_summary(session: Session = Depends(get_session)):
    today = date.today().isoformat()
    d30 = (date.today() + timedelta(days=30)).isoformat()
    d60 = (date.today() + timedelta(days=60)).isoformat()
    d90 = (date.today() + timedelta(days=90)).isoformat()

    total = session.exec(select(func.count(Contract.id))).one()
    active = session.exec(
        select(func.count(Contract.id)).where(Contract.status == "사용중")
    ).one()
    fee_sum = session.exec(
        select(func.sum(Contract.monthly_fee)).where(Contract.status == "사용중")
    ).one() or 0
    exp30 = session.exec(
        select(func.count(Contract.id))
        .where(Contract.end_date >= today)
        .where(Contract.end_date <= d30)
    ).one()
    exp60 = session.exec(
        select(func.count(Contract.id))
        .where(Contract.end_date >= today)
        .where(Contract.end_date <= d60)
    ).one()
    exp90 = session.exec(
        select(func.count(Contract.id))
        .where(Contract.end_date >= today)
        .where(Contract.end_date <= d90)
    ).one()

    return ContractSummary(
        total_count=total,
        active_count=active,
        total_monthly_fee=float(fee_sum),
        expiring_30=exp30,
        expiring_60=exp60,
        expiring_90=exp90,
    )


@router.get("/by-vendor", response_model=List[VendorSummary])
def by_vendor(session: Session = Depends(get_session)):
    rows = session.exec(
        select(Contract.vendor, func.count(Contract.id), func.sum(Contract.monthly_fee))
        .where(Contract.vendor != None)
        .group_by(Contract.vendor)
        .order_by(func.sum(Contract.monthly_fee).desc())
    ).all()
    return [VendorSummary(vendor=r[0], count=r[1], monthly_fee=float(r[2] or 0)) for r in rows]


@router.get("/by-corporation", response_model=List[CorporationSummary])
def by_corporation(session: Session = Depends(get_session)):
    rows = session.exec(
        select(Contract.corporation, func.count(Contract.id), func.sum(Contract.monthly_fee))
        .where(Contract.corporation != None)
        .group_by(Contract.corporation)
        .order_by(func.sum(Contract.monthly_fee).desc())
    ).all()
    return [CorporationSummary(corporation=r[0], count=r[1], monthly_fee=float(r[2] or 0)) for r in rows]


@router.get("/filter-options")
def filter_options(session: Session = Depends(get_session)):
    def distinct_vals(field):
        rows = session.exec(select(field).where(field != None).distinct()).all()
        # SQLModel returns scalars (str) when selecting a single column
        return [r if isinstance(r, str) else r[0] for r in rows]

    corporations = distinct_vals(Contract.corporation)
    vendors = distinct_vals(Contract.vendor)
    items = distinct_vals(Contract.item)
    statuses = distinct_vals(Contract.status)
    return {"corporations": sorted(corporations), "vendors": sorted(vendors),
            "items": sorted(items), "statuses": sorted(statuses)}


@router.post("/new", response_model=ContractRead)
def create_contract(data: ContractWrite, session: Session = Depends(get_session)):
    contract = Contract(**data.model_dump())
    session.add(contract)
    session.commit()
    session.refresh(contract)
    return contract


@router.get("/{contract_id}", response_model=ContractRead)
def get_contract(contract_id: int, session: Session = Depends(get_session)):
    c = session.get(Contract, contract_id)
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    return c


@router.put("/{contract_id}", response_model=ContractRead)
def update_contract(contract_id: int, data: ContractWrite, session: Session = Depends(get_session)):
    c = session.get(Contract, contract_id)
    if not c:
        raise HTTPException(status_code=404, detail="Not found")

    # 주소가 변경된 경우 기존 주소를 이력에 저장
    new_address = data.address
    if c.address and new_address and c.address != new_address:
        history = AddressHistory(
            contract_id=contract_id,
            address=c.address,
            changed_date=date.today().isoformat(),
        )
        session.add(history)

    for k, v in data.model_dump().items():
        setattr(c, k, v)
    session.add(c)
    session.commit()
    session.refresh(c)
    return c


@router.delete("/{contract_id}")
def delete_contract(contract_id: int, session: Session = Depends(get_session)):
    c = session.get(Contract, contract_id)
    if not c:
        raise HTTPException(status_code=404, detail="Not found")
    # 이력도 함께 삭제
    histories = session.exec(
        select(AddressHistory).where(AddressHistory.contract_id == contract_id)
    ).all()
    for h in histories:
        session.delete(h)
    session.delete(c)
    session.commit()
    return {"ok": True}


# ── 설치주소 이력 ─────────────────────────────────────────────────

@router.get("/{contract_id}/address-history", response_model=List[AddressHistoryRead])
def get_address_history(contract_id: int, session: Session = Depends(get_session)):
    rows = session.exec(
        select(AddressHistory)
        .where(AddressHistory.contract_id == contract_id)
        .order_by(AddressHistory.changed_date.desc())
    ).all()
    return rows


class AddressHistoryCreate(AddressHistoryRead):
    id: Optional[int] = None
    contract_id: Optional[int] = None


@router.post("/{contract_id}/address-history", response_model=AddressHistoryRead)
def add_address_history(
    contract_id: int,
    data: AddressHistoryCreate,
    session: Session = Depends(get_session),
):
    if not session.get(Contract, contract_id):
        raise HTTPException(status_code=404, detail="Not found")
    h = AddressHistory(
        contract_id=contract_id,
        address=data.address,
        changed_date=data.changed_date or date.today().isoformat(),
        notes=data.notes,
    )
    session.add(h)
    session.commit()
    session.refresh(h)
    return h


@router.delete("/address-history/{history_id}")
def delete_address_history(history_id: int, session: Session = Depends(get_session)):
    h = session.get(AddressHistory, history_id)
    if not h:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(h)
    session.commit()
    return {"ok": True}


# ── Excel 내보내기 ─────────────────────────────────────────────────

@router.get("/export/excel")
def export_excel(
    session: Session = Depends(get_session),
    corporation: Optional[str] = Query(None),
    vendor: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    expiring_days: Optional[int] = Query(None),
    q: Optional[str] = Query(None),
):
    stmt = select(Contract)
    if corporation:
        stmt = stmt.where(Contract.corporation == corporation)
    if vendor:
        stmt = stmt.where(Contract.vendor == vendor)
    if status:
        stmt = stmt.where(Contract.status == status)
    if expiring_days is not None:
        today = date.today().isoformat()
        deadline = (date.today() + timedelta(days=expiring_days)).isoformat()
        stmt = stmt.where(Contract.end_date >= today).where(Contract.end_date <= deadline)
    if q:
        kw = f"%{q}%"
        stmt = stmt.where(
            col(Contract.item).like(kw)
            | col(Contract.serial_no).like(kw)
            | col(Contract.address).like(kw)
            | col(Contract.notes).like(kw)
            | col(Contract.corporation).like(kw)
            | col(Contract.vendor).like(kw)
        )
    stmt = stmt.order_by(col(Contract.end_date).asc())
    contracts = session.exec(stmt).all()

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "렌탈현황"

    HEADERS = [
        "No", "품목", "사용현황", "모델명", "S/N·전화번호",
        "렌탈업체", "등록법인", "계약기간(월)", "시작일", "만료일",
        "설치주소", "월렌트비", "납부방식", "비고", "원본시트",
    ]
    FIELDS = [
        "no", "item", "status", "model_name", "serial_no",
        "vendor", "corporation", "contract_months", "start_date", "end_date",
        "address", "monthly_fee", "payment_method", "notes", "source_sheet",
    ]

    header_fill = PatternFill("solid", fgColor="1F4E79")
    header_font = Font(color="FFFFFF", bold=True)

    for col_idx, header in enumerate(HEADERS, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal="center")

    for row_idx, contract in enumerate(contracts, 2):
        for col_idx, field in enumerate(FIELDS, 1):
            ws.cell(row=row_idx, column=col_idx, value=getattr(contract, field))

    # 열 너비 자동 조정
    col_widths = [6, 14, 10, 16, 18, 12, 12, 10, 12, 12, 40, 14, 10, 20, 14]
    for i, width in enumerate(col_widths, 1):
        ws.column_dimensions[openpyxl.utils.get_column_letter(i)].width = width

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f"렌탈현황_{date.today().isoformat()}.xlsx"
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{filename}"},
    )
