import Phaser from 'phaser'
import { sfx } from '../audio'

type BossState = 'walk' | 'telegraph' | 'volley' | 'dash' | 'slam' | 'rest'
type Attack = 'volley' | 'dash' | 'slam'

interface BossScene extends Phaser.Scene {
  spawnEnemyBullet(x: number, y: number, tx: number, ty: number, speed?: number, tint?: number): void
  spawnShockwave(x: number, y: number, dir: number): void
}

/** WAR MACHINE — walks toward the player and cycles telegraphed attacks:
 *  aimed volley, dash charge, jump slam with ground shockwaves. Enrages below 50% HP. */
export class Boss extends Phaser.Physics.Arcade.Sprite {
  private health = 30
  private maxHealth = 30
  private target: { x: number; y: number }
  private onHpChange: (hp: number, max: number) => void

  private aiState: BossState = 'walk'
  private pending: Attack = 'volley'
  private stateTime = 0
  private cooldown = 1400
  private volleyTimer = 0
  private shotsFired = 0
  private volleyShots = 3
  private invulnerable = false
  private enraged = false

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    target: { x: number; y: number },
    onHpChange: (hp: number, max: number) => void,
  ) {
    super(scene, x, y, 'boss')
    this.target = target
    this.onHpChange = onHpChange

    scene.add.existing(this)
    scene.physics.add.existing(this)

    this.body!.setSize(25, 24)
    this.body!.setOffset(9, 10)
    this.setCollideWorldBounds(true)
    this.play('boss-idle')
  }

  update(delta = 16.67) {
    if (!this.active) return

    if (!this.enraged && this.health <= this.maxHealth / 2) {
      this.enraged = true
      this.setTintFill(0xff6b5e)
      this.scene.time.delayedCall(220, () => {
        if (this.active) this.clearTint()
      })
      sfx.telegraph()
      ;(this.scene as Phaser.Scene & { onBossEnraged?(): void }).onBossEnraged?.()
    }

    this.stateTime += delta
    const dx = this.target.x - this.x
    const adx = Math.abs(dx)

    switch (this.aiState) {
      case 'walk': {
        this.setVelocityX(Math.sign(dx) * (this.enraged ? 19 : 14))
        this.setFlipX(dx < 0)
        this.cooldown -= delta
        if (this.cooldown <= 0 && adx < 580) this.pickAttack(adx)
        break
      }
      case 'telegraph': {
        this.setVelocityX(0)
        if (this.stateTime > 520) this.executeAttack()
        break
      }
      case 'volley': {
        this.volleyTimer -= delta
        if (this.volleyTimer <= 0 && this.shotsFired < this.volleyShots) {
          this.fireVolleyShot()
          this.volleyTimer = this.enraged ? 150 : 210
        }
        if (this.shotsFired >= this.volleyShots && this.stateTime > 950) this.endAttack()
        break
      }
      case 'dash': {
        if (this.stateTime > 620 || this.body!.blocked.left || this.body!.blocked.right) this.endAttack()
        break
      }
      case 'slam': {
        if (this.stateTime > 300 && this.body!.blocked.down) this.slamLand()
        break
      }
      case 'rest': {
        this.setVelocityX(0)
        if (this.stateTime > (this.enraged ? 300 : 480)) {
          this.aiState = 'walk'
          this.stateTime = 0
          this.cooldown = this.enraged ? 1200 : 2000
        }
        break
      }
    }
  }

  private pickAttack(adx: number) {
    const r = Math.random()
    if (adx > 430) this.pending = r < 0.5 ? 'dash' : 'volley'
    else if (adx > 170) this.pending = r < 0.45 ? 'volley' : r < 0.85 ? 'slam' : 'dash'
    else this.pending = r < 0.7 ? 'slam' : 'volley'
    this.aiState = 'telegraph'
    this.stateTime = 0
    this.setVelocityX(0)
    this.setTintFill(0xffffff)
    this.scene.time.delayedCall(90, () => {
      if (this.active) this.clearTint()
    })
    sfx.telegraph()
  }

  private executeAttack() {
    if (this.pending === 'volley') {
      this.aiState = 'volley'
      this.stateTime = 0
      this.shotsFired = 0
      this.volleyShots = this.enraged ? 5 : 3
      this.volleyTimer = 60
    } else if (this.pending === 'dash') {
      const dir = Math.sign(this.target.x - this.x) || 1
      this.setFlipX(dir < 0)
      this.setVelocityX(dir * (this.enraged ? 112 : 94))
      sfx.dash()
      this.aiState = 'dash'
      this.stateTime = 0
    } else {
      this.setVelocityY(-144)
      sfx.jump()
      this.aiState = 'slam'
      this.stateTime = 0
    }
  }

  private fireVolleyShot() {
    this.shotsFired++
    sfx.bossShot()
    const sx = this.x + (this.flipX ? -10 : 10)
    const sy = this.y - 6
    ;(this.scene as BossScene).spawnEnemyBullet(sx, sy, this.target.x, this.target.y, 70, 0xff5546)
  }

  private slamLand() {
    this.aiState = 'rest'
    this.stateTime = 0
    this.setVelocityX(0)
    sfx.slam()
    this.scene.cameras.main.shake(240, 0.006)
    ;(this.scene as BossScene).spawnShockwave(this.x - 18, this.y + 14, -1)
    ;(this.scene as BossScene).spawnShockwave(this.x + 18, this.y + 14, 1)
  }

  private endAttack() {
    this.aiState = 'rest'
    this.stateTime = 0
    this.setVelocityX(0)
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
