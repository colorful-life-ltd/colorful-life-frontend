import { COMPANY, registeredOfficeLine, trademarkNotice } from '../../features/legal/company'
import { ContactBlock, LegalLayout } from './LegalLayout'

/** Consumer terms. Statutory rights are summarised, never narrowed; commercial choices are owner placeholders. */
export function TermsAndConditions() {
  return <LegalLayout title="Terms & Conditions" updated="28 October 2026">
    <p>These terms apply when you buy from {COMPANY.brand}. Please read them before you order. You can save or print this page for your records.</p>

    <h3>1. Who we are</h3>
    <p>{COMPANY.brand} is a trading name of {COMPANY.legalName}, a company registered in {COMPANY.registeredIn} under company number {COMPANY.registrationNumber}, with its registered office at {registeredOfficeLine}. {COMPANY.legalName} is not VAT registered.</p>
    <ContactBlock />

    <h3>2. Your account</h3>
    <p>You need an account with a verified email address to buy. Keep your password private and tell us straight away if you think someone else has used your account. You must be 18 or older to place an order. Parents or guardians may buy for children; product age recommendations describe the product, not who may purchase it.</p>

    <h3>3. How to order</h3>
    <ol>
      <li>Add items to your cart and go to checkout.</li>
      <li>Choose a saved delivery address and a delivery method. The delivery charge is shown before you continue.</li>
      <li>Select <strong>Create order and review total</strong>. We reserve the items and show the final total, including delivery.</li>
      <li>Check your order. To correct a mistake before paying, go back to your cart or My Account to change items or addresses, and start a new order.</li>
      <li>Select <strong>Pay now</strong> and complete payment. Selecting Pay now places an order with an obligation to pay.</li>
    </ol>
    <p>When your payment is confirmed we send an order acknowledgment email with a commercial invoice. This acknowledges receipt of your order and payment; it is not acceptance of your order. Your orders stay available in My Account. These terms and our communications are in English.</p>
    <p>The sales contract is formed when we send you the dispatch confirmation email. Payment confirmation and an order acknowledgment do not by themselves form the contract.</p>
    <p>Before accepting your order, we may refuse it for objectively reasonable reasons, including insufficient stock, an obvious pricing error, payment verification failure, suspected fraud, an unsupported delivery address or a genuine fulfilment obstacle. We will notify you promptly and refund all captured payments in full via the original payment method. This is not a general right to cancel an accepted contract at will and does not limit your statutory rights.</p>

    <h3>4. Prices and payment</h3>
    <p>Prices are in pounds sterling. {COMPANY.legalName} is not VAT registered, so no VAT is charged. Delivery charges are shown at checkout before you place your order. We take payment through Stripe, using the payment methods shown at checkout. Payment is taken when you select Pay now and complete any check your bank asks for.</p>

    <h3>5. Products</h3>
    <p>We describe each item's condition. <strong>New</strong> means sealed and unused. <strong>New – Outer Box Damage</strong> means never built or played with, with complete contents and internal packaging, but cosmetic damage to the outer box, shown in the photographs. Age guidance and manufacturer safety warnings are shown on each product page. Please read them, especially for young children.</p>

    <h3>6. Delivery</h3>
    <p>See our <a href="/legal/delivery-returns">Delivery &amp; Returns</a> page for delivery areas, methods, charges and timescales. The goods become your responsibility once they are delivered to you or to someone you nominate.</p>

    <h3>7. Your right to cancel</h3>
    <p>You can generally notify us of cancellation within 14 days after receiving your goods, without giving a reason, and then have a further 14 days after notifying us to send them back. For a statutory change-of-mind cancellation you pay the direct return cost if disclosed before purchase. Opening the box alone does not remove your cancellation right. We offer no additional voluntary change-of-mind return window; applicable statutory exceptions and rights remain unaffected. How to cancel, return goods and get your refund is explained on our <a href="/legal/delivery-returns">Delivery &amp; Returns</a> page, and you can use our <a href="/legal/cancellation-form">model cancellation form</a>.</p>

    <h3>8. If something is wrong with your goods</h3>
    <p>Under the Consumer Rights Act 2015, goods must be as described, fit for purpose and of satisfactory quality. If they are not:</p>
    <ul>
      <li>within 30 days of delivery you can reject them for a full refund;</li>
      <li>after that, or if you prefer, you can ask for a repair or replacement;</li>
      <li>if a repair or replacement is not possible or does not fix the problem, you can ask for a price reduction or reject the goods for a refund.</li>
    </ul>
    <p>Please contact us before returning faulty goods. Nothing in these terms affects these legal rights. For more detailed information, see Citizens Advice.</p>

    <h3>9. Our responsibility to you</h3>
    <p>We are responsible for loss or damage you suffer that is a foreseeable result of our breaking these terms or failing to use reasonable care and skill. We do not exclude or limit our liability where it would be unlawful to do so, including for death or personal injury caused by our negligence, for fraud, or for breach of your legal rights as a consumer.</p>

    <h3>10. Complaints</h3>
    <p>If you have a complaint, email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> with your order number. We aim to send an initial response within 3 working days of receiving your complaint. This is not a promise of final resolution within that time and does not change any statutory deadline.</p>
    <p>We are not currently committed to a voluntary alternative dispute resolution (ADR) membership. If your complaint remains unresolved, we will explain our position and whether we are willing to participate in ADR. When communicating the outcome of a complaint, we will tell you about any ADR or other resolution arrangement available to you that we are obliged to participate in by law or contract. Nothing here limits your right to seek advice or bring a claim in court.</p>

    <h3>11. Your personal data</h3>
    <p>Our <a href="/legal/privacy">Privacy Policy</a> explains how we use your personal data.</p>

    <h3>12. Law and courts</h3>
    <p>These terms are governed by the law of England and Wales. You can bring proceedings in the courts of England and Wales. If you live in Scotland or Northern Ireland, you can also bring proceedings in your home courts.</p>

    <h3>13. Trade marks</h3>
    <p>{trademarkNotice} {COMPANY.brand} is an independent retailer.</p>
  </LegalLayout>
}
