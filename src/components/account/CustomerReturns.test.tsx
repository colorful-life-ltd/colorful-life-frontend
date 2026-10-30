import { AuthApiError } from '../../features/auth/api'
// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CustomerReturns, RETURN_REQUEST_MAX_BYTES } from './CustomerReturns'
import {
  readReturns,
  requestReturns,
  cancelReturn,
} from '../../features/returns/api'
import type { ReturnCaseView } from '../../features/returns/contract'
vi.mock('../../features/returns/api', () => ({
  readReturns: vi.fn(),
  requestReturns: vi.fn(),
  cancelReturn: vi.fn(),
}))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const empty: ReturnCaseView = {
  orderId: 41,
  reference: null,
  caseId: null,
  items: [
    {
      id: 1,
      name: 'LEGO Flowers',
      quantity: 3,
      remainingQuantity: 3,
      condition: 'NEW',
    },
  ],
  submissions: [],
}
const requested: ReturnCaseView = {
  ...empty,
  reference: 'BB-R-41',
  caseId: 'case-41',
  items: [{ ...empty.items[0], remainingQuantity: 2 }],
  submissions: [
    {
      id: 'submission-1',
      requestedAt: '2026-10-29T12:00:00Z',
      lines: [
        {
          id: 10,
          orderItemId: 1,
          quantity: 1,
          reason: 'CHANGE_OF_MIND',
          reasonNote: null,
          status: 'REQUESTED',
          requestedAt: '2026-10-29T12:00:00Z',
          authorizedAt: null,
          receivedAt: null,
          inspectedAt: null,
          completedAt: null,
          rejectedAt: null,
          cancelledAt: null,
          rejectionNote: null,
          shippingPayer: null,
          instructions: null,
        },
      ],
    },
  ],
}
let root: Root, container: HTMLDivElement
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(readReturns).mockResolvedValue(empty)
  vi.mocked(requestReturns).mockResolvedValue(requested)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})
const button = (name: string) => {
  const b = [...container.querySelectorAll('button')].find(
    (x) => x.textContent === name,
  )
  if (!b) throw Error('Missing ' + name)
  return b
}
async function click(name: string) {
  await act(async () => button(name).click())
}
async function mount() {
  await act(async () =>
    root.render(<CustomerReturns token="synthetic-token" orderId={41} />),
  )
}
async function open() {
  await mount()
  await click('Request Return / View return history')
}
async function quantity(n: number) {
  const node = container.querySelector('input[type=number]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value',
    )!.set!.call(node, String(n))
    node.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
async function submit() {
  await act(async () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  )
}
it('loads on demand and submits a cancellation without requiring an explanation or postage payer', async () => {
  await mount()
  expect(readReturns).not.toHaveBeenCalled()
  await click('Request Return / View return history')
  await quantity(1)
  await submit()
  expect(requestReturns).toHaveBeenCalledWith('synthetic-token', 41, {
    idempotencyKey: expect.any(String),
    lines: [{ orderItemId: 1, quantity: 1, reason: 'CHANGE_OF_MIND' }],
  })
  expect(container.textContent).toContain('BB-R-41')
  expect(container.textContent).toContain('Request another return')
  expect(container.querySelector('[name=shippingPayer]')).toBeNull()
})
it('preserves the exact idempotency key and payload after an uncertain response', async () => {
  vi.mocked(requestReturns)
    .mockRejectedValueOnce(new Error('connection lost'))
    .mockResolvedValueOnce(requested)
  await open()
  await quantity(1)
  await submit()
  const original = vi.mocked(requestReturns).mock.calls[0][2]
  expect(container.querySelector('fieldset')?.disabled).toBe(true)
  await submit()
  expect(vi.mocked(requestReturns).mock.calls[1][2]).toEqual(original)
  expect(container.textContent).toContain(
    'Your return request has been recorded',
  )
})
it('displays separate request states and the authorised address and seller postage instructions', async () => {
  const view = structuredClone(requested),
    line = view.submissions[0].lines[0]
  line.status = 'AUTHORIZED'
  line.instructions = {
    reference: 'BB-R-41',
    address: ['Colorful Life Ltd', '3 Hawthorne Drive', 'S63 8NS'],
    instructions: 'Pack securely with your reference.',
    postageInstructions: 'Contact support for a prepaid label.',
    shippingPayer: 'SELLER',
  }
  view.submissions.push({
    id: 'submission-2',
    requestedAt: '2026-10-29T14:00:00Z',
    lines: [{ ...line, id: 11, status: 'REQUESTED', instructions: null }],
  })
  vi.mocked(readReturns).mockResolvedValue(view)
  await open()
  expect(container.textContent).toContain('Request 1')
  expect(container.textContent).toContain('Request 2')
  expect(container.textContent).toContain('Authorised return instructions')
  expect(container.textContent).toContain('3 Hawthorne Drive')
  expect(container.textContent).toContain('prepaid label')
  expect(container.textContent).toContain(
    'Return postage paid by: Colorful Life Ltd',
  )
})
it('requires withdrawal confirmation and sends only the selected line', async () => {
  vi.mocked(readReturns).mockResolvedValue(requested)
  vi.mocked(cancelReturn).mockResolvedValue(requested)
  await open()
  await click('Withdraw request for this item')
  expect(cancelReturn).not.toHaveBeenCalled()
  await click('Confirm withdrawal')
  expect(cancelReturn).toHaveBeenCalledWith('synthetic-token', 41, 10)
})
it('rejects empty selection and exposes recoverable read errors', async () => {
  await open()
  await submit()
  expect(requestReturns).not.toHaveBeenCalled()
  expect(container.textContent).toContain('Select at least one item')
  vi.mocked(readReturns).mockRejectedValueOnce(new Error('offline'))
  await click('Refresh return history')
  expect(container.textContent).toContain(
    'We could not load your return information',
  )
})
it('prevents duplicate submissions while the request is in flight', async () => {
  let resolve!: (v: ReturnCaseView) => void
  vi.mocked(requestReturns).mockImplementation(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  await open()
  await quantity(1)
  await submit()
  await submit()
  expect(requestReturns).toHaveBeenCalledOnce()
  await act(async () => resolve(requested))
})

it('unlocks a definitely refused request so revised quantities use a fresh key', async () => {
  vi.mocked(requestReturns)
    .mockRejectedValueOnce(new AuthApiError(409, 'RETURN_TRANSITION_REFUSED'))
    .mockResolvedValueOnce(requested)
  await open()
  await quantity(2)
  await submit()
  const first = vi.mocked(requestReturns).mock.calls[0][2]
  expect(container.querySelector('fieldset')?.disabled).toBe(false)
  expect(container.textContent).toContain('request was refused')
  await quantity(1)
  await submit()
  const second = vi.mocked(requestReturns).mock.calls[1][2]
  expect(second.idempotencyKey).not.toEqual(first.idempotencyKey)
  expect(second.lines[0].quantity).toBe(1)
})

async function setValue(node: Element, value: string) {
  const proto = node instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value')!.set!.call(node, value)
    node.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

it('treats HTTP 413 as a definite rejection and lets the customer edit and resubmit', async () => {
  vi.mocked(requestReturns)
    .mockRejectedValueOnce(new AuthApiError(413, 'Request Entity Too Large'))
    .mockResolvedValueOnce(requested)
  await open()
  await quantity(1)
  await setValue(container.querySelector('textarea')!, 'Box arrived crushed.')
  await submit()
  const first = vi.mocked(requestReturns).mock.calls[0][2]
  expect(container.textContent).toContain('too large to send')
  expect(container.textContent).not.toContain('could not confirm submission')
  expect(container.querySelector('fieldset')?.disabled).toBe(false)
  await setValue(container.querySelector('textarea')!, 'Crushed box.')
  await submit()
  const second = vi.mocked(requestReturns).mock.calls[1][2]
  expect(second.idempotencyKey).not.toEqual(first.idempotencyKey)
  expect(second.lines[0].reasonNote).toBe('Crushed box.')
  expect(container.textContent).toContain('has been recorded')
})

it('blocks an oversized UTF-8 payload before sending and accepts it once shortened', async () => {
  // 20 lines × 2,000 three-byte characters (the textarea maxLength) is about 120 kB of UTF-8, over 100k.
  const items = Array.from({ length: 20 }, (_, i) => ({ ...empty.items[0], id: i + 1, name: `Set ${i + 1}` }))
  vi.mocked(readReturns).mockResolvedValue({ ...empty, items })
  await open()
  for (const node of container.querySelectorAll('input[type=number]')) await setValue(node, '1')
  const notes = [...container.querySelectorAll('textarea')]
  expect(notes).toHaveLength(20)
  for (const node of notes) await setValue(node, '€'.repeat(2000))
  const body = JSON.stringify({ idempotencyKey: crypto.randomUUID(), lines: items.map(i => ({ orderItemId: i.id, quantity: 1, reason: 'CHANGE_OF_MIND', reasonNote: '€'.repeat(2000) })) })
  expect(new TextEncoder().encode(body).length).toBeGreaterThan(RETURN_REQUEST_MAX_BYTES)
  await submit()
  expect(requestReturns).not.toHaveBeenCalled()
  expect(container.textContent).toContain('too large to send')
  expect(container.querySelector('fieldset')?.disabled).toBe(false)
  for (const node of notes) await setValue(node, 'Unwanted gift.')
  await submit()
  expect(requestReturns).toHaveBeenCalledOnce()
})

it('promises account instructions, not return emails, in the initial mail-disabled release', async () => {
  await open()
  expect(container.textContent).toContain('will appear here in My Account after authorisation')
  await quantity(1)
  await submit()
  expect(container.textContent).toContain('will appear here in My Account when authorised')
  expect(container.textContent).not.toMatch(/emailed|email return instructions/i)
})
