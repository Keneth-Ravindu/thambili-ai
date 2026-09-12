import pandas as pd
from rapidfuzz import fuzz, process

from app.config import SUPPLIERS_CSV


suppliers_df = pd.read_csv(
    SUPPLIERS_CSV,
    dtype=str
).fillna("")


def normalize(value: str | None) -> str:
    if not value:
        return ""

    return str(value).strip().lower()


def find_supplier(
    supplier_name: str | None,
    vat_number: str | None
):
    # 1. Best option: exact VAT match
    if vat_number:
        normalized_vat = normalize(vat_number)

        match = suppliers_df[
            suppliers_df["vat_number"]
            .str.strip()
            .str.lower()
            == normalized_vat
        ]

        if not match.empty:
            supplier = match.iloc[0]

            return {
                "supplier_id": supplier["supplier_id"],
                "supplier_name": supplier["registered_name"],
                "trading_name": supplier["trading_name"],
                "vat_number": supplier["vat_number"],
                "payment_terms": supplier["payment_terms"],
                "currency": supplier["currency"],
                "verified": True,
                "match_score": 100,
                "match_method": "vat"
            }

    # 2. Exact registered name
    if supplier_name:
        normalized_name = normalize(supplier_name)

        match = suppliers_df[
            suppliers_df["registered_name"]
            .str.strip()
            .str.lower()
            == normalized_name
        ]

        if not match.empty:
            supplier = match.iloc[0]

            return {
                "supplier_id": supplier["supplier_id"],
                "supplier_name": supplier["registered_name"],
                "trading_name": supplier["trading_name"],
                "vat_number": supplier["vat_number"],
                "payment_terms": supplier["payment_terms"],
                "currency": supplier["currency"],
                "verified": True,
                "match_score": 100,
                "match_method": "registered_name"
            }

    # 3. Exact trading name
    if supplier_name:
        normalized_name = normalize(supplier_name)

        match = suppliers_df[
            suppliers_df["trading_name"]
            .str.strip()
            .str.lower()
            == normalized_name
        ]

        if not match.empty:
            supplier = match.iloc[0]

            return {
                "supplier_id": supplier["supplier_id"],
                "supplier_name": supplier["registered_name"],
                "trading_name": supplier["trading_name"],
                "vat_number": supplier["vat_number"],
                "payment_terms": supplier["payment_terms"],
                "currency": supplier["currency"],
                "verified": True,
                "match_score": 100,
                "match_method": "trading_name"
            }

    # 4. Fuzzy fallback
    if supplier_name:
        supplier_names = suppliers_df["registered_name"].tolist()

        result = process.extractOne(
            supplier_name,
            supplier_names,
            scorer=fuzz.token_sort_ratio
        )

        if result:
            matched_name, score, _ = result

            supplier = suppliers_df[
                suppliers_df["registered_name"] == matched_name
            ].iloc[0]

            return {
                "supplier_id": supplier["supplier_id"],
                "supplier_name": supplier["registered_name"],
                "trading_name": supplier["trading_name"],
                "vat_number": supplier["vat_number"],
                "payment_terms": supplier["payment_terms"],
                "currency": supplier["currency"],
                "verified": score >= 80,
                "match_score": round(score, 2),
                "match_method": "fuzzy"
            }

    return {
        "supplier_id": None,
        "supplier_name": supplier_name,
        "trading_name": None,
        "vat_number": vat_number,
        "payment_terms": None,
        "currency": None,
        "verified": False,
        "match_score": 0,
        "match_method": "none"
    }