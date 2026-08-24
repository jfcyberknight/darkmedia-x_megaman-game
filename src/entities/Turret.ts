import Phaser from 'phaser'
import type { StageEnemy } from './Enemy'
import { sfx } from '../audio'

/** Static turret: fires aimed shots at the player when in range and line of height. */
export class Turret extends Phaser.Physics.Arcade.Sprite implements StageEnemy {
  private health = 3
  private cooldown = 1400
  private target: { x: number; y: number }
  private telegraphing = 0

  constructor(scene: Phaser.Scene, x: number, y: number, target: { x: number; y: number }) {
    super(scene, x, y, 'turret')
    this.target = target

    scene.add.existing(this)
    scene.physics.add.existing(this)

    ;(this.body as Phaser.Physics.Arcade.Body).allowGravity = false
    this.setImmovable(true)
    this.body!.setSize(30, 24)
    this.body!.setOffset(5, 14)
    this.setFlipX(target.x < x)
  }

  update(delta = 16.67) {
    if (!this.active) return
    if (this.telegraphing > 0) {
      this.telegraphing -= delta
      if (this.telegraphing <= 0) this.fire()
      return
    }
    this.cooldown -= delta
    const dx = this.target.x - this.x
    const dy = this.target.y - this.y
    if (this.cooldown <= 0 && Math.abs(dx) < 560 && Math.abs(dy) < 150) {
      this.setFlipX(dx < 0)
      this.telegraphing = 320
      this.setTint(0xff9d8a)
      sfx.telegraph()
    }
  }

  private fire() {
    this.cooldown = 2100
    this.clearTint()
    sfx.turretShot()
    const sx = this.x + (this.flipX ? -26 : 26)
    const sy = this.y + 2
    ;(this.scene as Phaser.Scene & {
      spawnEnemyBullet(x: number, y: number, tx: number, ty: number, speed?: number, tint?: number): void
    }).spawnEnemyBullet(sx, sy, this.target.x, this.target.y, 360, 0xff5546)
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
