from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import connect_to_mongo, close_mongo_connection
from app.routers import plants, chat


@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup: runs once before the server accepts requests 
    await connect_to_mongo()
    yield
    # shutdown: runs once as the server stops 
    await close_mongo_connection()


app = FastAPI(title="Green Garden API", lifespan=lifespan)
app.include_router(plants.router)
app.include_router(chat.router)

origins = [
      "http://localhost:4200",  # Angular dev server
  ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],   # GET, POST, PATCH, DELETE, OPTIONS...
    allow_headers=["*"],   # Content-Type, Authorization...
  )

@app.get("/")
def read_root():
    return {"message": "Welcome to the Green Garden API! 🍃"}

