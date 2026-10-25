import { describe, expect, it } from 'vitest'
import { authReducer, type AuthState } from './state'

const user = { id: 4, email: 'person@example.com', firstName: 'Ada', lastName: null, phone: null }

describe('auth state transitions', () => {
  it('represents restoration, authentication, verification, signed out and errors distinctly', () => {
    let state: AuthState = { status: 'signedOut' }
    state = authReducer(state, { type: 'resolve' })
    expect(state).toEqual({ status: 'resolving' })
    state = authReducer(state, { type: 'authenticate', mode: 'signin' })
    expect(state).toEqual({ status: 'authenticating', mode: 'signin' })
    state = authReducer(state, { type: 'authenticated', token: 'jwt', user })
    expect(state).toMatchObject({ status: 'authenticated', token: 'jwt', user })
    state = authReducer(state, { type: 'verificationRequired', token: 'jwt', message: 'Email verification required' })
    expect(state.status).toBe('verificationRequired')
    state = authReducer(state, { type: 'error', message: 'Network unavailable', token: 'jwt' })
    expect(state).toEqual({ status: 'error', message: 'Network unavailable', token: 'jwt' })
    expect(authReducer(state, { type: 'signedOut' })).toEqual({ status: 'signedOut', error: undefined })
  })
})

it('clears form errors without discarding a verified session or verification requirement', () => {
  expect(authReducer({status:'signedOut',error:'old error'}, {type:'clearError'})).toEqual({status:'signedOut'})
  expect(authReducer({status:'error',message:'old error',token:'retained'}, {type:'clearError'})).toEqual({status:'error',message:'',token:'retained'})
  const verified: AuthState={status:'authenticated',token:'retained',user}
  expect(authReducer(verified,{type:'clearError'})).toBe(verified)
  const unverified: AuthState={status:'verificationRequired',token:'retained',message:'Verify email'}
  expect(authReducer(unverified,{type:'clearError'})).toBe(unverified)
})
