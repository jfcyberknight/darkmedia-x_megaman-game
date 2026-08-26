/** Capsules de compagnon : objets à collecter qui améliorent le drone avec des
 *  pouvoirs de soutien. Le POUVOIR DE COMBAT du compagnon (signature) dépend du
 *  compagnon choisi (voir companions.ts). */

export type CapsuleId = 'soin' | 'rapide' | 'puissance'

export interface CapsuleDef {
  id: CapsuleId
  name: string
  desc: string
  tint: number
}

export const CAPSULES: CapsuleDef[] = [
  { id: 'soin',      name: 'UNITÉ SOIN',       desc: 'Le compagnon te soigne quand tu es bas', tint: 0x7dfca2 },
  { id: 'rapide',    name: 'OVERRIDE RAPIDE',  desc: 'Tes tirs sont plus rapides',             tint: 0xffd166 },
  { id: 'puissance', name: 'OVERCLOCK PUISS.', desc: 'Boost du pouvoir de ton compagnon',       tint: 0xf472b6 },
]

export function getCapsule(id: string): CapsuleDef {
  return CAPSULES.find((c) => c.id === id) ?? CAPSULES[0]
}

/** Pouvoirs de combat (signature) : portés par le compagnon choisi. */
export type CombatPower = 'tir' | 'bouclier' | 'explosion'
export const COMBAT: Record<CombatPower, { name: string; desc: string; tint: number }> = {
  tir:       { name: 'DRONE TIREUR',     desc: 'Le compagnon tire sur les ennemis', tint: 0x9df2ff },
  bouclier:  { name: 'ÉCOU BOUCLIER',    desc: 'Le compagnon te protège périodiquement', tint: 0x93c5fd },
  explosion: { name: 'UNITÉ DÉFLAGRANTE', desc: 'Le compagnon tire des projectiles explosifs', tint: 0xff6b5e },
}
