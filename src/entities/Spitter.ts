import Phaser from 'phaser'
import type { StageEnemy } from './Enemy'
import { sfx } from '../audio'

/** Cracheur : marche vers le joueur, s'arrête et tire à vue (mobile). */
export class Spitter extends Phaser.Physics.Arcade.Sprite implements StageEnemy {
  private health = 3
  private spitTimer = 1100
  private target: { x: number; y: number }

  constructor(scene: Phaser.Scene, x: number, y: number, target: { x: number; y: number }) {
    super(scene, x, y, 'spitter')
    this.target = target

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body!.setSize(12, 10)
    this.body!.setOffset(3, 4)
    this.setCollideWorldBounds(true)
    this.play('spitter-anim')
  }

  update(delta = 16.67) {
    if (!this.active) return
    if (this.y > 310) {
      ;(this.scene as Phaser.Scene & { onEnemyFell?(e: StageEnemy): void }).onEnemyFell?.(this)
      this.disableBody(true, true)
      return
    }
    const dx = this.target.x - this.x
    const dy = Math.abs(this.target.y - this.y)
    if (Math.abs(dx) < 150 && dy < 50) {
      // s'arrête et crache
      this.setVelocityX(0)
      this.setFlipX(dx < 0)
      this.spitTimer -= delta
      if (this.spitTimer <= 0) { this.spitTimer = 1700; this.fire() }
    } else {
      this.setVelocityX(Math.sign(dx) * 22)
      this.setFlipX(dx < 0)
      this.spitTimer = 800
    }
  }

  private fire() {
    sfx.turretShot()
    const sx = this.x + (this.flipX ? -9 : 9)
    const sy = this.y - 1
    ;(this.scene as Phaser.Scene & {
      spawnEnemyBullet(x: number, y: number, tx: number, ty: number, speed?: number, tint?: number): void
    }).spawnEnemyBullet(sx, sy, this.target.x, this.target.y, 80, 0xff5546)
  }

  takeDamage(amount: number) {
    this.health -= amount
    if (this.health <= 0) {
      sfx.explode()
      ;(this.scene as Phaser.Scene & { spawnExplosion(x: number, y: number): void }).spawnExplosion(this.x, this.y)
      this.disableBody(true, true)
    } else {
      this.setTintFill(0xffffff)
      this.scene.time.delayedCall(70, () => { if (this.active) this.clearTint() })
    }
  }
}
