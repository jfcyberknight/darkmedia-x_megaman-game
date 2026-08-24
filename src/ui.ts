import Phaser from 'phaser'

/** Soft screen-edge vignette overlay (screen-fixed, below HUD). Requires the 'vignette' texture (loaded in BootScene). */
export function drawVignette(scene: Phaser.Scene, alpha = 0.55): Phaser.GameObjects.Image {
  const { width, height } = scene.cameras.main
  return scene.add.image(width / 2, height / 2, 'vignette')
    .setScrollFactor(0)
    .setDepth(150)
    .setAlpha(alpha)
}

/** A drifting, twinkling starfield backdrop for menu screens. */
export function drawStarfield(scene: Phaser.Scene, count = 110): Phaser.GameObjects.Arc[] {
  const { width, height } = scene.cameras.main
  const stars: Phaser.GameObjects.Arc[] = []
  for (let i = 0; i < count; i++) {
    const x = Math.random() * width
    const y = Math.random() * height
    const r = Math.random() > 0.85 ? 2.2 : 1.2
    const star = scene.add.circle(x, y, r, 0xffffff, 0.3 + Math.random() * 0.45)
    star.setScrollFactor(0).setDepth(-4)
    scene.tweens.add({
      targets: star,
      alpha: { from: 0.15, to: 0.85 },
      duration: 500 + Math.random() * 1800,
      yoyo: true,
      repeat: -1,
      delay: Math.random() * 1200,
    })
    scene.tweens.add({
      targets: star,
      y: star.y + (Math.random() > 0.5 ? 1.5 : -1.5),
      x: star.x + (Math.random() > 0.5 ? 1 : -1),
      duration: 9000 + Math.random() * 6000,
      repeat: -1,
      yoyo: true,
    })
    stars.push(star)
  }
  return stars
}

/** Slowly scrolling city skyline strip for menu screens (texture: bg-far). */
export function drawSkyline(scene: Phaser.Scene, texture: string, depth = -6): Phaser.GameObjects.TileSprite {
  const { width, height } = scene.cameras.main
  const strip = scene.add.tileSprite(width / 2, height - (height * 0.5) / 2, width, height * 0.5, texture)
    .setScrollFactor(0)
    .setDepth(depth)
    .setAlpha(0.9)
  scene.events.on(Phaser.Scenes.Events.UPDATE, () => {
    strip.tilePositionX += 0.25
  })
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.events.off(Phaser.Scenes.Events.UPDATE)
  })
  return strip
}
