export const COST_CENTRES: { code: string; label: string }[] = [
  { code: '', label: '(unset)' },
  { code: 'CC-CKN', label: 'Central Kitchen' },
  { code: 'CC-C03', label: 'Colombo 03' },
  { code: 'CC-C07', label: 'Colombo 07' },
  { code: 'CC-BAT', label: 'Battaramulla' },
  { code: 'CC-RAJ', label: 'Rajagiriya' },
  { code: 'CC-MLV', label: 'Mount Lavinia' },
  { code: 'CC-NUG', label: 'Nugegoda' },
]

export const DOCUMENT_TYPES = [
  'invoice',
  'credit_note',
  'pro_forma_invoice',
  'statement_of_account',
  'receipt',
  'other',
]

export const STATUS_LABELS: Record<string, string> = {
  processing: 'Processing',
  needs_attention: 'Needs attention',
  ready_to_approve: 'Ready to approve',
  approved: 'Approved',
  rejected: 'Rejected',
}
