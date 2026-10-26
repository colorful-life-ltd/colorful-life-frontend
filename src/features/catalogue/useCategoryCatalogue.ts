import { useEffect, useState } from 'react'
import { getProducts, type BackendCategory, type CatalogueProduct } from './api'
import { selectCategoryProducts } from './productSpreads'

export type CategoryState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; category: BackendCategory; products: CatalogueProduct[] }

type ReadyState = Extract<CategoryState, { status: 'ready' }>

/**
 * Product lists of categories visited in this tab, so a revisit renders the previous cards immediately instead
 * of clearing them while the list is fetched again. Display data only: it is refreshed on every visit, and the
 * cart, checkout and stock reservations are always decided by the backend. Bounded (least recently used first)
 * and holds product metadata only, never images or DOM nodes.
 */
export const MAX_CACHED_CATEGORIES = 24
const productCache = new Map<number, ReadyState>()

function remember(id: number, state: ReadyState) {
  productCache.delete(id)
  productCache.set(id, state)
  while (productCache.size > MAX_CACHED_CATEGORIES) productCache.delete(productCache.keys().next().value!)
}

/** For tests. */
export function clearCategoryProductCache() { productCache.clear() }
/** For tests. */
export function cachedCategoryIds() { return [...productCache.keys()] }

const sameData = (a: ReadyState, b: ReadyState) =>
  JSON.stringify(a.category) === JSON.stringify(b.category) && JSON.stringify(a.products) === JSON.stringify(b.products)

/** Load products by the already-resolved backend category ID; revisits show the cached list while refreshing. */
export function useCategoryCatalogue(category: BackendCategory | undefined, categoriesResolved = true) {
  const [result, setResult] = useState<{ id: number; state: CategoryState }>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!category) return
    const controller = new AbortController()
    getProducts({ categoryId: category.id }, controller.signal).then(products => {
      if (controller.signal.aborted) return
      const fresh: ReadyState = { status: 'ready', category, products: products.filter(item => item.category?.id === category.id) }
      const cached = productCache.get(category.id)
      // An unchanged refresh keeps the cached objects; if they are already shown, React skips the render entirely.
      const state = cached && sameData(cached, fresh) ? cached : fresh
      remember(category.id, state)
      setResult(previous => previous?.id === category.id && previous.state === state ? previous : { id: category.id, state })
    }).catch(() => {
      if (controller.signal.aborted) return
      // A failed background refresh keeps the cards already shown; only a first load reports an error.
      setResult({ id: category.id, state: productCache.get(category.id) ?? { status: 'error' } })
    })
    return () => controller.abort()
  }, [category, attempt])
  const retry = () => { setResult(undefined); setAttempt(value => value + 1) }
  const cached = category ? productCache.get(category.id) : undefined
  const state: CategoryState = result && result.id === category?.id
    ? result.state
    : cached ?? (category ? { status: 'loading' } : categoriesResolved ? { status: 'error' } : { status: 'loading' })
  return { state, retry }
}

export function categoryProducts(products: readonly CatalogueProduct[]) {
  return selectCategoryProducts(products)
}
