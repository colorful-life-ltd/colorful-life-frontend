import type { ReactNode } from 'react'
import { COMPANY } from '../legal/company'

export type FaqQuestion = { id: string; question: string; answer: ReactNode }
export type FaqCategory = { id: string; title: string; questions: readonly FaqQuestion[] }
const support = <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>
const returns = <a href="/legal/delivery-returns">Delivery &amp; Returns</a>
/** Static V1 answers. Policy changes must be checked against the approved legal pages before release. */
export const FAQ_CATEGORIES = [
  { id: 'shopping', title: 'Choosing a set', questions: [
    { id: 'find-a-set', question: 'How do I find a set?', answer: <>Browse Our Catalogue by collection, or use Find a Set in Contents to search by name or set number.</> },
    { id: 'product-condition', question: 'What do the product conditions mean?', answer: <>New means sealed and unused. New – Outer Box Damage means never built or played with, with complete contents and internal packaging, but cosmetic damage to the outer box. Read the description and check the condition photographs before buying.</> },
    { id: 'choose-an-offer', question: 'Why does a set have more than one offer?', answer: <>A set may have separate offers with different conditions, prices and stock. Choose the offer you want on its product-details page before adding it to your basket.</> },
    { id: 'age-guidance', question: 'What does the age guidance mean?', answer: <>It is product guidance, not the purchaser-age requirement. Read the product description and any safety warnings. Customers placing orders must be 18 or older; parents or guardians may buy for children.</> },
    { id: 'sold-out', question: 'Can I order a sold-out set?', answer: <>Only available stock can be purchased. More on the Way indicates an expected restock, not a backorder option. Contact {support} if you need help choosing an available set.</> },
  ] },
  { id: 'delivery', title: 'Delivery', questions: [
    { id: 'delivery-area', question: 'Where do you deliver?', answer: <>Our delivery policy covers England, Scotland, Wales and Northern Ireland. See {returns} for details. If checkout cannot offer delivery to your address, contact {support} before placing an order.</> },
    { id: 'delivery-cost', question: 'How much does delivery cost?', answer: <>The available delivery methods, charges and estimates are shown at checkout before you pay. You can also view the current delivery table in {returns}. We do not quote a fixed charge here because the checkout total is authoritative.</> },
    { id: 'dispatch-time', question: 'When will my order be dispatched?', answer: <>We normally dispatch within 2–3 working days after order confirmation. This is dispatch time, not a guaranteed delivery date. We will contact you if a genuine exception delays dispatch. Your statutory delivery rights are unaffected.</> },
    { id: 'delivery-problem', question: 'What if my parcel is late, missing or damaged?', answer: <>Email {support} with your order number and a description of the problem. Include photographs where useful for damage. See {returns} for your rights; delivery estimates are not guaranteed dates.</> },
  ] },
  { id: 'orders-payments', title: 'Orders & payments', questions: [
    { id: 'payment-options', question: 'How can I pay?', answer: <>Use the payment options actually offered at checkout. Availability can vary; do not assume a particular wallet is supported. In the clearly marked Sandbox, use test accounts and test money only.</> },
    { id: 'payment-uncertain', question: 'What if payment is interrupted or the result is unclear?', answer: <>Open the existing order in My Orders and follow its payment-status or recovery instructions. Do not treat a provider redirect alone as proof of payment, and avoid starting another payment while the outcome is unresolved. Contact {support} if it stays unclear.</> },
    { id: 'my-orders', question: 'Where can I see my orders?', answer: <>Sign in, open My Account and choose My Orders. Open an order for its details and the available payment or delivery information.</> },
    { id: 'order-acceptance', question: 'Does an order acknowledgment mean my order has been accepted?', answer: <>No. It acknowledges receipt of your order and payment. The sales contract is formed when we send the dispatch confirmation email. See our <a href="/legal/terms">Terms &amp; Conditions</a>.</> },
  ] },
  { id: 'returns-refunds', title: 'Cancellations, returns & refunds', questions: [
    { id: 'cancel-order', question: 'How do I cancel an order?', answer: <>Tell us clearly by emailing {support} with your order number. You may use the <a href="/legal/cancellation-form">model cancellation form</a>, but do not have to. You can also cancel before your order arrives. See {returns} for full instructions.</> },
    { id: 'return-period', question: 'How long do I have to cancel and return goods?', answer: <>For a statutory change-of-mind cancellation, you generally have 14 days after receipt to give notice, then a further 14 days after notifying us to send the goods back. We offer no additional voluntary change-of-mind window. Applicable statutory exceptions and rights, including any legally extended period, are unaffected.</> },
    { id: 'return-postage', question: 'Who pays return postage?', answer: <>For a statutory change-of-mind cancellation, you pay the direct return cost if this was disclosed before purchase. If it was not disclosed, we bear that cost. Faulty, misdescribed or otherwise non-conforming goods have separate statutory protection; see {returns}.</> },
    { id: 'opened-box', question: 'Can I cancel if I have opened the box?', answer: <>Opening the box alone does not remove your statutory cancellation right. There is no automatic refusal or deduction for opened or assembled sets. A lawful deduction may reflect actual diminished value caused by handling beyond what is necessary to establish the goods’ nature, characteristics and functioning, subject to the required cancellation information having been supplied.</> },
    { id: 'refund-timing', question: 'When will a cancellation refund be made?', answer: <>For a statutory cancellation, we refund without undue delay and within 14 days of receiving the goods back or evidence of sending them back, whichever is earlier. If you cancel before dispatch, we refund within 14 days of your notice. We use the original payment method and reimburse standard outward delivery, subject to the rules in {returns}. This is not a promise of a particular bank or provider posting time.</> },
    { id: 'faulty-goods', question: 'What if an item is faulty, incomplete or not as described?', answer: <>Contact {support} with your order number and details, with photographs where helpful. Your statutory rights are separate from change-of-mind cancellation and include remedies for non-conforming goods. See {returns}; do not assume the change-of-mind time limit removes faulty-goods rights.</> },
  ] },
  { id: 'account-support', title: 'Account & support', questions: [
    { id: 'verification-email', question: 'I have not received my verification email. What should I do?', answer: <>Check your spam or junk folder and that you entered the right email address. Follow the verification or resend instructions shown when signing in. If you still need help, email {support}; never send us your password or verification link.</> },
    { id: 'forgot-password', question: 'What if I have forgotten my password?', answer: <>Use the password-reset option on the sign-in form and follow the emailed instructions. Contact {support} if you cannot regain access. Do not send passwords or reset links by email.</> },
    { id: 'personal-data', question: 'How do I ask about my personal data?', answer: <>Email {support} to request access, correction or deletion, or ask about retained records. We may need to verify your identity. See our <a href="/legal/privacy">Privacy Policy</a>. We do not promise that account closure erases every order or financial record.</> },
    { id: 'contact-support', question: 'How do I contact you or make a complaint?', answer: <>Email {support}, including your order number where relevant. We aim to send an initial complaint response within 3 working days, not necessarily a final resolution. Statutory deadlines and rights remain unaffected. Please do not email card details, passwords or payment credentials.</> },
  ] },
] as const satisfies readonly FaqCategory[]
