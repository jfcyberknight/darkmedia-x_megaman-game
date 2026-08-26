// Vérifie que collecter une capsule accorde un pouvoir de compagnon.
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://localhost:5174/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load', timeout: 45000 })
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
  const rh = page.locator('.rh-play'); if (await rh.count()) await rh.dispatchEvent('pointerdown')
  const scenes = () => page.evaluate(() => window.__game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key))
  const t0 = Date.now()
  while (!(await scenes()).includes('GameScene') && Date.now() - t0 < 30000) { await page.keyboard.press('z'); await sleep(280) }
  await sleep(800)
  // lire les capsules du niveau et aller en collecter une
  const caps = await page.evaluate(() => window.__game.scene.getScene('GameScene').ents.capsules ?? [])
  console.log('capsules du niveau:', JSON.stringify(caps.map((c) => c.type)))
  const first = caps[0]
  await page.evaluate(([x, y]) => {
    const s = window.__game.scene.getScene('GameScene')
    s.player.setPosition(x, y); s.player.body.reset(x, y)
  }, [first.x, first.y])
  await sleep(800)
  const st = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    return { powers: s.registry.get('companionPowers') }
  })
  console.log(`pouvoirs du compagnon: ${JSON.stringify(st.powers)}`)
  console.log(`${(st.powers ?? []).includes(first.type) ? '✅' : '❌'} capsule '${first.type}' accordée`)
} finally { await browser.close() }
