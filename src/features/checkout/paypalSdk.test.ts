// @vitest-environment jsdom
import {it,expect,vi} from 'vitest'
it('loads only explicit GBP capture Buttons with isolated namespace, and refuses mismatched config',async()=>{
 vi.resetModules();const {loadPayPalSandbox}=await import('./paypalSdk')
 await expect(loadPayPalSandbox('')).rejects.toThrow();expect(document.querySelector('script')).toBeNull()
 const loaded=loadPayPalSandbox('synthetic-sandbox-client-id')
 const script=document.querySelector('script')!;const url=new URL(script.src)
 expect(url.origin).toBe('https://www.paypal.com');expect(url.searchParams.get('currency')).toBe('GBP');expect(url.searchParams.get('intent')).toBe('capture');expect(url.searchParams.get('components')).toBe('buttons');expect(url.searchParams.get('buyer-country')).toBe('GB');expect(script.dataset.namespace).toBe('colorfulSandboxPayPal')
 await expect(loadPayPalSandbox('different-client-id')).rejects.toThrow()
 const fake={Buttons:vi.fn()};window.colorfulSandboxPayPal=fake;script.onload!(new Event('load'));expect(await loaded).toBe(fake)
 script.remove();delete window.colorfulSandboxPayPal
})
