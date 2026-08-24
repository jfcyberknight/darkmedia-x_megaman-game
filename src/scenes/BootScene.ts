import Phaser from 'phaser'
import { sfx } from '../audio'

export class BootScene extends Phaser.Scene {
  private jingleDone = false

  constructor() {
    super({ key: 'BootScene' })
  }

  preload() {
    // Shared UI textures used across menus and gameplay
    this.load.image('vignette', 'assets/vignette.png')
    this.load.image('glow', 'assets/glow.png')
  }

  create() {
    const { width, height } = this.cameras.main

    const bg = this.add.graphics()
    bg.fillGradientStyle(0x05060c, 0x05060c, 0x0d0e15, 0x0d0e15, 1)
    bg.fillRect(0, 0, width, height)

    const studio = this.add.text(width / 2, height / 2 - 6, 'DARKMEDIA X', {
      fontSize: '18px',
      color: '#c7d2e8',
      fontFamily: 'monospace',
      fontStyle: 'bold',
      letterSpacing: 2,
    }).setOrigin(0.5)
    studio.setShadow(0, 0, '#35e0ff', 9, true, true)

    const presents = this.add.text(width / 2, height / 2 + 14, 'p r e s e n t s', {
      fontSize: '8px',
      color: '#5a6280',
      fontFamily: 'monospace',
      letterSpacing: 2,
    }).setOrigin(0.5)

    this.drawVignette()

    this.tweens.add({ targets: [studio, presents], alpha: { from: 0, to: 1 }, duration: 700 })
    const go = () => this.scene.start('IntroScene')
    this.input.keyboard!.on('keydown-Z', go)
    this.input.keyboard!.on('keydown-ENTER', go)
    // Browsers block audio until the first gesture: the boot fanfare plays on
    // the very first key press / click (and unlocks the audio context).
    const firstInput = () => {
      sfx.unlock()
      if (!this.jingleDone) {
        this.jingleDone = true
        sfx.intro()
      }
    }
    this.input.keyboard!.once('keydown', firstInput)
    this.input.once('pointerdown', firstInput)
    this.time.delayedCall(1600, () => {
      this.tweens.add({
        targets: [studio, presents],
        alpha: 0,
        duration: 400,
        onComplete: go,
      })
    })
  }

  private drawVignette() {
    const { width, height } = this.cameras.main
    this.add.image(width / 2, height / 2, 'vignette').setAlpha(0.5)
  }
}
