// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
const base = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITE_')))
const config = { VITE_TARGET_ENVIRONMENT: 'production', VITE_API_ENVIRONMENT: 'production', VITE_API_BASE_URL: '/api', VITE_SITE_URL: 'https://build-and-bloom.co.uk', VITE_PAYMENT_MODE: 'stripe-live', VITE_STRIPE_PUBLISHABLE_KEY: 'pk_live_syntheticBuildOnly12345', VITE_SOURCE_REVISION: 'a'.repeat(40) }
function build(env, check) {
 const dir = mkdtempSync(join(tmpdir(), 'storefront-contract-'))
 try {
  const result = spawnSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', dir], { env: { ...base, ...env }, encoding: 'utf8', timeout: 60000 })
  check(result, dir)
 } finally { rmSync(dir, { recursive: true, force: true }) }
}
it.each(['production', 'sandbox'])('actual Vite build emits environment identity for %s', target => {
 const env = target === 'production' ? config : { ...config, VITE_TARGET_ENVIRONMENT: 'sandbox', VITE_API_ENVIRONMENT: 'sandbox', VITE_PAYMENT_MODE: 'stripe-sandbox', VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_syntheticBuildOnly12345' }
 build(env, (result, dir) => {
  expect(result.status, result.stderr).toBe(0)
  const manifest = JSON.parse(readFileSync(join(dir, 'storefront-environment.json'), 'utf8'))
  expect(manifest).toMatchObject({ version: 1, target, sourceRevision: 'a'.repeat(40), apiEnvironment: target, apiBase: '/api', paymentMode: env.VITE_PAYMENT_MODE })
  expect(manifest.publishableKeySha256).toMatch(/^[a-f0-9]{64}$/)
  expect(JSON.stringify(manifest)).not.toContain(env.VITE_STRIPE_PUBLISHABLE_KEY)
 })
}, 60000)
it.each([
 { ...config, VITE_PAYMENT_MODE: '' }, { ...config, VITE_STRIPE_PUBLISHABLE_KEY: 'pk_test_syntheticBuildOnly12345' },
 { ...config, VITE_API_BASE_URL: '' }, { ...config, VITE_SITE_URL: '' }, { ...config, VITE_SOURCE_REVISION: '' },
 { ...config, VITE_STRIPE_SECRET_KEY: 'synthetic' },
])('actual Vite build rejects unsafe configuration %#', env => {
 build(env, result => { expect(result.status).not.toBe(0); expect(result.stderr).not.toContain('pk_test_syntheticBuildOnly12345') })
}, 60000)
