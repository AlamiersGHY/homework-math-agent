from collections.abc import Generator

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from math_agent_api.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _create_engine():
    settings = get_settings()
    connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
    return create_engine(settings.database_url, connect_args=connect_args)


engine = _create_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def init_db() -> None:
    from math_agent_api.db import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _upgrade_sqlite_schema()


def _upgrade_sqlite_schema() -> None:
    """Apply tiny local-demo schema repairs for existing SQLite files.

    The project intentionally does not carry a migration framework yet. This
    keeps old local demo databases readable when additive columns are added.
    """
    if engine.dialect.name != "sqlite":
        return

    inspector = inspect(engine)
    if "documents" in inspector.get_table_names():
        document_columns = {column["name"] for column in inspector.get_columns("documents")}
        if "warnings_json" not in document_columns:
            with engine.begin() as connection:
                connection.execute(
                    text("ALTER TABLE documents ADD COLUMN warnings_json TEXT NOT NULL DEFAULT '[]'")
                )


def get_db_session() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
