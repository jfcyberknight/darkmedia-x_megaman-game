import Phaser from 'phaser'
import { COMPANIONS } from '../companions'
import { drawStarfield, drawVignette } from '../ui'
import { sfx, startMusic } from '../audio'
import { isTouchUI, touchState } from '../touch'

/** Companion selection: pick the robot that will follow you through the stages. */
export class CompanionScene extends Phaser.Scene {
  private selected = 0
  private cards: Phaser.GameObjects.Rectangle[] = []
  private sprites: Phaser.GameObjects.Image[] = []
  private cursor!: Phaser.GameObjects.Rectangle
  private nameText!: Phaser.GameObjects.Text
  private persText!: Phaser.GameObjects.Text
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  // État précédent des boutons virtuels (détection de front A/B ◀▶).
  private tL = false
  private tR = false
  private tAct = false

  constructor() {
    super({ key: 'CompanionScene' })
  }

  preload() {
    for (const c of COMPANIONS) this.load.image(c.texture, `assets/${c.texture}.png`)
  }

  create() {
    const { width, height } = this.cameras.main

    const bg = this.add.graphics()
    bg.fillGradientStyle(0x0b0d1c, 0x0b0d1c, 0x1a1030, 0x0d0e15, 1)
    bg.fillRect(0, 0, width, height)
    drawStarfield(this, 45)

    const header = this.add.text(width / 2, 20, 'CHOISIS TON COMPAGNON', {
      fontSize: '13px', color: '#e2e8f0', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5)
    header.setStroke('#0a0512', 3)
    header.setShadow(0, 0, '#ff2436', 6, true, true)

    const total = COMPANIONS.length
    const cardW = 60, gap = 14
    const rowW = total * cardW + (total - 1) * gap
    const startX = (width - rowW) / 2 + cardW / 2
    const y = height * 0.42

    for (let i = 0; i < total; i++) {
      const c = COMPANIONS[i]
      const x = startX + i * (cardW + gap)
      const card = this.add.rectangle(x, y, cardW, cardW + 8, 0x10141f, 1)
        .setStrokeStyle(1.5, c.bubble, 0.4)
      // Tactile : taper une carte la sélectionne, re-taper la carte choisie confirme.
      card.setInteractive({ useHandCursor: true })
      card.on('pointerdown', () => {
        if (this.selected === i) { this.confirm(); return }
        this.selected = i
        sfx.checkpoint()
        this.render()
      })
      this.cards.push(card)
      this.sprites.push(this.add.image(x, y - 6, c.texture).setScale(2))
      this.add.text(x, y + cardW / 2 - 6, c.name, {
        fontSize: '9px', color: '#e2e8f0', fontFamily: 'monospace', fontStyle: 'bold',
      }).setOrigin(0.5)
    }

    this.cursor = this.add.rectangle(startX, y, cardW + 6, cardW + 14)
      .setStrokeStyle(1.5, 0xffffff, 1)
    this.tweens.add({ targets: this.cursor, scale: { from: 1, to: 1.05 }, duration: 450, yoyo: true, repeat: -1 })

    this.nameText = this.add.text(width / 2, height * 0.7, '', {
      fontSize: '12px', color: '#e2e8f0', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5)
    this.persText = this.add.text(width / 2, height * 0.7 + 16, '', {
      fontSize: '8px', color: '#8b93a8', fontFamily: 'monospace', fontStyle: 'italic',
    }).setOrigin(0.5)

    this.add.text(width / 2, height - 14, isTouchUI() ? 'TAP : CHOISIR   RE-TAP : CONFIRMER' : '← → : CHOISIR     Z : CONFIRMER', {
      fontSize: '8px', color: '#5a6280', fontFamily: 'monospace', letterSpacing: 1,
    }).setOrigin(0.5)

    drawVignette(this, 0.5)
    startMusic('menu')

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.input.keyboard!.on('keydown-Z', () => this.confirm())
    this.input.keyboard!.on('keydown-ENTER', () => this.confirm())

    // Appuis virtuels déjà en cours en arrivant : ignorés jusqu'au relâchement.
    this.tL = touchState.left
    this.tR = touchState.right
    this.tAct = touchState.jump || touchState.shoot

    this.render()
  }

  update() {
    if (Phaser.Input.Keyboard.JustDown(this.cursors.left!)) {
      this.selected = (this.selected + COMPANIONS.length - 1) % COMPANIONS.length
      sfx.checkpoint()
      this.render()
    }
    if (Phaser.Input.Keyboard.JustDown(this.cursors.right!)) {
      this.selected = (this.selected + 1) % COMPANIONS.length
      sfx.checkpoint()
      this.render()
    }
    // Pad virtuel ◀▶ / A-B (mobile) — sinon impossible de confirmer sur téléphone.
    const l = touchState.left, r = touchState.right, act = touchState.jump || touchState.shoot
    if (l && !this.tL) { this.selected = (this.selected + COMPANIONS.length - 1) % COMPANIONS.length; sfx.checkpoint(); this.render() }
    if (r && !this.tR) { this.selected = (this.selected + 1) % COMPANIONS.length; sfx.checkpoint(); this.render() }
    if (act && !this.tAct) this.confirm()
    this.tL = l; this.tR = r; this.tAct = act
  }

  private render() {
    const c = COMPANIONS[this.selected]
    const card = this.cards[this.selected]
    this.cursor.setPosition(card.x, card.y).setStrokeStyle(1.5, c.bubble, 1)
    this.nameText.setText(c.name)
    this.persText.setText(c.tagline)
  }

  private confirm() {
    const c = COMPANIONS[this.selected]
    this.registry.set('companion', c.id)
    sfx.checkpoint()
    this.cameras.main.fadeOut(250, 0, 0, 0)
    this.time.delayedCall(280, () => this.scene.start('TitleScene'))
  }
}
