// Must stay first: removes a password-reset token from the URL before anything else runs.
import './features/auth/captureResetToken'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { SandboxBanner } from './components/checkout/SandboxBanner'
import { AuthProvider } from './features/auth/AuthProvider'
import { CartProvider } from './features/cart/CartProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider><CartProvider><SandboxBanner /><App /></CartProvider></AuthProvider>
  </StrictMode>,
)
