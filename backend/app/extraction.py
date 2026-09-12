"""Turns a raw invoice PDF into structured JSON using Claude.

We hand Claude the PDF directly (it reads text-native PDFs and scanned/photographed
ones alike) and force it through a tool-call schema so the response is always
valid, predictable JSON rather than free text we'd have to parse ourselves.
"""

import base64
import json
from pathlib import Path

import anthropic

from .config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL

EXTRACTION_TOOL = {
    "name": "record_invoice_data",
    "description": "Record the structured data extracted from a supplier document.",
    "input_schema": {
        "type": "object",
        "properties": {
            "document_type": {
                "type": "string",
                "enum": [
                    "invoice",
                    "credit_note",
                    "pro_forma_invoice",
                    "statement_of_account",
                    "receipt",
                    "other",
                ],
                "description": (
                    "What kind of document this actually is. Use 'statement_of_account' for "
                    "an account summary/statement that explicitly says not to pay against it. "
                    "Use 'pro_forma_invoice' for quotes/pro-forma documents that are not a "
                    "demand for payment. Use 'credit_note' for a credit/refund note."
                ),
            },
            "supplier_name": {"type": "string", "description": "The selling company's name, as printed."},
            "supplier_vat": {"type": "string", "description": "Supplier's VAT registration number, if shown."},
            "buyer_name": {"type": "string", "description": "The billed-to / customer company name, as printed."},
            "buyer_vat": {"type": "string", "description": "Buyer's VAT registration number, if shown."},
            "bill_to_location": {
                "type": "string",
                "description": "The specific outlet/branch/site named in the bill-to or deliver-to address (e.g. 'Thambili Colombo 03', 'Thambili Central Kitchen'), plus the street address line.",
            },
            "invoice_number": {"type": "string", "description": "The invoice/document/reference number."},
            "invoice_date": {"type": "string", "description": "Document date, as an ISO YYYY-MM-DD string."},
            "due_date": {"type": "string", "description": "Payment due date, as an ISO YYYY-MM-DD string, if shown."},
            "po_number": {"type": "string", "description": "Purchase order number, if referenced."},
            "currency": {"type": "string", "description": "The 3-letter currency code the total is actually stated in."},
            "payment_terms": {"type": "string", "description": "Payment terms text, e.g. '30 days', 'Immediate'."},
            "bank_account": {"type": "string", "description": "Supplier's bank account number for remittance, if shown."},
            "line_items": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "description": {"type": "string"},
                        "quantity": {"type": "number"},
                        "unit": {"type": "string"},
                        "unit_rate": {"type": "number"},
                        "amount": {"type": "number"},
                    },
                    "required": ["description", "amount"],
                },
            },
            "subtotal": {"type": "number", "description": "Total before tax/discount adjustments (net amount)."},
            "tax_amount": {"type": "number", "description": "Total tax/VAT amount. Use 0 if zero-rated/exempt."},
            "total_amount": {
                "type": "number",
                "description": "The final total/amount payable. Negative for a credit note.",
            },
            "extraction_notes": {
                "type": "string",
                "description": "Anything ambiguous, inconsistent, or hard to read that a human reviewer should double check.",
            },
        },
        "required": [
            "document_type",
            "supplier_name",
            "buyer_name",
            "invoice_number",
            "invoice_date",
            "currency",
            "line_items",
            "subtotal",
            "tax_amount",
            "total_amount",
        ],
    },
}

SYSTEM_PROMPT = (
    "You are an exact, careful invoice-data-entry clerk for Thambili Restaurants (Pvt) Ltd, "
    "a Sri Lankan restaurant group. You will be shown one supplier document (invoice, credit "
    "note, pro-forma, statement, or receipt) as a PDF, which may be a clean digital invoice, a "
    "scanned/photographed paper bill, or a dot-matrix till receipt. Read it carefully and call "
    "record_invoice_data with exactly what is printed - do not guess or invent values, and do not "
    "correct arithmetic in the source fields (report it as-is; note discrepancies in "
    "extraction_notes instead). If a field is not present on the document, omit it or use an "
    "empty string/zero as appropriate for its type."
)


class ExtractionError(Exception):
    pass


def _client() -> anthropic.Anthropic:
    if not ANTHROPIC_API_KEY:
        raise ExtractionError(
            "ANTHROPIC_API_KEY is not set. Add it to backend/.env (see .env.example) and restart the server."
        )
    return anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)


def extract_invoice(pdf_path: Path) -> dict:
    """Sends the PDF to Claude and returns the parsed structured-data dict."""
    pdf_bytes = pdf_path.read_bytes()
    encoded = base64.standard_b64encode(pdf_bytes).decode("ascii")

    client = _client()
    try:
        response = client.messages.create(
            model=ANTHROPIC_MODEL,
            max_tokens=4096,
            system=SYSTEM_PROMPT,
            tools=[EXTRACTION_TOOL],
            tool_choice={"type": "tool", "name": "record_invoice_data"},
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "document",
                            "source": {
                                "type": "base64",
                                "media_type": "application/pdf",
                                "data": encoded,
                            },
                        },
                        {
                            "type": "text",
                            "text": "Extract this document's data by calling record_invoice_data.",
                        },
                    ],
                }
            ],
        )
    except anthropic.APIError as exc:
        raise ExtractionError(f"Claude API error: {exc}") from exc

    for block in response.content:
        if block.type == "tool_use" and block.name == "record_invoice_data":
            return block.input

    raise ExtractionError("Claude did not return a structured tool call for this document.")


def extract_invoice_safe(pdf_path: Path) -> tuple[dict | None, str]:
    """Same as extract_invoice, but never raises - returns (data, error_message)."""
    try:
        return extract_invoice(pdf_path), ""
    except ExtractionError as exc:
        return None, str(exc)
    except Exception as exc:  # noqa: BLE001 - surface any SDK/network error to the reviewer
        return None, f"Unexpected extraction error: {exc}"


def dumps_for_audit(data: dict) -> str:
    return json.dumps(data, indent=2, default=str)
