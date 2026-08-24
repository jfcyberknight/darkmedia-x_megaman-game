import { PNG } from 'pngjs'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'assets')

const PALETTE = {
  _: [0, 0, 0, 0],
  K: [10, 14, 26, 255],
  B: [29, 78, 216, 255],
  M: [59, 130, 246, 255],
  L: [96, 165, 250, 255],
  F: [252, 165, 165, 255],
  W: [255, 255, 255, 255],
  Y: [250, 204, 21, 255],
  R: [239, 68, 68, 255],
  O: [248, 113, 113, 255],
  D: [153, 27, 27, 255],
  T: [74, 85, 104, 255],
  U: [55, 65, 81, 255],
  V: [31, 41, 55, 255],
  P: [100, 116, 139, 255],
  Q: [71, 85, 105, 255],
}

function drawPixels(pixels, width, height) {
  const png = new PNG({ width, height })
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const ch = pixels[y]?.[x] || '_'
      const [r, g, b, a] = PALETTE[ch] || [255, 0, 255, 255]
      const idx = (y * width + x) << 2
      png.data[idx] = r
      png.data[idx + 1] = g
      png.data[idx + 2] = b
      png.data[idx + 3] = a
    }
  }
  return PNG.sync.write(png)
}

function stitchFrames(frames) {
  const h = frames[0].length
  const w = frames[0][0].length
  const rows = []
  for (let y = 0; y < h; y++) {
    rows.push(frames.map(f => f[y]).join(''))
  }
  return { pixels: rows, width: w * frames.length, height: h }
}

// --- Player: 4 frames of 16x24 ---
const playerFrames = [
  // idle
  [
    '____MMMMMM_____M',
    '___MMMMMMMM___MM',
    '___MMBBBBM_____M',
    '___MBFWFFM______',
    '___MBFWFFM______',
    '____BFFFFB______',
    '____MMMMMM______',
    '___MMLLLLM______',
    '___MMLLLLM______',
    '___MMLLLLM______',
    '___MMBBBBM______',
    '____BMBMB_______',
    '____BMBMB_______',
    '____BMBMB_______',
    '___BBM_BM_______',
    '___BBM_BM_______',
    '___BBM_BM_______',
    '___BBM_BM_______',
    '___BB__BB_______',
    '___BB__BB_______',
    '___BB__BB_______',
    '___BB__BB_______',
    '___BB__BB_______',
    '___BB__BB_______',
  ],
  // run 1
  [
    '____MMMMMM_____M',
    '___MMMMMMMM___MM',
    '___MMBBBBM_____M',
    '___MBFWFFM______',
    '___MBFWFFM______',
    '____BFFFFB______',
    '____MMMMMM______',
    '___MMLLLLM______',
    '___MMLLLLM______',
    '___MMLLLLM______',
    '___MMBBBBM______',
    '____BMBMB_______',
    '____BMBMB_______',
    '____BMBMB_______',
    '___BBM_BM_______',
    '___BBM_BM_______',
    '___BBM_BBB______',
    '___BB__BBB______',
    '_______BB_______',
    '_______BB_______',
    '______BB________',
    '______BB________',
    '______BB________',
    '______BB________',
  ],
  // run mid
  [
    '____MMMMMM_____M',
    '___MMMMMMMM___MM',
    '___MMBBBBM_____M',
    '___MBFWFFM______',
    '___MBFWFFM______',
    '____BFFFFB______',
    '____MMMMMM______',
    '___MMLLLLM______',
    '___MMLLLLM______',
    '___MMLLLLM______',
    '___MMBBBBM______',
    '____BMBMB_______',
    '____BMBMB_______',
    '____BMBMB_______',
    '___BBM_BM_______',
    '___BBM_BM_______',
    '___BBM_BM_______',
    '___BBM_BM_______',
    '___BB__BB_______',
    '___BB__BB_______',
    '___BB__BB_______',
    '___BB__BB_______',
    '___BB__BB_______',
    '___BB__BB_______',
  ],
  // run 2
  [
    '____MMMMMM_____M',
    '___MMMMMMMM___MM',
    '___MMBBBBM_____M',
    '___MBFWFFM______',
    '___MBFWFFM______',
    '____BFFFFB______',
    '____MMMMMM______',
    '___MMLLLLM______',
    '___MMLLLLM______',
    '___MMLLLLM______',
    '___MMBBBBM______',
    '____BMBMB_______',
    '____BMBMB_______',
    '____BMBMB_______',
    '___BBM_BM_______',
    '___BBM_BM_______',
    '___BBB_BM_______',
    '___BBB_BB_______',
    '_____BB_________',
    '_____BB_________',
    '____BB__________',
    '____BB__________',
    '____BB__________',
    '____BB__________',
  ],
]

const playerSheet = stitchFrames(playerFrames)
writeFileSync(join(outDir, 'player.png'), drawPixels(playerSheet.pixels, playerSheet.width, playerSheet.height))

// --- Enemy: 2 frames of 18x18 ---
const enemyFrames = [
  [
    '____RRRRRRRR______',
    '___RRRRRRRRRR_____',
    '___RRRDDDRRRR_____',
    '___RROWOORRRR_____',
    '___RROWOORRRR_____',
    '____RDDDRRRR______',
    '____RRRRRRRR______',
    '___RRRRRRRRRR_____',
    '___RRRRRRRRRR_____',
    '___RRRRRRRRRR_____',
    '____RRRRRRRR______',
    '____RR____RR______',
    '____RR____RR______',
    '____RR____RR______',
    '___RRR____RRR_____',
    '___RRR____RRR_____',
    '___RRR____RRR_____',
    '___RRR____RRR_____',
  ],
  [
    '____RRRRRRRR______',
    '___RRRRRRRRRR_____',
    '___RRRDDDRRRR_____',
    '___RROWOORRRR_____',
    '___RROWOORRRR_____',
    '____RDDDRRRR______',
    '____RRRRRRRR______',
    '___RRRRRRRRRR_____',
    '___RRRRRRRRRR_____',
    '___RRRRRRRRRR_____',
    '____RRRRRRRR______',
    '____RR____RR______',
    '____RR____RR______',
    '____RR____RR______',
    '____RR____RR______',
    '____RR____RR______',
    '____RR____RR______',
    '____RR____RR______',
  ],
]
const enemySheet = stitchFrames(enemyFrames)
writeFileSync(join(outDir, 'enemy.png'), drawPixels(enemySheet.pixels, enemySheet.width, enemySheet.height))

// --- Bullet 6x4 ---
writeFileSync(join(outDir, 'bullet.png'), drawPixels([
  'YYYYYY',
  'YYYYYY',
  'YYYYYY',
  'YYYYYY',
], 6, 4))

// --- Tileset: 4 tiles of 32x32 = 128x32 ---
function makeTile(type) {
  const rows = []
  for (let y = 0; y < 32; y++) {
    let row = ''
    for (let x = 0; x < 32; x++) {
      if (type === 0) {
        row += '_'
      } else if (type === 3) {
        const edge = y < 4 || y > 27 || x < 4 || x > 27
        row += edge ? 'P' : ((x + y) % 7 === 0 ? 'Q' : 'V')
      } else if (type === 1) {
        row += y < 6 ? 'T' : ((x + y) % 5 === 0 ? 'U' : 'V')
      } else {
        row += (x + y) % 5 === 0 ? 'U' : 'V'
      }
    }
    rows.push(row)
  }
  return rows
}

const tile0 = makeTile(0)
const tile1 = makeTile(1)
const tile2 = makeTile(2)
const tile3 = makeTile(3)

const tileRows = []
for (let y = 0; y < 32; y++) {
  tileRows.push(tile0[y] + tile1[y] + tile2[y] + tile3[y])
}
writeFileSync(join(outDir, 'tileset.png'), drawPixels(tileRows, 128, 32))

console.log('Sprites generated in', outDir)

// --- Tiled JSON map ---
const mapWidth = 50
const mapHeight = 20
const tileSize = 32

function emptyLayer() {
  return new Array(mapWidth * mapHeight).fill(0)
}

const groundLayer = emptyLayer()
const platformLayer = emptyLayer()

function set(layer, x, y, gid) {
  if (x >= 0 && x < mapWidth && y >= 0 && y < mapHeight) {
    layer[y * mapWidth + x] = gid
  }
}

// Ground
for (let x = 0; x < mapWidth; x++) {
  set(groundLayer, x, mapHeight - 2, 2)
  set(groundLayer, x, mapHeight - 3, 1)
}

// Platforms
const platforms = [
  { x: 6, y: 14, w: 4 },
  { x: 12, y: 12, w: 3 },
  { x: 18, y: 10, w: 5 },
  { x: 28, y: 12, w: 3 },
  { x: 34, y: 9, w: 4 },
  { x: 42, y: 11, w: 3 },
]

for (const p of platforms) {
  for (let i = 0; i < p.w; i++) {
    set(platformLayer, p.x + i, p.y, 4)
  }
}

const levelJson = {
  compressionlevel: -1,
  height: mapHeight,
  infinite: false,
  layers: [
    {
      data: groundLayer,
      height: mapHeight,
      id: 1,
      name: 'ground',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: mapWidth,
      x: 0,
      y: 0,
    },
    {
      data: platformLayer,
      height: mapHeight,
      id: 2,
      name: 'platforms',
      opacity: 1,
      type: 'tilelayer',
      visible: true,
      width: mapWidth,
      x: 0,
      y: 0,
    },
  ],
  nextlayerid: 3,
  nextobjectid: 1,
  orientation: 'orthogonal',
  renderorder: 'right-down',
  tiledversion: '1.11.0',
  tileheight: tileSize,
  tilesets: [
    {
      columns: 4,
      firstgid: 1,
      image: 'tileset.png',
      imageheight: 32,
      imagewidth: 128,
      margin: 0,
      name: 'tileset',
      spacing: 0,
      tilecount: 4,
      tileheight: tileSize,
      tilewidth: tileSize,
    },
  ],
  tilewidth: tileSize,
  type: 'map',
  version: '1.10',
  width: mapWidth,
}

writeFileSync(join(outDir, 'level.json'), JSON.stringify(levelJson, null, 2))
console.log('Level generated in', outDir)
