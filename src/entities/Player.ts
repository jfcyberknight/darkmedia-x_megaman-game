import Phaser from 'phaser'
import { Bullet, BulletType } from '../objects/Bullet'
import { sfx } from '../audio'

const CHARGE_MID = 400
const CHARGE_BIG = 1000

export class Player extends Phaser.Physics.Arcade.Sprite {
  private speed = 350
  private jumpVelocity = -1120
  private maxHealth = 10
  private health = 10
  private invulnerable = false
  private facingRight = true
  private bullets: Phaser.Physics.Arcade.Group
  private lastShot = 0
  private shootCooldown = 220

  // Charge shot (hold Z) — timestamp-based so it is framerate-independent
  private charging = false
  private chargeStart = 0
  private chargeTime = 0
  private chargeGlow?: Phaser.GameObjects.Image
  private chargeHalo?: Phaser.GameObjects.Image

  // Boss power absorbed
  powerUp = false

  // Death sequence
  private dead = false
  private lastChargeLevel: 0 | 1 | 2 = 0

  // Platformer feel
  private coyoteTime = 100
  private jumpBufferTime = 100
  private coyoteTimer = 0
  private jumpBufferTimer = 0

  // Landing / hurt feedback
  private wasOnGround = true
  private prevVy = 0

  constructor(scene: Phaser.Scene, x: number, y: number, bullets: Phaser.Physics.Arcade.Group) {
    super(scene, x, y, 'player')
    this.bullets = bullets

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body!.setSize(28, 50)
    this.body!.setOffset(6, 8)
    this.setCollideWorldBounds(true)
    this.setDrag(0, 0)
  }

  update(
    left: boolean,
    right: boolean,
    jumpPressed: boolean,
    jumpHeld: boolean,
    shootPressed: boolean,
    shootHeld: boolean,
    shootReleased: boolean,
    _delta: number,
  ) {
    const body = this.body as Phaser.Physics.Arcade.Body
    const onGround = body.blocked.down || body.touching.down

    if (this.dead) return

    // Hard landing -> dust puff
    if (onGround && !this.wasOnGround && this.prevVy > 650) {
      ;(this.scene as Phaser.Scene & { spawnLandingDust(x: number, y: number): void })
        .spawnLandingDust(this.x, this.y + 25)
    }
    this.wasOnGround = onGround
    this.prevVy = body.velocity.y

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

    // Animation state machine
    const moving = left || right
    if (!onGround) {
      this.anims.play(body.velocity.y < 0 ? 'player-jump' : 'player-fall', true)
    } else if (moving) {
      this.anims.play('player-run', true)
    } else {
      this.anims.play('player-idle', true)
    }

    // Jump
    if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
      this.setVelocityY(this.jumpVelocity)
      this.jumpBufferTimer = 0
      this.coyoteTimer = 0
      sfx.jump()
    }

    // Variable jump height
    if (!jumpHeld && this.body!.velocity.y < 0) {
      this.body!.velocity.y *= 0.7
    }

    // --- Charge shot: tap = normal shot, hold = charge, release = charged shot ---
    if (shootPressed && !this.charging) {
      this.shoot('normal')
      this.charging = true
      this.chargeStart = this.scene.time.now
      this.chargeTime = 0
    }
    if (this.charging && shootHeld) {
      this.chargeTime = this.scene.time.now - this.chargeStart
      this.updateChargeVisual()
    }
    if (this.charging && shootReleased) {
      this.chargeTime = this.scene.time.now - this.chargeStart
      const level = this.chargeLevel()
      if (level >= 2) this.shoot('big')
      else if (level === 1) this.shoot('mid')
      this.charging = false
      this.hideChargeVisual()
    }

    // Blink during invulnerability
    if (this.invulnerable) {
      this.alpha = Phaser.Math.Between(3, 10) / 10
    } else {
      this.alpha = 1
    }
  }

  private chargeLevel(): 0 | 1 | 2 {
    return this.chargeTime >= CHARGE_BIG ? 2 : this.chargeTime >= CHARGE_MID ? 1 : 0
  }

  private updateChargeVisual() {
    const level = this.chargeLevel()
    if (level !== this.lastChargeLevel) {
      sfx.charge(level)
      this.lastChargeLevel = level
    }
    if (!this.chargeGlow || !this.chargeHalo) {
      this.chargeGlow = this.scene.add.image(this.x, this.y, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(40)
      this.chargeHalo = this.scene.add.image(this.x, this.y, 'glow')
        .setBlendMode(Phaser.BlendModes.ADD).setDepth(39)
    }
    const pulse = Math.sin(this.scene.time.now / 70) * 0.06
    const base = 0.16 + level * 0.3
    this.chargeGlow.setPosition(this.x, this.y).setScale(base + 0.12 + pulse).setAlpha(0.55 + level * 0.15)
    this.chargeHalo.setPosition(this.x, this.y).setScale(base * 1.9 + pulse).setAlpha(0.2 + level * 0.14)
    let tint: number
    if (level >= 2) {
      const cycle = this.powerUp
        ? [0xff6b5e, 0xffd166, 0xffffff]
        : [0xffffff, 0xffd166, 0x66f0ff]
      tint = cycle[Math.floor(this.scene.time.now / 90) % 3]
    } else {
      tint = level === 1 ? 0x66f0ff : 0x35e0ff
    }
    this.chargeGlow.setTint(tint)
    this.chargeHalo.setTint(tint)
  }

  private hideChargeVisual() {
    this.chargeGlow?.destroy()
    this.chargeHalo?.destroy()
    this.chargeGlow = undefined
    this.chargeHalo = undefined
  }

  private shoot(type: BulletType) {
    const dir = this.facingRight ? 1 : -1
    const now = this.scene.time.now
    if (type === 'normal') {
      if (now - this.lastShot < this.shootCooldown) return
      this.lastShot = now
    }

    const key = type === 'normal' ? 'bullet' : type === 'mid' ? 'bullet-mid' : 'bullet-big'
    const bullet = this.bullets.get(this.x + dir * 20, this.y - 1, key) as Bullet
    if (!bullet) return
    bullet.activate(dir, type, this.powerUp ? 1 : 0, this.powerUp)

    const flashScale = type === 'big' ? 0.6 : type === 'mid' ? 0.4 : 0.26
    if (type === 'normal') sfx.shoot()
    else if (type === 'mid') sfx.shootMid()
    else sfx.shootBig()
    ;(this.scene as Phaser.Scene & {
      spawnMuzzleFlash(x: number, y: number, scale?: number, flame?: boolean): void
    }).spawnMuzzleFlash(this.x + dir * 20, this.y - 1, flashScale, this.powerUp)
    this.scene.cameras.main.shake(type === 'normal' ? 25 : 60, type === 'normal' ? 0.001 : 0.0025)
  }

  takeDamage(amount: number, knockbackDir: number) {
    if (this.invulnerable || this.dead) return

    this.health = Math.max(0, Math.min(this.maxHealth, this.health - amount))
    this.invulnerable = true
    sfx.hurt()

    // Getting hit cancels the charge
    this.charging = false
    this.hideChargeVisual()

    this.setVelocityX(knockbackDir * 300)
    this.setVelocityY(-450)

    // Red hit flash + camera kick
    this.setTintFill(0xff5050)
    this.scene.time.delayedCall(90, () => this.clearTint())
    this.scene.cameras.main.shake(130, 0.0035)

    this.scene.time.delayedCall(1000, () => {
      this.invulnerable = false
    })

    if (this.health <= 0) {
      this.die(knockbackDir)
    }
  }

  /** Death: knock into the air, blink out, then hand over to the scene (lives/game over). */
  private die(knockbackDir: number) {
    this.dead = true
    this.charging = false
    this.hideChargeVisual()
    this.setVelocityX(-knockbackDir * 150)
    this.setVelocityY(-520)
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 1, to: 0.15 },
      duration: 110,
      yoyo: true,
      repeat: 6,
    })
    this.scene.time.delayedCall(950, () => {
      ;(this.scene as Phaser.Scene & { onPlayerDeath(): void }).onPlayerDeath()
    })
  }

  heal(amount: number) {
    if (this.health >= this.maxHealth) return
    this.health = Math.min(this.maxHealth, this.health + amount)
    this.setTintFill(0x9dfcb8)
    this.scene.time.delayedCall(110, () => this.clearTint())
  }

  getHealth() {
    return this.health
  }
}
