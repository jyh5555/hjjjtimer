import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        void registration.unregister()
      })
    })
  })
}

if ('caches' in window) {
  window.addEventListener('load', () => {
    void caches.keys().then((keys) => {
      keys.forEach((key) => {
        void caches.delete(key)
      })
    })
  })
}
