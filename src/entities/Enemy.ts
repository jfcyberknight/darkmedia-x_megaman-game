import Phaser from 'phaser'
import { sfx } from '../audio'

/** Structural type shared by every hostile in the stage (walker, flyer, turret, boss). */
export interface StageEnemy {
  active: boolean
  x: number
  y: number
  update(delta?: number): void
  takeDamage(amount: number): void
}

export class Enemy extends Phaser.Physics.Arcade.Sprite implements StageEnemy {
  private patrolSpeed = 100
  private patrolDistance = 150
  private startX = 0
  private health = 2

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy')
    this.startX = x

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body!.setSize(34, 34)
    this.body!.setOffset(5, 8)
    this.setCollideWorldBounds(true)
    this.setVelocityX(this.patrolSpeed)
    this.play('enemy-walk')
  }

  update(_delta = 16.67) {
    const body = this.body as Phaser.Physics.Arcade.Body

    if (this.active && body.blocked.right) {
      this.setVelocityX(-this.patrolSpeed)
      this.setFlipX(true)
    } else if (this.active && body.blocked.left) {
      this.setVelocityX(this.patrolSpeed)
      this.setFlipX(false)
    }

    // Soft patrol bounds (turn around if too far)
    if (this.x > this.startX + this.patrolDistance) {
      this.setVelocityX(-this.patrolSpeed)
      this.setFlipX(true)
    } else if (this.x < this.startX - this.patrolDistance) {
      this.setVelocityX(this.patrolSpeed)
      this.setFlipX(false)
    }
  }

  takeDamage(amount: number) {
    this.health -= amount
    if (this.health <= 0) {
      sfx.explode()
      ;(this.scene as Phaser.Scene & { spawnExplosion(x: number, y: number): void })
        .spawnExplosion(this.x, this.y)
      this.disableBody(true, true)
    } else {
      // Full white hit-flash damage feedback
      this.setTintFill(0xffffff)
      this.scene.time.delayedCall(70, () => {
        if (this.active) this.clearTint()
      })
    }
  }
}
