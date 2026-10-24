/** Public legal pages. Paths are also used by backend emails (src/domain/email/consumerRights.ts). */
export const LEGAL_PAGES = [
  { path: '/legal/terms', title: 'Terms & Conditions', description: 'The terms that apply when you buy from Build & Bloom, a trading name of Colorful Life Ltd.' },
  { path: '/legal/delivery-returns', title: 'Delivery & Returns', description: 'Delivery options and charges, your 14-day right to cancel, returns and faulty goods.' },
  { path: '/legal/cancellation-form', title: 'Cancellation Form', description: 'Model cancellation form for cancelling a Build & Bloom order within 14 days.' },
  { path: '/legal/privacy', title: 'Privacy Policy', description: 'How Colorful Life Ltd (Build & Bloom) uses and protects your personal data, and your rights.' },
  { path: '/legal/cookies', title: 'Cookie Notice', description: 'The browser storage and third-party services Build & Bloom uses, and why.' },
] as const

export type LegalPath = typeof LEGAL_PAGES[number]['path']
const normalize = (pathname: string) => pathname.replace(/\/+$/, '') || '/'
export const legalPage = (pathname: string) => LEGAL_PAGES.find(page => page.path === normalize(pathname)) ?? null
export const isLegalPath = (pathname: string) => legalPage(pathname) !== null
export const legalHref = (path: LegalPath) => path
