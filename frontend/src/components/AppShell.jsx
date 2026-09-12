import { Link, useLocation } from 'react-router-dom'

import Icon from './Icon.jsx'
import useTheme from '../lib/useTheme.js'
import { API_BASE_URL } from '../lib/api.js'
import { summarise, useInvoices } from '../store/invoices.jsx'

const HEALTH_LABEL = {
  online: 'API connected',
  offline: 'API unreachable',
  unknown: 'Checking API…',
}

export default function AppShell({ title, subtitle, actions, children }) {
  const { theme, toggle } = useTheme()
  const { invoices, health, refresh, loading } = useInvoices()
  const stats = summarise(invoices)

  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail__brand">
          <span className="rail__mark">
            <Icon name="shield" size={18} strokeWidth={2} />
          </span>
          <span>
            <span className="rail__name">Thambili</span>
            <br />
            <span className="rail__tag">Invoice Intelligence</span>
          </span>
        </div>

        <nav className="rail__nav" aria-label="Main">
          <RailLink to="/" icon="dashboard" label="Dashboard" />
          <RailLink to="/upload" icon="upload" label="Upload" />
          <RailLink to="/invoices" icon="list" label="Invoices" count={stats.total} />
          <RailLink to="/invoices?status=high_risk" icon="flag" label="Flagged" count={stats.needsAttention} />
        </nav>

        <div className="rail__foot">
          <div className="rail__status" title={API_BASE_URL}>
            <span className="rail__dot" data-state={health} />
            <span>{HEALTH_LABEL[health]}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar__heading">
            <h1 className="topbar__title">{title}</h1>
            {subtitle ? <p className="topbar__sub">{subtitle}</p> : null}
          </div>
          <div className="topbar__actions">
            {actions}
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh data"
              title="Refresh data"
            >
              <Icon name="refresh" size={16} />
            </button>
            <button
              type="button"
              className="btn btn--ghost btn--icon"
              onClick={toggle}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
            >
              <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
            </button>
          </div>
        </header>

        <main className="page">{children}</main>
      </div>
    </div>
  )
}

/**
 * NavLink ignores the query string, which would light up both "Invoices" and
 * "Flagged" at once — they share a path and differ only by `?status=`. So the
 * active state is matched on path *and* search here.
 */
function RailLink({ to, icon, label, count }) {
  const location = useLocation()
  const [path, search = ''] = to.split('?')
  const onPath = location.pathname === path || location.pathname.startsWith(`${path}/`)
  const active = onPath && location.search.replace(/^\?/, '') === search

  return (
    <Link to={to} className={`rail__link${active ? ' is-active' : ''}`} aria-current={active ? 'page' : undefined}>
      <Icon name={icon} size={16} />
      <span>{label}</span>
      {count ? <span className="rail__count tnum">{count}</span> : null}
    </Link>
  )
}
