import { requestJson } from '../auth/api'
import {
  returnStatuses,
  returnReasons,
  type ReturnCaseView,
  type ReturnRequest,
  type ReturnStatus,
} from './contract'
function parse(value: unknown, orderId: number): ReturnCaseView {
  if (!value || typeof value !== 'object')
    throw new Error('Return information is unavailable.')
  const v = value as ReturnCaseView
  if (
    v.orderId !== orderId ||
    !(v.reference === null || typeof v.reference === 'string') ||
    !Array.isArray(v.items) ||
    !Array.isArray(v.submissions)
  )
    throw new Error('Return information is unavailable.')
  for (const item of v.items)
    if (
      !Number.isSafeInteger(item.id) ||
      item.id < 1 ||
      typeof item.name !== 'string' ||
      !Number.isSafeInteger(item.remainingQuantity) ||
      item.remainingQuantity < 0
    )
      throw new Error('Return information is unavailable.')
  for (const s of v.submissions) {
    if (
      typeof s.id !== 'string' ||
      !Number.isFinite(Date.parse(s.requestedAt)) ||
      !Array.isArray(s.lines)
    )
      throw new Error('Return information is unavailable.')
    for (const l of s.lines) {
      if (
        !Number.isSafeInteger(l.id) ||
        !returnStatuses.includes(l.status as ReturnStatus) ||
        !returnReasons.includes(l.reason) ||
        !Number.isInteger(l.quantity) ||
        l.quantity < 1 ||
        !v.items.some((i) => i.id === l.orderItemId)
      )
        throw new Error('Return information is unavailable.')
      if (
        l.instructions &&
        (!Array.isArray(l.instructions.address) ||
          !l.instructions.address.every((a) => typeof a === 'string') ||
          typeof l.instructions.instructions !== 'string' ||
          typeof l.instructions.postageInstructions !== 'string' ||
          !['SELLER', 'CUSTOMER'].includes(l.instructions.shippingPayer))
      )
        throw new Error('Return instructions are unavailable.')
    }
  }
  return v
}
export const readReturns = async (token: string, orderId: number) =>
  parse(
    await requestJson<unknown>(`/orders/${orderId}/return-case`, {}, token),
    orderId,
  )
export const requestReturns = async (
  token: string,
  orderId: number,
  input: ReturnRequest,
) =>
  parse(
    await requestJson<unknown>(
      `/orders/${orderId}/return-requests`,
      { method: 'POST', body: JSON.stringify(input) },
      token,
    ),
    orderId,
  )
export const cancelReturn = async (
  token: string,
  orderId: number,
  lineId: number,
) =>
  parse(
    await requestJson<unknown>(
      `/orders/${orderId}/return-requests/${lineId}/cancel`,
      {
        method: 'POST',
        body: JSON.stringify({
          note: 'Customer withdrew the outstanding return request.',
        }),
      },
      token,
    ),
    orderId,
  )
