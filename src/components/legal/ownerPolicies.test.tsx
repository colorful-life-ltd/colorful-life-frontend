// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DeliveryReturns } from './DeliveryReturns'
import { TermsAndConditions } from './TermsAndConditions'
import { PreContractSummary } from './PreContractSummary'
import { PrivacyPolicy } from './PrivacyPolicy'
import { pendingOwnerDecisions } from '../../features/legal/ownerDecisions'

const text = (markup: string) => { const view = document.createElement('div'); view.innerHTML = markup; return view.textContent ?? '' }
describe('owner-approved sales policies', () => {
  it('preserves statutory periods, refund protection and lawful handling of opened goods', () => {
    const copy = text(renderToStaticMarkup(<DeliveryReturns />))
    for (const phrase of ['England, Scotland, Wales and Northern Ireland', '2–3 working days after order confirmation', 'dispatch time, not delivery time', 'within 30 days', 'within 14 days of the day', 'within 14 days of telling us', 'direct cost of returning', 'If we failed to disclose this, we bear that cost', 'original payment method', 'cheapest standard delivery', 'whichever is earlier', 'Opening the box alone', 'do not automatically refuse opened or assembled', 'actual diminished value', 'do not offer an additional voluntary']) {
      expect(copy).toContain(phrase)
    }
    expect(copy).not.toContain('Owner decision required')
  })
  it('distinguishes acknowledgment from acceptance and limits refusal to before acceptance', () => {
    const copy = text(renderToStaticMarkup(<TermsAndConditions />))
    for (const phrase of ['not acceptance', 'formed when we send you the dispatch confirmation email', 'Before accepting', 'objectively reasonable', 'refund all captured payments in full via the original payment method', 'not a general right to cancel an accepted contract', 'initial response within 3 working days', 'not a promise of final resolution', 'not currently committed to a voluntary', 'obliged to participate in by law or contract', '18 or older']) expect(copy).toContain(phrase)
    expect(copy).not.toContain('Owner decision required')
  })
  it.each(['order', 'payment'] as const)('discloses direct return costs and acceptance before %s', stage => {
    const copy = text(renderToStaticMarkup(<PreContractSummary stage={stage} />))
    expect(copy).toContain('you pay the direct return cost')
    expect(copy).toContain('dispatch confirmation email')
    expect(copy).toContain('18 or older')
  })
  it('leaves the three unapproved privacy decisions visible and pending', () => {
    expect(pendingOwnerDecisions().sort()).toEqual(['icoRegistration', 'retentionPeriods', 'transferSafeguards'])
    const copy = text(renderToStaticMarkup(<PrivacyPolicy />))
    expect(copy.match(/Owner decision required/g)).toHaveLength(3)
    expect(copy).toContain('Customers placing orders must be 18 or older')
  })
})
