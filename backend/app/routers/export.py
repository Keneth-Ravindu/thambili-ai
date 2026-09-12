import csv
import io

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Invoice, Supplier

router = APIRouter(prefix="/api/export", tags=["export"])

COLUMNS = [
    "record_id",
    "supplier_id",
    "supplier_name",
    "invoice_number",
    "invoice_date",
    "date_entered",
    "currency",
    "net_amount",
    "tax_amount",
    "gross_amount",
    "cost_centre",
    "entered_by",
    "status",
]


@router.get("")
def export_approved(db: Session = Depends(get_db)):
    """CSV of approved invoices, in the same column layout as existing_records.csv
    so it can be appended straight into the CRM's records."""
    invoices = (
        db.query(Invoice)
        .filter(Invoice.status == "approved")
        .order_by(Invoice.record_id)
        .all()
    )

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=COLUMNS)
    writer.writeheader()
    for inv in invoices:
        supplier = db.get(Supplier, inv.supplier_id) if inv.supplier_id else None
        writer.writerow(
            {
                "record_id": inv.record_id,
                "supplier_id": inv.supplier_id or "",
                "supplier_name": supplier.registered_name if supplier else inv.supplier_name_raw,
                "invoice_number": inv.invoice_number,
                "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else "",
                "date_entered": inv.date_entered.isoformat() if inv.date_entered else "",
                "currency": inv.currency,
                "net_amount": f"{inv.net_amount:.2f}" if inv.net_amount is not None else "",
                "tax_amount": f"{inv.tax_amount:.2f}" if inv.tax_amount is not None else "",
                "gross_amount": f"{inv.gross_amount:.2f}" if inv.gross_amount is not None else "",
                "cost_centre": inv.cost_centre,
                "entered_by": inv.entered_by,
                "status": "Posted",
            }
        )

    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=approved_invoices_export.csv"},
    )
