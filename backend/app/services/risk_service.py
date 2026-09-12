def calculate_risk(
    supplier_verified: bool,
    duplicate_existing: bool,
    financial_valid: bool,
    issues: list,
):
    risk_score = 0

    # -----------------------------------
    # Historical duplicate
    # -----------------------------------

    if duplicate_existing:
        risk_score += 60

    # -----------------------------------
    # Supplier not verified
    # -----------------------------------

    if not supplier_verified:
        risk_score += 30

    # -----------------------------------
    # Financial mismatch
    # -----------------------------------

    if not financial_valid:
        risk_score += 30

    # -----------------------------------
    # Missing fields
    # -----------------------------------

    has_missing_field = any(
        "missing" in issue.lower()
        for issue in issues
    )

    if has_missing_field:
        risk_score += 20

    # -----------------------------------
    # Status
    # -----------------------------------

    if risk_score >= 50:
        status = "high_risk"

    elif risk_score >= 20:
        status = "needs_review"

    else:
        status = "ready"

    return {
        "risk_score": risk_score,
        "status": status,
    }