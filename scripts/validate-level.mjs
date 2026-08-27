// Valide un spec de niveau (scripts/levels/<id>.mjs) contre toutes les
// contraintes de franchissabilité. Usage :
//   node scripts/validate-level.mjs scripts/levels/<id>.mjs
// Sortie 0 = valide, 1 = erreurs listées.
const specPath = process.argv[2]
if (!specPath) { console.error('Usage: node validate-level.mjs <specPath>'); process.exit(2) }
const spec = (await import(new URL('../' + specPath.replace(/^\.\//, ''), import.meta.url))).default

const W = spec.width
// Début réel de l'arène du boss : même formule que le générateur (bossWarnX).
const ARENA = Math.floor(((W - 22) * 16 - 270) / 16)
const pits = spec.pits ?? []
const walls = spec.walls ?? []
const plats = spec.plats ?? []
const walkers = spec.walkers ?? []
const turrets = spec.turrets ?? []
const chargers = spec.chargers ?? []
const spitters = spec.spitters ?? []
const flyers = spec.flyers ?? []
const cps = spec.checkpoints ?? []
const orbs = spec.orbs ?? []

const errors = []
const inPit = (tx) => pits.some(([x, w]) => tx >= x && tx < x + w)
const wallCols = new Set(walls.map(([x]) => x))

// Largeur
if (W < 200 || W > 320) errors.push(`width ${W} hors de [200,320]`)
if (!Number.isInteger(W)) errors.push('width non entier')

// Trous
for (const [x, w] of pits) {
  if (!Number.isInteger(x) || !Number.isInteger(w)) errors.push(`pit invalide [${x},${w}]`)
  if (w > 3) errors.push(`pit @${x} : largeur ${w} > 3`)
  if (x < 14) errors.push(`pit @${x} : trop près du spawn (x<14)`)
  if (x + w > ARENA) errors.push(`pit @${x} : dans l'arène du boss (x+w>${ARENA})`)
}
for (let i = 0; i < pits.length; i++) for (let j = i + 1; j < pits.length; j++) {
  const a = pits[i], b = pits[j]
  if (a[0] < b[0] + b[1] && b[0] < a[0] + a[1]) errors.push(`pits en conflit @${a[0]} et @${b[0]}`)
}

// Murs
for (const [x, h] of walls) {
  if (h !== 2) errors.push(`wall @${x} : hauteur ${h} (doit être 2)`)
  if (!Number.isInteger(x) || x < 14 || x > ARENA) errors.push(`wall @${x} : position invalide`)
  if (inPit(x)) errors.push(`wall @${x} : sur un trou`)
  // >=4 tuiles de sol après le trou précédent, avant le trou suivant
  const prevPit = pits.filter(([px]) => px < x).pop()
  const nextPit = pits.find(([px]) => px > x)
  if (prevPit && x - (prevPit[0] + prevPit[1]) < 4) errors.push(`wall @${x} : trop juste après le trou @${prevPit[0]}`)
  if (nextPit && nextPit[0] - x < 4) errors.push(`wall @${x} : trop juste avant le trou @${nextPit[0]}`)
}

// Plateformes
// rows autorisées : 10-11 (dalles hautes/attiques) et 13-15 (dalles atteignables,
// utilisées par les ponts à plateforme) — 12 et >15 inutilisables (hors de portée).
for (const [x, row] of plats) {
  if (row < 10 || row > 15) errors.push(`plat @${x} : row ${row} (doit être 10..15)`)
}

// Ponts à plateforme : large ouverture (5-7 tuiles, infranchissable au saut)
// traversée par une dalle centrale atteignable. On vérifie la position/portée.
const bridges = spec.bridges ?? []
for (const [x, w] of bridges) {
  if (!Number.isInteger(x) || !Number.isInteger(w)) errors.push(`bridge invalide [${x},${w}]`)
  if (w < 5 || w > 7) errors.push(`bridge @${x} : largeur ${w} (doit être 5..7)`)
  if (x < 14) errors.push(`bridge @${x} : trop près du spawn (x<14)`)
  if (x + w > ARENA) errors.push(`bridge @${x} : dans l'arène du boss (x+w>${ARENA})`)
  if (pits.some(([px, pw]) => x < px + pw && px < x + w)) errors.push(`bridge @${x} : chevauche un trou`)
  if (wallCols.has(x) || wallCols.has(x + w - 1)) errors.push(`bridge @${x} : sur un mur`)
}

// Puits de saut de mur (sections "compétence")
const shafts = spec.shafts ?? []
for (const [sx, H] of shafts) {
  const x2 = sx + 3
  if (!Number.isInteger(H) || H < 4 || H > 8) errors.push(`shaft @${sx} : hauteur ${H} hors de [4,8]`)
  if (sx < 14) errors.push(`shaft @${sx} : trop près du spawn`)
  if (x2 + 1 > ARENA) errors.push(`shaft @${sx} : dans/après l'arène`)
  for (let x = sx; x <= x2; x++) {
    if (inPit(x)) errors.push(`shaft @${sx} : chevauche un trou @${x}`)
    if (wallCols.has(x)) errors.push(`shaft @${sx} : chevauche un mur @${x}`)
  }
  for (const en of [...walkers, ...turrets, ...chargers, ...spitters]) if (en >= sx && en <= x2) errors.push(`shaft @${sx} : ennemi au sol @${en} dedans`)
  for (const x of cps) if (x >= sx && x <= x2) errors.push(`shaft @${sx} : checkpoint @${x} dedans`)
  for (const x of orbs) if (x >= sx && x <= x2) errors.push(`shaft @${sx} : orbe @${x} dedans`)
}

// Ennemis au sol (marcheurs + tourelles + chargeurs + cracheurs)
for (const x of [...walkers, ...turrets, ...chargers, ...spitters]) {
  if (!Number.isInteger(x)) errors.push(`ennemi @${x} : position non entière`)
  if (inPit(x)) errors.push(`ennemi au sol @${x} : sur un trou`)
  if (wallCols.has(x)) errors.push(`ennemi au sol @${x} : sur un mur`)
  if (pits.some(([px]) => Math.abs(x - px) <= 1)) errors.push(`ennemi au sol @${x} : trop près d'un trou`)
}

// Drones
for (const [x, y] of flyers) {
  if (!Number.isInteger(x) || y < 100 || y > 170) errors.push(`flyer @${x},${y} : y doit être entre 100 et 170`)
}

// Checkpoints
if (cps.length < 4) errors.push(`trop peu de checkpoints (${cps.length})`)
for (const x of cps) {
  if (inPit(x)) errors.push(`checkpoint @${x} : sur un trou`)
  if (wallCols.has(x)) errors.push(`checkpoint @${x} : sur un mur`)
}
for (let i = 1; i < cps.length; i++) if (cps[i] - cps[i - 1] < 25) errors.push(`checkpoints trop proches @${cps[i - 1]} et @${cps[i]}`)

// Orbes
for (const x of orbs) {
  if (inPit(x)) errors.push(`orbe @${x} : sur un trou`)
  if (wallCols.has(x)) errors.push(`orbe @${x} : sur un mur`)
}

// Zone de spawn (tuiles 0..13) sans trou ni mur
for (let x = 0; x < 14; x++) {
  if (inPit(x)) errors.push(`trou trop proche du spawn @${x}`)
  if (wallCols.has(x)) errors.push(`mur trop proche du spawn @${x}`)
}

// Arène du boss plate
for (let x = ARENA; x < W; x++) {
  if (inPit(x)) errors.push(`trou dans l'arène @${x}`)
  if (wallCols.has(x)) errors.push(`mur dans l'arène @${x}`)
}

if (errors.length) {
  console.log(`❌ ${spec.id} — ${errors.length} erreur(s)`)
  errors.forEach((e) => console.log('   - ' + e))
  process.exit(1)
} else {
  const e = walkers.length + turrets.length + flyers.length
  console.log(`✅ ${spec.id} valide — ${W} tuiles, ${walkers.length} marcheurs, ${turrets.length} tourelles, ${flyers.length} drones, ${cps.length} CP, ${orbs.length} orbes`)
}
