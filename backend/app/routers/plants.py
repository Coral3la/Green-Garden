from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, HTTPException, status

from app.database import get_database
from app.models import PlantCreate, PlantOut, PlantUpdate

router = APIRouter(prefix="/plants", tags=["plants"])

COLLECTION = "plants"

# Reused wherever we can't find a plant, so the message stays consistent.
PLANT_NOT_FOUND = HTTPException(status_code=404, detail="Plant not found")


def serialize_plant(doc: dict) -> dict:
    """Convert a MongoDB document into the shape PlantOut expects."""
    doc = dict(doc)
    doc["id"] = str(doc.pop("_id"))
    return doc


def to_object_id(plant_id: str) -> ObjectId:
    """Convert a string id to an ObjectId, or 404 if it's malformed."""
    try:
        return ObjectId(plant_id)
    except InvalidId:
        raise PLANT_NOT_FOUND from None


@router.get("", response_model=list[PlantOut])
async def list_plants():
    db = get_database()
    docs = await db[COLLECTION].find().to_list(length=None)
    return [serialize_plant(doc) for doc in docs]


@router.post("", response_model=PlantOut, status_code=status.HTTP_201_CREATED)
async def create_plant(plant: PlantCreate):
    db = get_database()
    result = await db[COLLECTION].insert_one(plant.model_dump())
    created = await db[COLLECTION].find_one({"_id": result.inserted_id})
    return serialize_plant(created)


@router.get("/{plant_id}", response_model=PlantOut)
async def get_plant(plant_id: str):
    db = get_database()
    doc = await db[COLLECTION].find_one({"_id": to_object_id(plant_id)})
    if doc is None:
        raise PLANT_NOT_FOUND
    return serialize_plant(doc)


@router.patch("/{plant_id}", response_model=PlantOut)
async def update_plant(plant_id: str, updates: PlantUpdate):
    db = get_database()
    oid = to_object_id(plant_id)
    changes = updates.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(status_code=400, detail="No fields provided to update")
    result = await db[COLLECTION].update_one({"_id": oid}, {"$set": changes})
    if result.matched_count == 0:
        raise PLANT_NOT_FOUND
    doc = await db[COLLECTION].find_one({"_id": oid})
    return serialize_plant(doc)


@router.delete("/{plant_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plant(plant_id: str):
    db = get_database()
    result = await db[COLLECTION].delete_one({"_id": to_object_id(plant_id)})
    if result.deleted_count == 0:
        raise PLANT_NOT_FOUND
