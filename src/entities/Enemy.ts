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
  private patrolSpeed = 20
  private patrolDistance = 30
  private startX = 0
  private health = 2
  // Poursuite : le marcheur fonce sur le joueur repéré à proximité.
  private chaseSpeed = 46
  private aggroRange = 110
  private target: { x: number; y: number }
  private baseTint = 0xffffff

  constructor(scene: Phaser.Scene, x: number, y: number, target?: { x: number; y: number }, tint?: number) {
    super(scene, x, y, 'enemy')
    this.startX = x
    this.target = target ?? { x, y }
    this.baseTint = tint ?? 0xffffff

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body!.setSize(14, 14)
    this.body!.setOffset(4, 4)
    this.setCollideWorldBounds(true)
    this.setVelocityX(this.patrolSpeed)
    this.setTint(this.baseTint)
    this.play('enemy-walk')
  }

  update(_delta = 16.67) {
    if (!this.active) return
    const body = this.body as Phaser.Physics.Arcade.Body

    // Tombé dans un trou en pourchassant : nettoyage (sinon chute infinie).
    if (this.y > 310) {
      ;(this.scene as Phaser.Scene & { onEnemyFell?(e: StageEnemy): void }).onEnemyFell?.(this)
      this.disableBody(true, true)
      return
    }

    // Poursuite : fonce sur le joueur repéré à proximité (et assez à plat).
    const dx = this.target.x - this.x
    if (Math.abs(dx) < this.aggroRange && Math.abs(this.target.y - this.y) < 64) {
      this.setVelocityX(Math.sign(dx) * this.chaseSpeed)
      this.setFlipX(dx < 0)
      return
    }

    // Patrouille d'origine sinon.
    if (body.blocked.right) {
      this.setVelocityX(-this.patrolSpeed)
      this.setFlipX(true)
    } else if (body.blocked.left) {
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
      // Full white hit-flash damage feedback, puis retour à la teinte du stage.
      this.setTintFill(0xffffff)
      this.scene.time.delayedCall(70, () => {
        if (this.active) this.setTint(this.baseTint)
      })
    }
  }
}
