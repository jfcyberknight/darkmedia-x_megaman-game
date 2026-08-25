/**
 * Playthrough complet du niveau 1 — du spawn au STAGE CLEAR.
 * Phases : traversée en entrées tactiles réelles, checkpoint, mort/réapparition,
 * combat du WAR MACHINE (tir + esquives), absorption du noyau, retour sélection.
 *
 * Usage : node scripts/playthrough.mjs [url]
 */
import { chromium } from 'playwright'

const BASE_URL = process.argv[2] || 'https://megaman-game.pages.dev/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const results = []
const check = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`)
}

const browser = await chromium.launch()
try {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 }, // paysage : comme on recommande de jouer
    hasTouch: true,
    isMobile: true,
  })
  const page = await ctx.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()) })

  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 45000 })
  await page.waitForSelector('#touch-ui .tc-jump', { timeout: 20000 })
  const rh = page.locator('.rh-play')
  if (await rh.count()) await rh.dispatchEvent('pointerdown')

  const scenes = () =>
    page.evaluate(() => {
      const g = window.__game
      return g ? g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key) : []
    })
  const waitScene = async (key, ms) => {
    const t0 = Date.now()
    while (Date.now() - t0 < ms) {
      if ((await scenes()).includes(key)) return true
      await sleep(200)
    }
    return false
  }
  const S = () => `window.__game.scene.getScene('GameScene')`
  const state = () =>
    page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene')
      return {
        x: Math.round(s.player?.x ?? -1),
        y: Math.round(s.player?.y ?? -1),
        hp: s.player?.getHealth() ?? -1,
        lives: s.registry.get('lives'),
        cp: s.registry.get('cp') === true,
        power: s.registry.get('power') === true,
        bossActive: s.bossActive === true,
        bossHp: s.boss?.active ? s.boss.getHealth() : 0,
        enemies: s.enemies.countActive(true),
      }
    })
  const hold = async (sel, ms) => {
    await page.locator(sel).first().dispatchEvent('pointerdown')
    await sleep(ms)
    await page.locator(sel).first().dispatchEvent('pointerup')
  }
  const tap = async (sel) => hold(sel, 120)

  // --- Navigation jusqu'au niveau (attentes explicites entre écrans) ---
  await waitScene('IntroScene', 10000)
  for (let i = 0; i < 14 && !(await scenes()).includes('TitleScene'); i++) await tap('.tc-fire')
  check('TitleScene atteinte', (await scenes()).includes('TitleScene'))
  await tap('.tc-jump')
  check('StageSelectScene atteinte', await waitScene('StageSelectScene', 6000))
  await sleep(500)
  await tap('.tc-jump')
  check('arrivée dans GameScene', await waitScene('GameScene', 8000))
  await sleep(1200)

  // --- Phase A : traversée en entrées réelles (▶ maintenu + sauts + tirs) ---
  await page.locator('.tc-dir:nth-child(2)').dispatchEvent('pointerdown') // ▶
  const t0 = Date.now()
  while (Date.now() - t0 < 8000) {
    await tap('.tc-fire')
    await hold('.tc-jump', 260) // saut variable
    await sleep(160)
  }
  await page.locator('.tc-dir:nth-child(2)').dispatchEvent('pointerup')
  let st = await state()
  check('traversée réelle : progression + combat', st.x > 120 || st.enemies < 8,
    `x=${st.x}, hp=${st.hp}, vies=${st.lives}, ennemis restants=${st.enemies}`)

  // --- Checkpoint ---
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    s.player.setPosition(400, 250)
    s.player.body.reset(400, 250)
  })
  await sleep(800)
  st = await state()
  check('checkpoint activé (x=400)', st.cp)

  // --- Mort / réapparition au checkpoint ---
  const livesBefore = st.lives
  await page.evaluate(() => window.__game.scene.getScene('GameScene').player.takeDamage(99, -1))
  await sleep(2600) // anim mort + restart + fade
  check('GameScene relancée après mort', await waitScene('GameScene', 6000))
  await sleep(800)
  st = await state()
  check('réapparition au checkpoint', st.cp && Math.abs(st.x - 400) < 60, `x=${st.x}`)
  check('une vie perdue', st.lives === livesBefore - 1, `vies=${st.lives}`)

  // --- Boss : déclenchement + combat ---
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    s.player.setPosition(680, 200)
    s.player.body.reset(680, 200)
  })
  await sleep(3200) // retombée + WARNING
  st = await state()
  check('WAR MACHINE déclenché', st.bossActive && st.bossHp > 0, `bossHp=${st.bossHp}`)
  await page.screenshot({ path: new URL('../scripts/preview/playthrough-boss.png', import.meta.url).pathname })

  const fightStart = Date.now()
  let lastHp = st.bossHp
  let won = false
  while (Date.now() - fightStart < 150000) {
    st = await state()
    if (!st.bossActive && st.power) { won = true; break }
    if (!st.bossActive && !st.power) {
      // boss mort, noyau pas encore absorbé : y aller
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('GameScene')
        s.player.setPosition(738, 246)
        s.player.body.reset(738, 246)
      })
      await sleep(700)
      st = await state()
      if (st.power) { won = true; break }
    }
    if (st.lives <= 0) break
    // Respawn (checkpoint) ou joueur égaré : replacer face au boss
    if (st.x < 655) {
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('GameScene')
        s.player.setPosition(680, 200)
        s.player.body.reset(680, 200)
      })
      await sleep(500)
      st = await state()
    }
    // S'orienter vers le boss (le tir part dans la direction regardée)
    const facing = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene')
      const b = s.boss, p = s.player
      return { bx: b?.active ? b.x : 740, px: p.x, ai: b?.aiState ?? 'walk' }
    })
    const dirBtn = facing.bx >= facing.px ? '.tc-dir:nth-child(2)' : '.tc-dir:nth-child(1)'
    await hold(dirBtn, 60) // 60 ms = oriente sans déplacer significativement
    // Esquive : sauter pendant le slam du boss (ondes au sol)
    if (facing.ai === 'slam' || facing.ai === 'rest') await hold('.tc-jump', 240)
    await tap('.tc-fire')
    // Garder ses distances : si le boss est collé, reculer brièvement
    if (Math.abs(facing.bx - facing.px) < 55) {
      await hold(facing.bx >= facing.px ? '.tc-dir:nth-child(1)' : '.tc-dir:nth-child(2)', 320)
    }
    if (st.bossHp !== lastHp) lastHp = st.bossHp
    await sleep(100)
  }
  st = await state()
  check('boss vaincu + noyau absorbé', won, `bossHp=${st.bossHp}, power=${st.power}, vies=${st.lives}`)
  await page.screenshot({ path: new URL('../scripts/preview/playthrough-clear.png', import.meta.url).pathname })

  // --- STAGE CLEAR → retour sélection ---
  check('retour automatique à StageSelectScene', await waitScene('StageSelectScene', 9000))

  // --- Santé de la page ---
  check('zéro erreur console/page', errors.length === 0,
    errors.slice(0, 3).join(' | ').slice(0, 220))

  const failed = results.filter((r) => !r.ok)
  console.log(`\n${results.length - failed.length}/${results.length} étapes OK`)
  process.exitCode = failed.length ? 1 : 0
} finally {
  await browser.close()
}
