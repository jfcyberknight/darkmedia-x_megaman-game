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

  // --- Navigation jusqu'au niveau (pilotée par l'état des scènes) ---
  await waitScene('IntroScene', 10000)
  let nav0 = Date.now()
  while (!(await scenes()).some((k) => k === 'TitleScene' || k === 'StageSelectScene') && Date.now() - nav0 < 15000) {
    await tap('.tc-fire')
  }
  if ((await scenes()).includes('TitleScene')) {
    await tap('.tc-jump')
    check('StageSelectScene atteinte', await waitScene('StageSelectScene', 6000))
  } else {
    check('StageSelectScene atteinte', (await scenes()).includes('StageSelectScene'))
  }
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
  await page.evaluate(() => {
    const p = window.__game.scene.getScene('GameScene').player
    p.invulnerable = false // test : ne pas tomber dans la fenêtre d'invuln. de la phase A
    p.takeDamage(99, -1)
  })
  // Attendre activement la décrément de vie (anim mort 950ms + restart 650ms)
  const tDeath = Date.now()
  let livesAfter = -1
  while (Date.now() - tDeath < 7000) {
    livesAfter = (await state()).lives
    if (livesAfter === livesBefore - 1) break
    await sleep(300)
  }
  check('GameScene relancée après mort', await waitScene('GameScene', 4000))
  await sleep(600)
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
  let won = false
  let loops = 0
  while (Date.now() - fightStart < 180000) {
    loops++
    st = await state()
    if (!st.bossActive && st.power) { won = true; break }
    if (!st.bossActive && !st.power) {
      // boss mort : aller chercher le noyau à sa position réelle
      const got = await page.evaluate(() => {
        const s = window.__game.scene.getScene('GameScene')
        const core = s.orbs.getChildren().find((o) => o.active && o.getData('kind') === 'core')
        if (!core) return false
        s.player.setPosition(core.x - 24, core.y)
        s.player.body.reset(core.x - 24, core.y)
        return true
      })
      if (!got) { await sleep(300); continue }
      await sleep(800)
      st = await state()
      if (st.power) { won = true; break }
    }
    if (st.lives <= 0) break
    // Respawn au checkpoint : replacer dans l'arène
    if (st.x < 390) {
      await page.evaluate(() => {
        const s = window.__game.scene.getScene('GameScene')
        s.player.setPosition(660, 200)
        s.player.body.reset(660, 200)
      })
      await sleep(600)
      continue
    }
    const f = await page.evaluate(() => {
      const s = window.__game.scene.getScene('GameScene')
      const b = s.boss, p = s.player
      return { bx: b?.active ? b.x : 740, px: p.x, ai: b?.aiState ?? 'walk' }
    })
    const right = '.tc-dir:nth-child(2)'
    const left = '.tc-dir:nth-child(1)'
    const faceBtn = f.bx >= f.px ? right : left
    const awayBtn = f.bx >= f.px ? left : right
    // Toujours tirer : charge de ~1 s PENDANT laquelle on s'éloigne du boss
    // et on saute les volées/ondes. Le grand tir (4 dmg, perforant) part
    // une fois réorienté vers le boss.
    const fire = page.locator('.tc-fire').first()
    await hold(faceBtn, 50) // orienter vers le boss avant de charger
    await fire.dispatchEvent('pointerdown')
    const tCharge = Date.now()
    while (Date.now() - tCharge < 1000) {
      await sleep(130)
      const d = await page.evaluate(() => {
        const s = window.__game.scene.getScene('GameScene')
        const b = s.boss
        return { dist: Math.abs((b?.active ? b.x : 9999) - s.player.x), ai: b?.aiState ?? 'walk' }
      })
      if (d.ai === 'volley' || d.ai === 'slam') await hold('.tc-jump', 200)
      else if (d.dist < 120) await hold(awayBtn, 130) // fuir en continu pendant la charge
    }
    await hold(faceBtn, 50) // se réorienter vers le boss AVANT de relâcher
    await fire.dispatchEvent('pointerup') // relâcher = gros tir vers le boss
    await sleep(150)
    if (loops % 20 === 0) console.log(`  …combat: bossHp=${st.bossHp}, vies=${st.lives}, hp=${st.hp}`)
    // Grâce assistée dès la dernière vie (ou 40 s de combat réel) : on finit
    // le boss via le même chemin de code qu'un dernier tir (takeDamage →
    // defeat → noyau). Objectif : vérifier la fin de niveau, pas le skill.
    if ((st.lives <= 1 || Date.now() - fightStart > 40000) && st.bossActive) {
      for (let i = 0; i < 6 && st.bossActive; i++) {
        await page.evaluate(() => {
          const b = window.__game.scene.getScene('GameScene').boss
          if (b?.active) b.invulnerable = false
          if (b?.active) b.takeDamage(999)
        })
        await sleep(150)
        st = await state()
      }
    }
    await sleep(80)
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
