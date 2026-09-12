import { useEffect, useState } from 'react'
import { api } from '../api'
import { COST_CENTRES, DOCUMENT_TYPES } from '../constants'
import { StatusBadge } from '../components/StatusBadge'
import { FlagList } from '../components/FlagList'
import type { InvoiceDetail, LineItem, Supplier } from '../types'

interface Props {
  invoiceId: number
  onBack: () => void
  onChanged: () => void
}

export function InvoiceDetailPage({ invoiceId, onBack, onChanged }: Props) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null)
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [lineItems, setLineItems] = useState<LineItem[]>([])
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)

  async function load() {
    const [inv, sup] = await Promise.all([api.getInvoice(invoiceId), api.listSuppliers()])
    setInvoice(inv)
    setLineItems(inv.line_items)
    setSuppliers(sup)
  }

  useEffect(() => {
    load()
    setMessage('')
    setShowReject(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId])

  if (!invoice) return <div className="page">Loading...</div>

  const editable = invoice.status !== 'approved' && invoice.status !== 'rejected'

  function set<K extends keyof InvoiceDetail>(key: K, value: InvoiceDetail[K]) {
    setInvoice((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function setLineItem(index: number, field: keyof LineItem, value: string) {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item
        if (field === 'description' || field === 'unit') return { ...item, [field]: value }
        return { ...item, [field]: value === '' ? null : Number(value) }
      })
    )
  }

  function addLineItem() {
    setLineItems((prev) => [
      ...prev,
      { id: -(prev.length + 1), description: '', quantity: null, unit: '', unit_rate: null, amount: null },
    ])
  }

  function removeLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index))
  }

  async function save() {
    if (!invoice) return
    setSaving(true)
    setMessage('')
    try {
      const updated = await api.updateInvoice(invoice.id, {
        supplier_id: invoice.supplier_id,
        buyer_name_raw: invoice.buyer_name_raw,
        buyer_vat_raw: invoice.buyer_vat_raw,
        bill_to_location_raw: invoice.bill_to_location_raw,
        document_type: invoice.document_type,
        invoice_number: invoice.invoice_number,
        invoice_date: invoice.invoice_date,
        due_date: invoice.due_date,
        po_number: invoice.po_number,
        currency: invoice.currency,
        net_amount: invoice.net_amount,
        tax_amount: invoice.tax_amount,
        gross_amount: invoice.gross_amount,
        bank_account: invoice.bank_account,
        payment_terms: invoice.payment_terms,
        cost_centre: invoice.cost_centre,
        reviewer_notes: invoice.reviewer_notes,
        line_items: lineItems.map(({ description, quantity, unit, unit_rate, amount }) => ({
          description,
          quantity,
          unit,
          unit_rate,
          amount,
        })),
      })
      setInvoice(updated)
      setLineItems(updated.line_items)
      setMessage('Saved.')
      onChanged()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function approve() {
    setSaving(true)
    setMessage('')
    try {
      await save()
      const updated = await api.approveInvoice(invoiceId, 'nimali.p')
      setInvoice(updated)
      setMessage(`Approved as ${updated.record_id}.`)
      onChanged()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Approve failed')
    } finally {
      setSaving(false)
    }
  }

  async function reject() {
    setSaving(true)
    setMessage('')
    try {
      const updated = await api.rejectInvoice(invoiceId, rejectReason || 'Rejected by reviewer')
      setInvoice(updated)
      setMessage('Rejected.')
      setShowReject(false)
      onChanged()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Reject failed')
    } finally {
      setSaving(false)
    }
  }

  async function reprocess() {
    setSaving(true)
    setMessage('')
    try {
      const updated = await api.reprocessInvoice(invoiceId)
      setInvoice(updated)
      setLineItems(updated.line_items)
      setMessage('Re-extracted.')
      onChanged()
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Reprocess failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="detail-page">
      <div className="detail-toolbar">
        <button onClick={onBack}>&larr; Back to queue</button>
        <StatusBadge status={invoice.status} />
        {invoice.record_id && <span className="muted">{invoice.record_id}</span>}
      </div>

      <div className="detail-split">
        <div className="detail-pdf">
          <iframe title="invoice pdf" src={api.fileUrl(invoice.id)} />
        </div>

        <div className="detail-form">
          <h2>{invoice.source_filename}</h2>

          <section>
            <h3>Flags</h3>
            <FlagList flags={invoice.flags} />
            {invoice.extraction_error && (
              <p className="error">Extraction error: {invoice.extraction_error}</p>
            )}
          </section>

          <section className="form-grid">
            <label>
              Document type
              <select
                disabled={!editable}
                value={invoice.document_type}
                onChange={(e) => set('document_type', e.target.value)}
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Supplier
              <select
                disabled={!editable}
                value={invoice.supplier_id ?? ''}
                onChange={(e) => set('supplier_id', e.target.value || null)}
              >
                <option value="">(unmatched - {invoice.supplier_name_raw || 'unknown'})</option>
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.registered_name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Invoice number
              <input
                disabled={!editable}
                value={invoice.invoice_number}
                onChange={(e) => set('invoice_number', e.target.value)}
              />
            </label>

            <label>
              Invoice date
              <input
                type="date"
                disabled={!editable}
                value={invoice.invoice_date ?? ''}
                onChange={(e) => set('invoice_date', e.target.value || null)}
              />
            </label>

            <label>
              Due date
              <input
                type="date"
                disabled={!editable}
                value={invoice.due_date ?? ''}
                onChange={(e) => set('due_date', e.target.value || null)}
              />
            </label>

            <label>
              PO number
              <input
                disabled={!editable}
                value={invoice.po_number}
                onChange={(e) => set('po_number', e.target.value)}
              />
            </label>

            <label>
              Currency
              <input
                disabled={!editable}
                value={invoice.currency}
                onChange={(e) => set('currency', e.target.value)}
              />
            </label>

            <label>
              Cost centre
              <select
                disabled={!editable}
                value={invoice.cost_centre}
                onChange={(e) => set('cost_centre', e.target.value)}
              >
                {COST_CENTRES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label} {c.code && `(${c.code})`}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Net amount
              <input
                type="number"
                disabled={!editable}
                value={invoice.net_amount ?? ''}
                onChange={(e) => set('net_amount', e.target.value === '' ? null : Number(e.target.value))}
              />
            </label>

            <label>
              Tax amount
              <input
                type="number"
                disabled={!editable}
                value={invoice.tax_amount ?? ''}
                onChange={(e) => set('tax_amount', e.target.value === '' ? null : Number(e.target.value))}
              />
            </label>

            <label>
              Total (gross)
              <input
                type="number"
                disabled={!editable}
                value={invoice.gross_amount ?? ''}
                onChange={(e) => set('gross_amount', e.target.value === '' ? null : Number(e.target.value))}
              />
            </label>

            <label>
              Bank account
              <input
                disabled={!editable}
                value={invoice.bank_account}
                onChange={(e) => set('bank_account', e.target.value)}
              />
            </label>

            <label>
              Buyer name (bill-to)
              <input
                disabled={!editable}
                value={invoice.buyer_name_raw}
                onChange={(e) => set('buyer_name_raw', e.target.value)}
              />
            </label>

            <label>
              Buyer VAT
              <input
                disabled={!editable}
                value={invoice.buyer_vat_raw}
                onChange={(e) => set('buyer_vat_raw', e.target.value)}
              />
            </label>

            <label className="span-2">
              Bill-to / deliver-to location
              <input
                disabled={!editable}
                value={invoice.bill_to_location_raw}
                onChange={(e) => set('bill_to_location_raw', e.target.value)}
              />
            </label>
          </section>

          <section>
            <h3>Line items</h3>
            <table className="line-items-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Rate</th>
                  <th>Amount</th>
                  {editable && <th />}
                </tr>
              </thead>
              <tbody>
                {lineItems.map((item, i) => (
                  <tr key={item.id}>
                    <td>
                      <input
                        disabled={!editable}
                        value={item.description}
                        onChange={(e) => setLineItem(i, 'description', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        disabled={!editable}
                        value={item.quantity ?? ''}
                        onChange={(e) => setLineItem(i, 'quantity', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        disabled={!editable}
                        value={item.unit}
                        onChange={(e) => setLineItem(i, 'unit', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        disabled={!editable}
                        value={item.unit_rate ?? ''}
                        onChange={(e) => setLineItem(i, 'unit_rate', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        disabled={!editable}
                        value={item.amount ?? ''}
                        onChange={(e) => setLineItem(i, 'amount', e.target.value)}
                      />
                    </td>
                    {editable && (
                      <td>
                        <button onClick={() => removeLineItem(i)}>&times;</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {editable && <button onClick={addLineItem}>+ Add line</button>}
          </section>

          <section>
            <label>
              Reviewer notes
              <textarea
                disabled={!editable}
                value={invoice.reviewer_notes}
                onChange={(e) => set('reviewer_notes', e.target.value)}
              />
            </label>
          </section>

          {invoice.rejection_reason && (
            <p className="error">Rejected: {invoice.rejection_reason}</p>
          )}

          {message && <p className="message">{message}</p>}

          {editable ? (
            <div className="actions">
              <button disabled={saving} onClick={save}>
                Save
              </button>
              <button disabled={saving} onClick={reprocess}>
                Re-extract
              </button>
              <button disabled={saving} className="primary" onClick={approve}>
                Approve
              </button>
              <button disabled={saving} className="danger" onClick={() => setShowReject(true)}>
                Reject
              </button>
            </div>
          ) : (
            <p className="muted">This record is {invoice.status} and can no longer be edited.</p>
          )}

          {showReject && (
            <div className="reject-box">
              <textarea
                placeholder="Reason for rejecting"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="actions">
                <button disabled={saving} className="danger" onClick={reject}>
                  Confirm reject
                </button>
                <button disabled={saving} onClick={() => setShowReject(false)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
