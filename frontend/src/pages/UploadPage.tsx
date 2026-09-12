import { useRef, useState } from 'react'
import { api } from '../api'
import { StatusBadge } from '../components/StatusBadge'
import { FlagList } from '../components/FlagList'
import type { InvoiceSummary } from '../types'

export function UploadPage({ onOpenInvoice }: { onOpenInvoice: (id: number) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [results, setResults] = useState<InvoiceSummary[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    setBusy(true)
    setError('')
    try {
      const uploaded = await api.uploadInvoices(Array.from(fileList))
      setResults(uploaded)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="page">
      <h1>Upload invoices</h1>
      <p className="muted">
        Select one or more supplier invoice PDFs. Each one is read automatically and checked for
        duplicates, missing information, and anything else that needs a second look before it's
        approved.
      </p>

      <div
        className="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          handleFiles(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? 'Processing...' : 'Drop PDFs here, or click to choose files'}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          multiple
          hidden
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && <p className="error">{error}</p>}

      {results.length > 0 && (
        <div className="upload-results">
          <h2>Just processed</h2>
          {results.map((inv) => (
            <div key={inv.id} className="upload-result-row" onClick={() => onOpenInvoice(inv.id)}>
              <div className="upload-result-header">
                <strong>{inv.source_filename}</strong>
                <StatusBadge status={inv.status} />
              </div>
              <div className="upload-result-meta">
                {inv.supplier_name_raw || 'Unknown supplier'} &middot; {inv.invoice_number || 'no invoice #'}
                {inv.gross_amount != null ? ` · ${inv.currency} ${inv.gross_amount.toLocaleString()}` : ''}
              </div>
              <FlagList flags={inv.flags} />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
