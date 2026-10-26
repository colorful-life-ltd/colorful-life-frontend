import { OPTIMISED_CATEGORY_ARTWORK_WIDTH, type CategoryPresentation } from './categories'

/**
 * Category-index artwork: WebP where supported, PNG otherwise. `display: contents` (with the <source> box hidden,
 * as <source> is not display:none by default) keeps the img as the art grid's only item, so the layout is unchanged.
 * The art box sizes from the image's intrinsic size, so the optimised files declare a pixel density that
 * gives them the originals' CSS size (imageWidth x imageHeight) while only 720 px are downloaded and decoded.
 */
export function CategoryArtworkImage({ category }: { category: Pick<CategoryPresentation, 'image' | 'imageWebp' | 'imageWidth' | 'imageHeight'> }) {
  if (!category.image) return null
  if (!category.imageWebp) return <img src={category.image} alt="" width={category.imageWidth} height={category.imageHeight} decoding="async" />
  const density = category.imageWidth ? ` ${Number((OPTIMISED_CATEGORY_ARTWORK_WIDTH / category.imageWidth).toFixed(6))}x` : ''
  return <picture style={{ display: 'contents' }}>
    <source srcSet={category.imageWebp + density} type="image/webp" style={{ display: 'none' }} />
    <img src={category.image} srcSet={category.image + density} alt="" width={category.imageWidth} height={category.imageHeight} decoding="async" />
  </picture>
}
