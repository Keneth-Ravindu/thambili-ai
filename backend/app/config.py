import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent

DATA_DIR = Path(os.getenv("DATA_DIR", REPO_ROOT / "data")).resolve()
INVOICES_DIR = DATA_DIR / "invoices"
SUPPLIERS_CSV = DATA_DIR / "suppliers.csv"
EXISTING_RECORDS_CSV = DATA_DIR / "existing_records.csv"

DATABASE_URL = os.getenv("DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'thambili.db'}")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-5-20250929")

# Thambili Restaurants (Pvt) Ltd's own VAT registration, as it appears on
# every genuine invoice addressed to them. Used to catch invoices that were
# accidentally (or fraudulently) billed to a different company.
THAMBILI_VAT = os.getenv("THAMBILI_VAT", "114982736-7000")
THAMBILI_NAME_HINT = "thambili"

INVOICES_DIR.mkdir(parents=True, exist_ok=True)
