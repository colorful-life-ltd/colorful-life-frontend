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
it('publishes adopted retention rules while preserving category exceptions and manual review', () => {
  const text = policy().textContent!
  expect(text).toContain('generally six years from the end of the relevant financial year')
  expect(text).toContain('longer retention where required by applicable law, open disputes, investigations or enquiries')
  expect(text).toContain('Not all financial or tax records have identical statutory periods')
  expect(text).toContain('applicable category-specific requirements and exceptions take precedence')
  expect(text).toContain('manual-review procedure covers accounts that remain unverified after 30 days')
  expect(text).toContain('not an automatic deletion deadline')
  expect(text).toContain('Routine support correspondence is subject to manual review after 12 months from resolution or the last substantive contact, not automatic deletion')
  expect(text).toContain('retain it longer where necessary for ongoing enquiries, disputes, legal obligations or legitimate unresolved matters')
  expect(text).toContain('Quarterly manual reviews')
  expect(text).toContain('only as long as necessary')
  expect(text).toContain('Necessary order-confirmation snapshots are included as transaction records')
  expect(text).toContain('do not promise automatic deletion')
  expect(text).toContain('does not erase all order, payment or email records')
  expect(text).not.toContain('proposed')
  expect(pendingOwnerDecisions()).not.toContain('retentionPeriods')
})
it('describes backup criteria without attributing an unverified duration to customer data', () => {
  const text = policy().textContent!
  expect(text).toContain('Backup copies, separate snapshots, exports and mailbox copies')
  expect(text).toContain('recovery purpose, continued necessity and applicable legal or dispute holds')
  expect(text).toContain('does not necessarily remove it immediately from those copies')
  expect(text).toContain('do not promise immediate erasure from every copy')
  for (const claim of ['35-day', '35 days', 'for 7 years', '90 days', '180 days', 'permanently removed', 'staff access to customer data requires two-step']) expect(text).not.toContain(claim)
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
  expect(pendingOwnerDecisions().sort()).toEqual(['transferSafeguards'])
})

it('uses the source-verified security summary without implying completed transfer checks', () => {
  expect(policy().textContent).toContain('We use HTTPS, password hashing and restricted access to protect your information.')
  expect(pendingOwnerDecisions().sort()).toEqual(['transferSafeguards'])
})
