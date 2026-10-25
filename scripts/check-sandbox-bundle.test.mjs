// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { checkBundle } from './check-sandbox-bundle.mjs'

const CLIENT_ID = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789'
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
  it('passes a Sandbox build that embeds only the public Client ID', () => {
    const app = `const id="${CLIENT_ID}";for(const e of["payment_intent","payment_intent_client_secret"])u.searchParams.delete(e)`
    expect(checkBundle(bundle({ 'assets/index.js': app }), CLIENT_ID)).toEqual([])
  })

  it.each([
    ['sk_live_' + 'a1B2c3D4e5F6', 'Stripe secret'],
    ['pk_test_' + 'a1B2c3D4e5F6', 'Stripe publishable'],
    ['whsec_' + 'a1B2c3D4e5F6g7', 'webhook signing secret'],
    ['AKIA' + 'ABCDEFGHIJKLMNOP', 'AWS access key'],
    ['-----BEGIN ' + 'PRIVATE KEY-----', 'private key'],
    ['PAYPAL_CLIENT' + '_SECRET', 'PayPal client secret variable'],
    ['client_secret:"' + 'EKx9secretvalue1234567"', 'assigned client secret'],
  ])('rejects %s', (secret, label) => {
    const problems = checkBundle(bundle({ 'assets/index.js': `const id="${CLIENT_ID}";const s='${secret}'` }), CLIENT_ID)
    expect(problems.join('\n')).toContain(label)
    expect(problems.join('\n')).not.toContain(secret)
  })

  it('requires a well-formed Client ID that is actually embedded', () => {
    expect(checkBundle(bundle({ 'assets/index.js': 'x' }), '')).toContain('VITE_PAYPAL_SANDBOX_CLIENT_ID is missing or malformed')
    expect(checkBundle(bundle({ 'assets/index.js': 'x' }), CLIENT_ID)).toContain('PayPal Sandbox Client ID is not embedded in the build')
  })

  it('rejects hidden files, source maps and a missing index', () => {
    const problems = checkBundle(bundle({ 'assets/index.js': CLIENT_ID, '.env': 'X=1', 'assets/index.js.map': '{}' }), CLIENT_ID)
    expect(problems).toContain('hidden file in bundle: .env')
    expect(problems).toContain('source map in bundle: assets/index.js.map')
    rmSync(join(dir, 'index.html'))
    expect(checkBundle(dir, CLIENT_ID)).toEqual(['index.html is missing'])
  })
})

it('permits only an exact Stripe Test public key in a Stripe Sandbox artifact',()=>{
 const key='pk_test_OnlyPublicSynthetic123456'
 const dir=bundle({'assets/index.js':`const p="${CLIENT_ID}";const k="${key}"`})
 expect(checkBundle(dir,CLIENT_ID,'stripe-sandbox',key)).toEqual([])
 expect(checkBundle(dir,CLIENT_ID,'stripe-sandbox','pk_live_OnlyPublicSynthetic123456').length).toBeGreaterThan(0)
 expect(checkBundle(dir,CLIENT_ID,'paypal-sandbox').length).toBeGreaterThan(0)
 writeFileSync(join(dir,'assets/secret.js'),'sk_test_SyntheticSecret123456')
 expect(checkBundle(dir,CLIENT_ID,'stripe-sandbox',key).some(x=>x.includes('Stripe secret'))).toBe(true)
})
