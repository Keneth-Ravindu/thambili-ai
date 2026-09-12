import os
from pathlib import Path

from dotenv import load_dotenv


# backend/
BASE_DIR = Path(__file__).resolve().parent.parent

# Load backend/.env
load_dotenv(BASE_DIR / ".env")


DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
EXPORT_DIR = BASE_DIR / "exports"

SUPPLIERS_CSV = DATA_DIR / "suppliers.csv"
EXISTING_RECORDS_CSV = DATA_DIR / "existing_records.csv"


ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL")


if not ANTHROPIC_API_KEY:
    raise ValueError(
        "ANTHROPIC_API_KEY is missing from .env"
    )

if not CLAUDE_MODEL:
    raise ValueError(
        "CLAUDE_MODEL is missing from .env"
    )