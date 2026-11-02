import { AuthApiError } from '../../features/auth/api'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  readReturns,
  requestReturns,
  cancelReturn,
} from '../../features/returns/api'
import { returnStage, returnStatusLabel } from '../../features/orders/orderDetailView'
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
  initiallyOpen = false,
  onChanged,
  refreshSignal = 0,
}: {
  token: string
  orderId: number
  /** Open (and load) immediately when the order already has return requests. */
  initiallyOpen?: boolean
  /** Called after a recorded change or a manual refresh so the order status can be re-read. */
  onChanged?: () => void
  /** Bumped by "Refresh order": re-read quietly, keeping the current history on screen. */
  refreshSignal?: number
}) {
  const [expanded, setExpanded] = useState(initiallyOpen),
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
  const lastSignal = useRef(refreshSignal)
  useEffect(() => {
    if (lastSignal.current === refreshSignal) return
    lastSignal.current = refreshSignal
    if (!expanded) return
    let active = true
    const current = generation.current.version
    readReturns(token, orderId).then(
      (view) => { if (active && !inFlight.current && current === generation.current.version) setData(view) },
      () => { if (active) setError('We could not refresh your return information. Please try again or contact support@build-and-bloom.co.uk.') },
    )
    return () => { active = false }
  }, [refreshSignal, expanded, token, orderId])
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
        onChanged?.()
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
        onChanged?.()
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
  const itemName = (id: number) => data?.items.find((i) => i.id === id)?.name
  return (
    <section
      className="customer-returns order-detail__section"
      id="returns"
      aria-labelledby={`return-title-${orderId}`}
    >
      <div className="customer-returns__head">
        <h2 id={`return-title-${orderId}`}>Returns</h2>
        {expanded && (
          <button
            className="checkout__secondary customer-returns__refresh"
            disabled={pending || loading}
            onClick={() => {
              setRevision((r) => r + 1)
              onChanged?.()
            }}
          >
            Refresh returns
          </button>
        )}
      </div>
      {!expanded ? (
        <button
          className="checkout__secondary"
          onClick={() => setExpanded(true)}
        >
          Request a return
        </button>
      ) : (
        <>
          {loading && <p role="status">Loading your returns…</p>}
          {error && <p role="alert">{error}</p>}
          {feedback && <p role="status">{feedback}</p>}
          {data && !loading && (
            <>
              {data.reference && (
                <p className="customer-returns__reference">
                  Return reference <strong>{data.reference}</strong>
                </p>
              )}
              {data.submissions.map((s, index) => (
                <article className="customer-return-request" key={s.id}>
                  <h3>
                    Request {index + 1}
                    <span className="order-detail__muted">
                      {' '}
                      · {date(s.requestedAt)}
                    </span>
                  </h3>
                  {s.lines.map((line) => (
                    <div className="customer-return-line" key={line.id}>
                      <p className="customer-return-line__title">
                        <strong>
                          {itemName(line.orderItemId)} × {line.quantity}
                        </strong>
                        <span
                          className={`order-detail__pill order-detail__pill--${['declined', 'withdrawn'].includes(returnStage(line.status) ?? '') ? 'muted' : returnStage(line.status) === 'received' ? 'ok' : 'info'}`}
                        >
                          {returnStatusLabel(line.status)}
                        </span>
                      </p>
                      <p className="order-detail__muted">
                        {reasonLabel(line.reason)}
                        {line.authorizedAt &&
                          ` · Approved ${date(line.authorizedAt)}`}
                        {line.receivedAt &&
                          ` · Received ${date(line.receivedAt)}`}
                        {line.rejectedAt &&
                          ` · Declined ${date(line.rejectedAt)}`}
                        {line.cancelledAt &&
                          ` · Withdrawn ${date(line.cancelledAt)}`}
                      </p>
                      {line.reasonNote && (
                        <p className="customer-return-line__note">
                          Your note: {line.reasonNote}
                        </p>
                      )}
                      {line.rejectionNote && (
                        <p>
                          Reason: {line.rejectionNote} If you disagree, contact
                          support@build-and-bloom.co.uk. Your statutory rights
                          are unaffected.
                        </p>
                      )}
                      {line.instructions &&
                        ['RECEIVED', 'INSPECTED', 'COMPLETED'].includes(
                          line.status,
                        ) && (
                          <details className="customer-return-instructions-past">
                            <summary>Return instructions used</summary>
                            <p>
                              Reference {line.instructions.reference} · Return
                              postage paid by{' '}
                              {line.instructions.shippingPayer === 'SELLER'
                                ? 'Colorful Life Ltd'
                                : 'you'}
                            </p>
                          </details>
                        )}
                      {line.instructions &&
                        !['RECEIVED', 'INSPECTED', 'COMPLETED'].includes(
                          line.status,
                        ) && (
                        <aside className="customer-return-instructions">
                          <h4>Return instructions</h4>
                          {line.status === 'CANCELLED' && (
                            <p>
                              This request was withdrawn. Contact support before
                              sending goods.
                            </p>
                          )}
                          <p>
                            Include reference{' '}
                            <strong>{line.instructions.reference}</strong> with
                            the parcel.
                          </p>
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
                      {['REQUESTED', 'AUTHORIZED'].includes(line.status) && (
                        <button
                          className="checkout__secondary customer-return-line__withdraw"
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
              {uncertain || data.items.some((i) => i.remainingQuantity > 0) ? (
                <form
                  className="customer-returns__form"
                  onSubmit={(e) => void submit(e)}
                >
                  <h3>
                    {data.submissions.length
                      ? 'Request another return'
                      : 'Request a return'}
                  </h3>
                  <p className="order-detail__note">
                    Choose the items and quantities. You don’t need to give a
                    reason to cancel under your statutory rights; faulty-item
                    claims are reviewed separately. Return instructions will
                    appear here in My Account after authorisation — please don’t
                    post anything before then. You can still cancel by email
                    or with the cancellation form if you prefer.
                  </p>
                  {data.items
                    .filter((i) => i.remainingQuantity > 0)
                    .map((item) => (
                      <fieldset disabled={pending || uncertain} key={item.id}>
                        <legend>
                          {item.name}{' '}
                          <span className="order-detail__muted">
                            · {item.remainingQuantity} available
                          </span>
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
                  <button className="checkout__primary" disabled={pending}>
                    {pending
                      ? 'Submitting…'
                      : uncertain
                        ? 'Retry original request'
                        : 'Submit return request'}
                  </button>
                </form>
              ) : (
                <p className="order-detail__note">
                  Every item in this order already has a return request. For
                  anything else, including a faulty item, contact
                  support@build-and-bloom.co.uk.
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
