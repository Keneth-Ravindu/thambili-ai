import { useEffect, useState } from 'react'
import { api } from '../api'
import { StatusBadge } from '../components/StatusBadge'
import type { InvoiceStatus, InvoiceSummary } from '../types'

const TABS: { key: InvoiceStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_attention', label: 'Needs attention' },
  { key: 'ready_to_approve', label: 'Ready to approve' },
  { key: 'approved', label: 'Approved' },
  { key: 'rejected', label: 'Rejected' },
]

export function QueuePage({ onOpenInvoice }: { onOpenInvoice: (id: number) => void }) {
  const [tab, setTab] = useState<InvoiceStatus | 'all'>('needs_attention')
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([])
  const [loading, setLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const data = await api.listInvoices(tab === 'all' ? undefined : tab)
      setInvoices(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  return (
    <div className="page">
      <h1>Review queue</h1>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${tab === t.key ? 'tab-active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
        <button className="tab" onClick={load} title="Refresh">
          ↻
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading...</p>
      ) : invoices.length === 0 ? (
        <p className="muted">Nothing here.</p>
      ) : (
        <table className="queue-table">
          <thead>
            <tr>
              <th>Status</th>
              <th>Supplier</th>
              <th>Invoice #</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Cost centre</th>
              <th>Flags</th>
              <th>Record</th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <tr key={inv.id} onClick={() => onOpenInvoice(inv.id)}>
                <td>
                  <StatusBadge status={inv.status} />
                </td>
                <td>{inv.supplier_name_raw || <span className="muted">unmatched</span>}</td>
                <td>{inv.invoice_number || <span className="muted">-</span>}</td>
                <td>{inv.invoice_date ?? <span className="muted">-</span>}</td>
                <td>
                  {inv.gross_amount != null
                    ? `${inv.currency} ${inv.gross_amount.toLocaleString()}`
                    : <span className="muted">-</span>}
                </td>
                <td>{inv.cost_centre || <span className="muted">-</span>}</td>
                <td>
                  {inv.flags.length > 0 ? (
                    <span
                      className={`flag-count flag-count-${
                        inv.flags.some((f) => f.severity === 'high') ? 'high' : 'medium'
                      }`}
                    >
                      {inv.flags.length}
                    </span>
                  ) : (
                    <span className="flag-count flag-count-none">0</span>
                  )}
                </td>
                <td>{inv.record_id ?? <span className="muted">-</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
