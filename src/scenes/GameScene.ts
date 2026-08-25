import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy, type StageEnemy } from '../entities/Enemy'
import { Flyer } from '../entities/Flyer'
import { Turret } from '../entities/Turret'
import { Boss } from '../entities/Boss'
import { Bullet } from '../objects/Bullet'
import { drawVignette } from '../ui'
import { sfx, startMusic, stopMusic } from '../audio'
import { askAI } from '../ai'
import { getCompanion, type CompanionDef } from '../companions'
import { STAGES, DEFAULT_STAGE, type StageDef } from '../stages'
import { touchState, isTouchUI, consumeTouchEdges } from '../touch'

const WORLD_H = 320
// Actualisées en create() depuis level-entities.json (niveau généré).
let WORLD_W = 800

/** Contenu de level-entities.json (voir scripts/generate-level.mjs). */
interface LevelEntities {
  worldW: number
  spawnX: number
  spawnY: number
  bossX: number
  bossWarnX: number
  enemies: Array<{ kind: string; x: number; y: number }>
  checkpoints: Array<{ x: number; y: number }>
  orbs: Array<{ x: number; y: number }>
}

export class GameScene extends Phaser.Scene {
  player!: Player
  private ground!: Phaser.Tilemaps.TilemapLayer
  private platforms!: Phaser.Tilemaps.TilemapLayer
  private enemies!: Phaser.Physics.Arcade.Group
  private bullets!: Phaser.Physics.Arcade.Group
  private orbs!: Phaser.Physics.Arcade.Group
  private enemyBullets!: Phaser.Physics.Arcade.Group
  private ents!: LevelEntities
  private checkpoints: Phaser.GameObjects.Image[] = []
  private respawning = false
  private bossIntroDone = false
  private bossTauntBusy = false
  private bossTauntTimer = 6000
  private bossSpeech?: Phaser.GameObjects.Container
  private lastTaunt = ''
  private compData!: CompanionDef
  private companion!: Phaser.GameObjects.Image
  private companionGlow!: Phaser.GameObjects.Image
  private compBubble?: Phaser.GameObjects.Container
  private compBusy = false
  private compCooldown = 5000
  private compSaid = new Set<string>()
  private compT = 0
  private readonly fallbackTaunts: Record<string, string[]> = {
    intro: ['Ton existence prend fin ici, gardien.', 'Néon City m’appartient déjà.'],
    combat: ['Ta résistance est une erreur de programmation.', 'Je calcule déjà ta défaite.', "Chaque tir t'affaiblit. Chaque seconde me rend plus fort."],
    enraged: ['ASSEZ ! Je vais te rayer de mes registres !', 'Mes circuits brûlent... ta fin approche !'],
  }
  private boss?: Boss
  private bossBar!: Phaser.GameObjects.Graphics
  private bossName!: Phaser.GameObjects.Text
  private bossActive = false
  private hpBar!: Phaser.GameObjects.Graphics
  private powerText!: Phaser.GameObjects.Text
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private shootKey!: Phaser.Input.Keyboard.Key
  private muteKey!: Phaser.Input.Keyboard.Key
  private pauseKey!: Phaser.Input.Keyboard.Key
  private escKey!: Phaser.Input.Keyboard.Key
  private muteToast?: Phaser.GameObjects.Text
  private weBar!: Phaser.GameObjects.Graphics
  private bgFar!: Phaser.GameObjects.TileSprite
  private bgMid!: Phaser.GameObjects.TileSprite
  private enemyCount = 0
  private stage: StageDef = DEFAULT_STAGE
  // Previous-frame state of the touch buttons (edge detection for jump/shoot).
  private tPrevJump = false
  private tPrevShoot = false

  constructor() {
    super({ key: 'GameScene' })
  }

  init(data: { stage?: string; fresh?: boolean }) {
    this.stage = STAGES.find(s => s.id === data.stage) ?? DEFAULT_STAGE
    // A fresh entry from the stage select resets lives and checkpoint; a death-restart keeps them.
    if (data.fresh) {
      this.registry.set('lives', 3)
      this.registry.set('cpX', undefined)
      this.registry.set('cpY', undefined)
      this.registry.set('briefed', false)
    }
    if (this.registry.get('lives') === undefined) {
      this.registry.set('lives', 3)
    }
    // Appuis tactiles hérités de l'écran précédent : ignorés au spawn.
    this.tPrevJump = touchState.jump
    this.tPrevShoot = touchState.shoot
  }

  preload() {
    const comp = getCompanion(this.registry.get('companion'))
    this.load.image(comp.texture, `assets/${comp.texture}.png`)
    this.load.image('tileset', 'assets/tileset.png')
    this.load.tilemapTiledJSON('level', `assets/level-${this.stage.id}.json`)
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 22, frameHeight: 30 })
    this.load.spritesheet('enemy', 'assets/enemy.png', { frameWidth: 22, frameHeight: 22 })
    this.load.spritesheet('boss', 'assets/boss.png', { frameWidth: 44, frameHeight: 44 })
    this.load.image('bullet', 'assets/bullet.png')
    this.load.image('bullet-mid', 'assets/bullet-mid.png')
    this.load.image('bullet-big', 'assets/bullet-big.png')
    this.load.image('orb', 'assets/orb.png')
    this.load.spritesheet('flyer', 'assets/flyer.png', { frameWidth: 20, frameHeight: 14 })
    this.load.image('turret', 'assets/turret.png')
    this.load.image('checkpoint', 'assets/checkpoint.png')
    this.load.image(`bg-far-${this.stage.id}`, `assets/bg-far-${this.stage.id}.png`)
    this.load.image(`bg-mid-${this.stage.id}`, `assets/bg-mid-${this.stage.id}.png`)
    this.load.image('haze', 'assets/haze.png')
    this.load.json('level-entities', `assets/entities-${this.stage.id}.json`)
  }

  create() {
    this.createAnimations()
    this.respawning = false

    // Niveau généré : taille du monde + entités (ennemis, checkpoints, orbes).
    this.ents = this.cache.json.get('level-entities') as LevelEntities
    WORLD_W = this.ents.worldW

    // Clamp du delta physique à ~33 ms (plancher 30 fps) : au-delà, le jeu
    // ralentit au lieu de laisser les corps traverser les tuiles (tunneling).
    const world = this.physics.world
    if (!(world as unknown as { _deltaClamped?: boolean })._deltaClamped) {
      ;(world as unknown as { _deltaClamped?: boolean })._deltaClamped = true
      const worldUpdate = world.update.bind(world)
      world.update = (time: number, delta: number) => worldUpdate(time, Math.min(delta, 33.4))
    }

    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H)
    // Fond du monde étendu : le joueur peut tomber dans les trous (puis mourir),
    // la caméra reste clampée à WORLD_H → il tombe hors du champ visuel.
    this.physics.world.setBounds(0, 0, WORLD_W, WORLD_H + 120)

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

    const spawnX = ((this.registry.get('cpX') as number | undefined) ?? this.ents.spawnX)
    const spawnY = ((this.registry.get('cpY') as number | undefined) ?? this.ents.spawnY)
    this.player = new Player(this, spawnX, spawnY, this.bullets)
    this.player.powerUp = this.registry.get('power') === true

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)

    this.spawnCheckpoint()
    this.spawnEnemies()
    this.spawnEnergyPickups()

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    this.muteKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.M)
    this.pauseKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.P)
    this.escKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)

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
    // Un projectile ennemi qui touche le sol est désactivé (explosion) — sauf
    // les ondes de choc du boss, qui voyagent le long du sol (kind 'shockwave').
    // Le contexte `this` est obligatoire : sans lui, `this.spawnSparks` n'existe
    // pas dans le callback (this = monde arcade).
    this.physics.add.collider(
      this.enemyBullets,
      this.ground,
      this.handleEnemyBulletGround as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    )
    this.physics.add.collider(
      this.enemyBullets,
      this.platforms,
      this.handleEnemyBulletGround as Phaser.Types.Physics.Arcade.ArcadePhysicsCallback,
      undefined,
      this,
    )

    // Boss HP bar must exist before the boss spawns (spawn draws it once).
    // Top-right placement so it never covers the player.
    this.bossBar = this.add.graphics().setScrollFactor(0).setDepth(200)
    this.bossName = this.add.text(536, 4, 'WAR MACHINE', {
      fontSize: '8px', color: '#ff9d9d', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 1,
    }).setScrollFactor(0).setDepth(200).setVisible(false)
    this.spawnBoss()

    // HUD
    this.hpBar = this.add.graphics().setScrollFactor(0).setDepth(200)
    this.weBar = this.add.graphics().setScrollFactor(0).setDepth(200)
    this.add.text(6, 3, 'HP', {
      fontSize: '7px', color: '#9fb4d8', fontFamily: 'monospace', fontStyle: 'bold',
    }).setScrollFactor(0).setDepth(200)
    this.add.text(6, 14, this.stage.name, {
      fontSize: '8px', color: '#a9b3cf', fontFamily: 'monospace', letterSpacing: 1,
    }).setScrollFactor(0).setDepth(200)

    this.add.text(6, 24, isTouchUI() ? '◀▶ MOVE A JUMP B=CHARGE ⏸=PAUSE' : '←→:move ↑:jump Z:charge P:pause', {
      fontSize: '7px', color: '#5a6280', fontFamily: 'monospace',
    }).setScrollFactor(0).setDepth(200)

    this.powerText = this.add.text(6, 34, 'WAR POWER +', {
      fontSize: '7px', color: '#ff9d8a', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 3,
    }).setScrollFactor(0).setDepth(200).setVisible(this.player.powerUp)
    this.powerText.setShadow(0, 0, '#ff5546', 10, true, true)

    // Lives (mini hero icons)
    const lives = (this.registry.get('lives') as number) ?? 3
    for (let i = 0; i < lives; i++) {
      this.add.image(8 + i * 13, 44, "player", 0)
        .setScale(0.5).setScrollFactor(0).setDepth(200)
    }

    // Compagnon — drone choisi sur l'écran de sélection
    this.compData = getCompanion(this.registry.get('companion'))
    this.companion = this.add.image(this.player.x - 20, this.player.y - 30, this.compData.texture)
      .setTint(this.compData.tint).setScale(1).setDepth(35)
    this.companionGlow = this.add.image(this.companion.x, this.companion.y, 'glow')
      .setTint(this.compData.bubble).setBlendMode(Phaser.BlendModes.ADD).setScale(0.14).setAlpha(0.3).setDepth(34)

    // Audio: stage theme + mute toggle (M)
    sfx.unlock()
    startMusic('stage')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => stopMusic())

    if (!this.registry.get('briefed')) {
      this.registry.set('briefed', true)
      this.time.delayedCall(600, () => this.showBriefing())
    }

    drawVignette(this, 0.45)
    this.cameras.main.fadeIn(300, 0, 0, 0)

    // Apparition : matérialisation + courte invulnérabilité (spawn / respawn).
    this.spawnTeleportEffect(this.player.x, this.player.y)
    this.player.grantInvulnerability(1300)
  }

  update(_time: number, delta: number) {
    const cam = this.cameras.main
    this.bgFar.tilePositionX = cam.scrollX * 0.15
    this.bgFar.tilePositionY = cam.scrollY * 0.06
    this.bgMid.tilePositionX = cam.scrollX * 0.35
    this.bgMid.tilePositionY = cam.scrollY * 0.12

    if (!this.bossIntroDone && this.player.x > this.ents.bossWarnX) this.bossWarning()

    // Merge keyboard + touch (virtual pad). Touch edges are computed against
    // the previous frame, plus a queue for taps shorter than one rendered
    // frame (low-FPS phones) so no press is ever lost.
    const q = consumeTouchEdges()
    const left = this.cursors.left!.isDown || touchState.left
    const right = this.cursors.right!.isDown || touchState.right
    const jump = Phaser.Input.Keyboard.JustDown(this.cursors.up!) || (touchState.jump && !this.tPrevJump) || q.jump
    const jumpHeld = this.cursors.up!.isDown || touchState.jump
    const shootHeld = this.shootKey.isDown || touchState.shoot
    const shootPressed = Phaser.Input.Keyboard.JustDown(this.shootKey) || (touchState.shoot && !this.tPrevShoot) || q.shoot
    this.tPrevJump = touchState.jump
    this.tPrevShoot = touchState.shoot

    // Pause : touche P/ESC au clavier, bouton ⏸ du pad tactile sur mobile.
    if (q.pause || Phaser.Input.Keyboard.JustDown(this.pauseKey) || Phaser.Input.Keyboard.JustDown(this.escKey)) {
      sfx.checkpoint()
      this.scene.launch('PauseScene')
      this.scene.pause()
      return
    }

    // Mort par chute : tomber dans un trou = perte d'une vie (respawn checkpoint).
    if (!this.respawning && !this.player.isDead() && this.player.y > WORLD_H + 30) {
      this.playerFall()
      return
    }

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

    const weapon = this.registry.get('weapon') === 'war' && this.registry.get('power') ? 'war' : 'buster'
    this.player.weapon = weapon
    this.player.update(left, right, jump, jumpHeld, shootPressed, shootHeld, delta)
    this.drawHpBar()
    if (weapon === 'war') this.drawWeBar()
    else this.weBar.clear()

    // Energy orbs: gentle magnet toward the player when close.
    this.orbs.children.iterate((child) => {
      const orb = child as Phaser.Physics.Arcade.Image
      if (!orb?.active) return true
      const body = orb.body as Phaser.Physics.Arcade.Body
      const dx = this.player.x - orb.x
      const dy = this.player.y - orb.y
      const d = Math.hypot(dx, dy)
      if (d < 56 && d > 1) body.setVelocity((dx / d) * 64, (dy / d) * 64)
      else body.setVelocity(0, 0)
      return true
    })

    this.enemies.children.iterate((child) => {
      const enemy = child as unknown as StageEnemy
      if (enemy.active) enemy.update(delta)
      return true
    })

    if (this.bossActive && this.bossIntroDone && this.boss?.active) {
      // Le boss n'entre en action qu'après son écran WARNING (x>660) :
      // sinon il marche vers le joueur dès le spawn et rencontre le niveau.
      this.boss.update(delta)
      this.drawBossBar()
      this.bossTauntTimer -= delta
      if (this.bossTauntTimer <= 0 && !this.bossTauntBusy) {
        this.bossTauntTimer = 9500
        void this.requestBossTaunt('combat')
      }
    }

    // ORION suit le joueur avec un léger retard
    this.compT += delta
    const tx = this.player.x + (this.player.flipX ? 20 : -20)
    const ty = this.player.y - 30 + Math.sin(this.compT / 420) * 4
    this.companion.x += (tx - this.companion.x) * 0.08
    this.companion.y += (ty - this.companion.y) * 0.08
    this.companionGlow.setPosition(this.companion.x, this.companion.y)
    this.compCooldown -= delta
    if (this.player.getHealth() <= 3 && !this.compSaid.has('lowhp') && this.compCooldown <= 0) {
      this.compSaid.add('lowhp')
      void this.companionSay('lowhp')
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
      .setScale(1, 1)

    // Slow ambient light motes drifting upward (screen space).
    this.add.particles(0, 0, 'glow', {
      x: { min: 0, max: width },
      y: { min: 0, max: height },
      lifespan: 8000,
      speedY: { min: -5, max: -1.5 },
      speedX: { min: -2, max: 2 },
      scale: { start: 0.015, end: 0.045 },
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
    const x = 20, y = 5, w = 84, h = 6
    const frac = Math.max(0, hp / max)
    this.hpBar.clear()
    this.hpBar.fillStyle(0x0a0d16, 0.75).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 3)
    this.hpBar.lineStyle(1, 0x3a4358, 1).strokeRoundedRect(x - 2, y - 2, w + 4, h + 4, 3)
    this.hpBar.fillStyle(0x1a2030, 1).fillRoundedRect(x, y, w, h, 3)
    if (frac > 0) {
      const fw = Math.max(10, w * frac)
      this.hpBar.fillGradientStyle(0x8df2ff, 0x35e0ff, 0x2b6bcb, 0x1d3f8f, 1)
      this.hpBar.fillRoundedRect(x, y, fw, h, 4)
      this.hpBar.fillStyle(0xffffff, 0.28).fillRoundedRect(x + 1, y + 1, Math.max(2, fw - 2), 2, 1)
    }
    this.hpBar.fillStyle(0x0a0d16, 0.5)
    for (let i = 1; i < 10; i++) this.hpBar.fillRect(x + (w / 10) * i, y, 1, h)
  }

  /** Barre d'énergie du canon war (HUD). */
  private drawWeBar() {
    // Sous le bloc HP / vie : on évite le pouvoir (y=34) et les icônes de vie (y=44).
    const x = 20, y = 56, w = 84, h = 5
    const frac = Math.max(0, this.player.getWe() / this.player.getWeMax())
    this.weBar.clear()
    this.weBar.fillStyle(0x0a0d16, 0.75).fillRoundedRect(x - 2, y - 2, w + 4, h + 4, 3)
    this.weBar.fillStyle(0x1a2030, 1).fillRect(x, y, w, h)
    if (frac > 0) {
      this.weBar.fillGradientStyle(0xffc857, 0xff9a3c, 0xb87808, 0x8a5a06, 1)
      this.weBar.fillRect(x, y, Math.max(2, w * frac), h)
    }
    this.weBar.fillStyle(0x0a0d16, 0.5)
    for (let i = 1; i < 7; i++) this.weBar.fillRect(x + (w / 7) * i, y, 1, h)
  }

  /** Yellow-white impact sparks at a world position. */
  spawnSparks(x: number, y: number) {
    const p = this.add.particles(x, y, 'glow', {
      speed: { min: 30, max: 70 },
      scale: { start: 0.05, end: 0 },
      lifespan: 260,
      tint: [0xffffff, 0xfacc15, 0xfb923c],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    p.explode(8)
    this.time.delayedCall(320, () => p.destroy())
  }

  /** Orange explosion burst + shockwave ring at a world position. */
  spawnExplosion(x: number, y: number, big = false) {
    const p = this.add.particles(x, y, 'glow', {
      speed: { min: big ? 30 : 20, max: big ? 90 : 60 },
      scale: { start: big ? 0.15 : 0.1, end: 0 },
      lifespan: big ? 620 : 420,
      tint: [0xfbbf24, 0xf97316, 0xef4444],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    p.explode(big ? 24 : 12)
    this.time.delayedCall(big ? 680 : 480, () => p.destroy())

    const ring = this.add.circle(x, y, big ? 6 : 3).setStrokeStyle(1.5, 0xffffff, 1)
    this.tweens.add({
      targets: ring,
      radius: big ? 48 : 22,
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
      speed: { min: 10, max: 28 },
      angle: { min: 200, max: 340 },
      scale: { start: 0.05, end: 0 },
      lifespan: 280,
      alpha: { start: 0.5, end: 0 },
      tint: [0x94a3b8, 0xcbd5e1],
      emitting: false,
    })
    p.explode(5)
    this.time.delayedCall(340, () => p.destroy())
  }

  /** One-frame muzzle flash at the buster tip. */
  spawnMuzzleFlash(x: number, y: number, scale = 0.1, flame = false) {
    const halo = this.add.image(x, y, 'glow')
      .setTint(flame ? 0xffb37a : 0x9df2ff).setBlendMode(Phaser.BlendModes.ADD).setScale(scale).setDepth(50)
    const core = this.add.circle(x, y, 1.5 + scale * 8, 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setDepth(51)
    this.tweens.add({
      targets: [halo, core], alpha: 0, scale: 1.9, duration: 80,
      onComplete: () => { halo.destroy(); core.destroy() },
    })
  }

  /** Apparition du joueur : halo doux + motes ascendantes + onde + flash. */
  private spawnTeleportEffect(x: number, y: number) {
    // Halo doux (pas une colonne dure : un beam étiré passait sur le sprite et
    // se lisait comme une barre cyan/verte sur le héros).
    const beam = this.add.image(x, y, 'glow')
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(38)
      .setTint(0x9df2ff).setScale(0.85, 1.5).setAlpha(0)
    this.tweens.add({
      targets: beam, alpha: { from: 0.45, to: 0 }, scale: 1.3, duration: 380,
      ease: 'Cubic.Out', onComplete: () => beam.destroy(),
    })

    // Motes ascendantes (direction 270° ≈ vers le haut).
    const p = this.add.particles(x, y, 'glow', {
      speed: { min: 14, max: 44 },
      angle: { min: 250, max: 290 },
      scale: { start: 0.09, end: 0 },
      lifespan: 540,
      tint: [0x9df2ff, 0xffffff, 0x35e0ff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    p.explode(18)
    this.time.delayedCall(620, () => p.destroy())

    // Onde d'apparition circulaire.
    const ring = this.add.circle(x, y, 4).setStrokeStyle(2, 0x9df2ff, 1)
    this.tweens.add({
      targets: ring, radius: 32, alpha: 0, duration: 400,
      ease: 'Cubic.Out', onComplete: () => ring.destroy(),
    })

    this.cameras.main.flash(220, 160, 200, 255)
  }

  /** Éclat de mort : grosse explosion + onde + flash + débris rouges. */
  private spawnDeathEffect(x: number, y: number) {
    this.cameras.main.flash(240, 255, 90, 80)
    this.spawnExplosion(x, y, true)

    const ring = this.add.circle(x, y, 10).setStrokeStyle(3, 0xff5546, 1)
    this.tweens.add({
      targets: ring, radius: 70, alpha: 0, duration: 520,
      ease: 'Cubic.Out', onComplete: () => ring.destroy(),
    })

    const p = this.add.particles(x, y, 'glow', {
      speed: { min: 40, max: 120 },
      scale: { start: 0.12, end: 0 },
      lifespan: 700,
      tint: [0xff5546, 0xffb37a, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    p.explode(28)
    this.time.delayedCall(760, () => p.destroy())
  }

  // ------------------------- Energy orbs -------------------------

  private spawnEnergyPickups() {
    for (const s of this.ents.orbs) this.spawnOrb(s.x, s.y, 'hp')
  }

  spawnOrb(x: number, y: number, kind: 'hp' | 'core') {
    const orb = this.orbs.create(x, y, 'orb') as Phaser.Physics.Arcade.Image
    orb.setDepth(30)
    orb.setData('kind', kind)
    if (kind === 'core') {
      orb.setScale(1.4).setTint(0xff6b5e)
      orb.body!.setSize(8, 8)
      this.tweens.add({ targets: orb, scale: 1.6, duration: 550, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
      this.tweens.add({ targets: orb, alpha: { from: 0.7, to: 1 }, duration: 300, yoyo: true, repeat: -1 })
    } else {
      orb.setScale(1).setTint(0x7dfca2)
      orb.body!.setSize(6, 6)
      this.tweens.add({ targets: orb, alpha: { from: 0.7, to: 1 }, duration: 650, yoyo: true, repeat: -1 })
    }
    return orb
  }

  private spawnCollectBurst(x: number, y: number, tint: number) {
    const p = this.add.particles(x, y, 'glow', {
      speed: { min: 18, max: 48 },
      scale: { start: 0.05, end: 0 },
      lifespan: 300,
      tint: [tint, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    p.explode(8)
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
    p.addWe(6)
    sfx.collect()
    this.spawnCollectBurst(ox, oy, 0x7dfca2)
  }

  /** Boss power absorbed: +1 damage on every shot, flame tint, cycling max-charge. */
  private absorbBossPower(x: number, y: number) {
    this.player.powerUp = true
    this.registry.set('power', true)
    sfx.powerup()
    void this.companionSay('power')
    this.cameras.main.flash(320, 255, 128, 96)
    this.spawnCollectBurst(x, y, 0xff6b5e)
    this.spawnExplosion(x, y, false)

    const { width } = this.cameras.main
    const t = this.add.text(width / 2, 58, 'WAR MACHINE POWER ABSORBED', {
      fontSize: '12px', color: '#ffb3a8', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setAlpha(0).setScale(0.8)
    t.setStroke('#1a0505', 3)
    t.setShadow(0, 0, '#ff5546', 9, true, true)
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 400, ease: 'Back.Out' })

    this.powerText.setVisible(true)
    this.time.delayedCall(1000, () => {
      const epi = this.add.text(width / 2, 84, 'Le cœur de la machine est à vous...', {
        fontSize: '9px', color: '#c7d2e8', fontFamily: 'monospace', fontStyle: 'italic',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setAlpha(0)
      this.tweens.add({ targets: epi, alpha: 1, duration: 500 })
    })
    this.time.delayedCall(1800, () => this.showStageClear())
    this.time.delayedCall(3800, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0)
      this.time.delayedCall(450, () => this.scene.start('StageSelectScene'))
    })
  }

  private showAllTargetsDown() {
    const { width } = this.cameras.main
    const t = this.add.text(width / 2, 76, 'ALL TARGETS DOWN', {
      fontSize: '10px', color: '#9df2ff', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setAlpha(0)
    t.setShadow(0, 0, '#35e0ff', 6, true, true)
    this.tweens.add({ targets: t, alpha: 1, duration: 350, yoyo: true, hold: 900,
      onComplete: () => t.destroy() })
  }

  private spawnEnemies() {
    for (const d of this.ents.enemies) {
      let enemy: StageEnemy
      if (d.kind === 'flyer') enemy = new Flyer(this, d.x, d.y, this.player)
      else if (d.kind === 'turret') enemy = new Turret(this, d.x, d.y, this.player)
      else enemy = new Enemy(this, d.x, d.y, this.player)
      this.enemies.add(enemy as unknown as Phaser.Physics.Arcade.Sprite)
      this.enemyCount++
    }
  }

  /** Un marcheur est tombé dans un trou en pourchassant : ajuster le compteur. */
  onEnemyFell(e: StageEnemy) {
    if (!e.active) return
    this.enemyCount--
    if (this.enemyCount <= 0) this.showAllTargetsDown()
  }

  /** Several holographic checkpoints: touching one moves the respawn point there. */
  private spawnCheckpoint() {
    this.checkpoints = []
    for (const cp of this.ents.checkpoints) {
      const { x, y } = cp
      const img = this.add.image(x, y, 'checkpoint').setDepth(10)
      this.physics.add.existing(img)
      const body = (img as Phaser.Physics.Arcade.Image).body as Phaser.Physics.Arcade.Body
      body.setAllowGravity(false)
      body.setSize(20, 32)
      this.checkpoints.push(img)

      this.physics.add.overlap(this.player, img, () => {
        // Ne réactive le checkpoint que si c'est un nouveau point (vers la droite).
        const prevX = this.registry.get('cpX') as number | undefined
        if (prevX === undefined || x > prevX) {
          this.registry.set('cpX', x)
          this.registry.set('cpY', y)
          img.setTint(0x7dfca2)
          sfx.checkpoint()
          void this.companionSay('checkpoint')
          this.spawnCollectBurst(x, y - 8, 0x35e0ff)
          const t = this.add.text(x, y - 34, 'CHECKPOINT', {
            fontSize: '8px', color: '#9df2ff', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 1,
          }).setOrigin(0.5).setDepth(120).setAlpha(0)
          this.tweens.add({ targets: t, alpha: 1, y: y - 40, duration: 500, ease: 'Cubic.Out',
            onComplete: () => this.tweens.add({ targets: t, alpha: 0, delay: 900, duration: 400, onComplete: () => t.destroy() }) })
        }
      }, undefined, this)
    }
    // Si on a déjà un checkpoint actif (retour de mort), teinter celui correspondant.
    const activeX = this.registry.get('cpX') as number | undefined
    if (activeX !== undefined) {
      const img = this.checkpoints.find(c => Math.abs(c.x - activeX) < 1)
      if (img) img.setTint(0x7dfca2)
    }
  }

  /** Aimed enemy projectile (boss volleys, turrets). */
  spawnEnemyBullet(x: number, y: number, tx: number, ty: number, speed = 350, tint = 0xff5546) {
    const b = this.enemyBullets.get(x, y, 'orb') as Phaser.Physics.Arcade.Image | null
    if (!b) return
    b.setTexture('orb')
    b.setActive(true).setVisible(true)
    b.body!.enable = true
    b.setTint(tint).setScale(1).setDepth(45)
    b.body!.setSize(6, 6)
    const ang = Math.atan2(ty - y, tx - x)
    b.setVelocity(Math.cos(ang) * speed, Math.sin(ang) * speed)
    const token = this.time.now + Math.random()
    b.setData('token', token)
    b.setData('kind', 'bullet') // réinit au cas où l'objet recyclé était une onde de choc
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
    b.body!.setSize(6, 6)
    b.setVelocity(dir * 80, 0)
    const token = this.time.now + Math.random()
    b.setData('token', token)
    b.setData('kind', 'shockwave')
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

  /** Projectile ennemi bloqué par le sol : désactivé — sauf ondes de choc. */
  private handleEnemyBulletGround(
    bulletObj: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    _collider: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    const b = bulletObj as Phaser.Physics.Arcade.Image
    if (!b.active) return
    if (b.getData('kind') === 'shockwave') return
    this.spawnSparks(b.x, b.y)
    b.disableBody(true, true)
  }

  private spawnBoss() {
    const boss = new Boss(this, this.ents.bossX, 262, this.player, (hp, max) => this.drawBossBar(hp, max))
    this.boss = boss
    this.bossActive = true
    // Colliders sur les DEUX couches : sans `ground`, le boss tombait à
    // travers le sol et se battait depuis sous le niveau (inhittable).
    this.physics.add.collider(this.boss, this.ground)
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
    const x = 124, y = 10, barW = 120, barH = 6
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
      this.bossBar.fillStyle(0xffffff, 0.3).fillRoundedRect(x + 1, y + 1, Math.max(2, fw - 2), 2, 1)
    }
    this.bossBar.fillStyle(0x0a0d16, 0.55)
    for (let i = 1; i < 10; i++) this.bossBar.fillRect(x + (barW / 10) * i, y, 1.5, barH)
  }

  /** Mission briefing shown once at stage start — who, where, why. */
  private showBriefing() {
    const { width, height } = this.cameras.main
    const strip = this.add.rectangle(width / 2, height - 22, width, 34, 0x05060c, 0)
      .setScrollFactor(0).setDepth(240)
    const t1 = this.add.text(width / 2, height - 32, `MISSION 01 — ${this.stage.name}`, {
      fontSize: '8px', color: '#9df2ff', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(241).setAlpha(0)
    const t2 = this.add.text(width / 2, height - 18, 'Libérez le secteur. Détruisez le WAR MACHINE.', {
      fontSize: '8px', color: '#e2e8f0', fontFamily: 'monospace',
    }).setOrigin(0.5).setScrollFactor(0).setDepth(241).setAlpha(0)
    this.tweens.add({ targets: strip, fillAlpha: 0.78, duration: 350 })
    this.tweens.add({ targets: [t1, t2], alpha: 1, duration: 350, delay: 200 })
    sfx.checkpoint()
    this.time.delayedCall(4200, () => {
      this.tweens.add({
        targets: [strip, t1, t2], alpha: 0, duration: 400,
        onComplete: () => { strip.destroy(); t1.destroy(); t2.destroy() },
      })
      if (!this.compSaid.has('start')) {
        this.compSaid.add('start')
        void this.companionSay('start')
      }
    })
  }

  /** ORION comments on progression — async AI with canned fallbacks. */
  private async companionSay(kind: string) {
    if (this.compBusy || this.compCooldown > 0) return
    this.compBusy = true
    const hpPct = Math.round((this.player.getHealth() / 10) * 100)
    const reply = await askAI(
      this.compData.persona + ' Réponds par UNE phrase courte (12 mots maximum), sans guillemets.',
      kind === 'start' ? 'Le stage commence. Un mot de soutien.'
      : kind === 'firstblood' ? 'Le premier ennemi vient d’être détruit. Commente.'
      : kind === 'clear' ? 'Tous les ennemis du secteur sont détruits. Commente.'
      : kind === 'lowhp' ? `Les points de vie de BLASTER-01 sont à ${hpPct}%. Alerte-le.`
      : kind === 'checkpoint' ? 'BLASTER-01 vient d’activer un checkpoint. Commente.'
      : 'BLASTER-01 vient d’absorber le pouvoir du WAR MACHINE. Réagis.',
      70, 7000)
    const pool = this.compData.lines[kind] ?? this.compData.lines.start
    const line = (reply && reply !== this.lastTaunt ? reply : pool[Math.floor(Math.random() * pool.length)])
    this.showCompanionSpeech(line)
    this.compCooldown = 8000
    this.time.delayedCall(4200, () => { this.compBusy = false })
  }

  /** Cyan comm bubble, bottom-left. */
  private showCompanionSpeech(text: string) {
    this.compBubble?.destroy()
    const { height } = this.cameras.main
    const cont = this.add.container(0, 0).setScrollFactor(0).setDepth(230)
    const box = this.add.rectangle(96, height - 26, 168, 30, 0x06101c, 0.88)
      .setStrokeStyle(1.5, this.compData.bubble, 0.85)
    const tag = this.add.text(20, height - 46, this.compData.name, {
      fontSize: '6px', color: '#9df2ff', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 1,
    })
    const msg = this.add.text(96, height - 24, '', {
      fontSize: '8px', color: '#d5ecf8', fontFamily: 'monospace',
      wordWrap: { width: 150 }, align: 'center',
    }).setOrigin(0.5, 0.5)
    cont.add([box, tag, msg])
    cont.setAlpha(0)
    this.tweens.add({ targets: cont, alpha: 1, duration: 180 })
    this.typeInto(msg, text)
    this.compBubble = cont
    this.time.delayedCall(3800, () => {
      if (!cont.active) return
      this.tweens.add({ targets: cont, alpha: 0, duration: 300, onComplete: () => {
        cont.destroy()
        if (this.compBubble === cont) this.compBubble = undefined
      } })
    })
  }

  /** Classic boss encounter intro: letterbox + WARNING flash. */
  private bossWarning() {
    this.bossIntroDone = true
    const { width, height } = this.cameras.main
    const top = this.add.rectangle(width / 2, 0, width, 0, 0x000000, 0.85).setScrollFactor(0).setDepth(240)
    const bottom = this.add.rectangle(width / 2, height, width, 0, 0x000000, 0.85).setScrollFactor(0).setDepth(240)
    this.tweens.add({ targets: top, height: 26, duration: 260 })
    this.tweens.add({ targets: bottom, height: 26, duration: 260 })
    sfx.telegraph()
    this.time.delayedCall(300, () => sfx.bossShot())

    const warn = this.add.text(width / 2, height / 2 - 14, 'WARNING', {
      fontSize: '20px', color: '#ff3524', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 6,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(241).setAlpha(0)
    warn.setShadow(0, 0, '#ff3524', 10, true, true)
    const name = this.add.text(width / 2, height / 2 + 8, 'WAR MACHINE — GARDIEN CORROMPU', {
      fontSize: '9px', color: '#ffb3a8', fontFamily: 'monospace', letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(241).setAlpha(0)
    this.tweens.add({ targets: warn, alpha: 1, duration: 200, yoyo: true, repeat: 3 })
    this.tweens.add({ targets: name, alpha: 1, duration: 300, delay: 500 })

    this.time.delayedCall(2600, () => {
      this.tweens.add({
        targets: [top, bottom, warn, name], alpha: 0, duration: 350,
        onComplete: () => { top.destroy(); bottom.destroy(); warn.destroy(); name.destroy() },
      })
      void this.requestBossTaunt('intro')
    })
  }

  /** Called by the Boss when it enrages (HP <= 50%). */
  onBossEnraged() {
    void this.requestBossTaunt('enraged')
  }

  /** AI-generated taunt via /api/ai — async, never blocks; falls back to canned lines. */
  private async requestBossTaunt(kind: 'intro' | 'combat' | 'enraged') {
    if (this.bossTauntBusy || !this.bossActive) return
    this.bossTauntBusy = true
    const hpPct = Math.round(((this.boss?.getHealth() ?? 30) / 30) * 100)
    const playerHp = Math.round((this.player.getHealth() / 10) * 100)
    const userLine = kind === 'intro'
      ? 'Le combat commence. Une phrase d’ouverture menaçante.'
      : kind === 'enraged'
        ? `Ton intégrité tombe à ${hpPct}%. Une phrase de rage.`
        : `Combat en cours — ton intégrité ${hpPct}%, celle de BLASTER-01 ${playerHp}%. Une moquerie.`
    const text = (await askAI(
      "Tu es WAR MACHINE, une IA de guerre corrompue de Néon City. Tu affrontes BLASTER-01, le dernier gardien loyal. Réponds par UNE seule phrase courte (12 mots maximum), froide et moqueuse. Sans guillemets, sans préfixe, sans didascalie.",
      userLine, 70, 7000)) ?? ''
    if (text.length > 3 && text !== this.lastTaunt) {
      this.lastTaunt = text
      this.showBossSpeech(text)
    } else {
      const pool = this.fallbackTaunts[kind] ?? this.fallbackTaunts.combat
      const pick = pool[Math.floor(Math.random() * pool.length)]
      if (pick !== this.lastTaunt) {
        this.lastTaunt = pick
        this.showBossSpeech(pick)
      }
    }
    this.time.delayedCall(4300, () => { this.bossTauntBusy = false })
  }

  /** Machine-à-écrire : révèle le texte caractère par caractère. */
  private typeInto(msg: Phaser.GameObjects.Text, full: string) {
    msg.setText('')
    let i = 0
    this.time.addEvent({
      delay: 18,
      repeat: Math.max(0, full.length - 1),
      callback: () => {
        if (!msg.active) return
        i++
        msg.setText(full.slice(0, i))
      },
    })
  }

  /** Comm-line speech bubble under the boss bar. */
  private showBossSpeech(text: string) {
    this.bossSpeech?.destroy()
    const { width } = this.cameras.main
    const cont = this.add.container(0, 0).setScrollFactor(0).setDepth(230)
    const box = this.add.rectangle(width / 2, 66, width - 24, 30, 0x12060a, 0.88)
      .setStrokeStyle(1.5, 0xff5546, 0.9)
    const tag = this.add.text(width / 2 - (width - 24) / 2 + 8, 54, 'WAR MACHINE', {
      fontSize: '6px', color: '#ff9d8a', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 1,
    })
    const msg = this.add.text(width / 2, 69, '', {
      fontSize: '9px', color: '#ffd9d2', fontFamily: 'monospace',
      wordWrap: { width: width - 56 }, align: 'center',
    }).setOrigin(0.5, 0.5)
    cont.add([box, tag, msg])
    cont.setAlpha(0)
    this.tweens.add({ targets: cont, alpha: 1, duration: 180 })
    this.typeInto(msg, text)
    this.bossSpeech = cont
    this.time.delayedCall(3800, () => {
      if (!cont.active) return
      this.tweens.add({ targets: cont, alpha: 0, duration: 300, onComplete: () => {
        cont.destroy()
        if (this.bossSpeech === cont) this.bossSpeech = undefined
      } })
    })
  }

  private showStageClear() {
    const { width } = this.cameras.main
    const t = this.add.text(width / 2, 52, 'STAGE CLEAR', {
      fontSize: '18px', color: '#7dfca2', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 3,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(300).setAlpha(0).setScale(0.7)
    t.setStroke('#05130b', 3)
    t.setShadow(0, 0, '#34d399', 10, true, true)
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 450, ease: 'Back.Out' })
  }

  /** Called by the Player when its HP reaches zero: life lost, respawn or game over. */
  onPlayerDeath(fxX = this.player.x, fxY = this.player.y) {
    this.respawning = true
    sfx.explode()
    this.spawnDeathEffect(fxX, fxY)
    const lives = ((this.registry.get('lives') as number) ?? 1) - 1
    this.registry.set('lives', lives)
    if (lives > 0) {
      // Respawn: restart the stage but keep the remaining lives (no `fresh` flag).
      this.time.delayedCall(650, () => this.scene.restart({ stage: this.stage.id }))
    } else {
      this.gameOver()
    }
  }

  /** Tombé dans un trou : perte d'une vie, effet au bord du vide, respawn checkpoint. */
  private playerFall() {
    this.respawning = true
    this.onPlayerDeath(this.player.x, Math.min(this.player.y, WORLD_H + 10))
  }

  private gameOver() {
    stopMusic()
    sfx.gameOver()
    const { width, height } = this.cameras.main
    const veil = this.add.rectangle(width / 2, height / 2, width, height, 0x05060c, 0)
      .setScrollFactor(0).setDepth(400)
    this.tweens.add({ targets: veil, fillAlpha: 0.85, duration: 600 })

    const t = this.add.text(width / 2, height / 2 - 10, 'GAME OVER', {
      fontSize: '22px', color: '#ff6b5e', fontFamily: 'monospace', fontStyle: 'bold', letterSpacing: 10,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(401).setAlpha(0).setScale(0.8)
    t.setStroke('#160404', 4)
    t.setShadow(0, 0, '#ff3524', 10, true, true)
    this.tweens.add({ targets: t, alpha: 1, scale: 1, duration: 500, ease: 'Back.Out' })

    const sub = this.add.text(width / 2, height / 2 + 13, 'RETURNING TO STAGE SELECT', {
      fontSize: '8px', color: '#8b93a8', fontFamily: 'monospace', letterSpacing: 1,
    }).setOrigin(0.5).setScrollFactor(0).setDepth(401)
    this.tweens.add({ targets: sub, alpha: { from: 1, to: 0.25 }, duration: 600, yoyo: true, repeat: -1 })

    this.time.delayedCall(2800, () => {
      this.cameras.main.fadeOut(400, 0, 0, 0)
      this.time.delayedCall(450, () => this.scene.start('StageSelectScene'))
    })
  }

  private handleBulletHitBoss(
    a: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    b: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    // L'ordre des arguments d'overlap n'est pas garanti : identifier la balle.
    const bullet = a instanceof Bullet ? a : (b as Bullet)
    const bo = (a instanceof Bullet ? b : a) as Boss
    if (!bullet.active || !bo.active) return
    if (!bullet.canHit(bo)) return
    this.spawnSparks(bullet.x, bullet.y)
    bo.takeDamage(bullet.damage)
    if (bullet.pierce) bullet.markHit(bo)
    else bullet.disableBody(true, true)
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

  /** Called by the Boss when its HP reaches zero: hides its HUD bar.
   *  Le corps du boss reste visible : c'est bossDeathSequence qui l'achève. */
  bossDefeated() {
    this.bossActive = false
    this.bossBar.clear()
    this.bossName.setVisible(false)
  }

  /**
   * Destruction du WAR MACHINE en trois temps (~2,2 s) :
   *  1. explosions en chaîne sur le corps, flashs blancs
   *  2. méga-blast final : flash écran, grosse secousse, ondes de choc, débris
   *  3. le noyau de pouvoir apparaît une fois l'onde passée
   */
  bossDeathSequence(
    target: { x: number; y: number; active: boolean; setTintFill(color?: number): unknown; clearTint(): unknown },
    onDone: () => void,
  ) {
    // Position figée à la mort : les explosions se placent sur le corps.
    const bx = target.x
    const by = target.y

    let n = 0
    const chain = this.time.addEvent({
      delay: 150,
      repeat: 9,
      callback: () => {
        n++
        const ox = Phaser.Math.Between(-22, 22)
        const oy = Phaser.Math.Between(-20, 16)
        this.spawnExplosion(bx + ox, by + oy, n % 3 === 0)
        if (n % 2 === 1) sfx.explode()
        // Clignotement blanc du châssis pendant que ça explose.
        if (n <= 6 && target.active) {
          target.setTintFill(0xffffff)
          this.time.delayedCall(70, () => { if (target.active) target.clearTint() })
        }
      },
    })

    // Méga-blast final.
    this.time.delayedCall(1600, () => {
      chain.remove()
      if (target.active) target.clearTint()
      sfx.bigExplode()
      this.cameras.main.flash(300, 255, 255, 255)
      this.cameras.main.shake(420, 0.009)
      this.spawnExplosion(bx, by, true)
      this.bossShockwaveRings(bx, by)
      this.spawnDebris(bx, by)
    })

    // Le noyau apparaît une fois l'onde passée.
    this.time.delayedCall(2150, onDone)
  }

  /** Triple anneau d'onde de choc (blanc -> ambre -> rouge). */
  private bossShockwaveRings(x: number, y: number) {
    const specs = [
      { color: 0xffffff, max: 92, dur: 480, delay: 0 },
      { color: 0xffd166, max: 66, dur: 520, delay: 90 },
      { color: 0xff5546, max: 44, dur: 560, delay: 180 },
    ]
    for (const s of specs) {
      const ring = this.add.circle(x, y, 6).setStrokeStyle(3, s.color, 1).setDepth(120)
      this.tweens.add({
        targets: ring, radius: s.max, alpha: 0, delay: s.delay, duration: s.dur,
        ease: 'Cubic.Out', onComplete: () => ring.destroy(),
      })
    }
  }

  /** Débris incandescents projetés vers le haut, retombant avec gravité. */
  private spawnDebris(x: number, y: number) {
    const p = this.add.particles(x, y, 'glow', {
      speed: { min: 60, max: 170 },
      angle: { min: 200, max: 340 },
      gravityY: 220,
      scale: { start: 0.14, end: 0 },
      lifespan: { min: 500, max: 900 },
      tint: [0xffd166, 0xff9a3c, 0xff5546, 0xffffff],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    })
    p.explode(34)
    this.time.delayedCall(1000, () => p.destroy())
  }

  private handleBulletHitEnemy(
    a: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    b: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    // L'ordre des arguments d'overlap n'est pas garanti : identifier la balle.
    const bullet = a instanceof Bullet ? a : (b as Bullet)
    const e = (a instanceof Bullet ? b : a) as unknown as StageEnemy
    if (!bullet.active || !e.active) return
    if (!bullet.canHit(e)) return

    this.spawnSparks(bullet.x, bullet.y)
    e.takeDamage(bullet.damage)

    if (!e.active) {
      this.enemyCount--
      if (Math.random() < 0.6) this.spawnOrb(e.x, e.y, 'hp')
      if (this.enemyCount <= 0) this.showAllTargetsDown()
    }

    if (bullet.pierce) bullet.markHit(e)
    else bullet.disableBody(true, true)
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
