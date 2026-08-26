// Génère un level.json + entities.json PAR STAGE (un fichier par spec).
// Les specs vivent dans scripts/levels/<id>.mjs : chaque fichier exporte un
// objet { id, width, pits, walls, plats, walkers, turrets, flyers,
// checkpoints, orbs } (positions en tuiles).
//
// Le layout est construit à partir de la physique réelle du joueur pour que
// chaque obstacle soit franchissable par construction :
//   - saut ~55 px (3,5 tuiles) -> un mur de 2 tuiles est OK (3 = période trop courte)
//   - saut horizontal (~70 px/s × ~1 s) = ~4,3 tuiles -> un trou de 3 tuiles est confortable
//   - sol top ligne 17 (GT) = Y 272 ; le joueur repose à y~259, pieds sur GT.

import { writeFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'assets')
const levelsDir = join(__dirname, 'levels')

const TILE = 16
const H = 20
const GT = 17
const GID_TOP = 2
const GID_FILL = 3
const GID_PLAT = 4

function buildLevel(spec) {
  const W = spec.width
  const ground = Array.from({ length: H }, () => new Array(W).fill(0))
  const plat = Array.from({ length: H }, () => new Array(W).fill(0))
  const setG = (y, x, v) => { ground[y][x] = v }
  const setP = (y, x, v) => { plat[y][x] = v }
  const fillGround = (x) => { setG(GT, x, GID_TOP); setG(GT + 1, x, GID_FILL); setG(GT + 2, x, GID_FILL) }
  const clearGround = (x) => { setG(GT, x, 0); setG(GT + 1, x, 0); setG(GT + 2, x, 0) }
  // Puits de saut de mur : deux murs hauts (gap 3 tuiles) + dalle au sommet,
  // trou sous la dalle. Le joueur grimpe par sauts de mur (impossible au saut normal).
  const shaft = (sx, H) => {
    const x2 = sx + 3
    for (const wx of [sx, x2]) {
      setG(GT - H, wx, GID_TOP)
      for (let y = GT - H + 1; y <= GT + 2; y++) setG(y, wx, GID_FILL)
    }
    for (let x = sx; x <= x2; x++) setG(GT - H, x, GID_TOP) // dalle au sommet
    for (let x = sx + 1; x < x2; x++) clearGround(x)         // trou dessous
  }

  for (let x = 0; x < W; x++) fillGround(x)
  for (const [x, w] of spec.pits ?? []) for (let c = x; c < x + w; c++) clearGround(c)
  for (const [x, h] of spec.walls ?? []) {
    setG(GT - h, x, GID_TOP)
    for (let y = GT - h + 1; y <= GT + 2; y++) setG(y, x, GID_FILL)
  }
  for (const [x, row, w] of spec.plats ?? []) for (let c = x; c < x + w; c++) setP(row, c, GID_PLAT)
  // Puits de saut de mur : deux murs hauts espacés de `gap` avec, au sommet,
  // une dalle qui relie ; le fond est un trou (tomber = mort). Le joueur DOIT
  // grimper en saut de mur pour le franchir (impossible au saut normal).
  for (const [sx, H] of spec.shafts ?? []) shaft(sx, H)

  const enemies = []
  for (const x of spec.walkers ?? []) enemies.push({ kind: 'walker', x: x * TILE + 8, y: GT * TILE - 10 })
  for (const x of spec.turrets ?? []) enemies.push({ kind: 'turret', x: x * TILE + 8, y: GT * TILE - 10 })
  for (const x of spec.chargers ?? []) enemies.push({ kind: 'charger', x: x * TILE + 8, y: GT * TILE - 10 })
  for (const x of spec.spitters ?? []) enemies.push({ kind: 'spitter', x: x * TILE + 8, y: GT * TILE - 10 })
  for (const [x, y] of spec.flyers ?? []) enemies.push({ kind: 'flyer', x: x * TILE + 8, y })
  const checkpoints = (spec.checkpoints ?? []).map((x) => ({ x: x * TILE + 8, y: GT * TILE - 18 }))
  const orbs = (spec.orbs ?? []).map((x) => ({ x: x * TILE + 8, y: GT * TILE - 10 }))
  // Capsules de compagnon : 4 par niveau (tir/bouclier/soin/rapide), sur du sol
  // dégagé (pas de trou ni de mur), réparties sur toute la longueur.
  const capsTypes = ['tir', 'bouclier', 'soin', 'rapide']
  const wantTiles = [Math.round(W * 0.2), Math.round(W * 0.4), Math.round(W * 0.6), Math.round(W * 0.82)]
  const capsules = []
  const safeCell = (x) => x >= 14 && x < W - 42 && ground[GT][x] !== 0 && ground[GT - 1][x] === 0
  for (let i = 0; i < capsTypes.length; i++) {
    let tx = -1
    for (let d = 0; d < 20; d++) {
      if (safeCell(wantTiles[i] + d)) { tx = wantTiles[i] + d; break }
      if (safeCell(wantTiles[i] - d)) { tx = wantTiles[i] - d; break }
    }
    if (tx >= 0) capsules.push({ x: tx * TILE + 8, y: GT * TILE - 14, type: capsTypes[i] })
  }

  const data = (grid) => {
    const d = []
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) d.push(grid[y][x])
    return d
  }
  const level = {
    type: 'map', version: 1.10, tiledversion: '1.10.2',
    orientation: 'orthogonal', renderorder: 'right-down',
    width: W, height: H, tilewidth: TILE, tileheight: TILE,
    infinite: false, nextlayerid: 3, nextobjectid: 1,
    tilesets: [{ name: 'tileset', firstgid: 1, tilewidth: TILE, tileheight: TILE, spacing: 0, margin: 0, columns: 4, tilecount: 4, image: 'tileset.png', imagewidth: 64, imageheight: 16 }],
    layers: [
      { type: 'tilelayer', name: 'ground', width: W, height: H, id: 1, opacity: 1, visible: true, x: 0, y: 0, data: data(ground) },
      { type: 'tilelayer', name: 'platforms', width: W, height: H, id: 2, opacity: 1, visible: true, x: 0, y: 0, data: data(plat) },
    ],
  }
  const entities = {
    worldW: W * TILE, spawnX: 8 * TILE, spawnY: GT * TILE - 22,
    bossX: (W - 22) * TILE, bossWarnX: (W - 22) * TILE - 270,
    enemies, checkpoints, orbs, capsules,
  }
  writeFileSync(join(outDir, `level-${spec.id}.json`), JSON.stringify(level))
  writeFileSync(join(outDir, `entities-${spec.id}.json`), JSON.stringify(entities, null, 2))

  const cps = checkpoints.length
  const tiles = W
  console.log(`✅ ${spec.id}: ${tiles} tuiles (${W * TILE}px), ${enemies.length} ennemis (${spec.walkers?.length ?? 0} marcheurs, ${spec.turrets?.length ?? 0} tourelles, ${spec.flyers?.length ?? 0} drones), ${cps} CP, ${orbs.length} orbes`)
}

const specFiles = readdirSync(levelsDir).filter((f) => f.endsWith('.mjs'))
if (!specFiles.length) { console.error('Aucun spec dans scripts/levels/'); process.exit(1) }
for (const f of specFiles) {
  const mod = await import(new URL(`./levels/${f}`, import.meta.url))
  buildLevel(mod.default)
}
