import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
const local=await readFile(new URL('../contracts/integration-v1.json',import.meta.url),'utf8')
let canonical
if(process.env.BACKEND_CONTRACT_FILE) canonical=await readFile(process.env.BACKEND_CONTRACT_FILE,'utf8')
else {
 const ref=(await readFile(new URL('../contracts/backend-ref.txt',import.meta.url),'utf8')).trim()
 assert.match(ref,/^[a-f0-9]{40}$/,'Contract source must be an immutable Backend commit')
 const response=await fetch(`https://raw.githubusercontent.com/colorful-life-ltd/colorful-life-backend/${ref}/contracts/integration-v1.json`,{signal:AbortSignal.timeout(20000)})
 assert.ok(response.ok,'Pinned Backend contract could not be fetched')
 canonical=await response.text()
}
assert.equal(local,canonical,'Client contract fixture drifted from its Backend-owned version')
console.log('Client contract matches its immutable Backend source')

if(process.env.BACKEND_CUSTOMER_INPUT_FILE) {
 const rules=await readFile(new URL('../src/features/account/customerInput.ts',import.meta.url),'utf8')
 assert.equal(rules,await readFile(process.env.BACKEND_CUSTOMER_INPUT_FILE,'utf8'),'Customer validation rules differ from Backend')
 console.log('Customer input validation matches Backend byte-for-byte')
}
if(process.env.BACKEND_PAYMENT_WINDOW_FILE) {
 assert.equal(await readFile(new URL('../contracts/payment-window-v1.json',import.meta.url),'utf8'),await readFile(process.env.BACKEND_PAYMENT_WINDOW_FILE,'utf8'),'Payment-window fixtures differ from Backend')
 console.log('Payment-window contract matches Backend byte-for-byte')
}
