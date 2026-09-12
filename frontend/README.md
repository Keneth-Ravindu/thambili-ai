# Thambili — Invoice Intelligence (frontend)

React + Vite interface for the FastAPI invoice pipeline in [`../backend`](../backend).

## Running it

The backend must be up first — it whitelists `http://localhost:5173` for CORS, so
keep the dev server on that port.

```bash
# terminal 1 — backend
cd backend
uvicorn app.main:app --reload      # serves http://localhost:8000

# terminal 2 — frontend
cd frontend
npm install
npm run dev                        # serves http://localhost:5173
```

If your backend runs somewhere else, copy `.env.example` to `.env` and set
`VITE_API_BASE_URL`.

Other scripts: `npm run build` (production bundle into `dist/`), `npm run preview`.

## What each screen does

| Route | Purpose |
|---|---|
| `/` | KPI row, status split, exposure by supplier, control checks, highest-risk queue |
| `/upload` | Drag-and-drop batch upload with a per-file processing queue |
| `/invoices` | Filterable, sortable table of everything processed; CSV export |
| `/invoices/:id` | Original PDF beside the extracted fields, with correct-and-revalidate and approve |

## How it maps to the API

| Call | Endpoint |
|---|---|
| `listInvoices()` | `GET /api/invoices` |
| `getInvoice(id)` | `GET /api/invoices/{id}` |
| `updateInvoice(id, patch)` | `PUT /api/invoices/{id}` |
| `approveInvoice(id)` | `POST /api/invoices/{id}/approve` |
| `uploadInvoice(file)` | `POST /api/invoices/upload` |
| `fetchInvoicePdfUrl(id)` | `GET /api/invoices/{id}/pdf` |
| health indicator in the sidebar | `GET /health` |

Three behaviours worth knowing before you change them:

- **Uploads run one file at a time.** The backend compares each new invoice
  against everything already stored, so uploading in parallel would let two
  copies of the same invoice slip past the duplicate check.
- **The PDF is fetched as a blob.** The backend sends it with
  `Content-Disposition: attachment`, which makes browsers download rather than
  render it. Pulling it down and handing the `<iframe>` an object URL is what
  makes the inline viewer work.
- **Saving sends only the fields that changed.** The backend's `InvoiceUpdate`
  uses `exclude_unset`, so a partial patch leaves everything else alone — and the
  save re-runs supplier matching, both duplicate checks, reconciliation and risk
  scoring server-side.

## Layout

```
src/
  lib/         api client, formatters, status vocabulary, theme hook
  store/       invoice list context + the dashboard rollup
  components/  shell, icons, primitives, charts, toasts, dialog
  pages/       Dashboard, Upload, Invoices, InvoiceDetail
  styles.css   design tokens and every component style
```

No CSS framework and no chart library — `styles.css` holds the tokens for both
themes, and the two charts are plain DOM. The theme is stamped on
`<html data-theme>` by a small script in `index.html` before first paint, and the
toggle in the top bar persists a choice to `localStorage`; without one, the app
follows the OS.

## Conventions

- **Status is never colour alone.** Every status carries an icon and a label. The
  four fills come from a validated palette: `good` for ready, `warning` for needs
  review, `critical` for high risk, accent blue for approved.
- **Risk bands mirror the backend** (`risk_service.py`): under 20 low, 20–49
  medium, 50+ high. The meter clamps at 100 because a batch duplicate can push a
  score past it.
- **Reconciliation is checked client-side too**, in `lib/status.js`, so the edit
  form can warn while you type. It uses the same rule as
  `validation_service.py`: net + charges + tax versus gross, tolerance 1.
