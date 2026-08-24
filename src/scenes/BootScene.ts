import Phaser from 'phaser'
import { drawScanlines } from '../ui'

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' })
  }

  create() {
    const { width, height } = this.cameras.main

    const bg = this.add.graphics()
    bg.fillGradientStyle(0x05060c, 0x05060c, 0x0d0e15, 0x0d0e15, 1)
    bg.fillRect(0, 0, width, height)

    const studio = this.add.text(width / 2, height / 2 - 6, 'DARKMEDIA X', {
      fontSize: '18px',
      color: '#8b93a8',
      fontFamily: 'monospace',
      letterSpacing: 6,
    }).setOrigin(0.5)

    const presents = this.add.text(width / 2, height / 2 + 20, 'p r e s e n t s', {
      fontSize: '9px',
      color: '#4c5568',
      fontFamily: 'monospace',
    }).setOrigin(0.5)

    drawScanlines(this, 0.14)

    this.tweens.add({ targets: [studio, presents], alpha: { from: 0, to: 1 }, duration: 700 })
    const go = () => this.scene.start('TitleScene')
    this.input.keyboard!.on('keydown-Z', go)
    this.time.delayedCall(1600, () => {
      this.tweens.add({
        targets: [studio, presents],
        alpha: 0,
        duration: 400,
        onComplete: go,
      })
    })
  }
}
