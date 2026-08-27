/**
 * Test du long niveau généré (210x20) — pilote réellement le jeu via Playwright.
 *  - traverse le niveau avec un bot géométrique (connaît trous/murs du level.json)
 *  - vérifie la mort par chute dans un trou, les checkpoints, le déclenchement du boss
 *
 * Usage : node scripts/test-level.mjs [url]
 */
import { chromium } from 'playwright'

const BASE_URL = process.argv[2] || 'http://localhost:5174/'
const STAGE = process.argv[3] || 'neon-city'
// Faiblesse d'arme du gardien de chaque stage (le boss ne se blesse qu'avec celle-ci).
const WEAKNESS = { 'neon-city': 'buster', 'toxic-plant': 'drill', 'scorched-desert': 'cryo', 'frost-lab': 'ram', 'sky-fortress': 'venom' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const level = await (await fetch(BASE_URL + `assets/level-${STAGE}.json`)).json()
const ents = await (await fetch(BASE_URL + `assets/entities-${STAGE}.json`)).json()
const W = level.width, GT = 17, TILE = 16
const g = level.layers.find((l) => l.name === 'ground').data
const hasGroundCol = (tx) => { for (let y = GT - 4; y < level.height; y++) if (g[y * W + tx] !== 0) return true; return false }
// trous (range world px sans sol dans les lignes sol) + murs (colonne dont le sol monte)
const pits = [], walls = []
{
  let run = 0, st = 0
  for (let tx = 0; tx < W; tx++) {
    const hg = hasGroundCol(tx)
    if (!hg) { if (run === 0) st = tx; run++ }
    else {
      if (run > 0) pits.push([st * TILE, (st + run) * TILE])
      run = 0
    }
  }
  if (run > 0) pits.push([st * TILE, (st + run) * TILE])
  for (let tx = 0; tx < W; tx++) {
    let top = Infinity
    for (let y = 0; y < level.height; y++) if (g[y * W + tx] !== 0) { top = y; break }
    if (top < GT) walls.push(tx * TILE) // sol surélevé (obstacle à sauter)
  }
}

const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`) }

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    const t = m.text()
    // /api/ai renvoie 404 en dev local (pas de binding Workers AI sous Vite) : attendu.
    if (t.includes('404') && !t.includes('favicon')) {
      if (!errors.some((e) => e.includes('404'))) errors.push('404 /api/ai (attendu en local)')
    } else if (!t.includes('favicon')) errors.push(t)
  })

  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 45000 })
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
  const rh = page.locator('.rh-play')
  if (await rh.count()) await rh.dispatchEvent('pointerdown')

  const scenes = () => page.evaluate(() => {
    const g = window.__game
    return g ? g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key) : []
  })
  const waitScene = async (key, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scenes()).includes(key)) return true; await sleep(200) } return false }
  const tap = async (sel) => { const el = page.locator(sel).first(); await el.dispatchEvent('pointerdown'); await sleep(120); await el.dispatchEvent('pointerup'); await sleep(150) }
  const state = () => page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const p = s?.player
    return { ok: !!p, x: Math.round(p?.x ?? -9999), y: Math.round(p?.y ?? -9999), hp: p?.getHealth?.() ?? -1, lives: s.registry.get('lives'), cpX: s.registry.get('cpX') ?? null, bossIntro: s.bossIntroDone === true }
  })
  // Navigation clavier Z jusqu'à GameScene (réutilisable après un reload).
  const STAGE_IDX = { 'neon-city':0, 'toxic-plant':1, 'scorched-desert':2, 'frost-lab':3, 'sky-fortress':4 }[STAGE] ?? 0
  const navToGame = async () => {
    const t0 = Date.now()
    let sel = false
    while (Date.now() - t0 < 30000) {
      const sc = await scenes()
      if (sc.includes('GameScene')) return true
      if (sc.includes('StageSelectScene') && !sel) {
        sel = true
        for (let i = 0; i < STAGE_IDX; i++) { await page.keyboard.press('ArrowRight'); await sleep(200) }
      }
      await page.keyboard.press('z')
      await sleep(340)
    }
    return (await scenes()).includes('GameScene')
  }

  // Nav jusqu'à GameScene par touches clavier Z (toutes les scènes y répondent,
  // y compris CompanionScene qui ne réagit pas aux boutons tactiles).
  await waitScene('IntroScene', 10000)
  const inGame = await navToGame()
  check('GameScene chargée (long niveau)', inGame)
  await sleep(1000)

  // --- TRAVERSÉE réelle avec bot géométrique ---
  // Déclenchement AU RAS du bord : le saut couvre ~70 px ; déclencher trop tôt
  // consomme l'arc sur le sol et fait tomber dans le trou (48 px).
  const right = page.locator('.tc-dir:nth-child(2)')
  const jump = page.locator('.tc-jump')
  await right.dispatchEvent('pointerdown')
  const dead0 = (await state()).lives
  let maxX = 0, deaths = 0, gone = false
  const tEnd = Date.now() + 110000
  while (Date.now() < tEnd) {
    const st = await state()
    if (!st.ok) { gone = true; break } // game over / scène quittée
    maxX = Math.max(maxX, st.x)
    deaths = dead0 - st.lives
    if (st.x > ents.bossWarnX) break
    const px = st.x
    let act = false
    for (const [a] of pits) { if (a > px - 8 && px > a - 12 && st.y < 300) { act = true; break } }
    if (!act) for (const wx of walls) { if (wx > px - 8 && px > wx - 18) { act = true; break } }
    if (!act) {
      // Saut contre les DEUX murs (gauche ET droite) : nécessaire pour grimper
      // les puits de saut de mur.
      const blocked = await page.evaluate(() => {
        const b = window.__game.scene.getScene('GameScene').player?.body
        return !!b && (b.blocked.right === true || b.blocked.left === true)
      })
      if (blocked) act = true
    }
    if (act) { await jump.dispatchEvent('pointerdown'); await sleep(350); await jump.dispatchEvent('pointerup'); await sleep(100) }
    else await sleep(60)
  }
  await right.dispatchEvent('pointerup').catch(() => {})
  const end = await state()
  const reached = end.ok && end.x > ents.bossWarnX
  check(`progression jusqu'au boss (warn ${ents.bossWarnX})`, reached, gone ? `partie perdue (game over), maxX=${maxX}` : `maxX=${maxX}, vies=${end.lives}, morts=${deaths}`)
  check('boss déclenché (WARNING) en fin de niveau', reached && end.bossIntro, `bossIntro=${end.bossIntro}`)

  // --- Mort par chute (tomber dans un trou = vie perdue) ---
  const pit = pits[Math.min(2, pits.length - 1)]
  let lvBefore = end.ok ? end.lives : null
  if (!end.ok) {
    // La partie s'est finie (game over pendant la traversée) : repartir proprement.
    await page.reload({ waitUntil: 'load' })
    await waitScene('IntroScene', 10000)
    await navToGame()
    lvBefore = (await state()).lives
  }
  const st0 = await state()
  if (st0.ok) {
    let placed = false
    try {
      placed = await page.evaluate(([px]) => {
        const s = window.__game.scene.getScene('GameScene')
        if (!s || !s.player) return false
        s.player.setPosition(px, 250); s.player.body.reset(px, 250); s.player.body.setVelocity(0, 0)
        return true
      }, [pit[0] + 4])
    } catch { placed = false }
    if (!placed) {
      check('trou : le joueur tombe et perd une vie', false, 'joueur indisponible')
    } else {
      await right.dispatchEvent('pointerdown'); await sleep(1400); await right.dispatchEvent('pointerup')
      let after = null
      const tD = Date.now() + 4000
      while (Date.now() < tD) { after = await state(); if (after.lives < lvBefore) break; await sleep(250) }
      check('trou : le joueur tombe et perd une vie', !!after && after.lives < lvBefore, `vies ${lvBefore}→${after?.lives}`)
    }
  } else {
    check('trou : le joueur tombe et perd une vie', false, 'impossible de relancer GameScene')
  }

  // --- Checkpoint : respawn positionné au dernier checkpoint touché ---
  const ck0 = await state()
  if (ck0.ok) {
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene')
      if (!s || !s.player) return
      const cps = s.checkpoints
      if (cps && cps.length) { const c = cps[1]; s.player.setPosition(c.x, c.y - 20); s.player.body.reset(c.x, c.y - 20) }
    }).catch(() => {})
    await sleep(900)
  }
  const ck = await state()
  check('checkpoint touché → point de respawn enregistré', ck.ok && ck.cpX !== null && ck.cpX > 0, `cpX=${ck.cpX}`)

  // --- Boss touchable dans la nouvelle arène ---
  if (ck.ok) {
    await page.evaluate(([bx, wpn]) => {
      const s = window.__game.scene.getScene('GameScene')
      if (!s || !s.player) return
      const x = (s.boss?.active ? s.boss.x : bx) - 90
      s.player.setPosition(x, 250); s.player.body.reset(x, 250); s.player.body.setVelocity(0, 0)
      s.player.facingRight = true
      // Le gardien ne se blesse qu'avec SON arme faible : on l'équipe pour le test.
      s.registry.set('weapons', [wpn])
      s.registry.set('weapon', wpn)
      if (s.player.addWe) s.player.addWe(99)
    }, [ents.bossX, WEAKNESS[STAGE] ?? 'buster']).catch(() => {})
    await sleep(400)
    for (let i = 0; i < 8; i++) { await tap('.tc-fire'); await sleep(300) }
  }
  const bh = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    return { hp: s?.boss?.active ? s.boss.getHealth() : -1 }
  }).catch(() => ({ hp: -1 }))
  check('boss touchable (HP baisse au tir)', bh.hp >= 0 && bh.hp < 30, `bossHp=${bh.hp}/30`)

  // En local, l'absence de binding Workers AI fait un 404 sur /api/ai : attendu.
  const relevantErrors = errors.filter((e) => !(e.includes('404') && BASE_URL.includes('localhost')))
  check('zéro erreur console/page', relevantErrors.length === 0, relevantErrors.slice(0, 3).join(' | ').slice(0, 200))

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} étapes OK`)
  process.exitCode = failed.length ? 1 : 0
} finally {
  await browser.close()
}
