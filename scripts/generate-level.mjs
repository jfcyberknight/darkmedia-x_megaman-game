// Generate a long, platformer-safe level (level.json + level-entities.json).
//
// The layout is built from the player's real physics so every obstacle is
// guaranteed jumpable by construction:
//   - jump height  ~55px  = 3.5 tiles   -> a wall/step up to 3 tiles is fine
//   - horizontal jump (~70px/s × ~1.0s) = ~4.3 tiles -> a pit up to 4 tiles
//   - ground top row GT (row 17) = Y 272; player rests at y~259, feet on GT.
//
// We keep a CONTINUOUS ground path for the whole level, carving only narrow
// pits (<=4) and low walls (<=3) as the "obstacles", plus platforms (15/14/13)
// as optional high routes. This guarantees a solvable floor route.

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'assets')

const TILE = 16
const W = 210        // tiles wide  -> 3360px world
const H = 20         // tiles high  -> 320px
const GT = 17        // ground-top row (Y = 272)
const GID_TOP = 2    // ground top tile
const GID_FILL = 3   // ground fill tile
const GID_PLAT = 4   // platform slab

// ---- layer buffers (GIDs; 0 = empty) ----
const ground = Array.from({ length: H }, () => new Array(W).fill(0))
const plat = Array.from({ length: H }, () => new Array(W).fill(0))

const setG = (y, x, v) => { ground[y][x] = v }
const setP = (y, x, v) => { plat[y][x] = v }

function fillGround(x) { setG(GT, x, GID_TOP); setG(GT + 1, x, GID_FILL); setG(GT + 2, x, GID_FILL) }
function clearGround(x) { setG(GT, x, 0); setG(GT + 1, x, 0); setG(GT + 2, x, 0) }
function pit(x, w) { for (let c = x; c < x + w; c++) clearGround(c) }
function wall(x, h) { // solid block h tiles above ground (top row GT-h)
  setG(GT - h, x, GID_TOP)
  for (let y = GT - h + 1; y <= GT + 2; y++) setG(y, x, GID_FILL)
}
function platRow(x, row, w) { for (let c = x; c < x + w; c++) setP(row, c, GID_PLAT) }

// ---- base floor across the whole level ----
for (let x = 0; x < W; x++) fillGround(x)

// ---- obstacles (pits <= 4 wide, walls <= 3 tall) ----
// Trous de 3 tuiles (48 px) : franchissable même sans vitesse max (marge large).
const PITS = [[22, 3], [40, 3], [58, 3], [76, 3], [94, 3], [112, 3], [130, 3], [150, 3], [168, 3]]
for (const [x, w] of PITS) pit(x, w)

// Murs de 2 tuiles maximum : au-dessus, la fenêtre où les pieds dépassent le
// sommet (~0,37 s pour 3 tuiles) est trop courte pour un saut fiable.
const WALLS = [[31, 2], [66, 2], [88, 2], [120, 2], [141, 2]]
for (const [x, h] of WALLS) wall(x, h)

// ---- platforms (décor haute altitude, comme l'original) ----
// ATTENTION : une plateforme « atteignable d'un saut » (row >= 13) plafonne
// aussi les sauts passant DESSOUS (son dessous est à moins de 30 px de la tête
// du joueur debout → « bonk », impossible de franchir un mur/trou derrière).
// Rows 10-11 = dessous à 60-76 px au-dessus du sol : aucun saut n'est coupé.
const PLATS = [
  [15, 10, 4], [25, 11, 4], [34, 10, 4], [48, 11, 4],
  [84, 10, 4], [104, 11, 4], [118, 10, 4], [136, 11, 4], [156, 10, 4],
  [172, 11, 4], [184, 10, 4],
]
for (const [x, row, w] of PLATS) platRow(x, row, w)

// ---- entities (kept out of the boss arena, which starts ~x=2450px) ----
const enemies = []
// walkers on ground (avoid placing over pits)
const WALKERS = [30, 55, 84, 105, 135, 160, 176]
for (const x of WALKERS) enemies.push({ kind: 'walker', x: x * TILE + 8, y: GT * TILE - 10 })
// turrets on ground
const TURRETS = [45, 92, 128, 166]
for (const x of TURRETS) enemies.push({ kind: 'turret', x: x * TILE + 8, y: GT * TILE - 10 })
// flyers in the air (they descend toward the player when close)
const FLYERS = [[70, 150], [122, 132], [155, 140], [176, 150]]
for (const [x, y] of FLYERS) enemies.push({ kind: 'flyer', x: x * TILE + 8, y })

// checkpoints at safe flat spots (respawn point)
const checkpoints = [20, 62, 100, 145, 185].map((x) => ({ x: x * TILE + 8, y: GT * TILE - 18 }))

// energy orbs: au sol, répartis (positions hors trous et hors murs)
const orbs = []
for (const x of [12, 28, 36, 46, 54, 64, 72, 82, 90, 100, 108, 126, 136, 146, 158, 164, 176]) {
  orbs.push({ x: x * TILE + 8, y: GT * TILE - 10 })
}

// ---- write level.json (Tiled, tilemap compatible) ----
const data = (grid) => {
  const d = []
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d.push(grid[y][x])
  return d
}
const level = {
  type: 'map', version: 1.10, tiledversion: '1.10.2',
  orientation: 'orthogonal', renderorder: 'right-down',
  width: W, height: H,
  tilewidth: TILE, tileheight: TILE,
  infinite: false, nextlayerid: 3, nextobjectid: 1,
  tilesets: [{ name: 'tileset', firstgid: 1, tilewidth: TILE, tileheight: TILE, spacing: 0, margin: 0, columns: 4, tilecount: 4, image: 'tileset.png', imagewidth: 64, imageheight: 16 }],
  layers: [
    { type: 'tilelayer', name: 'ground', width: W, height: H, id: 1, opacity: 1, visible: true, x: 0, y: 0, data: data(ground) },
    { type: 'tilelayer', name: 'platforms', width: W, height: H, id: 2, opacity: 1, visible: true, x: 0, y: 0, data: data(plat) },
  ],
}
writeFileSync(join(outDir, 'level.json'), JSON.stringify(level))

const entities = {
  worldW: W * TILE,
  spawnX: 8 * TILE,
  spawnY: GT * TILE - 22,
  bossX: (W - 22) * TILE,
  // warning au début de l'arène plate (après le dernier trou, ~tuile 171)
  bossWarnX: (W - 22) * TILE - 270,
  enemies, checkpoints, orbs,
}
writeFileSync(join(outDir, 'level-entities.json'), JSON.stringify(entities, null, 2))

console.log(`level generated: ${W}x${H} tiles (${W * TILE}x${H * TILE}px), ${enemies.length} enemies, ${checkpoints.length} checkpoints, ${orbs.length} orbs`)
