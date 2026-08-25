// Capture une balle du joueur en vol + le HUD (vérif thème rouge).
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
  // tirer quelques balles vers la droite et capturer
  const fire = page.locator('.tc-fire')
  await fire.dispatchEvent('pointerdown'); await fire.dispatchEvent('pointerup')
  await sleep(180)
  await page.screenshot({ path: 'scripts/preview/bullet-shot.png' })
  console.log('📸 bullet-shot.png')
} finally { await browser.close() }
