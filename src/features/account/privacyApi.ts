import { requestJson } from '../auth/api'

/** Self-service account deletion. Order records are kept for the legal retention period. */
export function deleteMyAccount(token: string, password: string) {
  return requestJson<void>('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }, token)
}
