"""
Simple admin stats storage (JSON file).
- Tracks site visits and games played.
- Credentials MUST be provided via environment variables. No defaults — a
  missing var makes the module import fail, which is exactly what we want:
  a misconfigured prod box refuses to boot instead of silently running with
  publicly-known credentials.
- Returns a simple HMAC token after login (stateless, no DB).
"""
from pathlib import Path
from typing import Dict
import hmac
import hashlib
import json
import os
import threading
import time


def _required(var: str) -> str:
    val = os.environ.get(var)
    if not val:
        raise RuntimeError(
            f"{var} is not set. Admin dashboard refuses to run without "
            "explicit credentials. Export it in your systemd unit / .env "
            "before starting the backend."
        )
    return val


# === Config — no defaults on purpose ===
ADMIN_USERNAME = _required("ADMIN_USERNAME")
ADMIN_PASSWORD = _required("ADMIN_PASSWORD")
ADMIN_SECRET = _required("ADMIN_SECRET")
if len(ADMIN_SECRET) < 32:
    raise RuntimeError("ADMIN_SECRET must be at least 32 characters long.")
TOKEN_TTL_SECONDS = 60 * 60 * 8  # 8 hours

STATS_PATH = Path(__file__).parent / "stats.json"
_lock = threading.Lock()

_DEFAULT_STATS: Dict[str, int] = {"visits": 0, "games_played": 0}


def _read() -> Dict[str, int]:
    if not STATS_PATH.exists():
        return dict(_DEFAULT_STATS)
    try:
        with STATS_PATH.open("r", encoding="utf-8") as f:
            data = json.load(f)
        return {**_DEFAULT_STATS, **{k: int(data.get(k, 0)) for k in _DEFAULT_STATS}}
    except Exception:
        return dict(_DEFAULT_STATS)


def _write(stats: Dict[str, int]) -> None:
    with STATS_PATH.open("w", encoding="utf-8") as f:
        json.dump(stats, f)


def get_stats() -> Dict[str, int]:
    with _lock:
        return _read()


def increment(key: str, amount: int = 1) -> Dict[str, int]:
    if key not in _DEFAULT_STATS:
        raise ValueError(f"Unknown stat: {key}")
    with _lock:
        stats = _read()
        stats[key] = stats.get(key, 0) + amount
        _write(stats)
        return stats


def reset_stats() -> Dict[str, int]:
    with _lock:
        stats = dict(_DEFAULT_STATS)
        _write(stats)
        return stats


# === Auth ===
def check_credentials(username: str, password: str) -> bool:
    u_ok = hmac.compare_digest(username or "", ADMIN_USERNAME)
    p_ok = hmac.compare_digest(password or "", ADMIN_PASSWORD)
    return u_ok and p_ok


def _sign(payload: str) -> str:
    return hmac.new(ADMIN_SECRET.encode(), payload.encode(), hashlib.sha256).hexdigest()


def issue_token() -> str:
    exp = int(time.time()) + TOKEN_TTL_SECONDS
    payload = f"admin:{exp}"
    return f"{payload}:{_sign(payload)}"


def verify_token(token: str) -> bool:
    if not token or token.count(":") != 2:
        return False
    payload, sig = token.rsplit(":", 1)
    if not hmac.compare_digest(sig, _sign(payload)):
        return False
    try:
        _, exp = payload.split(":")
        return int(exp) > int(time.time())
    except Exception:
        return False
