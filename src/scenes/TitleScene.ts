import Phaser from 'phaser'
import { drawScanlines, drawStarfield } from '../ui'

export class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' })
  }

  create() {
    const { width, height } = this.cameras.main

    // Sky gradient
    const bg = this.add.graphics()
    bg.fillGradientStyle(0x2b1e4e, 0x2b1e4e, 0x070811, 0x070811, 1)
    bg.fillRect(0, 0, width, height)

    drawStarfield(this)

    // Big title logo
    const titleY = height * 0.36
    const title = this.add.text(width / 2, titleY, 'MEGA BLASTER', {
      fontSize: '38px',
      color: '#1d4ed8',
      fontFamily: 'monospace',
      fontStyle: 'bold',
    }).setOrigin(0.5)
    title.setStroke('#0a0512', 6)
    title.setShadow(3, 3, '#0a0512', 0, false, true)

    const subtitle = this.add.text(width / 2, titleY + 30, 'A RETRO ACTION PLATFORMER', {
      fontSize: '9px',
      color: '#a9b3cf',
      fontFamily: 'monospace',
      letterSpacing: 3,
    }).setOrigin(0.5)
    void subtitle

    // Prompt blinking
    const prompt = this.add.text(width / 2, height * 0.72, 'PRESS  Z  TO START', {
      fontSize: '12px',
      color: '#ffffff',
      fontFamily: 'monospace',
    }).setOrigin(0.5)
    this.tweens.add({ targets: prompt, alpha: { from: 1, to: 0.15 }, duration: 700, yoyo: true, repeat: -1 })

    this.add.text(width / 2, height * 0.82, '← → Z : NAVIGATE / CONFIRM', {
      fontSize: '8px',
      color: '#5a6280',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    drawScanlines(this)

    const start = () => this.scene.start('StageSelectScene')
    this.input.keyboard!.on('keydown-Z', start)
    this.input.keyboard!.on('keydown-ENTER', start)
    this.input.keyboard!.on('keydown-SPACE', start)
    this.input.on('pointerdown', start)
  }
}
