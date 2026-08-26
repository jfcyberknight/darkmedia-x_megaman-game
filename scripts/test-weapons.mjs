// Vérifie que vaincre le boss accorde SON pouvoir (arme) et qu'il est équipable.
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://localhost:5174/'
const STAGE = process.argv[3] || 'neon-city'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 475 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  await page.goto(BASE, { waitUntil: 'load', timeout: 45000 })
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
  const rh = page.locator('.rh-play'); if (await rh.count()) await rh.dispatchEvent('pointerdown')
  const scenes = () => page.evaluate(() => window.__game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key))
  const t0 = Date.now()
  while (!(await scenes()).includes('GameScene') && Date.now() - t0 < 30000) { await page.keyboard.press('z'); await sleep(280) }
  await sleep(800)

  // Tuer le boss (assist) -> noyau -> absorption
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const x = (s.boss?.active ? s.boss.x : s.ents.bossX) - 60
    s.player.setPosition(x, 250); s.player.body.reset(x, 250); s.player.body.setVelocity(0, 0)
  })
  await sleep(400)
  await page.evaluate(() => { const b = window.__game.scene.getScene('GameScene').boss; if (b?.active) { b.invulnerable = false; b.takeDamage(999) } })
  // attendre la séquence de mort (~2.2s) puis collecter le noyau
  for (let i = 0; i < 40; i++) {
    const got = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene')
      const core = s.orbs.getChildren().find((o) => o.active && o.getData('kind') === 'core')
      if (!core) return false
      s.player.setPosition(core.x - 20, core.y); s.player.body.reset(core.x - 20, core.y)
      return true
    })
    if (got) break
    await sleep(150)
  }
  await sleep(1200)
  const st = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    return { weapon: s.registry.get('weapon'), owned: s.registry.get('weapons'), power: s.registry.get('power') }
  })
  console.log(`arme absorbée: ${st.weapon} | possédées: ${JSON.stringify(st.owned)} | power=${st.power}`)
  console.log(`${st.weapon === 'ram' ? '✅' : '❌'} le boss neon-city (RAM-9) donne RAM SHOT`)

  // Menu pause : l'arme doit apparaître et être équipable
  await page.locator('.tc-pause').dispatchEvent('pointerdown'); await sleep(300)
  const rows = await page.evaluate(() => window.__game.scene.getScene('PauseScene').rows.map((r) => r.label))
  console.log(`armes dans le menu pause: ${JSON.stringify(rows)}`)
  console.log(`${rows.includes('RAM SHOT') ? '✅' : '❌'} RAM SHOT listé dans le menu pause`)
} finally { await browser.close() }
