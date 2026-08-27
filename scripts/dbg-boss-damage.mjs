// Debug : le boss prend-il des dégâts quand le joueur tire dessus ?
import { chromium } from 'playwright'
const BASE = process.argv[2] || 'http://localhost:5174/'
const STAGE_IDX = Number(process.argv[3] || '0')
// Faiblesse d'arme du gardien par index de stage (ordre STAGES) : le boss ne se
// blesse qu'avec celle-ci — on l'équipe pour que le debug montre des dégâts.
const WEAKNESS = { 0: 'buster', 1: 'drill', 2: 'cryo', 3: 'ram', 4: 'venom' }
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
  let t = Date.now()
  while (!(await scenes()).includes('StageSelectScene') && Date.now() - t < 25000) { await page.keyboard.press('z'); await sleep(300) }
  await sleep(500)
  for (let i = 0; i < STAGE_IDX; i++) { await page.keyboard.press('ArrowRight'); await sleep(450) }
  await page.keyboard.press('z')
  await wait('GameScene', 10000)
  await sleep(800)
  // téléporter à gauche du boss et tirer
  await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    const bx = s.boss?.active ? s.boss.x : s.ents.bossX
    s.player.setPosition(bx - 90, 250); s.player.body.reset(bx - 90, 250); s.player.body.setVelocity(0, 0)
    s.player.facingRight = true
    // Équipe la faiblesse du gardien (sinon le boss « résiste »).
    const wpn = WEAKNESS[STAGE_IDX] ?? 'buster'
    s.registry.set('weapons', [wpn]); s.registry.set('weapon', wpn)
    if (s.player.addWe) s.player.addWe(99)
  })
  await sleep(600)
  const fire = page.locator('.tc-fire')
  for (let i = 0; i < 8; i++) { await fire.dispatchEvent('pointerdown'); await fire.dispatchEvent('pointerup'); await sleep(300) }
  const hp = await page.evaluate(() => {
    const s = window.__game.scene.getScene('GameScene')
    return { hp: s?.boss?.active ? s.boss.getHealth() : -1, bx: s?.boss?.active ? Math.round(s.boss.x) : null, px: Math.round(s.player.x) }
  })
  console.log(`après 8 tirs -> bossHp=${hp.hp} boss x=${hp.bx} player x=${hp.px}`)
  console.log(`${hp.hp < 30 ? '✅' : '❌'} le boss prend des dégâts`)
} finally { await browser.close() }
