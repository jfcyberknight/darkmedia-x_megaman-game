// Navigue vers un stage donné (index) et vérifie que le boss apparaît.
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://localhost:5174/'
const STAGE_IDX = Number(process.argv[3] || '1') // 1 = toxic-plant (index 1)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load', timeout: 45000 })
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
  const rh = page.locator('.rh-play'); if (await rh.count()) await rh.dispatchEvent('pointerdown')
  const scenes = () => page.evaluate(() => window.__game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key))
  const wait = async (key, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await scenes()).includes(key)) return true; await sleep(150) } return false }
  await wait('IntroScene', 10000)
  // avancer jusqu'à l'écran de sélection
  let t = Date.now()
  while (!(await scenes()).includes('StageSelectScene') && Date.now() - t < 25000) { await page.keyboard.press('z'); await sleep(300) }
  await sleep(500)
  // sélection fiable : forcer l'index + confirmer via la scène (pas de flèches flaky)
  await page.evaluate((idx) => {
    const s = window.__game.scene.getScene('StageSelectScene')
    if (s) { s.selected = idx; s.confirm() }
  }, STAGE_IDX)
  const inGame = await wait('GameScene', 10000)
  console.log('GameScene:', inGame, '| scènes:', (await scenes()).join(','))
  await sleep(800)
  const st = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const b = s.boss
    return { stage: s.stage?.id, boss: !!b, bx: b?.active ? Math.round(b.x) : null, warnX: s.ents?.bossWarnX, bossIntro: s.bossIntroDone, texture: b?.texture?.key }
  })
  console.log('stage:', st.stage, '| boss existe:', st.boss, '| pos:', st.bx, '| warnX:', st.warnX, '| texture:', st.texture)
  // téléporter APRÈS le warn pour déclencher le boss
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const x = (s.ents.bossWarnX ?? 2800) + 60
    s.player.setPosition(x, 250); s.player.body.reset(x, 250); s.player.body.setVelocity(0, 0)
  })
  await sleep(2200)
  const st2 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const b = s.boss
    return { bossIntro: s.bossIntroDone, bossActive: s.bossActive, bx: b?.active ? Math.round(b.x) : null }
  })
  await page.screenshot({ path: 'scripts/preview/boss-stage.png' })
  console.log(`après warn -> bossIntro=${st2.bossIntro}, bossActive=${st2.bossActive}, boss x=${st2.bx}`)
  console.log(`${st2.bossIntro && st2.bossActive ? '✅' : '❌'} boss du stage ${STAGE_IDX} déclenché`)
} finally { await browser.close() }
