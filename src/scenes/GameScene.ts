import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Bullet } from '../objects/Bullet'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private platforms!: Phaser.Tilemaps.TilemapLayer
  private enemies!: Phaser.Physics.Arcade.Group
  private bullets!: Phaser.Physics.Arcade.Group
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private shootKey!: Phaser.Input.Keyboard.Key
  private healthText!: Phaser.GameObjects.Text
  private enemyCount = 0

  constructor() {
    super({ key: 'GameScene' })
  }

  preload() {
    this.load.image('tileset', 'assets/tileset.png')
    this.load.tilemapTiledJSON('level', 'assets/level.json')
    this.load.spritesheet('player', 'assets/player.png', { frameWidth: 16, frameHeight: 24 })
    this.load.spritesheet('enemy', 'assets/enemy.png', { frameWidth: 18, frameHeight: 18 })
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
    this.cameras.main.setZoom(2)

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

    this.healthText = this.add.text(10, 10, 'HP: 10', {
      fontSize: '8px',
      color: '#ffffff',
      fontFamily: 'monospace',
    })
    this.healthText.setScrollFactor(0)
    this.healthText.setDepth(100)

    this.add.text(10, 22, '← → : move  |  ↑ : jump  |  Z : shoot', {
      fontSize: '6px',
      color: '#aabbcc',
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
  }

  private createAnimations() {
    if (!this.anims.exists('player-idle')) {
      this.anims.create({
        key: 'player-idle',
        frames: this.anims.generateFrameNumbers('player', { start: 0, end: 0 }),
        frameRate: 4,
        repeat: -1,
      })
    }
    if (!this.anims.exists('player-run')) {
      this.anims.create({
        key: 'player-run',
        frames: this.anims.generateFrameNumbers('player', { start: 1, end: 3 }),
        frameRate: 12,
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
    const graphics = this.add.graphics()
    graphics.fillGradientStyle(0x1a1c29, 0x1a1c29, 0x0d0e15, 0x0d0e15, 1)
    graphics.fillRect(0, 0, 1600, 640)
    graphics.setScrollFactor(0.2)

    for (let x = 0; x < 1600; x += 64) {
      const h = 40 + Math.random() * 60
      graphics.fillStyle(0x252736, 1)
      graphics.fillRect(x, 640 - h, 64, h)
    }
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

  private handleBulletHitEnemy(
    bullet: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    enemy: Phaser.Types.Physics.Arcade.GameObjectWithBody,
  ) {
    const b = bullet as Phaser.Physics.Arcade.Image
    const e = enemy as Enemy
    if (!b.active || !e.active) return

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
