import Phaser from 'phaser'

export class Boss extends Phaser.Physics.Arcade.Sprite {
  private health = 20
  private maxHealth = 20
  private patrolSpeed = 75
  private startX = 0
  private patrolDistance = 300
  private invulnerable = false
  private onHpChange: (hp: number, max: number) => void

  constructor(scene: Phaser.Scene, x: number, y: number, onHpChange: (hp: number, max: number) => void) {
    super(scene, x, y, 'boss')
    this.startX = x
    this.onHpChange = onHpChange

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body!.setSize(62, 60)
    this.body!.setOffset(9, 16)
    this.setCollideWorldBounds(true)
    this.setVelocityX(-this.patrolSpeed)
    this.play('boss-idle')
  }

  update() {
    const body = this.body as Phaser.Physics.Arcade.Body

    if (this.active && body.blocked.right) {
      this.setVelocityX(-this.patrolSpeed)
      this.setFlipX(true)
    } else if (this.active && body.blocked.left) {
      this.setVelocityX(this.patrolSpeed)
      this.setFlipX(false)
    }

    if (this.x > this.startX + this.patrolDistance) {
      this.setVelocityX(-this.patrolSpeed)
      this.setFlipX(true)
    } else if (this.x < this.startX - this.patrolDistance) {
      this.setVelocityX(this.patrolSpeed)
      this.setFlipX(false)
    }
  }

  takeDamage(amount: number) {
    if (!this.active || this.invulnerable) return

    this.health = Math.max(0, this.health - amount)
    this.onHpChange(this.health, this.maxHealth)
    this.invulnerable = true

    this.setTintFill(0xffffff)
    this.scene.time.delayedCall(60, () => {
      if (this.active) this.clearTint()
      this.invulnerable = false
    })

    if (this.health <= 0) {
      this.defeat()
    }
  }

  private defeat() {
    ;(this.scene as Phaser.Scene & { bossDefeated(): void }).bossDefeated()
    ;(this.scene as Phaser.Scene & { spawnExplosion(x: number, y: number, big?: boolean): void })
      .spawnExplosion(this.x, this.y, true)
    this.disableBody(true, true)
    this.onHpChange(0, this.maxHealth)
  }

  getHealth() { return this.health }
  getMaxHealth() { return this.maxHealth }
}
