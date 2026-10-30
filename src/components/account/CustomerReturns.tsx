import { AuthApiError } from '../../features/auth/api'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  readReturns,
  requestReturns,
  cancelReturn,
} from '../../features/returns/api'
import {
  returnLabel,
  returnReasons,
  type ReturnCaseView,
  type ReturnReason,
  type ReturnRequest,
} from '../../features/returns/contract'
import './CustomerReturns.css'
/** The proxy accepts at most 100k (100 × 1024 bytes) for a return request body. */
export const RETURN_REQUEST_MAX_BYTES = 100 * 1024
const TOO_LARGE =
  'Your return request is too large to send. Shorten the notes, then submit again.'
const date = (value: string) =>
  new Date(value).toLocaleString('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
const reasonLabel = (value: ReturnReason) =>
  value === 'CHANGE_OF_MIND'
    ? 'Statutory cancellation / changed my mind (no explanation required)'
    : returnLabel(value)
export function CustomerReturns({
  token,
  orderId,
}: {
  token: string
  orderId: number
}) {
  const [expanded, setExpanded] = useState(false),
    [data, setData] = useState<ReturnCaseView | null>(null),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(false),
    [pending, setPending] = useState(false),
    [revision, setRevision] = useState(0),
    [quantities, setQuantities] = useState<Record<number, number>>({}),
    [reasons, setReasons] = useState<Record<number, ReturnReason>>({}),
    [notes, setNotes] = useState<Record<number, string>>({}),
    [feedback, setFeedback] = useState(''),
    [uncertain, setUncertain] = useState(false),
    [cancelling, setCancelling] = useState<number | null>(null)
  const inFlight = useRef(false),
    draft = useRef<ReturnRequest | null>(null),
    generation = useRef({ version: 0 })
  useEffect(() => {
    if (!expanded) return
    let active = true
    const tracker = generation.current
    tracker.version++
    void Promise.resolve().then(async () => {
      setLoading(true)
      setError('')
      try {
        const view = await readReturns(token, orderId)
        if (active) setData(view)
      } catch {
        if (active)
          setError(
            'We could not load your return information. Please try again or contact support@build-and-bloom.co.uk.',
          )
      } finally {
        if (active) setLoading(false)
      }
    })
    return () => {
      active = false
      tracker.version++
    }
  }, [token, orderId, expanded, revision])
  const change = () => {
    draft.current = null
    setFeedback('')
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (inFlight.current || !data) return
    const lines = data.items
      .filter((item) => (quantities[item.id] ?? 0) > 0)
      .map((item) => ({
        orderItemId: item.id,
        quantity: quantities[item.id],
        reason: reasons[item.id] ?? 'CHANGE_OF_MIND',
        ...(notes[item.id]?.trim()
          ? { reasonNote: notes[item.id].trim() }
          : {}),
      }))
    if (!draft.current && !lines.length) {
      setError('Select at least one item and quantity.')
      return
    }
    if (
      !draft.current &&
      lines.some(
        (l) =>
          !Number.isInteger(l.quantity) ||
          l.quantity < 1 ||
          l.quantity >
            (data.items.find((i) => i.id === l.orderItemId)
              ?.remainingQuantity ?? 0),
      )
    ) {
      setError('Check the selected quantities.')
      return
    }
    if (!draft.current) {
      const candidate = { idempotencyKey: crypto.randomUUID(), lines }
      // Measure the exact serialized UTF-8 body sent by requestReturns.
      if (
        new TextEncoder().encode(JSON.stringify(candidate)).length >
        RETURN_REQUEST_MAX_BYTES
      ) {
        setError(TOO_LARGE)
        return
      }
      draft.current = candidate
    }
    inFlight.current = true
    setPending(true)
    setError('')
    const current = generation.current.version
    try {
      const view = await requestReturns(token, orderId, draft.current)
      if (current === generation.current.version) {
        setData(view)
        setQuantities({})
        setNotes({})
        draft.current = null
        setUncertain(false)
        setFeedback(
          'Your return request has been recorded. We will review each item; return instructions will appear here in My Account when authorised.',
        )
      }
    } catch (reason) {
      if (current === generation.current.version) {
        const refused =
          reason instanceof AuthApiError &&
          [400, 401, 403, 404, 409, 413, 422].includes(reason.status)
        if (refused) {
          // A definite refusal: nothing was recorded, so unlock the selection for editing.
          draft.current = null
          setUncertain(false)
          setError(
            reason.status === 413
              ? TOO_LARGE
              : 'The return request was refused. Refresh your return history and check the quantities and eligibility before revising your request, or contact support.',
          )
        } else {
          setUncertain(true)
          setError(
            'We could not confirm submission. Retry the original request with the same selection to avoid duplicates, or contact support.',
          )
        }
      }
    } finally {
      inFlight.current = false
      if (current === generation.current.version) setPending(false)
    }
  }
  async function cancel() {
    if (!cancelling || inFlight.current) return
    inFlight.current = true
    setPending(true)
    setError('')
    const current = generation.current.version
    try {
      const view = await cancelReturn(token, orderId, cancelling)
      if (current === generation.current.version) {
        setData(view)
        setCancelling(null)
        setFeedback('The outstanding return request was withdrawn.')
      }
    } catch {
      if (current === generation.current.version)
        setError(
          'We could not confirm withdrawal. Refresh the return history before retrying.',
        )
    } finally {
      inFlight.current = false
      if (current === generation.current.version) setPending(false)
    }
  }
  return (
    <section
      className="customer-returns"
      aria-labelledby={`return-title-${orderId}`}
    >
      <h3 id={`return-title-${orderId}`}>Returns for order #{orderId}</h3>
      {!expanded ? (
        <button
          className="checkout__secondary"
          onClick={() => setExpanded(true)}
        >
          Request Return / View return history
        </button>
      ) : (
        <>
          <button
            className="checkout__secondary"
            disabled={pending || loading}
            onClick={() => setRevision((r) => r + 1)}
          >
            Refresh return history
          </button>
          {loading && <p role="status">Loading your returns…</p>}
          {error && <p role="alert">{error}</p>}
          {feedback && <p role="status">{feedback}</p>}
          {data && !loading && (
            <>
              <p>
                {data.reference ? (
                  <>
                    <strong>
                      Permanent return reference: {data.reference}
                    </strong>
                    <br />
                    Additional requests for this order use the same reference.
                  </>
                ) : (
                  'Your first request creates one permanent return reference for this order.'
                )}
              </p>
              {data.submissions.map((s, index) => (
                <article className="customer-return-request" key={s.id}>
                  <h4>
                    Request {index + 1} · {date(s.requestedAt)}
                  </h4>
                  {s.lines.map((line) => (
                    <div className="customer-return-line" key={line.id}>
                      <h5>
                        {
                          data.items.find((i) => i.id === line.orderItemId)
                            ?.name
                        }{' '}
                        × {line.quantity}
                      </h5>
                      <p>
                        <strong>{returnLabel(line.status)}</strong> ·{' '}
                        {reasonLabel(line.reason)}
                        <br />
                        Requested {date(line.requestedAt)}
                      </p>
                      {line.reasonNote && <p>{line.reasonNote}</p>}
                      {line.rejectionNote && (
                        <p>
                          Decision: {line.rejectionNote}
                          <br />
                          If you disagree, contact
                          support@build-and-bloom.co.uk. Your statutory rights
                          are unaffected.
                        </p>
                      )}
                      {line.instructions && (
                        <aside className="customer-return-instructions">
                          <h5>Authorised return instructions</h5>
                          {line.status === 'CANCELLED' && (
                            <p>
                              This request was withdrawn. Contact support before
                              sending goods.
                            </p>
                          )}
                          <address>
                            {line.instructions.address.map((a, i) => (
                              <span key={i}>
                                {a}
                                <br />
                              </span>
                            ))}
                          </address>
                          <p>{line.instructions.instructions}</p>
                          <p>
                            Return postage paid by:{' '}
                            <strong>
                              {line.instructions.shippingPayer === 'SELLER'
                                ? 'Colorful Life Ltd'
                                : 'You'}
                            </strong>
                          </p>
                          <p>{line.instructions.postageInstructions}</p>
                        </aside>
                      )}
                      {line.authorizedAt && (
                        <p>Authorised {date(line.authorizedAt)}</p>
                      )}
                      {line.rejectedAt && (
                        <p>Rejected {date(line.rejectedAt)}</p>
                      )}
                      {line.cancelledAt && (
                        <p>Withdrawn {date(line.cancelledAt)}</p>
                      )}
                      {line.receivedAt && (
                        <p>
                          Goods received {date(line.receivedAt)}. Receipt does
                          not automatically issue a refund.
                        </p>
                      )}
                      {line.inspectedAt && (
                        <p>Inspected {date(line.inspectedAt)}</p>
                      )}
                      {line.completedAt && (
                        <p>
                          Return processing completed {date(line.completedAt)}.
                          Refunds are handled separately.
                        </p>
                      )}
                      {['REQUESTED', 'AUTHORIZED'].includes(line.status) && (
                        <button
                          className="checkout__secondary"
                          disabled={pending}
                          onClick={() => setCancelling(line.id)}
                        >
                          Withdraw request for this item
                        </button>
                      )}
                    </div>
                  ))}
                </article>
              ))}
              {!data.submissions.length && <p>No return requests yet.</p>}
              {uncertain || data.items.some((i) => i.remainingQuantity > 0) ? (
                <form onSubmit={(e) => void submit(e)}>
                  <h4>
                    {data.reference
                      ? 'Request another return'
                      : 'Request Return'}
                  </h4>
                  <p>
                    Choose the items and quantities. For a statutory
                    cancellation, you do not need to give an explanation. We
                    review faulty-goods claims separately. This form does not
                    limit your right to contact us by email or use the
                    cancellation form.
                  </p>
                  {data.items
                    .filter((i) => i.remainingQuantity > 0)
                    .map((item) => (
                      <fieldset disabled={pending || uncertain} key={item.id}>
                        <legend>
                          {item.name} · {item.remainingQuantity} available
                        </legend>
                        <label>
                          Quantity to return
                          <input
                            aria-label={`Return quantity for ${item.name}`}
                            type="number"
                            min={0}
                            max={item.remainingQuantity}
                            step={1}
                            value={quantities[item.id] ?? 0}
                            onChange={(e) => {
                              change()
                              setQuantities((q) => ({
                                ...q,
                                [item.id]: Number(e.target.value),
                              }))
                            }}
                          />
                        </label>
                        {(quantities[item.id] ?? 0) > 0 && (
                          <>
                            <label>
                              Return type
                              <select
                                value={reasons[item.id] ?? 'CHANGE_OF_MIND'}
                                onChange={(e) => {
                                  change()
                                  setReasons((r) => ({
                                    ...r,
                                    [item.id]: e.target.value as ReturnReason,
                                  }))
                                }}
                              >
                                {returnReasons.map((r) => (
                                  <option key={r} value={r}>
                                    {reasonLabel(r)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Notes (optional)
                              <textarea
                                maxLength={2000}
                                value={notes[item.id] ?? ''}
                                onChange={(e) => {
                                  change()
                                  setNotes((n) => ({
                                    ...n,
                                    [item.id]: e.target.value,
                                  }))
                                }}
                              />
                            </label>
                          </>
                        )}
                      </fieldset>
                    ))}
                  <p>
                    We determine return-postage responsibility under the
                    applicable policy and your consumer rights. Return
                    instructions will appear here in My Account after
                    authorisation.
                  </p>
                  <button className="checkout__primary" disabled={pending}>
                    {pending
                      ? 'Submitting…'
                      : uncertain
                        ? 'Retry original request'
                        : 'Submit return request'}
                  </button>
                </form>
              ) : (
                <p>
                  No additional quantity is currently available to request
                  online. Contact support if you need help, including with a
                  faulty-goods claim.
                </p>
              )}
            </>
          )}
          {cancelling && (
            <section role="alertdialog" aria-label="Withdraw return request">
              <p>
                Withdraw this outstanding request? Do not withdraw it if you
                have already posted the goods; contact support instead.
              </p>
              <button disabled={pending} onClick={() => setCancelling(null)}>
                Keep request
              </button>
              <button disabled={pending} onClick={() => void cancel()}>
                Confirm withdrawal
              </button>
            </section>
          )}
        </>
      )}
    </section>
  )
}
