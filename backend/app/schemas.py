from pydantic import BaseModel


class ExtractedInvoice(BaseModel):
    supplier_name: str | None = None
    supplier_vat_number: str | None = None

    invoice_number: str | None = None
    invoice_date: str | None = None
    due_date: str | None = None
    purchase_order: str | None = None

    currency: str | None = None

    net_amount: float | None = None
    additional_charges: float | None = 0
    tax_amount: float | None = None
    gross_amount: float | None = None

    bank_name: str | None = None
    bank_account: str | None = None


class InvoiceUpdate(BaseModel):
    supplier_name: str | None = None
    supplier_vat_number: str | None = None

    invoice_number: str | None = None
    invoice_date: str | None = None
    due_date: str | None = None
    purchase_order: str | None = None

    currency: str | None = None

    net_amount: float | None = None
    additional_charges: float | None = None
    tax_amount: float | None = None
    gross_amount: float | None = None

    bank_name: str | None = None
    bank_account: str | None = None