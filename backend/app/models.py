from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
)

from app.database import Base


class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    original_filename = Column(
        String,
        nullable=False
    )

    stored_filename = Column(
        String,
        nullable=False
    )

    supplier_id = Column(
        String,
        nullable=True
    )

    supplier_name = Column(
        String,
        nullable=True
    )

    supplier_vat_number = Column(
        String,
        nullable=True
    )

    supplier_verified = Column(
        Boolean,
        default=False
    )

    supplier_match_score = Column(
        Float,
        default=0
    )

    invoice_number = Column(
        String,
        nullable=True
    )

    invoice_date = Column(
        String,
        nullable=True
    )

    due_date = Column(
        String,
        nullable=True
    )

    purchase_order = Column(
        String,
        nullable=True
    )

    currency = Column(
        String,
        nullable=True
    )

    net_amount = Column(
        Float,
        nullable=True
    )

    additional_charges = Column(
        Float,
        default=0
    )

    tax_amount = Column(
        Float,
        nullable=True
    )

    gross_amount = Column(
        Float,
        nullable=True
    )

    bank_name = Column(
        String,
        nullable=True
    )

    bank_account = Column(
        String,
        nullable=True
    )

    duplicate_existing = Column(
        Boolean,
        default=False
    )

    duplicate_batch = Column(
        Boolean,
        default=False
    )

    financial_valid = Column(
        Boolean,
        default=True
    )

    risk_score = Column(
        Integer,
        default=0
    )

    issues = Column(
        Text,
        default="[]"
    )

    status = Column(
        String,
        default="processing"
    )

    approved_by = Column(
        String,
        nullable=True
    )

    approved_at = Column(
        DateTime,
        nullable=True
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )