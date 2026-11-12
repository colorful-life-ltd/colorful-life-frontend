import { useEffect, useRef, useState, type FormEvent } from 'react'
import { AuthApiError, verifyEmail } from '../../features/auth/api'
import { passwordPolicyError } from '../../features/auth/passwordReset'
import { BotanicalDivider } from '../shared/BotanicalDivider'
import { ResendVerificationForm } from './ResendVerificationForm'
import '../checkout/Checkout.css'

export function VerifyEmail({ onSignIn }: { onSignIn: () => void }) {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token')?.trim() ?? '')
  const [phase,setPhase] = useState<'ready'|'verifying'|'success'|'invalid'|'failure'|'missing'>(token ? 'ready' : 'missing')
  const [password,setPassword] = useState(''), [confirmation,setConfirmation] = useState(''), [error,setError] = useState('')
  const lock=useRef(false)
  useEffect(() => {
    const url=new URL(window.location.href);url.searchParams.delete('token')
    window.history.replaceState(window.history.state,'',`${url.pathname}${url.search}${url.hash}`)
  }, [])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();if(lock.current)return
    const problem=passwordPolicyError(password)
    if(problem){setError(problem);return}if(password!==confirmation){setError('Passwords do not match.');return}
    lock.current=true;setError('');setPhase('verifying')
    try { await verifyEmail(token,password);setPassword('');setConfirmation('');setPhase('success') }
    catch (reason) { setPhase(reason instanceof AuthApiError && reason.status===400 ? 'invalid' : 'failure') }
    finally {lock.current=false}
  }
  return <main className="checkout" tabIndex={-1}><div className="checkout__paper">
    <p className="checkout__eyebrow">Build &amp; Bloom · Your account</p><h1>{phase==='success' ? 'Email verified' : 'Email verification'}</h1>
    {(phase==='ready'||phase==='verifying'||phase==='failure') && <form onSubmit={event => void submit(event)}>
      <p>Choose a password to finish verifying your email and secure your account.</p>
      <label>New password<input type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} required /></label>
      <label>Confirm password<input type="password" autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} required /></label>
      {error && <p role="alert">{error}</p>}{phase==='failure' && <p role="alert">We could not confirm verification. Please try again.</p>}
      <button type="submit" disabled={phase==='verifying'}>{phase==='verifying' ? 'Verifying…' : 'Verify and set password'}</button>
    </form>}
    {phase==='success' && <><p role="status">Your email has been verified. You can now sign in.</p><button onClick={onSignIn}>Sign in</button></>}
    {phase==='missing' && <p role="alert">This link has no verification token. Request a new verification email.</p>}
    {phase==='invalid' && <p role="alert">This verification link is invalid, expired, or already used.</p>}
    {(phase==='invalid'||phase==='missing') && <ResendVerificationForm />}
    <BotanicalDivider />
  </div></main>
}
