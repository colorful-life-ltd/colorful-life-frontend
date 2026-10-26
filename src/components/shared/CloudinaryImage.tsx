import { useState, type ImgHTMLAttributes } from 'react'
import { cloudinaryVariantUrl, type CloudinaryVariant } from '../../features/images/cloudinary'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> & { src: string; variant: CloudinaryVariant }

/**
 * An <img> that requests a right-sized, auto-format Cloudinary variant and falls back to the original URL
 * if the variant fails. `onError` is only called when the original itself fails, so callers keep their
 * existing failure handling. Non-Cloudinary URLs render unchanged.
 */
export function CloudinaryImage({ src, variant, onError, ...props }: Props) {
  const [failedVariantOf, setFailedVariantOf] = useState<string | null>(null)
  const variantUrl = failedVariantOf === src ? null : cloudinaryVariantUrl(src, variant)
  return <img {...props} src={variantUrl ?? src} onError={event => { if (variantUrl) setFailedVariantOf(src); else onError?.(event) }} />
}
