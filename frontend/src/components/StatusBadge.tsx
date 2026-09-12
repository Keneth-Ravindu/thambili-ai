import { STATUS_LABELS } from '../constants'
import type { InvoiceStatus } from '../types'

export function StatusBadge({ status }: { status: InvoiceStatus }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] ?? status}</span>
}
