import { requestJson } from '../auth/api'

/** UK GDPR access/portability: the backend returns the customer's own data as JSON. */
export async function exportMyData(token: string, password: string): Promise<Blob> {
  const data = await requestJson<unknown>('/users/me/data-export', { method: 'POST', body: JSON.stringify({ password }) }, token)
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
}

/** Self-service account deletion. Order records are kept for the legal retention period. */
export function deleteMyAccount(token: string, password: string) {
  return requestJson<void>('/users/me', { method: 'DELETE', body: JSON.stringify({ password }) }, token)
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url; link.download = filename
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
