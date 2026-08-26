/** Capsules de compagnon : des objets à collecter qui déverrouillent un
 *  pouvoir de soutien pour le drone compagnon (tir, bouclier, soin, rapidité). */

export type CapsuleId = 'tir' | 'bouclier' | 'soin' | 'rapide'

export interface CapsuleDef {
  id: CapsuleId
  name: string
  desc: string
  tint: number
}

export const CAPSULES: CapsuleDef[] = [
  { id: 'tir',     name: 'DRONE TIREUR',     desc: 'Le compagnon tire sur les ennemis',                 tint: 0x9df2ff },
  { id: 'bouclier', name: 'ÉCOU BOUCLIER',    desc: 'Le compagnon te protège périodiquement',            tint: 0x93c5fd },
  { id: 'soin',    name: 'UNITÉ SOIN',        desc: 'Le compagnon te soigne quand tu es bas',           tint: 0x7dfca2 },
  { id: 'rapide',  name: 'OVERRIDE RAPIDE',   desc: 'Tes tirs sont plus rapides',                       tint: 0xffd166 },
]

export function getCapsule(id: string): CapsuleDef {
  return CAPSULES.find((c) => c.id === id) ?? CAPSULES[0]
}
