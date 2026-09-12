import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import AppShell from '../components/AppShell.jsx'
import ConfirmDialog from '../components/ConfirmDialog.jsx'
import Icon from '../components/Icon.jsx'
import {
  Banner,
  Empty,
  Field,
  IssueList,
  Loading,
  Readout,
  RiskMeter,
  Spinner,
  StatusBadge,
} from '../components/Primitives.jsx'
import { useToast } from '../components/Toasts.jsx'
import { approveInvoice, fetchInvoicePdfUrl, getInvoice, updateInvoice } from '../lib/api.js'
import { formatAmount, formatDateTime, pluralise } from '../lib/format.js'
import { reconcile, statusMeta } from '../lib/status.js'
import { useInvoices } from '../store/invoices.jsx'

const TEXT_FIELDS = [
  { key: 'supplier_name', label: 'Supplier name' },
  { key: 'supplier_vat_number', label: 'VAT number' },
  { key: 'invoice_number', label: 'Invoice number' },
  { key: 'purchase_order', label: 'Purchase order' },
  { key: 'invoice_date', label: 'Invoice date', placeholder: 'YYYY-MM-DD' },
  { key: 'due_date', label: 'Due date', placeholder: 'YYYY-MM-DD' },
  { key: 'currency', label: 'Currency' },
]

const AMOUNT_FIELDS = [
  { key: 'net_amount', label: 'Net amount' },
  { key: 'additional_charges', label: 'Additional charges' },
  { key: 'tax_amount', label: 'Tax amount' },
  { key: 'gross_amount', label: 'Gross amount' },
]

const BANK_FIELDS = [
  { key: 'bank_name', label: 'Bank name' },
  { key: 'bank_account', label: 'Bank account' },
]

const NUMERIC_KEYS = new Set(AMOUNT_FIELDS.map((field) => field.key))
const EDITABLE_KEYS = [...TEXT_FIELDS, ...AMOUNT_FIELDS, ...BANK_FIELDS].map((field) => field.key)

function toFormValue(value) {
  return value === null || value === undefined ? '' : String(value)
}

function buildForm(invoice) {
  return Object.fromEntries(EDITABLE_KEYS.map((key) => [key, toFormValue(invoice[key])]))
}

export default function InvoiceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const toast = useToast()
  const { refresh } = useInvoices()

  const [invoice, setInvoice] = useState(null)
  const [form, setForm] = useState({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [approving, setApproving] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pdfUrl, setPdfUrl] = useState(null)
  const [pdfError, setPdfError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getInvoice(id)
      setInvoice(data)
      setForm(buildForm(data))
      setLoadError(null)
    } catch (caught) {
      setLoadError(caught)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  // The blob URL is ours to clean up — revoke it whenever we move to another invoice.
  useEffect(() => {
    let url = null
    let cancelled = false
    setPdfUrl(null)
    setPdfError(null)

    fetchInvoicePdfUrl(id)
      .then((created) => {
        if (cancelled) {
          URL.revokeObjectURL(created)
          return
        }
        url = created
        setPdfUrl(created)
      })
      .catch((caught) => {
        if (!cancelled) setPdfError(caught)
      })

    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [id])

  const locked = invoice?.status === 'approved'

  const dirtyKeys = useMemo(() => {
    if (!invoice) return []
    return EDITABLE_KEYS.filter((key) => {
      const original = toFormValue(invoice[key])
      const current = form[key] ?? ''
      if (NUMERIC_KEYS.has(key)) {
        const a = original === '' ? null : Number(original)
        const b = current === '' ? null : Number(current)
        return a !== b
      }
      return original.trim() !== current.trim()
    })
  }, [invoice, form])

  const totals = reconcile({
    net_amount: form.net_amount,
    additional_charges: form.additional_charges,
    tax_amount: form.tax_amount,
    gross_amount: form.gross_amount,
  })

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const save = async () => {
    if (dirtyKeys.length === 0) return
    setSaving(true)
    try {
      const patch = {}
      for (const key of dirtyKeys) {
        const raw = form[key]
        if (NUMERIC_KEYS.has(key)) {
          patch[key] = raw === '' ? null : Number(raw)
        } else {
          const trimmed = String(raw).trim()
          patch[key] = trimmed === '' ? null : trimmed
        }
      }

      const response = await updateInvoice(id, patch)
      const merged = { ...invoice, ...response.invoice }
      setInvoice(merged)
      setForm(buildForm(merged))
      await refresh()

      const meta = statusMeta(merged.status)
      toast.success('Invoice revalidated', `Now ${meta.label.toLowerCase()} with a risk score of ${merged.risk_score}.`)
    } catch (caught) {
      toast.error('Could not save', caught.message)
    } finally {
      setSaving(false)
    }
  }

  const approve = async () => {
    setApproving(true)
    try {
      const response = await approveInvoice(id)
      const merged = {
        ...invoice,
        status: response.status,
        approved_by: response.approved_by ?? invoice.approved_by,
        approved_at: response.approved_at ?? invoice.approved_at,
      }
      setInvoice(merged)
      setForm(buildForm(merged))
      setConfirmOpen(false)
      await refresh()
      toast.success('Invoice approved', 'It is now locked from further edits.')
    } catch (caught) {
      toast.error('Could not approve', caught.message)
    } finally {
      setApproving(false)
    }
  }

  if (loading) {
    return (
      <AppShell title="Invoice" subtitle="Loading…">
        <Loading label="Loading invoice…" />
      </AppShell>
    )
  }

  if (loadError) {
    return (
      <AppShell title="Invoice" subtitle="Could not be loaded">
        <div className="card">
          <Empty
            icon="alert"
            title={loadError.status === 404 ? 'Invoice not found' : 'Could not load this invoice'}
            body={loadError.message}
            action={
              <Link className="btn" to="/invoices">
                Back to invoices
              </Link>
            }
          />
        </div>
      </AppShell>
    )
  }

  const issues = invoice.issues || []

  return (
    <AppShell
      title={invoice.invoice_number || 'Invoice without a number'}
      subtitle={`${invoice.supplier_name || 'Unidentified supplier'} · ${invoice.filename}`}
      actions={
        <button type="button" className="btn btn--ghost btn--sm" onClick={() => navigate('/invoices')}>
          <Icon name="back" size={15} />
          All invoices
        </button>
      }
    >
      <div className="stack-v">
        {locked ? (
          <Banner tone="approved" icon="lock" title="Approved and locked">
            Approved by {invoice.approved_by || 'the finance desk'} on {formatDateTime(invoice.approved_at)}. The
            backend rejects further edits to an approved invoice.
          </Banner>
        ) : null}

        <div className="detail">
          {/* ---- Left: the original document ---- */}
          <div className="pdf-pane">
            <div className="pdf-pane__bar">
              <Icon name="file" size={15} />
              <span className="pdf-pane__name" title={invoice.filename}>
                {invoice.filename}
              </span>
              {pdfUrl ? (
                <a
                  className="btn btn--ghost btn--sm"
                  style={{ marginLeft: 'auto' }}
                  href={pdfUrl}
                  download={invoice.filename}
                >
                  <Icon name="download" size={14} />
                  Download
                </a>
              ) : null}
            </div>
            {pdfError ? (
              <Empty icon="alert" title="Original PDF unavailable" body={pdfError.message} />
            ) : pdfUrl ? (
              <iframe className="pdf-pane__frame" src={pdfUrl} title={`Original PDF: ${invoice.filename}`} />
            ) : (
              <Loading label="Loading document…" />
            )}
          </div>

          {/* ---- Right: extraction, issues, corrections ---- */}
          <div className="stack-v">
            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Assessment</h2>
                <span className="card__hint">
                  <StatusBadge status={invoice.status} />
                </span>
              </div>
              <div className="stack-v stack-v--tight">
                <RiskMeter score={invoice.risk_score} />
                <div className="readout">
                  <Readout label="Supplier match">
                    {invoice.supplier_verified ? 'Verified' : 'Not verified'}
                    <span className="muted"> · score {Math.round(invoice.supplier_match_score || 0)}</span>
                  </Readout>
                  <Readout label="Supplier ID">
                    <span className="mono">{invoice.supplier_id || '—'}</span>
                  </Readout>
                  <Readout label="Duplicate checks">
                    {invoice.duplicate_existing || invoice.duplicate_batch
                      ? [
                          invoice.duplicate_existing ? 'in finance records' : null,
                          invoice.duplicate_batch ? 'in this upload' : null,
                        ]
                          .filter(Boolean)
                          .join(' & ')
                      : 'Clear'}
                  </Readout>
                  <Readout label="Totals">
                    {invoice.financial_valid === false ? 'Do not reconcile' : 'Reconcile'}
                  </Readout>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Issues</h2>
                <span className="card__hint">{pluralise(issues.length, 'issue')}</span>
              </div>
              <IssueList issues={issues} />
            </div>

            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Extracted details</h2>
                <span className="card__hint">
                  {locked ? 'Read only' : 'Correct anything Claude got wrong'}
                </span>
              </div>

              <div className="form-section">
                <div>
                  <p className="section-title" style={{ marginBottom: 8 }}>
                    Supplier &amp; references
                  </p>
                  <div className="field-grid">
                    {TEXT_FIELDS.map((field) => (
                      <Field key={field.key} label={field.label} dirty={dirtyKeys.includes(field.key)}>
                        <input
                          className="field__input"
                          value={form[field.key] ?? ''}
                          placeholder={field.placeholder || '—'}
                          disabled={locked}
                          onChange={(event) => setField(field.key, event.target.value)}
                        />
                      </Field>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="section-title" style={{ marginBottom: 8 }}>
                    Amounts
                  </p>
                  <div className="field-grid">
                    {AMOUNT_FIELDS.map((field) => (
                      <Field key={field.key} label={field.label} dirty={dirtyKeys.includes(field.key)}>
                        <input
                          className="field__input tnum"
                          type="number"
                          step="0.01"
                          inputMode="decimal"
                          value={form[field.key] ?? ''}
                          placeholder="—"
                          disabled={locked}
                          data-invalid={
                            totals.checked && !totals.valid && field.key === 'gross_amount' ? 'true' : undefined
                          }
                          onChange={(event) => setField(field.key, event.target.value)}
                        />
                      </Field>
                    ))}
                  </div>

                  <div className="totals" style={{ marginTop: 12 }}>
                    <p className="totals__row">
                      <span>Net + charges + tax</span>
                      <b className="tnum">
                        {totals.checked ? formatAmount(totals.expected, form.currency) : '—'}
                      </b>
                    </p>
                    <p className="totals__row">
                      <span>Gross on the invoice</span>
                      <b className="tnum">
                        {form.gross_amount === '' ? '—' : formatAmount(form.gross_amount, form.currency)}
                      </b>
                    </p>
                    <p className="totals__row totals__row--sum">
                      <span>
                        {!totals.checked
                          ? 'Not enough figures to reconcile'
                          : totals.valid
                            ? 'Reconciles — difference'
                            : 'Does not reconcile — difference'}
                      </span>
                      <b
                        className="tnum"
                        style={totals.checked && !totals.valid ? { color: 'var(--critical-ink)' } : undefined}
                      >
                        {totals.checked ? formatAmount(totals.difference, form.currency) : '—'}
                      </b>
                    </p>
                  </div>
                </div>

                <div>
                  <p className="section-title" style={{ marginBottom: 8 }}>
                    Payment details
                  </p>
                  <div className="field-grid">
                    {BANK_FIELDS.map((field) => (
                      <Field key={field.key} label={field.label} dirty={dirtyKeys.includes(field.key)}>
                        <input
                          className="field__input"
                          value={form[field.key] ?? ''}
                          placeholder="—"
                          disabled={locked}
                          onChange={(event) => setField(field.key, event.target.value)}
                        />
                      </Field>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {locked ? null : (
              <div className="actionbar">
                <span className="actionbar__note">
                  {dirtyKeys.length > 0
                    ? `${pluralise(dirtyKeys.length, 'field')} edited — saving re-runs every check`
                    : 'No unsaved changes'}
                </span>
                <span className="actionbar__spacer" />
                {dirtyKeys.length > 0 ? (
                  <button
                    type="button"
                    className="btn btn--sm"
                    onClick={() => setForm(buildForm(invoice))}
                    disabled={saving}
                  >
                    Discard
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={save}
                  disabled={saving || dirtyKeys.length === 0}
                >
                  {saving ? <Spinner size={14} /> : <Icon name="save" size={15} />}
                  {saving ? 'Revalidating…' : 'Save & revalidate'}
                </button>
                <button
                  type="button"
                  className="btn btn--approve"
                  onClick={() => setConfirmOpen(true)}
                  disabled={saving || dirtyKeys.length > 0}
                  title={dirtyKeys.length > 0 ? 'Save your edits before approving' : undefined}
                >
                  <Icon name="check" size={15} />
                  Approve
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        busy={approving}
        title="Approve this invoice?"
        confirmLabel="Approve"
        confirmVariant="btn--approve"
        body={
          <>
            <p>
              {invoice.invoice_number || 'This invoice'} from {invoice.supplier_name || 'an unidentified supplier'} for{' '}
              <b>{formatAmount(invoice.gross_amount, invoice.currency)}</b> will be marked approved and locked from
              further edits.
            </p>
            {issues.length > 0 ? (
              <p style={{ marginTop: 10, color: 'var(--critical-ink)' }}>
                It still has {pluralise(issues.length, 'open issue')}.
              </p>
            ) : null}
          </>
        }
        onCancel={() => setConfirmOpen(false)}
        onConfirm={approve}
      />
    </AppShell>
  )
}
