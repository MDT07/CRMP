from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt

from app.core.config import get_settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def _normalize_password_for_bcrypt(password: str) -> bytes:
    # bcrypt accepts up to 72 bytes. For longer inputs we pre-hash to keep
    # deterministic verification and avoid runtime backend errors.
    password_bytes = password.encode("utf-8")
    if len(password_bytes) <= 72:
        return password_bytes
    return hashlib.sha256(password_bytes).hexdigest().encode("ascii")


def hash_password(password: str) -> str:
    normalized_password = _normalize_password_for_bcrypt(password)
    return bcrypt.hashpw(normalized_password, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    normalized_password = _normalize_password_for_bcrypt(plain_password)
    try:
        return bcrypt.checkpw(
            normalized_password,
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        return False


def build_api_key_secret(scope: str) -> str:
    normalized_scope = "".join(
        character for character in scope.lower() if character.isalnum()
    ) or "key"
    return f"crmp_{normalized_scope}_{secrets.token_hex(18)}"


def hash_api_key_secret(secret: str) -> str:
    settings = get_settings()
    digest = hmac.new(
        settings.secret_key.encode("utf-8"),
        secret.encode("utf-8"),
        hashlib.sha256,
    )
    return digest.hexdigest()


def verify_api_key_secret(secret: str, expected_hash: str) -> bool:
    return hmac.compare_digest(hash_api_key_secret(secret), expected_hash)


def mask_api_key_secret(secret: str) -> str:
    if len(secret) <= 12:
        return f"{secret[:4]}••••"
    return f"{secret[:8]}••••{secret[-4:]}"


def create_access_token(
    subject: str,
    organization_id: str,
    role: str,
    expires_delta: timedelta | None = None,
) -> str:
    settings = get_settings()
    expires_at = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode: dict[str, Any] = {
        "sub": subject,
        "org": organization_id,
        "role": role,
        "exp": expires_at,
    }
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError as exc:
        raise ValueError("Invalid access token.") from exc
