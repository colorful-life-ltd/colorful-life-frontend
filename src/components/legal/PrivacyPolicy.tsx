import { COMPANY } from '../../features/legal/company'
import { ContactBlock, LegalLayout } from './LegalLayout'

/**
 * Describes the processing the code actually performs (backend schema, services and providers).
 * Update this page whenever a new provider, data field or purpose is introduced.
 */
export function PrivacyPolicy() {
  return <LegalLayout title="Privacy Policy" updated="29 October 2026">
    <p>This policy explains how {COMPANY.legalName}, trading as {COMPANY.brand} ("we", "us"), uses your personal data when you visit our shop, create an account or buy from us, and the rights you have under UK data protection law.</p>

    <h3>Who we are</h3>
    <p>{COMPANY.legalName} is the controller of your personal data. We remain responsible for our collection and use of your information and for meeting our obligations when sharing it with service providers. You can contact us about privacy at:</p>
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
      <li><strong>Google</strong> provides the custom-domain Gmail service we use for support email. When you contact us at <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>, Google processes your email address, message, attachments and related message information. Messages may include order, delivery, return or data-rights request details.</li>
      <li><strong>Cloudinary</strong> hosts product photographs. When you view a product, your browser downloads images from Cloudinary's servers, which receive your IP address and browser details as part of that request. We upload product media rather than customer account or order records; the browser request itself still conveys personal information such as your IP address.</li>
      <li><strong>Ideal Postcodes</strong>, when the address-lookup service is configured and you request a lookup, receives the postcode through our server to return address suggestions. It is not sent your saved recipient name or full saved address by this lookup.</li>
      <li><strong>Delivery companies</strong> (for example Royal Mail, Evri or DPD) receive the recipient name, address and, where needed, phone number for your order.</li>
      <li>Our professional advisers, and authorities such as HMRC or the police where the law requires it.</li>
    </ul>

    <h3>International transfers</h3>
    <p>Some providers process information outside the UK. For relevant international transfers, we rely on applicable UK adequacy regulations, including the UK Extension to the EU-US Data Privacy Framework for covered US recipients, or appropriate contractual safeguards in service agreements and incorporated data-processing terms. The applicable arrangement depends on the provider, destination and processing involved; London hosting does not mean that every provider activity stays in the UK.</p>
    <p>Further information is available in <a href="https://cloud.google.com/terms/data-processing-addendum/">Google's data-processing terms</a>, <a href="https://aws.amazon.com/compliance/gdpr-center/">AWS's UK GDPR information</a>, <a href="https://stripe.com/legal/dta">Stripe's transfer terms</a> and <a href="https://cloudinary.com/privacy">Cloudinary's privacy notice</a>. You can contact us for further information about the safeguards applicable to your information.</p>

    <h3>How long we keep it</h3>
    <p>We retain necessary transaction, payment, refund and accounting records to meet applicable legal obligations. Our adopted rule is generally six years from the end of the relevant financial year, with longer retention where required by applicable law, open disputes, investigations or enquiries. Not all financial or tax records have identical statutory periods; applicable category-specific requirements and exceptions take precedence. Necessary order-confirmation snapshots are included as transaction records. We review redundant copies and fields for possible minimisation. The relevant starting point and any longer or shorter period depend on the record and legal obligation, including accounting requirements and the need to establish, exercise or defend legal claims.</p>
    <p>Other personal information is kept only as long as necessary for the purpose for which it was collected, then deleted or anonymised where feasible and lawful. This includes account details, saved addresses, baskets, correspondence, email copies and security records. We assess the purpose, legal requirements and unresolved transactions or disputes before removing records.</p>
    <p>Our manual-review procedure covers accounts that remain unverified after 30 days; this is a review trigger, not an automatic deletion deadline. Routine support correspondence is subject to manual review after 12 months from resolution or the last substantive contact, not automatic deletion. We retain it longer where necessary for ongoing enquiries, disputes, legal obligations or legitimate unresolved matters. Quarterly manual reviews cover due correspondence and other outstanding retention cases.</p>
    <p>We do not promise automatic deletion after a fixed period. Backup copies, separate snapshots, exports and mailbox copies are assessed according to their recovery purpose, continued necessity and applicable legal or dispute holds. Removing data from the application does not necessarily remove it immediately from those copies or records held independently by payment providers. We do not promise immediate erasure from every copy.</p>

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
    <p>We use HTTPS, password hashing and restricted access to protect your information.</p>

    <h3>Cookies and browser storage</h3>
    <p>See our <a href="/legal/cookies">Cookie Notice</a>.</p>

    <h3>Complaints</h3>
    <p>If you are unhappy with how we have used your data, please contact us first so we can put it right. You can also complain to the Information Commissioner's Office (ICO): <a href="https://ico.org.uk/make-a-complaint/">ico.org.uk/make-a-complaint</a>, telephone 0303 123 1113.</p>

    <h3>Changes to this policy</h3>
    <p>If our use of personal data changes, we will update this page and the date at the top.</p>
  </LegalLayout>
}
