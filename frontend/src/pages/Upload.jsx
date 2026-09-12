import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import AppShell from '../components/AppShell.jsx'
import Icon from '../components/Icon.jsx'
import { Banner, Empty, Spinner, StatusBadge } from '../components/Primitives.jsx'
import { useToast } from '../components/Toasts.jsx'
import { uploadInvoice } from '../lib/api.js'
import { formatAmount, formatFileSize, pluralise } from '../lib/format.js'
import { useInvoices } from '../store/invoices.jsx'

let nextId = 0

export default function Upload() {
  const navigate = useNavigate()
  const toast = useToast()
  const { refresh } = useInvoices()

  const [queue, setQueue] = useState([])
  const [running, setRunning] = useState(false)
  const inputRef = useRef(null)
  const cancelled = useRef(false)

  // Guards against writing state after the page is gone. Reset on mount so
  // StrictMode's double-invoke in development does not leave it latched on.
  useEffect(() => {
    cancelled.current = false
    return () => {
      cancelled.current = true
    }
  }, [])

  const addFiles = useCallback(
    (fileList) => {
      const incoming = [...fileList]
      const pdfs = incoming.filter((file) => file.name.toLowerCase().endsWith('.pdf'))
      const rejected = incoming.length - pdfs.length

      if (rejected > 0) {
        toast.warn(
          `Skipped ${pluralise(rejected, 'file')}`,
          'The pipeline only accepts PDF invoices.',
        )
      }
      if (pdfs.length === 0) return

      setQueue((current) => [
        ...current,
        ...pdfs.map((file) => ({
          id: `q${nextId++}`,
          file,
          state: 'queued',
          result: null,
          error: null,
        })),
      ])
    },
    [toast],
  )

  const patch = useCallback((id, changes) => {
    setQueue((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)))
  }, [])

  /**
   * Files go through one at a time on purpose: the backend compares each new
   * invoice against everything already stored, so processing in parallel would
   * let two copies of the same invoice slip past the duplicate check.
   */
  const run = useCallback(async () => {
    const pending = queue.filter((item) => item.state === 'queued' || item.state === 'error')
    if (pending.length === 0 || running) return

    setRunning(true)
    let succeeded = 0
    let failed = 0

    for (const item of pending) {
      if (cancelled.current) break
      patch(item.id, { state: 'working', error: null })
      try {
        const result = await uploadInvoice(item.file)
        if (cancelled.current) break
        patch(item.id, { state: 'done', result })
        succeeded += 1
      } catch (caught) {
        if (cancelled.current) break
        patch(item.id, { state: 'error', error: caught.message })
        failed += 1
      }
    }

    if (cancelled.current) return
    setRunning(false)
    await refresh()

    if (succeeded > 0 && failed === 0) {
      toast.success(`Processed ${pluralise(succeeded, 'invoice')}`, 'Results are on the invoices page.')
    } else if (succeeded > 0) {
      toast.warn(`Processed ${succeeded} of ${succeeded + failed}`, `${pluralise(failed, 'file')} failed.`)
    } else if (failed > 0) {
      toast.error('Nothing could be processed', 'Check the errors listed against each file.')
    }
  }, [queue, running, patch, refresh, toast])

  const done = queue.filter((item) => item.state === 'done')
  const pendingCount = queue.filter((item) => item.state === 'queued' || item.state === 'error').length
  const processedCount = queue.length - queue.filter((item) => item.state === 'queued').length
  const flagged = done.filter((item) => item.result?.status !== 'ready' && item.result?.status !== 'approved')

  return (
    <AppShell
      title="Upload invoices"
      subtitle="Each PDF is read by Claude, matched to a supplier, checked for duplicates and scored."
      actions={
        queue.length > 0 ? (
          <button
            type="button"
            className="btn btn--sm"
            onClick={() => setQueue([])}
            disabled={running}
          >
            Clear list
          </button>
        ) : null
      }
    >
      <div className="stack-v">
        <Dropzone
          disabled={running}
          onFiles={addFiles}
          onBrowse={() => inputRef.current?.click()}
        />
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="visually-hidden"
          onChange={(event) => {
            addFiles(event.target.files)
            event.target.value = ''
          }}
        />

        {queue.length > 0 ? (
          <>
            {running ? (
              <div className="card">
                <div className="card__head">
                  <h2 className="card__title">Processing</h2>
                  <span className="card__hint">
                    {processedCount} of {queue.length}
                  </span>
                </div>
                <div className="progress">
                  <div
                    className="progress__fill"
                    style={{ width: `${(processedCount / queue.length) * 100}%` }}
                  />
                </div>
                <p className="field__note" style={{ marginTop: 8 }}>
                  Extraction takes a few seconds per invoice — leave this tab open.
                </p>
              </div>
            ) : null}

            <div className="card card--flush">
              <div className="queue">
                {queue.map((item) => (
                  <QueueRow key={item.id} item={item} onOpen={(id) => navigate(`/invoices/${id}`)} />
                ))}
              </div>
            </div>

            <div className="actionbar">
              <span className="actionbar__note">
                {pendingCount > 0
                  ? `${pluralise(pendingCount, 'file')} waiting`
                  : `${pluralise(done.length, 'invoice')} processed`}
                {flagged.length > 0 ? ` · ${pluralise(flagged.length, 'flagged result')}` : ''}
              </span>
              <span className="actionbar__spacer" />
              {done.length > 0 ? (
                <Link className="btn btn--sm" to="/invoices">
                  <Icon name="list" size={15} />
                  Review results
                </Link>
              ) : null}
              <button
                type="button"
                className="btn btn--primary"
                onClick={run}
                disabled={running || pendingCount === 0}
              >
                {running ? <Spinner size={14} /> : <Icon name="upload" size={15} />}
                {running ? 'Processing…' : `Process ${pluralise(pendingCount, 'file')}`}
              </button>
            </div>
          </>
        ) : (
          <div className="card">
            <Empty
              icon="file"
              title="No files queued"
              body="Drop PDFs above or browse for them. Files are processed one at a time so duplicates within the same batch are caught."
            />
          </div>
        )}

        {!running && flagged.length > 0 ? (
          <Banner tone="warning" icon="alert" title={`${pluralise(flagged.length, 'invoice')} need a closer look`}>
            Open each one to see the issues found and correct the extracted values before approving.
          </Banner>
        ) : null}
      </div>
    </AppShell>
  )
}

function Dropzone({ onFiles, onBrowse, disabled }) {
  const [over, setOver] = useState(false)

  return (
    <div
      className={`dropzone${over ? ' is-over' : ''}`}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && onBrowse()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault()
          onBrowse()
        }
      }}
      onDragOver={(event) => {
        event.preventDefault()
        if (!disabled) setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault()
        setOver(false)
        if (!disabled) onFiles(event.dataTransfer.files)
      }}
    >
      <span className="dropzone__icon">
        <Icon name="upload" size={22} strokeWidth={2} />
      </span>
      <p className="dropzone__title">Drop supplier invoices here</p>
      <p className="dropzone__hint">PDF only · multiple files welcome · or click to browse</p>
    </div>
  )
}

const STATE_ICON = {
  queued: 'clock',
  working: null,
  done: 'check',
  error: 'alert',
}

function QueueRow({ item, onOpen }) {
  const { file, state, result, error } = item

  return (
    <div className="queue__item">
      <span className="queue__icon" data-state={state}>
        {state === 'working' ? <Spinner size={14} /> : <Icon name={STATE_ICON[state]} size={15} strokeWidth={2} />}
      </span>

      <div style={{ minWidth: 0 }}>
        <p className="queue__name" title={file.name}>
          {file.name}
        </p>
        {state === 'error' ? (
          <p className="queue__meta queue__meta--error">{error}</p>
        ) : state === 'done' && result ? (
          <p className="queue__meta">
            {result.supplier?.supplier_name || 'Unidentified supplier'}
            {result.invoice_number ? ` · ${result.invoice_number}` : ''}
            {' · '}
            {formatAmount(result.gross_amount, result.currency)}
            {result.issues?.length ? ` · ${pluralise(result.issues.length, 'issue')}` : ''}
          </p>
        ) : (
          <p className="queue__meta">
            {formatFileSize(file.size)}
            {state === 'working' ? ' · extracting with Claude…' : ' · waiting'}
          </p>
        )}
      </div>

      <div className="queue__right">
        {state === 'done' && result ? (
          <>
            <StatusBadge status={result.status} />
            <button type="button" className="btn btn--sm" onClick={() => onOpen(result.id)}>
              <Icon name="eye" size={14} />
              Open
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
