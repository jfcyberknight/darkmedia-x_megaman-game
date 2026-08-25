/**
 * Capture la séquence de destruction du boss (screenshots par phase).
 * Usage : node scripts/shot-boss-death.mjs [url]
 */
import { chromium } from 'playwright'

const BASE_URL = process.argv[2] || 'http://localhost:5174/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 45000 })
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
  const rh = page.locator('.rh-play')
  if (await rh.count()) await rh.dispatchEvent('pointerdown')

  const scenes = () => page.evaluate(() => {
    const g = window.__game
    return g ? g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key) : []
  })
  await sleep(1200)
  // nav clavier rapide jusqu'à GameScene
  const t0 = Date.now()
  while (!(await scenes()).includes('GameScene') && Date.now() - t0 < 30000) {
    await page.keyboard.press('z'); await sleep(280)
  }
  console.log('GameScene:', (await scenes()).includes('GameScene'))
  await sleep(800)

  // Téléporter près du boss et le tuer -> séquence de destruction
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const x = (s.boss?.active ? s.boss.x : s.ents.bossX) - 90
    s.player.setPosition(x, 250); s.player.body.reset(x, 250); s.player.body.setVelocity(0, 0)
  })
  await sleep(600)
  await page.evaluate(() => {
    const b = window.__game.scene.getScene('GameScene').boss
    if (b?.active) { b.invulnerable = false; b.takeDamage(999) }
  })

  const shot = async (name, waitMs) => { await sleep(waitMs); await page.screenshot({ path: `scripts/preview/${name}` }); console.log('📸', name) }
  await shot('boss-death-1-chaine.png', 750)   // explosions en chaîne
  await shot('boss-death-2-blast.png', 950)    // méga-blast + ondes + débris
  await shot('boss-death-3-noyau.png', 900)    // retombée + noyau
} finally {
  await browser.close()
}
