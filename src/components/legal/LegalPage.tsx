import { legalPage } from '../../features/legal/routes'
import { SITE_NAME } from '../../features/seo/routeHead'
import { useRouteHead } from '../../features/seo/documentHead'
import { CancellationForm } from './CancellationForm'
import { CookieNotice } from './CookieNotice'
import { DeliveryReturns } from './DeliveryReturns'
import { PrivacyPolicy } from './PrivacyPolicy'
import { TermsAndConditions } from './TermsAndConditions'

/** Renders the legal page for a /legal/* path; public and indexable. */
export function LegalPage({ pathname }: { pathname: string }) {
  const page = legalPage(pathname)
  useRouteHead(page ? { title: `${page.title} | ${SITE_NAME}`, description: page.description, canonicalPath: page.path, robots: 'index,follow' } : null)
  switch (page?.path) {
    case '/legal/terms': return <TermsAndConditions />
    case '/legal/delivery-returns': return <DeliveryReturns />
    case '/legal/cancellation-form': return <CancellationForm />
    case '/legal/privacy': return <PrivacyPolicy />
    case '/legal/cookies': return <CookieNotice />
    default: return null
  }
}
