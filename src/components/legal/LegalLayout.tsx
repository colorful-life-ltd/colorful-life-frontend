import type { ReactNode } from 'react'
import { COMPANY, registeredOfficeLine, trademarkNotice, tradingNameStatement } from '../../features/legal/company'
import { OWNER_DECISIONS, type OwnerDecision } from '../../features/legal/ownerDecisions'
import { LEGAL_PAGES } from '../../features/legal/routes'
import './Legal.css'

/** A visible, unmistakable gap where the owner has not yet approved the wording. */
export function OwnerDecisionPlaceholder({ id }: { id: OwnerDecision }) {
  return <mark className="legal-pending" data-owner-decision={id}>[Owner decision required: {OWNER_DECISIONS[id]}]</mark>
}

export function LegalLinks({ className = 'legal-links' }: { className?: string }) {
  return <ul className={className} aria-label="Legal information">
    {LEGAL_PAGES.map(page => <li key={page.path}><a href={page.path}>{page.title}</a></li>)}
    <li><a href={`mailto:${COMPANY.supportEmail}`}>Contact us</a></li>
  </ul>
}

/** Company disclosures required on the website (trading name, number, registered office, email). */
export function SiteFooter({ compact = false }: { compact?: boolean }) {
  return <footer className={`site-footer${compact ? ' site-footer--compact' : ''}`}>
    <LegalLinks />
    <p>{tradingNameStatement}</p>
    <p>Email: <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> · {COMPANY.legalName} is not VAT registered.</p>
    <p className="site-footer__trademark">{trademarkNotice}</p>
  </footer>
}

export function LegalLayout({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return <div className="legal-page">
    <header className="legal-page__header">
      <a className="legal-page__brand" href="/">{COMPANY.brand}</a>
      <nav aria-label="Legal pages"><LegalLinks className="legal-page__nav" /></nav>
    </header>
    <main className="legal-page__content" id="main">
      <h1>{title}</h1>
      <p className="legal-page__updated">Last updated: {updated}</p>
      {children}
      <p className="legal-page__back"><a href="/">← Back to the shop</a></p>
    </main>
    <SiteFooter />
  </div>
}

export function ContactBlock() {
  return <address className="legal-address">
    {COMPANY.legalName} (trading as {COMPANY.brand})<br />{registeredOfficeLine}<br />
    Email: <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
  </address>
}
