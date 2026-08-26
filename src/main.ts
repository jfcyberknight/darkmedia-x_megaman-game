import Phaser from 'phaser'
import { BootScene } from './scenes/BootScene'
import { IntroScene } from './scenes/IntroScene'
import { CompanionScene } from './scenes/CompanionScene'
import { TitleScene } from './scenes/TitleScene'
import { StageSelectScene } from './scenes/StageSelectScene'
import { GameScene } from './scenes/GameScene'
import { PauseScene } from './scenes/PauseScene'
import { getTrack, installAudioGestures } from './audio'
import { installTouchControls } from './touch'

// Hauteur logique fixe : la LARGEUR suit l'aspect de l'écran (ratio w/h) pour
// que le jeu remplisse N'IMPORTE QUEL téléphone (16:9, 19.5:9, 20:9) sans bandes
// — il montre simplement plus de monde à droite. Clamp pour ne jamais être
// trop étroit (portrait) ni dépasser la largeur du monde.
const GAME_H = 270
const clampW = () =>
  Math.min(760, Math.max(360, Math.round(GAME_H * (window.innerWidth / window.innerHeight))))

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: clampW(),
  height: GAME_H,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  backgroundColor: '#0d0e15',
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 450 },
      // Pas variable : la physique avance avec le temps réel quelle que soit
      // la fréquence d'écran (fixedStep=true faisait 2× sur écrans 120 Hz et
      // 0,5× sur 30 Hz). Le delta est clampé ci-dessous → pas de tunneling.
      fixedStep: false,
      debug: false,
    },
  },
  scene: [BootScene, IntroScene, CompanionScene, TitleScene, StageSelectScene, GameScene, PauseScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
}

const game = new Phaser.Game(config)
installTouchControls()
// Déblocage audio global : les boutons tactiles DOM ne passent pas par
// l'input Phaser, donc on écoute aussi au niveau document.
installAudioGestures()

// Recalcule la largeur logique quand l'écran change d'orientation / taille :
// le jeu reste plein écran (remplit largeur ET hauteur) sur tout téléphone.
const fitToScreen = () => game.scale.setGameSize(clampW(), GAME_H)
window.addEventListener('resize', fitToScreen)
window.addEventListener('orientationchange', () => setTimeout(fitToScreen, 300))

// Le clamp du delta physique est installé dans GameScene.create() (garde
// statique) : `physics` s'injecte par scène dans Phaser 3, il n'existe pas
// de `game.physics` — un patch au niveau Game plante au boot.

// Exposed for headless debugging probes only.
;(window as unknown as { __game?: Phaser.Game; __track?: () => string | null }).__game = game
;(window as unknown as { __track?: () => string | null }).__track = getTrack

