import Phaser from 'phaser'
import { drawStarfield, drawSkyline, drawVignette } from '../ui'
import { sfx } from '../audio'

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' })
  }

  preload() {
    this.load.image('bg-far', 'assets/bg-far-neon-city.png')
  }

  create() {
    const { width, height } = this.cameras.main

    // Sky gradient
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x2b1e4e, 0x2b1e4e, 0x070811, 0x070811, 1)
    bg.fillRect(0, 0, width, height)

    drawStarfield(this)
    drawSkyline(this, 'bg-far', -6)

    // Big title logo with glow
    const titleY = height * 0.34
    const title = this.add.text(width / 2, titleY, 'MEGA BLASTER', {
      fontSize: '84px',
      color: '#e8f1ff',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    title.setStroke('#0a0512', 10)
    title.setShadow(0, 0, '#35e0ff', 26, true, true)
    this.tweens.add({
      targets: title,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.92, to: 1 },
      duration: 600,
      ease: 'Back.Out',
    })

    const subtitle = this.add.text(width / 2, titleY + 64, 'A  MODERN  ACTION  PLATFORMER', {
      fontSize: '17px',
      color: '#8b93a8',
      fontFamily: 'monospace',
      letterSpacing: 8,
    }).setOrigin(0.5)

    // Prompt blinking
    const prompt = this.add.text(width / 2, height * 0.66, 'PRESS  Z  TO START', {
      fontSize: '21px',
      color: '#ffffff',
      fontFamily: 'monospace',
      letterSpacing: 3,
    }).setOrigin(0.5)
    prompt.setShadow(0, 0, '#35e0ff', 12, true, true)
    this.tweens.add({ targets: prompt, alpha: { from: 1, to: 0.15 }, duration: 700, yoyo: true, repeat: -1 })
    void subtitle

    this.add.text(width / 2, height * 0.78, '← → MOVE     ↑ JUMP     Z SHOOT', {
      fontSize: '14px',
      color: '#5a6280',
      fontFamily: 'monospace',
      letterSpacing: 2,
    }).setOrigin(0.5)

    drawVignette(this, 0.5)

    const start = () => {
      sfx.unlock()
      this.scene.start('StageSelectScene')
    }
    this.input.keyboard!.on('keydown-Z', start)
    this.input.keyboard!.on('keydown-ENTER', start)
    this.input.keyboard!.on('keydown-SPACE', start)
    this.input.on('pointerdown', start)
  }
}
