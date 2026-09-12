import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

import Icon from './Icon.jsx'

const ToastContext = createContext(null)

const TONE_ICONS = {
  good: 'check',
  critical: 'alert',
  warning: 'alert',
  neutral: 'dot',
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timers = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const push = useCallback(
    (toast) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      setToasts((current) => [...current, { ...toast, id }])
      const ttl = toast.tone === 'critical' ? 9000 : 5000
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), ttl),
      )
      return id
    },
    [dismiss],
  )

  const api = useMemo(
    () => ({
      success: (title, text) => push({ tone: 'good', title, text }),
      error: (title, text) => push({ tone: 'critical', title, text }),
      warn: (title, text) => push({ tone: 'warning', title, text }),
      info: (title, text) => push({ tone: 'neutral', title, text }),
    }),
    [push],
  )

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach(clearTimeout)
      pending.clear()
    }
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id} data-tone={toast.tone}>
            <Icon name={TONE_ICONS[toast.tone] || 'dot'} size={16} />
            <div className="toast__body">
              <p className="toast__title">{toast.title}</p>
              {toast.text ? <p className="toast__text">{toast.text}</p> : null}
            </div>
            <button
              type="button"
              className="btn btn--ghost btn--icon btn--sm"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss notification"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside a ToastProvider')
  return context
}
