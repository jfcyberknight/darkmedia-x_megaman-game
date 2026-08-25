import Phaser from 'phaser'
import type { StageEnemy } from './Enemy'
import { sfx } from '../audio'

/** Hovering drone: drifts in place, chases the player when close. */
export class Flyer extends Phaser.Physics.Arcade.Sprite implements StageEnemy {
  private health = 2
  private baseY: number
  private t = Math.random() * 2000
  private target: { x: number; y: number }
  private baseTint = 0xffffff

  constructor(scene: Phaser.Scene, x: number, y: number, target: { x: number; y: number }, tint?: number) {
    super(scene, x, y, 'flyer')
    this.baseY = y
    this.target = target
    this.baseTint = tint ?? 0xffffff

    scene.add.existing(this)
    scene.physics.add.existing(this)

    ;(this.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.body!.setSize(12, 7)
    this.body!.setOffset(4, 4)
    this.setTint(this.baseTint)
    this.play('flyer-fly')
  }

  update(delta = 16.67) {
    if (!this.active) return
    this.t += delta
    const dx = this.target.x - this.x
    const dy = this.target.y - this.y
    // Poursuite large et rapide : le drone traque le joueur.
    const chase = Math.abs(dx) < 170 && Math.abs(dy) < 200
    let hoverY: number
    if (chase) {
      this.setVelocityX(Math.sign(dx) * 42)
      hoverY = this.target.y - 10
    } else {
      this.setVelocityX(Math.cos(this.t / 900) * 11)
      hoverY = this.baseY + Math.sin(this.t / 430) * 3
    }
    // On glisse toujours en vitesse verticale vers la cible (pas de setY brutal),
    // ce qui évite un saut visuel quand le drone quitte la poursuite.
    this.setVelocityY(Phaser.Math.Clamp((hoverY - this.y) * 2, -60, 60))
    this.setFlipX(this.body!.velocity.x < 0)
  }

  takeDamage(amount: number) {
    this.health -= amount
    if (this.health <= 0) {
      sfx.explode()
      ;(this.scene as Phaser.Scene & { spawnExplosion(x: number, y: number): void })
        .spawnExplosion(this.x, this.y)
      this.destroy()
    } else {
      this.setTintFill(0xffffff)
      this.scene.time.delayedCall(70, () => {
        if (this.active) this.setTint(this.baseTint)
      })
    }
  }
}
