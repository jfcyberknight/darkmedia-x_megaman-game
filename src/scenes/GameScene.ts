import Phaser from 'phaser'
import { Player } from '../entities/Player'
import { Enemy } from '../entities/Enemy'
import { Bullet } from '../objects/Bullet'

export class GameScene extends Phaser.Scene {
  private player!: Player
  private platforms!: Phaser.Physics.Arcade.StaticGroup
  private enemies!: Phaser.Physics.Arcade.Group
  private bullets!: Phaser.Physics.Arcade.Group
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private shootKey!: Phaser.Input.Keyboard.Key
  private healthText!: Phaser.GameObjects.Text
  private enemyCount = 0

  constructor() {
    super({ key: 'GameScene' })
  }

  create() {
    this.generateTextures()

    this.cameras.main.setBounds(0, 0, 1600, 600)
    this.physics.world.setBounds(0, 0, 1600, 600)

    this.createBackground()
    this.createPlatforms()

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

    this.player = new Player(this, 80, 400, this.bullets)
    this.add.existing(this.player)
    this.physics.add.existing(this.player)

    this.cameras.main.startFollow(this.player, true, 0.1, 0.1)
    this.cameras.main.setZoom(2)

    this.spawnEnemies()

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)

    this.physics.add.collider(this.player, this.platforms)
    this.physics.add.collider(this.enemies, this.platforms)
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
      enemy.update()
      return true
    })
  }

  private generateTextures() {
    const g = this.add.graphics()

    g.fillStyle(0x3b82f6)
    g.fillRect(0, 0, 16, 24)
    g.generateTexture('player', 16, 24)
    g.clear()

    g.fillStyle(0xef4444)
    g.fillRect(0, 0, 18, 18)
    g.generateTexture('enemy', 18, 18)
    g.clear()

    g.fillStyle(0xfacc15)
    g.fillRect(0, 0, 6, 4)
    g.generateTexture('bullet', 6, 4)
    g.destroy()
  }

  private createBackground() {
    const graphics = this.add.graphics()
    graphics.fillGradientStyle(0x1a1c29, 0x1a1c29, 0x0d0e15, 0x0d0e15, 1)
    graphics.fillRect(0, 0, 1600, 600)
    graphics.setScrollFactor(0.2)

    for (let x = 0; x < 1600; x += 64) {
      const h = 40 + Math.random() * 60
      graphics.fillStyle(0x252736, 1)
      graphics.fillRect(x, 600 - h, 64, h)
    }
  }

  private createPlatforms() {
    this.platforms = this.physics.add.staticGroup()

    const groundY = 560
    for (let x = 0; x < 1600; x += 32) {
      this.addPlatformTile(x, groundY)
    }

    const layout = [
      { x: 200, y: 480, w: 3 },
      { x: 360, y: 400, w: 2 },
      { x: 520, y: 340, w: 4 },
      { x: 760, y: 420, w: 2 },
      { x: 920, y: 360, w: 3 },
      { x: 1140, y: 300, w: 2 },
      { x: 1300, y: 420, w: 3 },
    ]

    for (const p of layout) {
      for (let i = 0; i < p.w; i++) {
        this.addPlatformTile(p.x + i * 32, p.y)
      }
    }
  }

  private addPlatformTile(x: number, y: number) {
    const tile = this.add.rectangle(x + 16, y + 16, 32, 32, 0x4a5568) as unknown as Phaser.GameObjects.GameObject
    this.platforms.add(tile)
  }

  private spawnEnemies() {
    const positions = [
      { x: 300, y: 430 },
      { x: 560, y: 290 },
      { x: 800, y: 370 },
      { x: 1000, y: 310 },
      { x: 1360, y: 480 },
    ]

    for (const pos of positions) {
      const enemy = new Enemy(this, pos.x, pos.y)
      this.add.existing(enemy)
      this.physics.add.existing(enemy)
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
