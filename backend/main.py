from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import close_mongo_connection, connect_to_mongo
from app.routers import auth, chat, plants


@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()


app = FastAPI(title="Green Garden API", lifespan=lifespan)
app.include_router(plants.router)
app.include_router(chat.router)
app.include_router(auth.router)

origins = [
    "http://localhost:4200",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],  # GET, POST, PATCH, DELETE, OPTIONS
    allow_headers=["*"],  # Content-Type, Authorization
)


@app.get("/")
def read_root():
    return {"message": "Welcome to the Green Garden API! 🍃"}
