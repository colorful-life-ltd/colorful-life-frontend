import { AUTH_STORAGE_KEY, SESSION_STORAGE_KEY } from '../../features/auth/session'
import { LegalLayout } from './LegalLayout'

/**
 * Inventory of browser storage and third-party requests made by this storefront. Keep it in
 * step with the code: adding analytics, advertising or similar non-essential technology
 * requires prior consent and a consent tool, not just an update to this page.
 */
export function CookieNotice() {
  return <LegalLayout title="Cookie Notice" updated="24 October 2026">
    <p>This notice explains what Build &amp; Bloom stores in your browser and which other services your browser connects to. <strong>We do not use analytics, advertising or social-media cookies, so we do not show a cookie banner.</strong> If that changes, we will ask for your consent first.</p>

    <h2>Storage set by Build &amp; Bloom (strictly necessary)</h2>
    <p>We set no cookies of our own. We use your browser's <em>session storage</em>, which is cleared when you close the tab:</p>
    <table className="legal-table">
      <thead><tr><th scope="col">Name</th><th scope="col">Purpose</th><th scope="col">Duration</th></tr></thead>
      <tbody>
        <tr><td><code>{SESSION_STORAGE_KEY}</code></td><td>Keeps you signed in while you browse (sign-in session)</td><td>Until you sign out or close the tab</td></tr>
        <tr><td><code>{AUTH_STORAGE_KEY}</code></td><td>Holds a sign-in token when no renewable session exists (for example straight after creating an account); only one of the two sign-in entries is kept at a time</td><td>Until you sign out or close the tab</td></tr>
        <tr><td><code>colorful-life:checkout-attempt:&lt;account&gt;</code></td><td>Remembers a checkout in progress so an interrupted order is not placed twice</td><td>Until the order is created or the tab is closed</td></tr>
      </tbody>
    </table>
    <p>These are needed to provide the shop you have asked to use, so they do not require consent.</p>

    <h2>Payments: Stripe (strictly necessary, checkout only)</h2>
    <p>Stripe's payment form loads <strong>only when you reach the payment step</strong>, not while you browse. To process your payment and prevent fraud, Stripe may set its own cookies (for example <code>__stripe_mid</code> and <code>__stripe_sid</code>) and collect device information. See Stripe's privacy and cookie policies at <a href="https://stripe.com/privacy">stripe.com/privacy</a>.</p>

    <h2>Product images: Cloudinary</h2>
    <p>Product photographs are delivered from Cloudinary's servers. Your browser sends your IP address and browser details with each image request, as with any website image. We do not use Cloudinary to track you.</p>

    <h2>Managing storage</h2>
    <p>You can clear session storage and cookies in your browser settings. If you block session storage, you will not be able to stay signed in or check out.</p>
  </LegalLayout>
}
