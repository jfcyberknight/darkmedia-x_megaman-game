import Phaser from 'phaser'

export class Bullet extends Phaser.Physics.Arcade.Image {
  private bulletSpeed = 700
  private lifetime = 1200

  constructor(scene: Phaser.Scene, x: number, y: number, texture: string) {
    super(scene, x, y, texture)

    this.setVisible(false)
    this.setActive(false)
  }

  activate(direction: number) {
    this.setPosition(this.x, this.y)
    this.setVisible(true)
    this.setActive(true)
    this.body!.enable = true
    this.setVelocityX(direction * this.bulletSpeed)

    this.scene.time.delayedCall(this.lifetime, () => {
      this.disableBody(true, true)
    })
  }

  update() {
    const body = this.body as Phaser.Physics.Arcade.Body
    if (body.blocked.left || body.blocked.right || body.blocked.up || body.blocked.down) {
      this.disableBody(true, true)
    }
  }
}
