// src/components/Snackbar.tsx
//
// Lightweight global toast/snackbar system. Stacks up to 4 messages, each
// auto-dismissing after `duration` ms (default 4000). Trigger from any
// component via the `useSnackbar()` hook:
//
//   const { snackbar } = useSnackbar()
//   snackbar.success('Game loaded')
//   snackbar.error('Login failed')
//
// The provider must wrap the app once at the top level.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react'

export type SnackbarKind = 'success' | 'error' | 'info'

export interface SnackbarMessage {
  id: number
  kind: SnackbarKind
  text: string
}

interface SnackbarApi {
  success: (text: string, durationMs?: number) => void
  error:   (text: string, durationMs?: number) => void
  info:    (text: string, durationMs?: number) => void
  dismiss: (id: number) => void
}

const SnackbarContext = createContext<{ snackbar: SnackbarApi } | null>(null)

const DEFAULT_DURATION = 4000
const MAX_STACK = 4

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SnackbarMessage[]>([])
  const idRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setItems(prev => prev.filter(it => it.id !== id))
  }, [])

  const push = useCallback((kind: SnackbarKind, text: string, durationMs = DEFAULT_DURATION) => {
    const id = ++idRef.current
    setItems(prev => [...prev, { id, kind, text }].slice(-MAX_STACK))
    if (durationMs > 0) {
      window.setTimeout(() => dismiss(id), durationMs)
    }
  }, [dismiss])

  const api: SnackbarApi = {
    success: (text, d) => push('success', text, d),
    error:   (text, d) => push('error', text, d),
    info:    (text, d) => push('info', text, d),
    dismiss,
  }

  return (
    <SnackbarContext.Provider value={{ snackbar: api }}>
      {children}
      <SnackbarStack items={items} onDismiss={dismiss} />
    </SnackbarContext.Provider>
  )
}

// No-op fallback used when a component renders without a provider — typically
// in unit tests that mount components in isolation. Production paths always
// wrap with <SnackbarProvider>.
const NOOP_API: SnackbarApi = {
  success: () => {},
  error:   () => {},
  info:    () => {},
  dismiss: () => {},
}

export function useSnackbar(): { snackbar: SnackbarApi } {
  const ctx = useContext(SnackbarContext)
  return ctx ?? { snackbar: NOOP_API }
}

function SnackbarStack({ items, onDismiss }: { items: SnackbarMessage[]; onDismiss: (id: number) => void }) {
  if (items.length === 0) return null
  return (
    <div className="snackbar-stack" role="status" aria-live="polite">
      {items.map(item => (
        <div
          key={item.id}
          className={`snackbar snackbar--${item.kind}`}
          onClick={() => onDismiss(item.id)}
        >
          <span className="snackbar-icon">
            {item.kind === 'success' ? '✓' : item.kind === 'error' ? '✕' : 'ⓘ'}
          </span>
          <span className="snackbar-text">{item.text}</span>
          <button
            className="snackbar-close"
            onClick={(e) => { e.stopPropagation(); onDismiss(item.id) }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
