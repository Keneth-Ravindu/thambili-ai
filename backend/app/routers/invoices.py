import json
import shutil
import uuid
from datetime import datetime

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    UploadFile,
)

from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import UPLOAD_DIR
from app.database import get_db
from app.models import Invoice
from app.schemas import (
    ExtractedInvoice,
    InvoiceUpdate,
)

from app.services.pipeline_service import process_invoice
from app.services.supplier_service import find_supplier
from app.services.duplicate_service import (
    check_existing_duplicate,
)
from app.services.validation_service import (
    validate_invoice,
)
from app.services.risk_service import (
    calculate_risk,
)


router = APIRouter(
    prefix="/api/invoices",
    tags=["Invoices"],
)


# =========================================================
# HELPER
# =========================================================

def parse_issues(value):
    """
    Safely convert stored JSON issues into a Python list.
    """

    if not value:
        return []

    try:
        return json.loads(value)

    except (json.JSONDecodeError, TypeError):
        return []


# =========================================================
# TEST PDF UPLOAD
# =========================================================

@router.post("/test-upload")
async def test_upload(
    file: UploadFile = File(...)
):
    """
    Simple endpoint used to confirm that PDF upload works.
    """

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided",
        )

    return {
        "filename": file.filename,
        "content_type": file.content_type,
    }


# =========================================================
# UPLOAD + PROCESS INVOICE
# =========================================================

@router.post("/upload")
async def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Upload and process one supplier invoice.

    Flow:

    PDF
      ↓
    Claude
      ↓
    Supplier verification
      ↓
    Existing-record duplicate detection
      ↓
    Current-upload duplicate detection
      ↓
    Financial validation
      ↓
    Risk scoring
      ↓
    SQLite
    """

    # -----------------------------------------------------
    # Validate incoming file
    # -----------------------------------------------------

    if not file.filename:
        raise HTTPException(
            status_code=400,
            detail="No file provided",
        )

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are supported",
        )

    # -----------------------------------------------------
    # Make sure upload directory exists
    # -----------------------------------------------------

    UPLOAD_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    # Give stored file a safe unique name
    stored_filename = f"{uuid.uuid4()}.pdf"

    file_path = (
        UPLOAD_DIR
        / stored_filename
    )

    try:

        # -------------------------------------------------
        # Save original PDF
        # -------------------------------------------------

        with open(file_path, "wb") as buffer:

            shutil.copyfileobj(
                file.file,
                buffer,
            )

        # -------------------------------------------------
        # Run processing pipeline
        # -------------------------------------------------

        result = process_invoice(
            str(file_path)
        )

        extracted = result["extracted"]
        supplier = result["supplier"]

        # -------------------------------------------------
        # Check previously uploaded invoices
        # -------------------------------------------------

        uploaded_duplicate = None

        if (
            supplier["supplier_id"]
            and extracted["invoice_number"]
        ):

            uploaded_duplicate = (
                db.query(Invoice)
                .filter(
                    Invoice.supplier_id
                    == supplier["supplier_id"],

                    Invoice.invoice_number
                    == extracted["invoice_number"],
                )
                .first()
            )

        duplicate_batch = (
            uploaded_duplicate
            is not None
        )

        # -------------------------------------------------
        # Start with pipeline results
        # -------------------------------------------------

        issues = list(
            result["issues"]
        )

        risk_score = (
            result["risk_score"]
        )

        status = (
            result["status"]
        )

        # -------------------------------------------------
        # Uploaded duplicate
        # -------------------------------------------------

        duplicate_message = (
            "Duplicate invoice detected "
            "among uploaded invoices"
        )

        if duplicate_batch:

            if duplicate_message not in issues:
                issues.append(
                    duplicate_message
                )

            risk_score += 50
            status = "high_risk"

            # Also mark the first uploaded copy
            previous_issues = parse_issues(
                uploaded_duplicate.issues
            )

            if (
                duplicate_message
                not in previous_issues
            ):
                previous_issues.append(
                    duplicate_message
                )

            uploaded_duplicate.duplicate_batch = True
            uploaded_duplicate.status = "high_risk"

            uploaded_duplicate.risk_score = max(
                uploaded_duplicate.risk_score or 0,
                50,
            )

            uploaded_duplicate.issues = json.dumps(
                previous_issues
            )

        # -------------------------------------------------
        # Detect conflicting duplicate information
        # -------------------------------------------------

        conflicts = []

        if duplicate_batch:

            # Different gross amount
            if (
                uploaded_duplicate.gross_amount is not None
                and extracted["gross_amount"] is not None
            ):

                if abs(
                    uploaded_duplicate.gross_amount
                    - extracted["gross_amount"]
                ) > 1:

                    conflicts.append(
                        "Duplicate invoices contain "
                        "different gross amounts"
                    )

            # Different bank accounts
            if (
                uploaded_duplicate.bank_account
                and extracted["bank_account"]
                and uploaded_duplicate.bank_account
                != extracted["bank_account"]
            ):

                conflicts.append(
                    "Duplicate invoices contain "
                    "different bank account details"
                )

            # Different invoice dates
            if (
                uploaded_duplicate.invoice_date
                and extracted["invoice_date"]
                and uploaded_duplicate.invoice_date
                != extracted["invoice_date"]
            ):

                conflicts.append(
                    "Duplicate invoices contain "
                    "different invoice dates"
                )

            # Add conflicts to both invoices
            if conflicts:

                previous_issues = parse_issues(
                    uploaded_duplicate.issues
                )

                for conflict in conflicts:

                    if conflict not in issues:
                        issues.append(conflict)

                    if conflict not in previous_issues:
                        previous_issues.append(
                            conflict
                        )

                uploaded_duplicate.issues = (
                    json.dumps(
                        previous_issues
                    )
                )

                uploaded_duplicate.status = (
                    "high_risk"
                )

                uploaded_duplicate.risk_score = max(
                    uploaded_duplicate.risk_score or 0,
                    80,
                )

                risk_score = max(
                    risk_score,
                    80,
                )

                status = "high_risk"

        # -------------------------------------------------
        # Save invoice
        # -------------------------------------------------

        invoice = Invoice(

            original_filename=
                file.filename,

            stored_filename=
                stored_filename,

            supplier_id=
                supplier["supplier_id"],

            supplier_name=
                supplier["supplier_name"],

            supplier_vat_number=
                extracted[
                    "supplier_vat_number"
                ],

            supplier_verified=
                supplier["verified"],

            supplier_match_score=
                supplier["match_score"],

            invoice_number=
                extracted[
                    "invoice_number"
                ],

            invoice_date=
                extracted[
                    "invoice_date"
                ],

            due_date=
                extracted[
                    "due_date"
                ],

            purchase_order=
                extracted[
                    "purchase_order"
                ],

            currency=
                extracted[
                    "currency"
                ],

            net_amount=
                extracted[
                    "net_amount"
                ],

            additional_charges=(
                extracted[
                    "additional_charges"
                ]
                or 0
            ),

            tax_amount=
                extracted[
                    "tax_amount"
                ],

            gross_amount=
                extracted[
                    "gross_amount"
                ],

            bank_name=
                extracted[
                    "bank_name"
                ],

            bank_account=
                extracted[
                    "bank_account"
                ],

            duplicate_existing=
                result["duplicate"][
                    "duplicate"
                ],

            duplicate_batch=
                duplicate_batch,

            financial_valid=
                result[
                    "financial_valid"
                ],

            risk_score=
                risk_score,

            issues=
                json.dumps(
                    issues
                ),

            status=
                status,
        )

        db.add(invoice)

        db.commit()

        db.refresh(invoice)

        # -------------------------------------------------
        # Response
        # -------------------------------------------------

        return {

            "success": True,

            "id":
                invoice.id,

            "filename":
                invoice.original_filename,

            "supplier": {

                "supplier_id":
                    invoice.supplier_id,

                "supplier_name":
                    invoice.supplier_name,

                "vat_number":
                    invoice.supplier_vat_number,

                "verified":
                    invoice.supplier_verified,

                "match_score":
                    invoice.supplier_match_score,
            },

            "invoice_number":
                invoice.invoice_number,

            "invoice_date":
                invoice.invoice_date,

            "due_date":
                invoice.due_date,

            "purchase_order":
                invoice.purchase_order,

            "currency":
                invoice.currency,

            "net_amount":
                invoice.net_amount,

            "additional_charges":
                invoice.additional_charges,

            "tax_amount":
                invoice.tax_amount,

            "gross_amount":
                invoice.gross_amount,

            "bank_name":
                invoice.bank_name,

            "bank_account":
                invoice.bank_account,

            "duplicate_existing":
                invoice.duplicate_existing,

            "duplicate_batch":
                invoice.duplicate_batch,

            "financial_valid":
                invoice.financial_valid,

            "risk_score":
                invoice.risk_score,

            "status":
                invoice.status,

            "issues":
                issues,
        }

    except HTTPException:
        raise

    except Exception as error:

        db.rollback()

        # Remove incomplete file if processing failed
        if file_path.exists():
            file_path.unlink()

        raise HTTPException(
            status_code=500,
            detail=str(error),
        )


# =========================================================
# GET ALL INVOICES
# =========================================================

@router.get("")
def get_invoices(
    db: Session = Depends(get_db),
):

    invoices = (
        db.query(Invoice)
        .order_by(
            Invoice.created_at.desc()
        )
        .all()
    )

    results = []

    for invoice in invoices:

        results.append({

            "id":
                invoice.id,

            "filename":
                invoice.original_filename,

            "supplier_id":
                invoice.supplier_id,

            "supplier_name":
                invoice.supplier_name,

            "invoice_number":
                invoice.invoice_number,

            "invoice_date":
                invoice.invoice_date,

            "gross_amount":
                invoice.gross_amount,

            "currency":
                invoice.currency,

            "supplier_verified":
                invoice.supplier_verified,

            "duplicate_existing":
                invoice.duplicate_existing,

            "duplicate_batch":
                invoice.duplicate_batch,

            "financial_valid":
                invoice.financial_valid,

            "risk_score":
                invoice.risk_score,

            "status":
                invoice.status,

            "issues":
                parse_issues(
                    invoice.issues
                ),
        })

    return results


# =========================================================
# GET ONE INVOICE
# =========================================================

@router.get("/{invoice_id}")
def get_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
):

    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id
            == invoice_id
        )
        .first()
    )

    if not invoice:

        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    return {

        "id":
            invoice.id,

        "filename":
            invoice.original_filename,

        "supplier_id":
            invoice.supplier_id,

        "supplier_name":
            invoice.supplier_name,

        "supplier_vat_number":
            invoice.supplier_vat_number,

        "supplier_verified":
            invoice.supplier_verified,

        "supplier_match_score":
            invoice.supplier_match_score,

        "invoice_number":
            invoice.invoice_number,

        "invoice_date":
            invoice.invoice_date,

        "due_date":
            invoice.due_date,

        "purchase_order":
            invoice.purchase_order,

        "currency":
            invoice.currency,

        "net_amount":
            invoice.net_amount,

        "additional_charges":
            invoice.additional_charges,

        "tax_amount":
            invoice.tax_amount,

        "gross_amount":
            invoice.gross_amount,

        "bank_name":
            invoice.bank_name,

        "bank_account":
            invoice.bank_account,

        "duplicate_existing":
            invoice.duplicate_existing,

        "duplicate_batch":
            invoice.duplicate_batch,

        "financial_valid":
            invoice.financial_valid,

        "risk_score":
            invoice.risk_score,

        "status":
            invoice.status,

        "issues":
            parse_issues(
                invoice.issues
            ),

        "approved_by":
            invoice.approved_by,

        "approved_at":
            invoice.approved_at,
    }


# =========================================================
# UPDATE / CORRECT INVOICE
# =========================================================

@router.put("/{invoice_id}")
def update_invoice(
    invoice_id: int,
    updates: InvoiceUpdate,
    db: Session = Depends(get_db),
):

    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id
            == invoice_id
        )
        .first()
    )

    if not invoice:

        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    # Prevent editing approved invoices
    if invoice.status == "approved":

        raise HTTPException(
            status_code=400,
            detail=(
                "Approved invoices cannot "
                "be edited"
            ),
        )

    # -----------------------------------------------------
    # Apply fields Nimali changed
    # -----------------------------------------------------

    update_data = updates.model_dump(
        exclude_unset=True
    )

    for field, value in update_data.items():

        setattr(
            invoice,
            field,
            value,
        )

    # -----------------------------------------------------
    # Build invoice schema for revalidation
    # -----------------------------------------------------

    extracted = ExtractedInvoice(

        supplier_name=
            invoice.supplier_name,

        supplier_vat_number=
            invoice.supplier_vat_number,

        invoice_number=
            invoice.invoice_number,

        invoice_date=
            invoice.invoice_date,

        due_date=
            invoice.due_date,

        purchase_order=
            invoice.purchase_order,

        currency=
            invoice.currency,

        net_amount=
            invoice.net_amount,

        additional_charges=
            invoice.additional_charges,

        tax_amount=
            invoice.tax_amount,

        gross_amount=
            invoice.gross_amount,

        bank_name=
            invoice.bank_name,

        bank_account=
            invoice.bank_account,
    )

    # -----------------------------------------------------
    # Re-check supplier
    # -----------------------------------------------------

    supplier = find_supplier(
        extracted.supplier_name,
        extracted.supplier_vat_number,
    )

    invoice.supplier_id = (
        supplier["supplier_id"]
    )

    invoice.supplier_name = (
        supplier["supplier_name"]
    )

    invoice.supplier_verified = (
        supplier["verified"]
    )

    invoice.supplier_match_score = (
        supplier["match_score"]
    )

    # -----------------------------------------------------
    # Re-check historical duplicates
    # -----------------------------------------------------

    historical_duplicate = (
        check_existing_duplicate(
            supplier["supplier_id"],
            extracted.invoice_number,
        )
    )

    invoice.duplicate_existing = (
        historical_duplicate[
            "duplicate"
        ]
    )

    # -----------------------------------------------------
    # Re-check other uploaded invoices
    # -----------------------------------------------------

    other_uploaded_invoice = None

    if (
        supplier["supplier_id"]
        and extracted.invoice_number
    ):

        other_uploaded_invoice = (
            db.query(Invoice)
            .filter(
                Invoice.id
                != invoice.id,

                Invoice.supplier_id
                == supplier["supplier_id"],

                Invoice.invoice_number
                == extracted.invoice_number,
            )
            .first()
        )

    invoice.duplicate_batch = (
        other_uploaded_invoice
        is not None
    )

    # -----------------------------------------------------
    # Re-run validation
    # -----------------------------------------------------

    validation = validate_invoice(
        extracted,
        supplier["verified"],
        historical_duplicate[
            "duplicate"
        ],
    )

    issues = list(
        validation["issues"]
    )

    # -----------------------------------------------------
    # Add current-upload duplicate
    # -----------------------------------------------------

    if invoice.duplicate_batch:

        issues.append(
            "Duplicate invoice detected "
            "among uploaded invoices"
        )

    # -----------------------------------------------------
    # Check duplicate conflicts
    # -----------------------------------------------------

    conflicts = []

    if other_uploaded_invoice:

        if (
            other_uploaded_invoice.gross_amount
            is not None
            and extracted.gross_amount
            is not None
        ):

            if abs(
                other_uploaded_invoice.gross_amount
                - extracted.gross_amount
            ) > 1:

                conflicts.append(
                    "Duplicate invoices contain "
                    "different gross amounts"
                )

        if (
            other_uploaded_invoice.bank_account
            and extracted.bank_account
            and other_uploaded_invoice.bank_account
            != extracted.bank_account
        ):

            conflicts.append(
                "Duplicate invoices contain "
                "different bank account details"
            )

        if (
            other_uploaded_invoice.invoice_date
            and extracted.invoice_date
            and other_uploaded_invoice.invoice_date
            != extracted.invoice_date
        ):

            conflicts.append(
                "Duplicate invoices contain "
                "different invoice dates"
            )

    issues.extend(
        conflict
        for conflict in conflicts
        if conflict not in issues
    )

    # -----------------------------------------------------
    # Recalculate risk
    # -----------------------------------------------------

    risk = calculate_risk(
        supplier["verified"],
        historical_duplicate[
            "duplicate"
        ],
        validation[
            "financial_valid"
        ],
        issues,
    )

    risk_score = (
        risk["risk_score"]
    )

    status = (
        risk["status"]
    )

    if invoice.duplicate_batch:

        risk_score += 50
        status = "high_risk"

    if conflicts:

        risk_score = max(
            risk_score,
            80,
        )

        status = "high_risk"

    # -----------------------------------------------------
    # Save updated validation state
    # -----------------------------------------------------

    invoice.financial_valid = (
        validation[
            "financial_valid"
        ]
    )

    invoice.issues = json.dumps(
        issues
    )

    invoice.risk_score = (
        risk_score
    )

    invoice.status = (
        status
    )

    db.commit()

    db.refresh(invoice)

    return {

        "success": True,

        "message":
            "Invoice updated and revalidated",

        "invoice": {

            "id":
                invoice.id,

            "supplier_id":
                invoice.supplier_id,

            "supplier_name":
                invoice.supplier_name,

            "supplier_vat_number":
                invoice.supplier_vat_number,

            "supplier_verified":
                invoice.supplier_verified,

            "supplier_match_score":
                invoice.supplier_match_score,

            "invoice_number":
                invoice.invoice_number,

            "invoice_date":
                invoice.invoice_date,

            "due_date":
                invoice.due_date,

            "purchase_order":
                invoice.purchase_order,

            "currency":
                invoice.currency,

            "net_amount":
                invoice.net_amount,

            "additional_charges":
                invoice.additional_charges,

            "tax_amount":
                invoice.tax_amount,

            "gross_amount":
                invoice.gross_amount,

            "bank_name":
                invoice.bank_name,

            "bank_account":
                invoice.bank_account,

            "duplicate_existing":
                invoice.duplicate_existing,

            "duplicate_batch":
                invoice.duplicate_batch,

            "financial_valid":
                invoice.financial_valid,

            "risk_score":
                invoice.risk_score,

            "status":
                invoice.status,

            "issues":
                issues,
        }
    }


# =========================================================
# VIEW ORIGINAL PDF
# =========================================================

@router.get("/{invoice_id}/pdf")
def get_invoice_pdf(
    invoice_id: int,
    db: Session = Depends(get_db),
):

    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id
            == invoice_id
        )
        .first()
    )

    if not invoice:

        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    file_path = (
        UPLOAD_DIR
        / invoice.stored_filename
    )

    if not file_path.exists():

        raise HTTPException(
            status_code=404,
            detail="Original PDF not found",
        )

    return FileResponse(
        path=file_path,
        media_type="application/pdf",
        filename=invoice.original_filename,
    )


# =========================================================
# APPROVE INVOICE
# =========================================================

@router.post("/{invoice_id}/approve")
def approve_invoice(
    invoice_id: int,
    db: Session = Depends(get_db),
):

    invoice = (
        db.query(Invoice)
        .filter(
            Invoice.id
            == invoice_id
        )
        .first()
    )

    if not invoice:

        raise HTTPException(
            status_code=404,
            detail="Invoice not found",
        )

    if invoice.status == "approved":

        return {
            "success": True,
            "message":
                "Invoice is already approved",
            "invoice_id":
                invoice.id,
            "status":
                invoice.status,
        }

    invoice.status = "approved"

    invoice.approved_by = "Nimali"

    invoice.approved_at = (
        datetime.utcnow()
    )

    db.commit()

    db.refresh(invoice)

    return {

        "success": True,

        "message":
            "Invoice approved successfully",

        "invoice_id":
            invoice.id,

        "status":
            invoice.status,

        "approved_by":
            invoice.approved_by,

        "approved_at":
            invoice.approved_at,
    }