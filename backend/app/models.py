from datetime import UTC, datetime

from pydantic import BaseModel, Field


class PlantBase(BaseModel):
    name: str
    imgUrl: str
    location: str
    wateringFrequencyDays: int = Field(gt=0)  # must be > 0 days


class PlantCreate(PlantBase):
    # Client usually omits this; default to "right now" in UTC.
    lastWateredAt: datetime = Field(default_factory=lambda: datetime.now(UTC))


class PlantUpdate(BaseModel):
    # All optional → a PATCH can send just the field(s) being changed.
    name: str | None = None
    imgUrl: str | None = None
    location: str | None = None
    wateringFrequencyDays: int | None = Field(default=None, gt=0)
    lastWateredAt: datetime | None = None


class PlantOut(PlantBase):
    id: str
    lastWateredAt: datetime
