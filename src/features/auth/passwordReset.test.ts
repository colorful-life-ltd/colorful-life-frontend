// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import mainSource from '../../main.tsx?raw'
import indexHtml from '../../../index.html?raw'
import { AuthApiError } from './api'
import { capturedResetToken, captureResetToken, forgetResetToken, isInvalidResetToken, isResetPasswordPath, requestPasswordReset, submitPasswordReset } from './passwordReset'

const meta = (name: string) => [...document.head.querySelectorAll<HTMLMetaElement>(`meta[name="${name}"]`)].at(-1)?.content
let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  document.head.innerHTML = ''
  forgetResetToken()
  fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ message: 'ok' }), { status: 200 })))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); history.replaceState(null, '', '/') })

describe('reset token capture', () => {
  it('moves the token into memory and removes it from the URL and current history entry', () => {
    history.replaceState({ kept: true }, '', '/reset-password?token=abc123&utm=mail#top')
    const setItem = vi.spyOn(Storage.prototype, 'setItem')
    captureResetToken()
    expect(capturedResetToken()).toBe('abc123')
    expect(location.pathname + location.search + location.hash).toBe('/reset-password?utm=mail#top')
    expect(location.href).not.toContain('abc123')
    expect(history.state).toEqual({ kept: true })
    expect(setItem).not.toHaveBeenCalled()
  })

  it('stops the reset page sending referrers and keeps it out of search results', () => {
    history.replaceState(null, '', '/reset-password/?token=abc')
    captureResetToken()
    expect(meta('referrer')).toBe('no-referrer')
    expect(meta('robots')).toBe('noindex,nofollow')
    expect(location.search).toBe('')
  })

  it('protects the page even when the link has no token', () => {
    history.replaceState(null, '', '/reset-password')
    captureResetToken()
    expect(capturedResetToken()).toBe('')
    expect(meta('referrer')).toBe('no-referrer')
  })

  it('ignores token parameters on every other route', () => {
    for (const path of ['/verify-email?token=verify', '/?token=x', '/checkout?token=y', '/reset-password-help?token=z']) {
      history.replaceState(null, '', path)
      captureResetToken()
      expect(location.pathname + location.search).toBe(path)
    }
    expect(capturedResetToken()).toBe('')
    expect(meta('referrer')).toBeUndefined()
  })

  it('keeps referrers to the origin before any static asset loads', () => {
    const head = indexHtml.slice(0, indexHtml.indexOf('</head>'))
    const policy = head.indexOf('<meta name="referrer" content="strict-origin" />')
    expect(policy).toBeGreaterThan(-1)
    for (const tag of ['<script', '<link']) expect(head.indexOf(tag) === -1 || head.indexOf(tag) > policy).toBe(true)
  })

  it('runs before every other application module', () => {
    const firstImport = mainSource.match(/^import .+$/m)?.[0]
    expect(firstImport).toBe("import './features/auth/captureResetToken'")
  })

  it('treats the reset path with or without trailing slashes as the same route', () => {
    for (const path of ['/reset-password', '/reset-password/', '/reset-password//']) expect(isResetPasswordPath(path)).toBe(true)
    for (const path of ['/reset-password-help', '/reset-password/extra', '/account/reset-password', '/']) expect(isResetPasswordPath(path)).toBe(false)
  })

  it('forgets the token on demand', () => {
    history.replaceState(null, '', '/reset-password?token=abc')
    captureResetToken()
    forgetResetToken()
    expect(capturedResetToken()).toBe('')
  })
})

describe('password reset API contract', () => {
  it('requests a reset with only the trimmed email and no credentials', async () => {
    await requestPasswordReset('  customer@example.com ')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/forgot-password')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ email: 'customer@example.com' })
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
  })

  it('submits the token and new password to the reset endpoint', async () => {
    await submitPasswordReset('tok', 'N3w-password!')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/auth/reset-password')
    expect(JSON.parse(init.body as string)).toEqual({ token: 'tok', newPassword: 'N3w-password!' })
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
  })

  it('recognises only the backend invalid-token rejection as an unusable link', () => {
    expect(isInvalidResetToken(new AuthApiError(400, 'x', 'Invalid or expired password reset token'))).toBe(true)
    expect(isInvalidResetToken(new AuthApiError(400, 'x'))).toBe(false)
    expect(isInvalidResetToken(new AuthApiError(500, 'x', 'Invalid or expired password reset token'))).toBe(false)
    expect(isInvalidResetToken(new Error('offline'))).toBe(false)
  })
})
