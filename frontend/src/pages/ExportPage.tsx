import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Stats } from '../types'

export function ExportPage() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    api.getStats().then(setStats)
  }, [])

  return (
    <div className="page">
      <h1>Export</h1>
      <p className="muted">
        Only approved invoices are included. The export uses the same columns as
        existing_records.csv, so it can be appended straight into the CRM.
      </p>

      {stats && (
        <div className="stats-grid">
          <div className="stat">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total uploaded</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.needs_attention}</span>
            <span className="stat-label">Needs attention</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.ready_to_approve}</span>
            <span className="stat-label">Ready to approve</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.approved}</span>
            <span className="stat-label">Approved</span>
          </div>
          <div className="stat">
            <span className="stat-value">{stats.rejected}</span>
            <span className="stat-label">Rejected</span>
          </div>
        </div>
      )}

      {stats && Object.keys(stats.approved_value_by_currency).length > 0 && (
        <div className="approved-value">
          <h3>Approved value</h3>
          <ul>
            {Object.entries(stats.approved_value_by_currency).map(([currency, value]) => (
              <li key={currency}>
                {currency} {value.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <a className="button primary" href={api.exportUrl()}>
        Download approved_invoices_export.csv
      </a>
    </div>
  )
}
