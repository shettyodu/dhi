"""
Datastore initialization for AutoCommand.

Uses SQLite via SQLModel for the POC. To upgrade to Postgres, set:

    DATABASE_URL=postgresql://user:pass@host/dbname

— no schema changes required.
"""

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine

from workflow.logging_utils import log_info


# ── Engine ──────────────────────────────────────────────────────────

_PKG_DIR  = Path(__file__).parent
_DATA_DIR = _PKG_DIR / "data"
_DATA_DIR.mkdir(exist_ok=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{_DATA_DIR / 'autocommand.db'}",
)

# `check_same_thread=False` is needed for SQLite when sharing connections
# across Flask's worker threads. Harmless on other backends.
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
    connect_args=_connect_args,
)


# Enable foreign-key enforcement on SQLite (off by default)
if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_conn, _conn_record):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()


# ── Session helpers ────────────────────────────────────────────────


@contextmanager
def session_scope() -> Iterator[Session]:
    """Transaction-scoped session. Commits on success, rolls back on error.

    `expire_on_commit=False` keeps loaded ORM objects usable after the session
    closes — important because most call sites do their reads and then operate
    on the returned models outside the `with` block.
    """
    session = Session(engine, expire_on_commit=False)
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_session() -> Session:
    """Non-context session for use in Flask request handlers.

    Caller is responsible for closing.
    """
    return Session(engine)


# ── Schema management ───────────────────────────────────────────────


def init_db() -> None:
    """Create all tables if they don't exist. Idempotent."""
    # Importing schemas registers the SQLModel tables with metadata
    from workflow import schemas  # noqa: F401

    SQLModel.metadata.create_all(engine)
    log_info("db.init", database_url=DATABASE_URL.split("://")[0])


if __name__ == "__main__":
    init_db()
    print(f"DB ready at: {DATABASE_URL}")
