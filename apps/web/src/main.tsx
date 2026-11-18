import { StrictMode, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'
import { HomePage } from './pages/HomePage'
import { BoardPage } from './pages/BoardPage'
import { initAnalytics, trackPageview } from './lib/analytics'
import './index.css'

initAnalytics().catch(() => {}) // analytics must never break the app

function PageviewTracker() {
  const { pathname } = useLocation()
  useEffect(() => trackPageview(pathname), [pathname])
  return null
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <PageviewTracker />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/b/:boardId" element={<BoardPage />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
)
