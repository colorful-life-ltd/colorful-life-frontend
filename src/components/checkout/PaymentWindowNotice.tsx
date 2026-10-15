import { parsePaymentWindow, paymentMessage } from '../../features/checkout/paymentWindow'

export function PaymentWindowNotice({ value, verification }: { value: unknown; verification?: 'active' | 'timeout' }) {
  const window = parsePaymentWindow(value)
  const format = (date: string) => new Date(date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  const message = verification && window?.state !== 'PAID'
    ? verification === 'active' ? 'Checking the submitted payment. Do not pay again while verification is in progress.' : 'Payment verification is still pending. This does not mean payment failed. Do not pay again.'
    : paymentMessage(window)
  return <div className="checkout__notice">
    <p role="status">{message}</p>
    {window && <>
      {window.paymentDeadline && <p>Payment window deadline: {format(window.paymentDeadline)}.</p>}
      {window.retryDeadline && <p>Retry window deadline: {format(window.retryDeadline)}.</p>}
      <p>Payment information checked: {format(window.evaluatedAt)}.</p>
      {window.paymentDeadline && <p>These times are informational. Available actions are checked when you continue; a payment already underway may still succeed later.</p>}
    </>}
  </div>
}
