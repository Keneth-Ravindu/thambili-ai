from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import (
    EXPORT_DIR,
    UPLOAD_DIR,
)

from app.database import (
    Base,
    engine,
)

from app.routers.invoices import (
    router as invoice_router,
)


UPLOAD_DIR.mkdir(
    parents=True,
    exist_ok=True
)

EXPORT_DIR.mkdir(
    parents=True,
    exist_ok=True
)


Base.metadata.create_all(
    bind=engine
)


app = FastAPI(
    title="Thambili Invoice Intelligence API",
    version="1.0.0"
)


app.add_middleware(
    CORSMiddleware,

    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"],
)


app.include_router(
    invoice_router
)


@app.get("/")
def root():

    return {
        "message":
            "Thambili Invoice Intelligence API"
    }


@app.get("/health")
def health():

    return {
        "status": "ok"
    }