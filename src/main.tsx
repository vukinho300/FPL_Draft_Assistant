import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import LeagueDashboard from './LeagueDashboard.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
      <LeagueDashboard />
  </StrictMode>,
)
