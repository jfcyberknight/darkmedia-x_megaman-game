import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy, type StageEnemy } from '../entities/Enemy'
import { Flyer } from '../entities/Flyer'
import { Turret } from '../entities/Turret'
import { Boss } from '../entities/Boss'
import { Bullet } from '../objects/Bullet'
import { drawVignette } from '../ui'
import { sfx, startMusic, stopMusic } from '../audio'
import { STAGES, DEFAULT_STAGE, type StageDef } from '../stages'

const WORLD_W = 4000
const WORLD_H = 1600

export class GameScene extends Phaser.Scene {
  private player!: Player
  private ground!: Phaser.Tilemaps.TilemapLayer
  private platforms!: Phaser.Tilemaps.TilemapLayer
  private enemies!: Phaser.Physics.Arcade.Group
  private bullets!: Phaser.Physics.Arcade.Group
  private orbs!: Phaser.Physics.Arcade.Group
  private enemyBullets!: Phaser.Physics.Arcade.Group
  private checkpoint!: Phaser.GameObjects.Image
  private cpActive = false
  private boss?: Boss
  private bossBar!: Phaser.GameObjects.Graphics
  private bossName!: Phaser.GameObjects.Text
  private bossActive = false
  private hpBar!: Phaser.GameObjects.Graphics
  private powerText!: Phaser.GameObjects.Text
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private shootKey!: Phaser.Input.Keyboard.Key
  private muteKey!: Phaser.Input.Keyboard.Key
  private muteToast?: Phaser.GameObjects.Text
  private bgFar!: Phaser.GameObjects.TileSprite
  private bgMid!: Phaser.GameObjects.TileSprite
  private enemyCount = 0
  private stage: StageDef = DEFAULT_STAGE

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: { stage?: string; fresh?: boolean }) {
    this.stage = STAGES.find(s => s.id === data.stage) ?? DEFAULT_STAGE
    // A fresh entry from the stage select resets lives and checkpoint; a death-restart keeps them.
    if (data.fresh) {
      this.registry.set('lives', 3)
      this.registry.set('cp', false)
    }
    if (this.registry.get('lives') === undefined) {
      this.registry.set('lives', 3)
    }
    this.cpActive = this.registry.get('cp') === true
  }

  preload() {
    this.load.image('tileset', 'assets/tileset.png')
    this.load.tilemapTiledJSON('level', 'assets/level.json')
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 40, frameHeight: 60 })
    this.load.spritesheet('enemy', 'assets/enemy.png', { frameWidth: 45, frameHeight: 45 })
    this.load.spritesheet('boss', 'assets/boss.png', { frameWidth: 80, frameHeight: 80 })
    this.load.image('bullet', 'assets/bullet.png')
    this.load.image('bullet-mid', 'assets/bullet-mid.png')
    this.load.image('bullet-big', 'assets/bullet-big.png')
    this.load.image('orb', 'assets/orb.png')
    this.load.spritesheet('flyer', 'assets/flyer.png', { frameWidth: 40, frameHeight: 26 })
    this.load.image('turret', 'assets/turret.png')
    this.load.image('checkpoint', 'assets/checkpoint.png')
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
      maxSize: 24,
      runChildUpdate: true,
      allowGravity: false,
      immovable: true,
    })

    this.orbs = this.physics.add.group({
      allowGravity: false,
      immovable: true,
    })

    this.enemyBullets = this.physics.add.group({
      allowGravity: false,
      immovable: true,
      maxSize: 30,
    })

    this.enemies = this.physics.add.group({
      allowGravity: true,
      collideWorldBounds: true,
    })

    this.player = new Player(this, this.cpActive ? 2000 : 160, this.cpActive ? 1330 : 1330, this.bullets)
    this.player.powerUp = this.registry.get('power') === true

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    this.spawnCheckpoint()
    this.spawnEnemies()
    this.spawnEnergyPickups()

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    this.muteKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M)

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
    this.physics.add.overlap(
      this.player,
      this.orbs,
      this.handlePlayerCollectOrb as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    )
    this.physics.add.overlap(
      this.player,
      this.enemyBullets,
      this.handlePlayerHitByEnemyBullet as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    )
    this.physics.add.collider(this.enemyBullets, this.ground)
    this.physics.add.collider(this.enemyBullets, this.platforms)

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

    this.add.text(24, 72, '← → : move   |   ↑ : jump   |   Z : hold to charge', {
      fontSize: '12px', color: '#5a6280', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(200)

    this.powerText = this.add.text(24, 96, 'WAR POWER +', {
      fontSize: '13px', color: '#ff9d8a', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 3,
    }).setScrollFactor(0).setDepth(200).setVisible(this.player.powerUp)
    this.powerText.setShadow(0, 0, '#ff5546', 10, true, true)

    // Lives (mini hero icons)
    const lives = (this.registry.get('lives') as number) ?? 3
    for (let i = 0; i < lives; i++) {
      this.add.image(36 + i * 30, 128, 'player', 0)
        .setScale(0.6).setScrollFactor(0).setDepth(200)
    }

    // Audio: music loop + mute toggle (M)
    sfx.unlock()
    startMusic()
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stopMusic())

    drawVignette(this, 0.45)
    this.cameras.main.fadeIn(300, 0, 0, 0)
  }

  update(_time: number, delta: number) {
    const cam = this.cameras.main
    this.bgFar.tilePositionX = cam.scrollX * 0.15
    this.bgFar.tilePositionY = cam.scrollY * 0.06
    this.bgMid.tilePositionX = cam.scrollX * 0.35
    this.bgMid.tilePositionY = cam.scrollY * 0.12

    const left = this.cursors.left!.isDown
    const right = this.cursors.right!.isDown
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up!)
    const jumpHeld = this.cursors.up!.isDown
    const shootPressed = Phaser.Input.Keyboard.JustDown(this.shootKey)
    const shootHeld = this.shootKey.isDown
    const shootReleased = Phaser.Input.Keyboard.JustUp(this.shootKey)

    if (Phaser.Input.Keyboard.JustDown(this.muteKey)) {
      const m = sfx.toggleMute()
      if (!this.muteToast) {
        this.muteToast = this.add.text(this.cameras.main.width - 30, 60, '', {
          fontSize: '14px', color: '#9fb4d8', fontFamily: 'monospace',
        }).setOrigin(1, 0).setScrollFactor(0).setDepth(300)
      }
      this.muteToast.setText(m ? 'SOUND OFF' : 'SOUND ON').setAlpha(1)
      this.tweens.add({ targets: this.muteToast, alpha: 0, duration: 900, delay: 500 })
    }

    this.player.update(left, right, jump, jumpHeld, shootPressed, shootHeld, shootReleased, delta)
    this.drawHpBar()

    // Energy orbs: gentle magnet toward the player when close.
    this.orbs.children.iterate((child) => {
      const orb = child as Phaser.Physics.Arcade.Image
      if (!orb?.active) return true
      const body = orb.body as Phaser.Physics.Arcade.Body
      const dx = this.player.x - orb.x
      const dy = this.player.y - orb.y
      const d = Math.hypot(dx, dy)
      if (d < 140 && d > 1) body.setVelocity((dx / d) * 320, (dy / d) * 320)
      else body.setVelocity(0, 0)
      return true
    })

    this.enemies.children.iterate((child) => {
      const enemy = child as unknown as StageEnemy
      if (enemy.active) enemy.update(delta)
      return true
    })

    if (this.bossActive && this.boss?.active) {
      this.boss.update(delta)
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
    if (!this.anims.exists('flyer-fly')) {
      this.anims.create({
        key: 'flyer-fly',
        frames: this.anims.generateFrameNumbers('flyer', { start: 0, end: 1 }),
        frameRate: 10,
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
  spawnMuzzleFlash(x: number, y: number, scale = 0.28, flame = false) {
    const halo = this.add.image(x, y, 'glow')
      .setTint(flame ? 0xffb37a : 0x9df2ff).setBlendMode(Phaser.BlendModes.ADD).setScale(scale).setDepth(50)
    const core = this.add.circle(x, y, 4 + scale * 10, 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(51)
    this.tweens.add({
      targets: [halo, core], alpha: 0, scale: 1.9, duration: 80,
      onComplete: () => { halo.destroy(); core.destroy() },
    })
  }

  // ------------------------- Energy orbs -------------------------

  private spawnEnergyPickups() {
    const spots = [
      { x: 760, y: 1080 },
      { x: 1200, y: 920 },
      { x: 1800, y: 760 },
      { x: 2960, y: 680 },
      { x: 3560, y: 840 },
      { x: 2100, y: 1310 },
    ]
    for (const s of spots) this.spawnOrb(s.x, s.y, 'hp')
  }

  spawnOrb(x: number, y: number, kind: 'hp' | 'core') {
    const orb = this.orbs.create(x, y, 'orb') as Phaser.Physics.Arcade.Image
    orb.setDepth(30)
    orb.setData('kind', kind)
    if (kind === 'core') {
      orb.setScale(2.2).setTint(0xff6b5e)
      orb.body!.setSize(22, 22)
      this.tweens.add({ targets: orb, scale: 2.6, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
      this.tweens.add({ targets: orb, alpha: { from: 0.7, to: 1 }, duration: 300, yoyo: true, repeat: -1 })
    } else {
      orb.setScale(1).setTint(0x7dfca2)
      orb.body!.setSize(18, 18)
      this.tweens.add({ targets: orb, alpha: { from: 0.7, to: 1 }, duration: 650, yoyo: true, repeat: -1 })
    }
    return orb
  }

  private spawnCollectBurst(x: number, y: number, tint: number) {
    const p = this.add.particles(x, y, 'glow', {
      speed: { min: 90, max: 240 },
      scale: { start: 0.16, end: 0 },
      lifespan: 300,
      tint: [tint, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    p.explode(10)
    this.time.delayedCall(360, () => p.destroy())
  }

  private handlePlayerCollectOrb(
    player: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    orbObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    const p = player as Player
    const orb = orbObj as Phaser.Physics.Arcade.Image
    if (!orb.active) return
    const kind = orb.getData('kind') as 'hp' | 'core'
    const ox = orb.x, oy = orb.y
    orb.disableBody(true, true)

    if (kind === 'core') {
      this.absorbBossPower(ox, oy)
      return
    }
    p.heal(2)
    sfx.collect()
    this.spawnCollectBurst(ox, oy, 0x7dfca2)
  }

  /** Boss power absorbed: +1 damage on every shot, flame tint, cycling max-charge. */
  private absorbBossPower(x: number, y: number) {
    this.player.powerUp = true
    this.registry.set('power', true)
    sfx.powerup()
    this.cameras.main.flash(320, 255, 128, 96)
    this.spawnCollectBurst(x, y, 0xff6b5e)
    this.spawnExplosion(x, y, false)

    const { width } = this.cameras.main
    const t = this.add.text(width / 2, 150, 'WAR MACHINE POWER ABSORBED', {
      fontSize: '30px', color: '#ffb3a8', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 4,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setAlpha(0).setScale(0.8)
    t.setStroke('#1a0505', 8)
    t.setShadow(0, 0, '#ff5546', 22, true, true)
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 400, ease: 'Back.Out' })

    this.powerText.setVisible(true)
    this.time.delayedCall(1800, () => this.showStageClear())
    this.time.delayedCall(3800, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0)
      this.time.delayedCall(450, () => this.scene.start('StageSelectScene'))
    })
  }

  private showAllTargetsDown() {
    const { width } = this.cameras.main
    const t = this.add.text(width / 2, 190, 'ALL TARGETS DOWN', {
      fontSize: '24px', color: '#9df2ff', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setAlpha(0)
    t.setShadow(0, 0, '#35e0ff', 16, true, true)
    this.tweens.add({ targets: t, alpha: 1, duration: 350, yoyo: true, hold: 900,
      onComplete: () => t.destroy() })
  }

  private spawnEnemies() {
    const defs: Array<{ kind: 'walker' | 'flyer' | 'turret'; x: number; y: number }> = [
      { kind: 'walker', x: 640, y: 1075 },
      { kind: 'walker', x: 1080, y: 915 },
      { kind: 'flyer', x: 1520, y: 640 },
      { kind: 'walker', x: 2360, y: 915 },
      { kind: 'flyer', x: 2620, y: 560 },
      { kind: 'turret', x: 2260, y: 1342 },
      { kind: 'turret', x: 3150, y: 1342 },
      { kind: 'walker', x: 3480, y: 835 },
    ]
    for (const d of defs) {
      let enemy: StageEnemy
      if (d.kind === 'flyer') enemy = new Flyer(this, d.x, d.y, this.player)
      else if (d.kind === 'turret') enemy = new Turret(this, d.x, d.y, this.player)
      else enemy = new Enemy(this, d.x, d.y)
      this.enemies.add(enemy as unknown as Phaser.Physics.Arcade.Sprite)
      this.enemyCount++
    }
  }

  /** Mid-level holographic checkpoint: touching it moves the respawn point here. */
  private spawnCheckpoint() {
    const x = 2000, y = 1322
    this.checkpoint = this.add.image(x, y, 'checkpoint').setDepth(10)
    this.physics.add.existing(this.checkpoint)
    const body = (this.checkpoint as Phaser.Physics.Arcade.Image).body as Phaser.Physics.Arcade.Body
    body.setAllowGravity(false)
    body.setSize(56, 90)
    if (this.cpActive) this.activateCheckpointVisual()
    this.physics.add.overlap(
      this.player,
      this.checkpoint,
      () => {
        if (!this.cpActive) {
          this.cpActive = true
          this.registry.set('cp', true)
          this.activateCheckpointVisual()
          sfx.checkpoint()
          this.spawnCollectBurst(x, y - 16, 0x35e0ff)
          const t = this.add.text(x, y - 90, 'CHECKPOINT', {
            fontSize: '17px', color: '#9df2ff', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 4,
          }).setOrigin(0.5).setDepth(120).setAlpha(0)
          this.tweens.add({ targets: t, alpha: 1, y: y - 104, duration: 500, ease: 'Cubic.Out',
            onComplete: () => this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() }) })
        }
      },
      undefined,
      this,
    )
  }

  private activateCheckpointVisual() {
    this.checkpoint.setTint(0x7dfca2)
  }

  /** Aimed enemy projectile (boss volleys, turrets). */
  spawnEnemyBullet(x: number, y: number, tx: number, ty: number, speed = 350, tint = 0xff5546) {
    const b = this.enemyBullets.get(x, y, 'orb') as Phaser.Physics.Arcade.Image | null
    if (!b) return
    b.setTexture('orb')
    b.setActive(true).setVisible(true)
    b.body!.enable = true
    b.setTint(tint).setScale(0.75).setDepth(45)
    b.body!.setSize(18, 18)
    const ang = Math.atan2(ty - y, tx - x)
    b.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed)
    const token = this.time.now + Math.random()
    b.setData('token', token)
    this.time.delayedCall(3200, () => {
      if (b.active && b.getData('token') === token) b.disableBody(true, true)
    })
  }

  /** Ground shockwave from the boss slam. */
  spawnShockwave(x: number, y: number, dir: number) {
    const b = this.enemyBullets.get(x, y, 'orb') as Phaser.Physics.Arcade.Image | null
    if (!b) return
    b.setTexture('orb')
    b.setActive(true).setVisible(true)
    b.body!.enable = true
    b.setTint(0xffb347).setScale(1).setDepth(45)
    b.body!.setSize(18, 18)
    b.setVelocity(dir * 400, 0)
    const token = this.time.now + Math.random()
    b.setData('token', token)
    this.time.delayedCall(1500, () => {
      if (b.active && b.getData('token') === token) b.disableBody(true, true)
    })
  }

  private handlePlayerHitByEnemyBullet(
    player: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    const p = player as Player
    const b = bulletObj as Phaser.Physics.Arcade.Image
    if (!b.active) return
    b.disableBody(true, true)
    this.spawnSparks(b.x, b.y)
    p.takeDamage(2, b.body!.velocity.x >= 0 ? -1 : 1)
  }

  private spawnBoss() {
    const boss = new Boss(this, 3700, 1320, this.player, (hp, max) => this.drawBossBar(hp, max))
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

  /** Called by the Player when its HP reaches zero: life lost, respawn or game over. */
  onPlayerDeath() {
    sfx.explode()
    this.spawnExplosion(this.player.x, this.player.y, false)
    const lives = ((this.registry.get('lives') as number) ?? 1) - 1
    this.registry.set('lives', lives)
    if (lives > 0) {
      // Respawn: restart the stage but keep the remaining lives (no `fresh` flag).
      this.time.delayedCall(650, () => this.scene.restart({ stage: this.stage.id }))
    } else {
      this.gameOver()
    }
  }

  private gameOver() {
    stopMusic()
    sfx.gameOver()
    const { width, height } = this.cameras.main
    const veil = this.add.rectangle(width / 2, height / 2, width, height, 0x05060c, 0)
      .setScrollFactor(0).setDepth(400)
    this.tweens.add({ targets: veil, fillAlpha: 0.85, duration: 600 })

    const t = this.add.text(width / 2, height / 2 - 26, 'GAME OVER', {
      fontSize: '58px', color: '#ff6b5e', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 10,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(401).setAlpha(0).setScale(0.8)
    t.setStroke('#160404', 10)
    t.setShadow(0, 0, '#ff3524', 26, true, true)
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 500, ease: 'Back.Out' })

    const sub = this.add.text(width / 2, height / 2 + 34, 'RETURNING TO STAGE SELECT', {
      fontSize: '15px', color: '#8b93a8', fontFamily: 'monospace', letterSpacing: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(401)
    this.tweens.add({ targets: sub, alpha: { from: 1, to: 0.25 }, duration: 600, yoyo: true, repeat: -1 })

    this.time.delayedCall(2800, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0)
      this.time.delayedCall(450, () => this.scene.start('StageSelectScene'))
    })
  }

  private handleBulletHitBoss(
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    boss: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    const b = bullet as Bullet
    const bo = boss as Boss
    if (!b.active || !bo.active) return
    if (!b.canHit(bo)) return
    this.spawnSparks(b.x, b.y)
    bo.takeDamage(b.damage)
    if (b.pierce) b.markHit(bo)
    else b.disableBody(true, true)
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

  /** Called by the Boss when its HP reaches zero: drops its power core. */
  bossDefeated() {
    this.bossActive = false
    this.bossBar.clear()
    this.bossName.setVisible(false)
    sfx.bigExplode()
    if (this.boss) {
      this.spawnOrb(this.boss.x, this.boss.y - 10, 'core')
    }
  }

  private handleBulletHitEnemy(
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemyObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    const b = bullet as Bullet
    const e = enemyObj as unknown as StageEnemy
    if (!b.active || !e.active) return
    if (!b.canHit(e)) return

    this.spawnSparks(b.x, b.y)
    e.takeDamage(b.damage)

    if (!e.active) {
      this.enemyCount--
      if (Math.random() < 0.6) this.spawnOrb(e.x, e.y, 'hp')
      if (this.enemyCount <= 0) this.showAllTargetsDown()
    }

    if (b.pierce) b.markHit(e)
    else b.disableBody(true, true)
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
