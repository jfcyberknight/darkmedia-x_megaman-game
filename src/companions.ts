/** Companion robot definitions — personality, colors, AI prompts, canned lines. */

export interface CompanionDef {
  id: string
  name: string
  texture: string
  tint: number
  bubble: number
  tagline: string
  persona: string
  lines: Record<string, string[]>
}

export const COMPANIONS: CompanionDef[] = [
  {
    id: 'orion',
    name: 'ORION',
    texture: 'comp-orion',
    tint: 0x35e0ff,
    bubble: 0x35e0ff,
    tagline: 'Éclaireur fidèle',
    persona: 'Tu es ORION, un drone éclaireur loyal et espiègle qui accompagne BLASTER-01 dans Néon City.',
    lines: {
      start: ['Sectoriel scanné. Fais-leur mordre la poussière, Blaster.'],
      firstblood: ['Premier custodien neutralisé. Ça promet.'],
      clear: ['Secteur purgé. Il reste... lui.'],
      lowhp: ['Ton noyau flanche ! Chope une orbe, vite !'],
      checkpoint: ['Position mémorisée. On pourra revenir ici.'],
      power: ['Tu absorbes son pouvoir ? C’est... magnifique.'],
    },
  },
  {
    id: 'bolt',
    name: 'BOLT',
    texture: 'comp-bolt',
    tint: 0xffc857,
    bubble: 0xffc857,
    tagline: 'Grincheux de service',
    persona: 'Tu es BOLT, un robot de maintenance grincheux et sarcastique, forcé d’accompagner BLASTER-01.',
    lines: {
      start: ['J’ai signé pour la maintenance, pas pour la guerre. Avance.'],
      firstblood: ['Je l’ai réparé hier trois heures. Merci, vraiment.'],
      clear: ['Sectoriel vide. Tu veux que je passe le balai ?'],
      lowhp: ['Si tu exploses, c’est moi qui ramasse les pièces.'],
      checkpoint: ['Noté. Encore un endroit où tu vas te faire trouer.'],
      power: ['Son cœur dans TON chassis. On n’est pas sortis de l’auberge.'],
    },
  },
  {
    id: 'nova',
    name: 'NOVA',
    texture: 'comp-nova',
    tint: 0xf472b6,
    bubble: 0xf472b6,
    tagline: 'Énergie pure',
    persona: 'Tu es NOVA, une unité de combat sphérique hyper-enthousiaste et explosive qui adore BLASTER-01.',
    lines: {
      start: ['OUAIS ! On va les déboîter tous, Blaster !'],
      firstblood: ['BOUM ! Un de moins ! Suivant !'],
      clear: ['SECTEUR NETTOYÉ ! Je veux mon bonus !'],
      lowhp: ['Blaster ! Recharge ! VITE VITE VITE !'],
      checkpoint: ['Checkpoint ! Ça se fête ! Enfin après.'],
      power: ['SON POUVOIR EST EN TOI !! Je crie trop fort ?'],
    },
  },
]

export function getCompanion(id: string | undefined): CompanionDef {
  return COMPANIONS.find(c => c.id === id) ?? COMPANIONS[0]
}
