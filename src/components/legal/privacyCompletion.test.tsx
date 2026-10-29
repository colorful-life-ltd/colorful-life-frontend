// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { PrivacyPolicy } from './PrivacyPolicy'
import { pendingOwnerDecisions } from '../../features/legal/ownerDecisions'

const policy = () => { const element = document.createElement('div'); element.innerHTML = renderToStaticMarkup(<PrivacyPolicy />); return element }
it('omits internal ICO application details without introducing a registration blocker', () => {
  const text = policy().textContent!
  for (const internal of ['Direct Debit', 'registration application', 'registration reference', 'application number']) expect(text).not.toContain(internal)
  expect(pendingOwnerDecisions()).not.toContain('icoRegistration')
})
it('keeps the financial schedule proposed and distinguishes manual review from deletion', () => {
  const text = policy().textContent!
  expect(text).toContain('A six-year operational schedule is proposed, subject to accountant or legal confirmation')
  expect(text).toContain('manual-review procedure covers accounts that remain unverified after 30 days')
  expect(text).toContain('not an automatic deletion deadline')
  expect(text).toContain('quarterly manual reviews')
  expect(text).toContain('verified 35-day automated backup-retention setting')
  expect(text).toContain('separate snapshots, exports and mailbox copies')
  expect(text).toContain('proposed 12-month support-mail review threshold')
  expect(text).not.toContain('delete support emails after 12 months')
  expect(text).toContain('only as long as necessary')
  expect(text).toContain('Necessary order-confirmation snapshots are included as transaction records')
  expect(text).toContain('do not promise automatic deletion')
  expect(text).toContain('does not erase all order, payment or email records')
  for (const claim of ['for 7 years', '90 days', '180 days', 'up to 35 days', 'permanently removed', 'staff access to customer data requires two-step']) expect(text).not.toContain(claim)
})
it('identifies payment, image and optional lookup flows and keeps transfer review open', () => {
  const element = policy(), text = element.textContent!
  for (const provider of ['Stripe and PayPal', 'Amazon SES', 'Google', 'Cloudinary', 'Ideal Postcodes']) expect(text).toContain(provider)
  expect(text).toContain('not a claim that our transfer review is complete')
  expect(text).toContain('account-specific')
  expect(text).toContain('custom-domain Gmail service we use for support email')
  expect(text).toContain('checking the terms and transfer arrangements applicable to our email subscription')
  expect(text).toContain('do not claim UK-only mailbox storage')
  expect(element.querySelector('a[href="mailto:support@build-and-bloom.co.uk"]')).not.toBeNull()
  expect(text).not.toContain('Sandbox')
  expect(text).toContain('PayPal may also process your information if it is offered at checkout and you choose it')
  expect(element.querySelector('a[href="https://stripe.com/legal/dta"]')).not.toBeNull()
  expect(element.querySelector('a[href="https://www.paypal.com/uk/legalhub/paypal/privacy-full"]')).not.toBeNull()
  expect(pendingOwnerDecisions().sort()).toEqual(['retentionPeriods', 'transferSafeguards'])
})

it('uses the source-verified security summary without implying completed retention or transfer checks', () => {
  expect(policy().textContent).toContain('We use HTTPS, password hashing and restricted access to protect your information.')
  expect(pendingOwnerDecisions().sort()).toEqual(['retentionPeriods', 'transferSafeguards'])
})
