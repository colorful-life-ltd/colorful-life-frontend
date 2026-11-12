// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { captureVerificationToken, capturedVerificationToken, forgetVerificationToken } from './verificationToken'

afterEach(() => { forgetVerificationToken(); history.replaceState({}, '', '/') })

describe('early verification-token capture', () => {
  it('removes the token from the URL before rendering while retaining only an in-memory copy', () => {
    history.replaceState({ keep: true }, '', '/verify-email?token=synthetic-secret&next=account#part')
    captureVerificationToken()
    expect(location.search).toBe('?next=account')
    expect(capturedVerificationToken()).toBe('synthetic-secret')
    expect(JSON.stringify(history.state)).not.toContain('synthetic-secret')
    expect(JSON.stringify(sessionStorage)).not.toContain('synthetic-secret')
    captureVerificationToken()
    expect(capturedVerificationToken()).toBe('synthetic-secret')
  })
  it('does not reuse a token when a different history entry has no token', () => {
    history.replaceState({}, '', '/verify-email?token=old-token')
    captureVerificationToken()
    history.pushState({}, '', '/verify-email')
    expect(capturedVerificationToken()).toBe('')
  })
})
