// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
it('enables registration only in the existing Sandbox release build and preserves deployment admission', () => {
  const workflow = readFileSync(new URL('../.github/workflows/storefront.yml', import.meta.url), 'utf8')
  const release = workflow.split('  deploy-sandbox:')[1]
  expect(release).toContain("github.ref == 'refs/heads/main'")
  expect(release).toContain("vars.SANDBOX_DEPLOY_ENABLED == 'true'")
  expect(release).toContain("needs.verify.result == 'success'")
  expect(release).toContain('group: sandbox-storefront')
  expect(release).toContain('cancel-in-progress: false')
  const build = release.split('- name: Build and check the Sandbox release')[1].split('- uses: aws-actions/')[0]
  expect(build).toContain('VITE_API_BASE_URL: /api')
  expect(build).toContain("VITE_PAYMENT_MODE: ${{ vars.SANDBOX_PAYMENT_MODE || 'paypal-sandbox' }}")
  expect(build).toContain("VITE_SANDBOX_REGISTRATION_ENABLED: 'true'")
  expect(build).toContain('VITE_PAYPAL_SANDBOX_CLIENT_ID: ${{ vars.VITE_PAYPAL_SANDBOX_CLIENT_ID }}')
  expect(build).toContain('node scripts/check-sandbox-bundle.mjs dist')
  expect(workflow.split('  deploy-sandbox:')[0]).not.toContain('VITE_SANDBOX_REGISTRATION_ENABLED')
  expect(release).toContain('DEPLOY_DOCUMENT: ColorfulLife-DeployStorefront')
  expect(release).not.toContain('PAYPAL_CLIENT_SECRET')
})
