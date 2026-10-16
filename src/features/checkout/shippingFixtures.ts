// Shared test data only: exact backend Issue #182 shapes. Production never uses these values.
import type { OrderFinancials, ShippingOptions } from './shipping'

export const shippingOptionsFixture: ShippingOptions = {
  currency: 'GBP',
  methods: [
    { code: 'STANDARD', method: 'Standard Delivery', chargePence: 399, minWorkingDays: 3, maxWorkingDays: 5, estimatesFrom: 'DISPATCH' },
    { code: 'EXPRESS', method: 'Express Delivery', chargePence: 799, minWorkingDays: 1, maxWorkingDays: 3, estimatesFrom: 'DISPATCH' },
  ],
}

export function financialsFixture(merchandiseSubtotal: string, code: 'STANDARD' | 'EXPRESS' | null = 'STANDARD'): OrderFinancials {
  const option = shippingOptionsFixture.methods.find(method => method.code === (code ?? 'STANDARD'))!
  const subtotalPence = Math.round(Number(merchandiseSubtotal) * 100)
  return { currency: 'GBP', merchandiseSubtotal, shipping: { ...option, code }, totalAmount: ((subtotalPence + option.chargePence) / 100).toFixed(2) }
}
