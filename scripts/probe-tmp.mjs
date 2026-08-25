import { chromium } from 'playwright'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const page = await ctx.newPage()
const errs = []
page.on('pageerror', (e) => errs.push(String(e)))
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
await sleep(1000)

// Téléport couloir libre + tir + échantillonnage
await page.evaluate(() => {
  const s = window.__game.scene.getScene('GameScene')
  s.player.setPosition(340, 250); s.player.body.reset(340, 250)
})
await page.locator('.tc-dir:nth-child(1)').first().dispatchEvent('pointerdown'); await sleep(130); await page.locator('.tc-dir:nth-child(1)').first().dispatchEvent('pointerup')
const el = page.locator('.tc-fire').first()
await el.dispatchEvent('pointerdown'); await sleep(130); await el.dispatchEvent('pointerup')
for (const t of [100, 400, 900]) {
  await sleep(t === 100 ? 100 : 300)
  console.log(JSON.stringify(await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const w = s.physics.world
    const b = s.bullets.getChildren().find((x) => x.active)
    return {
      t: null, bullet: b ? { x: Math.round(b.x * 10) / 10, vx: Math.round(b.body.velocity.x), enable: b.body.enable } : null,
      stepsLastFrame: w.stepsLastFrame, fps: Math.round(w.fps), fixedStep: w.fixedStep,
      pVelocityX: Math.round(s.player.body.velocity.x),
    }
  })).replace('"t":null,', ''))
}
console.log('ERREURS:', errs.slice(0, 2).join(' | ') || 'aucune')
await browser.close()
