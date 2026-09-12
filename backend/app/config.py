from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
UPLOAD_DIR = BASE_DIR / "uploads"
EXPORT_DIR = BASE_DIR / "exports"

SUPPLIERS_CSV = DATA_DIR / "suppliers.csv"
EXISTING_RECORDS_CSV = DATA_DIR / "existing_records.csv"