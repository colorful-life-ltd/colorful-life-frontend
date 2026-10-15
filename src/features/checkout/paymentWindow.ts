export type PaymentEligibility = 'ELIGIBLE' | 'INELIGIBLE' | 'REQUIRES_PROVIDER_CHECK'
export type PaymentWindow = {
  version: 1
  evaluatedAt: string
  mode: 'LEGACY' | 'MANAGED' | 'UNAVAILABLE'
  state: 'INITIAL_PAYMENT' | 'CHECKOUT_RESUMABLE' | 'PROCESSING' | 'OUTCOME_UNRESOLVED' | 'RETRY_AVAILABLE' | 'RETRY_REQUIRES_PROVIDER_CHECK' | 'PAID' | 'NOT_PAYABLE'
  paymentOutcome: 'NOT_STARTED' | 'PENDING' | 'UNRESOLVED' | 'SUCCEEDED' | 'UNPAID'
  paymentDeadline: string | null
  retryDeadline: string | null
  resumeEligibility: PaymentEligibility
  initiationEligibility: PaymentEligibility
  reason: 'EXISTING_CHECKOUT_OPEN' | 'INITIAL_WINDOW_OPEN' | 'AWAITING_PAYMENT_OUTCOME' | 'PAYMENT_OUTCOME_UNRESOLVED' | 'PROVIDER_CHECK_REQUIRED' | 'VERIFIED_UNPAID_RETRY' | 'PAYMENT_SUCCEEDED' | 'ORDER_NOT_PENDING' | 'WINDOW_CLOSED' | 'ADMISSION_UNAVAILABLE' | 'STRIPE_UNAVAILABLE' | 'INVALID_AMOUNT' | 'OTHER_PROVIDER'
}
const states = ['INITIAL_PAYMENT', 'CHECKOUT_RESUMABLE', 'PROCESSING', 'OUTCOME_UNRESOLVED', 'RETRY_AVAILABLE', 'RETRY_REQUIRES_PROVIDER_CHECK', 'PAID', 'NOT_PAYABLE']
const reasons = ['EXISTING_CHECKOUT_OPEN', 'INITIAL_WINDOW_OPEN', 'AWAITING_PAYMENT_OUTCOME', 'PAYMENT_OUTCOME_UNRESOLVED', 'PROVIDER_CHECK_REQUIRED', 'VERIFIED_UNPAID_RETRY', 'PAYMENT_SUCCEEDED', 'ORDER_NOT_PENDING', 'WINDOW_CLOSED', 'ADMISSION_UNAVAILABLE', 'STRIPE_UNAVAILABLE', 'INVALID_AMOUNT', 'OTHER_PROVIDER']
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,3})?Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 19) === v.slice(0, 19)
const oneOf = (v: unknown, values: readonly string[]) => typeof v === 'string' && values.includes(v)

/** Reject incomplete, unknown and contradictory capabilities. No legacy payment permission. */
export function parsePaymentWindow(value: unknown): PaymentWindow | null {
  if (!value || typeof value !== 'object') return null
  const w = value as Record<string, unknown>
  if (w.version !== 1 || !date(w.evaluatedAt) || !oneOf(w.mode, ['LEGACY', 'MANAGED', 'UNAVAILABLE']) ||
    !oneOf(w.state, states) || !oneOf(w.reason, reasons) || !oneOf(w.paymentOutcome, ['NOT_STARTED', 'PENDING', 'UNRESOLVED', 'SUCCEEDED', 'UNPAID']) ||
    !(w.paymentDeadline === null || date(w.paymentDeadline)) || !(w.retryDeadline === null || date(w.retryDeadline)) ||
    !oneOf(w.resumeEligibility, ['ELIGIBLE', 'INELIGIBLE', 'REQUIRES_PROVIDER_CHECK']) || !oneOf(w.initiationEligibility, ['ELIGIBLE', 'INELIGIBLE', 'REQUIRES_PROVIDER_CHECK'])) return null
  const p = w as unknown as PaymentWindow
  const expectedReason: Partial<Record<PaymentWindow['state'], PaymentWindow['reason']>> = { INITIAL_PAYMENT: 'INITIAL_WINDOW_OPEN', CHECKOUT_RESUMABLE: 'EXISTING_CHECKOUT_OPEN', PROCESSING: 'AWAITING_PAYMENT_OUTCOME', RETRY_AVAILABLE: 'VERIFIED_UNPAID_RETRY', RETRY_REQUIRES_PROVIDER_CHECK: 'PROVIDER_CHECK_REQUIRED', PAID: 'PAYMENT_SUCCEEDED' }
  if (expectedReason[p.state] && p.reason !== expectedReason[p.state]) return null
  const noActions = p.resumeEligibility === 'INELIGIBLE' && p.initiationEligibility === 'INELIGIBLE'
  if (p.state === 'INITIAL_PAYMENT' && !(p.paymentOutcome === 'NOT_STARTED' && p.initiationEligibility === 'ELIGIBLE' && p.resumeEligibility === 'INELIGIBLE')) return null
  if (p.state === 'CHECKOUT_RESUMABLE' && !(p.paymentOutcome === 'PENDING' && p.resumeEligibility === 'ELIGIBLE' && p.initiationEligibility === 'INELIGIBLE')) return null
  if (p.state === 'RETRY_AVAILABLE' && !(p.mode === 'MANAGED' && p.retryDeadline && p.paymentOutcome === 'UNPAID' && p.initiationEligibility === 'ELIGIBLE' && p.resumeEligibility === 'INELIGIBLE')) return null
  if (p.state === 'RETRY_REQUIRES_PROVIDER_CHECK' && !(p.mode === 'MANAGED' && p.resumeEligibility === 'REQUIRES_PROVIDER_CHECK' && p.initiationEligibility === 'REQUIRES_PROVIDER_CHECK')) return null
  if (['PROCESSING', 'OUTCOME_UNRESOLVED', 'PAID', 'NOT_PAYABLE'].includes(p.state) && !noActions) return null
  if ((p.state === 'PAID') !== (p.paymentOutcome === 'SUCCEEDED')) return null
  if (p.state === 'PROCESSING' && p.paymentOutcome !== 'PENDING') return null
  if (p.mode === 'UNAVAILABLE' && !noActions) return null
  // Return only the public contract fields, never extra provider diagnostics/secrets.
  return { version: 1, evaluatedAt: p.evaluatedAt, mode: p.mode, state: p.state, paymentOutcome: p.paymentOutcome,
    paymentDeadline: p.paymentDeadline, retryDeadline: p.retryDeadline, resumeEligibility: p.resumeEligibility,
    initiationEligibility: p.initiationEligibility, reason: p.reason }
}
export type PaymentAction = 'initial' | 'resume' | 'replacement' | 'provider-check'
export function paymentAction(value: unknown): PaymentAction | null {
  const w = parsePaymentWindow(value)
  if (!w) return null
  switch (w.state) {
    case 'INITIAL_PAYMENT': return 'initial'
    case 'CHECKOUT_RESUMABLE': return 'resume'
    case 'RETRY_AVAILABLE': return 'replacement'
    case 'RETRY_REQUIRES_PROVIDER_CHECK': return 'provider-check'
    default: return null
  }
}
export function paymentMessage(value: unknown): string {
  const w = parsePaymentWindow(value)
  if (!w) return 'Payment information is unavailable. Refresh the order or try again later. Do not start another payment while its outcome is unknown.'
  switch (w.state) {
    case 'INITIAL_PAYMENT': return 'Your order is ready for an initial payment. Review the final total before continuing.'
    case 'CHECKOUT_RESUMABLE': return 'An existing Stripe checkout can be resumed. We will check that same payment before showing the next step.'
    case 'PROCESSING': return 'Your payment is processing. It may still succeed after the payment window closes. Do not start another payment.'
    case 'OUTCOME_UNRESOLVED': return 'Your payment outcome is unresolved. This does not mean payment failed. Wait or check its status; do not start another payment.'
    case 'RETRY_AVAILABLE': return 'The previous payment is verified unpaid. A replacement payment is available, subject to a fresh eligibility check.'
    case 'RETRY_REQUIRES_PROVIDER_CHECK': return 'Stripe must check the existing payment before another attempt can continue. A retry is not yet guaranteed.'
    case 'PAID': return 'Payment has been recorded. Order confirmation and fulfilment are shown separately.'
    case 'NOT_PAYABLE': return w.paymentOutcome === 'UNRESOLVED' ? 'This order cannot accept payment. Its earlier payment outcome remains unresolved; do not pay again.' : 'This order is not currently payable. Refresh the order for its latest status.'
  }
}
export function paymentActionLabel(value: unknown): string {
  switch (paymentAction(value)) {
    case 'initial': return 'Continue to secure payment'
    case 'resume': return 'Resume existing Stripe checkout'
    case 'replacement': return 'Start verified-unpaid replacement payment'
    case 'provider-check': return 'Check existing payment with Stripe'
    default: return 'Payment unavailable'
  }
}
export const canRecoverPayment = (value: unknown) => {
  const w = parsePaymentWindow(value)
  return !!w && w.reason !== 'OTHER_PROVIDER' && ['CHECKOUT_RESUMABLE', 'PROCESSING', 'OUTCOME_UNRESOLVED', 'RETRY_REQUIRES_PROVIDER_CHECK'].includes(w.state)
}

/** Compare only snapshots of the same owned order. Financial success never regresses. */
export function isOlderPaymentSnapshot(previous: { id: number; paymentWindow?: PaymentWindow | null } | null, next: { id: number; paymentWindow?: PaymentWindow | null }): boolean {
  if (!previous || previous.id !== next.id) return false
  const a = parsePaymentWindow(previous.paymentWindow), b = parsePaymentWindow(next.paymentWindow)
  return !!a && ((a.state === 'PAID' && b?.state !== 'PAID') || (!!b && Date.parse(b.evaluatedAt) < Date.parse(a.evaluatedAt)))
}
