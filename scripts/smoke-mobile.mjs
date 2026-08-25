/**
 * Smoke test mobile de bout en bout — pilote le jeu UNIQUEMENT via les
 * boutons virtuels DOM (#touch-ui), comme un vrai téléphone.
 *
 * Usage : node scripts/smoke-mobile.mjs [url]
 * Vérifie : overlay tactile présent, navigation Boot→Intro→Titre→Sélection→
 * GameScene au pad, déplacement du joueur en jeu, musique lancée, zéro erreur
 * console. Screenshots dans scripts/preview/.
 */
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE_URL = process.argv[2] || 'https://megaman-game.pages.dev/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
mkdirSync(new URL('../scripts/preview/', import.meta.url), { recursive: true })

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra })
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`)
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => consoleErrors.push(String(e)))

  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 45000 })

  // 1. Overlay tactile présent et complet
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
  const btns = await page.locator('.tc-btn').count()
  check('overlay tactile visible', btns === 4, `${btns}/4 boutons (◀ ▶ B A)`)

  const activeScenes = () =>
    page.evaluate(() => {
      const g = window.__game
      return g ? g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key) : []
    })
  const waitForScene = async (key, ms) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      if ((await activeScenes()).includes(key)) return true
      await sleep(200)
    }
    return false
  }
  const pressBtn = async (sel) => {
    const el = page.locator(sel).first()
    await el.dispatchEvent('pointerdown')
    await sleep(140)
    await el.dispatchEvent('pointerup')
    await sleep(160)
  }

  // 2. Boot → Intro (auto après le splash)
  const intro = await waitForScene('IntroScene', 10000)
  check('BootScene → IntroScene (auto)', intro)

  // 3. Intro → Titre en martelant B (1er tap = fin du typing, suivant = avance)
  let title = false
  for (let i = 0; i < 14 && !title; i++) {
    await pressBtn('.tc-fire')
    title = await waitForScene('TitleScene', 400)
  }
  check('Intro avancée avec B → TitleScene', title)
  await page.screenshot({ path: new URL('../scripts/preview/smoke-title.png', import.meta.url).pathname })

  // 4. Titre → Sélection avec A
  await pressBtn('.tc-jump')
  check('TitleScene démarrée avec A → StageSelectScene',
    await waitForScene('StageSelectScene', 6000))

  // 5. ◀▶ bougent la sélection (vérifie le curseur), puis A lance le stage
  const cx0 = await page.evaluate(() => {
    const s = window.__game?.scene.getScene('StageSelectScene')
    return s?.cursor?.x ?? null
  })
  await pressBtn('.tc-dir:nth-child(2)') // ▶
  await sleep(350)
  const cx1 = await page.evaluate(() => {
    const s = window.__game?.scene.getScene('StageSelectScene')
    return s?.cursor?.x ?? null
  })
  check('◀▶ déplacent la sélection', typeof cx0 === 'number' && cx1 !== cx0, `${cx0} → ${cx1}`)
  await page.screenshot({ path: new URL('../scripts/preview/smoke-select.png', import.meta.url).pathname })

  await pressBtn('.tc-jump')
  check('Stage confirmé avec A → GameScene', await waitForScene('GameScene', 8000))
  await sleep(1200) // briefing/fade-in

  // 6. Gameplay : maintenir ▶ fait avancer le joueur, A fait sauter
  const getX = () => page.evaluate(() => window.__game?.scene.getScene('GameScene')?.player?.x ?? null)
  const x0 = await getX()
  await page.locator('.tc-dir:nth-child(2)').dispatchEvent('pointerdown') // ▶ maintenu
  await sleep(900)
  const x1 = await getX()
  const vy = await page.evaluate(
    () => Math.round(window.__game?.scene.getScene('GameScene')?.player?.body?.velocity.y ?? 999),
  )
  await page.locator('.tc-dir:nth-child(2)').dispatchEvent('pointerup')
  check('▶ maintenu déplace le joueur', typeof x0 === 'number' && x1 > x0, `x ${Math.round(x0)} → ${Math.round(x1)}`)
  check('gravité/physique actives', vy === 0 || Math.abs(vy) < 500, `vy=${vy}`)

  // 7. Musique du stage lancée (séquenceur)
  const track = await page.evaluate(() => window.__track?.() ?? null)
  check('musique de stage démarrée', track === 'stage', `track=${track}`)
  await page.screenshot({ path: new URL('../scripts/preview/smoke-game.png', import.meta.url).pathname })

  // 8. Aucune erreur console/page
  check('zéro erreur console', consoleErrors.length === 0,
    consoleErrors.slice(0, 3).join(' | ').slice(0, 200))

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} vérifications OK`)
  process.exitCode = failed.length ? 1 : 0
} finally {
  await browser.close()
}
