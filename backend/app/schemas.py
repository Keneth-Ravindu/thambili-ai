import datetime as dt

from pydantic import BaseModel, ConfigDict


class LineItemOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    description: str
    quantity: float | None
    unit: str
    unit_rate: float | None
    amount: float | None


class LineItemIn(BaseModel):
    description: str = ""
    quantity: float | None = None
    unit: str = ""
    unit_rate: float | None = None
    amount: float | None = None


class FlagOut(BaseModel):
    code: str
    message: str
    severity: str


class InvoiceSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    source_filename: str
    status: str
    document_type: str
    supplier_id: str | None
    supplier_name_raw: str
    invoice_number: str
    invoice_date: dt.date | None
    currency: str
    gross_amount: float | None
    cost_centre: str
    record_id: str | None
    flags: list[FlagOut]


class InvoiceDetail(InvoiceSummary):
    stored_path: str
    uploaded_at: dt.datetime
    supplier_match_confidence: float
    buyer_name_raw: str
    buyer_vat_raw: str
    bill_to_location_raw: str
    due_date: dt.date | None
    po_number: str
    net_amount: float | None
    tax_amount: float | None
    bank_account: str
    payment_terms: str
    reviewer_notes: str
    rejection_reason: str
    entered_by: str
    date_entered: dt.date | None
    reviewed_at: dt.datetime | None
    extraction_error: str
    raw_extraction: dict
    line_items: list[LineItemOut]


class InvoiceUpdate(BaseModel):
    supplier_id: str | None = None
    supplier_name_raw: str | None = None
    buyer_name_raw: str | None = None
    buyer_vat_raw: str | None = None
    bill_to_location_raw: str | None = None
    document_type: str | None = None
    invoice_number: str | None = None
    invoice_date: dt.date | None = None
    due_date: dt.date | None = None
    po_number: str | None = None
    currency: str | None = None
    net_amount: float | None = None
    tax_amount: float | None = None
    gross_amount: float | None = None
    bank_account: str | None = None
    payment_terms: str | None = None
    cost_centre: str | None = None
    reviewer_notes: str | None = None
    line_items: list[LineItemIn] | None = None


class ApproveRequest(BaseModel):
    entered_by: str = "nimali.p"


class RejectRequest(BaseModel):
    reason: str


class SupplierOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    supplier_id: str
    registered_name: str
    trading_name: str
    category: str
    vat_number: str
    payment_terms: str
    currency: str


class StatsOut(BaseModel):
    total: int
    processing: int
    needs_attention: int
    ready_to_approve: int
    approved: int
    rejected: int
    approved_value_by_currency: dict[str, float]
