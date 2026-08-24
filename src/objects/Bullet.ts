import Phaser from 'phaser'

export type BulletType = 'normal' | 'mid' | 'big'

const BULLET_DEF: Record<BulletType, { key: string; damage: number; speed: number; pierce: boolean }> = {
  normal: { key: 'bullet', damage: 1, speed: 700, pierce: false },
  mid: { key: 'bullet-mid', damage: 2, speed: 640, pierce: false },
  big: { key: 'bullet-big', damage: 4, speed: 540, pierce: true },
}

export class Bullet extends Phaser.Physics.Arcade.Image {
  private lifetime = 1400
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

    this.scene.time.delayedCall(this.lifetime, () => {
      this.disableBody(true, true)
    })
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
    }
  }
}
