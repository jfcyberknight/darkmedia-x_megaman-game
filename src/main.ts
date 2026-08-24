import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { TitleScene } from './scenes/TitleScene'
import { StageSelectScene } from './scenes/StageSelectScene'
import { GameScene } from './scenes/GameScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: 256,
  height: 224,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  backgroundColor: '#0d0e15',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 450 },
      debug: false,
    },
  },
  scene: [BootScene, TitleScene, StageSelectScene, GameScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

const game = new Phaser.Game(config)
// Exposed for headless debugging probes only.
;(window as unknown as { __game?: Phaser.Game }).__game = game

