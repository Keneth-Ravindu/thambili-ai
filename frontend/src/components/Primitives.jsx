import Icon from './Icon.jsx'
import { riskBand, riskPercent, statusMeta } from '../lib/status.js'

export function Spinner({ size = 16 }) {
  return <span className="spinner" style={{ width: size, height: size }} role="presentation" />
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="loading-block">
      <Spinner />
      <span>{label}</span>
    </div>
  )
}

export function Empty({ icon = 'inbox', title, body, action }) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={20} />
      </span>
      <p className="empty__title">{title}</p>
      {body ? <p className="empty__body">{body}</p> : null}
      {action ? <div className="empty__action">{action}</div> : null}
    </div>
  )
}

/** Status is always icon + label, never colour alone. */
export function StatusBadge({ status }) {
  const meta = statusMeta(status)
  return (
    <span className="chip" data-tone={meta.tone}>
      <Icon className="chip__icon" name={meta.icon} size={13} strokeWidth={2.1} />
      {meta.label}
    </span>
  )
}

export function Banner({ tone = 'neutral', icon, title, children, action }) {
  return (
    <div className="banner" data-tone={tone}>
      {icon ? <Icon className="banner__icon" name={icon} size={17} /> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        {title ? <p className="banner__title">{title}</p> : null}
        {children ? <div className="banner__body">{children}</div> : null}
      </div>
      {action}
    </div>
  )
}

export function RiskMeter({ score, inline = false }) {
  const band = riskBand(score)
  const percent = riskPercent(score)
  return (
    <div className={inline ? 'meter meter--inline' : 'meter'}>
      <div className="meter__head">
        <span className="meter__label">{inline ? band.label : 'Risk score'}</span>
        <span className="meter__value">{Number(score) || 0}</span>
      </div>
      <div
        className="meter__track"
        role="meter"
        aria-valuenow={Number(score) || 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Risk score ${Number(score) || 0} of 100, ${band.label}`}
      >
        <div className="meter__fill" data-tone={band.tone} style={{ width: `${Math.max(percent, 2)}%` }} />
      </div>
      {inline ? null : (
        <div className="meter__ticks">
          <span>0 · low</span>
          <span>20 · review</span>
          <span>50+ · high</span>
        </div>
      )}
    </div>
  )
}

const CRITICAL_ISSUE_HINTS = ['duplicate', 'already exists', 'bank account']

export function IssueList({ issues }) {
  if (!issues || issues.length === 0) {
    return (
      <Banner tone="good" icon="check" title="No open issues">
        Extraction, supplier match and totals all check out.
      </Banner>
    )
  }
  return (
    <ul className="issues">
      {issues.map((issue, index) => {
        const critical = CRITICAL_ISSUE_HINTS.some((hint) => issue.toLowerCase().includes(hint))
        return (
          <li className="issues__item" key={`${issue}-${index}`} data-tone={critical ? 'critical' : 'warning'}>
            <Icon className="issues__icon" name={critical ? 'flag' : 'alert'} size={15} strokeWidth={2} />
            <span>{issue}</span>
          </li>
        )
      })}
    </ul>
  )
}

export function StatTile({ label, icon, value, meta, tone, hero = false }) {
  return (
    <div className={`stat${tone ? ` stat--${tone}` : ''}`}>
      <p className="stat__label">
        {icon ? <Icon name={icon} size={14} /> : null}
        {label}
      </p>
      <p className={`stat__value${hero ? ' stat__value--hero' : ''}`}>{value}</p>
      {meta ? <p className="stat__meta">{meta}</p> : null}
    </div>
  )
}

export function Field({ label, dirty, note, noteTone, children }) {
  return (
    <label className={`field${dirty ? ' field--dirty' : ''}`}>
      <span className="field__label">{label}</span>
      {children}
      {note ? (
        <span className="field__note" data-tone={noteTone}>
          {note}
        </span>
      ) : null}
    </label>
  )
}

export function Readout({ label, children }) {
  return (
    <div className="readout__item">
      <p className="readout__label">{label}</p>
      <p className="readout__value">{children}</p>
    </div>
  )
}
