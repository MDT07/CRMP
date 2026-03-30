from __future__ import annotations

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass


from app import models  # noqa: E402,F401

target_metadata = Base.metadata
