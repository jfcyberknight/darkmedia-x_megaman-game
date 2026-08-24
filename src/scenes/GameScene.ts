import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Boss } from '../entities/Boss'
import { Bullet } from '../objects/Bullet'
import { STAGES, DEFAULT_STAGE, type StageDef } from '../stages'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private platforms!: Phaser.Tilemaps.TilemapLayer
  private enemies!: Phaser.Physics.Arcade.Group
  private bullets!: Phaser.Physics.Arcade.Group
  private boss?: Boss
  private bossBar!: Phaser.GameObjects.Graphics
  private bossActive = false
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private shootKey!: Phaser.Input.Keyboard.Key
  private healthText!: Phaser.GameObjects.Text
  private stageText!: Phaser.GameObjects.Text
  private enemyCount = 0
  private stage: StageDef = DEFAULT_STAGE

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: { stage?: string }) {
    this.stage = STAGES.find(s => s.id === data.stage) ?? DEFAULT_STAGE
  }

  preload() {
    this.load.image('tileset', 'assets/tileset.png')
    this.load.tilemapTiledJSON('level', 'assets/level.json')
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 16, frameHeight: 24 })
    this.load.spritesheet('enemy', 'assets/enemy.png', { frameWidth: 18, frameHeight: 18 })
    this.load.spritesheet('boss', 'assets/boss.png', { frameWidth: 32, frameHeight: 32 })
    this.load.image('bullet', 'assets/bullet.png')
  }

  create() {
    this.createAnimations()

    this.cameras.main.setBounds(0, 0, 1600, 640)
    this.physics.world.setBounds(0, 0, 1600, 640)

    this.createBackground()
    this.createTilemap()

    this.bullets = this.physics.add.group({
      classType: Bullet,
      defaultKey: 'bullet',
      maxSize: 20,
      runChildUpdate: true,
      allowGravity: false,
      immovable: true,
    })

    this.enemies = this.physics.add.group({
      allowGravity: true,
      collideWorldBounds: true,
    })

    this.player = new Player(this, 64, 500, this.bullets)

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    this.spawnEnemies()

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)

    this.physics.add.collider(this.player, this.platforms)
    this.physics.add.collider(this.enemies, this.platforms)
    this.physics.add.collider(this.bullets, this.platforms)
    this.physics.add.overlap(
      this.bullets,
      this.enemies,
      this.handleBulletHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    )
    this.physics.add.overlap(
      this.player,
      this.enemies,
      this.handlePlayerHitEnemy as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    )

    // Boss HP bar must exist before the boss spawns (spawn draws it once).
    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(200)
    this.spawnBoss()

    this.healthText = this.add.text(10, 10, 'HP: 10', {
      fontSize: '8px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    this.healthText.setScrollFactor(0)
    this.healthText.setDepth(100)

    this.stageText = this.add.text(10, 22, this.stage.name, {
      fontSize: '7px',
      color: '#a9b3cf',
      fontFamily: 'monospace',
    })
    this.stageText.setScrollFactor(0)
    this.stageText.setDepth(100)

    this.createScanlines()

    this.add.text(10, 34, '← → : move  |  ↑ : jump  |  Z : shoot', {
      fontSize: '6px',
      color: '#5a6280',
      fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(100)
  }

  update() {
    const left = this.cursors.left!.isDown
    const right = this.cursors.right!.isDown
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up!)
    const jumpHeld = this.cursors.up!.isDown
    const shoot = Phaser.Input.Keyboard.JustDown(this.shootKey)

    this.player.update(left, right, jump, jumpHeld, shoot)
    this.healthText.setText(`HP: ${this.player.getHealth()}`)

    this.enemies.children.iterate((child) => {
      const enemy = child as Enemy
      if (enemy.active) enemy.update()
      return true
    })

    if (this.bossActive && this.boss?.active) {
      this.boss.update()
      this.drawBossBar()
    }
  }

  private createAnimations() {
    if (!this.anims.exists('player-idle')) {
      this.anims.create({
        key: 'player-idle',
        frames: this.anims.generateFrameNumbers('player', { start: 0, end: 1 }),
        frameRate: 3,
        repeat: -1,
      })
    }
    if (!this.anims.exists('player-run')) {
      this.anims.create({
        key: 'player-run',
        frames: this.anims.generateFrameNumbers('player', { start: 2, end: 5 }),
        frameRate: 12,
        repeat: -1,
      })
    }
    if (!this.anims.exists('player-jump')) {
      this.anims.create({
        key: 'player-jump',
        frames: this.anims.generateFrameNumbers('player', { frames: [6] }),
        frameRate: 10,
        repeat: -1,
      })
    }
    if (!this.anims.exists('player-fall')) {
      this.anims.create({
        key: 'player-fall',
        frames: this.anims.generateFrameNumbers('player', { frames: [7] }),
        frameRate: 10,
        repeat: -1,
      })
    }
    if (!this.anims.exists('enemy-walk')) {
      this.anims.create({
        key: 'enemy-walk',
        frames: this.anims.generateFrameNumbers('enemy', { start: 0, end: 1 }),
        frameRate: 6,
        repeat: -1,
      })
    }
    if (!this.anims.exists('boss-idle')) {
      this.anims.create({
        key: 'boss-idle',
        frames: this.anims.generateFrameNumbers('boss', { start: 0, end: 1 }),
        frameRate: 4,
        repeat: -1,
      })
    }
  }

  private createTilemap() {
    const map = this.make.tilemap({ key: 'level' })
    const tileset = map.addTilesetImage('tileset', 'tileset')
    const ground = map.createLayer('ground', tileset!)
    this.platforms = map.createLayer('platforms', tileset!)!

    ground!.setCollisionByExclusion([-1])
    this.platforms.setCollisionByExclusion([-1])
  }

  private createBackground() {
    const W = 1600
    const H = 640

    // Sky gradient (static, tinted per stage). Lowest depth so layers draw over it.
    const sky = this.add.graphics()
    sky.fillGradientStyle(this.stage.skyTop, this.stage.skyTop, this.stage.skyBottom, this.stage.skyBottom, 1)
    sky.fillRect(0, 0, W + 400, H)
    sky.setScrollFactor(0).setDepth(-30)

    // Far layer: jagged skyline silhouettes (parallax 0.15)
    const far = this.add.graphics()
    far.fillStyle(this.stage.farColor, 1)
    let x = -200
    while (x < W + 400) {
      const w = 60 + Math.random() * 90
      const h = 80 + Math.random() * 160
      far.fillRect(x, H - h, w, h)
      if (Math.random() > 0.5) far.fillRect(x + w * 0.3, H - h - 18, w * 0.25, 18)
      x += w + 8
    }
    far.setScrollFactor(0.15)
    far.setDepth(-20)

    // Mid layer: closer structures with window lights (parallax 0.4)
    const mid = this.add.graphics()
    mid.fillStyle(this.stage.midColor, 1)
    x = -150
    while (x < W + 400) {
      const w = 40 + Math.random() * 70
      const h = 50 + Math.random() * 110
      mid.fillRect(x, H - h, w, h)
      // window lights
      for (let wy = H - h + 8; wy < H - 12; wy += 14) {
        for (let wx = x + 6; wx < x + w - 8; wx += 12) {
          if (Math.random() > 0.72) { mid.fillStyle(0xfacc15, 0.55); mid.fillRect(wx, wy, 3, 5) }
        }
      }
      mid.fillStyle(0x191530, 1)
      x += w + 14
    }
    mid.setScrollFactor(0.4)
    mid.setDepth(-12)
  }

  /** Subtle CRT scanlines overlay (screen-fixed). */
  private createScanlines() {
    const sh = this.add.graphics().setScrollFactor(0).setDepth(300)
    sh.fillStyle(0x000000, 0.09)
    for (let y = 0; y < this.cameras.main.height; y += 2) {
      sh.fillRect(0, y, this.cameras.main.width, 1)
    }
  }

  /** Yellow-white impact sparks at a world position. */
  spawnSparks(x: number, y: number) {
    const p = this.add.particles(x, y, 'bullet', {
      speed: { min: 60, max: 140 },
      scale: { start: 0.7, end: 0 },
      lifespan: 220,
      tint: [0xffffff, 0xfacc15, 0xfb923c],
      emitting: false,
    })
    p.explode(7)
    this.time.delayedCall(300, () => p.destroy())
  }

  /** Orange explosion burst + shockwave ring at a world position. */
  spawnExplosion(x: number, y: number, big = false) {
    const p = this.add.particles(x, y, 'bullet', {
      speed: { min: big ? 60 : 40, max: big ? 180 : 120 },
      scale: { start: big ? 1.6 : 1.1, end: 0 },
      lifespan: big ? 560 : 380,
      tint: [0xfbbf24, 0xf97316, 0xef4444],
      emitting: false,
    })
    p.explode(big ? 30 : 16)
    this.time.delayedCall(big ? 620 : 450, () => p.destroy())

    const ring = this.add.circle(x, y, big ? 8 : 4).setStrokeStyle(2, 0xffffff, 1)
    this.tweens.add({
      targets: ring,
      radius: big ? 46 : 22,
      alpha: 0,
      duration: big ? 380 : 240,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    })
    this.cameras.main.shake(big ? 260 : 90, big ? 0.008 : 0.003)
  }

  /** Gray dust puff at the player's feet on hard landings. */
  spawnLandingDust(x: number, y: number) {
    const p = this.add.particles(x, y, 'bullet', {
      speed: { min: 20, max: 55 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.8, end: 0 },
      lifespan: 260,
      tint: [0x94a3b8, 0xcbd5e1],
      emitting: false,
    })
    p.explode(5)
    this.time.delayedCall(320, () => p.destroy())
  }

  /** One-frame muzzle flash at the buster tip. */
  spawnMuzzleFlash(x: number, y: number) {
    const flash = this.add.circle(x, y, 4, 0xffffff)
    const halo = this.add.circle(x, y, 7, 0xfacc15, 0.6)
    this.tweens.add({
      targets: [flash, halo], alpha: 0, scale: 1.6, duration: 60,
      onComplete: () => { flash.destroy(); halo.destroy() },
    })
  }


  private spawnEnemies() {
    // Spawns aligned with the tilemap platforms (top surface - 16px)
    const positions = [
      { x: 256, y: 430 },
      { x: 432, y: 366 },
      { x: 656, y: 302 },
      { x: 944, y: 366 },
      { x: 1152, y: 270 },
      { x: 1392, y: 334 },
    ]

    for (const pos of positions) {
      const enemy = new Enemy(this, pos.x, pos.y)
      this.enemies.add(enemy)
      this.enemyCount++
    }
  }

  private spawnBoss() {
    const boss = new Boss(this, 1480, 470, (hp, max) => this.drawBossBar(hp, max))
    this.boss = boss
    this.bossActive = true
    this.physics.add.collider(this.boss, this.platforms)
    this.physics.add.overlap(
      this.bullets,
      this.boss,
      this.handleBulletHitBoss as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    )
    this.physics.add.overlap(
      this.player,
      this.boss,
      this.handlePlayerHitBoss as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    )
    this.drawBossBar()
  }

  private drawBossBar(hp?: number, max?: number) {
    const W = this.cameras.main.width
    const barW = W - 40
    const x = 20
    const y = this.cameras.main.height - 14
    const barH = 8
    this.bossBar.clear()
    if (!this.bossActive) return
    this.bossBar.fillStyle(0x0a0d14, 0.8).fillRect(x - 2, y - 2, barW + 4, barH + 4)
    this.bossBar.fillStyle(0x1a1c29, 1).fillRect(x, y, barW, barH)
    const cur = hp ?? this.boss?.getHealth() ?? 0
    const m = max ?? this.boss?.getMaxHealth() ?? 1
    const frac = Math.max(0, cur / m)
    this.bossBar.fillStyle(0xef4444, 1).fillRect(x, y, barW * frac, barH)
    this.bossBar.fillStyle(0xffffff, 0.35).fillRect(x, y, barW * frac, 1)
  }

  private handleBulletHitBoss(
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    boss: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    const b = bullet as Phaser.Physics.Arcade.Image
    const bo = boss as Boss
    if (!b.active || !bo.active) return
    this.spawnSparks(b.x, b.y)
    b.disableBody(true, true)
    bo.takeDamage(1)
  }

  private handlePlayerHitBoss(
    player: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    boss: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    const p = player as Player
    const bo = boss as Boss
    if (!bo.active) return
    p.takeDamage(1, bo.x < p.x ? 1 : -1)
  }

  /** Called by the Boss when its HP reaches zero. */
  bossDefeated() {
    this.bossActive = false
    this.bossBar.clear()
    this.add.text(this.cameras.main.width / 2 - 30, 90, 'STAGE CLEAR', {
      fontSize: '16px', color: '#4ade80', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(200)
  }

  private handleBulletHitEnemy(
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemy: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    const b = bullet as Phaser.Physics.Arcade.Image
    const e = enemy as Enemy
    if (!b.active || !e.active) return

    this.spawnSparks(b.x, b.y)
    b.disableBody(true, true)
    e.takeDamage(1)
    this.enemyCount--

    if (this.enemyCount <= 0) {
      this.add.text(this.cameras.main.scrollX + 120, 100, 'STAGE CLEAR', {
        fontSize: '16px',
        color: '#4ade80',
        fontFamily: 'monospace',
      }).setDepth(100).setScrollFactor(0)
    }
  }

  private handlePlayerHitEnemy(
    player: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemy: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    const p = player as Player
    const e = enemy as Enemy
    if (!e.active) return
    p.takeDamage(1, e.x < p.x ? 1 : -1)
  }
}
