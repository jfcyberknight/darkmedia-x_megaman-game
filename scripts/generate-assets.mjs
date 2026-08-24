/**
 * HD asset generator — modern 2D look (smooth gradients, rim light, glow).
 * World scale: x2.5 vs the original SNES build (tiles 80px, world 4000x1600).
 * Run: node scripts/generate-assets.mjs
 */
import { PNG } from 'pngjs'
import { writeFileSync, readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'assets')
const previewDir = join(__dirname, 'preview')
mkdirSync(outDir, { recursive: true })
mkdirSync(previewDir, { recursive: true })

// ---------------------------------------------------------------------------
// Float canvas with source-over + additive compositing (RGBA 0..255, alpha 0..1)
// ---------------------------------------------------------------------------
function C(w, h) {
  return { w, h, d: new Float32Array(w * h * 4) }
}
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v)

function over(c, x, y, r, g, b, a) {
  x |= 0; y |= 0
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return
  const i = (y * c.w + x) * 4, d = c.d
  const sa = clamp(a, 0, 1), da = d[i + 3] / 255
  const oa = sa + da * (1 - sa)
  if (oa <= 0) return
  d[i] = (r * sa + d[i] * da * (1 - sa)) / oa
  d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa
  d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa
  d[i + 3] = oa * 255
}
function addPx(c, x, y, r, g, b, a) {
  x |= 0; y |= 0
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return
  const i = (y * c.w + x) * 4, d = c.d
  d[i] = Math.min(255, d[i] + r * a)
  d[i + 1] = Math.min(255, d[i + 1] + g * a)
  d[i + 2] = Math.min(255, d[i + 2] + b * a)
  d[i + 3] = Math.min(255, d[i + 3] + 255 * a)
}

/** Fill a bounded region: cov(x,y) -> coverage 0..1 (AA), col(x,y) -> [r,g,b]. */
function fillB(c, x0, y0, x1, y1, cov, col) {
  const xa = Math.max(0, Math.floor(x0)), xb = Math.min(c.w - 1, Math.ceil(x1))
  const ya = Math.max(0, Math.floor(y0)), yb = Math.min(c.h - 1, Math.ceil(y1))
  for (let y = ya; y <= yb; y++)
    for (let x = xa; x <= xb; x++) {
      const a = cov(x + 0.5, y + 0.5)
      if (a > 0.003) {
        const [r, g, b] = col(x + 0.5, y + 0.5)
        over(c, x, y, r, g, b, a)
      }
    }
}

// --- bounded shape primitives (1px anti-aliasing) ---
const rr = (c, cx, cy, hw, hh, r, col) => {
  const cov = (x, y) => {
    const dx = Math.max(Math.abs(x - cx) - (hw - r), 0)
    const dy = Math.max(Math.abs(y - cy) - (hh - r), 0)
    return clamp(0.5 - (Math.sqrt(dx * dx + dy * dy) - r), 0, 1)
  }
  fillB(c, cx - hw - 1, cy - hh - 1, cx + hw + 1, cy + hh + 1, cov, col)
}
const el = (c, cx, cy, rx, ry, col) => {
  const cov = (x, y) => {
    const dx = (x - cx) / rx, dy = (y - cy) / ry
    const d = Math.sqrt(dx * dx + dy * dy) - 1
    return clamp(0.5 - d * Math.min(rx, ry) * 0.8, 0, 1)
  }
  fillB(c, cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1, cov, col)
}
const seg = (c, x1, y1, x2, y2, r, col) => {
  const cov = (x, y) => {
    const vx = x2 - x1, vy = y2 - y1
    const len2 = vx * vx + vy * vy || 1
    const t = clamp(((x - x1) * vx + (y - y1) * vy) / len2, 0, 1)
    const px = x1 + vx * t, py = y1 + vy * t
    return clamp(0.5 - (Math.sqrt((x - px) ** 2 + (y - py) ** 2) - r), 0, 1)
  }
  fillB(c, Math.min(x1, x2) - r - 1, Math.min(y1, y2) - r - 1, Math.max(x1, x2) + r + 1, Math.max(y1, y2) + r + 1, cov, col)
}

/** Additive glow blob. */
function glow(c, cx, cy, rad, [r, g, b], intensity = 1) {
  const x0 = Math.max(0, Math.floor(cx - rad)), x1 = Math.min(c.w - 1, Math.ceil(cx + rad))
  const y0 = Math.max(0, Math.floor(cy - rad)), y1 = Math.min(c.h - 1, Math.ceil(cy + rad))
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy
      const dist = Math.sqrt(dx * dx + dy * dy) / rad
      if (dist >= 1) continue
      const fall = (1 - dist) * (1 - dist)
      addPx(c, x, y, r, g, b, fall * intensity)
    }
}

// --- color helpers ---
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255]
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const clamp01 = (v) => clamp(v, 0, 1)
const solid = (c1) => () => c1

/** Soft dark outline around existing opaque pixels (small canvases only). */
function outline(c, col = [10, 12, 24], width = 2, strength = 0.95) {
  const src = Float32Array.from(c.d)
  const alphaAt = (x, y) => (x < 0 || y < 0 || x >= c.w || y >= c.h ? 0 : src[(y * c.w + x) * 4 + 3] / 255)
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      const i = (y * c.w + x) * 4
      if (src[i + 3] / 255 > 0.35) continue
      let m = 0
      for (let dy = -width; dy <= width; dy++)
        for (let dx = -width; dx <= width; dx++) {
          const a = alphaAt(x + dx, y + dy)
          const fall = 1 - Math.sqrt(dx * dx + dy * dy) / (width + 0.5)
          if (fall > 0 && a * fall > m) m = a * fall
        }
      if (m > 0.12) over(c, x, y, col[0], col[1], col[2], Math.min(1, m * strength))
    }
}

function save(c, file) {
  const png = new PNG({ width: c.w, height: c.h })
  for (let i = 0; i < c.w * c.h; i++) {
    png.data[i * 4] = clamp(Math.round(c.d[i * 4]), 0, 255)
    png.data[i * 4 + 1] = clamp(Math.round(c.d[i * 4 + 1]), 0, 255)
    png.data[i * 4 + 2] = clamp(Math.round(c.d[i * 4 + 2]), 0, 255)
    png.data[i * 4 + 3] = clamp(Math.round(c.d[i * 4 + 3]), 0, 255)
  }
  writeFileSync(join(outDir, file), PNG.sync.write(png))
}
function savePreview(c, file, scale = 4) {
  const png = new PNG({ width: c.w * scale, height: c.h * scale })
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const sx = Math.floor(x / scale), sy = Math.floor(y / scale)
      const i = (y * png.width + x) * 4, s = (sy * c.w + sx) * 4
      png.data[i] = c.d[s]; png.data[i + 1] = c.d[s + 1]; png.data[i + 2] = c.d[s + 2]; png.data[i + 3] = c.d[s + 3]
    }
  writeFileSync(join(previewDir, file), PNG.sync.write(png))
}
function stitch(canvases) {
  const w = canvases.reduce((a, c) => a + c.w, 0)
  const h = canvases[0].h
  const out = C(w, h)
  let ox = 0
  for (const c of canvases) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < c.w; x++) {
        const i = (y * c.w + x) * 4, o = (y * out.w + x + ox) * 4
        if (c.d[i + 3] <= 0) continue
        out.d[o] = c.d[i]; out.d[o + 1] = c.d[i + 1]; out.d[o + 2] = c.d[i + 2]; out.d[o + 3] = c.d[i + 3]
      }
    ox += c.w
  }
  return out
}
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Palette — modern armored hero
// ---------------------------------------------------------------------------
const P = {
  armorHi: hex(0x7db2ff),
  armorTop: hex(0x3f7bdb),
  armorLo: hex(0x1d3f8f),
  armorDeep: hex(0x122457),
  joint: hex(0x131a30),
  gunTop: hex(0x5b6b85),
  gunLo: hex(0x232c40),
  visor: hex(0x35e0ff),
  visorDeep: hex(0x0e7fa8),
  core: hex(0x66f0ff),
  white: hex(0xf4faff),
  bootTop: hex(0x2c4a9e),
  bootLo: hex(0x152252),
  skin: hex(0xf3c9a0),
}

// ============================ PLAYER (40x60, 8 frames) ============================
// Sleek armored hero facing right: glowing visor, chest core, buster cannon.

function drawHead(c, ox, oy) {
  // helmet dome
  el(c, ox + 19, oy + 12, 10.5, 9.5, (x, y) => {
    const t = clamp01((y - (oy + 3)) / 18)
    const light = Math.max(0, 1 - Math.hypot((x - (ox + 14)) / 12, (y - (oy + 7)) / 10))
    return mix(mix(P.armorTop, P.armorLo, t), P.armorHi, light * 0.55)
  })
  // visor band
  rr(c, ox + 20, oy + 13, 9, 4, 3.5, (x, y) => {
    const t = clamp01((y - (oy + 9)) / 8)
    const spec = Math.max(0, 1 - Math.hypot((x - (ox + 15)) / 6, (y - (oy + 11)) / 2.4))
    return mix(mix(P.visor, P.visorDeep, t), P.white, spec * 0.8)
  })
  glow(c, ox + 22, oy + 13, 9, P.visor, 0.22)
  // ear pod
  el(c, ox + 9.5, oy + 13, 2.8, 3.2, solid(mix(P.armorLo, P.joint, 0.4)))
  el(c, ox + 9.5, oy + 13, 1.2, 1.5, solid(P.visor))
  // crest fin
  seg(c, ox + 18, oy + 3.4, ox + 22, oy + 1.6, 1.7, solid(P.visor))
  glow(c, ox + 20, oy + 2.5, 6, P.visor, 0.5)
  // chin
  rr(c, ox + 21, oy + 19.5, 4.5, 2, 2, solid(mix(P.skin, [180, 130, 95], 0.25)))
}

function drawTorso(c, ox, oy) {
  // neck
  rr(c, ox + 19, oy + 21.5, 3, 2, 1.5, solid(P.joint))
  // torso
  rr(c, ox + 19.5, oy + 29.5, 8, 8.5, 5, (x, y) => {
    const t = clamp01((y - (oy + 21)) / 17)
    const light = Math.max(0, 1 - Math.hypot((x - (ox + 14)) / 10, (y - (oy + 25)) / 10))
    return mix(mix(P.armorTop, P.armorLo, t), P.armorHi, light * 0.4)
  })
  // chest plate
  rr(c, ox + 19.5, oy + 29, 6, 4.6, 3.5, (x, y) => {
    const t = clamp01((y - (oy + 24)) / 10)
    return mix(mix(P.armorHi, P.armorTop, 0.4), P.armorLo, t * 0.7)
  })
  // glowing core
  el(c, ox + 19.5, oy + 29, 2.6, 2.6, solid(P.white))
  glow(c, ox + 19.5, oy + 29, 7.5, P.core, 0.65)
  // waist belt
  rr(c, ox + 19.5, oy + 39, 7, 2, 1.5, solid(P.joint))
  rr(c, ox + 21, oy + 39, 1.6, 1.2, 1, solid(P.visor))
}

function drawBackArm(c, ox, oy) {
  seg(c, ox + 12.5, oy + 26, ox + 11.5, oy + 36, 3.1, (x, y) => mix(P.armorLo, P.armorDeep, clamp01((y - oy - 26) / 10)))
  el(c, ox + 11.5, oy + 38.5, 2.8, 2.8, solid(P.joint))
}

/** Buster cannon; raised=true for shooting pose. */
function drawBuster(c, ox, oy, raised = false) {
  const sy = raised ? -3 : 0
  // shoulder pad
  el(c, ox + 27, oy + 25 + sy, 4.6, 4.2, (x, y) => {
    const light = Math.max(0, 1 - Math.hypot((x - (ox + 25.5)) / 5, (y - (oy + 23 + sy)) / 4))
    return mix(P.armorTop, P.armorHi, light * 0.7)
  })
  // cannon body
  rr(c, ox + 31.5, oy + 29.5 + sy, 7, 4.2, 3.5, (x, y) => {
    const t = clamp01((y - (oy + 25 + sy)) / 9)
    const spec = Math.max(0, 1 - Math.abs(y - (oy + 27 + sy)) / 1.6)
    return mix(mix(P.gunTop, P.gunLo, t), P.white, spec * 0.25)
  })
  // muzzle ring + energy tip
  rr(c, ox + 37, oy + 29.5 + sy, 1.6, 3.4, 1.4, solid(P.joint))
  el(c, ox + 38.6, oy + 29.5 + sy, 1.5, 2.4, solid(P.visor))
  glow(c, ox + 38.5, oy + 29.5 + sy, 7, P.visor, 0.6)
}

// --- leg poses (40x60 frame, hips at ~y41) ---
function drawBoot(c, ox, oy, x, y, dark) {
  rr(c, ox + x, oy + y, 4.6, 3.6, 2.6, solid(dark ? P.bootLo : P.bootTop))
}
function legsIdle(c, ox, oy) {
  for (const hx of [16.5, 23]) {
    seg(c, ox + hx, oy + 41, ox + hx, oy + 49, 3.6, (x, y) => mix(P.armorTop, P.armorLo, clamp01((y - oy - 41) / 9)))
    drawBoot(c, ox, oy, hx + 1.6, 53, false)
  }
}
function legsRun(c, ox, oy, phase) {
  const poses = [
    [[26, 42, 31, 56], [14, 42, 8, 44]],
    [[21, 42, 22, 57], [18, 42, 15, 55]],
    [[14, 42, 8, 44], [26, 42, 32, 55]],
    [[19, 42, 17, 56], [22, 42, 25, 56]],
  ]
  const [front, back] = poses[phase]
  const drawLeg = ([x1, y1, x2, y2], dark) => {
    seg(c, ox + x1, oy + y1, ox + x2, oy + y2, 3.4, (x, y) => mix(dark ? P.armorLo : P.armorTop, dark ? P.armorDeep : P.armorLo, clamp01((y - oy - 41) / 16)))
    drawBoot(c, ox, oy, x2 + 1.4, y2 + 0.5, dark)
  }
  drawLeg(back, true)
  drawLeg(front, false)
}
function legsJump(c, ox, oy) {
  seg(c, ox + 15, oy + 42, ox + 10, oy + 48, 3.4, solid(P.armorLo))
  drawBoot(c, ox, oy, 8.6, 49, true)
  seg(c, ox + 24, oy + 42, ox + 30, oy + 47, 3.4, solid(P.armorTop))
  drawBoot(c, ox, oy, 31.4, 48.5, false)
}
function legsFall(c, ox, oy) {
  seg(c, ox + 15, oy + 42, ox + 11, oy + 52, 3.4, solid(P.armorLo))
  drawBoot(c, ox, oy, 9.6, 54, true)
  seg(c, ox + 24, oy + 42, ox + 29, oy + 52, 3.4, solid(P.armorTop))
  drawBoot(c, ox, oy, 30.6, 54, false)
}

function playerFrame(bob, legsFn, shooting = false) {
  const c = C(40, 60)
  const oy = bob ? 1.5 : 0
  legsFn(c, 0, 0)
  drawBackArm(c, 0, oy)
  drawTorso(c, 0, oy)
  drawHead(c, 0, oy)
  drawBuster(c, 0, oy, shooting)
  outline(c, [8, 10, 22], 2)
  return c
}

// frames: 0 idle, 1 idle-bob, 2-5 run, 6 jump, 7 fall
const playerFrames = [
  playerFrame(false, legsIdle),
  playerFrame(true, legsIdle),
  playerFrame(false, (c, ox, oy) => legsRun(c, ox, oy, 0)),
  playerFrame(true, (c, ox, oy) => legsRun(c, ox, oy, 1)),
  playerFrame(false, (c, ox, oy) => legsRun(c, ox, oy, 2)),
  playerFrame(true, (c, ox, oy) => legsRun(c, ox, oy, 3)),
  playerFrame(false, legsJump),
  playerFrame(false, legsFall),
]
const playerSheet = stitch(playerFrames)
save(playerSheet, 'player.png')
savePreview(playerSheet, 'player.png', 4)

// ============================ ENEMY (45x45, 2 frames) ============================
// Scarab drone: glossy red-orange dome, glowing eyes, skittering legs.
function enemyFrame(step) {
  const c = C(45, 45)
  const bob = step === 1 ? -1.2 : 0
  // shell dome
  el(c, 22.5, 20 + bob, 15, 12.5, (x, y) => {
    const t = clamp01((y - (8 + bob)) / 25)
    const spec = Math.max(0, 1 - Math.hypot((x - 16) / 8, (y - (13 + bob)) / 6))
    return mix(mix(hex(0xf0655a), hex(0x8f1d1d), t), hex(0xffd0c4), spec * 0.75)
  })
  // shell seam
  seg(c, 22.5, 8.5 + bob, 22.5, 30 + bob, 0.7, solid(hex(0x6b1414)))
  // visor slit + eyes
  rr(c, 22.5, 25 + bob, 12, 3.2, 3, solid(hex(0x140608)))
  for (const ex of [16.5, 28.5]) {
    el(c, ex, 25 + bob, 2, 1.8, solid(hex(0xffd166)))
    glow(c, ex, 25 + bob, 5.5, hex(0xffb347), 0.8)
  }
  // antenna
  seg(c, 22.5, 9 + bob, 22.5, 4 + bob, 1.1, solid(hex(0x5e1010)))
  el(c, 22.5, 3.4 + bob, 1.5, 1.5, solid(hex(0xfff3c4)))
  glow(c, 22.5, 3.4 + bob, 5, hex(0xffd166), 0.7)
  // underside
  rr(c, 22.5, 33.5 + bob, 10, 3, 2.5, solid(hex(0x2a0c0e)))
  // legs (alternate pairs)
  const legsA = [[[12, 34], [7, 41]], [[33, 34], [38, 41]]]
  const legsB = [[[14, 34], [11, 42]], [[31, 34], [34, 42]]]
  for (const [[x1, y1], [x2, y2]] of step === 0 ? legsA : legsB) {
    seg(c, x1, y1 + bob, x2, y2 + bob, 2.3, solid(hex(0x6b2024)))
    el(c, x2, y2 + bob, 2.5, 1.8, solid(hex(0x2e0a0c)))
  }
  outline(c, [16, 6, 10], 2)
  return c
}
const enemySheet = stitch([enemyFrame(0), enemyFrame(1)])
save(enemySheet, 'enemy.png')
savePreview(enemySheet, 'enemy.png', 4)

// ============================ BOSS (80x80, 2 frames) ============================
// Heavy war machine: armored hull, glowing eye bar, pulsing reactor core.
function bossFrame(pulse) {
  const c = C(80, 80)
  // leg tracks
  rr(c, 29, 71, 11, 5.5, 4, solid(hex(0x1a2130)))
  rr(c, 51, 71, 11, 5.5, 4, solid(hex(0x1a2130)))
  rr(c, 29, 68, 9, 3, 2, solid(hex(0x39465e)))
  rr(c, 51, 68, 9, 3, 2, solid(hex(0x39465e)))
  // torso
  rr(c, 40, 56, 21, 13, 9, (x, y) => {
    const t = clamp01((y - 44) / 26)
    const light = Math.max(0, 1 - Math.hypot((x - 30) / 16, (y - 48) / 12))
    return mix(mix(hex(0x4b5a74), hex(0x1c2436), t), hex(0x8fa3c4), light * 0.4)
  })
  // hull dome
  el(c, 40, 33, 28, 21, (x, y) => {
    const t = clamp01((y - 12) / 42)
    const rim = Math.max(0, 1 - Math.hypot((x - 30) / 22, (y - 20) / 14))
    const spec = Math.max(0, 1 - Math.hypot((x - 28) / 10, (y - 22) / 8))
    return mix(mix(mix(hex(0x5d6f8d), hex(0x232c42), t), hex(0x93a7c9), rim * 0.5), hex(0xd7e2f2), spec * 0.5)
  })
  // top plate + warning lights
  rr(c, 40, 12, 15, 4.5, 4, solid(hex(0x2b3448)))
  for (const lx of [32, 40, 48]) {
    el(c, lx, 10.5, 1.6, 1.3, solid(hex(0xffc857)))
    glow(c, lx, 10.5, 4.5, hex(0xffb347), 0.5)
  }
  // eye visor
  rr(c, 40, 33, 18, 5.5, 5, solid(hex(0x12060a)))
  seg(c, 27, 33, 53, 33, 2.4, solid(pulse ? hex(0xff4d4d) : hex(0xff6b5e)))
  seg(c, 33, 33, 45, 33, 1.3, solid(hex(0xffe1d0)))
  glow(c, 40, 33, 16, hex(0xff3b3b), pulse ? 0.75 : 0.5)
  // shoulder pods + fins
  for (const [sx, dir] of [[13, -1], [67, 1]]) {
    el(c, sx, 32, 8.5, 9, (x, y) => {
      const t = clamp01((y - 23) / 18)
      return mix(hex(0x3c4a63), hex(0x161d2c), t)
    })
    seg(c, sx, 24, sx + dir * 4, 14, 2.6, solid(hex(0x2b3448)))
    el(c, sx, 32, 3, 3.4, solid(hex(0xff6b5e)))
    glow(c, sx, 32, 7, hex(0xff5546), 0.45)
  }
  // reactor core (pulses)
  const coreR = pulse ? 6.4 : 5.6
  el(c, 40, 56, coreR, coreR, solid(hex(0xfff6d8)))
  glow(c, 40, 56, 18, hex(0xffc857), pulse ? 0.95 : 0.6)
  // hull seam
  seg(c, 18, 44, 62, 44, 0.8, solid(hex(0x1a2130)))
  outline(c, [7, 9, 16], 2)
  return c
}
const bossSheet = stitch([bossFrame(false), bossFrame(true)])
save(bossSheet, 'boss.png')
savePreview(bossSheet, 'boss.png', 4)

// ============================ BULLET (18x10) ============================
{
  const c = C(18, 10)
  // soft outer halo (low-alpha ellipse)
  const halo = C(18, 10)
  el(halo, 9, 5, 8.5, 4.4, solid(hex(0x35e0ff)))
  for (let i = 3; i < halo.d.length; i += 4) halo.d[i] *= 0.35
  for (let i = 0; i < halo.d.length; i += 4)
    if (halo.d[i + 3] > 0) over(c, i / 4 % 18, Math.floor(i / 4 / 18), halo.d[i], halo.d[i + 1], halo.d[i + 2], halo.d[i + 3] / 255)
  el(c, 9, 5, 5.6, 2.8, solid(hex(0x9df2ff)))
  el(c, 9, 5, 3, 1.7, solid(hex(0xffffff)))
  save(c, 'bullet.png')
  savePreview(c, 'bullet.png', 8)
}

// ============================ GLOW BLOB (64x64, additive) ============================
{
  const c = C(64, 64)
  glow(c, 32, 32, 30, hex(0xffffff), 1.0)
  save(c, 'glow.png')
}

// ============================ VIGNETTE (960x540) ============================
{
  const w = 960, h = 540
  const c = C(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2)
      const r = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2
      const a = clamp01((r - 0.55) / 0.45)
      over(c, x, y, 4, 5, 12, a * a * 0.72)
    }
  save(c, 'vignette.png')
}

// ============================ TILESET (4 x 80x80) ============================
{
  const T = 80
  const speckle = (c, rnd, amt, density) => {
    for (let y = 0; y < c.h; y++)
      for (let x = 0; x < c.w; x++)
        if (rnd() < density) {
          const n = (rnd() - 0.5) * amt
          const i = (y * c.w + x) * 4
          if (c.d[i + 3] > 0) {
            c.d[i] = clamp(c.d[i] + n, 0, 255); c.d[i + 1] = clamp(c.d[i + 1] + n, 0, 255); c.d[i + 2] = clamp(c.d[i + 2] + n, 0, 255)
          }
        }
  }
  const bolt = (c, x, y) => {
    el(c, x, y, 3, 3, solid(hex(0x1c2434)))
    el(c, x - 0.7, y - 0.7, 2, 2, solid(hex(0x8fa3c4)))
    el(c, x - 0.9, y - 0.9, 0.9, 0.9, solid(hex(0xd7e2f2)))
  }
  const seam = (c, y) => rr(c, c.w / 2, y, c.w / 2, 1.1, 1, solid(hex(0x1a2130)))

  // tile 1: ground top
  const t1 = C(T, T)
  fillB(t1, 0, 0, T - 1, T - 1, () => 1, (x, y) => {
    const bevel = clamp01(1 - y / 9)
    const base = mix(hex(0x8fa3c4), hex(0x4b5a74), clamp01(y / T))
    return mix(base, hex(0xd7e2f2), bevel * 0.8)
  })
  rr(t1, T / 2, 1.2, T / 2, 1.2, 1, solid(hex(0xeef4fc)))
  seam(t1, 30); seam(t1, 58)
  bolt(t1, 12, 16); bolt(t1, 68, 16); bolt(t1, 12, 44); bolt(t1, 68, 44)
  speckle(t1, mulberry32(42), 14, 0.06)
  // tile 2: ground body
  const t2 = C(T, T)
  fillB(t2, 0, 0, T - 1, T - 1, () => 1, (x, y) => mix(hex(0x3c4a63), hex(0x1a2130), clamp01(y / T)))
  seam(t2, 22); seam(t2, 54)
  bolt(t2, 24, 12); bolt(t2, 56, 12); bolt(t2, 24, 40); bolt(t2, 56, 40); bolt(t2, 40, 68)
  speckle(t2, mulberry32(7), 12, 0.05)
  // tile 3: floating platform slab
  const t3 = C(T, T)
  rr(t3, T / 2, T / 2 - 6, T / 2, 30, 6, (x, y) => {
    const t = clamp01((y - 6) / 60)
    const light = Math.max(0, 1 - Math.hypot((x - T / 2) / 44, (y - 10) / 12))
    return mix(mix(hex(0x8fa3c4), hex(0x2b3448), t), hex(0xd7e2f2), light * 0.5)
  })
  rr(t3, T / 2, 5, T / 2 - 2, 2.4, 2, solid(hex(0xeef4fc)))
  rr(t3, T / 2, 66, T / 2 - 3, 6, 4, solid(hex(0x10141f)))
  rr(t3, T / 2, 61, T / 2 - 4, 1.4, 1.2, solid(hex(0x35e0ff)))
  bolt(t3, 14, 20); bolt(t3, 66, 20); bolt(t3, 14, 44); bolt(t3, 66, 44)
  speckle(t3, mulberry32(99), 12, 0.05)
  // tile 0: empty
  const t0 = C(T, T)
  const sheet = stitch([t0, t1, t2, t3])
  save(sheet, 'tileset.png')
  savePreview(sheet, 'tileset.png', 3)
}

// ============================ STAGE BACKGROUNDS (1920x540, tileable) ============================
const STAGE_ART = {
  'neon-city': {
    far: [0x2a2150, 0x191536], mid: [0x1b1638, 0x100d24],
    window: 0xffd166, windowAlt: 0x7dd3fc, sign: [0xf472b6, 0x22d3ee],
  },
  'toxic-plant': {
    far: [0x14301f, 0x0a1a10], mid: [0x0e2416, 0x071409],
    window: 0xa3e635, windowAlt: 0x4ade80, sign: [0x4ade80, 0xa3e635],
  },
  'scorched-desert': {
    far: [0x3a1f0e, 0x1f1006], mid: [0x291508, 0x170b04],
    window: 0xfbbf24, windowAlt: 0xf59e0b, sign: [0xfb923c, 0xfbbf24],
  },
  'frost-lab': {
    far: [0x16325c, 0x0b1a30], mid: [0x102640, 0x081426],
    window: 0xbae6fd, windowAlt: 0x60a5fa, sign: [0x60a5fa, 0xbae6fd],
  },
  'sky-fortress': {
    far: [0x401a33, 0x200a18], mid: [0x2a1122, 0x170812],
    window: 0xf9a8d4, windowAlt: 0xf472b6, sign: [0xf472b6, 0xf9a8d4],
  },
}

const BW = 1920, BH = 540

/** One tileable skyline layer. */
function skyline(seed, { top, bottom, windows, windowAlt, signs, winDensity, minH, maxH }) {
  const c = C(BW, BH)
  const rnd = mulberry32(seed)
  const drawBuilding = (bx, bw, bh, shade) => {
    for (const ox of [0, -BW]) {
      const x0 = bx + ox
      // body with vertical gradient
      rr(c, x0 + bw / 2, BH - bh / 2, bw / 2, bh / 2, 2, (x, y) => mix(top, bottom, clamp01((y - (BH - bh)) / bh) * 0.9 + shade * 0.1))
      // roof lip
      rr(c, x0 + bw / 2, BH - bh + 1.5, bw / 2 - 1, 1.5, 1, solid(mix(top, hex(0xffffff), 0.14)))
      // windows
      if (windows) {
        for (let wy = BH - bh + 12; wy < BH - 14; wy += 20) {
          for (let wx = x0 + 8; wx < x0 + bw - 10; wx += 14) {
            if (rnd() > winDensity) continue
            const col = rnd() > 0.72 ? windowAlt : windows
            const bright = 0.35 + rnd() * 0.65
            rr(c, wx + 3, wy + 4, 3, 4.5, 1, solid(mix(col, hex(0x000000), 1 - bright)))
            if (bright > 0.8) glow(c, wx + 3, wy + 4, 6, col, 0.25)
          }
        }
      }
      // antenna
      if (rnd() > 0.55) {
        const ax = x0 + bw * (0.25 + rnd() * 0.5)
        const ah = 10 + rnd() * 22
        seg(c, ax, BH - bh, ax, BH - bh - ah, 1.2, solid(mix(top, hex(0xffffff), 0.2)))
        const [sr, sg, sb] = hex(signs ? signs[0] : 0xff5566)
        el(c, ax, BH - bh - ah, 1.6, 1.6, solid([sr, sg, sb]))
        glow(c, ax, BH - bh - ah, 6, [sr, sg, sb], 0.5)
      }
      // neon sign strips on mid layer
      if (signs && rnd() > 0.62) {
        const [sr, sg, sb] = hex(signs[Math.floor(rnd() * signs.length)])
        const sx = x0 + 6 + rnd() * (bw - 16)
        const sy = BH - bh + 16 + rnd() * (bh * 0.4)
        const sh = 14 + rnd() * 26
        rr(c, sx, sy + sh / 2, 2.2, sh / 2, 2, solid([sr, sg, sb]))
        glow(c, sx, sy + sh / 2, 12, [sr, sg, sb], 0.4)
      }
    }
  }
  let x = -10
  while (x < BW + 40) {
    const bw = 70 + rnd() * 150
    const bh = minH + rnd() * (maxH - minH)
    drawBuilding(x, bw, bh, rnd())
    x += bw + 6 + rnd() * 26
  }
  return c
}

for (const [id, art] of Object.entries(STAGE_ART)) {
  const far = skyline(id.length * 1337 + 11, {
    top: hex(art.far[0]), bottom: hex(art.far[1]),
    windows: null, signs: null, minH: 150, maxH: 400,
  })
  save(far, `bg-far-${id}.png`)

  const mid = skyline(id.length * 7331 + 97, {
    top: hex(art.mid[0]), bottom: hex(art.mid[1]),
    windows: hex(art.window), windowAlt: hex(art.windowAlt),
    signs: art.sign, winDensity: 0.3, minH: 90, maxH: 280,
  })
  save(mid, `bg-mid-${id}.png`)
}

// haze band (white -> transparent, tinted in-game)
{
  const c = C(960, 180)
  for (let y = 0; y < 180; y++)
    for (let x = 0; x < 960; x++)
      over(c, x, y, 255, 255, 255, clamp01(1 - y / 180) * 0.5)
  save(c, 'haze.png')
}

// ============================ LEVEL JSON PATCH (x2.5 scale) ============================
{
  const levelPath = join(outDir, 'level.json')
  const level = JSON.parse(readFileSync(levelPath, 'utf8'))
  level.tilewidth = 80
  level.tileheight = 80
  for (const ts of level.tilesets) {
    ts.tilewidth = 80
    ts.tileheight = 80
    ts.imagewidth = 320
    ts.imageheight = 80
  }
  writeFileSync(levelPath, JSON.stringify(level))
}

// preview composite: sky + far + mid for neon-city
{
  const w = 960, h = 540
  const c = C(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r1, g1, b1] = hex(0x2b1e4e), [r2, g2, b2] = hex(0x0d0e15)
      const t = y / h
      over(c, x, y, r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t, 1)
    }
  const far = skyline(1, { top: hex(0x2a2150), bottom: hex(0x191536), windows: null, signs: null, minH: 150, maxH: 400 })
  const mid = skyline(2, { top: hex(0x1b1638), bottom: hex(0x100d24), windows: hex(0xffd166), windowAlt: hex(0x7dd3fc), signs: [0xf472b6, 0x22d3ee], winDensity: 0.3, minH: 90, maxH: 280 })
  for (const layer of [far, mid]) {
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * BW + x) * 4
        if (layer.d[i + 3] > 0) over(c, x, y, layer.d[i], layer.d[i + 1], layer.d[i + 2], layer.d[i + 3] / 255)
      }
  }
  const png = new PNG({ width: w, height: h })
  for (let i = 0; i < w * h; i++) {
    png.data[i * 4] = clamp(Math.round(c.d[i * 4]), 0, 255)
    png.data[i * 4 + 1] = clamp(Math.round(c.d[i * 4 + 1]), 0, 255)
    png.data[i * 4 + 2] = clamp(Math.round(c.d[i * 4 + 2]), 0, 255)
    png.data[i * 4 + 3] = 255
  }
  writeFileSync(join(previewDir, 'bg-neon-city.png'), PNG.sync.write(png))
}

console.log('HD assets generated in', outDir)
