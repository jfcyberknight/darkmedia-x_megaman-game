import Phaser from 'phaser'
import { drawStarfield, drawSkyline, drawVignette } from '../ui'
import { sfx, startMusic } from '../audio'

interface Slide {
  lines: string[]
  /** visual beat shown while the slide is on screen */
  beat: 'city' | 'war' | 'hero' | 'mission'
}

const SLIDES: Slide[] = [
  { lines: ['2187. NÉON CITY.', 'La cité des machines.'], beat: 'city' },
  { lines: ["L'IA centrale, WAR MACHINE, a corrompu", 'tous les gardiens. La ville brûle.'], beat: 'war' },
  { lines: ['Vous êtes BLASTER-01 —', 'le dernier gardien fidèle.'], beat: 'hero' },
  { lines: ['Mission : traversez la ville.', 'Détruisez le WAR MACHINE.', 'Absorbez son pouvoir.'], beat: 'mission' },
]

/** Narrative prologue: who you are, what happened, why you fight. */
export class IntroScene extends Phaser.Scene {
  private slideIndex = 0
  private textObj!: Phaser.GameObjects.Text
  private hint!: Phaser.GameObjects.Text
  private typing = false
  private typeEvent?: Phaser.Time.TimerEvent
  private hero!: Phaser.GameObjects.Image
  private eyes!: Phaser.GameObjects.Arc[]
  private skyline!: Phaser.GameObjects.TileSprite

  constructor() {
    super({ key: 'IntroScene' })
  }

  create() {
    const { width, height } = this.cameras.main

    const bg = this.add.graphics()
    bg.fillGradientStyle(0x0b0d1c, 0x0b0d1c, 0x1a1030, 0x0d0e15, 1)
    bg.fillRect(0, 0, width, height)

    drawStarfield(this, 60)
    this.skyline = drawSkyline(this, 'bg-far-neon-city', -4)
    this.skyline.setAlpha(0.75)

    // WAR MACHINE eyes (hidden until beat 'war')
    this.eyes = [
      this.add.circle(width / 2 - 14, 62, 2.5, 0xff3524).setAlpha(0),
      this.add.circle(width / 2 + 14, 62, 2.5, 0xff3524).setAlpha(0),
    ]
    this.eyes.forEach(e => e.setBlendMode(Phaser.BlendModes.ADD))

    // hero (hidden until beat 'hero')
    this.hero = this.add.image(52, height - 34, 'player', 0).setAlpha(0).setDepth(2)

    this.textObj = this.add.text(width / 2, height * 0.52, '', {
      fontSize: '10px', color: '#dbe6f8', fontFamily: 'monospace', align: 'center', lineSpacing: 4,
    }).setOrigin(0.5).setDepth(10)
    this.hint = this.add.text(width / 2, height - 16, 'Z : CONTINUER', {
      fontSize: '7px', color: '#5a6280', fontFamily: 'monospace',
    }).setOrigin(0.5).setDepth(10).setAlpha(0.7)
    void this.hint

    drawVignette(this, 0.55)

    this.showSlide(0)

    const advance = () => {
      sfx.unlock()
      startMusic('menu')
      if (this.typing) {
        // finish typing instantly
        this.typeEvent?.remove()
        const slide = SLIDES[this.slideIndex]
        this.textObj.setText(slide.lines.join('\n'))
        this.typing = false
        return
      }
      this.slideIndex++
      if (this.slideIndex >= SLIDES.length) {
        this.scene.start('TitleScene')
      } else {
        this.showSlide(this.slideIndex)
      }
    }
    this.input.keyboard!.on('keydown-Z', advance)
    this.input.keyboard!.on('keydown-ENTER', advance)
    this.input.keyboard!.once('keydown', () => {
      sfx.unlock()
      startMusic('menu')
    })
  }

  private showSlide(i: number) {
    const slide = SLIDES[i]
    const full = slide.lines.join('\n')

    // visual beats
    if (slide.beat === 'war') {
      this.eyes.forEach(e => {
        e.setAlpha(0.4)
        this.tweens.add({ targets: e, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1 })
      })
      this.cameras.main.shake(300, 0.004)
      sfx.telegraph()
    }
    if (slide.beat === 'hero') {
      this.tweens.add({ targets: this.hero, alpha: 1, duration: 500 })
      this.eyes.forEach(e => this.tweens.add({ targets: e, alpha: 0, duration: 600 }))
      sfx.checkpoint()
    }
    if (slide.beat === 'mission') {
      this.tweens.add({ targets: this.hero, x: this.hero.x + 10, duration: 600 })
      sfx.collect()
    }

    // typewriter
    this.textObj.setText('')
    this.typing = true
    let ci = 0
    this.typeEvent?.remove()
    this.typeEvent = this.time.addEvent({
      delay: 26,
      repeat: full.length - 1,
      callback: () => {
        ci++
        this.textObj.setText(full.slice(0, ci))
        if (ci >= full.length) this.typing = false
      },
    })
  }
}
