import { Link, useNavigate } from 'react-router-dom'

import AppShell from '../components/AppShell.jsx'
import Icon from '../components/Icon.jsx'
import { StatusStack, SupplierBars } from '../components/Charts.jsx'
import { Banner, Empty, Loading, RiskMeter, StatTile, StatusBadge } from '../components/Primitives.jsx'
import { formatAmount, formatCompactAmount, formatDate, pluralise } from '../lib/format.js'
import { summarise, useInvoices } from '../store/invoices.jsx'

export default function Dashboard() {
  const navigate = useNavigate()
  const { invoices, loading, error, refresh } = useInvoices()
  const stats = summarise(invoices)

  const attention = invoices
    .filter((invoice) => invoice.status === 'high_risk' || invoice.status === 'needs_review')
    .sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0))
    .slice(0, 6)

  return (
    <AppShell
      title="Dashboard"
      subtitle="Everything the finance desk needs to decide what to pay."
      actions={
        <Link className="btn btn--primary btn--sm" to="/upload">
          <Icon name="upload" size={15} />
          Upload invoices
        </Link>
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

      {loading ? (
        <Loading label="Loading invoices…" />
      ) : stats.total === 0 ? (
        <div className="card">
          <Empty
            icon="inbox"
            title="No invoices processed yet"
            body="Drop a batch of supplier PDFs into the uploader and the pipeline will extract, verify and score each one."
            action={
              <Link className="btn btn--primary" to="/upload">
                <Icon name="upload" size={15} />
                Upload your first batch
              </Link>
            }
          />
        </div>
      ) : (
        <div className="stack-v">
          <section className="kpi-row">
            <StatTile
              label="Total processed"
              icon="file"
              value={stats.total}
              meta={`${pluralise(stats.counts.approved || 0, 'invoice')} approved`}
              hero
            />
            <StatTile
              label="Value in review"
              icon="bank"
              value={formatCompactAmount(stats.totalValue, stats.currency)}
              meta={`${formatAmount(stats.approvedValue, stats.currency)} approved`}
              tone="accent"
              hero
            />
            <StatTile
              label="Needs attention"
              icon="alert"
              value={stats.needsAttention}
              meta={`${pluralise(stats.openIssues, 'open issue')}`}
              tone={stats.needsAttention > 0 ? 'warning' : undefined}
            />
            <StatTile
              label="High risk"
              icon="flag"
              value={stats.counts.high_risk || 0}
              meta={`${formatCompactAmount(stats.atRiskValue, stats.currency)} exposed`}
              tone={stats.counts.high_risk > 0 ? 'critical' : undefined}
            />
          </section>

          <section className="chart-grid">
            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Status of the batch</h2>
                <span className="card__hint">{pluralise(stats.total, 'invoice')}</span>
              </div>
              <StatusStack
                counts={stats.counts}
                total={stats.total}
                onSelect={(status) => navigate(`/invoices?status=${status}`)}
              />
            </div>

            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Exposure by supplier</h2>
                <span className="card__hint">Top 6 by gross value</span>
              </div>
              <SupplierBars rows={stats.topSuppliers} currency={stats.currency} />
            </div>
          </section>

          <section className="chart-grid">
            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Control checks</h2>
              </div>
              <div className="stack-v stack-v--tight">
                <CheckRow
                  icon="copy"
                  label="Duplicate invoices"
                  count={stats.duplicates}
                  hint="Matched against finance records or another upload"
                />
                <CheckRow
                  icon="shield"
                  label="Unverified suppliers"
                  count={stats.unverified}
                  hint="No confident match in the supplier master"
                />
                <CheckRow
                  icon="scales"
                  label="Totals that do not reconcile"
                  count={stats.unreconciled}
                  hint="Net + charges + tax does not equal gross"
                />
              </div>
            </div>

            <div className="card">
              <div className="card__head">
                <h2 className="card__title">Highest risk right now</h2>
                <Link className="card__hint" to="/invoices?status=high_risk">
                  View all
                </Link>
              </div>
              {attention.length === 0 ? (
                <Banner tone="good" icon="check" title="Nothing waiting on you">
                  Every processed invoice is clean or already approved.
                </Banner>
              ) : (
                <div className="stack-v stack-v--tight">
                  {attention.map((invoice) => (
                    <Link
                      key={invoice.id}
                      to={`/invoices/${invoice.id}`}
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      <div className="row" style={{ alignItems: 'flex-start' }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="row row--wrap" style={{ gap: 8 }}>
                            <span className="cell-strong">{invoice.invoice_number || 'No invoice number'}</span>
                            <StatusBadge status={invoice.status} />
                          </div>
                          <p className="cell-sub">
                            {invoice.supplier_name || 'Unidentified supplier'} ·{' '}
                            {formatDate(invoice.invoice_date)} ·{' '}
                            {formatAmount(invoice.gross_amount, invoice.currency)}
                          </p>
                        </div>
                        <RiskMeter score={invoice.risk_score} inline />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </AppShell>
  )
}

function CheckRow({ icon, label, count, hint }) {
  const tone = count > 0 ? 'critical' : 'good'
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <span className="flag-dot" data-tone={tone === 'critical' ? 'critical' : 'neutral'}>
        <Icon name={icon} size={14} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p className="cell-strong">{label}</p>
        <p className="cell-sub">{hint}</p>
      </div>
      <span className="chip" data-tone={tone}>
        <Icon className="chip__icon" name={count > 0 ? 'alert' : 'check'} size={13} strokeWidth={2.1} />
        {count}
      </span>
    </div>
  )
}
