export type InvoiceStatus =
  | 'processing'
  | 'needs_attention'
  | 'ready_to_approve'
  | 'approved'
  | 'rejected'

export interface Flag {
  code: string
  message: string
  severity: 'high' | 'medium' | 'low'
}

export interface LineItem {
  id: number
  description: string
  quantity: number | null
  unit: string
  unit_rate: number | null
  amount: number | null
}

export interface InvoiceSummary {
  id: number
  source_filename: string
  status: InvoiceStatus
  document_type: string
  supplier_id: string | null
  supplier_name_raw: string
  invoice_number: string
  invoice_date: string | null
  currency: string
  gross_amount: number | null
  cost_centre: string
  record_id: string | null
  flags: Flag[]
}

export interface InvoiceDetail extends InvoiceSummary {
  stored_path: string
  uploaded_at: string
  supplier_match_confidence: number
  buyer_name_raw: string
  buyer_vat_raw: string
  bill_to_location_raw: string
  due_date: string | null
  po_number: string
  net_amount: number | null
  tax_amount: number | null
  bank_account: string
  payment_terms: string
  reviewer_notes: string
  rejection_reason: string
  entered_by: string
  date_entered: string | null
  reviewed_at: string | null
  extraction_error: string
  raw_extraction: Record<string, unknown>
  line_items: LineItem[]
}

export interface Supplier {
  supplier_id: string
  registered_name: string
  trading_name: string
  category: string
  vat_number: string
  payment_terms: string
  currency: string
}

export interface Stats {
  total: number
  processing: number
  needs_attention: number
  ready_to_approve: number
  approved: number
  rejected: number
  approved_value_by_currency: Record<string, number>
}

export interface InvoiceUpdate {
  supplier_id?: string | null
  supplier_name_raw?: string
  buyer_name_raw?: string
  buyer_vat_raw?: string
  bill_to_location_raw?: string
  document_type?: string
  invoice_number?: string
  invoice_date?: string | null
  due_date?: string | null
  po_number?: string
  currency?: string
  net_amount?: number | null
  tax_amount?: number | null
  gross_amount?: number | null
  bank_account?: string
  payment_terms?: string
  cost_centre?: string
  reviewer_notes?: string
  line_items?: Omit<LineItem, 'id'>[]
}
