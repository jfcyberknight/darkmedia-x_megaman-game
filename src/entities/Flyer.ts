import Phaser from 'phaser'
import type { StageEnemy } from './Enemy'
import { sfx } from '../audio'

/** Hovering drone: drifts in place, chases the player when close. */
export class Flyer extends Phaser.Physics.Arcade.Sprite implements StageEnemy {
  private health = 2
  private baseY: number
  private t = Math.random() * 2000
  private target: { x: number; y: number }

  constructor(scene: Phaser.Scene, x: number, y: number, target: { x: number; y: number }) {
    super(scene, x, y, 'flyer')
    this.baseY = y
    this.target = target

    scene.add.existing(this)
    scene.physics.add.existing(this)

    ;(this.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.body!.setSize(30, 16)
    this.body!.setOffset(5, 5)
    this.play('flyer-fly')
  }

  update(delta = 16.67) {
    if (!this.active) return
    this.t += delta
    const dx = this.target.x - this.x
    const chase = Math.abs(dx) < 300 && Math.abs(this.target.y - this.y) < 280
    this.setVelocityX(chase ? Math.sign(dx) * 115 : Math.cos(this.t / 900) * 55)
    this.setFlipX(this.body!.velocity.x < 0)
    this.setY(this.baseY + Math.sin(this.t / 430) * 13)
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
        if (this.active) this.clearTint()
      })
    }
  }
}
