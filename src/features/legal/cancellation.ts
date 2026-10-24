import { COMPANY, returnsAddressLine } from './company'

export type CancellationFields = { order: string; goods: string; orderedOn: string; receivedOn: string; name: string; address: string; date: string }
export const emptyCancellation: CancellationFields = { order: '', goods: '', orderedOn: '', receivedOn: '', name: '', address: '', date: '' }

/** Customer-side only: the text is assembled in the browser and nothing is sent to our servers. */
export function cancellationEmailBody(f: CancellationFields) {
  return [
    `To: ${COMPANY.legalName} (trading as ${COMPANY.brand}), ${returnsAddressLine}, ${COMPANY.supportEmail}`, '',
    'I hereby give notice that I cancel my contract of sale of the following goods:',
    `${f.goods || '[goods]'}${f.order ? ` (order number ${f.order})` : ''}`, '',
    `Ordered on: ${f.orderedOn || '[date]'}`, `Received on: ${f.receivedOn || '[date]'}`,
    `Name of consumer: ${f.name || '[name]'}`, `Address of consumer: ${f.address || '[address]'}`, `Date: ${f.date || '[date]'}`,
  ].join('\n')
}
