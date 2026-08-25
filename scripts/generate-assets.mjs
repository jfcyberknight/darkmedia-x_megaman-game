/**
 * SNES-style pixel-art asset generator — authentic 16-bit look.
 * Native resolution: 256x224, 16px tiles, world 800x320.
 * Run: node scripts/generate-assets.mjs
 */
import { PNG } from 'pngjs'
import { writeFileSync, readFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'assets')
const previewDir = join(__dirname, 'preview')
mkdirSync(outDir, { recursive: true })
mkdirSync(previewDir, { recursive: true })

// --------------------------- pixel canvas ---------------------------
function C(w, h) {
  return { w, h, px: Array.from({ length: h }, () => new Array(w).fill(null)) }
}
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255]
const mix = (a, b, t) => [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)]
const clamp01 = (v) => Math.max(0, Math.min(1, v))

function px(c, x, y, col) {
  x = Math.round(x); y = Math.round(y)
  if (x >= 0 && y >= 0 && x < c.w && y < c.h) c.px[y][x] = col
}
function rect(c, x0, y0, x1, y1, col) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(c, x, y, col)
}
function ell(c, cx, cy, rx, ry, col) {
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5)
      if (dx * dx + dy * dy <= 1) px(c, x, y, col)
    }
}
function seg(c, x1, y1, x2, y2, col) {
  const n = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1), 1)
  for (let i = 0; i <= n; i++) px(c, x1 + ((x2 - x1) * i) / n, y1 + ((y2 - y1) * i) / n, col)
}
function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++)
      if (src.px[y][x]) px(dst, x + ox, y + oy, src.px[y][x])
}
/** 1px dark outline around filled pixels. */
function outline(c, col) {
  const marks = []
  for (let y = 0; y < c.h; y++)
    for (let x = 0; x < c.w; x++) {
      if (c.px[y][x]) continue
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const yy = y + dy, xx = x + dx
        return yy >= 0 && yy < c.h && xx >= 0 && xx < c.w && c.px[yy][xx]
      })
      if (n) marks.push([x, y])
    }
  for (const [x, y] of marks) px(c, x, y, col)
}
function stitch(canvases) {
  const w = canvases.reduce((a, c) => a + c.w, 0)
  const h = canvases[0].h
  const out = C(w, h)
  let ox = 0
  for (const c of canvases) {
    blit(out, c, ox, 0)
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

// smooth float helpers (glow, vignette, haze only)
function CF(w, h) { return { w, h, d: new Float32Array(w * h * 4) } }
function fOver(c, x, y, r, g, b, a) {
  x |= 0; y |= 0
  if (x < 0 || y < 0 || x >= c.w || y >= c.h) return
  const i = (y * c.w + x) * 4, d = c.d
  const sa = Math.max(0, Math.min(1, a)), da = d[i + 3] / 255
  const oa = sa + da * (1 - sa)
  if (oa <= 0) return
  d[i] = (r * sa + d[i] * da * (1 - sa)) / oa
  d[i + 1] = (g * sa + d[i + 1] * da * (1 - sa)) / oa
  d[i + 2] = (b * sa + d[i + 2] * da * (1 - sa)) / oa
  d[i + 3] = oa * 255
}
function save(c, file) {
  const png = new PNG({ width: c.w, height: c.h })
  const isFloat = !!c.d
  for (let i = 0; i < c.w * c.h; i++) {
    if (isFloat) {
      for (let k = 0; k < 4; k++) {
        png.data[i * 4 + k] = Math.max(0, Math.min(255, Math.round(c.d[i * 4 + k])))
      }
    } else {
      const col = c.px[Math.floor(i / c.w)][i % c.w]
      png.data[i * 4] = col ? col[0] : 0
      png.data[i * 4 + 1] = col ? col[1] : 0
      png.data[i * 4 + 2] = col ? col[2] : 0
      png.data[i * 4 + 3] = col ? 255 : 0
    }
  }
  writeFileSync(join(outDir, file), PNG.sync.write(png))
}
function savePreview(c, file, scale = 4) {
  const png = new PNG({ width: c.w * scale, height: c.h * scale })
  for (let y = 0; y < png.height; y++)
    for (let x = 0; x < png.width; x++) {
      const sx = Math.floor(x / scale), sy = Math.floor(y / scale)
      const i = (y * png.width + x) * 4
      if (c.d) {
        const s = (sy * c.w + sx) * 4
        png.data[i] = c.d[s]; png.data[i + 1] = c.d[s + 1]; png.data[i + 2] = c.d[s + 2]; png.data[i + 3] = c.d[s + 3]
      } else {
        const col = c.px[sy][sx]
        png.data[i] = col ? col[0] : 0; png.data[i + 1] = col ? col[1] : 0; png.data[i + 2] = col ? col[2] : 0; png.data[i + 3] = col ? 255 : 0
      }
    }
  writeFileSync(join(previewDir, file), PNG.sync.write(png))
}

// --------------------------- palette (héros noir + néon rouge) ---------------------------
const A = {
  hi: hex(0x3b3f4a),      // reflet armure (ardoise)
  top: hex(0x23262e),     // armure noire supérieure
  mid: hex(0x16181e),     // armure noire
  lo: hex(0x0d0e12),      // ombre
  deep: hex(0x07080b),    // profond
  white: hex(0x262932),   // plaque poitrail (ardoise sombre)
  whiteLo: hex(0x14161b), // poitrail ombré
  gem: hex(0xff2436),     // gemme / énergie néon rouge
  gemHi: hex(0xffb0b8),   // gemme reflet (rose clair)
  joint: hex(0x0d0e12),   // articulations noires
  gun: hex(0xff2436),     // canon néon rouge
  gunLo: hex(0x6e0f16),   // canon ombré
  skin: hex(0xf0c9a6), skinLo: hex(0xcfa07c), // visage humain pâle
  eye: hex(0xff2436),     // œil néon rouge
  boot: hex(0x23262e), bootLo: hex(0x0d0e12), // bottes noires
  armorHi: hex(0x3b3f4a), // reflet botte
  outline: hex(0x07080b),
}

// ============================ PLAYER 22x30 x8 ============================
// X-style armored hero in profile: crystal crest, visible eye, white chest.

function drawHead(c, ox, oy) {
  // helmet dome
  ell(c, ox + 10, oy + 8, 6, 5.5, A.mid)
  ell(c, ox + 9, oy + 7, 5, 4.2, A.top)
  rect(c, ox + 6, oy + 4, ox + 9, oy + 5, A.hi)          // top shine
  rect(c, ox + 13, oy + 8, ox + 15, oy + 11, A.lo)       // right shade
  // crystal crest gem
  px(c, ox + 9, oy + 0, A.gemHi); px(c, ox + 10, oy + 0, A.gem)
  rect(c, ox + 8, oy + 1, ox + 11, oy + 2, A.gem)
  px(c, ox + 9, oy + 3, A.gem); px(c, ox + 10, oy + 3, hex(0x2fa8d8))
  px(c, ox + 9, oy + 1, A.gemHi)
  // face (front)
  rect(c, ox + 13, oy + 9, ox + 18, oy + 15, A.skin)
  rect(c, ox + 13, oy + 15, ox + 17, oy + 16, A.skinLo)  // jaw shade
  // big eye
  rect(c, ox + 15, oy + 10, ox + 17, oy + 12, A.white)
  rect(c, ox + 17, oy + 10, ox + 17, oy + 12, A.eye)
  px(c, ox + 15, oy + 10, A.white)
  // helmet brow overhang
  rect(c, ox + 12, oy + 8, ox + 17, oy + 9, A.top)
  px(c, ox + 12, oy + 8, A.hi)
  // ear pod
  ell(c, ox + 6, oy + 9, 1.6, 2, A.lo)
  px(c, ox + 6, oy + 9, A.gem)
  // jaw bottom
  rect(c, ox + 14, oy + 16, ox + 16, oy + 16, A.skinLo)
}
function drawTorso(c, ox, oy) {
  rect(c, ox + 11, oy + 17, ox + 13, oy + 18, A.joint)   // neck
  // torso base
  rect(c, ox + 8, oy + 18, ox + 15, oy + 24, A.mid)
  rect(c, ox + 8, oy + 18, ox + 10, oy + 24, A.top)
  rect(c, ox + 14, oy + 19, ox + 15, oy + 24, A.lo)
  // white chest plate
  rect(c, ox + 12, oy + 19, ox + 17, oy + 23, A.white)
  rect(c, ox + 12, oy + 22, ox + 17, oy + 23, A.whiteLo)
  px(c, ox + 13, oy + 19, A.white)
  // core gem
  rect(c, ox + 15, oy + 20, ox + 16, oy + 21, A.gem)
  px(c, ox + 15, oy + 20, A.gemHi)
  // back pack
  rect(c, ox + 5, oy + 19, ox + 7, oy + 24, A.lo)
  rect(c, ox + 5, oy + 19, ox + 6, oy + 20, A.mid)
  // belt
  rect(c, ox + 8, oy + 25, ox + 15, oy + 25, A.joint)
  px(c, ox + 11, oy + 25, A.gem)
}
function drawBackArm(c, ox, oy) {
  rect(c, ox + 6, oy + 19, ox + 7, oy + 23, A.lo)
  rect(c, ox + 6, oy + 24, ox + 7, oy + 25, A.joint)
}
function drawBuster(c, ox, oy) {
  // shoulder
  ell(c, ox + 15, oy + 20, 2.5, 2.2, A.top)
  px(c, ox + 14, oy + 19, A.hi)
  // cannon
  rect(c, ox + 16, oy + 21, ox + 20, oy + 24, A.gun)
  rect(c, ox + 16, oy + 24, ox + 20, oy + 24, A.gunLo)
  rect(c, ox + 19, oy + 21, ox + 20, oy + 24, A.gunLo)
  px(c, ox + 21, oy + 22, A.gem)
  px(c, ox + 21, oy + 23, A.gem)
}
function drawBoot(c, ox, oy, x, y, dark) {
  rect(c, ox + x, oy + y, ox + x + 4, oy + y + 2, dark ? A.bootLo : A.boot)
  rect(c, ox + x, oy + y + 3, ox + x + 5, oy + y + 3, dark ? hex(0x101a44) : A.bootLo)
  px(c, ox + x + 5, oy + y + 1, dark ? A.bootLo : A.armorHi)
}
function legsIdle(c, ox, oy) {
  // thighs
  rect(c, ox + 9, oy + 26, ox + 10, oy + 27, A.lo)
  rect(c, ox + 12, oy + 26, ox + 13, oy + 27, A.mid)
  drawBoot(c, ox, oy, 8, 27, true)
  drawBoot(c, ox, oy, 12, 27, false)
}
function legsRun(c, ox, oy, phase) {
  const poses = [
    [[13, 27, 17, 28], [7, 27, 4, 26]],
    [[11, 27, 12, 28], [9, 27, 7, 26]],
    [[7, 27, 4, 26], [13, 27, 17, 27]],
    [[10, 27, 9, 28], [12, 27, 14, 26]],
  ]
  const [front, back] = poses[phase]
  const leg = ([x1, y1, x2, y2], dark) => {
    seg(c, ox + x1, oy + 25, ox + x1 + Math.sign(x2 - x1) * 1, oy + y1, dark ? A.lo : A.mid)
    seg(c, ox + x1 + Math.sign(x2 - x1) * 1, oy + y1, ox + x2, oy + y2, dark ? A.bootLo : A.lo)
    drawBoot(c, ox, oy, x2 - 1, y2, dark)
  }
  leg(back, true)
  leg(front, false)
}
function legsJump(c, ox, oy) {
  seg(c, ox + 10, oy + 25, ox + 7, oy + 26, A.lo)
  drawBoot(c, ox, oy, 5, 26, true)
  seg(c, ox + 12, oy + 25, ox + 15, oy + 26, A.mid)
  drawBoot(c, ox, oy, 14, 26, false)
}
function legsFall(c, ox, oy) {
  seg(c, ox + 10, oy + 25, ox + 7, oy + 27, A.lo)
  drawBoot(c, ox, oy, 5, 27, true)
  seg(c, ox + 12, oy + 25, ox + 16, oy + 27, A.mid)
  drawBoot(c, ox, oy, 15, 27, false)
}
function playerFrame(bob, legsFn) {
  const c = C(22, 30)
  const oy = bob ? 1 : 0
  legsFn(c, 0, 0)
  drawBackArm(c, 0, oy)
  drawTorso(c, 0, oy)
  drawHead(c, 0, oy)
  drawBuster(c, 0, oy)
  outline(c, A.outline)
  return c
}
const playerFrames = [
  playerFrame(false, legsIdle),
  playerFrame(true, legsIdle),
  playerFrame(false, (c, x, y) => legsRun(c, x, y, 0)),
  playerFrame(true, (c, x, y) => legsRun(c, x, y, 1)),
  playerFrame(false, (c, x, y) => legsRun(c, x, y, 2)),
  playerFrame(true, (c, x, y) => legsRun(c, x, y, 3)),
  playerFrame(false, legsJump),
  playerFrame(false, legsFall),
]
const playerSheet = stitch(playerFrames)
save(playerSheet, 'player.png')
savePreview(playerSheet, 'player.png', 5)

// ============================ ENEMY 22x22 x2 ============================
const E = {
  hi: hex(0xffe9a8), top: hex(0xffd34d), mid: hex(0xe0a825), lo: hex(0xb87808),
  dark: hex(0x5e3c04), eyeW: hex(0xffffff), eyeB: hex(0x1c2c50),
  outline: hex(0x3a2604),
}
function enemyFrame(step) {
  const c = C(22, 22)
  const bob = step === 1 ? -1 : 0
  // golden dome
  ell(c, 11, 10 + bob, 8, 6.5, E.mid)
  ell(c, 11, 9 + bob, 7, 5.5, E.top)
  ell(c, 8, 7 + bob, 3, 2, E.hi)
  px(c, 6, 6 + bob, E.hi)
  // rivets
  px(c, 7, 11 + bob, E.lo); px(c, 15, 11 + bob, E.lo); px(c, 11, 5 + bob, E.lo)
  // visor + eyes
  rect(c, 5, 13 + bob, 17, 15 + bob, hex(0x241505))
  rect(c, 7, 13 + bob, 9, 14 + bob, E.eyeW)
  rect(c, 13, 13 + bob, 15, 14 + bob, E.eyeW)
  px(c, 8, 13 + bob, E.eyeB); px(c, 14, 13 + bob, E.eyeB)
  // antenna
  px(c, 11, 1 + bob, E.dark); px(c, 11, 2 + bob, E.dark)
  px(c, 11, 0 + bob, hex(0xfff3c4))
  // underside
  rect(c, 7, 16 + bob, 15, 17 + bob, hex(0x4a3008))
  // legs
  if (step === 0) {
    seg(c, 7, 17, 5, 20, E.dark); seg(c, 15, 17, 17, 19, E.dark)
    px(c, 5, 20, hex(0x2a1a02)); px(c, 17, 19, hex(0x2a1a02))
  } else {
    seg(c, 8, 17, 6, 20, E.dark); seg(c, 14, 17, 16, 20, E.dark)
    px(c, 6, 20, hex(0x2a1a02)); px(c, 16, 20, hex(0x2a1a02))
  }
  outline(c, E.outline)
  return c
}
const enemySheet = stitch([enemyFrame(0), enemyFrame(1)])
save(enemySheet, 'enemy.png')
savePreview(enemySheet, 'enemy.png', 6)

// ============================ BOSS 44x44 x2 ============================
const B = {
  hi: hex(0xa9c2e8), top: hex(0x6f86b8), mid: hex(0x46557a), lo: hex(0x27304a), deep: hex(0x161c2c),
  eye: hex(0xff4d4d), eyeHi: hex(0xffe1d0), amber: hex(0xffc857), orange: hex(0xff9a3c),
  outline: hex(0x0c101c),
}
function bossFrame(pulse) {
  const c = C(44, 44)
  // treads
  rect(c, 10, 38, 19, 42, B.deep)
  rect(c, 25, 38, 34, 42, B.deep)
  rect(c, 12, 37, 17, 38, B.mid)
  rect(c, 27, 37, 32, 38, B.mid)
  // torso
  rect(c, 12, 28, 32, 38, B.mid)
  rect(c, 12, 28, 16, 38, B.top)
  rect(c, 28, 30, 32, 38, B.lo)
  // reactor core
  const r = pulse ? 4 : 3
  ell(c, 22, 33, r, r, hex(0xfff6d8))
  // hull dome
  ell(c, 22, 19, 16, 12, B.mid)
  ell(c, 22, 18, 15, 11, B.top)
  ell(c, 15, 13, 6, 4, B.hi)
  // orange accent stripes
  seg(c, 10, 27, 17, 24, B.orange)
  seg(c, 34, 24, 27, 27, B.orange)
  // top plate + lights
  rect(c, 15, 5, 29, 9, B.lo)
  rect(c, 16, 4, 28, 5, B.mid)
  for (const lx of [18, 22, 26]) px(c, lx, 6, B.amber)
  // eye visor
  rect(c, 10, 18, 34, 23, hex(0x12060a))
  rect(c, 13, 20, 31, 21, pulse ? B.eye : hex(0xff6b5e))
  rect(c, 17, 20, 25, 20, B.eyeHi)
  // shoulder pods
  ell(c, 6, 19, 4, 5, B.mid)
  ell(c, 6, 19, 2.5, 3, B.lo)
  px(c, 6, 19, hex(0xff6b5e))
  ell(c, 38, 19, 4, 5, B.mid)
  ell(c, 38, 19, 2.5, 3, B.lo)
  px(c, 38, 19, hex(0xff6b5e))
  seg(c, 5, 15, 2, 10, B.lo)
  seg(c, 39, 15, 42, 10, B.lo)
  outline(c, B.outline)
  return c
}
const bossSheet = stitch([bossFrame(false), bossFrame(true)])
save(bossSheet, 'boss.png')
savePreview(bossSheet, 'boss.png', 6)

// ============================ FLYER 20x14 x2 ============================
function flyerFrame(phase) {
  const c = C(20, 14)
  // rotor
  rect(c, 4 + phase, 1, 16 - phase, 1, hex(0x9fb4d8))
  px(c, 10, 2, B.lo)
  // body
  ell(c, 10, 7, 7, 3.5, B.mid)
  ell(c, 10, 6, 6, 2.6, B.top)
  px(c, 7, 5, B.hi)
  // eye
  px(c, 15, 6, A.gem); px(c, 15, 7, A.gem)
  // fins
  px(c, 3, 7, B.lo); px(c, 2, 8, B.lo)
  px(c, 3, 9, B.lo); px(c, 2, 10, B.lo)
  outline(c, B.outline)
  return c
}
save(stitch([flyerFrame(0), flyerFrame(1)]), 'flyer.png')

// ============================ TURRET 18x20 ============================
{
  const c = C(18, 20)
  rect(c, 3, 16, 15, 19, B.lo)
  rect(c, 4, 15, 14, 16, B.mid)
  ell(c, 9, 11, 6, 5, B.top)
  ell(c, 8, 10, 3, 2, B.hi)
  rect(c, 12, 10, 16, 12, B.lo)
  px(c, 16, 11, hex(0xff6b5e))
  px(c, 9, 8, B.amber)
  outline(c, B.outline)
  save(c, 'turret.png')
}

// ============================ CHECKPOINT 10x28 ============================
{
  const c = C(10, 28)
  rect(c, 2, 25, 8, 27, B.lo)
  rect(c, 4, 8, 6, 25, B.mid)
  px(c, 4, 9, B.hi)
  // diamond
  const dcx = 5, dcy = 4
  for (let d = 0; d <= 3; d++) {
    for (let x = dcx - (3 - d); x <= dcx + (3 - d); x++) {
      px(c, x, dcy - 3 + d, A.gem)
      px(c, x, dcy + 3 - d, A.gem)
    }
  }
  px(c, dcx, dcy - 3, A.gemHi); px(c, dcx - 1, dcy - 2, A.gemHi)
  save(c, 'checkpoint.png')
}

// ============================ COMPAGNONS 14x16 ============================
const O = {
  hi: hex(0xc8f6ff), top: hex(0x4de3ff), mid: hex(0x1e9cc8), lo: hex(0x0e5f86),
  eye: hex(0x083a52), dark: hex(0x18203a), flame: hex(0xffd166),
}
function orionSprite() {
  const c = C(14, 16)
  px(c, 7, 0, A.gem); px(c, 7, 1, O.lo)                    // antenne
  ell(c, 7, 6, 4.5, 4, O.mid)                               // dôme
  ell(c, 7, 5, 3.5, 3, O.top)
  px(c, 5, 4, O.hi); px(c, 6, 3, O.hi)
  rect(c, 5, 6, 9, 8, O.eye)                                // visière
  rect(c, 6, 7, 8, 7, A.gem)                                // œil cyan
  px(c, 7, 7, A.gemHi)
  rect(c, 5, 10, 9, 13, O.mid)                              // corps
  rect(c, 6, 11, 8, 11, O.top)
  rect(c, 5, 14, 9, 14, O.lo)                               // jupe
  px(c, 6, 15, O.flame); px(c, 8, 15, O.flame)              // propulseurs
  outline(c, [10, 16, 30])
  return c
}
save(orionSprite(), 'comp-orion.png')
savePreview(orionSprite(), 'comp-orion.png', 8)

const BL = {
  hi: hex(0xffe9a8), top: hex(0xffc857), mid: hex(0xd99a1e), lo: hex(0x8a5a06),
  visor: hex(0x1c1428), glow: hex(0xfff3c4), dark: hex(0x3a2a08), outline: hex(0x2a1a02),
}
function boltSprite() {
  const c = C(14, 16)
  rect(c, 3, 1, 10, 7, BL.mid)                              // tête carrée
  rect(c, 3, 1, 10, 2, BL.top)
  px(c, 4, 2, BL.hi)
  rect(c, 4, 4, 9, 6, BL.visor)                             // visière
  rect(c, 5, 5, 8, 5, hex(0xffd166))                        // lueur
  px(c, 3, 3, BL.hi); px(c, 10, 3, BL.lo)
  rect(c, 4, 8, 10, 13, BL.mid)                             // corps
  rect(c, 5, 9, 9, 12, BL.top)
  rect(c, 6, 10, 8, 10, BL.lo)                              // trappe
  rect(c, 2, 9, 3, 12, BL.lo)                               // bras
  rect(c, 11, 9, 12, 12, BL.lo)
  rect(c, 5, 14, 6, 15, BL.dark)                            // jambes
  rect(c, 8, 14, 9, 15, BL.dark)
  px(c, 5, 15, hex(0x1c1428)); px(c, 9, 15, hex(0x1c1428))
  outline(c, BL.outline)
  return c
}
save(boltSprite(), 'comp-bolt.png')
savePreview(boltSprite(), 'comp-bolt.png', 8)

const NV = {
  hi: hex(0xffd0ea), top: hex(0xf472b6), mid: hex(0xc2418f), lo: hex(0x7a1f5c),
  eyeW: hex(0xffffff), eyeB: hex(0x2a0a20), flame: hex(0x9df2ff), outline: hex(0x2a0a20),
}
function novaSprite() {
  const c = C(14, 16)
  ell(c, 7, 7, 5.5, 5.5, NV.mid)                            // orbe
  ell(c, 7, 6.5, 5, 5, NV.top)
  ell(c, 5, 5, 2, 1.6, NV.hi)
  // nageoires
  seg(c, 2, 6, 0, 4, NV.lo); seg(c, 2, 8, 0, 10, NV.lo)
  seg(c, 12, 6, 14, 4, NV.lo); seg(c, 12, 8, 14, 10, NV.lo)
  // grand œil
  ell(c, 7, 7, 2.8, 2.8, NV.eyeW)
  ell(c, 8, 7.5, 1.4, 1.6, NV.eyeB)
  px(c, 7, 6, NV.eyeW)
  // propulseur
  px(c, 6, 13, NV.flame); px(c, 7, 14, NV.flame); px(c, 8, 13, NV.flame)
  outline(c, NV.outline)
  return c
}
save(novaSprite(), 'comp-nova.png')
savePreview(novaSprite(), 'comp-nova.png', 8)

// ============================ BULLETS / ORB ============================
{
  const c = C(8, 5)
  rect(c, 1, 1, 7, 3, hex(0x35e0ff))
  rect(c, 2, 1, 6, 3, hex(0x9df2ff))
  rect(c, 3, 2, 5, 2, hex(0xffffff))
  save(c, 'bullet.png')
  const m = C(10, 7)
  ell(m, 5, 3.5, 4.5, 2.8, hex(0x35e0ff))
  ell(m, 5, 3.5, 3, 1.8, hex(0x9df2ff))
  rect(m, 4, 3, 6, 4, hex(0xffffff))
  save(m, 'bullet-mid.png')
  const g = C(14, 10)
  ell(g, 7, 5, 6.5, 4.5, hex(0x35e0ff))
  ell(g, 7, 5, 5, 3.4, hex(0x9df2ff))
  ell(g, 7, 5, 3, 2, hex(0xeafcff))
  rect(g, 6, 4, 8, 6, hex(0xffffff))
  save(g, 'bullet-big.png')
  const o = C(8, 8)
  ell(o, 4, 4, 3.4, 3.4, hex(0xbffcff))
  ell(o, 4, 4, 1.8, 1.8, hex(0xffffff))
  save(o, 'orb.png')
}

// ============================ GLOW 16x16 (additive) ============================
{
  const c = CF(16, 16)
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const dx = x + 0.5 - 8, dy = y + 0.5 - 8
      const d = Math.sqrt(dx * dx + dy * dy) / 8
      if (d < 1) fOver(c, x, y, 255, 255, 255, (1 - d) * (1 - d))
    }
  save(c, 'glow.png')
}

// ============================ VIGNETTE 256x224 ============================
{
  const w = 256, h = 224
  const c = CF(w, h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const dx = (x - w / 2) / (w / 2), dy = (y - h / 2) / (h / 2)
      const r = Math.sqrt(dx * dx + dy * dy) / Math.SQRT2
      const a = clamp01((r - 0.6) / 0.4)
      fOver(c, x, y, 4, 5, 12, a * a * 0.6)
    }
  save(c, 'vignette.png')
}

// ============================ HAZE 256x64 ============================
{
  const c = CF(256, 64)
  for (let y = 0; y < 64; y++)
    for (let x = 0; x < 256; x++)
      fOver(c, x, y, 255, 255, 255, clamp01(1 - y / 64) * 0.5)
  save(c, 'haze.png')
}

// ============================ TILESET 4x16px ============================
{
  const T = 16
  const rnd = mulberry32(42)
  const t0 = C(T, T)
  // t1 ground top
  const t1 = C(T, T)
  rect(t1, 0, 0, 15, 0, hex(0xd7e2f2))
  rect(t1, 0, 1, 15, 2, hex(0x9db1d4))
  rect(t1, 0, 3, 15, 9, hex(0x6b7fa3))
  rect(t1, 0, 10, 15, 15, hex(0x42536f))
  rect(t1, 0, 5, 15, 5, hex(0x54688a))
  rect(t1, 0, 10, 15, 10, hex(0x36455e))
  // bolts
  px(t1, 3, 7, hex(0x2c3850)); px(t1, 12, 7, hex(0x2c3850))
  px(t1, 2, 6, hex(0xc3d2ea)); px(t1, 11, 6, hex(0xc3d2ea))
  // t2 ground body
  const t2 = C(T, T)
  rect(t2, 0, 0, 15, 7, hex(0x54688a))
  rect(t2, 0, 8, 15, 15, hex(0x3a4a66))
  rect(t2, 0, 7, 15, 7, hex(0x2c3850))
  rect(t2, 0, 15, 15, 15, hex(0x232d42))
  px(t2, 4, 3, hex(0x6b7fa3)); px(t2, 11, 11, hex(0x4a5a7a))
  px(t2, 8, 5, hex(0x2c3850)); px(t2, 3, 12, hex(0x2c3850))
  // t3 platform slab
  const t3 = C(T, T)
  rect(t3, 0, 0, 15, 0, hex(0xeef4fc))
  rect(t3, 0, 1, 15, 8, hex(0x8fa3c4))
  rect(t3, 0, 9, 15, 12, hex(0x42536f))
  rect(t3, 0, 13, 15, 14, hex(0x10141f))
  rect(t3, 0, 12, 15, 12, hex(0x35e0ff))
  px(t3, 3, 4, hex(0x2c3850)); px(t3, 12, 4, hex(0x2c3850))
  px(t3, 2, 3, hex(0xc3d2ea)); px(t3, 13, 3, hex(0xc3d2ea))
  const sheet = stitch([t0, t1, t2, t3])
  save(sheet, 'tileset.png')
  savePreview(sheet, 'tileset.png', 6)
}

// ============================ STAGE BACKGROUNDS 512x224 (pixel skylines) ============================
const STAGE_ART = {
  'neon-city': { far: [0x2a2150, 0x191536], mid: [0x1b1638, 0x100d24], window: 0xffd166, windowAlt: 0x7dd3fc, sign: [0xf472b6, 0x22d3ee] },
  'toxic-plant': { far: [0x14301f, 0x0a1a10], mid: [0x0e2416, 0x071409], window: 0xa3e635, windowAlt: 0x4ade80, sign: [0x4ade80, 0xa3e635] },
  'scorched-desert': { far: [0x3a1f0e, 0x1f1006], mid: [0x291508, 0x170b04], window: 0xfbbf24, windowAlt: 0xf59e0b, sign: [0xfb923c, 0xfbbf24] },
  'frost-lab': { far: [0x16325c, 0x0b1a30], mid: [0x102640, 0x081426], window: 0xbae6fd, windowAlt: 0x60a5fa, sign: [0x60a5fa, 0xbae6fd] },
  'sky-fortress': { far: [0x401a33, 0x200a18], mid: [0x2a1122, 0x170812], window: 0xf9a8d4, windowAlt: 0xf472b6, sign: [0xf472b6, 0xf9a8d4] },
}
const BW = 512, BH = 224

function skyline(seed, { top, bottom, windows, windowAlt, signs, winDensity, minH, maxH }) {
  const c = C(BW, BH)
  const rnd = mulberry32(seed)
  const topC = hex(top), botC = hex(bottom)
  const drawBuilding = (bx, bw, bh, shade) => {
    for (const ox of [0, -BW]) {
      const x0 = Math.round(bx + ox)
      const body = mix(topC, botC, 0.35 + shade * 0.4)
      rect(c, x0, BH - bh, x0 + bw - 1, BH - 1, body)
      rect(c, x0, BH - bh, x0 + bw - 1, BH - bh, mix(body, hex(0xffffff), 0.18))
      rect(c, x0 + bw - 1, BH - bh, x0 + bw - 1, BH - 1, mix(body, hex(0x000000), 0.25))
      if (windows) {
        for (let wy = BH - bh + 4; wy < BH - 5; wy += 6) {
          for (let wx = x0 + 2; wx < x0 + bw - 3; wx += 4) {
            if (rnd() > winDensity) continue
            const col = rnd() > 0.72 ? hex(windowAlt) : hex(windows)
            const bright = 0.35 + rnd() * 0.65
            rect(c, wx, wy, wx + 1, wy + 1, mix(col, hex(0x000000), 1 - bright))
          }
        }
      }
      if (rnd() > 0.6) {
        const ax = Math.round(x0 + bw * (0.25 + rnd() * 0.5))
        const ah = 4 + Math.floor(rnd() * 10)
        rect(c, ax, BH - bh - ah, ax, BH - bh - 1, mix(topC, hex(0xffffff), 0.2))
        px(c, ax, BH - bh - ah - 1, hex(signs ? signs[0] : 0xff5566))
      }
      if (signs && rnd() > 0.68) {
        const [sr, sg, sb] = hex(signs[Math.floor(rnd() * signs.length)])
        const sx = Math.round(x0 + 3 + rnd() * (bw - 8))
        const sy = Math.round(BH - bh + 4 + rnd() * bh * 0.4)
        const sh = 5 + Math.floor(rnd() * 10)
        for (let yy = sy; yy < sy + sh; yy++) px(c, sx, yy, [sr, sg, sb])
      }
    }
  }
  let x = -6
  while (x < BW + 20) {
    const bw = 24 + Math.floor(rnd() * 46)
    const bh = minH + Math.floor(rnd() * (maxH - minH))
    drawBuilding(x, bw, bh, rnd())
    x += bw + 2 + Math.floor(rnd() * 8)
  }
  return c
}

for (const [id, art] of Object.entries(STAGE_ART)) {
  save(skyline(id.length * 1337 + 11, {
    top: art.far[0], bottom: art.far[1], windows: null, signs: null, minH: 60, maxH: 165,
  }), `bg-far-${id}.png`)
  save(skyline(id.length * 7331 + 97, {
    top: art.mid[0], bottom: art.mid[1], windows: art.window, windowAlt: art.windowAlt,
    signs: art.sign, winDensity: 0.3, minH: 40, maxH: 120,
  }), `bg-mid-${id}.png`)
}

// ============================ LEVEL JSON PATCH (16px tiles) ============================
// Patch appliqué à CHAQUE level-<id>.json (le jeu charge un niveau par stage).
{
  const levelFiles = readdirSync(outDir).filter((f) => /^level-.*\.json$/.test(f))
  for (const name of levelFiles) {
    const levelPath = join(outDir, name)
    const level = JSON.parse(readFileSync(levelPath, 'utf8'))
    level.tilewidth = 16
    level.tileheight = 16
    for (const ts of level.tilesets) {
      ts.tilewidth = 16
      ts.tileheight = 16
      ts.imagewidth = 64
      ts.imageheight = 16
    }
    // Keep the ground fill down to the last row (row 19) — but ONLY under
    // columns that already have ground in row 18, so generated pits stay open
    // (otherwise the player would land in the pit bottom instead of falling).
    const ground = level.layers.find((l) => l.name === 'ground')
    const W = level.width
    for (let x = 0; x < W; x++) {
      if (ground.data[18 * W + x] !== 0) ground.data[19 * W + x] = 3
    }
    writeFileSync(levelPath, JSON.stringify(level))
  }
}

console.log('SNES-style pixel assets generated in', outDir)
