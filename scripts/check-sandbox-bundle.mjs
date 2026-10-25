// Sandbox release guard: run on dist/ after the PayPal Sandbox build, before it can be uploaded.
// Usage: VITE_PAYPAL_SANDBOX_CLIENT_ID=... node scripts/check-sandbox-bundle.mjs dist
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const TEXT = new Set(['.html', '.js', '.mjs', '.css', '.json', '.txt', '.svg', '.xml', '.webmanifest'])

// Real credential formats only. The Stripe return-URL cleanup legitimately names
// `payment_intent_client_secret`, so a bare "client_secret" is allowed but an assigned value is not.
export const FORBIDDEN = [
  ['Stripe secret or restricted key', /\b[sr]k_(live|test)_[A-Za-z0-9]{8,}/],
  ['Stripe publishable key (Sandbox builds keep Stripe unset)', /\bpk_(live|test)_[A-Za-z0-9]{8,}/],
  ['webhook signing secret', /\bwhsec_[A-Za-z0-9]{8,}/],
  ['AWS access key', /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ['private key', /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ['PayPal client secret variable', /PAYPAL_CLIENT_SECRET/],
  ['assigned client secret', /client_secret["'`]?\s*[:=]\s*["'`][A-Za-z0-9_-]{16,}/],
]

function files(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? [path, ...files(path)] : [path]
  })
}

export function checkBundle(dir, clientId) {
  const problems = []
  if (!existsSync(join(dir, 'index.html'))) return ['index.html is missing']
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(clientId ?? '')) problems.push('VITE_PAYPAL_SANDBOX_CLIENT_ID is missing or malformed')
  let clientIdFound = false
  for (const path of files(dir)) {
    const name = relative(dir, path)
    if (name.split(/[\\/]/).some(part => part.startsWith('.'))) problems.push(`hidden file in bundle: ${name}`)
    if (name.endsWith('.map')) problems.push(`source map in bundle: ${name}`)
    if (statSync(path).isDirectory() || !TEXT.has(extname(path))) continue
    const text = readFileSync(path, 'utf8')
    for (const [label, pattern] of FORBIDDEN) if (pattern.test(text)) problems.push(`${label} in ${name}`)
    if (clientId && text.includes(clientId)) clientIdFound = true
  }
  if (clientId && !clientIdFound) problems.push('PayPal Sandbox Client ID is not embedded in the build')
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const problems = checkBundle(process.argv[2] ?? 'dist', process.env.VITE_PAYPAL_SANDBOX_CLIENT_ID)
  // Report labels and file names only; never echo matched values.
  for (const problem of problems) console.error(`Sandbox bundle check failed: ${problem}`)
  if (problems.length) process.exit(1)
  console.log('Sandbox bundle check passed')
}
