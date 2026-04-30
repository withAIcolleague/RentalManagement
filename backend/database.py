import os
from pathlib import Path
from sqlmodel import SQLModel, create_engine, Session

# Railway / Render 등에서는 DATABASE_URL 환경변수 사용, 로컬은 SQLite
_db_url = os.environ.get("DATABASE_URL")

if _db_url:
    # Railway가 제공하는 URL은 postgres:// 형식 → postgresql:// 로 변환
    if _db_url.startswith("postgres://"):
        _db_url = _db_url.replace("postgres://", "postgresql://", 1)
    DB_URL = _db_url
    engine = create_engine(DB_URL, echo=False)
else:
    DB_PATH = Path(__file__).parent.parent / "data" / "rental.db"
    DB_URL = f"sqlite:///{DB_PATH}"
    engine = create_engine(DB_URL, echo=False,
                           connect_args={"check_same_thread": False})


def init_db():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
