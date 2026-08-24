import Phaser from 'phaser'
import { STAGES } from '../stages'
import { drawScanlines, drawStarfield } from '../ui'

export class StageSelectScene extends Phaser.Scene {
  private selected = 0
  private cardSize = 52
  private cardSpacing = 14
  private cursor!: Phaser.GameObjects.Rectangle
  private cards: Phaser.GameObjects.Rectangle[] = []
  private nameText!: Phaser.GameObjects.Text
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys

  constructor() {
    super({ key: 'StageSelectScene' })
  }

  create() {
    const { width, height } = this.cameras.main

    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1a1c29, 0x1a1c29, 0x0d0e15, 0x0d0e15, 1)
    bg.fillRect(0, 0, width, height)
    drawStarfield(this, 60)

    const header = this.add.text(width / 2, 26, 'SELECT YOUR STAGE', {
      fontSize: '16px', color: '#e2e8f0', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5)
    header.setStroke('#0a0512', 4)

    // Layout cards in one row, centered
    const total = STAGES.length
    const rowWidth = total * this.cardSize + (total - 1) * this.cardSpacing
    const startX = (width - rowWidth) / 2 + this.cardSize / 2
    const y = height * 0.44

    this.cards = []
    for (let i = 0; i < total; i++) {
      const s = STAGES[i]
      const x = startX + i * (this.cardSize + this.cardSpacing)
      const card = this.add.rectangle(x, y, this.cardSize, this.cardSize, s.midColor, 1)
      card.setStrokeStyle(2, s.accent, 0.5)
      this.add.text(x, y, String(i + 1), {
        fontSize: '18px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.85)
      this.cards.push(card)
    }

    this.cursor = this.add.rectangle(0, 0, this.cardSize + 6, this.cardSize + 6)
    this.cursor.setStrokeStyle(2, 0xffffff, 1)
    this.tweens.add({ targets: this.cursor, scale: { from: 1, to: 1.1 }, duration: 500, yoyo: true, repeat: -1 })

    this.nameText = this.add.text(width / 2, height * 0.68, STAGES[this.selected].name, {
      fontSize: '13px', color: '#e2e8f0', fontFamily: 'monospace', fontStyle: 'bold',
    }).setOrigin(0.5)

    this.add.text(width / 2, height * 0.82, '← → MOVE     Z CONFIRM', {
      fontSize: '8px', color: '#5a6280', fontFamily: 'monospace',
    }).setOrigin(0.5)

    drawScanlines(this)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.keyboard!.on('keydown-Z', () => this.confirm())
    this.input.keyboard!.on('keydown-ENTER', () => this.confirm())

    this.renderCursor()
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) this.move(-1)
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) this.move(1)
  }

  private move(dir: number) {
    this.selected = (this.selected + dir + STAGES.length) % STAGES.length
    this.nameText.setText(STAGES[this.selected].name)
    this.renderCursor()
  }

  private renderCursor() {
    const card = this.cards[this.selected]
    this.cursor.setPosition(card.x, card.y)
    this.cursor.setStrokeStyle(2, STAGES[this.selected].accent, 1)
  }

  private confirm() {
    const stage = STAGES[this.selected]
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(240, () => this.scene.start('GameScene', { stage: stage.id }))
  }
}
