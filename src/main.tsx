import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './styles/tokens.css'
import './styles/layout.css'
import './styles/components.css'
import './styles/poster.css'
import './styles/admin.css'
import './styles/cabinet.css'
import App from './App'
import { SessionProvider } from './state/session'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <App />
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
)
