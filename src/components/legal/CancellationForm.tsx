import { useState } from 'react'
import { COMPANY, registeredOfficeLine } from '../../features/legal/company'
import { cancellationEmailBody, emptyCancellation, type CancellationFields } from '../../features/legal/cancellation'
import { LegalLayout } from './LegalLayout'

/** Model cancellation form (Consumer Contracts Regulations 2013, Schedule 3 Part B). */
export function CancellationForm() {
  const [fields, setFields] = useState<CancellationFields>(emptyCancellation)
  const field = (key: keyof CancellationFields, label: string, type: 'text' | 'date' = 'text', multiline = false) => <label className="legal-form__field">
    <span>{label}</span>
    {multiline ? <textarea value={fields[key]} rows={3} onChange={event => setFields({ ...fields, [key]: event.target.value })} />
      : <input type={type} value={fields[key]} onChange={event => setFields({ ...fields, [key]: event.target.value })} />}
  </label>
  const mailto = `mailto:${COMPANY.supportEmail}?subject=${encodeURIComponent(`Cancellation${fields.order ? ` of order ${fields.order}` : ''}`)}&body=${encodeURIComponent(cancellationEmailBody(fields))}`
  return <LegalLayout title="Cancellation Form" updated="24 October 2026">
    <p>Complete and return this form only if you wish to cancel your contract. You do not have to use it: a clear email or letter is enough. See <a href="/legal/delivery-returns">Delivery &amp; Returns</a> for how cancellation and refunds work.</p>
    <section className="legal-form" aria-labelledby="model-form-heading">
      <h3 id="model-form-heading">Model cancellation form</h3>
      <p>To: {COMPANY.legalName} (trading as {COMPANY.brand}), {registeredOfficeLine}. Email: {COMPANY.supportEmail}</p>
      <p>I hereby give notice that I cancel my contract of sale of the following goods:</p>
      {field('goods', 'Goods (item names)', 'text', true)}
      {field('order', 'Order number (optional)')}
      {field('orderedOn', 'Ordered on', 'date')}
      {field('receivedOn', 'Received on', 'date')}
      {field('name', 'Name of consumer')}
      {field('address', 'Address of consumer', 'text', true)}
      <p className="legal-form__signature">Signature of consumer (only if this form is sent on paper): ______________________</p>
      {field('date', 'Date', 'date')}
      <div className="legal-form__actions">
        <a className="legal-form__button" href={mailto}>Email this form to us</a>
        <button type="button" className="legal-form__button" onClick={() => window.print()}>Print this form</button>
      </div>
      <p className="legal-form__note">Selecting "Email this form to us" opens your own email app with the details filled in. Nothing is sent until you send that email.</p>
    </section>
  </LegalLayout>
}
