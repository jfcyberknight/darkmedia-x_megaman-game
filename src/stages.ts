export interface StageDef {
  id: string
  name: string
  /** Nom du gardien (boss) du stage. */
  boss: string
  /** Sky gradient top / bottom colors. */
  skyTop: number
  skyBottom: number
  /** Far + mid silhouette colors. */
  farColor: number
  midColor: number
  /** Accent used on the stage-select card and HUD. */
  accent: number
}

export const STAGES: StageDef[] = [
  {
    id: 'neon-city',
    name: 'NEON CITY',
    boss: 'RAM-9',
    skyTop: 0x1e0a10, skyBottom: 0x0a0405,
    farColor: 0x1a080c, midColor: 0x0d0405,
    accent: 0xff2436,
  },
  {
    id: 'toxic-plant',
    name: 'TOXIC PLANT',
    boss: 'VENOM',
    skyTop: 0x0a1c12, skyBottom: 0x040a06,
    farColor: 0x09200f, midColor: 0x050f08,
    accent: 0x4ade80,
  },
  {
    id: 'scorched-desert',
    name: 'SCORCHED DESERT',
    boss: 'TITAN',
    skyTop: 0x1e0e06, skyBottom: 0x0a0402,
    farColor: 0x1a0c04, midColor: 0x0d0602,
    accent: 0xfb923c,
  },
  {
    id: 'frost-lab',
    name: 'FROST LAB',
    boss: 'CRYO',
    skyTop: 0x0a1626, skyBottom: 0x04080c,
    farColor: 0x091828, midColor: 0x060e1a,
    accent: 0x93c5fd,
  },
  {
    id: 'sky-fortress',
    name: 'SKY FORTRESS',
    boss: 'AERON',
    skyTop: 0x1e0a17, skyBottom: 0x0a0409,
    farColor: 0x1a0a15, midColor: 0x0d050a,
    accent: 0xf472b6,
  },
]

export const DEFAULT_STAGE = STAGES[0]
