import Phaser from 'phaser'
import { Bullet } from '../objects/Bullet'

export class Player extends Phaser.Physics.Arcade.Sprite {
  private speed = 140
  private jumpVelocity = -330
  private maxHealth = 10
  private health = 10
  private invulnerable = false
  private facingRight = true
  private bullets: Phaser.Physics.Arcade.Group
  private lastShot = 0
  private shootCooldown = 250

  // Platformer feel
  private coyoteTime = 100
  private jumpBufferTime = 100
  private coyoteTimer = 0
  private jumpBufferTimer = 0

  constructor(scene: Phaser.Scene, x: number, y: number, bullets: Phaser.Physics.Arcade.Group) {
    super(scene, x, y, 'player')
    this.bullets = bullets

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body!.setSize(12, 20)
    this.body!.setOffset(2, 3)
    this.setCollideWorldBounds(true)
    this.setDrag(0, 0)
  }

  update(left: boolean, right: boolean, jumpPressed: boolean, jumpHeld: boolean, shootPressed: boolean) {
    const body = this.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down || body.touching.down

    // Coyote time & jump buffer
    if (onGround) {
      this.coyoteTimer = this.coyoteTime
    } else {
      this.coyoteTimer -= 16.67
    }

    if (jumpPressed) {
      this.jumpBufferTimer = this.jumpBufferTime
    } else {
      this.jumpBufferTimer -= 16.67
    }

    // Horizontal movement
    if (left) {
      this.setVelocityX(-this.speed)
      this.facingRight = false
      this.setFlipX(true)
    } else if (right) {
      this.setVelocityX(this.speed)
      this.facingRight = true
      this.setFlipX(false)
    } else {
      this.setVelocityX(0)
    }

    // Animation
    const moving = left || right
    if (onGround && moving) {
      this.anims.play('player-run', true)
    } else if (onGround) {
      this.anims.play('player-idle', true)
    }

    // Jump
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.setVelocityY(this.jumpVelocity)
      this.jumpBufferTimer = 0
      this.coyoteTimer = 0
    }

    // Variable jump height
    if (!jumpHeld && this.body!.velocity.y < 0) {
      this.body!.velocity.y *= 0.7
    }

    // Shoot
    if (shootPressed) {
      this.shoot()
    }

    // Blink during invulnerability
    if (this.invulnerable) {
      this.alpha = Phaser.Math.Between(3, 10) / 10
    } else {
      this.alpha = 1
    }
  }

  private shoot() {
    const now = this.scene.time.now
    if (now - this.lastShot < this.shootCooldown) return
    this.lastShot = now

    const bullet = this.bullets.get(this.x, this.y - 4) as Bullet
    if (!bullet) return

    bullet.activate(this.facingRight ? 1 : -1)
  }

  takeDamage(amount: number, knockbackDir: number) {
    if (this.invulnerable) return

    this.health = Math.max(0, Math.min(this.maxHealth, this.health - amount))
    this.invulnerable = true

    this.setVelocityX(knockbackDir * 120)
    this.setVelocityY(-180)

    this.scene.time.delayedCall(1000, () => {
      this.invulnerable = false
    })

    if (this.health <= 0) {
      this.scene.scene.restart()
    }
  }

  getHealth() {
    return this.health
  }
}
