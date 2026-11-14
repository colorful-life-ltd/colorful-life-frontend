import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { AccountForms, AccountView } from './AccountForms'

// Exercises the open-registration form (Production now defaults to closed; see RegistrationClosedDialog.test.tsx).
vi.mock('../../features/checkout/sandbox', async original => ({ ...await original<typeof import('../../features/checkout/sandbox')>(), registrationAvailable: true }))

describe('account experience', () => {
  it('opens with one sign-in task, labelled credentials and a registration switch', () => {
    const markup = renderToStaticMarkup(<AccountForms />)
    expect(markup.match(/<form\b/g)).toHaveLength(1)
    expect(markup.match(/<input\b/g)).toHaveLength(2)
    expect(markup).toContain('Welcome back!')
    expect(markup).toContain('type="password"')
    expect(markup).toContain('aria-label="Show password"')
    expect(markup).toContain('autoComplete="current-password"')
    expect(markup).toContain('for="account-signin-email"')
    expect(markup).toContain('Create Account')
    expect(markup).not.toContain('confirmPassword')
  })

  it('collects only the email in the registration form: the password is chosen from the verification link', () => {
    const markup = renderToStaticMarkup(<AccountView mode="create" onModeChange={() => {}} />)
    expect(markup.match(/<form\b/g)).toHaveLength(1)
    expect(markup.match(/<input\b/g)).toHaveLength(1)
    expect(markup).toContain('<label for="account-create-email">Email</label>')
    expect(markup).toContain('autoComplete="email"')
    expect(markup).not.toContain('type="password"')
    expect(markup).not.toContain('new-password')
    expect(markup).toContain('we’ll send you a link to choose your password')
    expect(markup).not.toMatch(/first.?name|last.?name|given-name|family-name/i)
    expect([...markup.matchAll(/<input\b[^>]*\bname="([^"]+)"/g)].map((match) => match[1])).toEqual(['email'])
    expect(markup).not.toContain('account-signin-')
  })

})
