import { HelpCentre } from '../help/HelpCentre'
import type { MouseEvent } from 'react'
import flower from '../../assets/decorations/catalogue-title-flower.png'
import { COMPANY, registeredOfficeLine } from '../../features/legal/company'
import { LEGAL_PAGES, type LegalSlug } from '../../features/legal/routes'
import { CancellationForm } from './CancellationForm'
import { ContactUs } from './ContactUs'
import { CookieNotice } from './CookieNotice'
import { DeliveryReturns } from './DeliveryReturns'
import { PrivacyPolicy } from './PrivacyPolicy'
import { TermsAndConditions } from './TermsAndConditions'
import './Legal.css'

/** Plain clicks turn the page in the book; modified clicks open the crawlable URL. */
const pageTurnClick = (slug: LegalSlug, onSelect: (slug: LegalSlug) => void, turning: boolean) => (event: MouseEvent<HTMLAnchorElement>) => {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
  event.preventDefault()
  if (!turning) onSelect(slug)
}

/** Left page of the Customer Information chapter: its own contents, plus who we are. */
export function CustomerInformationIndex({ current, onSelect, turning = false }: { current: LegalSlug; onSelect: (slug: LegalSlug) => void; turning?: boolean }) {
  return <nav className="front-matter customer-information" aria-labelledby="customer-information-title">
    <header className="front-matter__welcome-heading customer-information__heading">
      <img className="front-matter__flower" src={flower} alt="" aria-hidden="true" />
      <h2 id="customer-information-title"><span>Build &amp; Bloom</span>Customer Information</h2>
      <p className="customer-information__intro">Everything you need to know</p>
    </header>
    <ol className="customer-information__entries">
      {LEGAL_PAGES.map(page => <li key={page.slug}>
        <a className="front-matter__entry customer-information__entry" href={page.path} aria-current={page.slug === current ? 'page' : undefined}
          aria-disabled={turning || undefined} onClick={pageTurnClick(page.slug, onSelect, turning)}>
          <span className="front-matter__entry-title">{page.title}{page.slug === current
            ? <span className="customer-information__marker" aria-hidden="true">❀</span>
            : <span className="front-matter__arrow" aria-hidden="true">→</span>}</span>
          <span className="front-matter__entry-description">{page.summary}</span>
        </a>
      </li>)}
    </ol>
    <p className="customer-information__company">
      {COMPANY.brand} is a trading name of {COMPANY.legalName}, registered in {COMPANY.registeredIn}, company no. {COMPANY.registrationNumber}.
      Registered office: {registeredOfficeLine}. <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
    </p>
  </nav>
}

const documents: Record<LegalSlug, () => React.JSX.Element> = {
  help: HelpCentre, contact: ContactUs, 'delivery-returns': DeliveryReturns, 'cancellation-form': CancellationForm,
  terms: TermsAndConditions, privacy: PrivacyPolicy, cookies: CookieNotice,
}

/** Right page: the selected document, scrolling within the paper like any long page. */
export function LegalDocument({ page }: { page: LegalSlug }) {
  const Document = documents[page]
  return <Document />
}

