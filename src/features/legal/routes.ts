/**
 * The storybook's Customer Information chapter. Each document is a spread of the open book at
 * /legal/<slug>, with Help at /help. Paths are also used by backend emails (src/domain/email/consumerRights.ts).
 */
export const LEGAL_PAGES = [
  { slug: 'help', path: '/help', title: 'Help & FAQs', summary: 'Answers about shopping, orders and returns', description: 'Help with choosing LEGO sets, delivery, payments, cancellations, returns and your Build & Bloom account.' },
  { slug: 'contact', path: '/legal/contact', title: 'Contact Us', summary: 'Who we are and how to reach us', description: 'Contact Build & Bloom, a trading name of Colorful Life Ltd: email, registered office and company details.' },
  { slug: 'delivery-returns', path: '/legal/delivery-returns', title: 'Delivery & Returns', summary: 'Delivery, your 14-day right to cancel and returns', description: 'Delivery options and charges, your 14-day right to cancel, returns and faulty goods.' },
  { slug: 'cancellation-form', path: '/legal/cancellation-form', title: 'Cancellation Form', summary: 'A form you can use to cancel an order', description: 'Model cancellation form for cancelling a Build & Bloom order within 14 days.' },
  { slug: 'terms', path: '/legal/terms', title: 'Terms & Conditions', summary: 'The terms that apply when you buy', description: 'The terms that apply when you buy from Build & Bloom, a trading name of Colorful Life Ltd.' },
  { slug: 'privacy', path: '/legal/privacy', title: 'Privacy Policy', summary: 'How we look after your personal data', description: 'How Colorful Life Ltd (Build & Bloom) uses and protects your personal data, and your rights.' },
  { slug: 'cookies', path: '/legal/cookies', title: 'Cookie Notice', summary: 'What we store in your browser, and why', description: 'The browser storage and third-party services Build & Bloom uses, and why.' },
] as const

export type LegalPage = typeof LEGAL_PAGES[number]
export type LegalSlug = LegalPage['slug']
export type LegalPath = LegalPage['path']
const normalize = (pathname: string) => pathname.replace(/\/+$/, '') || '/'
export const legalPage = (pathname: string) => LEGAL_PAGES.find(page => page.path === normalize(pathname)) ?? null
export const legalPageBySlug = (slug: LegalSlug) => LEGAL_PAGES.find(page => page.slug === slug)!
export const isLegalPath = (pathname: string) => legalPage(pathname) !== null
export const legalHref = (slug: LegalSlug) => legalPageBySlug(slug).path
