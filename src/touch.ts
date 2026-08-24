/**
 * Contrôles tactiles mobiles : D-pad virtuel + boutons d'action en overlay DOM.
 *
 * L'état (`touchState`) est lu chaque frame par GameScene et fusionné avec le
 * clavier ; les scènes de menu utilisent le tap Phaser natif. L'overlay n'est
 * créé que sur appareil tactile (ou au premier `touchstart` imprévu).
 */

import { sfx } from './audio'

export interface TouchState {
  left: boolean
  right: boolean
  jump: boolean
  shoot: boolean
}

export const touchState: TouchState = { left: false, right: false, jump: false, shoot: false }

/** L'overlay tactile est-il actif (appareil tactile détecté) ? */
export function isTouchUI(): boolean {
  return document.getElementById('touch-ui') !== null
}

let installed = false

function isTouchDevice(): boolean {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0
}

/** Bouton générique : maintient un flag tant que le doigt est posé. */
function bindHold(el: HTMLElement, key: keyof TouchState) {
  const press = (e: PointerEvent) => {
    e.preventDefault()
    el.classList.add('tb-active')
    touchState[key] = true
  }
  const release = (e: PointerEvent) => {
    e.preventDefault()
    el.classList.remove('tb-active')
    touchState[key] = false
  }
  el.addEventListener('pointerdown', press)
  el.addEventListener('pointerup', release)
  el.addEventListener('pointerleave', release)
  el.addEventListener('pointercancel', release)
  // Long-press : empêcher menu contextuel / sélection.
  el.addEventListener('contextmenu', (e) => e.preventDefault())
}

function makeButton(className: string, label: string): HTMLElement {
  const b = document.createElement('div')
  b.className = className
  b.textContent = label
  return b
}

/**
 * Installe l'overlay tactile (une seule fois). No-op sur desktop sans écran
 * tactile ; appelé au boot depuis main.ts, et ré-armé sur premier touchstart.
 */
export function installTouchControls(): void {
  if (installed) return
  installed = true

  if (!isTouchDevice()) {
    // Défensif : certains hybrides ne remontent rien avant un vrai toucher.
    window.addEventListener(
      'touchstart',
      () => {
        installed = false
        installTouchControls()
      },
      { once: true, passive: true },
    )
    return
  }

  const root = document.createElement('div')
  root.id = 'touch-ui'

  // --- D-pad gauche : ◀ ▶ ---
  const dpad = document.createElement('div')
  dpad.className = 'tc-dpad'
  const left = makeButton('tc-btn tc-dir', '◀')
  const right = makeButton('tc-btn tc-dir', '▶')
  bindHold(left, 'left')
  bindHold(right, 'right')
  dpad.append(left, right)

  // --- Actions droite : B tir (maintenir = charge), A saut ---
  const actions = document.createElement('div')
  actions.className = 'tc-actions'
  const fire = makeButton('tc-btn tc-round tc-fire', 'B')
  const jump = makeButton('tc-btn tc-round tc-jump', 'A')
  bindHold(fire, 'shoot')
  bindHold(jump, 'jump')
  actions.append(fire, jump)

  // --- Utilitaires haut-droit : son + plein écran ---
  const utils = document.createElement('div')
  utils.className = 'tc-utils'
  const mute = makeButton('tc-mini', '🔊')
  mute.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    mute.textContent = sfx.toggleMute() ? '🔇' : '🔊'
  })
  const full = makeButton('tc-mini', '⛶')
  full.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    if (document.fullscreenElement) void document.exitFullscreen()
    else void document.documentElement.requestFullscreen().catch(() => {})
  })
  utils.append(mute, full)

  root.append(dpad, actions, utils)
  document.body.appendChild(root)
}
