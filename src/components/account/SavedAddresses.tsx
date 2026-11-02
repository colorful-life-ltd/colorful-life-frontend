import { customerAddressError, normalizePostcode, customerLimits } from '../../features/account/customerInput'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { AuthApiError } from '../../features/auth/api'
import { ConfirmDialog } from '../shared/ConfirmDialog'
import { createAddress, deleteAddress, getAddresses, updateAddress, type Address, type AddressInput } from '../../features/account/addressApi'
import { useAuth } from '../../features/auth/AuthProvider'
import { reconcileAddress, countryLabel, isUkCountry, profileRecipient, UK_COUNTRY } from '../../features/account/addressState'
import sectionHouse from '../../assets/my-account/account-saved-addresses-house.png'
import addressHouse from '../../assets/my-account/account-address-house.png'

type AddressDraft = {
  recipientName: string
  line1: string
  line2: string
  city: string
  postcode: string
  country: string
  phone: string
  isDefaultShipping: boolean
  isDefaultBilling: boolean
}

const emptyDraft = (): AddressDraft => ({ recipientName: '', line1: '', line2: '', city: '', postcode: '', country: UK_COUNTRY, phone: '', isDefaultShipping: false, isDefaultBilling: false })
const draftFromAddress = (address: Address): AddressDraft => ({
  recipientName: address.recipientName, line1: address.line1, line2: address.line2 ?? '', city: address.city,
  postcode: address.postcode, country: isUkCountry(address.country) ? UK_COUNTRY : address.country, phone: address.phone ?? '', isDefaultShipping: address.isDefaultShipping, isDefaultBilling: address.isDefaultBilling,
})
const messageFor = (reason: unknown) => reason instanceof AuthApiError ? reason.message : reason instanceof Error ? reason.message : 'Unable to update your addresses'

export function SavedAddresses({ token }: { token: string }) {
  const { state: authState } = useAuth()
  const [addresses, setAddresses] = useState<Address[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<AddressDraft | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const mounted = useRef(true)
  const formRef = useRef<HTMLFormElement>(null)
  const isEditing = draft !== null

  useEffect(() => {
    if (isEditing) formRef.current?.querySelector('input')?.focus()
  }, [isEditing, editingId])

  const load = useCallback(async (requestToken: string, sequence: number) => {
    setLoading(true)
    try {
      const result = await getAddresses(requestToken)
      if (mounted.current && sequence === requestSequence.current) { setAddresses(result); setError(null) }
    } catch (reason) {
      if (mounted.current && sequence === requestSequence.current) setError(messageFor(reason))
    } finally {
      if (mounted.current && sequence === requestSequence.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mounted.current = true
    const sequence = ++requestSequence.current
    void load(token, sequence)
    return () => { mounted.current = false; requestSequence.current += 1 }
  }, [load, token])

  const beginAdd = () => { setEditingId(null); setDraft({ ...emptyDraft(), recipientName: addresses.length === 0 && authState.status === 'authenticated' ? profileRecipient(authState.user) : '' }); setError(null) }
  const beginEdit = (address: Address) => { setEditingId(address.id); setDraft(draftFromAddress(address)); setError(null) }
  const cancel = () => { setDraft(null); setEditingId(null); setError(null) }
  const updateDraft = (field: keyof AddressDraft, value: string | boolean) => setDraft(current => current ? { ...current, [field]: value } : current)
  const normalize = (value: string) => value.trim()
  const validate = (value: AddressDraft) => {
    if (!isUkCountry(value.country)) return 'Only United Kingdom addresses are supported. Please add a UK address.'
    const fieldsError = customerAddressError(value)
    if (fieldsError) return fieldsError
    const required: Array<[keyof AddressDraft, string]> = [['recipientName', 'Recipient name'], ['line1', 'Address line 1'], ['city', 'City'], ['postcode', 'Postcode'], ['country', 'Country']]
    const missing = required.find(([field]) => !normalize(String(value[field])))
    return missing ? `${missing[1]} is required.` : null
  }

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!draft || pending) return
    const validation = validate(draft)
    if (validation) { setError(validation); return }
    const payload: AddressInput = {
      recipientName: normalize(draft.recipientName), line1: normalize(draft.line1), city: normalize(draft.city), postcode: normalizePostcode(draft.postcode), country: UK_COUNTRY,
      line2: normalize(draft.line2) || null, phone: normalize(draft.phone) || null, ...(editingId === null && addresses.length === 0 ? {} : { isDefaultShipping: draft.isDefaultShipping, isDefaultBilling: draft.isDefaultBilling }),
    }
    const mutationSequence = requestSequence.current
    setPending(editingId === null ? 'create' : `edit:${editingId}`); setError(null)
    try {
      const changed = editingId === null ? await createAddress(token, payload) : await updateAddress(token, editingId, payload)
      if (!mounted.current || mutationSequence !== requestSequence.current) return
      setAddresses(current => reconcileAddress(current, changed))
      const sequence = ++requestSequence.current
      await load(token, sequence)
      setDraft(null); setEditingId(null)
    } catch (reason) { if (mounted.current) setError(messageFor(reason))
    } finally { if (mounted.current) setPending(null) }
  }

  const makeDefault = async (address: Address, kind: 'shipping' | 'billing') => {
    if (pending) return
    const key = `${kind}:${address.id}`
    const mutationSequence = requestSequence.current
    setPending(key); setError(null)
    try {
      const changed = await updateAddress(token, address.id, kind === 'shipping' ? { isDefaultShipping: true } : { isDefaultBilling: true })
      if (!mounted.current || mutationSequence !== requestSequence.current) return
      setAddresses(current => reconcileAddress(current, changed))
      const sequence = ++requestSequence.current
      await load(token, sequence)
    } catch (reason) { if (mounted.current) setError(messageFor(reason))
    } finally { if (mounted.current) setPending(null) }
  }

  // Delete opens a branded confirmation; nothing is deleted until the customer confirms there.
  const [confirming, setConfirming] = useState<Address | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const askToRemove = (address: Address) => { if (!pending) { setDeleteError(''); setConfirming(address) } }
  const defaultConsequence = (address: Address) => {
    if (!address.isDefaultShipping && !address.isDefaultBilling) return null
    const kinds = [address.isDefaultShipping ? 'delivery' : '', address.isDefaultBilling ? 'billing' : ''].filter(Boolean).join(' and ')
    const successor = addresses.filter(a => a.id !== address.id).sort((a, b) => a.id - b.id)[0]
    return successor
      ? `This is your default ${kinds} address. ${successor.recipientName}, ${successor.line1} will become the new default ${kinds} address.`
      : `This is your default ${kinds} address. You will have no saved default address.`
  }
  const remove = async () => {
    const address = confirming
    if (!address || pending) return
    const mutationSequence = requestSequence.current
    setPending(`delete:${address.id}`); setDeleteError('')
    let deleted = false
    try {
      await deleteAddress(token, address.id)
      deleted = true
      if (!mounted.current || mutationSequence !== requestSequence.current) return
      const sequence = ++requestSequence.current
      await load(token, sequence)
    } catch (reason) { if (mounted.current && !deleted) setDeleteError(messageFor(reason))
    } finally {
      // Close in the same render that clears pending, so the focus target (Add address) is enabled again.
      if (mounted.current) { setPending(null); if (deleted) setConfirming(null) }
    }
  }

  return <section className="my-account__panel saved-addresses" aria-labelledby="saved-addresses-title">
    <header className="saved-addresses__heading">
      <div className="my-account__section-heading"><img src={sectionHouse} alt="" aria-hidden="true" /><div><h3 id="saved-addresses-title">Saved Addresses</h3><p>Manage your delivery and billing addresses.</p></div></div>
      <button ref={addButtonRef} className="my-account__button my-account__button--primary" type="button" onClick={beginAdd} disabled={loading || Boolean(error) || Boolean(pending)}><span aria-hidden="true">＋ </span>Add address</button>
    </header>
    <div className="saved-addresses__body" aria-busy={loading || Boolean(pending)}>
    {error && <p className="my-account__error" role="alert">{error}</p>}
    {error && !draft && <button className="my-account__button" disabled={loading || Boolean(pending)} onClick={() => void load(token, ++requestSequence.current)}>Try loading addresses again</button>}
    {loading ? <p className="saved-addresses__notice" role="status">Loading addresses…</p> : addresses.length === 0 ? <p className="saved-addresses__notice">No saved addresses yet.</p> : <div className="saved-addresses__list">{addresses.map(address => <article key={address.id} className={`saved-address${address.isDefaultShipping || address.isDefaultBilling ? ' saved-address--default' : ''}`}>
      <img className="saved-address__illustration" src={addressHouse} alt="" aria-hidden="true" />
      <div className="saved-address__defaults">{address.isDefaultShipping && <span>Default Delivery</span>}{address.isDefaultBilling && <span>Default Billing</span>}</div>
      <div className="saved-address__copy"><strong>{address.recipientName}</strong><p>{address.line1}{address.line2 && <><br />{address.line2}</>}<br />{address.city}<br />{address.postcode}<br />{countryLabel(address.country)}</p>{address.phone && <p>{address.phone}</p>}</div>
      <div className="saved-address__actions">
        {!address.isDefaultShipping && <button className="my-account__button" type="button" onClick={() => void makeDefault(address, 'shipping')} disabled={Boolean(pending)}>Make delivery default</button>}
        {!address.isDefaultBilling && <button className="my-account__button" type="button" onClick={() => void makeDefault(address, 'billing')} disabled={Boolean(pending)}>Make billing default</button>}
        <div className="saved-address__edit-actions"><button className="my-account__button" type="button" onClick={() => beginEdit(address)} disabled={Boolean(pending)}>Edit</button>{<button className="saved-address__delete" type="button" onClick={() => askToRemove(address)} disabled={Boolean(pending)} aria-label={`Delete address for ${address.recipientName}, ${address.line1}`}>Delete</button>}</div>
      </div>
    </article>)}</div>}
    {draft && <form ref={formRef} className="saved-addresses__form" onSubmit={save}>
      <h4>{editingId === null ? 'Add address' : 'Edit address'}</h4>
      {(['recipientName', 'line1', 'line2', 'city', 'postcode', 'phone'] as const).map(field => <label className="my-account__field" key={field}>{({ recipientName: 'Recipient name', line1: 'Address line 1', line2: 'Address line 2 (optional)', city: 'City', postcode: 'Postcode', country: 'Country', phone: 'Phone number (optional)' })[field]}<input maxLength={field === 'postcode' ? undefined : customerLimits[field]} value={draft[field]} onChange={event => updateDraft(field, event.target.value)} /></label>)}
      <label className="my-account__field">Country<input value={countryLabel(draft.country)} readOnly /></label>
      {editingId === null && addresses.length === 0 && <p>Your first address will be used for both delivery and billing.</p>}
      {(addresses.length > 0) && <div className="saved-addresses__choices"><label><input type="checkbox" checked={draft.isDefaultShipping} disabled={editingId !== null && addresses.some(address => address.id === editingId && address.isDefaultShipping)} onChange={event => updateDraft('isDefaultShipping', event.target.checked)} /> Default delivery address</label><label><input type="checkbox" checked={draft.isDefaultBilling} disabled={editingId !== null && addresses.some(address => address.id === editingId && address.isDefaultBilling)} onChange={event => updateDraft('isDefaultBilling', event.target.checked)} /> Default billing address</label></div>}
      <div className="saved-addresses__form-actions"><button className="my-account__button my-account__button--primary" type="submit" disabled={Boolean(pending)}>{pending ? 'Saving…' : 'Save address'}</button><button className="my-account__button" type="button" onClick={cancel} disabled={Boolean(pending)}>Cancel</button></div>
    </form>}
    </div>
    {confirming && <ConfirmDialog title="Delete this address?" confirmLabel="Delete address" busyLabel="Deleting…" busy={pending === `delete:${confirming.id}`}
      error={deleteError ? `${deleteError} Nothing was deleted; you can try again.` : undefined} onConfirm={() => void remove()} onCancel={() => { setConfirming(null); setDeleteError('') }}
      fallbackFocus={() => addButtonRef.current}>
      <address className="confirm-dialog__address"><strong>{confirming.recipientName}</strong><br />{confirming.line1}{confirming.line2 && <>, {confirming.line2}</>}<br />{confirming.city} {confirming.postcode}<br />{countryLabel(confirming.country)}</address>
      {defaultConsequence(confirming) && <p>{defaultConsequence(confirming)}</p>}
      <p>This removes it from your saved addresses. It can’t be undone. Existing orders will not change.</p>
    </ConfirmDialog>}
  </section>
}
