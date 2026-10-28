// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { PrivacyPolicy } from './PrivacyPolicy'
import { pendingOwnerDecisions } from '../../features/legal/ownerDecisions'

const policy = () => { const element = document.createElement('div'); element.innerHTML = renderToStaticMarkup(<PrivacyPolicy />); return element }
it('reports the pending ICO reference without inventing registration details', () => {
  const text = policy().textContent!
  expect(text).toContain('completed its ICO registration application and Direct Debit setup')
  expect(text).toContain('formal registration reference is pending')
  expect(text).toContain('application number is not a registration reference')
  expect(pendingOwnerDecisions()).not.toContain('icoRegistration')
})
it('describes six-year retention as policy without claiming unverified automatic deletion', () => {
  const text = policy().textContent!
  expect(text).toContain('generally to retain necessary transaction, payment, refund and accounting records for six years')
  expect(text).toContain('only as long as necessary')
  expect(text).toContain('do not promise automatic deletion')
  expect(text).toContain('does not erase all order, payment or email records')
  for (const claim of ['for 7 years', '90 days', '180 days', 'up to 35 days', 'permanently removed', 'staff access to customer data requires two-step']) expect(text).not.toContain(claim)
})
it('identifies payment, image and optional lookup flows and keeps transfer review open', () => {
  const element = policy(), text = element.textContent!
  for (const provider of ['Stripe and PayPal', 'Amazon SES', 'Cloudinary', 'Ideal Postcodes']) expect(text).toContain(provider)
  expect(text).toContain('not a claim that our transfer review is complete')
  expect(text).toContain('account-specific')
  expect(element.querySelector('a[href="https://stripe.com/legal/dta"]')).not.toBeNull()
  expect(element.querySelector('a[href="https://www.paypal.com/uk/legalhub/paypal/privacy-full"]')).not.toBeNull()
  expect(pendingOwnerDecisions().sort()).toEqual(['retentionPeriods', 'transferSafeguards'])
})
