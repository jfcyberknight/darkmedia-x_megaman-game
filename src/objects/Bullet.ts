import Phaser from 'phaser'
import { WEAPONS, type WeaponId } from '../weapons'

export type BulletType = 'normal' | 'mid' | 'big'

const BULLET_DEF: Record<BulletType, { key: string; speed: number }> = {
  normal: { key: 'bullet', speed: 140 },
  mid: { key: 'bullet-mid', speed: 128 },
  big: { key: 'bullet-big', speed: 108 },
}

export class Bullet extends Phaser.Physics.Arcade.Image {
  /** Portée maximale en PIXELS (et non en ms) : indépendante du framerate. */
  private static readonly MAX_RANGE = 200
  private spawnX = 0
  bulletType: BulletType = 'normal'
  damage = 1
  pierce = false
  weapon: WeaponId = 'buster'
  homing = false
  explode = false
  freeze = false
  private hitSet = new Set<object>()

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture)
    this.setVisible(false)
    this.setActive(false)
  }

  activate(direction: number, type: BulletType, damage: number, weapon: WeaponId) {
    const def = BULLET_DEF[type]
    const w = WEAPONS[weapon]
    this.bulletType = type
    this.weapon = weapon
    this.damage = damage
    this.pierce = w.pierce || type === 'big'
    this.homing = !!w.homing
    this.explode = !!w.explode
    this.freeze = !!w.freeze
    this.hitSet.clear()

    this.setTexture(def.key)
    this.body!.setSize(Math.max(8, Math.round(this.width * 0.7)), Math.max(6, Math.round(this.height * 0.7)))
    this.setTint(w.tint)

    this.setVisible(true)
    this.setActive(true)
    // body.reset : position + vélocité + flags (blocked/touching) remis à
    // zéro. Sans lui, une balle morte sur un mur recyclait son corps avec
    // blocked.right=true → la suivante naissait morte (avancée d'1 px).
    this.body!.reset(this.x, this.y)
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
    // Tir guidé : dévie vers l'ennemi actif le plus proche.
    if (this.homing) {
      const sc = this.scene as Phaser.Scene & { enemies?: Phaser.Physics.Arcade.Group }
      const e = sc.enemies?.getFirstAlive() as Phaser.Physics.Arcade.Sprite | null
      if (e?.active) {
        const ang = Math.atan2(e.y - this.y, e.x - this.x)
        const speed = Math.hypot(body.velocity.x, body.velocity.y) || 100
        this.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed)
      }
    }
    // Portée en distance : à bas FPS l'ancienne limite temporelle (1400 ms
    // temps réel) tuait les balles après ~50 px, déconnectée de la physique.
    if (Math.abs(this.x - this.spawnX) > Bullet.MAX_RANGE) {
      this.disableBody(true, true)
    }
  }
}
