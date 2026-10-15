// Shared test data only. Production consumers must never infer a window from compatibility fields.
import type { PaymentWindow } from './paymentWindow'
export function windowFixture(state: PaymentWindow['state'] = 'INITIAL_PAYMENT', overrides: Partial<PaymentWindow> = {}): PaymentWindow {
  const base: PaymentWindow = { version: 1, evaluatedAt: '2026-10-15T12:00:00.000Z', mode: 'MANAGED', state,
    paymentOutcome: 'NOT_STARTED', paymentDeadline: '2026-10-15T12:30:00.000Z', retryDeadline: null,
    resumeEligibility: 'INELIGIBLE', initiationEligibility: 'INELIGIBLE', reason: 'INITIAL_WINDOW_OPEN' }
  const stateFields: Record<PaymentWindow['state'], Partial<PaymentWindow>> = {
    INITIAL_PAYMENT: { initiationEligibility: 'ELIGIBLE' },
    CHECKOUT_RESUMABLE: { paymentOutcome: 'PENDING', resumeEligibility: 'ELIGIBLE', reason: 'EXISTING_CHECKOUT_OPEN' },
    PROCESSING: { paymentOutcome: 'PENDING', reason: 'AWAITING_PAYMENT_OUTCOME' },
    OUTCOME_UNRESOLVED: { paymentOutcome: 'UNRESOLVED', reason: 'PAYMENT_OUTCOME_UNRESOLVED' },
    RETRY_AVAILABLE: { paymentOutcome: 'UNPAID', initiationEligibility: 'ELIGIBLE', retryDeadline: '2026-10-15T13:00:00.000Z', paymentDeadline: '2026-10-15T13:00:00.000Z', reason: 'VERIFIED_UNPAID_RETRY' },
    RETRY_REQUIRES_PROVIDER_CHECK: { paymentOutcome: 'UNRESOLVED', initiationEligibility: 'REQUIRES_PROVIDER_CHECK', resumeEligibility: 'REQUIRES_PROVIDER_CHECK', retryDeadline: '2026-10-15T13:00:00.000Z', paymentDeadline: '2026-10-15T13:00:00.000Z', reason: 'PROVIDER_CHECK_REQUIRED' },
    PAID: { paymentOutcome: 'SUCCEEDED', reason: 'PAYMENT_SUCCEEDED' },
    NOT_PAYABLE: { reason: 'ORDER_NOT_PENDING' },
  }
  return { ...base, ...stateFields[state], ...overrides }
}

/** Supply windows to older regression fixtures; not a runtime compatibility fallback. */
export function customerOrderFixture<T extends { status: string; payment?: { status: string } | null }>(order: T): T & { paymentWindow: PaymentWindow } {
  const state = order.payment?.status === 'SUCCEEDED' ? 'PAID' : ['CONFIRMED', 'DISPATCHED', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'RETURNED'].includes(order.status) ? 'NOT_PAYABLE' : order.payment?.status === 'PROCESSING' || order.payment?.status === 'PENDING' ? 'CHECKOUT_RESUMABLE' : order.payment?.status === 'FAILED' || order.payment?.status === 'CANCELED' ? 'OUTCOME_UNRESOLVED' : 'INITIAL_PAYMENT'
  return { ...order, paymentWindow: windowFixture(state) }
}
