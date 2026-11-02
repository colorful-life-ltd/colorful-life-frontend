// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BookOwnedUser } from './BookOwnedUser'
import { FAREWELL_WAVE, HOVER_WAVE, USER_FRAMES, WAVE_FRAME_MS } from './userFrames'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

let root: Root, host: HTMLDivElement
const button = () => host.querySelector<HTMLButtonElement>('.stage-user')!
const render = (props: { farewellWave?: number; preloadWave?: boolean } = {}) => act(async () => root.render(<BookOwnedUser onOpenAccount={() => {}} {...props} />))
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: !query.includes('prefers-reduced-motion') }))
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('draws every frame at the idle scale with its measured offset, never scaled to fit', async () => {
  await render()
  for (const [name, f] of Object.entries(USER_FRAMES)) {
    expect(f.w - f.dx).toBeGreaterThanOrEqual(268) // the figure keeps its right edge within ~2 px of idle
    if (name === 'idle') expect(f).toMatchObject({ w: 270, dx: 0 })
  }
  const img = button().querySelector('img')!
  expect(img.style.getPropertyValue('--frame-w')).toBe('270')
  expect(img.style.getPropertyValue('--frame-dx')).toBe('0')
})

it('restarts cleanly when a second farewell arrives mid-wave and waves again for a later sign-out', async () => {
  await render({ farewellWave: 0 })
  expect(button().dataset.frame).toBe('idle') // mounting never waves
  await render({ farewellWave: 1 })
  await advance(WAVE_FRAME_MS * 5)
  expect(button().dataset.frame).not.toBe('idle')
  await render({ farewellWave: 2 })
  const seen: (string | undefined)[] = []
  for (let t = 0; t < FAREWELL_WAVE.length; t++) { await advance(WAVE_FRAME_MS); seen.push(button().dataset.frame) }
  expect(seen).toEqual(FAREWELL_WAVE)
  await advance(5_000); expect(button().dataset.frame).toBe('idle')
  await render({ farewellWave: 3 })
  await advance(WAVE_FRAME_MS * 7); expect(button().dataset.frame).toBe('w08')
  const img = button().querySelector('img')!
  expect(img.style.getPropertyValue('--frame-w')).toBe(String(USER_FRAMES.w08.w))
  expect(img.style.getPropertyValue('--frame-dx')).toBe(String(USER_FRAMES.w08.dx))
})

it('keeps the hover greeting to a single wave', async () => {
  await render()
  // React derives onPointerEnter from a bubbling pointerover; jsdom's event needs an explicit pointerType.
  const over = new MouseEvent('pointerover', { bubbles: true }); Object.defineProperty(over, 'pointerType', { value: 'mouse' })
  await act(async () => { button().dispatchEvent(over) })
  const seen: (string | undefined)[] = []
  for (let t = 0; t < HOVER_WAVE.length; t++) { await advance(WAVE_FRAME_MS); seen.push(button().dataset.frame) }
  expect(seen).toEqual(HOVER_WAVE)
  expect(seen.filter(f => f === 'w08')).toHaveLength(1)
})

it('preloads the wave frames once, only when asked', async () => {
  const created: string[] = []
  vi.stubGlobal('Image', class { set src(value: string) { created.push(value) } })
  await render()
  expect(created).toHaveLength(0)
  await render({ preloadWave: true }); await render({ preloadWave: false }); await render({ preloadWave: true })
  expect(created.sort()).toEqual(Object.values(USER_FRAMES).map(f => f.src).sort())
})
