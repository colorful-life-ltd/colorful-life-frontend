import {it,expect,vi} from 'vitest'
import {renderToStaticMarkup} from 'react-dom/server'
vi.mock('../../features/checkout/sandbox',()=>({sandboxCheckout:true,registrationAvailable:false,sandboxClientId:'fixture'}))
import {SandboxBanner} from './SandboxBanner'
import {AccountView} from '../account/AccountForms'
import {AuthenticatedAccountHub} from '../homepage/AccountModal'
it('labels Sandbox and omits registration, password recovery and order-history links',()=>{
 expect(renderToStaticMarkup(<SandboxBanner/>)).toContain('No real payments')
 const form=renderToStaticMarkup(<AccountView mode="signin" onModeChange={()=>{}} onSubmit={()=>{}} submitting={false}/>)
 expect(form).not.toContain('Create Account');expect(form).not.toContain('Forgot password?');expect(form).toContain('Sign In')
 const hub=renderToStaticMarkup(<AuthenticatedAccountHub email="owner@example.invalid" onSignOut={()=>{}}/>)
 expect(hub).not.toContain('My Orders');expect(hub).toContain('My Account')
})
