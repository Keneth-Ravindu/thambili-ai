import datetime as dt
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..config import INVOICES_DIR
from ..db import get_db
from ..extraction import extract_invoice_safe
from ..models import Invoice, LineItem, Supplier
from ..parsing import normalize_str, parse_date, to_float
from ..rules import derive_status, match_supplier, recompute_cost_centre, run_rules
from ..schemas import (
    ApproveRequest,
    InvoiceDetail,
    InvoiceSummary,
    InvoiceUpdate,
    RejectRequest,
    StatsOut,
)
from ..seed import next_record_id

router = APIRouter(prefix="/api/invoices", tags=["invoices"])

UPLOAD_DIR = INVOICES_DIR / "uploaded"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

REQUIRED_FOR_APPROVAL = ["supplier_id", "invoice_number", "invoice_date", "gross_amount"]


def _process_invoice(db: Session, invoice: Invoice) -> None:
    """Runs extraction + matching + rules for a freshly-uploaded invoice."""
    data, error = extract_invoice_safe(Path(invoice.stored_path))
    invoice.extraction_error = error

    if data:
        invoice.raw_extraction = data
        invoice.document_type = normalize_str(data.get("document_type")) or "unknown"
        invoice.supplier_name_raw = normalize_str(data.get("supplier_name"))
        invoice.buyer_name_raw = normalize_str(data.get("buyer_name"))
        invoice.buyer_vat_raw = normalize_str(data.get("buyer_vat"))
        invoice.bill_to_location_raw = normalize_str(data.get("bill_to_location"))
        invoice.invoice_number = normalize_str(data.get("invoice_number"))
        invoice.invoice_date = parse_date(data.get("invoice_date"))
        invoice.due_date = parse_date(data.get("due_date"))
        invoice.po_number = normalize_str(data.get("po_number"))
        invoice.currency = normalize_str(data.get("currency")) or "LKR"
        invoice.payment_terms = normalize_str(data.get("payment_terms"))
        invoice.bank_account = normalize_str(data.get("bank_account"))
        invoice.net_amount = to_float(data.get("subtotal"))
        invoice.tax_amount = to_float(data.get("tax_amount"))
        invoice.gross_amount = to_float(data.get("total_amount"))

        supplier, confidence = match_supplier(
            db, invoice.supplier_name_raw, normalize_str(data.get("supplier_vat"))
        )
        invoice.supplier_id = supplier.supplier_id if supplier else None
        invoice.supplier_match_confidence = confidence

        for item in data.get("line_items") or []:
            db.add(
                LineItem(
                    invoice_id=invoice.id,
                    position=len(invoice.line_items),
                    description=normalize_str(item.get("description")),
                    quantity=to_float(item.get("quantity")),
                    unit=normalize_str(item.get("unit")),
                    unit_rate=to_float(item.get("unit_rate")),
                    amount=to_float(item.get("amount")),
                )
            )
        db.flush()

        invoice.cost_centre = recompute_cost_centre(invoice)

    invoice.flags = run_rules(db, invoice)
    invoice.status = derive_status(invoice.flags)
    db.commit()


def _reconcile_open_invoices(db: Session) -> None:
    """Re-runs the rules engine on every still-open invoice.

    Duplicate/near-duplicate checks are only as good as what existed in the
    database at the moment an invoice was processed. Without this pass, an
    invoice uploaded first would never learn about a duplicate uploaded
    afterwards. Cheap enough to run over the whole open set given the small
    scale of this dataset.
    """
    open_invoices = (
        db.query(Invoice)
        .filter(Invoice.status.in_(["needs_attention", "ready_to_approve"]))
        .all()
    )
    for invoice in open_invoices:
        invoice.flags = run_rules(db, invoice)
        invoice.status = derive_status(invoice.flags)
    db.commit()


@router.post("/upload", response_model=list[InvoiceSummary])
async def upload_invoices(files: list[UploadFile], db: Session = Depends(get_db)):
    created: list[Invoice] = []
    for upload in files:
        if not upload.filename or not upload.filename.lower().endswith(".pdf"):
            raise HTTPException(400, f"'{upload.filename}' is not a PDF file.")
        safe_name = Path(upload.filename).name
        stored_name = f"{uuid.uuid4().hex}_{safe_name}"
        stored_path = UPLOAD_DIR / stored_name
        stored_path.write_bytes(await upload.read())

        invoice = Invoice(
            source_filename=safe_name,
            stored_path=str(stored_path),
            status="processing",
        )
        db.add(invoice)
        db.commit()
        db.refresh(invoice)
        created.append(invoice)

    for invoice in created:
        _process_invoice(db, invoice)

    _reconcile_open_invoices(db)
    for invoice in created:
        db.refresh(invoice)

    return created


@router.get("", response_model=list[InvoiceSummary])
def list_invoices(
    status: str | None = None,
    supplier_id: str | None = None,
    db: Session = Depends(get_db),
):
    query = db.query(Invoice)
    if status:
        query = query.filter(Invoice.status == status)
    if supplier_id:
        query = query.filter(Invoice.supplier_id == supplier_id)
    return query.order_by(Invoice.uploaded_at.desc()).all()


@router.get("/stats", response_model=StatsOut)
def stats(db: Session = Depends(get_db)):
    all_invoices = db.query(Invoice).all()
    by_status = {"processing": 0, "needs_attention": 0, "ready_to_approve": 0, "approved": 0, "rejected": 0}
    approved_value: dict[str, float] = {}
    for inv in all_invoices:
        by_status[inv.status] = by_status.get(inv.status, 0) + 1
        if inv.status == "approved" and inv.gross_amount is not None:
            approved_value[inv.currency] = approved_value.get(inv.currency, 0) + float(inv.gross_amount)
    return StatsOut(
        total=len(all_invoices),
        processing=by_status["processing"],
        needs_attention=by_status["needs_attention"],
        ready_to_approve=by_status["ready_to_approve"],
        approved=by_status["approved"],
        rejected=by_status["rejected"],
        approved_value_by_currency=approved_value,
    )


def _get_or_404(db: Session, invoice_id: int) -> Invoice:
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(404, "Invoice not found")
    return invoice


@router.get("/{invoice_id}", response_model=InvoiceDetail)
def get_invoice(invoice_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, invoice_id)


@router.get("/{invoice_id}/file")
def get_invoice_file(invoice_id: int, db: Session = Depends(get_db)):
    invoice = _get_or_404(db, invoice_id)
    path = Path(invoice.stored_path)
    if not path.exists():
        raise HTTPException(404, "Original file is missing on disk")
    return FileResponse(path, media_type="application/pdf", filename=invoice.source_filename)


@router.patch("/{invoice_id}", response_model=InvoiceDetail)
def update_invoice(invoice_id: int, update: InvoiceUpdate, db: Session = Depends(get_db)):
    invoice = _get_or_404(db, invoice_id)
    if invoice.status in ("approved", "rejected"):
        raise HTTPException(409, f"Invoice is already {invoice.status} and can no longer be edited.")

    payload = update.model_dump(exclude_unset=True, exclude={"line_items"})
    for field_name, value in payload.items():
        if field_name == "supplier_id" and value:
            supplier = db.get(Supplier, value)
            if not supplier:
                raise HTTPException(400, f"Unknown supplier_id '{value}'")
            invoice.supplier_match_confidence = 100.0
        setattr(invoice, field_name, value)

    if update.line_items is not None:
        for item in list(invoice.line_items):
            db.delete(item)
        db.flush()
        for position, item in enumerate(update.line_items):
            db.add(
                LineItem(
                    invoice_id=invoice.id,
                    position=position,
                    description=item.description,
                    quantity=item.quantity,
                    unit=item.unit,
                    unit_rate=item.unit_rate,
                    amount=item.amount,
                )
            )
        db.flush()

    invoice.flags = run_rules(db, invoice)
    invoice.status = derive_status(invoice.flags)
    db.commit()
    _reconcile_open_invoices(db)
    db.refresh(invoice)
    return invoice


@router.post("/{invoice_id}/approve", response_model=InvoiceDetail)
def approve_invoice(invoice_id: int, body: ApproveRequest, db: Session = Depends(get_db)):
    invoice = _get_or_404(db, invoice_id)
    if invoice.status in ("approved", "rejected"):
        raise HTTPException(409, f"Invoice is already {invoice.status}.")

    missing = [f for f in REQUIRED_FOR_APPROVAL if getattr(invoice, f) in (None, "")]
    if missing:
        raise HTTPException(400, f"Cannot approve: missing required field(s) {', '.join(missing)}.")

    invoice.record_id = next_record_id(db)
    invoice.entered_by = body.entered_by
    invoice.date_entered = dt.date.today()
    invoice.reviewed_at = dt.datetime.utcnow()
    invoice.status = "approved"
    db.commit()
    _reconcile_open_invoices(db)
    db.refresh(invoice)
    return invoice


@router.post("/{invoice_id}/reject", response_model=InvoiceDetail)
def reject_invoice(invoice_id: int, body: RejectRequest, db: Session = Depends(get_db)):
    invoice = _get_or_404(db, invoice_id)
    if invoice.status in ("approved", "rejected"):
        raise HTTPException(409, f"Invoice is already {invoice.status}.")

    invoice.status = "rejected"
    invoice.rejection_reason = body.reason
    invoice.reviewed_at = dt.datetime.utcnow()
    db.commit()
    _reconcile_open_invoices(db)
    db.refresh(invoice)
    return invoice


@router.post("/{invoice_id}/reprocess", response_model=InvoiceDetail)
def reprocess_invoice(invoice_id: int, db: Session = Depends(get_db)):
    """Re-runs extraction from scratch (e.g. after a transient API error)."""
    invoice = _get_or_404(db, invoice_id)
    if invoice.status in ("approved", "rejected"):
        raise HTTPException(409, f"Invoice is already {invoice.status}.")
    for item in list(invoice.line_items):
        db.delete(item)
    db.flush()
    _process_invoice(db, invoice)
    _reconcile_open_invoices(db)
    db.refresh(invoice)
    return invoice
