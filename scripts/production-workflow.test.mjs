import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
const workflow=readFileSync('.github/workflows/production-storefront.yml','utf8')
describe('Production storefront delivery admission',()=>{
 it('requires main and both explicit switches for automatic push deployments',()=>{
  expect(workflow).toContain("github.ref == 'refs/heads/main'")
  expect(workflow).toContain("vars.PRODUCTION_STOREFRONT_DEPLOY_ENABLED == 'true'")
  expect(workflow).toContain("github.event_name == 'push' && vars.PRODUCTION_STOREFRONT_AUTO_DEPLOY_ENABLED == 'true'")
  expect(workflow).toMatch(/push:\s*\n\s*branches:\s*\[main\]/)
 })
 it('keeps CI checks before narrowly scoped Production credentials',()=>{
  const job=workflow.indexOf('- uses: aws-actions/configure-aws-credentials@')
  for(const check of ['npm run test:contracts','npx tsc -b --noEmit','npm run lint','npm run test:run','npm run legal:check','npm run build']) expect(workflow.indexOf(check)).toBeGreaterThan(0),expect(workflow.indexOf(check)).toBeLessThan(job)
  expect(workflow).toContain('role/ColorfulLife-ProductionStorefrontDeploy')
  expect(workflow).toContain('ColorfulLife-ProductionStorefrontDeploy')
  expect(workflow).not.toContain('ColorfulLife-SandboxStorefrontDeploy')
  expect(workflow).toContain('if-none-match')
 })
})
