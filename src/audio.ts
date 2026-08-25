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
    master.gain.value = muted ? 0 : 0.28
    master.connect(ctx.destination)
    musicBus = ctx.createGain()
    musicBus.gain.value = 0.32
    musicBus.connect(master)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

// --------------------------- Mobile unlock ---------------------------
// iOS/Safari: l'AudioContext ne démarre que dans un geste utilisateur, et il
// repart en « interrupted » après un verrouillage d'écran ou un changement
// d'app. On (re)tente donc le resume sur CHAQUE geste au niveau document,
// avec le classique buffer muet qui débloque les vieux WebKit.

let silentBufPlayed = false

function playSilentBuffer(c: AudioContext): void {
  if (silentBufPlayed) return
  try {
    const buf = c.createBuffer(1, 1, 22050)
    const src = c.createBufferSource()
    src.buffer = buf
    src.connect(c.destination)
    src.start(0)
    silentBufPlayed = true
  } catch {
    /* vieux navigateurs : ignorer */
  }
}

/** Crée/resume le contexte audio — sûr à appeler depuis n'importe quel geste. */
export function unlockAudio(): void {
  const c = ac()
  if (!c) return
  if (c.state === 'suspended') void c.resume()
  playSilentBuffer(c)
}

/**
 * Pose les listeners globaux de déblocage (une fois au boot). Complète les
 * handlers Phaser : les boutons tactiles DOM empêchent la propagation vers
 * le canvas, donc sans ça le contexte resterait suspendu sur mobile.
 */
export function installAudioGestures(): void {
  const kick = () => unlockAudio()
  const opts: AddEventListenerOptions = { passive: true, capture: true }
  document.addEventListener('pointerdown', kick, opts)
  document.addEventListener('touchend', kick, opts)
  document.addEventListener('keydown', kick, opts)
  document.addEventListener('visibilitychange', () => {
    // Retour au premier plan : iOS laisse souvent le contexte interrompu.
    if (!document.hidden) setTimeout(unlockAudio, 60)
  })
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
// Two tracks: 'menu' (slow, mysterious, A-minor) and 'stage' (fast MMX-style theme),
// plus one modern touch on the stage lead: a dotted-eighth delay.

type Track = 'menu' | 'stage'

let musicTimer: ReturnType<typeof setInterval> | null = null
let currentTrack: Track | null = null
let step = 0
let nextTime = 0
const BPM = 158
const STEP = 60 / BPM / 4
const MENU_STEP = 60 / 100 / 4

let leadBus: GainNode | null = null
function getLeadBus(): GainNode | null {
  const c = ctx
  if (!c) return null
  if (!leadBus) {
    leadBus = c.createGain()
    leadBus.gain.value = 1
    leadBus.connect(master!)
    // the modern touch: dotted-eighth echo on the lead
    const delay = c.createDelay(1)
    delay.delayTime.value = STEP * 3
    const feedback = c.createGain()
    feedback.gain.value = 0.26
    const wet = c.createGain()
    wet.gain.value = 0.22
    leadBus.connect(delay)
    delay.connect(feedback)
    feedback.connect(delay)
    delay.connect(wet)
    wet.connect(musicBus!)
  }
  return leadBus
}

const N = {
  A2: 110, C3: 130.81, D3: 146.83, E3: 164.81, F2: 87.31, F3: 174.61, G2: 98, G3: 196, A3: 220, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880, B5: 987.77,
  C6: 1046.5, D6: 1174.66, E6: 1318.51,
}

// Menu theme — A minor, slow arpeggios, airy (32 sixteenths at 100 BPM)
const MENU_BASS = [
  N.A2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  N.F2, 0, 0, 0, 0, 0, 0, 0, N.C3, 0, 0, 0, 0, 0, 0, 0,
]
const MENU_LEAD = [
  N.A4, 0, 0, 0, N.C5, 0, 0, 0, N.E5, 0, 0, 0, N.C5, 0, 0, 0,
  N.F4, 0, 0, 0, N.A4, 0, 0, 0, N.C5, 0, 0, 0, N.E5, 0, 0, 0,
  N.C5, 0, 0, 0, N.E5, 0, 0, 0, N.G5, 0, 0, 0, N.E5, 0, 0, 0,
  N.G4, 0, 0, 0, N.B4, 0, 0, 0, N.D5, 0, 0, 0, N.B4, 0, 0, 0,
]

// Two 2-bar sections (32 sixteenths each): A = bouncy theme, B = soaring answer.
const LEAD_A = [
  N.E5, 0, N.G5, 0, N.A5, 0, N.G5, N.E5,
  0, N.C5, 0, N.D5, N.E5, 0, N.D5, N.C5,
  N.E5, 0, N.G5, 0, N.A5, 0, N.B5, N.C6,
  0, N.B5, N.G5, N.A5, 0, N.E5, 0, 0,
]
const LEAD_A2 = [
  N.E5, 0, N.G5, 0, N.A5, 0, N.G5, N.E5,
  0, N.C5, 0, N.D5, N.E5, 0, N.G5, N.A5,
  N.B5, 0, N.C6, 0, N.D6, 0, N.C6, N.B5,
  0, N.A5, N.G5, N.A5, 0, N.E5, 0, 0,
]
const LEAD_B = [
  N.F5, 0, N.A5, 0, N.C6, 0, N.A5, N.F5,
  0, N.G5, 0, N.A5, N.B5, 0, N.C6, 0,
  N.D6, 0, N.C6, 0, N.B5, 0, N.G5, 0,
  N.A5, 0, N.G5, 0, N.E5, 0, N.C5, 0,
]
const LEAD_B2 = [
  N.F5, 0, N.A5, 0, N.C6, 0, N.E6, N.D6,
  0, N.C6, 0, N.B5, N.C6, 0, N.D6, 0,
  N.E6, 0, N.D6, 0, N.C6, 0, N.B5, 0,
  N.C6, 0, N.G5, 0, N.E5, 0, N.C5, 0,
]
const BASS_A = [
  N.C3, 0, N.C4, 0, N.C3, 0, N.C4, N.C3,
  0, N.C4, 0, N.C3, N.C4, 0, N.C3, 0,
  N.A2, 0, N.A3, 0, N.A2, 0, N.E3, N.A2,
  0, N.A3, 0, N.E3, N.A3, 0, N.E3, 0,
]
const BASS_B = [
  N.F3, 0, N.F3, 0, N.F3, 0, N.C4, N.F3,
  0, N.C4, 0, N.F3, N.C4, 0, N.F3, 0,
  N.G3, 0, N.D4, 0, N.G3, 0, N.D4, N.G3,
  0, N.D4, 0, N.G3, N.D4, 0, N.G3, 0,
]
const KICK = [
  1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0,
  1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0,
]
const SNARE = [
  0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1,
  0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0,
]
const HAT = [
  1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 0,
  1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 1, 0,
]

function schedule() {
  const c = ctx
  if (!c || !musicBus) return
  // Resync si le contexte a été suspendu/throttlé (onglet caché, iOS) :
  // sinon toutes les notes en retard partiraient d'un coup au resume.
  if (nextTime < c.currentTime - 0.2) nextTime = c.currentTime + 0.05
  const lead = getLeadBus()
  const menu = currentTrack === 'menu'
  const stepDur = menu ? MENU_STEP : STEP
  while (nextTime < c.currentTime + 0.35) {
    const delay = Math.max(0, nextTime - c.currentTime)
    if (menu) {
      const i = step % 32
      const b = MENU_BASS[i]
      if (b) tone({ f: b, dur: stepDur * 14, type: 'triangle', vol: 0.5, delay, bus: musicBus })
      const l = MENU_LEAD[i]
      if (l) tone({ f: l, dur: stepDur * 3.4, type: 'square', vol: 0.09, delay, bus: lead })
      if (i % 16 === 0) noise({ dur: 0.05, vol: 0.05, freq: 4500, delay })
    } else {
      const bar = Math.floor(step / 32) % 4
      const i = step % 32
      const leadPat = bar === 0 ? LEAD_A : bar === 1 ? LEAD_A2 : bar === 2 ? LEAD_B : LEAD_B2
      const bassPat = bar < 2 ? BASS_A : BASS_B
      const li = leadPat[i]
      if (li) tone({ f: li, dur: STEP * 0.9, type: 'square', vol: 0.13, delay, bus: lead })
      const b = bassPat[i]
      if (b) tone({ f: b, dur: STEP * 1.5, type: 'triangle', vol: 0.5, delay, bus: musicBus })
      if (KICK[i]) tone({ f: 150, to: 45, dur: 0.1, type: 'sine', vol: 0.75, delay, bus: musicBus })
      if (SNARE[i]) noise({ dur: 0.09, vol: 0.3, freq: 2400, delay })
      if (HAT[i]) noise({ dur: 0.03, vol: 0.12, freq: 7000, delay })
    }
    nextTime += stepDur
    step++
  }
}

export function startMusic(track: Track = 'stage') {
  const c = ac()
  if (!c) return
  if (musicTimer && currentTrack === track) return
  if (musicTimer) {
    clearInterval(musicTimer)
    musicTimer = null
  }
  currentTrack = track
  step = 0
  nextTime = c.currentTime + 0.2
  musicTimer = setInterval(schedule, 120)
}

export function stopMusic() {
  if (musicTimer) {
    clearInterval(musicTimer)
    musicTimer = null
  }
  currentTrack = null
}

export function getTrack(): Track | null {
  return currentTrack
}

// --------------------------- SFX ---------------------------

export const sfx = {
  /** Create/resume the AudioContext — call from a user gesture. */
  unlock: () => { unlockAudio() },
  toggleMute: () => {
    muted = !muted
    if (master) master.gain.value = muted ? 0 : 0.28
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
  /** Short boot fanfare for the DarkMedia-X splash. */
  intro: () => {
    ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ f, dur: 0.16, vol: 0.3, delay: i * 0.08, type: 'square' }))
    tone({ f: 1318.51, dur: 0.42, vol: 0.26, delay: 0.34, type: 'square' })
    noise({ dur: 0.3, vol: 0.12, freq: 6000, delay: 0.34 })
  },
}
