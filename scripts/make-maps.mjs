// Génère un plan visuel (mini-carte) de chaque niveau à partir des données du jeu,
// puis le rend en PNG via Playwright. Sortie : scripts/preview/map-capsules.png
import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const TILE = 16, H = 20, GT = 17
const LEVELS = [
  { id: 'neon-city',        name: 'NEON CITY',        boss: 'RAM-9' },
  { id: 'toxic-plant',      name: 'TOXIC PLANT',      boss: 'VENOM' },
  { id: 'scorched-desert',  name: 'SCORCHED DESERT',  boss: 'TITAN' },
  { id: 'frost-lab',        name: 'FROST LAB',        boss: 'CRYO' },
  { id: 'sky-fortress',     name: 'SKY FORTRESS',     boss: 'AERON' },
]
const CAP_COLOR = { soin: '#7dfca2', rapide: '#ffd166', puissance: '#f472b6' }
const CAP_SHORT = { soin: 'SOIN', rapide: 'RAPIDE', puissance: 'PUISS.' }
const MAPW = 1200, MAPH = 168

function rowRects(row) {
  const out = []
  let s = -1
  for (let x = 0; x <= row.length; x++) {
    const v = x < row.length ? row[x] : 0
    if (v !== 0) { if (s < 0) s = x }
    else if (s >= 0) { out.push([s, x]); s = -1 }
  }
  return out
}

function terrainSVG(level) {
  const W = level.width, worldW = W * TILE, worldH = H * TILE
  const gl = level.layers.find((l) => l.name === 'ground').data
  const pl = level.layers.find((l) => l.name === 'platforms').data
  let r = ''
  for (let y = 0; y < H; y++) {
    const row = gl.slice(y * W, y * W + W)
    for (const [a, b] of rowRects(row)) r += `<rect x="${a * TILE}" y="${y * TILE}" width="${(b - a) * TILE}" height="${TILE}" fill="#243040"/>`
  }
  for (let y = 0; y < H; y++) {
    const row = pl.slice(y * W, y * W + W)
    for (const [a, b] of rowRects(row)) r += `<rect x="${a * TILE}" y="${y * TILE}" width="${(b - a) * TILE}" height="${TILE}" fill="#40506c"/>`
  }
  r += `<rect x="0" y="${GT * TILE}" width="${worldW}" height="2" fill="#5c7196"/>`
  return { worldW, worldH, r }
}

function markerSVG(worldW, ents) {
  const sx = (wx) => (wx / worldW) * MAPW
  // Bande au-dessus du sol (sol ≈ y136) : capsules/spawn à y~96-110, boss ~y96, CP au sol.
  let r = ''
  // Checkpoints.
  for (const c of ents.checkpoints) {
    const x = sx(c.x)
    r += `<rect x="${x - 2}" y="128" width="4" height="18" fill="#22d3ee"/>`
    r += `<text x="${x}" y="122" fill="#9ee8ff" font-size="11" text-anchor="middle">CP</text>`
  }
  // Boss.
  const bx = sx(ents.bossX)
  r += `<rect x="${bx - 20}" y="78" width="40" height="40" fill="none" stroke="#ff2436" stroke-width="3"/>`
  r += `<text x="${bx}" y="66" fill="#ff2436" font-size="13" text-anchor="middle" font-weight="bold">BOSS</text>`
  // Capsules.
  for (const c of ents.capsules ?? []) {
    const x = sx(c.x), col = CAP_COLOR[c.type] ?? '#fff'
    r += `<circle cx="${x}" cy="96" r="7" fill="${col}" stroke="#0a0d16" stroke-width="1.5"/>`
    r += `<text x="${x}" y="86" fill="${col}" font-size="12" text-anchor="middle" font-weight="bold">${CAP_SHORT[c.type] ?? c.type}</text>`
  }
  // Spawn.
  const px = sx(ents.spawnX)
  r += `<circle cx="${px}" cy="96" r="7" fill="#39d98a" stroke="#0a0d16" stroke-width="1.5"/>`
  r += `<text x="${px}" y="86" fill="#39d98a" font-size="12" text-anchor="middle" font-weight="bold">SPAWN</text>`
  return r
}

function cardHTML(L, idx) {
  const level = JSON.parse(readFileSync(`public/assets/level-${L.id}.json`, 'utf8'))
  const ents = JSON.parse(readFileSync(`public/assets/entities-${L.id}.json`, 'utf8'))
  const { worldW, worldH, r: tr } = terrainSVG(level)
  const mk = markerSVG(worldW, ents)
  const caps = (ents.capsules ?? []).map((c) =>
    `<div class="cap" style="color:${CAP_COLOR[c.type]}">● ${CAP_SHORT[c.type]} — tuile ${Math.round(c.x / TILE)}</div>`).join('')
  return `
<div class="card">
  <div class="hdr"><span class="lv">NIVEAU ${idx + 1} — ${L.name}</span><span class="boss">GARDIEN : ${L.boss}</span></div>
  <div class="mapwrap">
    <svg viewBox="0 0 ${worldW} ${worldH}" preserveAspectRatio="none" style="width:${MAPW}px;height:${MAPH}px">${tr}</svg>
    <svg viewBox="0 0 ${MAPW} ${MAPH}" style="width:${MAPW}px;height:${MAPH}px">${mk}</svg>
  </div>
  <div class="caps">${caps}</div>
  <div class="scale">${level.width} tuiles · ${worldW} px monde — le sol suit la ligne grise, les creux sont des trous</div>
</div>`
}

const cards = LEVELS.map(cardHTML).join('')
const legend = `
<div class="card legend">
  <span style="color:#7dfca2">● SOIN</span> — soigne le compagnon
  <span style="color:#ffd166">● RAPIDE</span> — tirs plus rapides
  <span style="color:#f472b6">● PUISS.</span> — boost du compagnon (×2 par niveau)
  <span style="color:#39d98a">● SPAWN</span> · <span style="color:#22d3ee">CP</span> checkpoint · <span style="color:#ff2436">BOSS</span> gardien
</div>`

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:0;padding:16px;background:#0a0d16;color:#cfe0f5;font-family:monospace}
.card{background:#10141f;border:1px solid #2a3345;border-radius:10px;padding:12px 14px;margin-bottom:16px}
.legend{font-size:14px;color:#bcd}
.legend span{margin:0 8px}
.hdr{display:flex;justify-content:space-between;margin-bottom:8px;font-weight:bold}
.lv{color:#7dfca2}.boss{color:#ff2436}
.mapwrap{position:relative;width:${MAPW}px;height:${MAPH}px}
.mapwrap svg{position:absolute;left:0;top:0;display:block;background:#0d1119;border:1px solid #223}
.caps{margin-top:8px;font-size:13px}
.cap{display:inline-block;margin-right:14px}
.scale{margin-top:6px;color:#8093b0;font-size:11px}
</style></head><body>${legend}${cards}</body></html>`

writeFileSync('scripts/preview/map-capsules.html', html)
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1240, height: 1800 }, deviceScaleFactor: 1 })
  await page.setContent(html, { waitUntil: 'load' })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'scripts/preview/map-capsules.png', fullPage: true })
  console.log('✅ scripts/preview/map-capsules.png généré')
} finally { await browser.close() }
