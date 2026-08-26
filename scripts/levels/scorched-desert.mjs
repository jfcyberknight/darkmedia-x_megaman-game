// Spec du niveau SCORCHED DESERT (stage 3 — désert brûlé à ciel ouvert).
// Format attendu par scripts/generate-level.mjs. Toutes les positions sont en
// TUILLES (16 px), sauf l'axe Y des drones en PIXELS. Largeur = tuiles.
//
// Contraindications (à respecter ABSOLUMENT — dérivées de la physique réelle) :
//   - pits : largeur <= 3, jamais dans les 14 premières tuiles (spawn), jamais
//     dans l'arène du boss (x+w > ARENA=196 pour W=235), jamais adjacents,
//     >= 4 tuiles de sol entre deux trous.
//   - walls : hauteur = 2 uniquement (3 = fenêtre de saut trop courte), colonne
//     seule, pas sur un trou, >= 4 tuiles de sol après un trou et avant le suivant.
//   - plats : row 10 ou 11 uniquement (dalles hautes décoratives).
//   - ennemis/CP/orbes : au sol (pas sur trou ni mur, pas à 1 tuile d'un bord),
//     espacés ; paquets de marcheurs + arcs de tourelles sur longues étendues.
//   - flyers : y en pixels entre 100 et 170.
//   - arène : tuiles 196..234 sans trou ni mur (boss).
export default {
  id: 'scorched-desert',
  width: 235,
  pits: [
    [22, 3], [36, 3], [50, 3],
    [66, 3], [74, 3], [88, 3],
    [104, 3], [112, 3], [126, 3],
    [142, 3], [150, 3], [162, 3], [170, 3],
  ],
  walls: [
    [29, 2], [44, 2], [82, 2], [96, 2], [120, 2], [133, 2], [158, 2], [177, 2],
  ],
  plats: [
    [15, 10, 4], [26, 11, 4], [40, 10, 4], [56, 11, 4], [70, 10, 4], [86, 11, 4],
    [100, 10, 4], [116, 11, 4], [130, 10, 4], [148, 11, 4], [164, 10, 4], [180, 11, 4],
  ],
  walkers: [19, 32, 41, 55, 61, 78, 85, 93, 108, 124, 137, 147, 166, 174],
  turrets: [46, 63, 72, 101, 116, 140, 154, 185],
  chargers: [130, 168],
  spitters: [91, 121],
  flyers: [[34, 150], [59, 132], [76, 145], [91, 140], [122, 132], [139, 155], [160, 125], [182, 150]],
  checkpoints: [20, 62, 100, 146, 188],
  orbs: [
    12, 18, 27, 33, 41, 47, 56, 60, 71, 80, 87, 94,
    99, 108, 117, 123, 131, 139, 147, 156, 166, 175, 184, 192,
  ],
}
