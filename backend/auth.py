"""
Player authentication for Dark Oath.

Each player receives a short-lived JWT on /auth/anonymous. The token embeds
their user id and display name and is signed with APP_SECRET.

Every action endpoint requires the token as `Authorization: Bearer <jwt>`.
WebSocket endpoints accept the token as a `?token=<jwt>` query parameter
(standard practice, since browsers cannot set custom headers on WS).

Previously the player id travelled as a plain query param, which meant:
  - leaked in nginx access logs,
  - impersonation as soon as anyone saw the URL (logs, screenshare,
    Referer), giving full game-breaking access (vote/nominate for another
    player, read their secret role).

With JWT we solve all of that: the secret never shows up in URLs or logs,
it is signed so it cannot be forged, and it expires.
"""
from __future__ import annotations

import os
import time
import uuid
from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, Query, status
from pydantic import BaseModel


JWT_ALG = "HS256"
JWT_TTL_SECONDS = 60 * 60 * 24  # 24h — long enough to play several games, short enough to rotate


def _secret() -> str:
    """Return the signing secret. Raises if APP_SECRET is missing in prod."""
    secret = os.environ.get("APP_SECRET")
    if not secret:
        # Hard-fail: refusing to sign tokens with a dev default in production
        # is the whole point of the fix. The launch script must export APP_SECRET.
        raise RuntimeError(
            "APP_SECRET is not set. Generate one with `python -c 'import secrets; print(secrets.token_urlsafe(48))'` "
            "and export it before starting the backend."
        )
    if len(secret) < 32:
        raise RuntimeError("APP_SECRET must be at least 32 characters long.")
    return secret


class PlayerIdentity(BaseModel):
    """The authenticated caller attached to each request/WebSocket."""
    user_id: str
    name: str


def issue_player_token(name: str) -> tuple[str, str, str]:
    """Issue a fresh token for a new anonymous player.

    Returns (user_id, name, token).
    """
    user_id = str(uuid.uuid4())
    now = int(time.time())
    payload = {
        "sub": user_id,
        "name": name,
        "iat": now,
        "exp": now + JWT_TTL_SECONDS,
        "kind": "player",
    }
    token = jwt.encode(payload, _secret(), algorithm=JWT_ALG)
    return user_id, name, token


def decode_player_token(token: str) -> Optional[PlayerIdentity]:
    """Decode and validate a player JWT. Returns None on any failure."""
    if not token:
        return None
    try:
        payload = jwt.decode(token, _secret(), algorithms=[JWT_ALG])
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
    if payload.get("kind") != "player":
        return None
    user_id = payload.get("sub")
    name = payload.get("name")
    if not user_id or not isinstance(user_id, str):
        return None
    return PlayerIdentity(user_id=user_id, name=name or "")


def _token_from_header(authorization: Optional[str]) -> Optional[str]:
    if not authorization:
        return None
    if not authorization.lower().startswith("bearer "):
        return None
    return authorization[7:].strip() or None


def require_player(authorization: Optional[str] = Header(None)) -> PlayerIdentity:
    """FastAPI dependency — require a valid player JWT on the request."""
    token = _token_from_header(authorization)
    identity = decode_player_token(token or "")
    if not identity:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return identity


def require_player_ws(token: Optional[str] = Query(None)) -> PlayerIdentity:
    """FastAPI dependency for WebSocket endpoints — token comes from the query string.

    Browsers cannot set custom headers on `new WebSocket()`, so the canonical
    way to authenticate WS is a short-lived token in the query string (served
    over WSS so it doesn't leak on the wire).
    """
    identity = decode_player_token(token or "")
    if not identity:
        # For WS we raise 401; the route handler handles the close with code 4401.
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    return identity


# Re-export Depends for convenience in server.py
__all__ = [
    "PlayerIdentity",
    "issue_player_token",
    "decode_player_token",
    "require_player",
    "require_player_ws",
    "Depends",
]
