# Thambili Invoice Intelligence
### AI-Assisted Supplier Invoice Processing for Finance Operations

An AI-powered finance operations workspace that helps **Nimali**, Thambili's finance officer, process supplier invoices faster while preventing duplicate payments and maintaining human approval over financial records.

> **AI accelerates extraction. Deterministic code protects financial correctness. Humans make the final decision.**

---

## Problem

Thambili operates:

- 6 restaurants
- 1 central kitchen
- ~140 employees
- ~90 suppliers
- ~400 supplier invoices every month

Today the workflow is entirely manual:

```
Supplier PDF
      ↓
Finance Officer reads invoice
      ↓
Manual CRM entry
      ↓
Store original PDF
```

This creates several problems:

- Time-consuming manual data entry
- Duplicate payment risk
- Extraction mistakes
- Supplier name inconsistencies
- Non-invoice documents entering the workflow
- Limited visibility into which invoices are safe to approve

---

## Our Solution

Thambili Invoice Intelligence is a **human-in-the-loop finance CRM** that combines Claude AI with deterministic financial validation.

Instead of asking AI to approve invoices, the system separates responsibilities:

| AI | Deterministic Logic |
|----|---------------------|
| Document classification | Financial calculations |
| Invoice extraction | Duplicate detection |
| Supplier interpretation | Supplier lookup |
| Review summaries | Risk scoring |
| Field confidence | Approval guardrails |

Only **Nimali** can approve invoices.

---

## Key Features

- AI-powered invoice extraction using Claude
- Automatic document classification
- Supplier master matching
- Historical finance reconciliation
- Duplicate detection
- Financial validation
- Explainable risk scoring
- Human review workspace
- Original PDF viewer
- Audit trail
- CSV export

---

## Architecture

```mermaid
flowchart TD
    A[Supplier PDF] --> B[FastAPI Backend]
    B --> C[PDF Extraction]
    C --> D[Claude AI]
    D --> E[Structured Invoice]

    E --> F[Supplier Matching]
    E --> G[Financial Validation]
    E --> H[Duplicate Detection]

    F --> I[Risk Engine]
    G --> I
    H --> I

    I --> J[Human Review]
    J --> K[Approval]
    K --> L[CSV Export]