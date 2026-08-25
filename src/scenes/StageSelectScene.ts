import Phaser from 'phaser'
import { STAGES } from '../stages'
import { drawStarfield, drawSkyline, drawVignette } from '../ui'
import { startMusic } from '../audio'
import { isTouchUI, touchState } from '../touch'

export class StageSelectScene extends Phaser.Scene {
  private selected = 0
  private cardSize = 48
  private cardSpacing = 12
  private cursor!: Phaser.GameObjects.Rectangle
  private cards: Phaser.GameObjects.Rectangle[] = []
  private cardGlows: Phaser.GameObjects.Image[] = []
  private nameText!: Phaser.GameObjects.Text
  private skyline!: Phaser.GameObjects.TileSprite
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private tL = false
  private tR = false
  private tAct = false
  private confirming = false

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

    const header = this.add.text(width / 2, 20, 'SELECT YOUR STAGE', {
      fontSize: '14px', color: '#e2e8f0', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 6,
    }).setOrigin(0.5)
    header.setStroke('#0a0512', 3)
    header.setShadow(0, 0, '#35e0ff', 6, true, true)

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
        .setScale(0.7)
        .setAlpha(0)
      this.cardGlows.push(glowImg)

      const card = this.add.rectangle(x, y, this.cardSize, this.cardSize, s.midColor, 1)
      card.setStrokeStyle(2, s.accent, 0.45)
      card.setInteractive({ useHandCursor: true })
      // Mobile: tap a card to select it; tap the selected card again to launch.
      card.on('pointerdown', () => {
        if (this.selected === i) this.confirm()
        else this.select(i)
      })
      this.cards.push(card)

      this.add.text(x, y, String(i + 1), {
        fontSize: '16px', color: '#ffffff', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0.85)
      this.add.text(x, y + 18, s.name, {
        fontSize: '6px', color: '#8b93a8', fontFamily: 'monospace', letterSpacing: 1,
      }).setOrigin(0.5)
    }

    this.cursor = this.add.rectangle(0, 0, this.cardSize + 4, this.cardSize + 4)
    this.cursor.setStrokeStyle(1.5, 0xffffff, 1)
    this.tweens.add({ targets: this.cursor, scale: { from: 1, to: 1.06 }, duration: 500, yoyo: true, repeat: -1 })

    this.nameText = this.add.text(width / 2, height * 0.72, STAGES[this.selected].name, {
      fontSize: '11px', color: '#e2e8f0', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 6,
    }).setOrigin(0.5)
    this.nameText.setShadow(0, 0, '#35e0ff', 6, true, true)

    this.add.text(width / 2, height * 0.84, isTouchUI() ? 'TAP: SELECT   RE-TAP: PLAY' : '← → MOVE     Z CONFIRM', {
      fontSize: '8px', color: '#5a6280', fontFamily: 'monospace', letterSpacing: 1,
    }).setOrigin(0.5)

    drawVignette(this, 0.5)

    // Menu theme keeps playing here (no-op if already running from the title).
    startMusic('menu')

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.keyboard!.on('keydown-Z', () => this.confirm())
    this.input.keyboard!.on('keydown-ENTER', () => this.confirm())

    // Appuis déjà en cours en arrivant ici : ignorés jusqu'au relâchement.
    this.tL = touchState.left
    this.tR = touchState.right
    this.tAct = touchState.jump || touchState.shoot

    this.renderCursor()
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) this.move(-1)
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) this.move(1)

    // Pad virtuel : ◀▶ sélectionnent, A/B confirment.
    const l = touchState.left
    const r = touchState.right
    const act = touchState.jump || touchState.shoot
    if (l && !this.tL) this.move(-1)
    if (r && !this.tR) this.move(1)
    if (act && !this.tAct) this.confirm()
    this.tL = l
    this.tR = r
    this.tAct = act
  }

  private move(dir: number) {
    this.select((this.selected + dir + STAGES.length) % STAGES.length)
  }

  private select(i: number) {
    this.selected = i
    this.nameText.setText(STAGES[i].name)
    this.skyline.setTexture(`bg-far-${STAGES[i].id}`)
    this.renderCursor()
  }

  private renderCursor() {
    this.cardGlows.forEach((g, i) => g.setAlpha(i === this.selected ? 0.35 : 0))
    const card = this.cards[this.selected]
    this.cursor.setPosition(card.x, card.y)
    this.cursor.setStrokeStyle(1.5, STAGES[this.selected].accent, 1)
  }

  private confirm() {
    if (this.confirming) return
    this.confirming = true
    const stage = STAGES[this.selected]
    this.cameras.main.fadeOut(220, 0, 0, 0)
    this.time.delayedCall(240, () => this.scene.start('GameScene', { stage: stage.id, fresh: true }))
  }
}
