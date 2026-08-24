import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Boss } from '../entities/Boss'
import { Bullet } from '../objects/Bullet'
import { drawVignette } from '../ui'
import { STAGES, DEFAULT_STAGE, type StageDef } from '../stages'

const WORLD_W = 4000
const WORLD_H = 1600

export class GameScene extends Phaser.Scene {
  private player!: Player
  private ground!: Phaser.Tilemaps.TilemapLayer
  private platforms!: Phaser.Tilemaps.TilemapLayer
  private enemies!: Phaser.Physics.Arcade.Group
  private bullets!: Phaser.Physics.Arcade.Group
  private boss?: Boss
  private bossBar!: Phaser.GameObjects.Graphics
  private bossName!: Phaser.GameObjects.Text
  private bossActive = false
  private hpBar!: Phaser.GameObjects.Graphics
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private shootKey!: Phaser.Input.Keyboard.Key
  private bgFar!: Phaser.GameObjects.TileSprite
  private bgMid!: Phaser.GameObjects.TileSprite
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
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 40, frameHeight: 60 })
    this.load.spritesheet('enemy', 'assets/enemy.png', { frameWidth: 45, frameHeight: 45 })
    this.load.spritesheet('boss', 'assets/boss.png', { frameWidth: 80, frameHeight: 80 })
    this.load.image('bullet', 'assets/bullet.png')
    this.load.image(`bg-far-${this.stage.id}`, `assets/bg-far-${this.stage.id}.png`)
    this.load.image(`bg-mid-${this.stage.id}`, `assets/bg-mid-${this.stage.id}.png`)
    this.load.image('haze', 'assets/haze.png')
  }

  create() {
    this.createAnimations()

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H)

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

    this.player = new Player(this, 160, 1330, this.bullets)

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    this.spawnEnemies()

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)

    // Collide with BOTH layers: ground is the walkable floor, platforms the floating slabs.
    this.physics.add.collider(this.player, this.ground)
    this.physics.add.collider(this.player, this.platforms)
    this.physics.add.collider(this.enemies, this.ground)
    this.physics.add.collider(this.enemies, this.platforms)
    this.physics.add.collider(this.bullets, this.ground)
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
    // Top-right placement so it never covers the player.
    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(200)
    this.bossName = this.add.text(536, 4, 'WAR MACHINE', {
      fontSize: '15px', color: '#ff9d9d', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 4,
    }).setScrollFactor(0).setDepth(200).setVisible(false)
    this.spawnBoss()

    // HUD
    this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(200)
    this.add.text(24, 16, 'HP', {
      fontSize: '16px', color: '#9fb4d8', fontFamily: 'monospace', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(200)
    this.add.text(24, 46, this.stage.name, {
      fontSize: '15px', color: '#a9b3cf', fontFamily: 'monospace', letterSpacing: 3,
    }).setScrollFactor(0).setDepth(200)

    this.add.text(24, 72, '← → : move   |   ↑ : jump   |   Z : shoot', {
      fontSize: '12px', color: '#5a6280', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(200)

    drawVignette(this, 0.45)
    this.cameras.main.fadeIn(300, 0, 0, 0)
  }

  update() {
    const cam = this.cameras.main
    this.bgFar.tilePositionX = cam.scrollX * 0.15
    this.bgFar.tilePositionY = cam.scrollY * 0.06
    this.bgMid.tilePositionX = cam.scrollX * 0.35
    this.bgMid.tilePositionY = cam.scrollY * 0.12

    const left = this.cursors.left!.isDown
    const right = this.cursors.right!.isDown
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up!)
    const jumpHeld = this.cursors.up!.isDown
    const shoot = Phaser.Input.Keyboard.JustDown(this.shootKey)

    this.player.update(left, right, jump, jumpHeld, shoot)
    this.drawHpBar()

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
    this.ground = map.createLayer('ground', tileset!)!
    this.platforms = map.createLayer('platforms', tileset!)!

    this.ground.setCollisionByExclusion([-1])
    this.platforms.setCollisionByExclusion([-1])
  }

  private createBackground() {
    const { width, height } = this.cameras.main

    // Sky gradient (static, tinted per stage).
    const sky = this.add.graphics()
    sky.fillGradientStyle(this.stage.skyTop, this.stage.skyTop, this.stage.skyBottom, this.stage.skyBottom, 1)
    sky.fillRect(0, 0, width, height)
    sky.setScrollFactor(0).setDepth(-30)

    // Parallax skyline layers (per-stage HD images, infinite horizontal tiling).
    this.bgFar = this.add.tileSprite(width / 2, height / 2, width, height, `bg-far-${this.stage.id}`)
      .setScrollFactor(0).setDepth(-20)
    this.bgMid = this.add.tileSprite(width / 2, height / 2, width, height, `bg-mid-${this.stage.id}`)
      .setScrollFactor(0).setDepth(-12)

    // Soft accent haze on the horizon.
    this.add.image(width / 2, height * 0.66, 'haze')
      .setScrollFactor(0).setDepth(-10)
      .setTint(this.stage.accent).setAlpha(0.22)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setScale(2.2, 1.8)

    // Slow ambient light motes drifting upward (screen space).
    this.add.particles(0, 0, 'glow', {
      x: { min: 0, max: width },
      y: { min: 0, max: height },
      lifespan: 8000,
      speedY: { min: -20, max: -6 },
      speedX: { min: -8, max: 8 },
      scale: { start: 0.04, end: 0.11 },
      alpha: { start: 0.16, end: 0 },
      frequency: 550,
      blendMode: Phaser.BlendModes.ADD,
      tint: [this.stage.accent, 0xffffff, 0x9fb4d8],
    }).setScrollFactor(0).setDepth(-5)
  }

  /** Modern segmented HP bar (screen-fixed HUD). */
  private drawHpBar() {
    const hp = this.player.getHealth()
    const max = 10
    const x = 58, y = 16, w = 210, h = 16
    const frac = Math.max(0, hp / max)
    this.hpBar.clear()
    this.hpBar.fillStyle(0x0a0d16, 0.75).fillRoundedRect(x - 3, y - 3, w + 6, h + 6, 6)
    this.hpBar.lineStyle(1.5, 0x3a4358, 1).strokeRoundedRect(x - 3, y - 3, w + 6, h + 6, 6)
    this.hpBar.fillStyle(0x1a2030, 1).fillRoundedRect(x, y, w, h, 4)
    if (frac > 0) {
      const fw = Math.max(10, w * frac)
      this.hpBar.fillGradientStyle(0x8df2ff, 0x35e0ff, 0x2b6bcb, 0x1d3f8f, 1)
      this.hpBar.fillRoundedRect(x, y, fw, h, 4)
      this.hpBar.fillStyle(0xffffff, 0.28).fillRoundedRect(x + 2, y + 2, Math.max(4, fw - 4), 4, 3)
    }
    this.hpBar.fillStyle(0x0a0d16, 0.5)
    for (let i = 1; i < 10; i++) this.hpBar.fillRect(x + (w / 10) * i, y, 1.5, h)
  }

  /** Yellow-white impact sparks at a world position. */
  spawnSparks(x: number, y: number) {
    const p = this.add.particles(x, y, 'glow', {
      speed: { min: 150, max: 350 },
      scale: { start: 0.14, end: 0 },
      lifespan: 260,
      tint: [0xffffff, 0xfacc15, 0xfb923c],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    p.explode(9)
    this.time.delayedCall(320, () => p.destroy())
  }

  /** Orange explosion burst + shockwave ring at a world position. */
  spawnExplosion(x: number, y: number, big = false) {
    const p = this.add.particles(x, y, 'glow', {
      speed: { min: big ? 150 : 100, max: big ? 450 : 300 },
      scale: { start: big ? 0.5 : 0.3, end: 0 },
      lifespan: big ? 620 : 420,
      tint: [0xfbbf24, 0xf97316, 0xef4444],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    p.explode(big ? 34 : 18)
    this.time.delayedCall(big ? 680 : 480, () => p.destroy())

    const ring = this.add.circle(x, y, big ? 20 : 10).setStrokeStyle(3, 0xffffff, 1)
    this.tweens.add({
      targets: ring,
      radius: big ? 120 : 56,
      alpha: 0,
      duration: big ? 380 : 240,
      ease: 'Cubic.Out',
      onComplete: () => ring.destroy(),
    })
    this.cameras.main.shake(big ? 260 : 90, big ? 0.006 : 0.0025)
  }

  /** Gray dust puff at the player's feet on hard landings. */
  spawnLandingDust(x: number, y: number) {
    const p = this.add.particles(x, y, 'glow', {
      speed: { min: 50, max: 140 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.16, end: 0 },
      lifespan: 280,
      alpha: { start: 0.5, end: 0 },
      tint: [0x94a3b8, 0xcbd5e1],
      emitting: false,
    })
    p.explode(6)
    this.time.delayedCall(340, () => p.destroy())
  }

  /** One-frame muzzle flash at the buster tip. */
  spawnMuzzleFlash(x: number, y: number) {
    const halo = this.add.image(x, y, 'glow')
      .setTint(0x9df2ff).setBlendMode(Phaser.BlendModes.ADD).setScale(0.28).setDepth(50)
    const core = this.add.circle(x, y, 6, 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(51)
    this.tweens.add({
      targets: [halo, core], alpha: 0, scale: 1.9, duration: 80,
      onComplete: () => { halo.destroy(); core.destroy() },
    })
  }

  private spawnEnemies() {
    // Spawns aligned with the tilemap platforms (top surface - 40px)
    const positions = [
      { x: 640, y: 1075 },
      { x: 1080, y: 915 },
      { x: 1640, y: 755 },
      { x: 2360, y: 915 },
      { x: 2880, y: 675 },
      { x: 3480, y: 835 },
    ]

    for (const pos of positions) {
      const enemy = new Enemy(this, pos.x, pos.y)
      this.enemies.add(enemy)
      this.enemyCount++
    }
  }

  private spawnBoss() {
    const boss = new Boss(this, 3700, 1320, (hp, max) => this.drawBossBar(hp, max))
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
    const x = 536, y = 26, barW = 400, barH = 14
    this.bossBar.clear()
    if (!this.bossActive) {
      this.bossName.setVisible(false)
      return
    }
    this.bossName.setVisible(true)
    this.bossBar.fillStyle(0x0a0d16, 0.78).fillRoundedRect(x - 4, y - 4, barW + 8, barH + 8, 8)
    this.bossBar.lineStyle(1.5, 0x4a2432, 1).strokeRoundedRect(x - 4, y - 4, barW + 8, barH + 8, 8)
    this.bossBar.fillStyle(0x24101a, 1).fillRoundedRect(x, y, barW, barH, 5)
    const cur = hp ?? this.boss?.getHealth() ?? 0
    const m = max ?? this.boss?.getMaxHealth() ?? 1
    const frac = Math.max(0, cur / m)
    if (frac > 0) {
      const fw = Math.max(12, barW * frac)
      this.bossBar.fillGradientStyle(0xff8a7a, 0xff5566, 0xc81e3c, 0x8f1029, 1)
      this.bossBar.fillRoundedRect(x, y, fw, barH, 5)
      this.bossBar.fillStyle(0xffffff, 0.3).fillRoundedRect(x + 2, y + 2, Math.max(4, fw - 4), 4, 3)
    }
    this.bossBar.fillStyle(0x0a0d16, 0.55)
    for (let i = 1; i < 10; i++) this.bossBar.fillRect(x + (barW / 10) * i, y, 1.5, barH)
  }

  private showStageClear() {
    const { width } = this.cameras.main
    const t = this.add.text(width / 2, 130, 'STAGE CLEAR', {
      fontSize: '46px', color: '#7dfca2', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 8,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setAlpha(0).setScale(0.7)
    t.setStroke('#05130b', 8)
    t.setShadow(0, 0, '#34d399', 26, true, true)
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 450, ease: 'Back.Out' })
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
    this.bossName.setVisible(false)
    this.showStageClear()
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
      this.showStageClear()
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
