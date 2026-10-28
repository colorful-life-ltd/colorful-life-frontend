import { COMPANY } from '../../features/legal/company'
import { ContactBlock, LegalLayout, OwnerDecisionPlaceholder } from './LegalLayout'

/**
 * Describes the processing the code actually performs (backend schema, services and providers).
 * Update this page whenever a new provider, data field or purpose is introduced.
 */
export function PrivacyPolicy() {
  return <LegalLayout title="Privacy Policy" updated="28 October 2026">
    <p>This policy explains how {COMPANY.legalName}, trading as {COMPANY.brand} ("we", "us"), uses your personal data when you visit our shop, create an account or buy from us, and the rights you have under UK data protection law.</p>

    <h3>Who we are</h3>
    <p>{COMPANY.legalName} is the controller of your personal data. You can contact us about privacy at:</p>
    <ContactBlock />
    <p>ICO registration reference: <OwnerDecisionPlaceholder id="icoRegistration" /></p>

    <h3>The personal data we collect</h3>
    <ul>
      <li><strong>Account details:</strong> your email address and password. We store only a secure one-way hash of your password, never the password itself. You may add your first name, last name and phone number.</li>
      <li><strong>Addresses:</strong> the delivery and billing addresses you save, including the recipient name and an optional phone number.</li>
      <li><strong>Orders:</strong> what you bought, prices, delivery method and charge, the delivery and billing address used, order status, cancellations, returns, refunds and dispatch details such as the carrier and tracking number.</li>
      <li><strong>Payments:</strong> the payment provider, amount, currency, status and dates. Card details are entered directly into Stripe's secure payment form. We never receive or store your full card number or security code.</li>
      <li><strong>Your basket:</strong> the items in your cart.</li>
      <li><strong>Messages:</strong> what you send us by email, for example about an order or a return.</li>
      <li><strong>Security information:</strong> to stop abuse such as password guessing or card testing, we count recent attempts per network address and account. Network addresses are stored only as keyed, one-way codes that expire automatically.</li>
    </ul>
    <p>We do not use analytics, advertising or social-media tracking, we do not send marketing emails, and we do not sell your data.</p>

    <h3>How we use your data, and our lawful bases</h3>
    <table className="legal-table">
      <thead><tr><th scope="col">Purpose</th><th scope="col">Lawful basis</th></tr></thead>
      <tbody>
        <tr><td>Creating and running your account, including email verification and password recovery</td><td>Contract</td></tr>
        <tr><td>Taking, paying for, delivering, cancelling and returning orders, and order emails (confirmation, invoice, dispatch)</td><td>Contract</td></tr>
        <tr><td>Keeping order and invoice records for tax and accounting</td><td>Legal obligation</td></tr>
        <tr><td>Answering your questions and complaints</td><td>Contract, and our legitimate interest in resolving issues</td></tr>
        <tr><td>Preventing fraud, payment abuse and unauthorised access to accounts</td><td>Legitimate interests in protecting customers and our business</td></tr>
        <tr><td>Establishing or defending legal claims</td><td>Legitimate interests</td></tr>
      </tbody>
    </table>
    <p>Automated security checks may temporarily limit repeated sign-in, checkout or payment attempts, or hold an order for manual review. They never decide anything else about you. If you are affected, contact us and a person will look at it.</p>

    <h3>Who we share it with</h3>
    <ul>
      <li><strong>Stripe</strong> processes payments and helps prevent fraud. Stripe also acts as a controller for some of this data under its own privacy policy.</li>
      <li><strong>Amazon Web Services (AWS)</strong> hosts our website, database and backups in the UK (London region), and sends our transactional emails.</li>
      <li><strong>Cloudinary</strong> hosts product photographs. When you view a product, your browser downloads images from Cloudinary's servers, which receive your IP address and browser details as part of that request. We do not send Cloudinary any customer data.</li>
      <li><strong>Delivery companies</strong> (for example Royal Mail, Evri or DPD) receive the recipient name, address and, where needed, phone number for your order.</li>
      <li>Our professional advisers, and authorities such as HMRC or the police where the law requires it.</li>
    </ul>

    <h3>International transfers</h3>
    <p>Stripe and Cloudinary may process data outside the UK, including in the United States. Where they do, the transfer relies on: <OwnerDecisionPlaceholder id="transferSafeguards" /></p>

    <h3>How long we keep it</h3>
    <ul>
      <li><strong>Account and saved addresses:</strong> until you delete your account.</li>
      <li><strong>Orders and invoices:</strong> for 7 years from the order date, to meet tax and accounting record-keeping requirements. After that, names, address lines and phone numbers on the order are permanently removed.</li>
      <li><strong>Contact details copied into order emails:</strong> 90 days after the email is sent, or immediately if you delete your account.</li>
      <li><strong>Items in an inactive cart:</strong> 180 days.</li>
      <li><strong>Security counters:</strong> deleted automatically when they expire, normally within hours.</li>
      <li><strong>Backups:</strong> deleted data may remain in encrypted database backups for up to 35 days before the backup is overwritten.</li>
    </ul>
    <p><OwnerDecisionPlaceholder id="retentionPeriods" /></p>

    <h3>Your rights</h3>
    <p>You have the right to access your data, to have it corrected, to have it deleted, to restrict or object to its use, and to receive it in a portable format. You can:</p>
    <ul>
      <li>download a copy of your data from <strong>My Account → Your data</strong>;</li>
      <li>correct your profile and addresses in <strong>My Account</strong>;</li>
      <li>delete your account in <strong>My Account → Your data</strong>. We remove your account details, saved addresses and basket. We keep order and invoice records for the period above because the law requires it, but your email address and name are removed from them as described;</li>
      <li>email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> for any other request.</li>
    </ul>
    <p>We will reply within one month. We may need to confirm your identity first.</p>

    <h3>Children</h3>
    <p>Many of our products are toys intended for children, but our shop is for adults buying for themselves or others. We do not knowingly create accounts for, or collect personal data from, children. Customers placing orders must be 18 or older. Parents or guardians may buy for children. Product age recommendations are separate from the purchaser-age requirement.</p>

    <h3>Security</h3>
    <p>Connections to our shop are encrypted, passwords are hashed, staff access to customer data requires two-step verification, and our database is encrypted and accessible only from our own servers.</p>

    <h3>Cookies and browser storage</h3>
    <p>See our <a href="/legal/cookies">Cookie Notice</a>.</p>

    <h3>Complaints</h3>
    <p>If you are unhappy with how we have used your data, please contact us first so we can put it right. You can also complain to the Information Commissioner's Office (ICO): <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a>, telephone 0303 123 1113.</p>

    <h3>Changes to this policy</h3>
    <p>If our use of personal data changes, we will update this page and the date at the top.</p>
  </LegalLayout>
}
