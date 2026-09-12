import pandas as pd

from app.config import EXISTING_RECORDS_CSV


existing_records_df = pd.read_csv(
    EXISTING_RECORDS_CSV,
    dtype=str
).fillna("")


def normalize(value: str | None) -> str:
    if not value:
        return ""

    return str(value).strip().lower()


def check_existing_duplicate(
    supplier_id: str | None,
    invoice_number: str | None
):
    if not supplier_id or not invoice_number:
        return {
            "duplicate": False,
            "record": None
        }

    match = existing_records_df[
        (
            existing_records_df["supplier_id"]
            .str.strip()
            .str.lower()
            == normalize(supplier_id)
        )
        &
        (
            existing_records_df["invoice_number"]
            .str.strip()
            .str.lower()
            == normalize(invoice_number)
        )
    ]

    if match.empty:
        return {
            "duplicate": False,
            "record": None
        }

    record = match.iloc[0]

    return {
        "duplicate": True,
        "record": {
            "record_id": record["record_id"],
            "supplier_id": record["supplier_id"],
            "supplier_name": record["supplier_name"],
            "invoice_number": record["invoice_number"],
            "invoice_date": record["invoice_date"],
            "currency": record["currency"],
            "net_amount": record["net_amount"],
            "tax_amount": record["tax_amount"],
            "gross_amount": record["gross_amount"],
            "status": record["status"]
        }
    }