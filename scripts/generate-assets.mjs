import { PNG } from 'pngjs'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'assets')

// --- Palette SNES (palette restreinte, lumière haut-gauche) ---
const PALETTE = {
  _: [0, 0, 0, 0],
  K: [19, 23, 34, 255],
  B: [30, 64, 175, 255],
  M: [37, 99, 235, 255],
  L: [96, 165, 250, 255],
  C: [34, 211, 238, 255],
  F: [252, 217, 184, 255],
  f: [214, 168, 138, 255],
  E: [31, 41, 55, 255],
  W: [255, 255, 255, 255],
  Y: [251, 191, 36, 255],
  y: [180, 120, 20, 255],
  R: [220, 38, 38, 255],
  O: [248, 140, 120, 255],
  D: [110, 26, 26, 255],
  J: [253, 224, 71, 255],
}

function makeCanvas(w, h) {
  return { w, h, px: Array.from({ length: h }, () => new Array(w).fill('_')) }
}
function px(c, x, y, ch) { if (x >= 0 && x < c.w && y >= 0 && y < c.h) c.px[y][x] = ch }
function rect(c, x0, y0, x1, y1, ch) {
  for (let y = Math.max(0, y0); y <= Math.min(c.h - 1, y1); y++)
    for (let x = Math.max(0, x0); x <= Math.min(c.w - 1, x1); x++) c.px[y][x] = ch
}
function ellip(c, cx, cy, rx, ry, ch) {
  for (let y = cy - ry; y <= cy + ry; y++)
    for (let x = cx - rx; x <= cx + rx; x++) {
      const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5)
      if (dx * dx + dy * dy <= 1) px(c, x, y, ch)
    }
}
function blit(dst, src, ox, oy) {
  for (let y = 0; y < src.h; y++)
    for (let x = 0; x < src.w; x++)
      if (src.px[y][x] !== '_') px(dst, x + ox, y + oy, src.px[y][x])
}
function outline(c) {
  const marks = []
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    if (c.px[y][x] !== '_') continue
    const touch = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
      const yy = y + dy, xx = x + dx
      return yy >= 0 && yy < c.h && xx >= 0 && xx < c.w && c.px[yy][xx] !== '_'
    })
    if (touch) marks.push([x, y])
  }
  for (const [x, y] of marks) c.px[y][x] = 'K'
}

// ================= PLAYER (16x24, regarde à droite) =================
// Tête + casque (y0..y9)
function head() {
  const c = makeCanvas(16, 10)
  // dôme du casque avec ombrage (L haut-gauche, M coeur, B ombre droite)
  rect(c, 5, 1, 10, 1, 'L')
  rect(c, 4, 2, 8, 2, 'L'); rect(c, 9, 2, 11, 2, 'M')
  rect(c, 3, 3, 7, 4, 'M'); rect(c, 8, 3, 12, 4, 'B')
  rect(c, 3, 4, 7, 4, 'M')
  rect(c, 4, 5, 11, 5, 'B')            // visière ombre sous casque
  // crête cyan centrale
  rect(c, 7, 0, 8, 0, 'C')
  rect(c, 7, 1, 8, 2, 'C')
  px(c, 7, 3, 'C'); px(c, 8, 3, 'C')
  // écouteurs latéraux
  rect(c, 1, 4, 2, 6, 'B'); px(c, 1, 5, 'C')
  rect(c, 13, 4, 14, 6, 'B'); px(c, 14, 5, 'C')
  // visage
  rect(c, 4, 6, 11, 8, 'F')
  rect(c, 4, 6, 11, 6, 'f')            // ombre du front
  // yeux vers la droite + reflets
  rect(c, 5, 6, 6, 8, 'E'); px(c, 5, 6, 'W')
  rect(c, 9, 6, 10, 8, 'E'); px(c, 9, 6, 'W')
  // mâchoire
  rect(c, 5, 9, 10, 9, 'F'); px(c, 5, 9, 'f'); px(c, 10, 9, 'f')
  return c
}

// Buste + bras buster (y10..y16)
function torso() {
  const c = makeCanvas(16, 7)
  rect(c, 6, 0, 9, 0, 'B')             // cou
  rect(c, 4, 1, 11, 4, 'M')            // torse
  rect(c, 4, 1, 5, 4, 'L')             // lumière côté gauche
  rect(c, 11, 1, 11, 4, 'B')           // ombre côté droit
  rect(c, 6, 2, 9, 3, 'L')             // plaque pectorale
  px(c, 6, 2, 'W')                     // reflet
  rect(c, 2, 1, 3, 4, 'B')             // bras arrière
  rect(c, 2, 5, 3, 6, 'E')             // poing arrière
  rect(c, 12, 1, 13, 2, 'B')           // épaule buster
  rect(c, 11, 3, 13, 5, 'E')           // avant-bras
  rect(c, 13, 3, 15, 5, 'Y')           // canon
  rect(c, 13, 5, 15, 5, 'y')           // ombre canon
  px(c, 15, 4, 'W')                    // bout du canon
  rect(c, 4, 6, 11, 6, 'B')            // ceinture
  px(c, 7, 6, 'Y'); px(c, 8, 6, 'Y')   // boucle
  return c
}

// Jambes (y17..y23), une variante par pose
function legsIdle() {
  const c = makeCanvas(16, 7)
  rect(c, 5, 0, 6, 2, 'B'); rect(c, 9, 0, 10, 2, 'B')     // cuisses
  rect(c, 5, 3, 6, 3, 'L'); rect(c, 9, 3, 10, 3, 'L')     // revers de botte
  rect(c, 4, 4, 6, 6, 'B'); rect(c, 9, 4, 11, 6, 'B')     // bottes (pointe avant)
  return c
}
function legsRunFront() {
  const c = makeCanvas(16, 7)
  rect(c, 8, 0, 9, 1, 'B')             // cuisse avant tendue
  rect(c, 9, 2, 10, 3, 'B')            // tibia
  rect(c, 9, 4, 11, 6, 'B'); rect(c, 9, 4, 11, 4, 'L')    // botte avant plantée
  rect(c, 5, 0, 6, 1, 'B')             // cuisse arrière
  rect(c, 3, 2, 4, 3, 'B')             // tibia replié
  rect(c, 2, 4, 4, 5, 'B'); rect(c, 2, 4, 4, 4, 'L')      // botte arrière levée
  return c
}
function legsRunPass() {
  const c = makeCanvas(16, 7)
  rect(c, 6, 0, 7, 3, 'B')
  rect(c, 5, 4, 7, 6, 'B'); rect(c, 5, 4, 7, 4, 'L')
  rect(c, 9, 0, 10, 2, 'B')
  rect(c, 10, 3, 12, 4, 'B'); rect(c, 10, 3, 12, 3, 'L')
  return c
}
function legsRunBack() {
  const c = makeCanvas(16, 7)
  rect(c, 5, 0, 6, 1, 'B')
  rect(c, 4, 2, 5, 3, 'B')
  rect(c, 3, 4, 5, 6, 'B'); rect(c, 3, 4, 5, 4, 'L')
  rect(c, 9, 0, 10, 1, 'B')
  rect(c, 11, 2, 12, 3, 'B')
  rect(c, 11, 4, 13, 5, 'B'); rect(c, 11, 4, 13, 4, 'L')
  return c
}
function legsJump() {
  const c = makeCanvas(16, 7)
  rect(c, 5, 0, 6, 1, 'B'); rect(c, 9, 0, 10, 1, 'B')
  rect(c, 3, 2, 4, 3, 'B'); rect(c, 11, 2, 12, 3, 'B')    // genoux rentrés
  rect(c, 2, 4, 4, 5, 'B'); rect(c, 11, 4, 13, 5, 'B')    // bottes repliées
  return c
}
function legsFall() {
  const c = makeCanvas(16, 7)
  rect(c, 4, 0, 5, 3, 'B')
  rect(c, 2, 4, 4, 6, 'B'); rect(c, 2, 4, 4, 4, 'L')
  rect(c, 11, 0, 12, 3, 'B')
  rect(c, 11, 4, 13, 6, 'B'); rect(c, 11, 4, 13, 4, 'L')
  return c
}

function playerFrame(headBob, legsFn) {
  const c = makeCanvas(16, 24)
  const h = head()
  if (headBob) blit(c, h, 0, 1); else blit(c, h, 0, 0)
  blit(c, torso(), 0, headBob ? 11 : 10)
  blit(c, legsFn(), 0, 17)
  outline(c)
  return c
}

const FRAME_DEFS = [
  { bob: false, legs: legsIdle },      // 0 idle
  { bob: true, legs: legsIdle },       // 1 idle respiration
  { bob: false, legs: legsRunFront },  // 2 course contact
  { bob: false, legs: legsRunPass },   // 3 passage
  { bob: false, legs: legsRunBack },   // 4 contact opposé
  { bob: true, legs: legsRunPass },    // 5 passage (léger rebond)
  { bob: false, legs: legsJump },      // 6 saut
  { bob: false, legs: legsFall },      // 7 chute
]

// --- assemblage feuille 128x24 ---
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

const playerFrames = FRAME_DEFS.map(d => playerFrame(d.bob, d.legs))
const playerSheet = stitch(playerFrames)
writeFileSync(join(outDir, 'player.png'), PNG.sync.write(gridToPng(playerSheet, playerSheet.w, playerSheet.h)))

// --- aperçu ASCII pour vérification humaine ---
function ascii(cv) {
  return cv.px.map(row => row.join('')).join('\n')
}
console.log('--- PLAYER frame0 (idle) ---')
console.log(ascii(playerFrames[0]))
console.log('--- PLAYER frame2 (run contact) ---')
console.log(ascii(playerFrames[2]))
console.log('--- PLAYER frame6 (jump) ---')
console.log(ascii(playerFrames[6]))

// --- ENEMY : robot-carapace 2 frames de 18x18 ---
function enemyFrame(step) {
  const c = makeCanvas(18, 18)
  const bob = step === 1 ? -1 : 0
  // dôme carapace
  for (let y = 3 + bob; y <= 12 + bob; y++) {
    const t = (y - (3 + bob)) / (9 + bob - (3 + bob))
    const half = Math.round(Math.sin(Math.min(1, Math.max(0, t)) * Math.PI) * 6.5)
    rect(c, 9 - half, y, 9 + half, y, 'R')
  }
  rect(c, 4, 4 + bob, 8, 5 + bob, 'O')       // reflet coque
  rect(c, 3, 11 + bob, 14, 12 + bob, 'D')    // bourrelet inférieur
  // fente faciale
  rect(c, 4, 8 + bob, 13, 10 + bob, 'E')
  rect(c, 6, 9 + bob, 7, 9 + bob, 'O')       // pupilles
  rect(c, 10, 9 + bob, 11, 9 + bob, 'O')
  // antenne
  rect(c, 8, 1 + bob, 9, 2 + bob, 'D')
  px(c, 8, 0 + bob, 'W'); px(c, 9, 0 + bob, 'W')
  // pattes (alternance)
  if (step === 0) {
    rect(c, 4, 13, 6, 15, 'D'); rect(c, 11, 14, 13, 16, 'D')
    rect(c, 4, 15, 5, 16, 'E'); rect(c, 12, 16, 13, 16, 'E')
  } else {
    rect(c, 4, 14, 6, 16, 'D'); rect(c, 11, 13, 13, 15, 'D')
    rect(c, 4, 16, 5, 16, 'E'); rect(c, 12, 15, 13, 16, 'E')
  }
  outline(c)
  return c
}
const enemySheet = stitch([enemyFrame(0), enemyFrame(1)])
writeFileSync(join(outDir, 'enemy.png'), PNG.sync.write(gridToPng(enemySheet, enemySheet.w, enemySheet.h)))
console.log('--- ENEMY frame0 ---')
console.log(ascii(enemyFrame(0)))

// --- Bullet 6x4 ---
const bullet = makeCanvas(6, 4)
rect(bullet, 0, 0, 5, 3, 'Y')
rect(bullet, 1, 1, 4, 2, 'W')
px(bullet, 0, 0, 'y'); px(bullet, 0, 3, 'y')
writeFileSync(join(outDir, 'bullet.png'), PNG.sync.write(gridToPng(bullet, 6, 4)))

// --- Tileset (conservé procédural, déjà validé) ---
function seededRand(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648 }
const TP = { T: [148, 163, 184, 255], U: [71, 85, 105, 255], V: [30, 41, 59, 255], P: [148, 163, 184, 255], Q: [51, 65, 85, 255], _: [0, 0, 0, 0] }

// Clean SNES-style surfaces: smooth vertical gradient + a few deliberate details,
// no dense per-pixel noise.
function tileGroundTop() {
  const c = makeCanvas(32, 32); const rnd = seededRand(42)
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    // top edge highlight (light rows 0-1), then smooth body
    if (y === 0) { px(c, x, y, 'T'); continue }
    if (y === 1) { px(c, x, y, rnd() > 0.5 ? 'T' : 'U'); continue }
    // subtle shading: lighter near top, darker near bottom
    const shade = y / 32
    const ch = shade > 0.62 ? 'V' : (shade > 0.3 ? 'U' : 'U')
    px(c, x, y, ch)
  }
  // sparse intentional pebbles/cracks
  for (const [px_, py_] of [[7, 8], [19, 12], [26, 20], [5, 24]]) px(c, px_, py_, 'V')
  for (const [px_, py_] of [[13, 6], [30, 5]]) px(c, px_, py_, 'T')
  // occasional horizontal crack
  rect(c, 3, 15, 9, 15, 'V'); rect(c, 20, 25, 26, 25, 'V')
  return c
}
function tileGroundBody() {
  const c = makeCanvas(32, 32); const rnd = seededRand(7)
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const shade = y / 32
    const ch = shade > 0.7 ? 'V' : (shade > 0.35 ? 'U' : 'U')
    // horizontal bands every ~8px for a layered look
    const banded = (y % 8 === 0 && x > 2 && x < 29) ? 'V' : ch
    px(c, x, y, banded)
  }
  for (const [px_, py_] of [[6, 5], [24, 4], [14, 13], [28, 16], [9, 22]]) px(c, px_, py_, 'V')
  return c
}
function tilePlatform() {
  const c = makeCanvas(32, 32); const rnd = seededRand(99)
  rect(c, 0, 0, 31, 1, 'P')                 // bright top edge
  rect(c, 0, 2, 31, 3, 'Q')                 // under-edge
  for (let y = 4; y < 28; y++) for (let x = 0; x < 32; x++) {
    // smooth metal body with subtle shade
    const half = x < 16
    const ch = half ? 'Q' : (rnd() > 0.9 ? 'V' : 'Q')
    px(c, x, y, ch)
  }
  rect(c, 0, 28, 31, 30, 'V')               // dark underside
  rect(c, 0, 0, 0, 30, 'V'); rect(c, 31, 0, 31, 30, 'V')  // side borders
  // rivets
  px(c, 4, 6, 'T'); px(c, 27, 6, 'T'); px(c, 4, 22, 'T'); px(c, 27, 22, 'T')
  return c
}
const t0 = makeCanvas(32, 32)
const tiles = [t0, tileGroundTop(), tileGroundBody(), tilePlatform()]
const TPAL = { ...PALETTE, ...TP }
function tileToPng(rows, w, h) {
  const png = new PNG({ width: w, height: h })
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = TPAL[rows[y]?.[x] ?? '_'] ?? [255, 0, 255, 255]
      const i = (y * w + x) << 2
      png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = a
    }
  return png
}
const tileRows = Array.from({ length: 32 }, (_, y) => tiles.map(t => t.px[y]).flat())
writeFileSync(join(outDir, 'tileset.png'), PNG.sync.write(tileToPng(tileRows, 128, 32)))

// ================= BOSS : machine de guerre 32x32, 2 frames = 64x32 =================
function bossFrame(blink) {
  const c = makeCanvas(32, 32)
  // coque lourde (ombrée, lumière haut-gauche)
  ellip(c, 16, 12, 13, 10, 'R')
  rect(c, 3, 6, 8, 8, 'O')             // reflet coque
  ellip(c, 16, 4, 8, 4, 'D')           // sommet lourd
  rect(c, 12, 0, 19, 1, 'D')           // plaque frontale
  rect(c, 13, 0, 18, 0, 'W')           // reflet
  // fente visière + œil
  rect(c, 9, 10, 22, 13, 'E')
  rect(c, 13, 11, 18, 12, 'O')         // pupille
  if (!blink) { px(c, 13, 11, 'W'); px(c, 14, 11, 'W') }  // éclat
  // épaules épineuses
  rect(c, 1, 8, 3, 12, 'D'); px(c, 1, 7, 'O'); px(c, 0, 9, 'O')
  rect(c, 28, 8, 30, 12, 'D'); px(c, 30, 7, 'O')
  // torse blindé
  rect(c, 6, 15, 25, 22, 'B')
  rect(c, 6, 15, 9, 22, 'M')           // lumière gauche
  rect(c, 22, 15, 25, 22, 'D')         // ombre droite
  // cœur réacteur clignotant
  rect(c, 13, 17, 18, 20, blink ? 'Y' : 'W')
  rect(c, 13, 20, 18, 20, 'y')
  // jambes/trains
  rect(c, 7, 23, 13, 27, 'D')
  rect(c, 19, 23, 25, 27, 'D')
  rect(c, 5, 28, 14, 30, 'E'); rect(c, 18, 28, 27, 30, 'E')
  outline(c)
  return c
}
const bossSheet = stitch([bossFrame(false), bossFrame(true)])
writeFileSync(join(outDir, 'boss.png'), PNG.sync.write(gridToPng(bossSheet, bossSheet.w, bossSheet.h)))
console.log('--- BOSS frame0 ---')
console.log(ascii(bossFrame(false)))

console.log('Hand-authored SNES-style assets generated in', outDir)
