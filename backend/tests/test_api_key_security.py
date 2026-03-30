from app.core.security import (
    build_api_key_secret,
    hash_api_key_secret,
    mask_api_key_secret,
    verify_api_key_secret,
)


def test_api_key_secret_includes_scope_prefix() -> None:
    secret = build_api_key_secret("server")

    assert secret.startswith("crmp_server_")
    assert len(secret) > len("crmp_server_")


def test_api_key_hash_round_trip_verifies() -> None:
    secret = build_api_key_secret("automation")
    token_hash = hash_api_key_secret(secret)

    assert verify_api_key_secret(secret, token_hash) is True
    assert verify_api_key_secret(f"{secret}-tampered", token_hash) is False


def test_api_key_mask_hides_middle_of_secret() -> None:
    secret = "crmp_server_1234567890abcdef"

    assert mask_api_key_secret(secret) == "crmp_ser••••cdef"
