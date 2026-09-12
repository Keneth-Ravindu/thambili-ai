import base64
import json
import re

import anthropic

from app.config import (
    ANTHROPIC_API_KEY,
    CLAUDE_MODEL,
)

from app.schemas import ExtractedInvoice


client = anthropic.Anthropic(
    api_key=ANTHROPIC_API_KEY
)


def clean_json_response(text: str) -> dict:
    """
    Convert Claude's response into a Python dictionary.
    Handles accidental ```json markdown blocks too.
    """

    text = text.strip()

    text = text.replace("```json", "")
    text = text.replace("```", "")
    text = text.strip()

    try:
        return json.loads(text)

    except json.JSONDecodeError:
        # Fallback: find first JSON object
        match = re.search(
            r"\{.*\}",
            text,
            re.DOTALL
        )

        if not match:
            raise ValueError(
                f"Claude did not return valid JSON:\n{text}"
            )

        return json.loads(
            match.group()
        )


def extract_invoice(pdf_path: str) -> ExtractedInvoice:

    # -----------------------------
    # Read PDF
    # -----------------------------

    with open(pdf_path, "rb") as pdf_file:

        pdf_base64 = (
            base64
            .standard_b64encode(
                pdf_file.read()
            )
            .decode("utf-8")
        )

    # -----------------------------
    # Extraction prompt
    # -----------------------------

    prompt = """
You are a financial invoice extraction system.

Analyze the supplier invoice attached above.

Return ONLY one valid JSON object.

Do not use markdown.
Do not include explanations.
Do not include ```json.
Do not invent information.

Extract exactly these fields:

{
    "supplier_name": null,
    "supplier_vat_number": null,
    "invoice_number": null,
    "invoice_date": null,
    "due_date": null,
    "purchase_order": null,
    "currency": null,
    "net_amount": null,
    "additional_charges": 0,
    "tax_amount": null,
    "gross_amount": null,
    "bank_name": null,
    "bank_account": null
}

Rules:

1. supplier_name:
   The company that issued the invoice.
   Do NOT return Thambili as the supplier.

2. supplier_vat_number:
   Return the supplier VAT number, not the buyer VAT number.

3. invoice_number:
   Return the supplier invoice number exactly as printed.

4. invoice_date and due_date:
   Convert dates to YYYY-MM-DD.

5. currency:
   Return values such as LKR, USD, EUR.

6. Monetary amounts:
   Return numbers only.
   Do not include Rs, LKR, commas, or currency symbols.

7. net_amount:
   The total before tax and before separately listed extra charges.

8. additional_charges:
   Include explicitly separated delivery, handling, freight,
   service charges, or similar additional charges.
   Return 0 if none exist.

9. tax_amount:
   Extract VAT/tax amount.

10. gross_amount:
    Final amount payable.

11. bank_name and bank_account:
    Extract them only when visible.

12. When a value cannot be found confidently:
    return null.

Return ONLY valid JSON.
"""

    # -----------------------------
    # Send PDF directly to Claude
    # -----------------------------

    response = client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=1200,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "document",
                        "source": {
                            "type": "base64",
                            "media_type": "application/pdf",
                            "data": pdf_base64,
                        },
                    },
                    {
                        "type": "text",
                        "text": prompt,
                    },
                ],
            }
        ],
    )

    # -----------------------------
    # Get Claude text response
    # -----------------------------

    response_text = None

    for block in response.content:
        if getattr(block, "type", None) == "text":
            response_text = block.text
            break

    if not response_text:
        raise ValueError(
            "Claude returned no text response"
        )

    # -----------------------------
    # Parse JSON
    # -----------------------------

    data = clean_json_response(
        response_text
    )

    # -----------------------------
    # Validate through Pydantic
    # -----------------------------

    return ExtractedInvoice(
        **data
    )