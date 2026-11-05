// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkBundle } from './check-sandbox-bundle.mjs'

const KEY = 'pk_test_OnlyPublicSynthetic123456'
let dir

function bundle(files) {
  dir = mkdtempSync(join(tmpdir(), 'sandbox-bundle-'))
  for (const [name, text] of Object.entries({ 'index.html': '<div id="root"></div>', ...files })) {
    mkdirSync(dirname(join(dir, name)), { recursive: true })
    writeFileSync(join(dir, name), text)
  }
  return dir
}

afterEach(() => rmSync(dir, { recursive: true, force: true }))

describe('Sandbox bundle check', () => {
  it('passes a Stripe Sandbox build that embeds only the exact Test publishable key', () => {
    const app = `const key="${KEY}";for(const e of["payment_intent","payment_intent_client_secret"])u.searchParams.delete(e)`
    expect(checkBundle(bundle({ 'assets/index.js': app }), 'stripe-sandbox', KEY)).toEqual([])
  })

  it.each([
    ['sk_live_' + 'a1B2c3D4e5F6', 'Stripe secret'],
    ['pk_live_' + 'a1B2c3D4e5F6', 'Stripe Live publishable'],
    ['whsec_' + 'a1B2c3D4e5F6g7', 'webhook signing secret'],
    ['AKIA' + 'ABCDEFGHIJKLMNOP', 'AWS access key'],
    ['-----BEGIN ' + 'PRIVATE KEY-----', 'private key'],
    ['PAYPAL_CLIENT' + '_SECRET', 'PayPal client secret variable'],
    ['https://www.paypal.com/' + 'sdk/js', 'retired PayPal SDK loader'],
    ['client_secret:"' + 'EKx9secretvalue1234567"', 'assigned client secret'],
  ])('rejects %s', (secret, label) => {
    const problems = checkBundle(bundle({ 'assets/index.js': `const key="${KEY}";const s='${secret}'` }), 'stripe-sandbox', KEY)
    expect(problems.join('\n')).toContain(label)
    expect(problems.join('\n')).not.toContain(secret)
  })

  it('requires the Stripe Sandbox mode and a well-formed Test key that is actually embedded', () => {
    const app = { 'assets/index.js': `const key="${KEY}"` }
    for (const mode of [undefined, '', 'paypal-sandbox', 'stripe-live']) expect(checkBundle(bundle(app), mode, KEY)).toContain('Invalid Sandbox payment mode')
    expect(checkBundle(bundle(app), 'stripe-sandbox', '')).toContain('Stripe Test publishable key is missing or malformed')
    expect(checkBundle(bundle(app), 'stripe-sandbox', 'pk_live_OnlyPublicSynthetic123456')).toContain('Stripe Test publishable key is missing or malformed')
    expect(checkBundle(bundle({ 'assets/index.js': 'x' }), 'stripe-sandbox', KEY)).toContain('Stripe Test publishable key is not embedded in the build')
  })

  it('rejects hidden files, source maps and a missing index', () => {
    const problems = checkBundle(bundle({ 'assets/index.js': KEY, '.env': 'X=1', 'assets/index.js.map': '{}' }), 'stripe-sandbox', KEY)
    expect(problems).toContain('hidden file in bundle: .env')
    expect(problems).toContain('source map in bundle: assets/index.js.map')
    rmSync(join(dir, 'index.html'))
    expect(checkBundle(dir, 'stripe-sandbox', KEY)).toEqual(['index.html is missing'])
  })
})
