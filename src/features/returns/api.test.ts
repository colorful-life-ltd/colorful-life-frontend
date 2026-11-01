import { beforeEach, expect, it, vi } from 'vitest'
import { requestJson } from '../auth/api'
import { readReturns, requestReturns, cancelReturn } from './api'
vi.mock('../auth/api', () => ({ requestJson: vi.fn() }))
const view = {
  orderId: 41,
  reference: null,
  caseId: null,
  items: [
    {
      id: 1,
      name: 'LEGO Flowers',
      quantity: 2,
      remainingQuantity: 2,
      condition: 'NEW',
    },
  ],
  submissions: [],
}
beforeEach(() => vi.resetAllMocks())
it('uses customer-owned routes with authentication and no postage choice', async () => {
  vi.mocked(requestJson).mockResolvedValue(view)
  expect(await readReturns('jwt', 41)).toEqual(view)
  const input = {
    idempotencyKey: '77297a27-65f1-4d7b-bc24-672b71b32de9',
    lines: [{ orderItemId: 1, quantity: 1, reason: 'CHANGE_OF_MIND' as const }],
  }
  await requestReturns('jwt', 41, input)
  expect(requestJson).toHaveBeenLastCalledWith(
    '/orders/41/return-requests',
    { method: 'POST', body: JSON.stringify(input) },
    'jwt',
  )
  await cancelReturn('jwt', 41, 10)
  expect(requestJson).toHaveBeenLastCalledWith(
    '/orders/41/return-requests/10/cancel',
    expect.objectContaining({ method: 'POST' }),
    'jwt',
  )
})
it('fails closed on the wrong order or invalid availability', async () => {
  vi.mocked(requestJson)
    .mockResolvedValueOnce({ ...view, orderId: 42 })
    .mockResolvedValueOnce({
      ...view,
      items: [{ ...view.items[0], remainingQuantity: -1 }],
    })
  await expect(readReturns('jwt', 41)).rejects.toThrow()
  await expect(readReturns('jwt', 41)).rejects.toThrow()
})
it('propagates ownership and network failures rather than showing empty history', async () => {
  vi.mocked(requestJson).mockRejectedValue(new Error('ORDER_NOT_FOUND'))
  await expect(readReturns('jwt', 41)).rejects.toThrow('ORDER_NOT_FOUND')
})
