def validate_invoice(
    invoice,
    supplier_verified: bool,
    duplicate_existing: bool,
):
    issues = []

    # -----------------------------------
    # Required fields
    # -----------------------------------

    if not invoice.supplier_name:
        issues.append(
            "Supplier name is missing"
        )

    if not invoice.invoice_number:
        issues.append(
            "Invoice number is missing"
        )

    if not invoice.invoice_date:
        issues.append(
            "Invoice date is missing"
        )

    if invoice.gross_amount is None:
        issues.append(
            "Gross amount is missing"
        )

    # -----------------------------------
    # Supplier verification
    # -----------------------------------

    if not supplier_verified:
        issues.append(
            "Supplier could not be verified"
        )

    # -----------------------------------
    # Historical duplicate
    # -----------------------------------

    if duplicate_existing:
        issues.append(
            "Invoice already exists in finance records"
        )

    # -----------------------------------
    # Financial validation
    # -----------------------------------

    financial_valid = True

    if (
        invoice.net_amount is not None
        and invoice.tax_amount is not None
        and invoice.gross_amount is not None
    ):
        additional_charges = (
            invoice.additional_charges
            or 0
        )

        expected_total = (
            invoice.net_amount
            + additional_charges
            + invoice.tax_amount
        )

        difference = abs(
            expected_total
            - invoice.gross_amount
        )

        # Allow tiny rounding differences
        if difference > 1:
            financial_valid = False

            issues.append(
                "Invoice totals do not reconcile"
            )

    return {
        "issues": issues,
        "financial_valid": financial_valid,
    }