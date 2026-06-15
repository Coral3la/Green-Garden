from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.auth_models import Token, UserCreate, UserOut
from app.database import get_database
from app.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
COLLECTION = "users"


def serialize_user(doc: dict) -> dict:
    """Convert a Mongo user document into the shape UserOut expects."""
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(user: UserCreate):
    db = get_database()
    if await db[COLLECTION].find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    doc = {
        "email": user.email,
        "hashed_password": hash_password(user.password),
        "display_name": user.display_name,
        "created_at": datetime.now(UTC),
    }
    result = await db[COLLECTION].insert_one(doc)
    created = await db[COLLECTION].find_one({"_id": result.inserted_id})
    return serialize_user(created)


@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    db = get_database()
    user = await db[COLLECTION].find_one({"email": form_data.username})
    if user is None or not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=401,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(str(user["_id"]))
    return Token(access_token=token, token_type="bearer")


@router.get("/me", response_model=UserOut)
async def read_me(current_user: dict = Depends(get_current_user)):
    return serialize_user(current_user)
