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
const plateformes = [
  ['A x96-144 y224', 120, 211],
  ['B x192-240 y192', 216, 179],
  ['C x288-352 y160', 320, 147],
  ['D x464-496 y192', 480, 179],
  ['E x544-592 y144', 568, 131],
  ['F x672-704 y176', 688, 163],
]
let fails = 0
for (const [nom, x, py] of plateformes) {
  for (const dir of ['droite', 'gauche']) {
    await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene')
      s.bullets.getChildren().forEach((b) => { if (b.active) b.disableBody(true, true) })
    })
    const px = dir === 'droite' ? x - 8 : x + 8 // laisser la place de voler
    await page.evaluate(({ px, py }) => {
      const s = window.__game.scene.getScene('GameScene')
      s.player.setPosition(px, py); s.player.body.reset(px, py)
    }, { px, py })
    const btn = dir === 'droite' ? '.tc-dir:nth-child(2)' : '.tc-dir:nth-child(1)'
    let el = page.locator(btn).first(); await el.dispatchEvent('pointerdown'); await sleep(130); await el.dispatchEvent('pointerup')
    el = page.locator('.tc-fire').first(); await el.dispatchEvent('pointerdown'); await sleep(130); await el.dispatchEvent('pointerup')
    let maxDist = 0
    const tEnd = Date.now() + 2200
    while (Date.now() - tEnd < 2200) {
      const r = await page.evaluate(() => {
        const s = window.__game.scene.getScene('GameScene')
        const b = s.bullets.getChildren().find((x) => x.active)
        return b ? Math.round(Math.abs(b.x - b.spawnX)) : -1
      })
      if (r < 0) break
      maxDist = Math.max(maxDist, r)
      await sleep(120)
    }
    const ok = maxDist >= 100
    if (!ok) fails++
    console.log(`${nom} ${dir}: ${maxDist}px ${ok ? '✓' : '⚠️'}`)
  }
}
console.log(fails === 0 ? 'TOUS OK' : `${fails} échecs`)
await browser.close()
