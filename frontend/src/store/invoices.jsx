import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { checkHealth, listInvoices } from '../lib/api.js'

const InvoicesContext = createContext(null)

export function InvoicesProvider({ children }) {
  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [health, setHealth] = useState('unknown')

  const refresh = useCallback(async () => {
    try {
      const rows = await listInvoices()
      setInvoices(Array.isArray(rows) ? rows : [])
      setError(null)
      setHealth('online')
    } catch (caught) {
      setError(caught)
      setHealth(caught.status === 0 ? 'offline' : 'online')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    checkHealth()
      .then(() => !cancelled && setHealth('online'))
      .catch(() => !cancelled && setHealth('offline'))
    refresh()
    return () => {
      cancelled = true
    }
  }, [refresh])

  const value = useMemo(
    () => ({ invoices, loading, error, health, refresh }),
    [invoices, loading, error, health, refresh],
  )

  return <InvoicesContext.Provider value={value}>{children}</InvoicesContext.Provider>
}

export function useInvoices() {
  const context = useContext(InvoicesContext)
  if (!context) throw new Error('useInvoices must be used inside an InvoicesProvider')
  return context
}

/** Rolls the invoice list up into the numbers the dashboard leads with. */
export function summarise(invoices) {
  const counts = { ready: 0, needs_review: 0, high_risk: 0, approved: 0, processing: 0 }
  const suppliers = new Map()

  let totalValue = 0
  let atRiskValue = 0
  let approvedValue = 0
  let duplicates = 0
  let unverified = 0
  let unreconciled = 0
  let openIssues = 0
  let currency = null

  for (const invoice of invoices) {
    counts[invoice.status] = (counts[invoice.status] || 0) + 1

    const amount = Number(invoice.gross_amount) || 0
    totalValue += amount
    if (invoice.status === 'high_risk') atRiskValue += amount
    if (invoice.status === 'approved') approvedValue += amount

    if (invoice.duplicate_existing || invoice.duplicate_batch) duplicates += 1
    if (!invoice.supplier_verified) unverified += 1
    if (invoice.financial_valid === false) unreconciled += 1
    openIssues += invoice.status === 'approved' ? 0 : (invoice.issues || []).length
    if (!currency && invoice.currency) currency = invoice.currency

    const name = invoice.supplier_name || 'Unidentified supplier'
    const entry = suppliers.get(name) || { name, total: 0, count: 0 }
    entry.total += amount
    entry.count += 1
    suppliers.set(name, entry)
  }

  const topSuppliers = [...suppliers.values()].sort((a, b) => b.total - a.total).slice(0, 6)

  return {
    total: invoices.length,
    counts,
    totalValue,
    atRiskValue,
    approvedValue,
    duplicates,
    unverified,
    unreconciled,
    openIssues,
    currency: currency || 'LKR',
    topSuppliers,
    needsAttention: counts.high_risk + counts.needs_review,
  }
}
