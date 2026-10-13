// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ForgotPasswordView } from './AccountForms'
import { clearResetRequestCooldown, RESET_REQUEST_COOLDOWN_SECONDS } from '../../features/auth/passwordReset'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const GENERIC = 'If an account exists for that email, we’ve sent a password reset link.'
let root: Root | undefined
let container: HTMLDivElement
let fetchMock: ReturnType<typeof vi.fn>
const respond = (status: number, body: unknown = {}) => Promise.resolve(new Response(JSON.stringify(body), { status }))

async function mount() {
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root!.render(<ForgotPasswordView initialEmail="someone@example.com" onBack={vi.fn()} />))
}
async function unmount() { await act(async () => root?.unmount()); root = undefined; container.remove() }
const submitButton = () => container.querySelector<HTMLButtonElement>('button.account-form__submit')!
const live = () => container.querySelector('#account-forgot-cooldown')!.textContent
const text = () => container.textContent ?? ''
const submitForm = () => act(async () => { container.querySelector('form')!.requestSubmit() })
const tick = (ms: number) => act(async () => { vi.advanceTimersByTime(ms) })

beforeEach(() => {
  vi.useFakeTimers()
  clearResetRequestCooldown()
  fetchMock = vi.fn(() => respond(200, { message: 'If an account exists, a password reset email has been sent' }))
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(async () => { await unmount(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.innerHTML = '' })

describe('pending request', () => {
  it('sends exactly one request however often the button is pressed while pending', async () => {
    let finish!: () => void
    fetchMock.mockImplementationOnce(() => new Promise<Response>(resolve => { finish = () => resolve(new Response('{}', { status: 200 })) }))
    await mount()
    await act(async () => { for (let i = 0; i < 5; i += 1) submitButton().click() })
    await submitForm()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(submitButton().disabled).toBe(true)
    expect(submitButton().textContent).toBe('Please wait…')
    await act(async () => finish())
    expect(text()).toContain(GENERIC)
  })
})

describe('60-second courtesy cooldown after the generic confirmation', () => {
  async function sendOnce() {
    await mount()
    await submitForm()
    expect(text()).toContain(GENERIC)
  }

  it('shows an accessible countdown and ignores repeated clicks', async () => {
    await sendOnce()
    const again = submitButton()
    expect(again.disabled).toBe(true)
    expect(again.textContent).toBe(`Send another link in ${RESET_REQUEST_COOLDOWN_SECONDS}s`)
    expect(again.getAttribute('aria-describedby')).toBe('account-forgot-cooldown')
    expect(container.querySelector('#account-forgot-cooldown')!.getAttribute('aria-live')).toBe('polite')
    expect(live()).toBe('You can request another link in 60 seconds.')
    await act(async () => { for (let i = 0; i < 5; i += 1) again.click() })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('counts down visibly without re-announcing every second', async () => {
    await sendOnce()
    await tick(1000)
    expect(submitButton().textContent).toBe('Send another link in 59s')
    await tick(30_000)
    expect(submitButton().textContent).toBe('Send another link in 29s')
    expect(live()).toBe('You can request another link in 60 seconds.')
  })

  it('re-enables after 60 seconds, announces it, and allows a new request', async () => {
    await sendOnce()
    await tick(59_000)
    expect(submitButton().disabled).toBe(true)
    await tick(1000)
    expect(submitButton().disabled).toBe(false)
    expect(submitButton().textContent).toBe('Send another link')
    expect(live()).toBe('You can request another link now.')
    await act(async () => submitButton().click())
    const email = container.querySelector<HTMLInputElement>('#account-forgot-email')!
    expect(email.value).toBe('someone@example.com')
    expect(document.activeElement).toBe(email)
    await submitForm()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(text()).toContain(GENERIC)
    expect(submitButton().textContent).toBe('Send another link in 60s')
  })

  it('keeps the cooldown when the form is closed and reopened', async () => {
    await sendOnce()
    await tick(15_000)
    await unmount()
    await mount()
    expect(submitButton().disabled).toBe(true)
    expect(submitButton().textContent).toBe('Send reset link in 45s')
    expect(live()).toBe('You can request another link in 45 seconds.')
    await submitForm()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await tick(45_000)
    expect(submitButton().disabled).toBe(false)
    await submitForm()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('error handling never reveals whether an account exists', () => {
  it('treats HTTP 429 as a generic rate limit and pauses further requests', async () => {
    fetchMock.mockImplementationOnce(() => respond(429, { error: 'Too many requests. Please try again later.' }))
    await mount()
    await submitForm()
    expect(text()).toContain('Too many reset requests. Please wait a while before trying again.')
    expect(text()).not.toContain(GENERIC)
    expect(container.querySelector<HTMLInputElement>('#account-forgot-email')!.value).toBe('someone@example.com')
    expect(submitButton().disabled).toBe(true)
    await submitForm()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await tick(RESET_REQUEST_COOLDOWN_SECONDS * 1000)
    expect(submitButton().disabled).toBe(false)
  })

  it('treats HTTP 503 as a temporary outage and allows an immediate retry', async () => {
    fetchMock.mockImplementationOnce(() => respond(503, { error: 'Password recovery temporarily unavailable' }))
    await mount()
    await submitForm()
    expect(text()).toContain('Password reset is temporarily unavailable. Please try again in a few minutes.')
    expect(text()).not.toContain(GENERIC)
    expect(submitButton().disabled).toBe(false)
    await submitForm()
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(text()).toContain(GENERIC)
  })

  it('does not start a cooldown after a network failure', async () => {
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('offline')))
    await mount()
    await submitForm()
    expect(text()).toContain('We couldn’t send your request. Please try again.')
    expect(submitButton().disabled).toBe(false)
    expect(live()).toBe('')
  })

  it.each([429, 503, 500])('keeps HTTP %s messages free of backend details and account hints', async status => {
    fetchMock.mockImplementationOnce(() => respond(status, { error: 'no account for someone@example.com' }))
    await mount()
    await submitForm()
    expect(text()).not.toMatch(/no account|not found|does not exist|someone@example\.com is/i)
    expect(container.querySelector('[role="alert"]')).not.toBeNull()
  })
})
