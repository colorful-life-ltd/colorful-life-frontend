import { requestJson } from '../auth/api'
import { parseOrderPayment, type Order } from '../checkout/api'

// The list projection deliberately has no payment or address fields.
export type OrderSummary = Pick<Order, 'id' | 'status' | 'totalAmount' | 'orderItems' | 'paymentWindow' | 'financials'> & {
  createdAt: string
  updatedAt: string
  shippingCarrier: string | null
  trackingNumber: string | null
  dispatchedAt: string | null
  completedAt: string | null
}
export type OrderDetail = Order & OrderSummary & {
  billingCounty: string | null
  billingPhone: string | null
  deliveryCounty: string | null
  deliveryPhone: string | null
}
export async function listOrders(token: string) {
  const orders = await requestJson<OrderSummary[]>('/orders', { method: 'GET' }, token)
  return orders.filter(order => order && Number.isSafeInteger(order.id) && order.id > 0).map(order => parseOrderPayment(order))
}
export async function readOrder(token: string, id: number) { return parseOrderPayment(await requestJson<OrderDetail>(`/orders/${id}`, { method: 'GET' }, token), id) }
