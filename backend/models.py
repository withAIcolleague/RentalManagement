from typing import Optional
from sqlmodel import SQLModel, Field


class Contract(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    no: Optional[str] = None
    item: Optional[str] = None          # 품목
    status: Optional[str] = None        # 사용현황
    serial_no: Optional[str] = None     # S/N
    vendor: Optional[str] = None        # 렌탈업체
    corporation: Optional[str] = None   # 등록법인
    contract_months: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    usage_months: Optional[str] = None
    address: Optional[str] = None       # 설치주소
    monthly_fee: Optional[float] = None # 월렌트비
    payment_method: Optional[str] = None # 납부방식
    notes: Optional[str] = None         # 비고
    source_sheet: Optional[str] = None  # 원본 시트명


class ContractWrite(SQLModel):
    no: Optional[str] = None
    item: Optional[str] = None
    status: Optional[str] = None
    serial_no: Optional[str] = None
    vendor: Optional[str] = None
    corporation: Optional[str] = None
    contract_months: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    usage_months: Optional[str] = None
    address: Optional[str] = None
    monthly_fee: Optional[float] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    source_sheet: Optional[str] = None


class ContractRead(SQLModel):
    id: int
    no: Optional[str]
    item: Optional[str]
    status: Optional[str]
    serial_no: Optional[str]
    vendor: Optional[str]
    corporation: Optional[str]
    contract_months: Optional[str]
    start_date: Optional[str]
    end_date: Optional[str]
    usage_months: Optional[str]
    address: Optional[str]
    monthly_fee: Optional[float]
    payment_method: Optional[str]
    notes: Optional[str]
    source_sheet: Optional[str]


class ContractSummary(SQLModel):
    total_count: int
    active_count: int
    total_monthly_fee: float
    expiring_30: int
    expiring_60: int
    expiring_90: int


class VendorSummary(SQLModel):
    vendor: str
    count: int
    monthly_fee: float


class CorporationSummary(SQLModel):
    corporation: str
    count: int
    monthly_fee: float
