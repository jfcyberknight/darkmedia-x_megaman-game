import Phaser from 'phaser'
import type { StageEnemy } from './Enemy'
import { sfx } from '../audio'
import type { Difficulty } from '../difficulty'

type ChargerState = 'idle' | 'telegraph' | 'dash' | 'rest'

/** Chargeur : patrouille, puis FONCE sur le joueur quand il le repère. */
export class Charger extends Phaser.Physics.Arcade.Sprite implements StageEnemy {
  private health = 4
  private startX = 0
  private aiState: ChargerState = 'idle'
  private stateTime = 0
  private target: { x: number; y: number }
  private patrolSpeed = 20
  private dashSpeed = 120

  constructor(scene: Phaser.Scene, x: number, y: number, target: { x: number; y: number }, diff?: Difficulty) {
    super(scene, x, y, 'charger')
    this.startX = x
    this.target = target
    // Difficulté du stage : vie + vitesses.
    const hpMult = diff?.hpMult ?? 1
    const spdMult = diff?.speedMult ?? 1
    this.health = Math.max(1, Math.round(4 * hpMult))
    this.patrolSpeed = 20 * spdMult
    this.dashSpeed = 120 * spdMult

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body!.setSize(16, 12)
    this.body!.setOffset(2, 4)
    this.setCollideWorldBounds(true)
    this.setVelocityX(-this.patrolSpeed)
    this.play('charger-anim')
  }

  update(delta = 16.67) {
    if (!this.active) return
    const body = this.body as Phaser.Physics.Arcade.Body
    if (this.y > 310) {
      ;(this.scene as Phaser.Scene & { onEnemyFell?(e: StageEnemy): void }).onEnemyFell?.(this)
      this.disableBody(true, true)
      return
    }
    this.stateTime += delta
    const dx = this.target.x - this.x
    const dy = Math.abs(this.target.y - this.y)

    switch (this.aiState) {
      case 'idle':
        // patrouille lente ; si le joueur est proche -> telegraph
        if (body.blocked.right) { this.setVelocityX(-this.patrolSpeed); this.setFlipX(true) }
        else if (body.blocked.left) { this.setVelocityX(this.patrolSpeed); this.setFlipX(false) }
        else if (this.x > this.startX + 60) { this.setVelocityX(-this.patrolSpeed); this.setFlipX(true) }
        else if (this.x < this.startX - 60) { this.setVelocityX(this.patrolSpeed); this.setFlipX(false) }
        if (Math.abs(dx) < 130 && dy < 64) {
          this.aiState = 'telegraph'; this.stateTime = 0; this.setVelocityX(0)
          this.setTintFill(0xffffff)
          this.scene.time.delayedCall(90, () => { if (this.active) this.clearTint() })
          sfx.telegraph()
        }
        break
      case 'telegraph':
        if (this.stateTime > 360) {
          this.aiState = 'dash'; this.stateTime = 0
          const dir = Math.sign(dx) || 1
          this.setFlipX(dir < 0)
          this.setVelocityX(dir * this.dashSpeed)
          sfx.dash()
        }
        break
      case 'dash':
        if (this.stateTime > 460 || body.blocked.left || body.blocked.right) {
          this.aiState = 'rest'; this.stateTime = 0; this.setVelocityX(0)
        }
        break
      case 'rest':
        if (this.stateTime > 700) { this.aiState = 'idle'; this.stateTime = 0 }
        break
    }
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
