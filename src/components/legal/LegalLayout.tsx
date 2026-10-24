import type { ReactNode } from 'react'
import leaf from '../../assets/shared/hr-leaf.png'
import { COMPANY, registeredOfficeLine, trademarkNotice, tradingNameStatement } from '../../features/legal/company'
import { OWNER_DECISIONS, type OwnerDecision } from '../../features/legal/ownerDecisions'
import { LEGAL_PAGES } from '../../features/legal/routes'
import './Legal.css'

/** A visible, unmistakable gap where the owner has not yet approved the wording. */
export function OwnerDecisionPlaceholder({ id }: { id: OwnerDecision }) {
  return <mark className="legal-pending" data-owner-decision={id}>[Owner decision required: {OWNER_DECISIONS[id]}]</mark>
}

/** A Customer Information document set on the open book's right-hand page. */
export function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return <article className="legal-document" aria-labelledby="legal-document-title">
    <header className="legal-document__heading">
      <h2 id="legal-document-title">{title}</h2>
      <img src={leaf} alt="" aria-hidden="true" />
      <p className="legal-document__updated">Last updated {updated}</p>
    </header>
    {children}
  </article>
}

export function ContactBlock() {
  return <address className="legal-address">
    {COMPANY.legalName} (trading as {COMPANY.brand})<br />{registeredOfficeLine}<br />
    Email: <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
  </address>
}

/** Company disclosures for the standalone checkout, order and account pages. */
export function SiteFooter() {
  return <footer className="site-footer">
    <ul className="site-footer__links" aria-label="Customer information">
      {LEGAL_PAGES.map(page => <li key={page.path}><a href={page.path}>{page.title}</a></li>)}
    </ul>
    <p>{tradingNameStatement} <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a></p>
    <p className="site-footer__trademark">{trademarkNotice}</p>
  </footer>
}
