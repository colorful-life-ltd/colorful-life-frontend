// @vitest-environment jsdom
import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { offer, product } from './catalogueFixtures'
import type { BackendCategory, CatalogueProduct } from './api'
import { MAX_CACHED_CATEGORIES, cachedCategoryIds, clearCategoryProductCache, useCategoryCatalogue, type CategoryState } from './useCategoryCatalogue'

const mocks = vi.hoisted(() => ({ getProducts: vi.fn() }))
vi.mock('./api', async original => ({ ...await original<typeof import('./api')>(), getProducts: mocks.getProducts }))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

const category = (id: number, name = `Category ${id}`): BackendCategory => ({ id, name, subtitle: null, description: null, imageUrl: null, thumbnailUrl: null })
const marvel = category(6, 'Marvel'), city = category(4, 'City')
const item = (id: number, owner: BackendCategory, overrides: Parameters<typeof offer>[1] = {}) => product(id, [offer(id, overrides)], { category: owner })

/** One pending getProducts call per request, resolved or rejected by the test in any order. */
type Pending = { categoryId: number; signal: AbortSignal; resolve: (items: CatalogueProduct[]) => void; reject: (error: Error) => void }
let pending: Pending[]
const latest = (categoryId: number) => pending.filter(call => call.categoryId === categoryId).at(-1)!

let root: Root, states: CategoryState[], retry: () => void
function Probe({ value }: { value: BackendCategory | undefined }) {
  const hook = useCategoryCatalogue(value)
  states.push(hook.state)
  useEffect(() => { retry = hook.retry })
  return null
}
const show = (value: BackendCategory | undefined) => act(async () => root.render(<Probe value={value} />))
const settle = (call: Pending, items: CatalogueProduct[]) => act(async () => call.resolve(items))
const fail = (call: Pending) => act(async () => call.reject(new Error('offline')))
const current = () => states.at(-1)!
const titles = (state: CategoryState) => state.status === 'ready' ? state.products.map(p => p.title) : state.status

beforeEach(() => {
  clearCategoryProductCache(); pending = []; states = []
  mocks.getProducts.mockReset().mockImplementation(({ categoryId }: { categoryId: number }, signal: AbortSignal) =>
    new Promise((resolve, reject) => pending.push({ categoryId, signal, resolve, reject })))
  root = createRoot(document.createElement('div'))
})
afterEach(async () => { await act(async () => root.unmount()) })

describe('session category product cache', () => {
  it('loads a first visit normally, then shows the cached cards immediately on a revisit', async () => {
    await show(marvel)
    expect(current()).toEqual({ status: 'loading' })
    await settle(latest(6), [item(1, marvel), item(2, marvel)])
    expect(titles(current())).toEqual(['API product 1', 'API product 2'])
    const shown = current()

    await show(city); await settle(latest(4), [item(3, city)])
    states = []
    await show(marvel)
    // Never loading: the very first render of the revisit already has the cached list (same objects, same cards).
    expect(states.every(state => state.status === 'ready')).toBe(true)
    expect(current()).toBe(shown)
    expect(mocks.getProducts).toHaveBeenCalledTimes(3) // and it is refreshed in the background
  })

  it('applies a background refresh: stock, price, status and category membership come from the fresh list', async () => {
    await show(marvel); await settle(latest(6), [item(1, marvel), item(2, marvel), item(5, marvel)])
    await show(city); await settle(latest(4), [])
    await show(marvel)
    await settle(latest(6), [
      item(1, marvel, { availableStock: 0, currentStock: 0 }), // sold out meanwhile
      item(2, marvel, { effectivePrice: '19.99', salePrice: '19.99' }), // repriced
      item(5, city), // moved to another category
    ])
    const ready = current() as Extract<CategoryState, { status: 'ready' }>
    expect(ready.products.map(p => p.id)).toEqual([1, 2])
    expect(ready.products[0].offers[0].availableStock).toBe(0)
    expect(ready.products[1].offers[0].effectivePrice).toBe('19.99')
    // The next revisit starts from the refreshed list, not the original one.
    await show(city); await show(marvel)
    expect((current() as typeof ready).products[0].offers[0].availableStock).toBe(0)
  })

  it('keeps the cached objects when a refresh returns identical data', async () => {
    await show(marvel); await settle(latest(6), [item(1, marvel)])
    const shown = current()
    await show(city); await show(marvel)
    await settle(latest(6), [item(1, marvel)])
    expect(current()).toBe(shown)
  })

  it('ignores stale responses when switching categories rapidly', async () => {
    await show(marvel); await settle(latest(6), [item(1, marvel)])
    await show(city) // City request A pending
    const cityFirst = latest(4)
    await show(marvel) // back before City answered; Marvel refresh pending
    const marvelRefresh = latest(6)
    await show(city) // City request B pending
    const citySecond = latest(4)
    expect(cityFirst.signal.aborted).toBe(true); expect(marvelRefresh.signal.aborted).toBe(true)

    await settle(marvelRefresh, [item(9, marvel)]) // late Marvel answer while City is shown
    await settle(cityFirst, [item(7, city, { availableStock: 99 })]) // late, superseded City answer
    expect(current()).toEqual({ status: 'loading' })
    await settle(citySecond, [item(8, city)])
    expect(titles(current())).toEqual(['API product 8'])
    // Aborted answers never reached the cache either.
    await show(marvel)
    expect(titles(current())).toEqual(['API product 1'])
  })

  it('keeps the cards when a background refresh fails, and reports errors only for a first load', async () => {
    await show(marvel); await settle(latest(6), [item(1, marvel)])
    await show(city); await fail(latest(4))
    expect(current()).toEqual({ status: 'error' })
    await show(marvel); await fail(latest(6))
    expect(titles(current())).toEqual(['API product 1'])

    await show(city)
    expect(current()).toEqual({ status: 'loading' }) // a failed first load is not cached
    await settle(latest(4), [item(3, city)])
    expect(titles(current())).toEqual(['API product 3'])
  })

  it('retries a failed first load', async () => {
    await show(city); await fail(latest(4))
    expect(current()).toEqual({ status: 'error' })
    await act(async () => retry())
    expect(current()).toEqual({ status: 'loading' })
    await settle(latest(4), [item(3, city)])
    expect(titles(current())).toEqual(['API product 3'])
  })

  it('caches empty categories as loaded, not loading', async () => {
    await show(city); await settle(latest(4), [])
    await show(marvel); await settle(latest(6), [item(1, marvel)])
    states = []
    await show(city)
    expect(states.every(state => state.status === 'ready' && state.products.length === 0)).toBe(true)
  })

  it('stays bounded, evicting the least recently used category', async () => {
    for (let id = 100; id < 100 + MAX_CACHED_CATEGORIES + 2; id++) { await show(category(id)); await settle(latest(id), []) }
    expect(cachedCategoryIds()).toHaveLength(MAX_CACHED_CATEGORIES)
    expect(cachedCategoryIds()).not.toContain(100); expect(cachedCategoryIds()).not.toContain(101)
    await show(category(100))
    expect(current()).toEqual({ status: 'loading' })
  })
})
