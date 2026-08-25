/** Debug ciblé : atteindre le boss puis instrumenter tir/impact. */
import { chromium } from 'playwright'

const BASE_URL = process.argv[2] || 'https://megaman-game.pages.dev/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 45000 })
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
  const rh = page.locator('.rh-play')
  if (await rh.count()) await rh.dispatchEvent('pointerdown')

  const scenes = () => page.evaluate(() => window.__game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key))
  const waitScene = async (key, ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await scenes()).includes(key)) return true; await sleep(200) } return false }
  const hold = async (sel, ms) => { const el = page.locator(sel).first(); await el.dispatchEvent('pointerdown'); await sleep(ms); await el.dispatchEvent('pointerup') }
  const tap = async (sel) => hold(sel, 120)

  await waitScene('IntroScene', 10000)
  let nav0 = Date.now()
  while (!(await scenes()).some((k) => k === 'TitleScene' || k === 'StageSelectScene') && Date.now() - nav0 < 15000) {
    await tap('.tc-fire')
  }
  if ((await scenes()).includes('TitleScene')) {
    await tap('.tc-jump')
    if (!(await waitScene('StageSelectScene', 8000))) throw new Error('pas de StageSelect')
  }
  if (!(await scenes()).includes('StageSelectScene')) throw new Error('pas de StageSelect')
  await sleep(600)
  await tap('.tc-jump')
  if (!(await waitScene('GameScene', 8000))) throw new Error('pas de GameScene')
  await page.waitForFunction(() => {
    const s = window.__game.scene.getScene('GameScene')
    return !!s.player && s.scene.isActive()
  }, { timeout: 10000 })
  await sleep(1000)

  // Skip : directement au boss (sans phase A) pour isoler le combat
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    s.player.setPosition(680, 200)
    s.player.body.reset(680, 200)
  })
  await sleep(3500) // chute + WARNING

  const dump = (label) =>
    page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene')
      const p = s.player
      const bullets = s.bullets.getChildren().filter((b) => b.active)
      return {
        px: Math.round(p.x), py: Math.round(p.y),
        facing: p.facingRight, charging: p.charging,
        groupLen: s.bullets.getLength(),
        bullets: bullets.map((b) => ({ x: Math.round(b.x), y: Math.round(b.y), vx: Math.round(b.body.velocity.x) })),
        boss: s.boss?.active ? { x: Math.round(s.boss.x), y: Math.round(s.boss.y), hp: s.boss.getHealth(), ai: s.boss.aiState } : null,
        intro: s.bossIntroDone,
      }
    })

  console.log(JSON.stringify(await dump('avant tir'), null, 1))
  await tap('.tc-fire')
  await sleep(250)
  console.log(JSON.stringify(await dump('après tap 1 (+250ms)'), null, 1))
  await tap('.tc-fire')
  await sleep(250)
  await tap('.tc-fire')
  await sleep(400)
  console.log(JSON.stringify(await dump('après taps 2-3'), null, 1))
  await sleep(1500)
  console.log(JSON.stringify(await dump('+1.5s'), null, 1))
  if (errors.length) console.log('PAGE ERRORS:', errors.slice(0, 3).join('|'))
} finally {
  await browser.close()
}
