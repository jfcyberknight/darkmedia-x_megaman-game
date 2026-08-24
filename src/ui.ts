import Phaser from 'phaser'

/** Screen-fixed CRT scanlines, shared by the menu screens. */
export function drawScanlines(scene: Phaser.Scene, alpha = 0.1): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setScrollFactor(0).setDepth(300)
  g.fillStyle(0x000000, alpha)
  for (let y = 0; y < scene.cameras.main.height; y += 2) {
    g.fillRect(0, y, scene.cameras.main.width, 1)
  }
  return g
}

/** A drifting, twinkling starfield backdrop for menu screens. */
export function drawStarfield(scene: Phaser.Scene, count = 90): Phaser.GameObjects.Arc[] {
  const { width, height } = scene.cameras.main
  const stars: Phaser.GameObjects.Arc[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width
    const y = Math.random() * height
    const r = Math.random() > 0.85 ? 2 : 1
    const star = scene.add.circle(x, y, r, 0xffffff, 0.4 + Math.random() * 0.5)
    star.setScrollFactor(0).setDepth(-4)
    scene.tweens.add({
      targets: star,
      alpha: { from: 0.2, to: 1 },
      duration: 400 + Math.random() * 1600,
      yoyo: true,
      repeat: -1,
      delay: Math.random() * 1200,
    })
    scene.tweens.add({
      targets: star,
      y: star.y + (Math.random() > 0.5 ? 0.6 : -0.6),
      x: star.x + (Math.random() > 0.5 ? 0.4 : -0.4),
      duration: 8000 + Math.random() * 6000,
      repeat: -1,
      yoyo: true,
    })
    stars.push(star)
  }
  return stars
}
