import { deliveryEstimate, shippingCharge, type ShippingMethodCode, type ShippingOptions } from '../../features/checkout/shipping'

/** Explicit delivery choice: no option is preselected, and prices come only from the backend catalogue. */
export function ShippingMethodSelector({ options, loading, error, selected, onSelect, disabled, invalid, locked, onRetry }: {
  options: ShippingOptions | null; loading: boolean; error: string | null; selected: ShippingMethodCode | null
  onSelect: (code: ShippingMethodCode) => void; disabled: boolean; invalid: boolean; locked: boolean; onRetry: () => void
}) {
  const savedOnly = locked && selected && !options?.methods.some(option => option.code === selected)
  return <section aria-labelledby="checkout-shipping-title" className="checkout__shipping">
    <h2 id="checkout-shipping-title">Delivery method</h2>
    <fieldset className={invalid ? 'checkout__shipping--invalid' : undefined} disabled={disabled || locked} aria-describedby="checkout-shipping-note">
      <legend>Choose how your order is delivered</legend>
      <p id="checkout-shipping-note">Estimates are working days after dispatch, not guaranteed delivery dates.{locked && ' Your saved checkout request keeps its original delivery method.'}</p>
      {loading && !options && <p role="status">Loading delivery options…</p>}
      {options?.methods.map(option => <label key={option.code} className={`checkout__shipping-option${selected === option.code ? ' checkout__shipping-option--selected' : ''}`}>
        <input type="radio" name="shipping-method" value={option.code} checked={selected === option.code} onChange={() => onSelect(option.code)}
          aria-invalid={invalid || undefined} aria-describedby={`shipping-estimate-${option.code}${invalid ? ' checkout-shipping-required' : ''}`} />
        <span className="checkout__shipping-name">{option.method}</span>
        <span className="checkout__shipping-charge">{shippingCharge(option)}</span>
        <span className="checkout__shipping-estimate" id={`shipping-estimate-${option.code}`}>{deliveryEstimate(option)}</span>
      </label>)}
      {savedOnly && <p>Saved delivery method: {selected === 'STANDARD' ? 'Standard Delivery' : 'Express Delivery'}. Its charge is confirmed when your order is reserved.</p>}
      {invalid && <p id="checkout-shipping-required" className="checkout__error" role="alert">Choose Standard or Express delivery before creating your order.</p>}
    </fieldset>
    {error && <div className="checkout__error" role="alert"><p>{error}</p><button type="button" className="checkout__secondary" onClick={onRetry}>Try loading delivery options again</button></div>}
  </section>
}
