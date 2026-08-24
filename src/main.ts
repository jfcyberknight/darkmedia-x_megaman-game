import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { TitleScene } from './scenes/TitleScene'
import { StageSelectScene } from './scenes/StageSelectScene'
import { GameScene } from './scenes/GameScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 384,
  height: 216,
  pixelArt: true,
  backgroundColor: '#0d0e15',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 900 },
      debug: false,
    },
  },
  scene: [BootScene, TitleScene, StageSelectScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

new Phaser.Game(config)
