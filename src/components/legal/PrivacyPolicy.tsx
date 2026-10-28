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

    <h3>The personal data we collect</h3>
    <ul>
      <li><strong>Account details:</strong> your email address and password. We store only a secure one-way hash of your password, never the password itself. You may add your first name, last name and phone number.</li>
      <li><strong>Addresses:</strong> the delivery and billing addresses you save, including the recipient name and an optional phone number.</li>
      <li><strong>Orders:</strong> what you bought, prices, delivery method and charge, the delivery and billing address used, order status, cancellations, returns, refunds and dispatch details such as the carrier and tracking number.</li>
      <li><strong>Payments:</strong> the payment provider, amount, currency, status and dates. Depending on the payment option, you provide payment details directly to Stripe or PayPal. We do not receive or store your full card number or security code.</li>
      <li><strong>Your basket:</strong> the items in your cart.</li>
      <li><strong>Messages:</strong> what you send us by email, for example about an order or a return.</li>
      <li><strong>Security information:</strong> to stop abuse such as password guessing or card testing, we count recent attempts per network address and account. Payment-abuse counters use keyed codes derived from network addresses. Hosting, security logs and payment providers may separately process IP addresses and device information.</li>
    </ul>
    <p>We have not integrated separate analytics, advertising or social-media tracking tools into this storefront. Payment providers process technical and security information under their own notices. We do not send marketing emails or sell your data.</p>

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
      <li><strong>Stripe and PayPal:</strong> Stripe processes card payments and helps prevent fraud. PayPal may also process your information if it is offered at checkout and you choose it. These providers receive transaction identifiers and amounts, and collect payment and technical information directly when you use their payment services. They also act as controllers for some processing under their own privacy notices: <a href="https://stripe.com/privacy">Stripe</a> and <a href="https://www.paypal.com/uk/legalhub/paypal/privacy-full">PayPal</a>.</li>
      <li><strong>Amazon Web Services (AWS)</strong> provides our London application hosting and database infrastructure and sends transactional emails through Amazon SES. Those emails may contain account-verification links, order information, delivery addresses and invoices. London hosting does not mean that every provider activity or email recipient is confined to the UK.</li>
      <li><strong>Cloudinary</strong> hosts product photographs. When you view a product, your browser downloads images from Cloudinary's servers, which receive your IP address and browser details as part of that request. We upload product media rather than customer account or order records; the browser request itself still conveys personal information such as your IP address.</li>
      <li><strong>Ideal Postcodes</strong>, when the address-lookup service is configured and you request a lookup, receives the postcode through our server to return address suggestions. It is not sent your saved recipient name or full saved address by this lookup.</li>
      <li><strong>Delivery companies</strong> (for example Royal Mail, Evri or DPD) receive the recipient name, address and, where needed, phone number for your order.</li>
      <li>Our professional advisers, and authorities such as HMRC or the police where the law requires it.</li>
    </ul>

    <h3>International transfers</h3>
    <p>Some service providers process information outside the UK. The applicable safeguard depends on the receiving entity, destination and service; a UK hosting region alone does not settle this. We are still checking the account-specific arrangements and any required transfer assessments.</p>
    <ul>
      <li><strong>AWS:</strong> its published <a href="https://aws.amazon.com/compliance/gdpr-center/">UK GDPR terms</a> include a UK GDPR Addendum and contractual transfer clauses for relevant restricted transfers.</li>
      <li><strong>Stripe:</strong> its published <a href="https://stripe.com/legal/dta">Data Transfers Addendum</a> describes the Data Privacy Framework and a UK International Data Transfer Addendum, with the applicable mechanism determined by its terms.</li>
      <li><strong>PayPal:</strong> its <a href="https://www.paypal.com/uk/legalhub/paypal/privacy-full">UK privacy notice</a> describes adequacy decisions, the UK IDTA or UK Addendum, or an applicable derogation for relevant transfers. We have not verified which mechanism covers each account-specific flow.</li>
      <li><strong>Cloudinary:</strong> its <a href="https://cloudinary.com/privacy">privacy notice</a> describes international processing and participation in the UK Extension to the Data Privacy Framework. Its content-processing DPA has a separate contractual scope; we have not verified the terms and transfer coverage applicable to our account and image-delivery traffic.</li>
    </ul>
    <p>These are descriptions of published provider terms, not a claim that our transfer review is complete. You may contact us for further information about the safeguards applicable to your information. <OwnerDecisionPlaceholder id="transferSafeguards" /></p>

    <h3>How long we keep it</h3>
    <p>Our policy is generally to retain necessary transaction, payment, refund and accounting records for six years, subject to applicable legal requirements. Necessary order-confirmation snapshots are included as transaction records. We review redundant copies and fields for possible minimisation. The relevant starting point and any longer or shorter period depend on the record and legal obligation, including accounting requirements and the need to establish, exercise or defend legal claims.</p>
    <p>Other personal information is kept only as long as necessary for the purpose for which it was collected, then deleted or anonymised where feasible and lawful. This includes account details, saved addresses, baskets, correspondence, email copies and security records. We assess the purpose, legal requirements and unresolved transactions or disputes before removing records.</p>
    <p>We do not promise automatic deletion after a fixed period. The operational retention schedule, including treatment of email snapshots, logs and backups, is still being checked. Removing data from the application does not necessarily remove it immediately from backups or records held independently by payment providers. <OwnerDecisionPlaceholder id="retentionPeriods" /></p>

    <h3>Your rights</h3>
    <p>You have the right to access your data, to have it corrected, to have it deleted, to restrict or object to its use, and to receive it in a portable format. You can:</p>
    <ul>
      <li>email us to request access to or a copy of your personal information;</li>
      <li>correct your profile and addresses in <strong>My Account</strong>;</li>
      <li>request account deletion in <strong>My Account → Your data</strong>. The account-deletion service removes saved addresses and replaces account identifiers, but does not erase all order, payment or email records. Contact us about any information retained for legal, accounting or unresolved-transaction reasons;</li>
      <li>email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> for any other request.</li>
    </ul>
    <p>We normally respond to data-rights requests within one month. Where the law allows an extension, we will explain it. We may need to confirm your identity first.</p>

    <h3>Children</h3>
    <p>Many of our products are toys intended for children, but our shop is for adults buying for themselves or others. We do not knowingly create accounts for, or collect personal data from, children. Customers placing orders must be 18 or older. Parents or guardians may buy for children. Product age recommendations are separate from the purchaser-age requirement.</p>

    <h3>Security</h3>
    <p>We use HTTPS, password hashing and access controls to protect personal information. Infrastructure configuration, access permissions, retention and recovery procedures require ongoing review.</p>

    <h3>Cookies and browser storage</h3>
    <p>See our <a href="/legal/cookies">Cookie Notice</a>.</p>

    <h3>Complaints</h3>
    <p>If you are unhappy with how we have used your data, please contact us first so we can put it right. You can also complain to the Information Commissioner's Office (ICO): <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a>, telephone 0303 123 1113.</p>

    <h3>Changes to this policy</h3>
    <p>If our use of personal data changes, we will update this page and the date at the top.</p>
  </LegalLayout>
}
