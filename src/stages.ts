export interface StageDef {
  id: string
  name: string
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
    skyTop: 0x2b1e4e, skyBottom: 0x0d0e15,
    farColor: 0x241d3f, midColor: 0x191530,
    accent: 0xff2436,
  },
  {
    id: 'toxic-plant',
    name: 'TOXIC PLANT',
    skyTop: 0x0f2e1e, skyBottom: 0x060f0a,
    farColor: 0x12281c, midColor: 0x0d1f15,
    accent: 0x4ade80,
  },
  {
    id: 'scorched-desert',
    name: 'SCORCHED DESERT',
    skyTop: 0x3d1f0e, skyBottom: 0x160a04,
    farColor: 0x2e1708, midColor: 0x1e1006,
    accent: 0xfb923c,
  },
  {
    id: 'frost-lab',
    name: 'FROST LAB',
    skyTop: 0x14325e, skyBottom: 0x071222,
    farColor: 0x102540, midColor: 0x0a1a2e,
    accent: 0xff7a8a,
  },
  {
    id: 'sky-fortress',
    name: 'SKY FORTRESS',
    skyTop: 0x4e1e3d, skyBottom: 0x12060f,
    farColor: 0x38162b, midColor: 0x251020,
    accent: 0xf472b6,
  },
]

export const DEFAULT_STAGE = STAGES[0]
