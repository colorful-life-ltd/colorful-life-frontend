// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Regression: two merges 12 s apart deployed out of order (older verify finished later), so the older release
// replaced the newer one on the host. A push deploy must skip itself once main has moved on.
const workflow = readFileSync(new URL('../.github/workflows/storefront.yml', import.meta.url), 'utf8')
const job = workflow.split('  deploy-sandbox:')[1]
const steps = ('\n' + job.split('\n    steps:\n')[1]).split(/\n {6}- /).slice(1)
const guardIndex = steps.findIndex(s => s.startsWith('name: Skip a superseded push deploy'))
const guardScript = () => (steps[guardIndex] ?? '').split('run: |\n')[1]?.split('\n').map(line => line.replace(/^ {10}/, '')).join('\n') ?? 'exit 99'

const SHA = 'a'.repeat(40), NEWER = 'b'.repeat(40)
function runGuard(curlBody) {
  const dir = mkdtempSync(join(tmpdir(), 'deploy-guard-'))
  writeFileSync(join(dir, 'curl'), `#!/usr/bin/env bash\n${curlBody}\n`); chmodSync(join(dir, 'curl'), 0o755)
  const env = join(dir, 'github_env'); writeFileSync(env, '')
  let failed = false
  try {
    execFileSync('bash', ['-e', '-c', guardScript()], { env: { PATH: `${dir}:${process.env.PATH}`, GITHUB_SHA: SHA, GITHUB_ENV: env, GH_TOKEN: 't', GITHUB_API_URL: 'https://api.github.invalid', GITHUB_REPOSITORY: 'o/r' }, stdio: 'pipe' })
  } catch { failed = true }
  return { failed, env: readFileSync(env, 'utf8') }
}

describe('Sandbox storefront deploy ordering', () => {
  it('checks main before any other deploy step, for push deploys only', () => {
    expect(guardIndex).toBe(0)
    expect(steps[0]).toContain("if: github.event_name == 'push'")
    expect(job).toContain('group: sandbox-storefront')
  })
  it('skips every later step, including the AWS and SSM steps, when superseded', () => {
    const later = steps.slice(1)
    expect(later.length).toBeGreaterThanOrEqual(7)
    for (const step of later) expect(step).toMatch(/\n {8}if: .*env\.SUPERSEDED != 'true'/)
  })
  it('marks a push deploy superseded once main has moved on', () => {
    expect(runGuard(`echo ${NEWER}`)).toEqual({ failed: false, env: 'SUPERSEDED=true\n' })
  })
  it('lets the current main head deploy', () => {
    expect(runGuard(`echo ${SHA}`)).toEqual({ failed: false, env: '' })
  })
  it('fails closed when main cannot be read', () => {
    expect(runGuard('exit 22').failed).toBe(true)
    expect(runGuard('echo not-a-sha').failed).toBe(true)
  })
})
