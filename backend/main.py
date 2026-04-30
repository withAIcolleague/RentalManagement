import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from database import init_db, engine
from routers import contracts
from services.excel_importer import import_excel, EXCEL_PATH

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "https://*.vercel.app",
]

app = FastAPI(title="Rental Management API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],      # Vercel 도메인 확정 후 제한
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contracts.router)


@app.on_event("startup")
def on_startup():
    init_db()
    if EXCEL_PATH.exists():
        with Session(engine) as session:
            count = import_excel(session)
            print(f"[startup] Excel imported: {count} contracts")
    else:
        print(f"[startup] Excel not found at {EXCEL_PATH}, skipping import")


@app.post("/admin/reimport")
def reimport():
    if not EXCEL_PATH.exists():
        return {"error": "Excel file not found", "imported": 0}
    with Session(engine) as session:
        count = import_excel(session)
    return {"imported": count}


@app.post("/admin/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    """Excel 파일을 업로드하고 즉시 임포트합니다."""
    content = await file.read()
    EXCEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    EXCEL_PATH.write_bytes(content)
    with Session(engine) as session:
        count = import_excel(session)
    return {"imported": count, "filename": file.filename}


@app.get("/health")
def health():
    return {"status": "ok"}
