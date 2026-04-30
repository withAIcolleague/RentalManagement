"""Excel → SQLite importer for rental management data."""
from pathlib import Path
from typing import Optional
import openpyxl
from sqlmodel import Session, select

from models import Contract

EXCEL_PATH = Path(__file__).parent.parent.parent / "data" / "rental.xlsx"

# Sheets to skip (aggregated views, not raw contract data)
SKIP_SHEETS = {"통합", "센터별렌탈현황"}

# Column indices within each vendor sheet (0-based from values_only iteration)
COL = {
    "no": 1,
    "item": 2,
    "status": 3,
    "serial_no": 4,
    "vendor": 5,
    "corporation": 6,
    "contract_months": 7,
    "start_date": 8,
    "end_date": 9,
    "usage_months": 10,
    "address": 11,
    "monthly_fee": 12,
    "payment_method": 15,
    "notes": 16,
}


def _clean_str(v) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s if s else None


def _clean_date(v) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    # datetime objects come as "YYYY-MM-DD HH:MM:SS"
    return s[:10]


def _clean_fee(v) -> Optional[float]:
    if v is None:
        return None
    s = str(v).strip().replace(",", "")
    try:
        f = float(s)
        return f if f > 0 else None
    except ValueError:
        return None


def import_excel(session: Session) -> int:
    """Clear existing data and re-import from Excel. Returns row count."""
    # Clear
    existing = session.exec(select(Contract)).all()
    for c in existing:
        session.delete(c)
    session.commit()

    wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
    count = 0

    for sheet_name in wb.sheetnames:
        if sheet_name in SKIP_SHEETS:
            continue

        ws = wb[sheet_name]
        # Data starts at row 4 (1=title, 2=headers, 3=sub-headers)
        for row in ws.iter_rows(min_row=4, values_only=True):
            # Skip rows without a No. value
            if row[COL["no"]] is None or str(row[COL["no"]]).strip() == "":
                continue
            # Skip subtotal/summary rows (no is non-numeric)
            no_val = _clean_str(row[COL["no"]])
            if no_val and not no_val.replace(".", "").isdigit():
                continue

            contract = Contract(
                no=no_val,
                item=_clean_str(row[COL["item"]]),
                status=_clean_str(row[COL["status"]]),
                serial_no=_clean_str(row[COL["serial_no"]]),
                vendor=_clean_str(row[COL["vendor"]]) or sheet_name,
                corporation=_clean_str(row[COL["corporation"]]),
                contract_months=_clean_str(row[COL["contract_months"]]),
                start_date=_clean_date(row[COL["start_date"]]),
                end_date=_clean_date(row[COL["end_date"]]),
                usage_months=_clean_str(row[COL["usage_months"]]),
                address=_clean_str(row[COL["address"]]),
                monthly_fee=_clean_fee(row[COL["monthly_fee"]]),
                payment_method=_clean_str(row[COL["payment_method"]]),
                notes=_clean_str(row[COL["notes"]]),
                source_sheet=sheet_name,
            )
            session.add(contract)
            count += 1

    session.commit()
    return count
