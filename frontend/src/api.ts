import type { InvoiceDetail, InvoiceSummary, InvoiceUpdate, Stats, Supplier } from './types'

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let detail = res.statusText
    try {
      const body = await res.json()
      detail = body.detail ?? detail
    } catch {
      // ignore - not json
    }
    throw new Error(detail)
  }
  return res.json() as Promise<T>
}

export const api = {
  async uploadInvoices(files: File[]): Promise<InvoiceSummary[]> {
    const form = new FormData()
    for (const file of files) form.append('files', file)
    const res = await fetch('/api/invoices/upload', { method: 'POST', body: form })
    return handle(res)
  },

  async listInvoices(status?: string): Promise<InvoiceSummary[]> {
    const url = status ? `/api/invoices?status=${encodeURIComponent(status)}` : '/api/invoices'
    return handle(await fetch(url))
  },

  async getInvoice(id: number): Promise<InvoiceDetail> {
    return handle(await fetch(`/api/invoices/${id}`))
  },

  fileUrl(id: number): string {
    return `/api/invoices/${id}/file`
  },

  async updateInvoice(id: number, update: InvoiceUpdate): Promise<InvoiceDetail> {
    const res = await fetch(`/api/invoices/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(update),
    })
    return handle(res)
  },

  async approveInvoice(id: number, enteredBy: string): Promise<InvoiceDetail> {
    const res = await fetch(`/api/invoices/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entered_by: enteredBy }),
    })
    return handle(res)
  },

  async rejectInvoice(id: number, reason: string): Promise<InvoiceDetail> {
    const res = await fetch(`/api/invoices/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    })
    return handle(res)
  },

  async reprocessInvoice(id: number): Promise<InvoiceDetail> {
    const res = await fetch(`/api/invoices/${id}/reprocess`, { method: 'POST' })
    return handle(res)
  },

  async listSuppliers(): Promise<Supplier[]> {
    return handle(await fetch('/api/suppliers'))
  },

  async getStats(): Promise<Stats> {
    return handle(await fetch('/api/invoices/stats'))
  },

  exportUrl(): string {
    return '/api/export'
  },
}
