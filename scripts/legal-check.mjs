// Launch gate: fails while legal pages still contain owner-decision placeholders.
import { readFileSync } from 'node:fs'
const source = readFileSync(new URL('../src/features/legal/ownerDecisions.ts', import.meta.url), 'utf8')
const block = source.slice(source.indexOf('OWNER_DECISIONS = {'), source.indexOf('} as const'))
const pending = [...block.matchAll(/^\s+(\w+): '/gm)].map(match => match[1])
if (pending.length) {
  console.error(`Legal pages are not ready to publish: ${pending.length} owner decision(s) open:\n- ${pending.join('\n- ')}`)
  process.exit(1)
}
console.log('No open owner decisions in legal pages.')
