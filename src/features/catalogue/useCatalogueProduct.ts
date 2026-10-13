import { useEffect, useState } from 'react'
import { getCatalogueProduct, type CatalogueProduct } from './api'

export type CatalogueProductState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'error' }
  | { status: 'ready'; product: CatalogueProduct }

/** Loads one product by stable LegoProduct ID; pass undefined when no read is needed. */
export function useCatalogueProduct(productId: number | undefined) {
  const [result, setResult] = useState<{ id: number; state: CatalogueProductState }>()
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (productId === undefined) return
    const controller = new AbortController()
    getCatalogueProduct(productId, controller.signal).then(product => {
      if (!controller.signal.aborted) setResult({ id: productId, state: product ? { status: 'ready', product } : { status: 'missing' } })
    }).catch(() => {
      if (!controller.signal.aborted) setResult({ id: productId, state: { status: 'error' } })
    })
    return () => controller.abort()
  }, [productId, attempt])
  const state: CatalogueProductState = productId === undefined ? { status: 'idle' } : result?.id === productId ? result.state : { status: 'loading' }
  return { state, retry: () => { setResult(undefined); setAttempt(value => value + 1) } }
}
