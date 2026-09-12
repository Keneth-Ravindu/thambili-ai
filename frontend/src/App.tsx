import { useState } from 'react'
import './App.css'
import { UploadPage } from './pages/UploadPage'
import { QueuePage } from './pages/QueuePage'
import { InvoiceDetailPage } from './pages/InvoiceDetailPage'
import { ExportPage } from './pages/ExportPage'

type View = 'upload' | 'queue' | 'export'

function App() {
  const [view, setView] = useState<View>('upload')
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null)
  const [queueRefreshKey, setQueueRefreshKey] = useState(0)

  function openInvoice(id: number) {
    setSelectedInvoiceId(id)
  }

  function closeInvoice() {
    setSelectedInvoiceId(null)
    setQueueRefreshKey((k) => k + 1)
  }

  if (selectedInvoiceId != null) {
    return (
      <div className="app">
        <InvoiceDetailPage
          invoiceId={selectedInvoiceId}
          onBack={closeInvoice}
          onChanged={() => setQueueRefreshKey((k) => k + 1)}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-title">Thambili Invoice Processing</div>
        <div className="nav-links">
          <button className={view === 'upload' ? 'active' : ''} onClick={() => setView('upload')}>
            Upload
          </button>
          <button className={view === 'queue' ? 'active' : ''} onClick={() => setView('queue')}>
            Review queue
          </button>
          <button className={view === 'export' ? 'active' : ''} onClick={() => setView('export')}>
            Export
          </button>
        </div>
      </nav>

      <main>
        {view === 'upload' && <UploadPage onOpenInvoice={openInvoice} />}
        {view === 'queue' && <QueuePage key={queueRefreshKey} onOpenInvoice={openInvoice} />}
        {view === 'export' && <ExportPage />}
      </main>
    </div>
  )
}

export default App
