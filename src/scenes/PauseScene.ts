import Phaser from 'phaser'
import type { GameScene } from './GameScene'
import { sfx } from '../audio'
import { consumeTouchEdges, isTouchUI, touchState } from '../touch'

type WeaponId = 'buster' | 'war'

/** Pause overlay: weapon selection + status. GameScene is paused underneath. */
export class PauseScene extends Phaser.Scene {
  private selected = 0
  private rows: { id: WeaponId; label: string; locked: boolean }[] = []
  private cursor!: Phaser.GameObjects.Triangle
  private rowTexts: Phaser.GameObjects.Text[] = []
  private weBar!: Phaser.GameObjects.Graphics
  private equipTag!: Phaser.GameObjects.Text
  private gs!: GameScene
  // État précédent des boutons virtuels (fronts ⏸ ◀▶ / A-B).
  private tL = false
  private tR = false
  private tAct = false

  constructor() {
    super({ key: 'PauseScene' })
  }

  create() {
    const gs = this.scene.get('GameScene') as GameScene
    this.gs = gs
    const { width, height } = this.cameras.main
    const power = this.registry.get('power') === true
    const lives = (this.registry.get('lives') as number) ?? 3

    this.rows = [{ id: 'buster', label: 'BUSTER', locked: false }]
    if (power) this.rows.push({ id: 'war', label: 'CANON WAR', locked: false })

    // voile + panneau
    this.add.rectangle(width / 2, height / 2, width, height, 0x05060c, 0.82).setDepth(0)
    this.add.rectangle(width / 2, height / 2, 200, 156, 0x0a0d16, 0.92)
      .setStrokeStyle(1.5, 0x3a4358, 1).setDepth(1)

    const title = this.add.text(width / 2, height / 2 - 60, 'PAUSE', {
      fontSize: '16px', color: '#ffb3b8', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5).setDepth(2)
    title.setShadow(0, 0, '#ff2436', 8, true, true)

    this.add.text(width / 2 - 84, height / 2 - 34, 'ARMES', {
      fontSize: '7px', color: '#5a6280', fontFamily: 'monospace', letterSpacing: 2,
    }).setDepth(2)

    this.rowTexts = []
    this.rows.forEach((row, i) => {
      const y = height / 2 - 14 + i * 24
      const t = this.add.text(width / 2 - 62, y, row.label, {
        fontSize: '10px',
        color: row.locked ? '#4a5266' : '#e2e8f0',
        fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 1,
      }).setDepth(2)
      // Tactile / souris : taper une arme la sélectionne et l'équipe.
      t.setInteractive({ useHandCursor: true })
      t.on('pointerdown', () => {
        if (row.locked) return
        this.selected = i
        this.cursor.y = height / 2 - 14 + i * 24
        this.equipSelected()
      })
      this.rowTexts.push(t)
      if (row.id === 'war') {
        this.add.text(width / 2 + 34, y, power ? 'FLAMMES + DÉGÂTS' : 'VERROUILLÉE — VAINCRE LE BOSS', {
          fontSize: '6px', color: power ? '#ffb37a' : '#4a5266', fontFamily: 'monospace',
        }).setOrigin(0, 0.5).setDepth(2)
      }
      if (row.id === 'buster') {
        this.add.text(width / 2 + 34, y, 'FIABLE — ÉNERGIE ∞', {
          fontSize: '6px', color: '#8b93a8', fontFamily: 'monospace',
        }).setOrigin(0, 0.5).setDepth(2)
      }
    })

    // barre d'énergie du canon war
    this.weBar = this.add.graphics().setDepth(2)
    this.drawWe(gs)

    this.equipTag = this.add.text(width / 2 - 62, height / 2 - 24, '', {
      fontSize: '6px', color: '#7dfca2', fontFamily: 'monospace', fontStyle: 'bold',
    }).setDepth(2)

    this.add.text(width / 2 - 84, height / 2 + 36, `PV ${gs.player.getHealth()}/10    VIES ×${lives}`, {
      fontSize: '8px', color: '#a9b3cf', fontFamily: 'monospace',
    }).setDepth(2)

    // REPRENDRE : cliquable/tappable (et raccourcis clavier inchangés).
    const resumeText = this.add.text(width / 2, height / 2 + 62,
      isTouchUI() ? '▶ REPRENDRE   (◀▶ ARME · A/B ÉQUIPER · ⏸)' : '↑↓ : ARME     Z : ÉQUIPER     P : REPRENDRE', {
      fontSize: '8px', color: isTouchUI() ? '#ffb3b8' : '#5a6280',
      fontFamily: 'monospace', backgroundColor: isTouchUI() ? '#10141f' : undefined,
      padding: isTouchUI() ? { x: 6, y: 3 } : {},
    }).setOrigin(0.5).setDepth(2)
    resumeText.setInteractive({ useHandCursor: true })
    resumeText.on('pointerdown', () => this.doResume())

    this.cursor = this.add.triangle(width / 2 - 72, height / 2 - 14, 0, 3, 0, 9, 7, 6, 0xffb3b8).setDepth(2)

    const resume = () => this.doResume()
    this.input.keyboard!.on('keydown-P', resume)
    this.input.keyboard!.on('keydown-ESC', resume)
    this.input.keyboard!.on('keydown-Z', () => this.equipSelected())
    this.input.keyboard!.on('keydown-UP', () => this.moveSel(-1))
    this.input.keyboard!.on('keydown-DOWN', () => this.moveSel(1))

    // Appuis virtuels déjà en cours en arrivant : ignorés jusqu'au relâchement.
    this.tL = touchState.left
    this.tR = touchState.right
    this.tAct = touchState.jump || touchState.shoot

    this.refresh(gs)
  }

  update() {
    // ⏸ (pad tactile) reprend ; ◀▶ changent d'arme ; A/B équipent.
    const q = consumeTouchEdges()
    if (q.pause) { this.doResume(); return }
    const l = touchState.left, r = touchState.right, act = touchState.jump || touchState.shoot
    if (l && !this.tL) this.moveSel(-1)
    if (r && !this.tR) this.moveSel(1)
    if (act && !this.tAct) this.equipSelected()
    this.tL = l; this.tR = r; this.tAct = act
  }

  private doResume() {
    // Vide les appuis tactiles accumulés pendant la pause : pas de tir/saut
    // parasite à la reprise.
    consumeTouchEdges()
    this.scene.stop()
    this.scene.resume('GameScene')
  }

  private equipSelected() {
    const row = this.rows[this.selected]
    if (!row || row.locked) return
    this.registry.set('weapon', row.id)
    sfx.checkpoint()
    this.refresh(this.gs)
  }

  private moveSel(dir: number) {
    this.selected = (this.selected + dir + this.rows.length) % this.rows.length
    sfx.charge(0)
    this.cursor.y = this.cameras.main.height / 2 - 14 + this.selected * 24
    this.refresh(this.gs)
  }

  private drawWe(gs: GameScene) {
    const warRow = this.rows.findIndex(r => r.id === 'war')
    if (warRow < 0) return
    const y = this.cameras.main.height / 2 - 14 + warRow * 24 + 8
    const x = this.cameras.main.width / 2 + 34
    this.weBar.clear()
    this.weBar.fillStyle(0x1a2030, 1).fillRect(x, y, 60, 4)
    const frac = gs.player.getWe() / gs.player.getWeMax()
    this.weBar.fillGradientStyle(0xffc857, 0xff9a3c, 0xb87808, 0x8a5a06, 1)
    this.weBar.fillRect(x, y, Math.max(1, 60 * frac), 4)
  }

  private refresh(gs: GameScene) {
    const weapon = this.registry.get('weapon')
    this.equipTag.setText('')
    this.rows.forEach((row, i) => {
      const equipped = row.id === weapon
      this.rowTexts[i].setColor(equipped ? '#7dfca2' : row.locked ? '#4a5266' : '#e2e8f0')
      if (equipped) {
        this.equipTag.setText('ÉQUIPÉE')
        this.equipTag.setPosition(this.rowTexts[i].x + this.rowTexts[i].width + 6, this.rowTexts[i].y - 9)
      }
    })
    this.drawWe(gs)
  }
}
