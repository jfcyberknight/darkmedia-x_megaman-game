/**
 * Procedural chiptune audio — pure Web Audio synthesis, no assets.
 * All calls are safe no-ops until the first user gesture unlocks the context.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null
let musicBus: GainNode | null = null
let muted = false

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext
    || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = muted ? 0 : 0.18
    master.connect(ctx.destination)
    musicBus = ctx.createGain()
    musicBus.gain.value = 0.32
    musicBus.connect(master)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function tone(opt: {
  f: number
  to?: number
  dur: number
  type?: OscillatorType
  vol?: number
  delay?: number
  bus?: GainNode | null
}) {
  const c = ac()
  if (!c || !master) return
  const t0 = c.currentTime + (opt.delay ?? 0)
  const osc = c.createOscillator()
  const g = c.createGain()
  osc.type = opt.type ?? 'square'
  osc.frequency.setValueAtTime(Math.max(20, opt.f), t0)
  if (opt.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opt.to), t0 + opt.dur)
  g.gain.setValueAtTime(opt.vol ?? 0.4, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + opt.dur)
  osc.connect(g)
  g.connect(opt.bus ?? master)
  osc.start(t0)
  osc.stop(t0 + opt.dur + 0.03)
}

function noise(opt: { dur: number; vol?: number; freq?: number; delay?: number }) {
  const c = ac()
  if (!c || !master) return
  const t0 = c.currentTime + (opt.delay ?? 0)
  const len = Math.max(1, Math.floor(c.sampleRate * opt.dur))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const f = c.createBiquadFilter()
  f.type = 'lowpass'
  f.frequency.value = opt.freq ?? 1000
  const g = c.createGain()
  g.gain.setValueAtTime(opt.vol ?? 0.4, t0)
  g.gain.exponentialRampToValueAtTime(0.001, t0 + opt.dur)
  src.connect(f)
  f.connect(g)
  g.connect(master)
  src.start(t0)
  src.stop(t0 + opt.dur + 0.03)
}

// --------------------------- Music (lookahead sequencer) ---------------------------

let musicTimer: ReturnType<typeof setInterval> | null = null
let step = 0
let nextTime = 0
const BPM = 132
const STEP = 60 / BPM / 4

// Am / F / C / G — 16 sixteenth-notes per 2 bars
const BASS = [
  110, 0, 110, 0, 110, 0, 164.81, 0,
  87.31, 0, 87.31, 0, 130.81, 0, 130.81, 0,
  130.81, 0, 130.81, 0, 196, 0, 130.81, 0,
  98, 0, 98, 0, 146.83, 0, 98, 0,
]
const LEAD = [
  440, 0, 523.25, 0, 659.25, 0, 523.25, 659.25,
  0, 0, 349.23, 0, 440, 0, 523.25, 0,
  523.25, 0, 659.25, 0, 783.99, 0, 659.25, 523.25,
  0, 0, 392, 0, 493.88, 0, 587.33, 0,
]

function schedule() {
  const c = ctx
  if (!c || !musicBus) return
  while (nextTime < c.currentTime + 0.35) {
    const i = step % 32
    const delay = Math.max(0, nextTime - c.currentTime)
    const b = BASS[i]
    if (b) tone({ f: b, dur: STEP * 1.6, type: 'triangle', vol: 0.5, delay, bus: musicBus })
    const l = LEAD[i]
    if (l) tone({ f: l, dur: STEP * 0.85, type: 'square', vol: 0.14, delay, bus: musicBus })
    if (i % 4 === 2) noise({ dur: 0.03, vol: 0.1, freq: 6000, delay })
    nextTime += STEP
    step++
  }
}

export function startMusic() {
  const c = ac()
  if (!c || musicTimer) return
  step = 0
  nextTime = c.currentTime + 0.15
  musicTimer = setInterval(schedule, 120)
}

export function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer)
    musicTimer = null
  }
}

// --------------------------- SFX ---------------------------

export const sfx = {
  /** Create/resume the AudioContext — call from a user gesture. */
  unlock: () => { ac() },
  toggleMute: () => {
    muted = !muted
    if (master) master.gain.value = muted ? 0 : 0.18
    return muted
  },
  isMuted: () => muted,

  shoot: () => tone({ f: 900, to: 320, dur: 0.08, vol: 0.3 }),
  shootMid: () => tone({ f: 720, to: 220, dur: 0.13, vol: 0.42 }),
  shootBig: () => {
    tone({ f: 420, to: 90, dur: 0.26, type: 'sawtooth', vol: 0.5 })
    noise({ dur: 0.16, vol: 0.3, freq: 2600 })
  },
  charge: (level: number) => tone({ f: level >= 2 ? 1245 : 830, dur: 0.07, vol: 0.28 }),
  jump: () => tone({ f: 280, to: 620, dur: 0.12, vol: 0.26 }),
  hurt: () => {
    tone({ f: 210, to: 60, dur: 0.22, type: 'sawtooth', vol: 0.45 })
    noise({ dur: 0.12, vol: 0.32, freq: 900 })
  },
  explode: () => {
    noise({ dur: 0.4, vol: 0.55, freq: 500 })
    tone({ f: 130, to: 32, dur: 0.36, type: 'triangle', vol: 0.5 })
  },
  bigExplode: () => {
    noise({ dur: 0.85, vol: 0.7, freq: 380 })
    tone({ f: 95, to: 24, dur: 0.7, type: 'triangle', vol: 0.55 })
  },
  collect: () => {
    tone({ f: 659.25, dur: 0.06, vol: 0.32 })
    tone({ f: 987.77, dur: 0.11, vol: 0.32, delay: 0.06 })
  },
  powerup: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
    tone({ f, dur: 0.15, vol: 0.38, delay: i * 0.09 })),
  bossDown: () => {
    noise({ dur: 0.9, vol: 0.65, freq: 350 })
    ;[392, 311.13, 261.63, 196].forEach((f, i) =>
      tone({ f, to: f * 0.5, dur: 0.3, type: 'sawtooth', vol: 0.36, delay: i * 0.16 }))
  },
  gameOver: () => [440, 349.23, 293.66, 220].forEach((f, i) =>
    tone({ f, dur: 0.44, vol: 0.38, delay: i * 0.34, type: 'triangle' })),
  bossShot: () => tone({ f: 320, to: 120, dur: 0.14, type: 'square', vol: 0.32 }),
  turretShot: () => tone({ f: 540, to: 180, dur: 0.1, vol: 0.28 }),
  slam: () => {
    noise({ dur: 0.32, vol: 0.6, freq: 300 })
    tone({ f: 75, to: 26, dur: 0.34, type: 'triangle', vol: 0.6 })
  },
  dash: () => noise({ dur: 0.26, vol: 0.35, freq: 1500 }),
  telegraph: () => tone({ f: 180, to: 240, dur: 0.3, type: 'sawtooth', vol: 0.3 }),
  checkpoint: () => [523.25, 783.99, 1046.5].forEach((f, i) =>
    tone({ f, dur: 0.12, vol: 0.34, delay: i * 0.08 })),
}
