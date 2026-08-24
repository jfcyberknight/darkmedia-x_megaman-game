import Phaser from 'phaser'

export class Enemy extends Phaser.Physics.Arcade.Sprite {
  private patrolSpeed = 40
  private patrolDistance = 60
  private startX = 0
  private health = 2

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'enemy')
    this.startX = x

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body!.setSize(16, 16)
    this.body!.setOffset(1, 1)
    this.setCollideWorldBounds(true)
    this.setVelocityX(this.patrolSpeed)
    this.play('enemy-walk')
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
      this.disableBody(true, true)
      this.createExplosion()
    } else {
      this.setTint(0xff8080)
      this.scene.time.delayedCall(100, () => {
        if (this.active) this.clearTint()
      })
    }
  }

  private createExplosion() {
    const particles = this.scene.add.particles(this.x, this.y, '', {
      speed: { min: 30, max: 80 },
      scale: { start: 0.6, end: 0 },
      lifespan: 300,
      quantity: 8,
      tint: [0xffaa00, 0xff4400, 0xffff00],
    })
    this.scene.time.delayedCall(350, () => particles.destroy())
  }
}
