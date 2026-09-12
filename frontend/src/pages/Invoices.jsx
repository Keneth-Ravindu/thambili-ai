import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

import AppShell from '../components/AppShell.jsx'
import Icon from '../components/Icon.jsx'
import { Banner, Empty, Loading, RiskMeter, StatusBadge } from '../components/Primitives.jsx'
import { formatAmount, formatDate, pluralise } from '../lib/format.js'
import { STATUS, STATUS_ORDER } from '../lib/status.js'
import { useInvoices } from '../store/invoices.jsx'

const STATUS_DOT = {
  ready: 'var(--good)',
  needs_review: 'var(--warning)',
  high_risk: 'var(--critical)',
  rejected: 'var(--critical)',
  approved: 'var(--accent)',
}

const COLUMNS = [
  { key: 'status', label: 'Status', sortable: true },
  { key: 'invoice_number', label: 'Invoice', sortable: true },
  { key: 'supplier_name', label: 'Supplier', sortable: true },
  { key: 'invoice_date', label: 'Date', sortable: true },
  { key: 'gross_amount', label: 'Gross', sortable: true, numeric: true },
  { key: 'risk_score', label: 'Risk', sortable: true, numeric: true },
  { key: 'flags', label: 'Flags', sortable: false },
]

const STATUS_RANK = { high_risk: 0, needs_review: 1, ready: 2, rejected: 3, approved: 4, processing: 5 }

export default function Invoices() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const { invoices, loading, error, refresh } = useInvoices()

  const [query, setQuery] = useState('')
  const [onlyDuplicates, setOnlyDuplicates] = useState(false)
  const [onlyUnverified, setOnlyUnverified] = useState(false)
  const [onlyUnreconciled, setOnlyUnreconciled] = useState(false)
  const [sort, setSort] = useState({ key: 'risk_score', direction: 'desc' })

  const statusFilter = params.get('status')

  const setStatusFilter = (value) => {
    const next = new URLSearchParams(params)
    if (value) next.set('status', value)
    else next.delete('status')
    setParams(next, { replace: true })
  }

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const filtered = invoices.filter((invoice) => {
      if (statusFilter && invoice.status !== statusFilter) return false
      if (onlyDuplicates && !(invoice.duplicate_existing || invoice.duplicate_batch)) return false
      if (onlyUnverified && invoice.supplier_verified) return false
      if (onlyUnreconciled && invoice.financial_valid !== false) return false
      if (!needle) return true
      return [invoice.invoice_number, invoice.supplier_name, invoice.supplier_id, invoice.filename]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(needle))
    })

    const { key, direction } = sort
    const factor = direction === 'asc' ? 1 : -1

    return [...filtered].sort((a, b) => {
      if (key === 'status') {
        return ((STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9)) * factor
      }
      const left = a[key]
      const right = b[key]
      if (typeof left === 'number' || typeof right === 'number') {
        return ((Number(left) || 0) - (Number(right) || 0)) * factor
      }
      return String(left ?? '').localeCompare(String(right ?? '')) * factor
    })
  }, [invoices, query, statusFilter, onlyDuplicates, onlyUnverified, onlyUnreconciled, sort])

  const toggleSort = (key) => {
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: key === 'risk_score' || key === 'gross_amount' ? 'desc' : 'asc' },
    )
  }

  const filtersActive =
    Boolean(statusFilter) || Boolean(query) || onlyDuplicates || onlyUnverified || onlyUnreconciled

  const clearFilters = () => {
    setQuery('')
    setOnlyDuplicates(false)
    setOnlyUnverified(false)
    setOnlyUnreconciled(false)
    setStatusFilter(null)
  }

  return (
    <AppShell
      title="Invoices"
      subtitle={`${pluralise(rows.length, 'invoice')} shown of ${invoices.length} processed`}
      actions={
        <button
          type="button"
          className="btn btn--sm"
          onClick={() => exportCsv(rows)}
          disabled={rows.length === 0}
        >
          <Icon name="download" size={15} />
          Export CSV
        </button>
      }
    >
      {error && error.status === 0 ? (
        <div style={{ marginBottom: 16 }}>
          <Banner
            tone="critical"
            icon="alert"
            title="Backend not reachable"
            action={
              <button type="button" className="btn btn--sm" onClick={refresh}>
                Retry
              </button>
            }
          >
            {error.message}
          </Banner>
        </div>
      ) : null}

      <div className="filters">
        <div className="search">
          <Icon className="search__icon" name="search" size={15} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search invoice number, supplier or file…"
            aria-label="Search invoices"
          />
        </div>

        <div className="segmented" role="group" aria-label="Filter by status">
          <button
            type="button"
            className="segmented__btn"
            aria-pressed={!statusFilter}
            onClick={() => setStatusFilter(null)}
          >
            All
          </button>
          {STATUS_ORDER.map((key) => (
            <button
              type="button"
              key={key}
              className="segmented__btn"
              aria-pressed={statusFilter === key}
              onClick={() => setStatusFilter(statusFilter === key ? null : key)}
            >
              <span className="dot" style={{ background: STATUS_DOT[key] }} />
              {STATUS[key].label}
            </button>
          ))}
        </div>

        <label className="toggle">
          <input
            type="checkbox"
            checked={onlyDuplicates}
            onChange={(event) => setOnlyDuplicates(event.target.checked)}
          />
          Duplicates
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={onlyUnverified}
            onChange={(event) => setOnlyUnverified(event.target.checked)}
          />
          Unverified supplier
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={onlyUnreconciled}
            onChange={(event) => setOnlyUnreconciled(event.target.checked)}
          />
          Totals mismatch
        </label>

        {filtersActive ? (
          <button type="button" className="btn btn--ghost btn--sm" onClick={clearFilters}>
            <Icon name="close" size={14} />
            Clear
          </button>
        ) : null}
      </div>

      <div className="card card--flush">
        {loading ? (
          <Loading label="Loading invoices…" />
        ) : rows.length === 0 ? (
          <Empty
            icon={invoices.length === 0 ? 'inbox' : 'search'}
            title={invoices.length === 0 ? 'No invoices yet' : 'Nothing matches these filters'}
            body={
              invoices.length === 0
                ? 'Upload a batch of supplier PDFs to get started.'
                : 'Try widening the search or clearing the filters.'
            }
            action={
              filtersActive ? (
                <button type="button" className="btn" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : null
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  {COLUMNS.map((column) => (
                    <th key={column.key} className={column.numeric ? 'cell-num' : undefined}>
                      {column.sortable ? (
                        <button
                          type="button"
                          className="sort-btn"
                          onClick={() => toggleSort(column.key)}
                          aria-label={`Sort by ${column.label}`}
                        >
                          {column.label}
                          <Icon
                            className="sort-btn__caret"
                            name={
                              sort.key === column.key
                                ? sort.direction === 'asc'
                                  ? 'caretUp'
                                  : 'caretDown'
                                : 'sort'
                            }
                            size={12}
                            strokeWidth={2}
                            style={{ opacity: sort.key === column.key ? 1 : 0.35 }}
                          />
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((invoice) => (
                  <tr
                    key={invoice.id}
                    onClick={() => navigate(`/invoices/${invoice.id}`)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') navigate(`/invoices/${invoice.id}`)
                    }}
                  >
                    <td>
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td>
                      <span className="cell-strong">{invoice.invoice_number || '—'}</span>
                      <br />
                      <span className="cell-sub" title={invoice.filename}>
                        {invoice.filename}
                      </span>
                    </td>
                    <td>
                      <span>{invoice.supplier_name || 'Unidentified'}</span>
                      <br />
                      <span className="cell-sub">
                        {invoice.supplier_id || 'no master match'}
                        {invoice.supplier_verified ? ' · verified' : ' · unverified'}
                      </span>
                    </td>
                    <td className="tnum">{formatDate(invoice.invoice_date)}</td>
                    <td className="cell-num cell-strong">
                      {formatAmount(invoice.gross_amount, invoice.currency)}
                    </td>
                    <td className="cell-num">
                      <RiskMeter score={invoice.risk_score} inline />
                    </td>
                    <td>
                      <Flags invoice={invoice} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  )
}

function Flags({ invoice }) {
  const flags = []
  if (invoice.duplicate_existing) flags.push({ icon: 'copy', tone: 'critical', label: 'Already in finance records' })
  if (invoice.duplicate_batch) flags.push({ icon: 'copy', tone: 'critical', label: 'Duplicated in this upload' })
  if (!invoice.supplier_verified) flags.push({ icon: 'shield', tone: 'warning', label: 'Supplier unverified' })
  if (invoice.financial_valid === false) flags.push({ icon: 'scales', tone: 'warning', label: 'Totals do not reconcile' })

  if (flags.length === 0) return <span className="cell-sub">—</span>

  return (
    <span className="flag-dots">
      {flags.map((flag) => (
        <span className="flag-dot" data-tone={flag.tone} key={flag.label} title={flag.label}>
          <Icon name={flag.icon} size={13} strokeWidth={2} />
          <span className="visually-hidden">{flag.label}</span>
        </span>
      ))}
    </span>
  )
}

const CSV_COLUMNS = [
  ['id', 'ID'],
  ['filename', 'File'],
  ['supplier_id', 'Supplier ID'],
  ['supplier_name', 'Supplier'],
  ['supplier_verified', 'Supplier verified'],
  ['invoice_number', 'Invoice number'],
  ['invoice_date', 'Invoice date'],
  ['currency', 'Currency'],
  ['gross_amount', 'Gross amount'],
  ['duplicate_existing', 'Duplicate of record'],
  ['duplicate_batch', 'Duplicate in batch'],
  ['financial_valid', 'Totals reconcile'],
  ['risk_score', 'Risk score'],
  ['status', 'Status'],
]

function escapeCsv(value) {
  if (value === null || value === undefined) return ''
  const text = Array.isArray(value) ? value.join('; ') : String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function exportCsv(rows) {
  const header = [...CSV_COLUMNS.map(([, label]) => label), 'Issues'].join(',')
  const body = rows.map((invoice) =>
    [...CSV_COLUMNS.map(([key]) => escapeCsv(invoice[key])), escapeCsv(invoice.issues)].join(','),
  )
  const blob = new Blob([[header, ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `thambili-invoices-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
