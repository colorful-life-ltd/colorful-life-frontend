import idle from '../../assets/homepage/tabletop/user/user-idle.png'
import wave02 from '../../assets/homepage/tabletop/user/user-wave-02.png'
import wave03 from '../../assets/homepage/tabletop/user/user-wave-03.png'
import wave04 from '../../assets/homepage/tabletop/user/user-wave-04.png'
import wave05 from '../../assets/homepage/tabletop/user/user-wave-05.png'
import wave06 from '../../assets/homepage/tabletop/user/user-wave-06.png'
import wave07 from '../../assets/homepage/tabletop/user/user-wave-07.png'
import wave08 from '../../assets/homepage/tabletop/user/user-wave-08.png'

/**
 * Hand-drawn wave poses: only the raised forearm and hand change. Each PNG was exported on its own canvas, wider
 * on the left where the arm reaches further, so the child is registered by drawing every frame at the idle
 * scale (270 px) and shifting it left by its measured offset (`dx`, native px). Frames are top-aligned.
 */
export const USER_FRAMES = {
  idle: { src: idle, w: 270, h: 208, dx: 0 },
  w02: { src: wave02, w: 269, h: 209, dx: 1 },
  w03: { src: wave03, w: 273, h: 210, dx: 3 },
  w04: { src: wave04, w: 272, h: 208, dx: 2 },
  w05: { src: wave05, w: 278, h: 209, dx: 8 },
  w06: { src: wave06, w: 278, h: 208, dx: 7 },
  w07: { src: wave07, w: 280, h: 208, dx: 9 },
  w08: { src: wave08, w: 277, h: 208, dx: 9 },
} as const
export type Frame = keyof typeof USER_FRAMES
/** One wave: the hand sweeps out and back. */
const ONE_WAVE: Frame[] = ['w02', 'w03', 'w04', 'w05', 'w06', 'w07', 'w08', 'w07', 'w06', 'w05', 'w04', 'w03', 'w02']
export const HOVER_WAVE: Frame[] = [...ONE_WAVE, 'idle']
/** Sign-out farewell: two gentle waves, settling on the raised-hand idle pose (2.8 s, inside the 3 s bubble). */
export const FAREWELL_WAVE: Frame[] = [...ONE_WAVE, ...ONE_WAVE.slice(1), 'idle']
export const WAVE_FRAME_MS = 100

