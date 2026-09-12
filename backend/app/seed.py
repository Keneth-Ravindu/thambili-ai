import pandas as pd
from sqlalchemy.orm import Session

from .config import EXISTING_RECORDS_CSV, SUPPLIERS_CSV
from .models import ExistingRecord, Supplier
from .parsing import parse_date, to_float


def seed_if_empty(db: Session) -> None:
    if db.query(Supplier).first() is None and SUPPLIERS_CSV.exists():
        df = pd.read_csv(SUPPLIERS_CSV, dtype=str).fillna("")
        for _, row in df.iterrows():
            db.add(
                Supplier(
                    supplier_id=row["supplier_id"],
                    registered_name=row["registered_name"],
                    trading_name=row["trading_name"],
                    category=row["category"],
                    address=row.get("address", ""),
                    city=row.get("city", ""),
                    phone=row.get("phone", ""),
                    email=row.get("email", ""),
                    vat_number=row.get("vat_number", ""),
                    payment_terms=row.get("payment_terms", ""),
                    currency=row.get("currency", "LKR"),
                )
            )
        db.commit()

    if db.query(ExistingRecord).first() is None and EXISTING_RECORDS_CSV.exists():
        df = pd.read_csv(EXISTING_RECORDS_CSV, dtype=str).fillna("")
        for _, row in df.iterrows():
            db.add(
                ExistingRecord(
                    record_id=row["record_id"],
                    supplier_id=row["supplier_id"],
                    supplier_name=row["supplier_name"],
                    invoice_number=row["invoice_number"],
                    invoice_date=parse_date(row["invoice_date"]),
                    date_entered=parse_date(row["date_entered"]),
                    currency=row.get("currency", "LKR"),
                    net_amount=to_float(row["net_amount"]) or 0,
                    tax_amount=to_float(row["tax_amount"]) or 0,
                    gross_amount=to_float(row["gross_amount"]) or 0,
                    cost_centre=row.get("cost_centre", ""),
                    entered_by=row.get("entered_by", ""),
                    status=row.get("status", "Posted"),
                )
            )
        db.commit()


def next_record_id(db: Session) -> str:
    last = (
        db.query(ExistingRecord)
        .order_by(ExistingRecord.record_id.desc())
        .first()
    )
    last_num = 0
    if last and last.record_id.startswith("FR-"):
        try:
            last_num = int(last.record_id.split("-")[1])
        except (IndexError, ValueError):
            last_num = 0

    from .models import Invoice  # local import to avoid circular import at module load

    approved = (
        db.query(Invoice)
        .filter(Invoice.record_id.isnot(None))
        .order_by(Invoice.record_id.desc())
        .first()
    )
    if approved and approved.record_id and approved.record_id.startswith("FR-"):
        try:
            last_num = max(last_num, int(approved.record_id.split("-")[1]))
        except (IndexError, ValueError):
            pass

    return f"FR-{last_num + 1:05d}"
