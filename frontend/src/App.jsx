import { Navigate, Route, Routes } from 'react-router-dom'

import { InvoicesProvider } from './store/invoices.jsx'
import { ToastProvider } from './components/Toasts.jsx'

import Dashboard from './pages/Dashboard.jsx'
import Upload from './pages/Upload.jsx'
import Invoices from './pages/Invoices.jsx'
import InvoiceDetail from './pages/InvoiceDetail.jsx'

export default function App() {
  return (
    <ToastProvider>
      <InvoicesProvider>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/invoices/:id" element={<InvoiceDetail />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </InvoicesProvider>
    </ToastProvider>
  )
}
