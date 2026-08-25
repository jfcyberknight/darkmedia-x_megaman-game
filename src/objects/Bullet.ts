import Phaser from 'phaser'

export type BulletType = 'normal' | 'mid' | 'big'

const BULLET_DEF: Record<BulletType, { key: string; damage: number; speed: number; pierce: boolean }> = {
  normal: { key: 'bullet', damage: 1, speed: 140, pierce: false },
  mid: { key: 'bullet-mid', damage: 2, speed: 128, pierce: false },
  big: { key: 'bullet-big', damage: 4, speed: 108, pierce: true },
}

export class Bullet extends Phaser.Physics.Arcade.Image {
  /** Portée maximale en PIXELS (et non en ms) : indépendante du framerate. */
  private static readonly MAX_RANGE = 200
  private spawnX = 0
  bulletType: BulletType = 'normal'
  damage = 1
  pierce = false
  private hitSet = new Set<object>()

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture)
    this.setVisible(false)
    this.setActive(false)
  }

  activate(direction: number, type: BulletType = 'normal', bonusDamage = 0, flame = false) {
    const def = BULLET_DEF[type]
    this.bulletType = type
    this.damage = def.damage + bonusDamage
    this.pierce = def.pierce
    this.hitSet.clear()

    this.setTexture(def.key)
    this.body!.setSize(Math.max(8, Math.round(this.width * 0.7)), Math.max(6, Math.round(this.height * 0.7)))
    if (flame) this.setTint(0xff9a76)
    else this.clearTint()

    this.setVisible(true)
    this.setActive(true)
    this.body!.enable = true
    this.setVelocityX(direction * def.speed)
    this.spawnX = this.x
  }

  canHit(target: object) {
    return !this.hitSet.has(target)
  }

  markHit(target: object) {
    this.hitSet.add(target)
  }

  update() {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down) {
      this.disableBody(true, true)
      return
    }
    // Portée en distance : à bas FPS l'ancienne limite temporelle (1400 ms
    // temps réel) tuait les balles après ~50 px, déconnectée de la physique.
    if (Math.abs(this.x - this.spawnX) > Bullet.MAX_RANGE) {
      this.disableBody(true, true)
    }
  }
}
