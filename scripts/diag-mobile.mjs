/**
 * Diagnostic gameplay — vérifie mécaniquement les mécaniques clés dans
 * GameScene : saut, tir (spawn de balle), dégât de contact, balle qui tue.
 * Optionnel : throttle CPU (CDP) pour simuler un téléphone faible.
 *
 * Usage : node scripts/diag-mobile.mjs [url] [cpuThrottle]
 */
import { chromium } from 'playwright'

const BASE_URL = process.argv[2] || 'https://megaman-game.pages.dev/'
const THROTTLE = Number(process.argv[3] || '1')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 45000 })

  if (THROTTLE > 1) {
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
  }

  // Masque l'invite de rotation si présente
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
  const rh = page.locator('.rh-play')
  if (await rh.count()) await rh.dispatchEvent('pointerdown')

  const scenes = () =>
    page.evaluate(() => {
      const g = window.__game
      return g ? g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key) : []
    })
  const waitScene = async (key, ms) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      if ((await scenes()).includes(key)) return true
      await sleep(200)
    }
    return false
  }
  const tap = async (sel) => {
    const el = page.locator(sel).first()
    await el.dispatchEvent('pointerdown')
    await sleep(120)
    await el.dispatchEvent('pointerup')
    await sleep(140)
  }

  // Boot → Intro → Titre → Sélection → Jeu
  await waitScene('IntroScene', 10000)
  for (let i = 0; i < 14 && !(await scenes()).includes('TitleScene'); i++) await tap('.tc-fire')
  await tap('.tc-jump') // titre → sélection
  await sleep(400)
  await tap('.tc-jump') // confirmation
  const inGame = await waitScene('GameScene', 8000)
  console.log(`GameScene atteinte: ${inGame}`)
  if (!inGame) process.exit(1)
  await sleep(1000)

  // FPS mesuré
  const fps = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0
        const t0 = performance.now()
        const f = () => {
          n++
          if (performance.now() - t0 < 1000) requestAnimationFrame(f)
          else res(n)
        }
        requestAnimationFrame(f)
      }),
  )
  console.log(`FPS mesuré: ${fps}`)

  const S = () => `window.__game.scene.getScene('GameScene')`

  // --- 1. Saut ---
  await page.locator('.tc-jump').dispatchEvent('pointerdown')
  await sleep(90)
  const vy = await page.evaluate(() => Math.round(window.__game.scene.getScene('GameScene').player.body.velocity.y))
  await page.locator('.tc-jump').dispatchEvent('pointerup')
  console.log(`Saut: vy=${vy} (attendu < 0) -> ${vy < 0 ? 'OK' : 'FAIL'}`)

  // --- 2. Tir : une balle doit exister après un tap B ---
  await sleep(700) // retombe + cooldown
  const bulletsBefore = await page.evaluate(() => window.__game.scene.getScene('GameScene').bullets.countActive(true))
  await tap('.tc-fire')
  await sleep(150)
  const bulletsAfter = await page.evaluate(() => window.__game.scene.getScene('GameScene').bullets.countActive(true))
  console.log(`Tir: balles actives ${bulletsBefore} → ${bulletsAfter} -> ${bulletsAfter > bulletsBefore ? 'OK' : 'FAIL'}`)

  // --- 3. Dégât de contact : téléport AU SOL face à un walker (corps qui
  // se chevauchent : demi-largeurs 6 + 11 = 17 > distance 12) ---
  const hp0 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const e = s.enemies.getFirstAlive()
    const x = e.x - 12
    const y = e.y - 2 // aligne le bas du corps joueur sur celui de l'ennemi
    s.player.setPosition(x, y)
    s.player.body.reset(x, y)
    s.player.body.setVelocity(0, 0)
    return s.player.getHealth()
  })
  await sleep(1400)
  const hp1 = await page.evaluate(() => window.__game.scene.getScene('GameScene').player.getHealth())
  console.log(`Contact: HP ${hp0} → ${hp1} -> ${hp1 < hp0 ? 'OK' : 'FAIL (passe au travers !)'}`)

  // --- 4. Balle tue l'ennemi : tir en face à face ---
  const killed = await page.evaluate(async () => {
    const s = window.__game.scene.getScene('GameScene')
    const e = s.enemies.getFirstAlive()
    if (!e) return 'no-enemy'
    s.player.setPosition(e.x - 36, e.y - 2)
    s.player.body.reset(e.x - 36, e.y - 2)
    return null
  })
  for (let i = 0; i < 4; i++) {
    await tap('.tc-fire')
    await sleep(450)
  }
  const enemyAlive = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const e = s.enemies.getFirstAlive()
    // l'ennemi visé (le plus proche du joueur à gauche) — on teste simplement
    // qu'AU MOINS un ennemi est mort depuis le début du diagnostic
    return { alive: s.enemies.countActive(true), total: s.enemies.getLength() }
  })
  console.log(`Balle→ennemi: restants ${enemyAlive.alive}/${enemyAlive.total} -> ${enemyAlive.alive < enemyAlive.total ? 'OK' : 'FAIL'} ${killed ?? ''}`)

  if (errors.length) console.log('PAGE ERRORS:', errors.slice(0, 3).join(' | '))
} finally {
  await browser.close()
}
