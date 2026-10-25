import { registrationAvailable, sandboxCheckout } from '../../features/checkout/sandbox'
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { COMPANY } from '../../features/legal/company'
import cottage from '../../assets/illustrations/opening-welcome-illustration.png'
import flower from '../../assets/decorations/catalogue-title-flower.png'
import { useAuth } from '../../features/auth/AuthProvider'
import { AuthApiError } from '../../features/auth/api'
import { passwordPolicyError, requestPasswordReset, RESET_REQUEST_COOLDOWN_SECONDS, resetRequestCooldownSeconds, startResetRequestCooldown } from '../../features/auth/passwordReset'
import './AccountExperience.css'
import { VerificationNotice } from './VerificationNotice'

export type AccountMode = 'signin' | 'create'
type FieldName = 'email' | 'password' | 'confirmPassword'
type Draft = Record<FieldName, string>
type FieldDefinition = { name: FieldName; label: string; type: 'email' | 'password'; autoComplete: string }
const email: FieldDefinition = { name: 'email', label: 'Email', type: 'email', autoComplete: 'email' }
const fields: Record<AccountMode, FieldDefinition[]> = {
  signin: [email, { name: 'password', label: 'Password', type: 'password', autoComplete: 'current-password' }],
  create: [
    email,
    { name: 'password', label: 'Password', type: 'password', autoComplete: 'new-password' },
    { name: 'confirmPassword', label: 'Confirm password', type: 'password', autoComplete: 'new-password' },
  ],
}
const emptyDraft: Draft = { email: '', password: '', confirmPassword: '' }

function PasswordIcon({ hidden }: { hidden: boolean }) {
  return hidden ? (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 4.2A10.7 10.7 0 0 1 12 4c5 0 8.7 4.3 10 8-0.5 1.4-1.3 2.8-2.4 4" />
      <path d="M6.2 6.2C4.6 7.4 3.4 9.1 2 12c1.3 3.7 5 8 10 8 1 0 1.9-.2 2.8-.5" />
    </svg>
  ) : (
    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  )
}

type AccountViewProps = {
  mode: AccountMode
  onModeChange: (mode: AccountMode) => void
  draft?: Draft
  onFieldChange?: (name: FieldName, value: string) => void
  onSubmit?: (event: FormEvent<HTMLFormElement>) => void
  error?: string
  submitting?: boolean
  onForgotPassword?: () => void
}

function AccountWelcome() {
  return <aside className="account-experience__welcome" aria-label="Build & Bloom">
    <p className="account-experience__brand">Build &amp; Bloom</p>
    <p className="account-experience__story">Small pieces.<br />A world of possibilities.</p>
    <img className="account-experience__art" src={cottage} alt="" />
    <p className="account-experience__caption">A little imagination belongs in every day.</p>
  </aside>
}

export function AccountView({ mode, onModeChange, draft = emptyDraft, onFieldChange, onSubmit, error, submitting, onForgotPassword }: AccountViewProps) {
  const creating = registrationAvailable && mode === 'create'
  const [visible, setVisible] = useState<Record<'password' | 'confirmPassword', boolean>>({ password: false, confirmPassword: false })
  return (
    <div className="account-experience" data-account-mode={mode}>
      <AccountWelcome />
      <div className="account-experience__task">
        <header className="account-experience__heading">
          <img src={flower} alt="" className="account-experience__flower" />
          <p className="account-experience__eyebrow">Your little corner of Build &amp; Bloom</p>
          <h2 id="account-task-title" tabIndex={-1}>{creating ? 'A little world,\nwith you in it.' : 'Welcome back!'}</h2>
          <p>{creating ? 'Create your account. Let’s start your next little story.' : 'Come on in. Your next little story is waiting.'}</p>
        </header>
        {error && <p className="account-form__message account-form__message--error" role="alert">{error}</p>}
        <form key={mode} className="account-form" aria-labelledby="account-task-title" onSubmit={onSubmit} noValidate>
          <div className="account-form__fields">
            {fields[creating ? 'create' : 'signin'].map(({ name, label, type, autoComplete }) => {
              const id = `account-${mode}-${name}`
              const isPassword = type === 'password'
              return (
                <div key={name} className={`account-form__field account-form__field--${name}`}>
                  <label htmlFor={id}>{label}</label>
                  <span className="account-form__input-wrap">
                    <input id={id} name={name} type={isPassword && visible[name as 'password' | 'confirmPassword'] ? 'text' : type} autoComplete={autoComplete}
                      autoCapitalize={type === 'email' ? 'none' : undefined}
                      spellCheck={type === 'email' ? false : undefined}
                      value={draft[name]} onChange={(event) => onFieldChange?.(name, event.target.value)} />
                    {isPassword && <button type="button" className="account-form__password-toggle"
                      aria-label={`${visible[name as 'password' | 'confirmPassword'] ? 'Hide' : 'Show'} ${name === 'confirmPassword' ? 'confirm password' : 'password'}`}
                      onClick={() => setVisible((current) => ({ ...current, [name]: !current[name as 'password' | 'confirmPassword'] }))}>
                      <PasswordIcon hidden={visible[name as 'password' | 'confirmPassword']} />
                    </button>}
                  </span>
                </div>
              )
            })}
          </div>
          {!sandboxCheckout && !creating && onForgotPassword && <button type="button" className="account-form__forgot" onClick={onForgotPassword}>Forgot password?</button>}
          {creating && <p className="account-form__legal" id="account-create-legal">
            By creating an account you agree to our <a href="/legal/terms" target="_blank" rel="noopener">Terms &amp; Conditions</a>.
            Our <a href="/legal/privacy" target="_blank" rel="noopener">Privacy Policy</a> explains how {COMPANY.legalName} (Build &amp; Bloom) uses your data.
          </p>}
          <button className="account-form__submit" type="submit" disabled={submitting}>{submitting ? 'Please wait…' : creating ? 'Create Account' : 'Sign In'}</button>
        </form>
        {registrationAvailable && <p className="account-experience__switch">
          {creating ? 'Already part of our little world?' : 'New to our little world?'}{' '}
          <button type="button" onClick={() => onModeChange(creating ? 'signin' : 'create')}>
            {creating ? 'Sign In' : 'Create Account'}<span aria-hidden="true"> →</span>
          </button>
        </p>}
      </div>
    </div>
  )
}

type ForgotPhase = 'editing' | 'sending' | 'sent'

/** Always ends in the same confirmation, so the response never reveals whether an account exists. */
export function ForgotPasswordView({ initialEmail = '', onBack }: { initialEmail?: string; onBack: () => void }) {
  const [address, setAddress] = useState(initialEmail)
  const [phase, setPhase] = useState<ForgotPhase>('editing')
  // A field error describes the email input; other failures belong to the whole request.
  const [error, setError] = useState<{ message: string; field: boolean }>()
  const sending = useRef(false)
  const confirmation = useRef<HTMLParagraphElement>(null)
  const [cooldown, setCooldown] = useState(() => resetRequestCooldownSeconds())
  // Announced once when a cooldown starts and once when it ends, never on every tick.
  const [announcement, setAnnouncement] = useState(() => cooldown > 0 ? `You can request another link in ${cooldown} seconds.` : '')
  const cooling = cooldown > 0
  const returningToForm = useRef(false)
  useEffect(() => {
    if (phase === 'sent') confirmation.current?.focus()
    if (phase === 'editing' && returningToForm.current) {
      returningToForm.current = false
      document.getElementById('account-forgot-email')?.focus()
    }
  }, [phase])
  useEffect(() => {
    if (!cooling) return
    const timer = window.setInterval(() => {
      const remaining = resetRequestCooldownSeconds()
      setCooldown(remaining)
      if (remaining === 0) setAnnouncement('You can request another link now.')
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooling])
  const beginCooldown = () => {
    startResetRequestCooldown()
    setCooldown(RESET_REQUEST_COOLDOWN_SECONDS)
    setAnnouncement(`You can request another link in ${RESET_REQUEST_COOLDOWN_SECONDS} seconds.`)
  }
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    // One request at a time, and none during the courtesy cooldown.
    if (sending.current || resetRequestCooldownSeconds() > 0) return
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address.trim())) {
      setError({ message: 'Enter a valid email address.', field: true })
      document.getElementById('account-forgot-email')?.focus()
      return
    }
    sending.current = true
    setError(undefined)
    setPhase('sending')
    try {
      await requestPasswordReset(address)
      beginCooldown()
      setPhase('sent')
    } catch (reason) {
      setPhase('editing')
      const status = reason instanceof AuthApiError ? reason.status : undefined
      if (status === 429) beginCooldown()
      // None of these messages depend on whether the account exists.
      setError(status === 400 ? { message: 'Enter a valid email address.', field: true }
        : status === 429 ? { message: 'Too many reset requests. Please wait a while before trying again.', field: false }
          : status === 503 ? { message: 'Password reset is temporarily unavailable. Please try again in a few minutes.', field: false }
            : { message: 'We couldn’t send your request. Please try again.', field: false })
    } finally {
      sending.current = false
    }
  }
  return (
    <div className="account-experience" data-account-mode="forgot">
      <AccountWelcome />
      <div className="account-experience__task">
        <header className="account-experience__heading">
          <img src={flower} alt="" className="account-experience__flower" />
          <p className="account-experience__eyebrow">Your little corner of Build &amp; Bloom</p>
          <h2 id="account-task-title" tabIndex={-1}>Forgot your password?</h2>
          <p>Enter your account email and we’ll send you a link to choose a new password.</p>
        </header>
        {phase === 'sent' ? <>
          <p ref={confirmation} tabIndex={-1} className="account-form__message account-form__message--success" role="status">
            If an account exists for that email, we’ve sent a password reset link. It expires in 1 hour. Please check your inbox and spam folder.
          </p>
          <button className="account-form__submit" type="button" disabled={cooldown > 0} aria-describedby="account-forgot-cooldown"
            onClick={() => { returningToForm.current = true; setPhase('editing') }}>
            {cooldown > 0 ? `Send another link in ${cooldown}s` : 'Send another link'}
          </button>
        </> : <>
          {error && <p id="account-forgot-error" className="account-form__message account-form__message--error" role="alert">{error.message}</p>}
          <form className="account-form" aria-labelledby="account-task-title" onSubmit={submit} noValidate>
            <div className="account-form__fields">
              <div className="account-form__field account-form__field--email">
                <label htmlFor="account-forgot-email">Email</label>
                <span className="account-form__input-wrap">
                  <input id="account-forgot-email" name="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck={false}
                    aria-invalid={error?.field || undefined} aria-describedby={error?.field ? 'account-forgot-error' : undefined}
                    value={address} onChange={event => { setError(undefined); setAddress(event.target.value) }} />
                </span>
              </div>
            </div>
            <button className="account-form__submit" type="submit" disabled={phase === 'sending' || cooldown > 0} aria-describedby={cooldown > 0 ? 'account-forgot-cooldown' : undefined}>
              {phase === 'sending' ? 'Please wait…' : cooldown > 0 ? `Send reset link in ${cooldown}s` : 'Send reset link'}
            </button>
          </form>
        </>}
        <p id="account-forgot-cooldown" className="account-form__cooldown" aria-live="polite">{announcement}</p>
        <p className="account-experience__switch">
          Remembered it?{' '}
          <button type="button" onClick={onBack}>Sign In<span aria-hidden="true"> →</span></button>
        </p>
      </div>
    </div>
  )
}

export type AccountFormsMode = 'signin' | 'forgot'

export function AccountForms({ initialMode = 'signin' }: { initialMode?: AccountFormsMode }) {
  const [mode, setMode] = useState<AccountMode | 'forgot'>(sandboxCheckout ? 'signin' : initialMode)
  const [drafts, setDrafts] = useState({ signin: emptyDraft, create: emptyDraft })
  const container = useRef<HTMLDivElement>(null)
  const previousMode = useRef(mode)
  const { state, authenticate, refreshAuth } = useAuth()
  const [restoring, setRestoring] = useState(false)
  const restoringLock = useRef(false)
  const [formError, setFormError] = useState<string>()
  const submitting = state.status === 'authenticating'
  const serverError = state.status === 'signedOut' ? state.error : state.status === 'error' ? state.message : state.status === 'verificationRequired' ? state.message : undefined
  useLayoutEffect(() => {
    if (previousMode.current !== mode) {
      container.current?.querySelector<HTMLElement>('#account-task-title')?.focus({ preventScroll: true })
      const surface = container.current?.closest('.account-modal__surface')
      if (surface) surface.scrollTop = 0
      previousMode.current = mode
    }
  }, [mode])
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mode === 'forgot' || (!registrationAvailable && mode === 'create')) return
    const current = drafts[mode]
    if (!current.email.trim()) return setFormError('Enter your email address.')
    if (!current.password) return setFormError('Enter your password.')
    if (mode === 'create') {
      const policyError = passwordPolicyError(current.password)
      if (policyError) return setFormError(policyError)
      if (current.password !== current.confirmPassword) return setFormError('Your passwords do not match.')
    }
    setFormError(undefined)
    await authenticate(mode === 'create' ? 'signup' : 'signin', { email: current.email, password: current.password })
  }
  if (state.status === 'verificationRequired') return <VerificationNotice token={state.token} message={state.message} />
  if (mode === 'forgot') return <div ref={container}><ForgotPasswordView initialEmail={drafts.signin.email} onBack={() => setMode('signin')} /></div>
  return (
    <div ref={container}>
      {state.status === 'error' && state.token && <button type="button" disabled={restoring} onClick={() => {
        if (restoringLock.current) return
        restoringLock.current = true; setRestoring(true)
        void refreshAuth().finally(() => { restoringLock.current = false; setRestoring(false) })
      }}>{restoring ? 'Reconnecting…' : 'Retry connection'}</button>}
      <AccountView mode={mode} onModeChange={setMode} draft={drafts[mode]}
        onSubmit={submit} error={formError || serverError} submitting={submitting}
        onForgotPassword={() => { setFormError(undefined); setMode('forgot') }}
        onFieldChange={(name, value) => { setFormError(undefined); setDrafts((current) => ({ ...current, [mode]: { ...current[mode], [name]: value } })) }} />
    </div>
  )
}
