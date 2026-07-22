from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm

# pymongo ships with motor; motor does not re-export its error types.
from pymongo.errors import DuplicateKeyError

from app.auth_models import PasswordChange, Token, UserCreate, UserOut
from app.database import get_database
from app.rate_limit import client_key, login_limiter
from app.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
COLLECTION = "users"

# Raised from two places — the pre-check and the index that backs it up — so
# the caller cannot tell which one caught them.
EMAIL_TAKEN = HTTPException(status_code=400, detail="Email already registered")


def serialize_user(doc: dict) -> dict:
    """Convert a Mongo user document into the shape UserOut expects."""
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate):
    db = get_database()
    if await db[COLLECTION].find_one({"email": user.email}):
        raise EMAIL_TAKEN
    doc = {
        "email": user.email,
        "hashed_password": hash_password(user.password),
        "display_name": user.display_name,
        "created_at": datetime.now(UTC),
    }
    try:
        result = await db[COLLECTION].insert_one(doc)
    except DuplicateKeyError:
        # Two simultaneous registrations can both clear the check above — the
        # unique index on `email` is what actually decides. Whoever loses that
        # race gets the same 400 the check would have given them, not a 500.
        raise EMAIL_TAKEN from None
    created = await db[COLLECTION].find_one({"_id": result.inserted_id})
    return serialize_user(created)


@router.post("/login", response_model=Token)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends()):
    caller = client_key(request)
    # Checked before we touch the database, so a throttled caller costs us
    # neither a query nor a bcrypt verification.
    login_limiter.check(caller)

    db = get_database()
    user = await db[COLLECTION].find_one({"email": form_data.username})
    if user is None or not verify_password(form_data.password, user["hashed_password"]):
        login_limiter.record_failure(caller)
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Knowing the password clears the record, so a legitimate user is never
    # throttled however often they sign in.
    login_limiter.reset(caller)
    token = create_access_token(str(user["_id"]))
    return Token(access_token=token, token_type="bearer")


@router.post("/refresh", response_model=Token)
async def refresh(current_user: dict = Depends(get_current_user)):
    """Trade a still-valid token for a fresh one.

    Sliding renewal: the frontend calls this once a token is past halfway
    through its life, so a user who keeps working is never dropped at the login
    screen. An idle session still lapses — nothing renews without traffic.
    """
    token = create_access_token(str(current_user["_id"]))
    return Token(access_token=token, token_type="bearer")


@router.patch("/password", status_code=status.HTTP_204_NO_CONTENT)
async def change_password(
    change: PasswordChange, current_user: dict = Depends(get_current_user)
):
    # Knowing the current password is the point: a stolen token alone must not
    # be enough to lock the real owner out of their garden.
    if not verify_password(change.current_password, current_user["hashed_password"]):
        raise HTTPException(
            status_code=401,
            detail="Current password is incorrect",
            headers={"WWW-Authenticate": "Bearer"},
        )
    db = get_database()
    await db[COLLECTION].update_one(
        {"_id": current_user["_id"]},
        {"$set": {"hashed_password": hash_password(change.new_password)}},
    )


@router.get("/me", response_model=UserOut)
async def read_me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)
