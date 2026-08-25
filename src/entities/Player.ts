import Phaser from 'phaser'
import { Bullet, BulletType } from '../objects/Bullet'
import { sfx } from '../audio'

const CHARGE_MID = 400
const CHARGE_BIG = 1000
const WORLD_G = 450

export class Player extends Phaser.Physics.Arcade.Sprite {
  // --- movement tuning (16px tiles, 256x224 view) ---
  private speed = 70
  private runAccel = 580
  private runDecel = 720
  private airAccel = 440
  private airDecel = 480
  private jumpVelocity = -224
  private fallMult = 1.4
  private lowJumpMult = 2.7
  private apexThreshold = 30
  private apexBonus = 0.52
  private maxFall = 260
  private coyoteTime = 120
  private jumpBufferTime = 120
  private wallSlideSpeed = 46
  private wallJumpX = 94
  private wallJumpY = -196
  private wallCoyote = 130

  private maxHealth = 10
  private health = 10
  private invulnerable = false
  private invulnToken = 0
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
  weapon: 'buster' | 'war' = 'buster'
  private we = 28
  private weMax = 28

  // Runtime movement state
  private coyoteTimer = 0
  private jumpBufferTimer = 0
  private wallTimer = 0
  private wallSlideDir = 1
  private wasOnGround = true
  private prevVy = 0

  // Death sequence
  private dead = false
  private lastChargeLevel: 0 | 1 | 2 = 0

  constructor(scene: Phaser.Scene, x: number, y: number, bullets: Phaser.Physics.Arcade.Group) {
    super(scene, x, y, 'player')
    this.bullets = bullets

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body!.setSize(12, 20)
    this.body!.setOffset(5, 8)
    this.setCollideWorldBounds(true)
    this.setMaxVelocity(120, this.maxFall)
  }

  update(
    left: boolean,
    right: boolean,
    jumpPressed: boolean,
    jumpHeld: boolean,
    shootPressed: boolean,
    shootHeld: boolean,
    delta: number,
  ) {
    const body = this.body as Phaser.Physics.Arcade.Body
    const dts = Math.min(delta, 50) / 1000
    const onGround = body.blocked.down || body.touching.down

    if (this.dead) return

    // --- timers ---
    this.coyoteTimer = onGround ? this.coyoteTime : this.coyoteTimer - delta
    if (jumpPressed) this.jumpBufferTimer = this.jumpBufferTime
    else this.jumpBufferTimer -= delta

    // --- horizontal: acceleration & friction instead of instant velocity ---
    const dir = (left ? -1 : 0) + (right ? 1 : 0)
    const target = dir * this.speed
    const accel = onGround
      ? (dir !== 0 ? this.runAccel : this.runDecel)
      : (dir !== 0 ? this.airAccel : this.airDecel)
    const vx = body.velocity.x
    if (vx < target) this.setVelocityX(Math.min(target, vx + accel * dts))
    else if (vx > target) this.setVelocityX(Math.max(target, vx - accel * dts))
    if (dir !== 0 && !body.blocked.left && !body.blocked.right) {
      this.facingRight = dir > 0
      this.setFlipX(dir < 0)
    }

    // --- variable-height jump: extra gravity while falling / cutting / hanging ---
    if (!onGround) {
      const vy = body.velocity.y
      let extra = 0
      if (vy > 0) extra = WORLD_G * (this.fallMult - 1)
      else if (vy > -this.apexThreshold) extra = WORLD_G * (this.apexBonus - 1)
      if (!jumpHeld && vy < -this.apexThreshold) extra = WORLD_G * (this.lowJumpMult - 1)
      this.setVelocityY(Math.min(vy + extra * dts, this.maxFall))
    }

    // --- wall slide & wall jump (X signature) ---
    const onWall = !onGround && (body.blocked.left || body.blocked.right)
    if (onWall) {
      this.wallSlideDir = body.blocked.right ? -1 : 1
      this.wallTimer = this.wallCoyote
      const towardWall = (body.blocked.right && right) || (body.blocked.left && left)
      if (towardWall && body.velocity.y > 0 && body.velocity.y > this.wallSlideSpeed) {
        this.setVelocityY(this.wallSlideSpeed)
      }
    } else {
      this.wallTimer -= delta
    }

    // --- landing / jump feedback ---
    if (onGround && !this.wasOnGround) {
      if (this.prevVy > 130) {
        ;(this.scene as Phaser.Scene & { spawnLandingDust(x: number, y: number): void })
          .spawnLandingDust(this.x, this.y + 10)
      }
      this.squash(1.16, 0.84)
    }
    this.wasOnGround = onGround
    this.prevVy = body.velocity.y

    // --- animation state machine ---
    const moving = left || right
    if (!onGround) {
      this.anims.play(body.velocity.y < 0 ? 'player-jump' : 'player-fall', true)
    } else if (moving) {
      this.anims.play('player-run', true)
    } else {
      this.anims.play('player-idle', true)
    }

    // --- jump execution: ground jump, coyote jump, wall jump ---
    if (this.jumpBufferTimer > 0) {
      if (this.coyoteTimer > 0) {
        this.setVelocityY(this.jumpVelocity)
        this.coyoteTimer = 0
        this.jumpBufferTimer = 0
        sfx.jump()
        this.squash(0.86, 1.14)
      } else if (this.wallTimer > 0 && !onGround) {
        const away = this.wallSlideDir
        this.setVelocityX(away * this.wallJumpX)
        this.setVelocityY(this.wallJumpY)
        this.facingRight = away > 0
        this.setFlipX(away < 0)
        this.wallTimer = 0
        this.jumpBufferTimer = 0
        sfx.jump()
        this.squash(0.86, 1.14)
      }
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
    // Release = the button simply isn't held anymore (NOT an edge event):
    // un tap plus court qu'une frame peut faire loupé l'edge de relâchement,
    // et charging resterait true pour toujours → plus aucune balle possible.
    if (this.charging && !shootHeld) {
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

  /** Squash & stretch feedback (returns to 1:1 quickly). */
  private squash(sx: number, sy: number) {
    this.setScale(sx, sy)
    this.scene.tweens.add({
      targets: this,
      scaleX: 1,
      scaleY: 1,
      duration: 150,
      ease: 'Quad.Out',
    })
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
    const pulse = Math.sin(this.scene.time.now / 70) * 0.02
    const base = 0.05 + level * 0.1
    this.chargeGlow.setPosition(this.x, this.y).setScale(base + 0.05 + pulse).setAlpha(0.55 + level * 0.15)
    this.chargeHalo.setPosition(this.x, this.y).setScale(base * 1.9 + pulse).setAlpha(0.2 + level * 0.14)
    let tint: number
    if (level >= 2) {
      const cycle = this.powerUp
        ? [0xff6b5e, 0xffd166, 0xffffff]
        : [0xffffff, 0xffd166, 0xff6b5e]
      tint = cycle[Math.floor(this.scene.time.now / 90) % 3]
    } else {
      tint = level === 1 ? 0xff6b5e : 0xff2436
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

    // Canon war : plus puissant mais consomme de l'énergie
    let bonus = this.powerUp ? 1 : 0
    if (this.weapon === 'war') {
      const cost = type === 'normal' ? 1 : type === 'mid' ? 2 : 4
      if (this.we >= cost) {
        this.we -= cost
        bonus += 1
      } else {
        type = 'normal'   // secours : tir buster standard sans coût
        bonus = this.powerUp ? 1 : 0
      }
    }

    const key = type === 'normal' ? 'bullet' : type === 'mid' ? 'bullet-mid' : 'bullet-big'
    const bullet = this.bullets.get(this.x + dir * 8, this.y - 1, key) as Bullet
    if (!bullet) return
    bullet.activate(dir, type, bonus, this.weapon === 'war')

    const flashScale = type === 'big' ? 0.22 : type === 'mid' ? 0.14 : 0.09
    if (type === 'normal') sfx.shoot()
    else if (type === 'mid') sfx.shootMid()
    else sfx.shootBig()
    ;(this.scene as Phaser.Scene & {
      spawnMuzzleFlash(x: number, y: number, scale?: number, flame?: boolean): void
    }).spawnMuzzleFlash(this.x + dir * 8, this.y - 1, flashScale, this.powerUp)
    this.scene.cameras.main.shake(type === 'normal' ? 25 : 60, type === 'normal' ? 0.001 : 0.002)
  }

  takeDamage(amount: number, knockbackDir: number) {
    if (this.invulnerable || this.dead) return

    this.health = Math.max(0, Math.min(this.maxHealth, this.health - amount))
    this.invulnerable = true
    sfx.hurt()

    // Getting hit cancels the charge
    this.charging = false
    this.hideChargeVisual()

    this.setVelocityX(knockbackDir * 60)
    this.setVelocityY(-90)

    // Red hit flash + camera kick
    this.setTintFill(0xff5050)
    this.scene.time.delayedCall(90, () => this.clearTint())
    this.scene.cameras.main.shake(130, 0.0035)

    // L'invulnérabilité est gérée par jeton : un nouveau hit réinitialise le
    // timer au lieu d'être coupé au milieu (pas de « trou » d'invulnérabilité).
    const token = ++this.invulnToken
    this.scene.time.delayedCall(1000, () => {
      if (token === this.invulnToken) this.invulnerable = false
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
    // Flash rouge au moment du coup fatal (le burst complet part de onPlayerDeath).
    this.scene.cameras.main.flash(200, 255, 60, 50)
    this.setVelocityX(-knockbackDir * 30)
    this.setVelocityY(-104)
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

  addWe(n: number) {
    this.we = Math.min(this.weMax, this.we + n)
  }
  getWe() { return this.we }
  getWeMax() { return this.weMax }

  heal(amount: number) {
    if (this.health >= this.maxHealth) return
    this.health = Math.min(this.maxHealth, this.health + amount)
    this.setTintFill(0x9dfcb8)
    this.scene.time.delayedCall(110, () => this.clearTint())
  }

  getHealth() {
    return this.health
  }

  isDead() {
    return this.dead
  }

  /** Invulnérabilité de spawn : le joueur clignote et rien ne le touche (jeton). */
  grantInvulnerability(ms = 1300) {
    const token = ++this.invulnToken
    this.invulnerable = true
    this.scene.time.delayedCall(ms, () => {
      if (token === this.invulnToken) this.invulnerable = false
    })
  }
}
