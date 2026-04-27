// src/main.tsx
import ReactDOM from 'react-dom/client'
import { AppWrapper } from './App'
import './App.css'

// StrictMode is intentionally OFF: it double-invokes effects in dev, which
// caused the opening scene to be sent (and rendered) twice when a new game
// began. Production behaviour is identical without it.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <AppWrapper />
)
