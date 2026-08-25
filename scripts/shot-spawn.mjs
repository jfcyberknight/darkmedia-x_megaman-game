// Capture le joueur au spawn pour diagnostiquer un bug visuel.
// Usage : node scripts/shot-spawn.mjs [url]
import { chromium } from 'playwright'
const BASE_URL = process.argv[2] || 'http://localhost:5174/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 45000 })
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
  const rh = page.locator('.rh-play'); if (await rh.count()) await rh.dispatchEvent('pointerdown')
  const scenes = () => page.evaluate(() => {
    const g = window.__game
    return g ? g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key) : []
  })
  const t0 = Date.now()
  while (!(await scenes()).includes('GameScene') && Date.now() - t0 < 30000) { await page.keyboard.press('z'); await sleep(280) }
  await sleep(150) // pendant le beam d'apparition
  await page.screenshot({ path: 'scripts/preview/spawn-beam.png' })
  await sleep(1400) // beam dissipé, spawn posé
  await page.screenshot({ path: 'scripts/preview/spawn-local.png' })
  console.log('📸 spawn-beam.png / spawn-local.png — scenes:', (await scenes()).join(','))
} finally { await browser.close() }
