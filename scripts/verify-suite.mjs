// Vérifie les nouveautés : textures compagnon, HUD icônes, difficulté du stage.
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://localhost:5174/'
const STAGE_IDX = Number(process.argv[3] || '0')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true })
  const page = await ctx.newPage()
  const errors = []
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })
  await page.goto(BASE, { waitUntil: 'load', timeout: 45000 })
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
  const rh = page.locator('.rh-play'); if (await rh.count()) await rh.dispatchEvent('pointerdown')
  const scenes = () => page.evaluate(() => window.__game.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key))
  const wait = async (key, ms) => { const t = Date.now(); while (Date.now() - t < ms) { if ((await scenes()).includes(key)) return true; await sleep(150) } return false }
  await wait('IntroScene', 10000)
  let t = Date.now()
  while (!(await scenes()).includes('StageSelectScene') && Date.now() - t < 25000) { await page.keyboard.press('z'); await sleep(300) }
  await sleep(500)
  await page.evaluate((idx) => {
    const s = window.__game.scene.getScene('StageSelectScene')
    if (s) { s.selected = idx; s.confirm() }
  }, STAGE_IDX)
  const inGame = await wait('GameScene', 10000)
  console.log('GameScene:', inGame)
  await sleep(900)

  const state = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const tex = (k) => s.textures.exists(k)
    const icons = s.compIcons || []
    return {
      stage: s.stage?.id,
      diff: s.diff,
      bossMaxHp: s.boss?.getMaxHealth?.(),
      compSignature: s.compSignature,
      iconsCount: icons.length,
      firstIcon: icons[0] ? { visible: icons[0].visible, tex: icons[0].texture?.key } : null,
      tex: {
        orionShot: tex('comp-orion-shot'), novaMissile: tex('comp-nova-missile'),
        boltField: tex('comp-bolt-field'), muzzle: tex('comp-muzzle'),
        iconTir: tex('icon-tir'), iconSoin: tex('icon-soin'),
      },
    }
  })
  console.log('stage:', state.stage)
  console.log('diff:', JSON.stringify(state.diff))
  console.log('bossMaxHp:', state.bossMaxHp, '| compSignature:', state.compSignature)
  console.log('icons:', state.iconsCount, '| first:', JSON.stringify(state.firstIcon))
  console.log('textures:', JSON.stringify(state.tex))

  // Laisser ORION tirer puis inspecter les balles du compagnon.
  await sleep(3200)
  const bullets = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    return s.bullets.getChildren().filter((b) => b.active).map((b) => b.texture?.key)
  })
  console.log('balles compagnon (textures):', JSON.stringify(bullets))
  const hasCompShot = bullets.includes('comp-orion-shot')
  console.log(`${hasCompShot ? '✅' : '❌'} tir compagnon ORION avec sprite distinct (comp-orion-shot)`)
  console.log(`${state.firstIcon?.visible && state.firstIcon?.tex === 'icon-tir' ? '✅' : '❌'} HUD icônes : première icône visible (icon-tir)`)
  console.log(`${Object.values(state.tex).every(Boolean) ? '✅' : '❌'} toutes les textures compagnon/icônes chargées`)
  console.log(`erreurs console: ${errors.length ? JSON.stringify(errors) : 'aucune'}`)
} finally { await browser.close() }
