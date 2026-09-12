from app.services.claude_service import extract_invoice
from app.services.supplier_service import find_supplier
from app.services.duplicate_service import check_existing_duplicate


def process_invoice(pdf_path: str):
    # 1. Extract invoice from PDF
    extracted = extract_invoice(pdf_path)

    # 2. Verify supplier
    supplier = find_supplier(
        extracted.supplier_name,
        extracted.supplier_vat_number
    )

    # 3. Check historical duplicate
    duplicate = check_existing_duplicate(
        supplier["supplier_id"],
        extracted.invoice_number
    )

    # 4. Basic validation issues
    issues = []

    if not supplier["verified"]:
        issues.append("Supplier could not be verified")

    if not extracted.invoice_number:
        issues.append("Invoice number is missing")

    if not extracted.invoice_date:
        issues.append("Invoice date is missing")

    if extracted.gross_amount is None:
        issues.append("Gross amount is missing")

    if duplicate["duplicate"]:
        issues.append(
            "Invoice already exists in finance records"
        )

    # 5. Financial validation
    financial_valid = True

    if (
        extracted.net_amount is not None
        and extracted.tax_amount is not None
        and extracted.gross_amount is not None
    ):
        expected_total = (
            extracted.net_amount
            + (extracted.additional_charges or 0)
            + extracted.tax_amount
        )

        if abs(expected_total - extracted.gross_amount) > 1:
            financial_valid = False
            issues.append(
                "Invoice totals do not reconcile"
            )

    # 6. Risk scoring
    risk_score = 0

    if duplicate["duplicate"]:
        risk_score += 60

    if not supplier["verified"]:
        risk_score += 30

    if not financial_valid:
        risk_score += 30

    if any("missing" in issue.lower() for issue in issues):
        risk_score += 20

    if risk_score >= 50:
        status = "high_risk"
    elif risk_score >= 20:
        status = "needs_review"
    else:
        status = "ready"

    # 7. Return combined result
    return {
        "extracted": extracted.model_dump(),
        "supplier": supplier,
        "duplicate": duplicate,
        "financial_valid": financial_valid,
        "issues": issues,
        "risk_score": risk_score,
        "status": status,
    }