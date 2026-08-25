import { chromium } from 'playwright'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
await page.goto('https://megaman-game.pages.dev/?cb=' + Date.now(), { waitUntil: 'load' })
await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
const rh = page.locator('.rh-play'); if (await rh.count()) await rh.dispatchEvent('pointerdown')
const scenes = () => page.evaluate(() => window.__game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key))
let nav0 = Date.now()
while (!(await scenes()).some((k) => k === 'TitleScene' || k === 'StageSelectScene') && Date.now() - nav0 < 15000) {
  const el = page.locator('.tc-fire').first(); await el.dispatchEvent('pointerdown'); await sleep(120); await el.dispatchEvent('pointerup'); await sleep(150)
}
if ((await scenes()).includes('TitleScene')) { const el = page.locator('.tc-jump').first(); await el.dispatchEvent('pointerdown'); await sleep(120); await el.dispatchEvent('pointerup'); await sleep(500) }
{ const el = page.locator('.tc-jump').first(); await el.dispatchEvent('pointerdown'); await sleep(120); await el.dispatchEvent('pointerup') }
const t0 = Date.now(); while (!(await scenes()).includes('GameScene') && Date.now() - t0 < 8000) await sleep(200)
await sleep(800)
await page.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene')
  s.enemies.getChildren().forEach((e) => e.disableBody(true, true))
})

for (let essai = 1; essai <= 6; essai++) {
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    s.bullets.getChildren().forEach((b) => { if (b.active) b.disableBody(true, true) })
    s.player.setPosition(320, 147); s.player.body.reset(320, 147)
  })
  let el = page.locator('.tc-dir:nth-child(2)').first(); await el.dispatchEvent('pointerdown'); await sleep(130); await el.dispatchEvent('pointerup')
  el = page.locator('.tc-fire').first(); await el.dispatchEvent('pointerdown'); await sleep(130); await el.dispatchEvent('pointerup')
  let maxDist = 0, samples = []
  const tEnd = Date.now() + 2000
  while (Date.now() - tEnd < 2000) {
    const r = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene')
      const b = s.bullets.getChildren().find((x) => x.active)
      if (!b) return { dead: true }
      return { dead: false, x: Math.round(b.x * 10) / 10, sx: Math.round(b.spawnX), bl: b.body.blocked.right }
    })
    if (r.dead) { samples.push('MORTE'); break }
    samples.push(Math.round(r.x - r.sx))
    maxDist = Math.max(maxDist, r.x - r.sx)
    await sleep(70)
  }
  console.log(`essai ${essai}: maxDist=${Math.round(maxDist)}px trace=${samples.join(',')}`)
}
await browser.close()
