import { COMPANY, registeredOfficeLine } from '../../features/legal/company'
import { LegalLayout } from './LegalLayout'

/** Business identity and contact details (E-Commerce Regulations 2002 reg 6). */
export function ContactUs() {
  return <LegalLayout title="Contact Us" updated="24 October 2026">
    <p>We would love to hear from you, whether it is a question about a set, an order or a return.</p>
    <h3>Email</h3>
    <p><a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>. Please include your order number if your message is about an order.</p>
    <h3>Who we are</h3>
    <p>{COMPANY.brand} is a trading name of <strong>{COMPANY.legalName}</strong>, a company registered in {COMPANY.registeredIn} under company number {COMPANY.registrationNumber}. {COMPANY.legalName} is not VAT registered.</p>
    <h3>Registered office</h3>
    <address className="legal-address">{COMPANY.legalName}<br />{COMPANY.registeredOffice.map(line => <span key={line}>{line}<br /></span>)}</address>
    <h3>Returns</h3>
    <p>Returned goods go to our registered office: {registeredOfficeLine}. Please read <a href="/legal/delivery-returns">Delivery &amp; Returns</a> first.</p>
  </LegalLayout>
}
