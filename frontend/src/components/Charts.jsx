import { useCallback, useState } from 'react'

import Icon from './Icon.jsx'
import { STATUS, STATUS_ORDER } from '../lib/status.js'
import { formatAmount, pluralise } from '../lib/format.js'

/**
 * Status fills come from the reserved status palette (good / warning / critical)
 * plus the accent blue for "approved" — a hue family none of the three status
 * colours occupies. Every mark is paired with an icon and a labelled legend
 * value, so no state is signalled by colour alone.
 */
const STATUS_FILL = {
  ready: 'var(--good)',
  needs_review: 'var(--warning)',
  high_risk: 'var(--critical)',
  rejected: 'var(--critical)',
  approved: 'var(--accent)',
  processing: 'var(--axis)',
}

function useTooltip() {
  const [tip, setTip] = useState(null)

  const show = useCallback((event, content) => {
    const rect = event.currentTarget.getBoundingClientRect()
    setTip({ content, x: rect.left + rect.width / 2, y: rect.top })
  }, [])

  const hide = useCallback(() => setTip(null), [])

  const node = tip ? (
    <div className="tooltip" style={{ left: tip.x, top: tip.y }} role="presentation">
      {tip.content}
    </div>
  ) : null

  return { show, hide, node }
}

/* ------------------------------------------------------------------ */

export function StatusStack({ counts, total, onSelect }) {
  const { show, hide, node } = useTooltip()
  const present = STATUS_ORDER.filter((key) => (counts[key] || 0) > 0)

  if (total === 0) {
    return <p className="muted">Nothing processed yet.</p>
  }

  return (
    <>
      <div className="stack" role="group" aria-label={`Invoice status split across ${pluralise(total, 'invoice')}`}>
        {present.map((key) => {
          const count = counts[key]
          const share = (count / total) * 100
          return (
            <button
              type="button"
              key={key}
              className="stack__seg"
              style={{ flex: `${share} 0 0`, background: STATUS_FILL[key] }}
              onClick={onSelect ? () => onSelect(key) : undefined}
              onMouseEnter={(event) =>
                show(
                  event,
                  <>
                    <p className="tooltip__title">
                      <Icon name={STATUS[key].icon} size={13} />
                      {STATUS[key].label}
                    </p>
                    <p className="tooltip__row">
                      <span>Invoices</span>
                      <b>{count}</b>
                    </p>
                    <p className="tooltip__row">
                      <span>Share</span>
                      <b>{share.toFixed(0)}%</b>
                    </p>
                  </>,
                )
              }
              onMouseLeave={hide}
              onFocus={(event) => show(event, <p className="tooltip__title">{STATUS[key].label}</p>)}
              onBlur={hide}
              aria-label={`${STATUS[key].label}: ${pluralise(count, 'invoice')}`}
            />
          )
        })}
      </div>

      <div className="stack-legend">
        {STATUS_ORDER.map((key) => (
          <button
            type="button"
            className="stack-legend__item"
            key={key}
            onClick={onSelect ? () => onSelect(key) : undefined}
          >
            <span className="stack-legend__swatch" style={{ background: STATUS_FILL[key] }} />
            <Icon name={STATUS[key].icon} size={13} />
            <span className="stack-legend__label">{STATUS[key].label}</span>
            <span className="stack-legend__value tnum">{counts[key] || 0}</span>
          </button>
        ))}
      </div>
      {node}
    </>
  )
}

/* ------------------------------------------------------------------ */

/**
 * Magnitude comparison across one dimension, so: one hue for every bar. The
 * fill never varies by rank — filtering the list must not repaint the bars.
 */
export function SupplierBars({ rows, currency }) {
  const { show, hide, node } = useTooltip()
  if (rows.length === 0) return <p className="muted">No supplier totals yet.</p>
  const max = Math.max(...rows.map((row) => row.total))

  return (
    <>
      <div className="bars">
        {rows.map((row) => (
          <div
            className="bar-row"
            key={row.name}
            onMouseEnter={(event) =>
              show(
                event,
                <>
                  <p className="tooltip__title">{row.name}</p>
                  <p className="tooltip__row">
                    <span>Total</span>
                    <b>{formatAmount(row.total, currency)}</b>
                  </p>
                  <p className="tooltip__row">
                    <span>Invoices</span>
                    <b>{row.count}</b>
                  </p>
                </>,
              )
            }
            onMouseLeave={hide}
          >
            <div className="bar-row__head">
              <span className="bar-row__name" title={row.name}>
                {row.name}
              </span>
              <span className="bar-row__value tnum">{formatAmount(row.total, currency)}</span>
            </div>
            <div className="bar-row__track">
              <div
                className="bar-row__fill"
                style={{ width: `${max > 0 ? (row.total / max) * 100 : 0}%`, background: 'var(--seq-3)' }}
              />
            </div>
          </div>
        ))}
      </div>
      {node}
    </>
  )
}
