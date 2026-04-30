import sys
from pathlib import Path

# Allow imports from backend root
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session

from database import init_db, engine
from routers import contracts
from services.excel_importer import import_excel

app = FastAPI(title="Rental Management API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(contracts.router)


@app.on_event("startup")
def on_startup():
    init_db()
    with Session(engine) as session:
        count = import_excel(session)
        print(f"[startup] Excel imported: {count} contracts")


@app.post("/admin/reimport")
def reimport():
    with Session(engine) as session:
        count = import_excel(session)
    return {"imported": count}


@app.get("/health")
def health():
    return {"status": "ok"}
