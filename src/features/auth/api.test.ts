import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AUTH_STORAGE_KEY, SIGN_IN_MESSAGES, clearStoredToken, getCurrentUser, isVerificationRequired, resendVerification, signIn, signUp, storeToken, updateCurrentUser, verifyEmail } from './api'

describe('anonymous sign-in failure messages', () => {
  beforeEach(() => vi.restoreAllMocks())
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
  const html = (status: number, title: string) => new Response(`<html><head><title>${title}</title></head><body><center><h1>${title}</h1></center><hr><center>nginx</center></body></html>`, { status, headers: { 'Content-Type': 'text/html' } })
  const attempt = async (response: Response | (() => Promise<Response>)) => {
    vi.stubGlobal('fetch', vi.fn(typeof response === 'function' ? response : () => Promise.resolve(response)))
    try { await signIn('person@example.com', 'Secret-123'); throw new Error('expected rejection') } catch (error) { return error as { status: number; message: string; code?: string } }
  }

  it.each([
    ['401 invalid credentials (unknown email and wrong password are identical)', json(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid credentials' } }), SIGN_IN_MESSAGES.invalidCredentials],
    ['429 from the shared abuse limiter (checkout-worded text is not echoed)', json(429, { error: { code: 'CHECKOUT_RATE_LIMITED', message: 'Checkout temporarily unavailable. Please wait and try again, or contact support.' } }), SIGN_IN_MESSAGES.rateLimited],
    ['429 from the edge rate limit (HTML)', html(429, '429 Too Many Requests'), SIGN_IN_MESSAGES.rateLimited],
    ['400 invalid input (validation object, no message)', json(400, { error: { _errors: [], email: { _errors: ['Invalid email'] } } }), SIGN_IN_MESSAGES.invalidInput],
    ['403 edge restriction (HTML, no JSON code)', html(403, '403 Forbidden'), SIGN_IN_MESSAGES.unavailable],
    ['502 retired upstream (HTML)', html(502, '502 Bad Gateway'), SIGN_IN_MESSAGES.unavailable],
    ['503 protection store unavailable (checkout-worded JSON)', json(503, { error: { code: 'CHECKOUT_PROTECTION_UNAVAILABLE', message: 'Checkout temporarily unavailable. Please wait and try again, or contact support.' } }), SIGN_IN_MESSAGES.unavailable],
    ['504 gateway timeout (HTML)', html(504, '504 Gateway Time-out'), SIGN_IN_MESSAGES.unavailable],
    ['500 internal error', json(500, { error: { code: 'INTERNAL_SERVER_ERROR', message: 'Internal server error' } }), SIGN_IN_MESSAGES.unavailable],
  ])('%s', async (_label, response, message) => {
    const error = await attempt(response)
    expect(error.message).toBe(message)
    expect(error.message).not.toMatch(/checkout|nginx|Forbidden|Bad Gateway|person@example\.com|Secret-123/i)
  })

  it('maps a network failure to temporary unavailability instead of browser text', async () => {
    const error = await attempt(() => Promise.reject(new TypeError('Failed to fetch')))
    expect(error).toMatchObject({ status: 0, message: SIGN_IN_MESSAGES.unavailable })
  })

  it('keeps email-verification handling for a 403 that carries the JSON code', async () => {
    const error = await attempt(json(403, { error: { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Email verification required' } }))
    expect(error.message).toBe('Email verification required')
    expect(isVerificationRequired(error)).toBe(true)
  })

  it('leaves other anonymous requests on their existing messages', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json(400, { error: 'Invalid or expired verification token' })))
    await expect(verifyEmail('verification-token')).rejects.toMatchObject({ status: 400, message: 'Invalid or expired verification token' })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))
    await expect(signUp('person@example.com', 'Abcdef1!')).rejects.toThrow('Failed to fetch')
  })
})

describe('storefront auth API', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('signs up with only the backend fields', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'signup-token' }), { status: 201 }))
    vi.stubGlobal('fetch', fetcher)
    await signUp('person@example.com', 'Abcdef1!')
    expect(fetcher).toHaveBeenCalledWith('/api/auth/signup', expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'person@example.com', password: 'Abcdef1!' }) }))
  })

  it('logs in with email and password', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ token: 'login-token', refreshToken: 'r'.repeat(43), accessTokenExpiresAt: '2030-01-01T00:00:00Z', refreshExpiresAt: '2030-02-01T00:00:00Z' }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await signIn('person@example.com', 'Abcdef1!')
    expect(fetcher.mock.calls[0][1]).toEqual(expect.objectContaining({ body: JSON.stringify({ email: 'person@example.com', password: 'Abcdef1!' }) }))
  })

  it('loads the current user with a bearer token', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 1, email: 'person@example.com', firstName: null, lastName: null, phone: null }), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await getCurrentUser('jwt-token')
    expect((fetcher.mock.calls[0][1] as RequestInit).headers).toBeInstanceOf(Headers)
    expect(((fetcher.mock.calls[0][1] as RequestInit).headers as Headers).get('Authorization')).toBe('Bearer jwt-token')
  })

  it('maps backend errors without exposing credentials', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 })))
    await expect(signIn('person@example.com', 'secret')).rejects.toMatchObject({ status: 401, message: SIGN_IN_MESSAGES.invalidCredentials })
  })

  it('patches only editable profile fields and sends the bearer token', async () => {
    const response = { id: 1, email: 'person@example.com', firstName: 'Ada', lastName: 'Lovelace', phone: '' }
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify(response), { status: 200 }))
    vi.stubGlobal('fetch', fetcher)
    await updateCurrentUser('jwt-token', { firstName: 'Ada', lastName: 'Lovelace', phone: '' })
    expect(fetcher).toHaveBeenCalledWith('/api/users/me', expect.objectContaining({
      method: 'PATCH', body: JSON.stringify({ firstName: 'Ada', lastName: 'Lovelace', phone: '' }),
    }))
    expect((fetcher.mock.calls[0][1].headers as Headers).get('Authorization')).toBe('Bearer jwt-token')
  })

  it('uses the project-scoped session storage key', () => {
    const storage = { setItem: vi.fn(), removeItem: vi.fn(), getItem: vi.fn() }
    vi.stubGlobal('window', { sessionStorage: storage })
    storeToken('jwt-token')
    clearStoredToken()
    expect(storage.setItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY, 'jwt-token')
    expect(storage.removeItem).toHaveBeenCalledWith(AUTH_STORAGE_KEY)
  })
})


describe('email verification HTTP contracts', () => {
  it('submits only the verification token and uses Bearer auth for resend without a body', async () => {
    const fetcher = vi.fn().mockImplementation(() => Promise.resolve(new Response('{}')))
    vi.stubGlobal('fetch', fetcher)
    await verifyEmail('verification-token')
    expect(fetcher).toHaveBeenCalledWith('/api/auth/verify-email', expect.objectContaining({ method: 'POST', body: JSON.stringify({ token: 'verification-token' }) }))
    await resendVerification('jwt')
    expect(fetcher.mock.calls[1][0]).toBe('/api/auth/resend-verification')
    expect(fetcher.mock.calls[1][1].headers.get('Authorization')).toBe('Bearer jwt')
    expect(fetcher.mock.calls[1][1].body).toBeUndefined()
  })
  it('parses nested codes/messages and recognizes verification with different wording', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Please confirm this address' } }), { status: 403 })))
    const error = await getCurrentUser('jwt').catch(error => error)
    expect(error).toMatchObject({ status: 403, code: 'EMAIL_VERIFICATION_REQUIRED', serverMessage: 'Please confirm this address' })
    expect(isVerificationRequired(error)).toBe(true)
  })
  it('does not misclassify unrelated 403 errors as verification', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Access denied' } }), { status: 403 })))
    const error = await getCurrentUser('jwt').catch(error => error)
    expect(error.message).toBe('Access denied'); expect(isVerificationRequired(error)).toBe(false)
  })
  it('retains compatibility with legacy string verification errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: 'Email verification required' }), { status: 403 })))
    expect(isVerificationRequired(await getCurrentUser('jwt').catch(error => error))).toBe(true)
  })
})
