"""The flagging / duplicate-detection / outlier engine.

Runs once right after extraction, and again every time a reviewer edits a
field (so corrections re-check cleanly). Never blocks a save or an approval -
it only decides what shows up as a flag for Nimali to see, per the brief:
she stays in control of what becomes a financial record.
"""

import datetime as dt
import statistics
from dataclasses import dataclass, field

from rapidfuzz import fuzz
from sqlalchemy import func
from sqlalchemy.orm import Session

from .config import THAMBILI_NAME_HINT, THAMBILI_VAT
from .costcentre import resolve_cost_centre
from .models import ExistingRecord, Invoice, Supplier

SUPPLIER_MATCH_THRESHOLD = 82.0
AMOUNT_TOLERANCE_ABS = 100.0
AMOUNT_TOLERANCE_PCT = 0.03
NEAR_DUP_DATE_WINDOW_DAYS = 3
NEAR_DUP_AMOUNT_TOLERANCE = 1.0
OUTLIER_HIGH_MULTIPLE = 2.5
OUTLIER_LOW_MULTIPLE = 0.4
MIN_HISTORY_FOR_OUTLIER = 3

NON_PAYABLE_DOC_TYPES = {"pro_forma_invoice", "statement_of_account"}


@dataclass
class Flag:
    code: str
    message: str
    severity: str = "medium"  # high | medium | low

    def to_dict(self) -> dict:
        return {"code": self.code, "message": self.message, "severity": self.severity}


def _normalize(value: str) -> str:
    return (value or "").strip().casefold()


def match_supplier(db: Session, supplier_name: str, supplier_vat: str) -> tuple[Supplier | None, float]:
    supplier_vat = _normalize(supplier_vat)
    if supplier_vat:
        by_vat = (
            db.query(Supplier)
            .filter(func.lower(Supplier.vat_number) == supplier_vat)
            .first()
        )
        if by_vat:
            return by_vat, 100.0

    if not supplier_name:
        return None, 0.0

    best: Supplier | None = None
    best_score = 0.0
    for supplier in db.query(Supplier).all():
        score = max(
            fuzz.token_sort_ratio(supplier_name, supplier.registered_name),
            fuzz.token_sort_ratio(supplier_name, supplier.trading_name),
        )
        if score > best_score:
            best_score = score
            best = supplier

    if best and best_score >= SUPPLIER_MATCH_THRESHOLD:
        return best, best_score
    return None, best_score


def _check_wrong_entity(invoice: Invoice) -> Flag | None:
    vat = _normalize(invoice.buyer_vat_raw)
    name = _normalize(invoice.buyer_name_raw)
    if vat and vat == _normalize(THAMBILI_VAT):
        return None
    if THAMBILI_NAME_HINT in name:
        return None
    if not vat and not name:
        return Flag(
            "wrong_entity",
            "Could not find a bill-to company name or VAT number on this document at all - "
            "verify it is really addressed to Thambili before approving.",
            "high",
        )
    return Flag(
        "wrong_entity",
        f"This document is billed to '{invoice.buyer_name_raw or 'unknown'}' "
        f"(VAT {invoice.buyer_vat_raw or 'not shown'}), not Thambili Restaurants (VAT {THAMBILI_VAT}). "
        "It may belong to a different company.",
        "high",
    )


def _check_document_type(invoice: Invoice) -> list[Flag]:
    flags: list[Flag] = []
    if invoice.document_type == "pro_forma_invoice":
        flags.append(
            Flag(
                "non_payable_document",
                "This is a pro-forma invoice, not a demand for payment - it should not be recorded as a payable until the supplier issues a real tax invoice.",
                "high",
            )
        )
    elif invoice.document_type == "statement_of_account":
        flags.append(
            Flag(
                "non_payable_document",
                "This is an account statement, not an invoice - do not pay or record against it directly. Locate the individual invoices it lists.",
                "high",
            )
        )
    elif invoice.document_type == "credit_note":
        flags.append(
            Flag(
                "credit_note",
                "This is a credit note (reduces what's owed to the supplier), not a standard purchase invoice.",
                "medium",
            )
        )
    elif invoice.document_type == "receipt":
        flags.append(
            Flag("receipt_not_invoice", "This looks like a payment receipt rather than a supplier invoice.", "medium")
        )
    elif invoice.document_type == "other":
        flags.append(
            Flag("unrecognised_document", "Could not confidently identify this as an invoice - please check.", "medium")
        )
    return flags


def _check_math(invoice: Invoice) -> Flag | None:
    if invoice.net_amount is None or invoice.tax_amount is None or invoice.gross_amount is None:
        return None
    expected = float(invoice.net_amount) + float(invoice.tax_amount)
    actual = float(invoice.gross_amount)
    tolerance = max(AMOUNT_TOLERANCE_ABS, AMOUNT_TOLERANCE_PCT * abs(actual))
    diff = abs(expected - actual)
    if diff > tolerance:
        return Flag(
            "totals_do_not_reconcile",
            f"Net ({invoice.net_amount:,.2f}) + tax ({invoice.tax_amount:,.2f}) = {expected:,.2f}, "
            f"which doesn't match the stated total of {actual:,.2f} (difference {diff:,.2f}). "
            "There may be an unlisted charge/discount, or an extraction error.",
            "high",
        )
    return None


def _check_duplicates(db: Session, invoice: Invoice) -> list[Flag]:
    flags: list[Flag] = []
    inv_number = _normalize(invoice.invoice_number)
    if not inv_number or not invoice.supplier_id:
        return flags

    # 1. Exact duplicate already posted to the CRM.
    existing_match = (
        db.query(ExistingRecord)
        .filter(ExistingRecord.supplier_id == invoice.supplier_id)
        .filter(func.lower(ExistingRecord.invoice_number) == inv_number)
        .first()
    )
    if existing_match:
        flags.append(
            Flag(
                "duplicate_invoice_number",
                f"Invoice number '{invoice.invoice_number}' for this supplier was already posted to the CRM as "
                f"{existing_match.record_id} on {existing_match.date_entered}. Paying this again would be a duplicate payment.",
                "high",
            )
        )

    # 2. Exact duplicate elsewhere in this upload batch.
    batch_matches = (
        db.query(Invoice)
        .filter(Invoice.id != invoice.id)
        .filter(Invoice.supplier_id == invoice.supplier_id)
        .filter(func.lower(Invoice.invoice_number) == inv_number)
        .filter(Invoice.status != "rejected")
        .all()
    )
    for other in batch_matches:
        other_ref = f"'{other.source_filename}' (upload #{other.id})"
        flags.append(
            Flag(
                "duplicate_invoice_number",
                f"The same invoice number '{invoice.invoice_number}' from this supplier also appears in "
                f"{other_ref}. Only one of these should be approved.",
                "high",
            )
        )
        if invoice.bank_account and other.bank_account and invoice.bank_account.strip() != other.bank_account.strip():
            flags.append(
                Flag(
                    "bank_details_mismatch_on_duplicate",
                    f"This upload and {other_ref} claim to be the same invoice "
                    f"({invoice.invoice_number}) but list different bank accounts ('{invoice.bank_account}' vs "
                    f"'{other.bank_account}'). This is a common invoice-fraud pattern - verify the correct account "
                    "directly with the supplier before paying.",
                    "high",
                )
            )

    # 3. Near-duplicate: same supplier + same amount + nearby date, different invoice number.
    if invoice.gross_amount is not None and invoice.invoice_date:
        candidates = (
            db.query(Invoice)
            .filter(Invoice.id != invoice.id)
            .filter(Invoice.supplier_id == invoice.supplier_id)
            .filter(func.lower(Invoice.invoice_number) != inv_number)
            .filter(Invoice.status != "rejected")
            .filter(Invoice.gross_amount.isnot(None))
            .filter(Invoice.invoice_date.isnot(None))
            .all()
        )
        for other in candidates:
            if abs(float(other.gross_amount) - float(invoice.gross_amount)) > NEAR_DUP_AMOUNT_TOLERANCE:
                continue
            day_gap = abs((other.invoice_date - invoice.invoice_date).days)
            if day_gap <= NEAR_DUP_DATE_WINDOW_DAYS:
                flags.append(
                    Flag(
                        "possible_duplicate",
                        f"Same supplier, same amount ({invoice.gross_amount:,.2f}) and a nearby date as "
                        f"'{other.source_filename}' (upload #{other.id}, invoice {other.invoice_number}), but a "
                        "different invoice number. Check this isn't the same delivery billed twice.",
                        "medium",
                    )
                )

    return flags


def _check_outlier(db: Session, invoice: Invoice) -> Flag | None:
    if not invoice.supplier_id or invoice.gross_amount is None:
        return None
    history = [
        float(r.gross_amount)
        for r in db.query(ExistingRecord).filter(ExistingRecord.supplier_id == invoice.supplier_id).all()
    ]
    if len(history) < MIN_HISTORY_FOR_OUTLIER:
        return None
    median = statistics.median(history)
    if median <= 0:
        return None
    amount = float(invoice.gross_amount)
    if amount > median * OUTLIER_HIGH_MULTIPLE:
        return Flag(
            "unusual_amount",
            f"This invoice's total ({amount:,.2f}) is much higher than this supplier's usual amount "
            f"(median {median:,.2f} over {len(history)} past invoices).",
            "medium",
        )
    if amount < median * OUTLIER_LOW_MULTIPLE:
        return Flag(
            "unusual_amount",
            f"This invoice's total ({amount:,.2f}) is much lower than this supplier's usual amount "
            f"(median {median:,.2f} over {len(history)} past invoices) - check nothing is missing.",
            "medium",
        )
    return None


def _check_completeness(invoice: Invoice) -> list[Flag]:
    flags: list[Flag] = []
    if not invoice.supplier_id:
        flags.append(
            Flag(
                "unmatched_supplier",
                f"Could not confidently match '{invoice.supplier_name_raw or 'this supplier'}' to a supplier on file. "
                "Confirm the supplier and, if genuine, add them to the supplier list.",
                "high",
            )
        )
    if not invoice.invoice_number:
        flags.append(Flag("missing_invoice_number", "No invoice number could be read from this document.", "high"))
    if not invoice.invoice_date:
        flags.append(Flag("missing_invoice_date", "No invoice date could be read from this document.", "high"))
    if invoice.gross_amount is None:
        flags.append(Flag("missing_total", "No total amount could be read from this document.", "high"))
    if not invoice.cost_centre:
        flags.append(
            Flag(
                "cost_centre_unresolved",
                "Could not work out which restaurant/kitchen this invoice belongs to from the address shown - please pick one.",
                "low",
            )
        )
    return flags


def run_rules(db: Session, invoice: Invoice) -> list[dict]:
    """Recomputes every flag for this invoice. Does not commit."""
    flags: list[Flag] = []

    wrong_entity = _check_wrong_entity(invoice)
    if wrong_entity:
        flags.append(wrong_entity)

    flags.extend(_check_document_type(invoice))

    math_flag = _check_math(invoice)
    if math_flag:
        flags.append(math_flag)

    flags.extend(_check_completeness(invoice))
    flags.extend(_check_duplicates(db, invoice))

    outlier_flag = _check_outlier(db, invoice)
    if outlier_flag:
        flags.append(outlier_flag)

    if invoice.extraction_error:
        flags.append(
            Flag("extraction_failed", f"Automated extraction failed: {invoice.extraction_error}", "high")
        )

    return [f.to_dict() for f in flags]


def derive_status(flags: list[dict]) -> str:
    return "needs_attention" if flags else "ready_to_approve"


def recompute_cost_centre(invoice: Invoice) -> str:
    return resolve_cost_centre(invoice.bill_to_location_raw, invoice.buyer_name_raw)
