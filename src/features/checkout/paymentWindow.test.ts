import { describe, expect, it } from 'vitest'
import { canRecoverPayment, isOlderPaymentSnapshot, parsePaymentWindow, paymentAction, paymentMessage, type PaymentWindow } from './paymentWindow'
import { windowFixture } from './paymentWindowFixtures'

const states: PaymentWindow['state'][] = ['INITIAL_PAYMENT', 'CHECKOUT_RESUMABLE', 'PROCESSING', 'OUTCOME_UNRESOLVED', 'RETRY_AVAILABLE', 'RETRY_REQUIRES_PROVIDER_CHECK', 'PAID', 'NOT_PAYABLE']
describe('payment window v1 boundary', () => {
  it.each(states)('preserves the exact %s public contract', state => {
    const value = windowFixture(state)
    expect(parsePaymentWindow(value)).toEqual(value)
    expect(paymentMessage(value)).toBeTruthy()
  })
  it.each([undefined, null, {}, { version: 2 }, { version: '1' }, 'INITIAL_PAYMENT'])('fails closed for missing/unknown contracts: %j', value => {
    expect(parsePaymentWindow(value)).toBeNull(); expect(paymentAction(value)).toBeNull()
    expect(paymentMessage(value)).toContain('unavailable')
  })
  it.each(Object.keys(windowFixture()))('rejects a missing required field: %s', field => {
    const value: Record<string, unknown> = { ...windowFixture() }; delete value[field]
    expect(parsePaymentWindow(value)).toBeNull()
  })
  it.each([
    { evaluatedAt: 'yesterday' }, { evaluatedAt: '2026-02-30T12:00:00Z' }, { paymentDeadline: '2026-10-15' },
    { retryDeadline: undefined }, { mode: 'FUTURE' }, { state: 'FUTURE' }, { reason: 'FUTURE' },
    { initiationEligibility: true }, { resumeEligibility: 'MAYBE' }, { paymentOutcome: 'FAILED' },
    { paymentOutcome: 'SUCCEEDED' }, { reason: 'PAYMENT_SUCCEEDED' }, { mode: 'UNAVAILABLE' },
  ])('rejects malformed or contradictory window fields: %j', fields => {
    expect(parsePaymentWindow({ ...windowFixture(), ...fields })).toBeNull()
  })
  it('does not copy additional secrets or operational diagnostics', () => {
    const window = parsePaymentWindow({ ...windowFixture(), clientSecret: 'private', providerReference: 'private', diagnostics: { private: true } })
    expect(Object.keys(window!)).toHaveLength(10)
    expect(JSON.stringify(window)).not.toContain('private')
  })
  it.each([
    ['INITIAL_PAYMENT', 'initial'], ['CHECKOUT_RESUMABLE', 'resume'], ['RETRY_AVAILABLE', 'replacement'],
    ['RETRY_REQUIRES_PROVIDER_CHECK', 'provider-check'], ['PROCESSING', null], ['OUTCOME_UNRESOLVED', null], ['PAID', null], ['NOT_PAYABLE', null],
  ] as const)('distinguishes %s capability from %s', (state, action) => expect(paymentAction(windowFixture(state))).toBe(action))
  it('does not infer eligibility or final failure from an elapsed deadline', () => {
    expect(paymentAction(windowFixture('CHECKOUT_RESUMABLE', { paymentDeadline: '2000-01-01T00:00:00Z' }))).toBe('resume')
    expect(paymentMessage(windowFixture('PROCESSING'))).toContain('may still succeed')
    expect(paymentMessage(windowFixture('OUTCOME_UNRESOLVED'))).toContain('does not mean payment failed')
    expect(canRecoverPayment(windowFixture('OUTCOME_UNRESOLVED', { reason: 'OTHER_PROVIDER' }))).toBe(false)
  })
  it('ignores older snapshots and never regresses financial success', () => {
    const previous = { id: 41, paymentWindow: windowFixture('PAID') }
    expect(isOlderPaymentSnapshot(previous, { id: 41, paymentWindow: windowFixture('PROCESSING', { evaluatedAt: '2026-10-15T12:01:00Z' }) })).toBe(true)
    expect(isOlderPaymentSnapshot(previous, { id: 41, paymentWindow: windowFixture('PAID', { evaluatedAt: '2026-10-15T11:59:00Z' }) })).toBe(true)
    expect(isOlderPaymentSnapshot(previous, { id: 42, paymentWindow: windowFixture() })).toBe(false)
  })
})

it('retains legacy null-deadline semantics without inventing a local bound', () => {
  const window = windowFixture('INITIAL_PAYMENT', { mode: 'LEGACY', paymentDeadline: null })
  expect(parsePaymentWindow(window)).toEqual(window)
  expect(paymentAction(window)).toBe('initial')
})

// Captured combinations from presentCustomerPaymentWindow's independent
// outcome calculation and early-return branches, rather than invented pairings.
describe('actual backend v1 cross-field combinations', () => {
  it.each([
    ['STRIPE_UNAVAILABLE', 'PENDING'], ['STRIPE_UNAVAILABLE', 'UNPAID'],
    ['INVALID_AMOUNT', 'PENDING'], ['INVALID_AMOUNT', 'UNPAID'],
    ['ADMISSION_UNAVAILABLE', 'UNPAID'], ['ADMISSION_UNAVAILABLE', 'NOT_STARTED'],
    ['ADMISSION_UNAVAILABLE', 'PENDING'], ['OTHER_PROVIDER', 'PENDING'],
    ['OTHER_PROVIDER', 'UNRESOLVED'], ['WINDOW_CLOSED', 'UNRESOLVED'],
  ] as const)('accepts OUTCOME_UNRESOLVED / %s / %s without granting payment', (reason, paymentOutcome) => {
    const value = windowFixture('OUTCOME_UNRESOLVED', { reason, paymentOutcome })
    expect(parsePaymentWindow(value)).toEqual(value); expect(paymentAction(value)).toBeNull()
  })
  it.each(['UNRESOLVED', 'PENDING', 'UNPAID'] as const)('does not invent a local deadline or finality constraint for conditional provider checking (%s)', paymentOutcome => {
    const value = windowFixture('RETRY_REQUIRES_PROVIDER_CHECK', { paymentOutcome, retryDeadline: null })
    expect(parsePaymentWindow(value)).toEqual(value); expect(paymentAction(value)).toBe('provider-check')
  })
  it('still rejects an action grant on unresolved financial information', () => {
    expect(parsePaymentWindow(windowFixture('OUTCOME_UNRESOLVED', { paymentOutcome: 'PENDING', resumeEligibility: 'ELIGIBLE' }))).toBeNull()
  })
})
