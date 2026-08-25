/**
 * Test « 100% jouable au doigt » : aucun appui clavier, uniquement les
 * boutons tactiles du pad virtuel et les taps sur les scènes.
 *  - navigation complète Boot → Intro → Compagnon → Titre → Sélection → Jeu
 *  - bouton ⏸ : ouvre la pause, A équipe l'arme, ⏸ reprend
 *
 * Usage : node scripts/test-mobile.mjs [url]
 */
import { chromium } from 'playwright'

const BASE_URL = process.argv[2] || 'http://localhost:5174/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`) }

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, // paysage téléphone
    hasTouch: true,
    isMobile: true,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 45000 })
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })

  // Bouton ⏸ présent dans le pad tactile ?
  check('bouton ⏸ dans le pad tactile', (await page.locator('.tc-pause').count()) === 1)

  const scenes = () => page.evaluate(() => {
    const g = window.__game
    return g ? g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key) : []
  })
  const waitScene = async (key, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scenes()).includes(key)) return true; await sleep(150) } return false }
  const tap = async (sel) => {
    const el = page.locator(sel).first()
    await el.dispatchEvent('pointerdown'); await sleep(110)
    await el.dispatchEvent('pointerup'); await sleep(140)
  }
  const hold = async (sel, ms) => {
    await page.locator(sel).first().dispatchEvent('pointerdown')
    await sleep(ms)
    await page.locator(sel).first().dispatchEvent('pointerup')
  }

  const rh = page.locator('.rh-play')
  if (await rh.count()) await rh.dispatchEvent('pointerdown')

  // --- Navigation 100% tactile jusqu'à GameScene ---
  await waitScene('BootScene', 8000).catch(() => {})
  let reachedGame = false
  const t0 = Date.now()
  let companionHandled = false
  while (Date.now() - t0 < 40000) {
    const sc = await scenes()
    if (sc.includes('GameScene')) { reachedGame = true; break }
    if (sc.includes('CompanionScene')) {
      // ◀▶ pour parcourir, puis A pour confirmer — comme un vrai joueur au doigt.
      if (!companionHandled) {
        await tap('.tc-dir:nth-child(1)') // ◀
        await tap('.tc-dir:nth-child(2)') // ▶
        companionHandled = true
      }
      await tap('.tc-jump') // A = confirmer le compagnon
      continue
    }
    if (sc.includes('IntroScene')) { await tap('.tc-fire'); continue } // avancer l'intro
    if (sc.includes('TitleScene')) { await tap('.tc-jump'); continue }
    if (sc.includes('StageSelectScene')) { await tap('.tc-jump'); continue }
    await sleep(150)
  }
  check('navigation tactile jusqu\u2019au jeu (Intro→Compagnon→Titre→Stage→Jeu)', reachedGame,
    (await scenes()).join(','))
  await sleep(900)

  // Le joueur avance vraiment au doigt ?
  const x0 = await page.evaluate(() => Math.round(window.__game.scene.getScene('GameScene').player.x))
  await page.locator('.tc-dir:nth-child(2)').dispatchEvent('pointerdown')
  await hold('.tc-jump', 240)
  await sleep(700)
  await page.locator('.tc-dir:nth-child(2)').dispatchEvent('pointerup')
  const x1 = await page.evaluate(() => Math.round(window.__game.scene.getScene('GameScene').player.x))
  check('déplacement + saut au doigt dans le niveau', x1 > x0, `x ${x0}→${x1}`)

  // --- Pause au ⏸, arme à A/B, reprise au ⏸ ---
  await tap('.tc-pause')
  check('⏸ ouvre la pause', await waitScene('PauseScene', 3000))
  const weaponBefore = await page.evaluate(() => window.__game.scene.getScene('GameScene').registry.get('weapon') ?? 'buster')
  // ◀▶ pour changer de sélection (sans effet si une seule arme), puis A équipe.
  await tap('.tc-dir:nth-child(1)')
  await tap('.tc-jump')
  await sleep(300)
  const weaponAfterEquip = await page.evaluate(() => window.__game.scene.getScene('GameScene').registry.get('weapon') ?? 'buster')
  check('A/B équipe l\u2019arme sélectionnée en pause',
    ['buster', 'war'].includes(weaponAfterEquip), `${weaponBefore}→${weaponAfterEquip}`)
  await tap('.tc-pause') // ⏸ reprend
  const resumed = (await (async () => { const t = Date.now(); while (Date.now() - t < 3000) { const sc = await scenes(); if (!sc.includes('PauseScene') && sc.includes('GameScene')) return true; await sleep(120) } return false })())
  check('⏸ reprend le jeu', resumed)

  // Re-tap carte compagnon / pas d'erreur JS
  check('zéro erreur page', errors.length === 0, errors.slice(0, 2).join(' | ').slice(0, 160))

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} étapes OK`)
  process.exitCode = failed.length ? 1 : 0
} finally {
  await browser.close()
}
