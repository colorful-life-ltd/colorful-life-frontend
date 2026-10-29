/**
 * Owner-confirmed legal identity (2026-10-24), checked the same day against the Companies House
 * record for company 08097729: name, number, registered office and status (active) match.
 * A company number without a prefix is on the England and Wales register.
 * Change these values only with owner approval; the backend's ORDER_CONFIRMATION_BUSINESS_JSON
 * must carry the same details for transactional emails.
 */
export const COMPANY = {
  brand: 'Build & Bloom',
  legalName: 'Colorful Life Ltd',
  registrationNumber: '08097729',
  registeredIn: 'England and Wales',
  registeredOffice: ['3 Hawthorne Drive', 'Bolton-Upon-Dearne', 'Rotherham', 'England', 'S63 8NS'],
  /** Owner-confirmed postal address for physical returns. */
  returnsAddress: ['3 Hawthorne Drive', 'Bolton upon Dearne', 'S63 8NS', 'United Kingdom'],
  supportEmail: 'support@build-and-bloom.co.uk',
  /** Not VAT registered: matches the backend invoice statement (NON_VAT_STATEMENT). */
  vatRegistered: false,
} as const

export const registeredOfficeLine = COMPANY.registeredOffice.join(', ')
export const returnsAddressLine = COMPANY.returnsAddress.join(', ')
export const tradingNameStatement = `${COMPANY.brand} is a trading name of ${COMPANY.legalName}, a company registered in ${COMPANY.registeredIn} (company number ${COMPANY.registrationNumber}). Registered office: ${registeredOfficeLine}.`
export const trademarkNotice = 'LEGO® is a trademark of the LEGO Group of companies, which does not sponsor, authorise or endorse this site.'
