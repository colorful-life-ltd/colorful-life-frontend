/**
 * Cloudinary delivery variants for catalogue photographs and artwork. The originals are 800-1536 px PNGs
 * shown at 42-488 CSS px, so two shared sizes cover every surface at 2x: fewer variants, fewer transformations.
 * 768 is exactly half the 1536x1024 artwork, so the scaled aspect ratio (and layout) stays exact.
 * `c_limit` never enlarges (an image's natural size only shrinks when it exceeds the variant width).
 */
export const CLOUDINARY_VARIANTS = {
  /** Catalogue cards, leaflet print artwork, product-detail main image, remove-item dialog. */
  display: 'f_auto,q_auto,c_limit,w_768',
  /** Product-detail gallery thumbnails, cart lines, My Orders. */
  thumbnail: 'f_auto,q_auto,c_limit,w_160',
} as const
export type CloudinaryVariant = keyof typeof CLOUDINARY_VARIANTS

// Only untransformed, versioned delivery URLs (how the backend stores uploads): signed, fetched, already
// transformed or query-string URLs are left exactly as they are.
const UPLOAD_URL = /^(https:\/\/res\.cloudinary\.com\/[a-z0-9_-]+\/image\/upload\/)(v[0-9]+\/[^?#]+)$/i

/** The variant URL for a Cloudinary upload, or null when the URL must be used unchanged. */
export function cloudinaryVariantUrl(url: string | null | undefined, variant: CloudinaryVariant): string | null {
  const match = url?.trim().match(UPLOAD_URL)
  return match ? `${match[1]}${CLOUDINARY_VARIANTS[variant]}/${match[2]}` : null
}
