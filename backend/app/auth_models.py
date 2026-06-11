from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(
        ..., min_length=6, description="must be at least 6 characters long"
    )
    display_name: str = Field(
        ..., min_length=2, description="must be at least 2 letters"
    )


class UserOut(BaseModel):
    id: str
    email: EmailStr
    display_name: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
