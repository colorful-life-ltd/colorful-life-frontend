import { COMPANY, registeredOfficeLine, trademarkNotice } from '../../features/legal/company'
import { ContactBlock, LegalLayout, OwnerDecisionPlaceholder } from './LegalLayout'

/** Consumer terms. Statutory rights are summarised, never narrowed; commercial choices are owner placeholders. */
export function TermsAndConditions() {
  return <LegalLayout title="Terms & Conditions" updated="24 October 2026">
    <p>These terms apply when you buy from {COMPANY.brand}. Please read them before you order. You can save or print this page for your records.</p>

    <h2>1. Who we are</h2>
    <p>{COMPANY.brand} is a trading name of {COMPANY.legalName}, a company registered in {COMPANY.registeredIn} under company number {COMPANY.registrationNumber}, with its registered office at {registeredOfficeLine}. {COMPANY.legalName} is not VAT registered.</p>
    <ContactBlock />

    <h2>2. Your account</h2>
    <p>You need an account with a verified email address to buy. Keep your password private and tell us straight away if you think someone else has used your account. <OwnerDecisionPlaceholder id="purchaserAge" /></p>

    <h2>3. How to order</h2>
    <ol>
      <li>Add items to your cart and go to checkout.</li>
      <li>Choose a saved delivery address and a delivery method. The delivery charge is shown before you continue.</li>
      <li>Select <strong>Create order and review total</strong>. We reserve the items and show the final total, including delivery.</li>
      <li>Check your order. To correct a mistake before paying, go back to your cart or My Account to change items or addresses, and start a new order.</li>
      <li>Select <strong>Pay now</strong> and complete payment. Selecting Pay now places an order with an obligation to pay.</li>
    </ol>
    <p>When your payment is confirmed we send an order confirmation email with a commercial invoice. Your orders stay available in My Account. These terms and our communications are in English.</p>
    <p>When the contract is formed: <OwnerDecisionPlaceholder id="contractFormation" /></p>
    <p>If we cannot supply your order: <OwnerDecisionPlaceholder id="orderRefusal" /> If we cannot supply an item you have paid for, we will tell you and refund you in full.</p>

    <h2>4. Prices and payment</h2>
    <p>Prices are in pounds sterling. {COMPANY.legalName} is not VAT registered, so no VAT is charged. Delivery charges are shown at checkout before you place your order. We take payment through Stripe, using the payment methods shown at checkout. Payment is taken when you select Pay now and complete any check your bank asks for.</p>

    <h2>5. Products</h2>
    <p>We describe each item's condition. <strong>New</strong> means sealed and unused. <strong>New – Outer Box Damage</strong> means never built or played with, with complete contents and internal packaging, but cosmetic damage to the outer box, shown in the photographs. Age guidance and manufacturer safety warnings are shown on each product page. Please read them, especially for young children.</p>

    <h2>6. Delivery</h2>
    <p>See our <a href="/legal/delivery-returns">Delivery &amp; Returns</a> page for delivery areas, methods, charges and timescales. The goods become your responsibility once they are delivered to you or to someone you nominate.</p>

    <h2>7. Your right to cancel</h2>
    <p>You can cancel within 14 days of receiving your goods, without giving a reason. How to cancel, return goods and get your refund is explained on our <a href="/legal/delivery-returns">Delivery &amp; Returns</a> page, and you can use our <a href="/legal/cancellation-form">model cancellation form</a>.</p>

    <h2>8. If something is wrong with your goods</h2>
    <p>Under the Consumer Rights Act 2015, goods must be as described, fit for purpose and of satisfactory quality. If they are not:</p>
    <ul>
      <li>within 30 days of delivery you can reject them for a full refund;</li>
      <li>after that, or if you prefer, you can ask for a repair or replacement;</li>
      <li>if a repair or replacement is not possible or does not fix the problem, you can ask for a price reduction or reject the goods for a refund.</li>
    </ul>
    <p>Please contact us before returning faulty goods. Nothing in these terms affects these legal rights. For more detailed information, see Citizens Advice.</p>

    <h2>9. Our responsibility to you</h2>
    <p>We are responsible for loss or damage you suffer that is a foreseeable result of our breaking these terms or failing to use reasonable care and skill. We do not exclude or limit our liability where it would be unlawful to do so, including for death or personal injury caused by our negligence, for fraud, or for breach of your legal rights as a consumer.</p>

    <h2>10. Complaints</h2>
    <p>If you have a complaint, email <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a> with your order number. Response time: <OwnerDecisionPlaceholder id="complaintResponseTime" /> Alternative dispute resolution: <OwnerDecisionPlaceholder id="disputeResolution" /></p>

    <h2>11. Your personal data</h2>
    <p>Our <a href="/legal/privacy">Privacy Policy</a> explains how we use your personal data.</p>

    <h2>12. Law and courts</h2>
    <p>These terms are governed by the law of England and Wales. You can bring proceedings in the courts of England and Wales. If you live in Scotland or Northern Ireland, you can also bring proceedings in your home courts.</p>

    <h2>13. Trade marks</h2>
    <p>{trademarkNotice} {COMPANY.brand} is an independent retailer.</p>
  </LegalLayout>
}
