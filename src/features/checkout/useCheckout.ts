import { useCart } from '../cart/CartContext'
import { useCallback, useEffect, useRef, useState } from 'react'
import { availabilityConflictCodes, CheckoutApiError, createOrder, getOrder, parseOrderPayment, preparePayment, recoverPayment, type Order, type OrderInput } from './api'
import { clearAttempt, consumeStripeReturn, isConfirmed, isLegacyAttempt, isTerminal, navigateCheckout, readAttempt, saveAttempt, type CreationAttempt } from './state'
import { isShippingMethod } from './shipping'
import { canRecoverPayment, isOlderPaymentSnapshot, parsePaymentWindow, paymentAction } from './paymentWindow'
import { AuthApiError, getCurrentUser, isVerificationRequired } from '../auth/api'

export type Phase = 'ready' | 'creating' | 'loading' | 'reserved' | 'preparing' | 'payment' | 'waiting' | 'submitting' | 'verifying' | 'verification-timeout' | 'pending' | 'confirmed' | 'failure' | 'terminal' | 'auth' | 'verification' | 'cart-conflict'
export const verificationDelays = [0, 1000, 2000, 3000, 5000, 8000, 10000]

export function useCheckout(token: string, userId: number, orderId: number | null) {
  const { refreshCart } = useCart()
  const [actionRejected, setActionRejected] = useState(false)
  const latest = useRef<Order | null>(null)
  const [conflict, setConflict] = useState<CheckoutApiError | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [phase, setPhase] = useState<Phase>(orderId ? 'loading' : 'ready')
  const [message, setMessage] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(() => readAttempt(userId))
  const attemptRef = useRef(attempt)
  const obtainedOrderId = useRef(orderId)
  const active = useRef(true)
  const busy = useRef(false)
  const blockedReads = useRef(false)
  const run = useRef(0)
  const submission = useRef(false)
  const verificationLocked = useRef(false)
  const autoStarted = useRef(false)
  const verificationDelay = useRef<{ timer: number; resolve: () => void } | null>(null)

  const accept = useCallback((next: Order, verifying = false) => {
    if ((orderId !== null && next.id !== orderId) || isOlderPaymentSnapshot(latest.current, next)) return false
    const clean = parseOrderPayment(next)
    latest.current = clean; setOrder(clean)
    const window = clean.paymentWindow
    if (isConfirmed(clean)) {
      setPhase('confirmed'); setSecret(null); return true
    }
    if (window?.state === 'PAID' && clean.status !== 'PENDING') { setPhase('pending'); setSecret(null); return true }
    if (['CANCELLED', 'EXPIRED', 'RETURNED'].includes(clean.status)) { setPhase('terminal'); setSecret(null); return true }
    if (isTerminal(clean)) { setPhase('terminal'); setSecret(null); return true }
    if (verifying || verificationLocked.current) { setPhase(verifying ? 'verifying' : 'verification-timeout'); setSecret(null); return false }
    if (!window || !paymentAction(window)) { setPhase('pending'); setSecret(null); return true }
    setPhase('reserved'); return false
  }, [orderId])

  const fail = useCallback((reason: unknown) => {
    setSecret(null)
    if (reason instanceof CheckoutApiError && [401, 403, 404].includes(reason.status)) blockedReads.current = true
    setMessage(reason instanceof Error ? reason.message : 'Connection lost. Please try again.')
    setPhase(reason instanceof CheckoutApiError && reason.status === 403 && reason.code === 'EMAIL_VERIFICATION_REQUIRED' ? 'verification' : reason instanceof CheckoutApiError && [401, 403].includes(reason.status) ? 'auth' : reason instanceof CheckoutApiError && (reason.status === 404 || ['ORDER_EXPIRED', 'ORDER_NOT_PAYABLE', 'ORDER_IDEMPOTENCY_MISMATCH', 'INVALID_IDEMPOTENCY_KEY'].includes(reason.code ?? '')) ? 'terminal' : verificationLocked.current ? 'verification-timeout' : 'failure')
  }, [])


  const create = async (input: OrderInput) => {
    if (busy.current || obtainedOrderId.current || orderId || order || (phase === 'verification' || phase === 'cart-conflict')) return
    if (!attemptRef.current && input.items.length === 0) return
    // A pre-shipping saved request may already have created an order. Never replay it with an
    // invented delivery method; the customer must check My Orders or deliberately start again.
    if (isLegacyAttempt(attemptRef.current)) { setMessage('This saved checkout request was made before delivery options were introduced, so it cannot be sent again. Check My Orders for an existing order, or leave the saved checkout to start again.'); return }
    if (attemptRef.current?.rejection === 'REPLAY_REJECTED') { setMessage('This saved checkout request can no longer be accepted, and an earlier attempt may already have created an order. Check My Orders before starting a new checkout.'); return }
    if (!attemptRef.current && !isShippingMethod(input.shippingMethod)) { setMessage('Choose Standard or Express delivery before creating your order.'); return }
    const currentRun = run.current
    let replay = false
    busy.current = true; setMessage(null); setPhase('creating')
    try {
      if (attemptRef.current?.rejection === 'EMAIL_VERIFICATION_REQUIRED') {
        // A deliberate continuation checks backend authority before another POST.
        try { await getCurrentUser(token); if (!active.current || run.current !== currentRun) return }
        catch (reason) {
          if (isVerificationRequired(reason)) throw new CheckoutApiError(403, 'EMAIL_VERIFICATION_REQUIRED')
          if (reason instanceof AuthApiError) throw new CheckoutApiError(reason.status, reason.code)
          throw reason
        }
      }
      const saved = attemptRef.current
      replay = Boolean(saved)
      const current: CreationAttempt = saved ? { key: saved.key, input: saved.input } : { key: crypto.randomUUID(), input }
      // Persist before sending. A lost response must replay the same key AND payload.
      saveAttempt(userId, current); attemptRef.current = current; setAttempt(current)
      const result = await createOrder(token, current.input, current.key)
      if (!active.current || run.current !== currentRun) return
      obtainedOrderId.current = result.id
      window.history.replaceState({}, '', `/checkout/orders/${result.id}`)
      clearAttempt(userId)
      window.dispatchEvent(new PopStateEvent('popstate'))
    } catch (reason) {
      if (active.current && run.current === currentRun) {
        if (reason instanceof CheckoutApiError && reason.status === 409 && availabilityConflictCodes.includes(reason.code ?? '')) {
          // Definite rejection: retire this identity, never rewrite an ambiguous request.
          clearAttempt(userId); attemptRef.current = null; setAttempt(null)
          setConflict(reason); setMessage(null); setPhase('cart-conflict')
          await refreshCart()
          return
        }
        if (reason instanceof CheckoutApiError && reason.status === 400 && reason.code !== 'INVALID_IDEMPOTENCY_KEY' && replay && attemptRef.current) {
          // Validation precedes the idempotency lookup, so a replay's 400 does not prove that no order exists.
          // Keep the exact request and key, stop further sends, and send the customer to My Orders first.
          const rejected: CreationAttempt = { ...attemptRef.current, rejection: 'REPLAY_REJECTED' }
          attemptRef.current = rejected; setAttempt(rejected)
          try { saveAttempt(userId, rejected) } catch { /* The original request remains persisted. */ }
          setMessage('This saved checkout request can no longer be accepted, and an earlier attempt may already have created an order. Check My Orders before starting a new checkout.'); setPhase('ready')
          return
        }
        if (reason instanceof CheckoutApiError && reason.status === 400 && reason.code !== 'INVALID_IDEMPOTENCY_KEY') {
          // A first send's validation failure creates no order. Retire it for explicit review; never resubmit automatically.
          clearAttempt(userId); attemptRef.current = null; setAttempt(null)
          setMessage(reason.message); setPhase('ready')
          return
        }
        if (reason instanceof CheckoutApiError && reason.status === 403 && reason.code === 'EMAIL_VERIFICATION_REQUIRED' && attemptRef.current) {
          const rejected: CreationAttempt = { ...attemptRef.current, rejection: 'EMAIL_VERIFICATION_REQUIRED' }
          attemptRef.current = rejected; setAttempt(rejected)
          // Keep the original identity and payload. This response is definite,
          // unlike a timeout: it must not be described as a lost order response.
          try { saveAttempt(userId, rejected) } catch { /* The original request was already persisted before sending. */ }
        }
        fail(reason)
      }
    }
    finally { if (run.current === currentRun) busy.current = false }
  }

  const verify = useCallback(async () => {
    const id = orderId ?? latest.current?.id
    if (!id || busy.current || blockedReads.current || !active.current || (latest.current && isConfirmed(latest.current))) return
    autoStarted.current = true
    verificationLocked.current = true
    busy.current = true; setPhase('verifying'); setSecret(null); setMessage(null)
    const currentRun = ++run.current
    try {
      for (const delay of verificationDelays) {
        if (delay) await new Promise<void>(resolve => {
          const timer = window.setTimeout(() => { verificationDelay.current = null; resolve() }, delay)
          verificationDelay.current = { timer, resolve }
        })
        if (!active.current || run.current !== currentRun) return
        const next = await getOrder(token, id)
        if (!active.current || run.current !== currentRun) return
        if (next.id !== id) throw new Error('Unable to read this order.')
        if (isOlderPaymentSnapshot(latest.current, next)) continue
        accept(next, true)
        const state = parsePaymentWindow(next.paymentWindow)?.state
        if (isConfirmed(next) || isTerminal(next) || ['CANCELLED', 'EXPIRED', 'RETURNED'].includes(next.status)) return
        // PAID is financial evidence, not fulfilment confirmation. Keep reading
        // a PENDING order, including when webhook lag still reports resumable.
        if (state === 'PAID' && next.status !== 'PENDING') return
      }
      setPhase('verification-timeout')
      setMessage(parsePaymentWindow(latest.current?.paymentWindow)?.state === 'PAID'
        ? 'Payment was recorded, but order confirmation is still pending. Do not pay again. Check order status later or contact us.'
        : 'Payment verification is taking longer than expected. This does not mean payment failed. Do not pay again; check order status later.')
    } catch (reason) {
      if (active.current && run.current === currentRun) {
        fail(reason)
        if (!(reason instanceof CheckoutApiError) || ![401, 403, 404].includes(reason.status)) {
          setPhase('verification-timeout')
          setMessage(parsePaymentWindow(latest.current?.paymentWindow)?.state === 'PAID'
            ? 'Payment was recorded, but we could not confirm the order yet. Do not pay again. Check order status later.'
            : 'We could not finish checking the payment. Its outcome is not yet known. Do not pay again; check order status later.')
        }
      }
    } finally { if (run.current === currentRun) busy.current = false }
  }, [accept, fail, orderId, token])

  useEffect(() => {
    active.current = true; busy.current = false; submission.current = false
    blockedReads.current = false; verificationLocked.current = false; autoStarted.current = false
    latest.current = null
    const currentRun = ++run.current
    void Promise.resolve().then(async () => {
      if (!active.current || run.current !== currentRun) return
      // Consume only after the StrictMode-abandoned setup has been invalidated.
      const verificationReturn = consumeStripeReturn(orderId, userId)
      if (verificationReturn) verificationLocked.current = true
      setSecret(null); setOrder(null); setActionRejected(false); setMessage(null)
      setPhase(orderId ? 'loading' : 'ready')
      if (!orderId) return
      try {
        const next = await getOrder(token, orderId)
        if (!active.current || run.current !== currentRun) return
        if (next.id !== orderId) throw new Error('Unable to read this order.')
        accept(next, verificationReturn)
        if (verificationReturn && !isConfirmed(next) && !isTerminal(next)) void verify()
      } catch (reason) { if (active.current && run.current === currentRun) fail(reason) }
    })
    return () => {
      active.current = false; run.current += 1
      const pending = verificationDelay.current
      if (pending) { window.clearTimeout(pending.timer); pending.resolve(); verificationDelay.current = null }
    }
  }, [accept, fail, orderId, token, userId, verify])

  // Provider recovery is explicit. Read polling never calls a payment mutation.
  const recheck = async () => {
    const current = latest.current
    if (blockedReads.current || !current || !canRecoverPayment(current.paymentWindow) || busy.current || !active.current) return
    busy.current = true; setPhase('waiting'); setSecret(null); setMessage(null)
    const currentRun = ++run.current
    try {
      const next = await recoverPayment(token, current.id)
      if (!active.current || run.current !== currentRun) return
      if (next.id !== current.id) throw new Error('Unable to read this order.')
      accept(isOlderPaymentSnapshot(latest.current, next) ? latest.current! : next)
    } catch (reason) {
      if (active.current && run.current === currentRun) {
        fail(reason)
        if (!(reason instanceof CheckoutApiError) || ![401, 403, 404].includes(reason.status)) setPhase(verificationLocked.current ? 'verification-timeout' : 'pending')
      }
    } finally { if (run.current === currentRun) busy.current = false }
  }

  const prepare = async () => {
    const current = latest.current
    const intended = current?.status === 'PENDING' ? paymentAction(current.paymentWindow) : null
    if (!current || !intended || actionRejected || verificationLocked.current || busy.current || !active.current) return
    busy.current = true; setPhase('preparing'); setSecret(null); setMessage(null)
    const currentRun = ++run.current
    try {
      const next = await getOrder(token, current.id)
      if (!active.current || run.current !== currentRun) return
      if (next.id !== current.id) throw new Error('Unable to read this order.')
      if (isOlderPaymentSnapshot(latest.current, next)) { setActionRejected(true); setPhase('pending'); return }
      accept(next)
      // A changed capability must be reviewed, never silently upgraded to a replacement.
      if (next.status !== 'PENDING' || paymentAction(next.paymentWindow) !== intended) return
      setPhase('preparing')
      const clientSecret = await preparePayment(token, next.id)
      if (!active.current || run.current !== currentRun) return
      // The initiation endpoint is authoritative, but re-read after its handshake
      // so concurrent success/closure cannot mount a stale payment form.
      const after = await getOrder(token, next.id)
      if (!active.current || run.current !== currentRun) return
      if (after.id !== current.id) throw new Error('Unable to read this order.')
      if (isOlderPaymentSnapshot(latest.current, after)) { setActionRejected(true); setPhase('pending'); return }
      accept(after)
      const capability = paymentAction(after.paymentWindow)
      if (after.status === 'PENDING' && (capability === 'resume' || capability === 'provider-check')) {
        setSecret(clientSecret); setPhase('payment')
      }
    } catch (reason) {
      if (!active.current || run.current !== currentRun) return
      setSecret(null); setActionRejected(true)
      if (reason instanceof CheckoutApiError && [401, 403, 404].includes(reason.status)) { fail(reason); return }
      // Never replay an unsuccessful initiation from a generic Retry button.
      // A fresh customer detail may have observed success or changed eligibility.
      try {
        const next = await getOrder(token, current.id)
        if (!active.current || run.current !== currentRun) return
        if (next.id !== current.id) throw new Error('Unable to read this order.', { cause: reason })
        accept(next)
        if ((latest.current && isConfirmed(latest.current))) { setMessage(null); return }
      } catch (readError) {
        if (!active.current || run.current !== currentRun) return
        if (readError instanceof CheckoutApiError && [401, 403, 404].includes(readError.status)) { fail(readError); return }
        setPhase('pending')
      }
      setMessage('Payment setup could not continue. Refresh the order to check the latest payment window before taking another action.')
    } finally { if (run.current === currentRun) busy.current = false }
  }
  const beforeConfirm = async (): Promise<boolean> => {
    const current = latest.current
    if (!current || !secret || busy.current || actionRejected || verificationLocked.current || !active.current) return false
    busy.current = true; submission.current = true; setPhase('submitting')
    const currentRun = ++run.current
    let permitted = false
    try {
      const next = await getOrder(token, current.id)
      if (!active.current || run.current !== currentRun) return false
      if (next.id !== current.id || isOlderPaymentSnapshot(latest.current, next)) {
        setSecret(null); setActionRejected(true); setPhase('pending'); return false
      }
      const clean = parseOrderPayment(next)
      const capability = paymentAction(clean.paymentWindow)
      if (clean.status !== 'PENDING' || !['resume', 'provider-check'].includes(capability ?? '') || capability !== paymentAction(current.paymentWindow)) {
        accept(clean); setSecret(null); return false
      }
      latest.current = clean; setOrder(clean)
      permitted = true
      return true
    } catch (reason) {
      if (active.current && run.current === currentRun) { setSecret(null); setActionRejected(true); fail(reason) }
      return false
    } finally {
      // Retain the hook lock throughout Stripe's SDK promise, not just preflight.
      if (run.current === currentRun && !permitted) { busy.current = false; submission.current = false }
    }
  }
  const submissionSettled = () => {
    if (!active.current || !submission.current) return
    submission.current = false; busy.current = false; setPhase('payment')
  }
  const paymentSubmitted = () => {
    if (!active.current) return
    if (submission.current) { submission.current = false; busy.current = false }
    void verify()
  }
  const restart = () => { clearAttempt(userId); navigateCheckout('/') }
  const reloadOrder = async () => {
    if (!orderId || busy.current || !active.current) return
    busy.current = true; setSecret(null); setPhase('loading'); setMessage(null)
    const currentRun = ++run.current
    try {
      const next = await getOrder(token, orderId)
      if (active.current && run.current === currentRun) {
        if (next.id !== orderId) throw new Error('Unable to read this order.')
        if (isOlderPaymentSnapshot(latest.current, next)) { setPhase(verificationLocked.current ? 'verification-timeout' : 'pending'); return }
        // Only an explicit fresh read of a backend-authorized retry releases a
        // stale verification lock. Resumable alone remains ambiguous after submission.
        const action = paymentAction(next.paymentWindow)
        if (next.status === 'PENDING' && (action === 'replacement' || action === 'provider-check')) verificationLocked.current = false
        accept(next); setActionRejected(false); blockedReads.current = false
        if (verificationLocked.current && !isConfirmed(next) && !isTerminal(next)) {
          setMessage(parsePaymentWindow(latest.current?.paymentWindow)?.state === 'PAID'
            ? 'Payment was recorded, but order confirmation is still pending. Do not pay again.'
            : 'Payment verification is still pending. Do not pay again; check order status later.')
        }
      }
    } catch (reason) { if (active.current && run.current === currentRun) fail(reason) }
    finally { if (run.current === currentRun) busy.current = false }
  }
  // Bounded, read-only status polling on re-entry while financial outcome is pending.
  const windowState = parsePaymentWindow(order?.paymentWindow)?.state
  useEffect(() => {
    if (!orderId || autoStarted.current || !['pending', 'reserved'].includes(phase) || !(['PROCESSING', 'OUTCOME_UNRESOLVED'].includes(windowState ?? '') || (windowState === 'PAID' && order?.status === 'PENDING'))) return
    const timer = window.setTimeout(() => { autoStarted.current = true; void verify() }, 3000)
    return () => window.clearTimeout(timer)
  }, [orderId, windowState, order?.status, phase, verify])
  const resumeAfterVerification = () => {
    if (orderId) {
      void reloadOrder().then(() => { if (verificationLocked.current && !blockedReads.current && active.current) void verify() })
      return
    }
    setMessage(null); setPhase('ready')
  }
  return { conflict, actionRejected, beforeConfirm, submissionSettled, paymentSubmitted, reviewComplete: () => { setConflict(null); setMessage(null); setPhase('ready') }, order, phase, message, secret, attempt, create, prepare, verify, recheck, restart, reloadOrder, resumeAfterVerification }
}
