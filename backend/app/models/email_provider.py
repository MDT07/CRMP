"""Email Provider enum."""
from __future__ import annotations
from enum import Enum


class EmailProvider(str, Enum):
    gmail = "gmail"
    outlook = "outlook"
    imap = "imap"
