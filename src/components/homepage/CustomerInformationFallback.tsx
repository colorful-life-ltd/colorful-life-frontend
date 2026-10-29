import './CustomerInformationFallback.css'

type CustomerInformationFallbackProps = {
  onActivate?: () => void
}

/** A small tabletop reminder for widths where the environmental notebook is cropped. */
export function CustomerInformationFallback({ onActivate }: CustomerInformationFallbackProps) {
  return (
    <button
      className="customer-information-fallback"
      type="button"
      aria-label="Customer Information: Help & FAQs"
      onClick={onActivate}
    >
      Customer Information →
    </button>
  )
}

/**
 * The "Customer Information" notebook painted on the tabletop. The hotspot tracks the background's
 * cover scaling, so it stays over the notebook at every desktop size where it is visible.
 */
export function CustomerInformationNotebook({ onActivate }: CustomerInformationFallbackProps) {
  return <button className="customer-information-notebook" type="button" aria-label="Customer Information: Help & FAQs" onClick={onActivate} />
}
