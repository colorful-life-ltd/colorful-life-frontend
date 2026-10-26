import { useEffect, useRef, useState } from 'react'
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js'
import { stripeForPayment } from '../../features/checkout/stripeLoader'
import type { RetryAdmission } from '../../features/checkout/useCheckout'

export function StripePaymentForm({ clientSecret, orderId, onVerify, onRecheck, beforeConfirm, beforeRetry, onSubmissionSettled }: { clientSecret: string; orderId: number; onVerify: () => void; onRecheck?: () => void; beforeConfirm?: () => Promise<boolean>; beforeRetry?: () => Promise<RetryAdmission>; onSubmissionSettled?: () => void }) {
  const [unavailable, setUnavailable] = useState(false)
  const [stripePromise] = useState(stripeForPayment)
  useEffect(() => {
    let active = true
    void stripePromise?.then(stripe => { if (active && !stripe) setUnavailable(true) })
    return () => { active = false }
  }, [stripePromise])
  if (!stripePromise) return <p role="alert">Payments are not configured.{import.meta.env.DEV && ' Set VITE_STRIPE_PUBLISHABLE_KEY to a valid Stripe publishable key, then reload.'}</p>
  if (unavailable) return <p role="alert">Secure payment could not load. Check your connection and reload this order to try again.</p>
  return <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe', variables: { colorPrimary: '#65547c', borderRadius: '12px' } } }}><PaymentForm orderId={orderId} clientSecret={clientSecret} onVerify={onVerify} onRecheck={onRecheck} beforeConfirm={beforeConfirm} beforeRetry={beforeRetry} onSubmissionSettled={onSubmissionSettled} /></Elements>
}

export function PaymentForm({ orderId, clientSecret, onVerify, onRecheck, beforeConfirm, beforeRetry, onSubmissionSettled }: { orderId: number; clientSecret: string; onVerify: () => void; onRecheck?: () => void; beforeConfirm?: () => Promise<boolean>; beforeRetry?: () => Promise<RetryAdmission>; onSubmissionSettled?: () => void }) {
  const stripe = useStripe()
  const elements = useElements()
  const locked = useRef(false)
  // After a card decline the same PaymentIntent waits for new card details; the next attempt is re-admitted by the backend.
  const declined = useRef(false)
  const lifecycle = useRef(0)
  const callback = useRef(onVerify)
  useEffect(() => { callback.current = onVerify }, [onVerify])
  const [state, setState] = useState<'loading' | 'ready' | 'submitting' | 'unknown'>('loading')
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (!stripe) return
    let active = true
    const current = ++lifecycle.current
    void stripe.retrievePaymentIntent(clientSecret).then(result => {
      if (!active) return
      if (['succeeded', 'processing'].includes(result.paymentIntent?.status ?? '')) { callback.current(); return }
      if (result.error || !['requires_payment_method', 'requires_confirmation', 'requires_action'].includes(result.paymentIntent?.status ?? '')) { setState('unknown'); setError('This payment cannot be resumed. Please check your order status.'); return }
      setState('ready')
    }).catch(() => { if (active) { setState('unknown'); setError('Unable to check payment status. Please recheck your order.') } })
    return () => { active = false; if (lifecycle.current === current) lifecycle.current += 1 }
  }, [stripe, clientSecret, orderId])
  return <form onSubmit={async event => {
    event.preventDefault()
    if (!stripe || !elements || locked.current || state !== 'ready') return
    const current = lifecycle.current
    locked.current = true; setState('submitting'); setError(null)
    try {
      if (declined.current && beforeRetry) {
        const admission = await beforeRetry()
        if (lifecycle.current !== current) return
        // A different intent remounts a fresh form; never confirm details entered against another payment.
        if (admission === 'remount') { setState('ready'); return }
        if (admission === 'stop') { setState('unknown'); setError('This payment can no longer be retried here. Check your order status.'); return }
      } else if (beforeConfirm && !await beforeConfirm()) { if (lifecycle.current === current) { setState('unknown'); setError('Payment eligibility changed. Refresh the order before continuing.') }; return }
      if (lifecycle.current !== current) return
      const result = await stripe.confirmPayment({ elements, confirmParams: { return_url: `${window.location.origin}/checkout/orders/${orderId}` }, redirect: 'if_required' })
      if (lifecycle.current !== current) return
      if (result.error) {
        if (result.error.type === 'validation_error') { setError('Please complete or correct your payment details, then try again.'); setState('ready') }
        else if (result.error.type === 'card_error' && beforeRetry) { declined.current = true; setError(`${result.error.message || 'Your card was declined.'} Check your card details or use a different card, then press Pay now to try again.`); setState('ready') }
        else if (result.error.type === 'card_error') { setError('Your card was declined. Check the order status before another attempt.'); setState('unknown') }
        else { setState('unknown'); setError('The payment outcome is not yet known. Please check your order before trying again.') }
      } else { setState('unknown'); callback.current() }
    } catch { if (lifecycle.current === current) { setState('unknown'); setError('Connection lost during payment. Please check your order before trying again.') } }
    finally { locked.current = false; if (lifecycle.current === current) onSubmissionSettled?.() }
  }}>
    <PaymentElement onLoadError={() => { setState('unknown'); setError('Secure payment could not load. Please check your order and try again.') }} />
    {error && <p role="alert">{error}</p>}
    <p role="status">{state === 'loading' ? 'Checking payment details…' : state === 'submitting' ? 'Submitting payment… Complete any authentication requested by your bank.' : ''}</p>
    {state === 'unknown' ? <button type="button" onClick={onRecheck ?? onVerify}>Check order status</button> : <button type="submit" disabled={!stripe || !elements || state !== 'ready'}>{state === 'submitting' ? 'Processing payment…' : 'Pay now'}</button>}
  </form>
}
