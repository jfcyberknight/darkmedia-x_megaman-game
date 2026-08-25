import { chromium } from 'playwright'
import http from 'node:http'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, extname } from 'node:path'
const root = '/opt/darkmedia-x_megaman-game/dist'
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.json': 'application/json' }
const server = http.createServer((req, res) => {
  const url = decodeURIComponent(req.url.split('?')[0])
  const p = url === '/' ? join(root, 'index.html') : join(root, url)
  try {
    if (statSync(p).isDirectory()) { res.writeHead(404); res.end('dir'); return }
    res.writeHead(200, { 'Content-Type': mime[extname(p)] ?? 'application/octet-stream' })
    res.end(readFileSync(p))
  } catch { res.writeHead(404); res.end('nf') }
})
await new Promise(r => server.listen(8099, r))
const browser = await chromium.launch({ headless: true })
const page = await browser.newPage({ viewport: { width: 1024, height: 896 } })
let errs = 0
page.on('pageerror', e => { errs++; console.log('[ERROR]', e.message) })
await page.goto('http://localhost:8099/')
await page.waitForTimeout(1200)
for (let k = 0; k < 25; k++) {
  const on = await page.evaluate(() => window.__game.scene.isActive('StageSelectScene')).catch(() => false)
  if (on) break
  await page.keyboard.press('z')
  await page.waitForTimeout(420)
}
const on = await page.evaluate(() => window.__game.scene.isActive('StageSelectScene'))
console.log('on select:', on)
await page.screenshot({ path: '/tmp/select7.png' })
console.log('errors:', errs)
await browser.close(); server.close(); process.exit(0)
