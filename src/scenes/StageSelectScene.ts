import Phaser from 'phaser'
import { STAGES } from '../stages'
import { drawStarfield, drawSkyline, drawVignette } from '../ui'

export class StageSelectScene extends Phaser.Scene {
  private selected = 0
  private cardSize = 120
  private cardSpacing = 30
  private cursor!: Phaser.GameObjects.Rectangle
  private cards: Phaser.GameObjects.Rectangle[] = []
  private cardGlows: Phaser.GameObjects.Image[] = []
  private nameText!: Phaser.GameObjects.Text
  private skyline!: Phaser.GameObjects.TileSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys

  constructor() {
    super({ key: 'StageSelectScene' })
  }

  preload() {
    for (const s of STAGES) {
      this.load.image(`bg-far-${s.id}`, `assets/bg-far-${s.id}.png`)
    }
  }

  create() {
    const { width, height } = this.cameras.main

    const bg = this.add.graphics()
    bg.fillGradientStyle(0x1a1c29, 0x1a1c29, 0x0d0e15, 0x0d0e15, 1)
    bg.fillRect(0, 0, width, height)
    drawStarfield(this, 80)
    this.skyline = drawSkyline(this, `bg-far-${STAGES[this.selected].id}`, -2)
    this.skyline.setAlpha(0.45)

    const header = this.add.text(width / 2, 48, 'SELECT YOUR STAGE', {
      fontSize: '32px', color: '#e2e8f0', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 6,
    }).setOrigin(0.5)
    header.setStroke('#0a0512', 8)
    header.setShadow(0, 0, '#35e0ff', 16, true, true)

    // Layout cards in one row, centered
    const total = STAGES.length
    const rowWidth = total * this.cardSize + (total - 1) * this.cardSpacing
    const startX = (width - rowWidth) / 2 + this.cardSize / 2
    const y = height * 0.44

    this.cards = []
    this.cardGlows = []
    for (let i = 0; i < total; i++) {
      const s = STAGES[i]
      const x = startX + i * (this.cardSize + this.cardSpacing)

      const glowImg = this.add.image(x, y, 'glow')
        .setTint(s.accent)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setScale(1.6)
        .setAlpha(0)
      this.cardGlows.push(glowImg)

      const card = this.add.rectangle(x, y, this.cardSize, this.cardSize, s.midColor, 1)
      card.setStrokeStyle(2, s.accent, 0.45)
      this.cards.push(card)

      this.add.text(x, y, String(i + 1), {
        fontSize: '44px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.85)
      this.add.text(x, y + 42, s.name, {
        fontSize: '11px', color: '#8b93a8', fontFamily: 'monospace', letterSpacing: 1,
      }).setOrigin(0.5)
    }

    this.cursor = this.add.rectangle(0, 0, this.cardSize + 8, this.cardSize + 8)
    this.cursor.setStrokeStyle(2.5, 0xffffff, 1)
    this.tweens.add({ targets: this.cursor, scale: { from: 1, to: 1.06 }, duration: 500, yoyo: true, repeat: -1 })

    this.nameText = this.add.text(width / 2, height * 0.72, STAGES[this.selected].name, {
      fontSize: '26px', color: '#e2e8f0', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 6,
    }).setOrigin(0.5)
    this.nameText.setShadow(0, 0, '#35e0ff', 14, true, true)

    this.add.text(width / 2, height * 0.84, '← → MOVE     Z CONFIRM', {
      fontSize: '15px', color: '#5a6280', fontFamily: 'monospace', letterSpacing: 3,
    }).setOrigin(0.5)

    drawVignette(this, 0.5)

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
    this.skyline.setTexture(`bg-far-${STAGES[this.selected].id}`)
    this.renderCursor()
  }

  private renderCursor() {
    this.cardGlows.forEach((g, i) => g.setAlpha(i === this.selected ? 0.35 : 0))
    const card = this.cards[this.selected]
    this.cursor.setPosition(card.x, card.y)
    this.cursor.setStrokeStyle(2.5, STAGES[this.selected].accent, 1)
  }

  private confirm() {
    const stage = STAGES[this.selected]
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(240, () => this.scene.start('GameScene', { stage: stage.id, fresh: true }))
  }
}
