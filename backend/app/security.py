from datetime import UTC, datetime, timedelta

import bcrypt
import jwt
from bson import ObjectId
from bson.errors import InvalidId
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.config import settings
from app.database import get_database

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

# bcrypt hashes at most 72 bytes and *raises* rather than truncating, so both
# sides of the hash have to respect the limit or an over-long password becomes
# a 500. Registration enforces it up front (see UserCreate); login cannot, so
# verify_password guards itself.
PASSWORD_MAX_BYTES = 72


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    # Login parses an OAuth2 form, not UserCreate, so nothing has checked the
    # length by the time we get here. A password bcrypt would refuse to hash
    # cannot match any stored hash, so it is simply wrong — not a crash.
    if len(plain.encode()) > PASSWORD_MAX_BYTES:
        return False
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def create_access_token(user_id: str) -> str:
    # `iat` is here so the client can work out when a token is halfway through
    # its life and renew it, without having to know the configured lifetime.
    issued = datetime.now(UTC)
    expire = issued + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": user_id, "iat": issued, "exp": expire}
    return jwt.encode(
        payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm
    )


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    creds_error = HTTPException(
        status.HTTP_401_UNAUTHORIZED,
        "Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        user_id = payload.get("sub")
        if user_id is None:
            raise creds_error
        # A signed token can still carry a `sub` that is not a valid ObjectId,
        # so convert inside the try: that is a bad credential, not a crash.
        oid = ObjectId(user_id)
    except (jwt.PyJWTError, InvalidId):
        raise creds_error from None
    user = await get_database()["users"].find_one({"_id": oid})
    if user is None:
        raise creds_error
    return user
