import datetime as dt

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Supplier(Base):
    __tablename__ = "suppliers"

    supplier_id: Mapped[str] = mapped_column(String, primary_key=True)
    registered_name: Mapped[str] = mapped_column(String)
    trading_name: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String)
    address: Mapped[str] = mapped_column(String, default="")
    city: Mapped[str] = mapped_column(String, default="")
    phone: Mapped[str] = mapped_column(String, default="")
    email: Mapped[str] = mapped_column(String, default="")
    vat_number: Mapped[str] = mapped_column(String, default="")
    payment_terms: Mapped[str] = mapped_column(String, default="")
    currency: Mapped[str] = mapped_column(String, default="LKR")


class ExistingRecord(Base):
    """Mirrors existing_records.csv - the CRM records already on file.

    Used only for duplicate-detection and outlier lookups, and as the source
    of the next sequential record_id. Never mutated by the app.
    """

    __tablename__ = "existing_records"

    record_id: Mapped[str] = mapped_column(String, primary_key=True)
    supplier_id: Mapped[str] = mapped_column(String, index=True)
    supplier_name: Mapped[str] = mapped_column(String)
    invoice_number: Mapped[str] = mapped_column(String, index=True)
    invoice_date: Mapped[dt.date] = mapped_column(Date)
    date_entered: Mapped[dt.date] = mapped_column(Date)
    currency: Mapped[str] = mapped_column(String, default="LKR")
    net_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    gross_amount: Mapped[float] = mapped_column(Numeric(14, 2))
    cost_centre: Mapped[str] = mapped_column(String, default="")
    entered_by: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="Posted")


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    source_filename: Mapped[str] = mapped_column(String)
    stored_path: Mapped[str] = mapped_column(String)
    uploaded_at: Mapped[dt.datetime] = mapped_column(DateTime, default=dt.datetime.utcnow)

    # processing -> needs_attention | ready_to_approve -> approved | rejected
    status: Mapped[str] = mapped_column(String, default="processing", index=True)
    document_type: Mapped[str] = mapped_column(String, default="unknown")

    supplier_id: Mapped[str | None] = mapped_column(
        ForeignKey("suppliers.supplier_id"), nullable=True
    )
    supplier_name_raw: Mapped[str] = mapped_column(String, default="")
    supplier_match_confidence: Mapped[float] = mapped_column(Numeric(5, 1), default=0)

    buyer_name_raw: Mapped[str] = mapped_column(String, default="")
    buyer_vat_raw: Mapped[str] = mapped_column(String, default="")
    bill_to_location_raw: Mapped[str] = mapped_column(String, default="")

    invoice_number: Mapped[str] = mapped_column(String, default="", index=True)
    invoice_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    po_number: Mapped[str] = mapped_column(String, default="")

    currency: Mapped[str] = mapped_column(String, default="LKR")
    net_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    tax_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    gross_amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)

    bank_account: Mapped[str] = mapped_column(String, default="")
    payment_terms: Mapped[str] = mapped_column(String, default="")
    cost_centre: Mapped[str] = mapped_column(String, default="")

    flags: Mapped[list] = mapped_column(JSON, default=list)
    raw_extraction: Mapped[dict] = mapped_column(JSON, default=dict)
    extraction_error: Mapped[str] = mapped_column(Text, default="")

    reviewer_notes: Mapped[str] = mapped_column(Text, default="")
    rejection_reason: Mapped[str] = mapped_column(Text, default="")

    record_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    entered_by: Mapped[str] = mapped_column(String, default="")
    date_entered: Mapped[dt.date | None] = mapped_column(Date, nullable=True)
    reviewed_at: Mapped[dt.datetime | None] = mapped_column(DateTime, nullable=True)

    line_items: Mapped[list["LineItem"]] = relationship(
        back_populates="invoice", cascade="all, delete-orphan", order_by="LineItem.position"
    )


class LineItem(Base):
    __tablename__ = "line_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"))
    position: Mapped[int] = mapped_column(default=0)
    description: Mapped[str] = mapped_column(String, default="")
    quantity: Mapped[float | None] = mapped_column(Numeric(14, 3), nullable=True)
    unit: Mapped[str] = mapped_column(String, default="")
    unit_rate: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)
    amount: Mapped[float | None] = mapped_column(Numeric(14, 2), nullable=True)

    invoice: Mapped["Invoice"] = relationship(back_populates="line_items")
