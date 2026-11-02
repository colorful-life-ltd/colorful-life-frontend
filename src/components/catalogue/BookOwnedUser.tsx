import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { FAREWELL_WAVE, HOVER_WAVE, USER_FRAMES, WAVE_FRAME_MS, type Frame } from './userFrames'
import './BookOwnedUser.css'

const reducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

export function BookOwnedUser({ onOpenAccount, onGuestHint, farewellWave = 0, preloadWave = false }: {
  onOpenAccount: () => void
  onGuestHint?: () => void
  /** Incremented when the sign-out farewell appears; each change plays the farewell wave once. */
  farewellWave?: number
  /** Fetch the wave frames ahead of a likely farewell so the first frames are not blank. */
  preloadWave?: boolean
}) {
  const [frame, setFrame] = useState<Frame>('idle')
  const running = useRef(false)
  const timers = useRef<number[]>([])
  const play = (sequence: Frame[], restart: boolean) => {
    if (reducedMotion() || (running.current && !restart)) return
    timers.current.forEach(window.clearTimeout)
    running.current = true
    timers.current = sequence.map((next, i) => window.setTimeout(() => {
      setFrame(next)
      if (i === sequence.length - 1) running.current = false
    }, (i + 1) * WAVE_FRAME_MS))
  }
  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])
  const lastFarewell = useRef(farewellWave)
  useEffect(() => {
    if (farewellWave === lastFarewell.current) return
    lastFarewell.current = farewellWave
    play(FAREWELL_WAVE, true)
  })
  const preloaded = useRef(false)
  useEffect(() => {
    if (!preloadWave || preloaded.current || typeof Image === 'undefined') return
    preloaded.current = true
    for (const { src } of Object.values(USER_FRAMES)) { const image = new Image(); image.src = src }
  }, [preloadWave])
  const current = USER_FRAMES[frame]
  return <button className="stage-user" type="button" aria-label="Open your account" data-frame={frame} onClick={onOpenAccount} onPointerEnter={event => { if (event.pointerType === 'mouse') { play(HOVER_WAVE, false); onGuestHint?.() } }} onFocus={event => { if (event.currentTarget.matches(':focus-visible')) { play(HOVER_WAVE, false); onGuestHint?.() } }}>
    <img src={current.src} alt="" width={current.w} height={current.h} style={{ '--frame-w': current.w, '--frame-dx': current.dx } as CSSProperties} />
  </button>
}
