// Vérifie le pouvoir de combat (signature) du compagnon + collecte de capsule.
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
  const st = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const hud = s.compHud ? s.compHud.text : ''
    return { comp: s.registry.get('companion'), sig: s.compSignature, hud }
  })
  console.log(`compagnon: ${st.comp} | signature: ${st.sig} | HUD: "${st.hud}"`)
  console.log(`${st.sig === 'tir' ? '✅' : '❌'} ORION (défaut) -> signature TIR`)
  // collecter une capsule (soin)
  const caps = await page.evaluate(() => window.__game.scene.getScene('GameScene').ents.capsules ?? [])
  const cap = caps.find((c) => c.type === 'soin') ?? caps[0]
  await page.evaluate(([x, y]) => { const s = window.__game.scene.getScene('GameScene'); s.player.setPosition(x, y); s.player.body.reset(x, y) }, [cap.x, cap.y])
  await sleep(700)
  const st2 = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    return { powers: s.registry.get('companionPowers'), hud: s.compHud.text }
  })
  console.log(`après capsule ${cap.type} -> pouvoirs: ${JSON.stringify(st2.powers)} | HUD: "${st2.hud}"`)
  console.log(`${(st2.powers ?? []).includes(cap.type) ? '✅' : '❌'} support '${cap.type}' accordé`)
} finally { await browser.close() }
