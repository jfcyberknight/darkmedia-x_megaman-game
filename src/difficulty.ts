/** Difficulté progressive par stage : HP ennemis, vitesse, cadence des
 *  projectiles et stats du boss montent à chaque secteur. */
import { STAGES } from './stages'

export interface Difficulty {
  /** Multiplicateur de vie des ennemis (min 1). */
  hpMult: number
  /** Multiplicateur de vitesse de déplacement des ennemis. */
  speedMult: number
  /** Multiplicateur de vitesse des projectiles ennemis. */
  bulletMult: number
  /** Points de vie du boss. */
  bossHp: number
  /** Vitesse de marche du boss. */
  bossWalk: number
  /** Vitesse du dash du boss. */
  bossDash: number
  /** Temps de repos du boss entre attaques (ms). */
  bossRest: number
}

export const DIFFICULTY: Difficulty[] = [
  // neon-city — secteur d'entrée, plus clément.
  { hpMult: 0.85, speedMult: 0.85, bulletMult: 0.8,  bossHp: 20, bossWalk: 11, bossDash: 80,  bossRest: 2300 },
  // toxic-plant — référence.
  { hpMult: 1.0,  speedMult: 0.98, bulletMult: 0.95, bossHp: 28, bossWalk: 13, bossDash: 90,  bossRest: 2050 },
  // scorched-desert.
  { hpMult: 1.05, speedMult: 1.02, bulletMult: 1.05, bossHp: 32, bossWalk: 14, bossDash: 96,  bossRest: 1900 },
  // frost-lab.
  { hpMult: 1.1,  speedMult: 1.06, bulletMult: 1.15, bossHp: 36, bossWalk: 15, bossDash: 102, bossRest: 1750 },
  // sky-fortress — le plus dur.
  { hpMult: 1.16, speedMult: 1.1,  bulletMult: 1.2,  bossHp: 40, bossWalk: 16, bossDash: 108, bossRest: 1600 },
]

export function getDifficulty(stageId: string): Difficulty {
  const idx = STAGES.findIndex((s) => s.id === stageId)
  return DIFFICULTY[idx] ?? DIFFICULTY[0]
}
