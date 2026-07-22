from datetime import UTC, datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, EmailStr, Field

from app.security import PASSWORD_MAX_BYTES


def fits_bcrypt(value: str) -> str:
    # Measured in bytes, not characters: Field(max_length=...) counts
    # characters, which would wave through a 40-emoji password that is 160
    # bytes and blows up in bcrypt.
    if len(value.encode()) > PASSWORD_MAX_BYTES:
        raise ValueError(f"must be at most {PASSWORD_MAX_BYTES} bytes long")
    return value


# Every password we are asked to *store* has the same rules, so they live in
# one place. Passwords we only verify are plain `str` — whatever the user typed
# is what we check, and verify_password handles the over-long case.
Password = Annotated[
    str,
    Field(min_length=6, description="must be at least 6 characters long"),
    AfterValidator(fits_bcrypt),
]


class UserCreate(BaseModel):
    email: EmailStr
    password: Password
    display_name: str = Field(
        ..., min_length=2, description="must be at least 2 letters"
    )


class PasswordChange(BaseModel):
    current_password: str
    new_password: Password


class UserOut(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
