import { PNG } from 'pngjs'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'assets')

// --- SNES-style limited palette ---
const PALETTE = {
  _: [0, 0, 0, 0],
  K: [19, 23, 34, 255],    // outline (deep navy-black)
  B: [30, 64, 175, 255],   // armor dark blue
  M: [37, 99, 235, 255],   // armor main blue
  L: [96, 165, 250, 255],  // armor light
  C: [34, 211, 238, 255],  // cyan accent (crest, pods)
  F: [252, 217, 184, 255], // face
  E: [31, 41, 55, 255],    // eyes / dark visor
  W: [255, 255, 255, 255],
  Y: [251, 191, 36, 255],  // buster yellow
  y: [217, 119, 6, 255],   // buster shade
  R: [220, 38, 38, 255],   // enemy main red
  O: [248, 113, 113, 255], // enemy light
  D: [127, 29, 29, 255],   // enemy dark
  T: [148, 163, 184, 255], // tile top highlight
  U: [71, 85, 105, 255],   // tile body
  V: [30, 41, 59, 255],    // tile dark
  P: [148, 163, 184, 255], // platform edge
  Q: [51, 65, 85, 255],    // platform body
  J: [253, 224, 71, 255],  // thruster flame
}

// --- tiny canvas over char-grids ---
function makeCanvas(w, h) {
  return { w, h, px: Array.from({ length: h }, () => new Array(w).fill('_')) }
}
function rect(c, x0, y0, x1, y1, ch) {
  for (let y = Math.max(0, y0); y <= Math.min(c.h - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(c.w - 1, x1); x++) c.px[y][x] = ch
}
function px(c, x, y, ch) {
  if (x >= 0 && x < c.w && y >= 0 && y < c.h) c.px[y][x] = ch
}
function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++)
      if (src.px[y][x] !== '_') px(dst, x + ox, y + oy, src.px[y][x])
}
/** Auto-outline: every empty pixel 4-adjacent to a filled one becomes K. */
function outline(c) {
  const marks = []
  for (let y = 0; y < c.h; y++) {
    for (let x = 0; x < c.w; x++) {
      if (c.px[y][x] !== '_') continue
      const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
        const yy = y + dy, xx = x + dx
        return yy >= 0 && yy < c.h && xx >= 0 && xx < c.w && c.px[yy][xx] !== '_'
      })
      if (n) marks.push([x, y])
    }
  }
  for (const [x, y] of marks) c.px[y][x] = 'K'
}

function ellip(c, cx, cy, rx, ry, ch) {
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5)
      if (dx * dx + dy * dy <= 1) px(c, x, y, ch)
    }
}

// --- Player: compositional builder, 16x24, facing right ---
function playerUpper(bobY = 0) {
  const u = makeCanvas(16, 12)
  // helmet dome
  ellip(u, 7, 4 + bobY, 5, 4 + bobY === 0 ? 4 : 4, 'M')
  ellip(u, 7, 4 + bobY, 5, 3, 'M')
  // helmet highlight
  rect(u, 5, 1 + bobY, 8, 1 + bobY, 'L')
  // crest fin
  rect(u, 6, 0 + bobY, 8, 0 + bobY, 'C')
  rect(u, 7, 1 + bobY, 8, 2 + bobY, 'B')
  // ear pods
  rect(u, 2, 4 + bobY, 3, 7 + bobY, 'B'); px(u, 2, 5 + bobY, 'C')
  rect(u, 12, 4 + bobY, 13, 7 + bobY, 'B'); px(u, 13, 5 + bobY, 'C')
  // face window
  rect(u, 4, 5 + bobY, 11, 9 + bobY, 'F')
  // eyes
  rect(u, 5, 6 + bobY, 6, 8 + bobY, 'E'); px(u, 5, 6 + bobY, 'W')
  rect(u, 9, 6 + bobY, 10, 8 + bobY, 'E'); px(u, 9, 6 + bobY, 'W')
  // jaw
  rect(u, 5, 10 + bobY, 10, 11 + bobY, 'B')
  return u
}

function playerTorso() {
  const t = makeCanvas(16, 6)
  rect(t, 4, 0, 11, 4, 'M')            // chest
  rect(t, 6, 1, 9, 3, 'L')             // chest panel
  rect(t, 3, 0, 3, 3, 'B')             // left arm
  px(t, 3, 4, 'E')                     // left fist
  rect(t, 12, 0, 13, 2, 'B')           // right shoulder
  rect(t, 12, 2, 14, 4, 'E')           // buster arm
  rect(t, 12, 2, 15, 4, 'Y')           // buster barrel
  rect(t, 12, 4, 15, 4, 'y')           // barrel shade
  rect(t, 4, 5, 11, 5, 'B')            // belt
  return t
}

const LEGS = {
  idle: () => { const l = makeCanvas(16, 8);
    rect(l, 5, 0, 6, 4, 'B'); rect(l, 9, 0, 10, 4, 'B');
    rect(l, 5, 4, 6, 5, 'L'); rect(l, 9, 4, 10, 5, 'L');
    rect(l, 4, 5, 6, 7, 'B'); rect(l, 9, 5, 11, 7, 'B');
    return l },
  runContactFront: () => { const l = makeCanvas(16, 8);
    rect(l, 8, 0, 9, 4, 'B'); rect(l, 8, 4, 10, 7, 'B'); rect(l, 8, 4, 10, 4, 'L');
    rect(l, 5, 0, 6, 2, 'B'); rect(l, 3, 2, 5, 5, 'B'); rect(l, 3, 2, 5, 2, 'L');
    return l },
  runPass: () => { const l = makeCanvas(16, 8);
    rect(l, 6, 0, 7, 5, 'B'); rect(l, 9, 0, 10, 4, 'B');
    rect(l, 6, 5, 7, 7, 'B'); rect(l, 9, 4, 10, 6, 'B');
    rect(l, 6, 5, 7, 5, 'L');
    return l },
  runContactBack: () => { const l = makeCanvas(16, 8);
    rect(l, 5, 0, 6, 4, 'B'); rect(l, 4, 4, 6, 7, 'B'); rect(l, 4, 4, 6, 4, 'L');
    rect(l, 9, 0, 10, 2, 'B'); rect(l, 10, 2, 12, 5, 'B'); rect(l, 10, 2, 12, 2, 'L');
    return l },
  jump: () => { const l = makeCanvas(16, 8);
    rect(l, 4, 1, 5, 4, 'B'); rect(l, 3, 4, 5, 6, 'B'); rect(l, 3, 4, 5, 4, 'L');
    rect(l, 10, 0, 11, 3, 'B'); rect(l, 10, 3, 12, 5, 'B');
    return l },
  fall: () => { const l = makeCanvas(16, 8);
    rect(l, 3, 0, 4, 4, 'B'); rect(l, 2, 4, 4, 6, 'B'); rect(l, 2, 4, 4, 4, 'L');
    rect(l, 11, 0, 12, 4, 'B'); rect(l, 11, 4, 13, 6, 'B');
    return l },
}

function playerFrame({ legs, bob = false }) {
  const c = makeCanvas(16, 24)
  blit(c, playerUpper(bob ? 1 : 0), 0, 0)
  blit(c, playerTorso(), 0, 11)
  blit(c, LEGS[legs](), 0, 16)
  outline(c)
  return c
}

const FRAME_DEFS = [
  { legs: 'idle', bob: false },   // 0 idle
  { legs: 'idle', bob: true },    // 1 idle bob
  { legs: 'runContactFront' },    // 2 run
  { legs: 'runPass' },            // 3 run
  { legs: 'runContactBack' },     // 4 run
  { legs: 'runPass' },            // 5 run
  { legs: 'jump' },               // 6 jump
  { legs: 'fall' },               // 7 fall
]

const sheetW = 16 * FRAME_DEFS.length
const out = PNG.sync.write(gridToPng(stitch(FRAME_DEFS.map(playerFrame)), sheetW, 24))
writeFileSync(join(outDir, 'player.png'), out)

function stitch(canvases) {
  const h = canvases[0].h
  const rows = Array.from({ length: h }, (_, y) => canvases.map(cv => cv.px[y]).flat())
  return { px: rows, w: canvases.reduce((a, c) => a + c.w, 0), h }
}
function gridToPng(g, w, h) {
  const png = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, gg, b, a] = PALETTE[g.px[y]?.[x] ?? '_'] ?? [255, 0, 255, 255]
      const i = (y * w + x) << 2
      png.data[i] = r; png.data[i + 1] = gg; png.data[i + 2] = b; png.data[i + 3] = a
    }
  return png
}

// --- Enemy hover drone: 2 frames of 18x18 ---
function enemyFrame(bob) {
  const c = makeCanvas(18, 18)
  const oy = bob ? -1 : 0
  ellip(c, 9, 7 + oy, 7, 5, 'R')
  rect(c, 4, 6 + oy, 13, 8 + oy, 'E')          // eye band
  px(c, 6, 7 + oy, 'O'); px(c, 7, 7 + oy, 'O') // pupils
  rect(c, 8, 1 + oy, 9, 2 + oy, 'D')           // antenna
  px(c, 8, 0 + oy, 'W')
  rect(c, 1, 7 + oy, 2, 9 + oy, 'D')           // fins
  rect(c, 15, 7 + oy, 16, 9 + oy, 'D')
  rect(c, 5, 13, 6, 14, 'D')                   // thrusters
  rect(c, 11, 13, 12, 14, 'D')
  if (!bob) { rect(c, 5, 15, 6, 16, 'J'); rect(c, 11, 15, 12, 16, 'J') } // flames
  else { px(c, 5, 15, 'J'); px(c, 12, 15, 'J') }
  outline(c)
  return c
}
const enemySheet = stitch([enemyFrame(false), enemyFrame(true)])
writeFileSync(join(outDir, 'enemy.png'), PNG.sync.write(gridToPng(enemySheet, enemySheet.w, enemySheet.h)))

// --- Bullet 6x4 with bright core ---
const bullet = makeCanvas(6, 4)
rect(bullet, 0, 0, 5, 3, 'Y')
rect(bullet, 1, 1, 4, 2, 'W')
writeFileSync(join(outDir, 'bullet.png'), PNG.sync.write(gridToPng(bullet, 6, 4)))

// --- Tileset 4 tiles of 32x32 ---
function seededRand(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 }
function tileGroundTop() {
  const c = makeCanvas(32, 32); const rnd = seededRand(42)
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    let ch = 'U'
    if (y === 0) ch = 'T'
    else if (y <= 2) ch = rnd() > 0.3 ? 'T' : 'U'
    else ch = rnd() > 0.78 ? 'V' : 'U'
    if ((y === 10 || y === 22) && x > 3 && x < 28 && rnd() > 0.35) ch = 'V'
    px(c, x, y, ch)
  }
  return c
}
function tileGroundBody() {
  const c = makeCanvas(32, 32); const rnd = seededRand(7)
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const darkBias = y / 32 * 0.35
    px(c, x, y, rnd() > 0.72 - darkBias * 0.5 ? 'V' : 'U')
  }
  return c
}
function tilePlatform() {
  const c = makeCanvas(32, 32); const rnd = seededRand(99)
  rect(c, 0, 0, 31, 1, 'P')
  for (let y = 2; y < 29; y++) for (let x = 0; x < 32; x++) px(c, x, y, rnd() > 0.82 ? 'V' : 'Q')
  rect(c, 0, 29, 31, 31, 'V')
  rect(c, 0, 0, 0, 31, 'V'); rect(c, 31, 0, 31, 31, 'V')
  for (const [rx, ry] of [[4, 5], [27, 5], [4, 25], [27, 25]]) px(c, rx, ry, 'T')
  return c
}
const t0 = makeCanvas(32, 32)
const tiles = [t0, tileGroundTop(), tileGroundBody(), tilePlatform()]
const tileRows = Array.from({ length: 32 }, (_, y) => tiles.map(t => t.px[y]).flat())
writeFileSync(join(outDir, 'tileset.png'), PNG.sync.write(gridToPng({ px: tileRows }, 128, 32)))

console.log('SNES-style assets generated in', outDir)
