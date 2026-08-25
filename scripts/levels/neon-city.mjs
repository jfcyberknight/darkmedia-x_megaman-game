// Spec du niveau NEON CITY (niveau 1, layout validé par le bot Playwright).
// Format attendu par scripts/generate-level.mjs. Toutes les positions sont en
// TUILLES (16 px). Largeur = nombre de tuiles. Le générateur convertit en px.
//
// Contraindications (à respecter ABSOLUMENT — dérivées de la physique réelle) :
//   - pits : largeur <= 3, jamais dans les 14 premières tuiles (spawn), jamais
//     dans les 42 dernières (arène du boss), jamais sous un ennemi/CP/orbe.
//   - walls : hauteur = 2 uniquement (3 = fenêtre de saut trop courte), colonne
//     seule, pas sur un trou, laisser >= 4 tuiles de sol après un trou.
//   - plats : row 10 ou 11 uniquement (plus bas = plafonne les sauts dessous ;
//     plus haut = inatteignable).
//   - ennemis/CP/orbes : au sol (pas sur trou ni mur), espacés.
//   - flyers : y en pixels entre 100 et 170.
//   - arène : les 42 dernières tuiles sans trou ni mur (boss).
export default {
  id: 'neon-city',
  width: 210,
  pits: [
    [22, 3], [40, 3], [58, 3], [76, 3], [94, 3], [112, 3], [130, 3], [150, 3], [168, 3],
  ],
  walls: [
    [31, 2], [66, 2], [88, 2], [120, 2], [141, 2],
  ],
  plats: [
    [15, 10, 4], [25, 11, 4], [34, 10, 4], [48, 11, 4],
    [84, 10, 4], [104, 11, 4], [118, 10, 4], [136, 11, 4], [156, 10, 4],
    [172, 11, 4], [184, 10, 4],
  ],
  walkers: [28, 55, 72, 84, 105, 118, 135, 158, 176, 194],
  turrets: [45, 92, 108, 128, 166, 182],
  flyers: [[70, 150], [96, 132], [122, 132], [140, 145], [155, 140], [176, 150]],
  checkpoints: [20, 62, 100, 145, 185],
  orbs: [12, 28, 36, 46, 54, 64, 72, 82, 90, 100, 108, 126, 136, 146, 158, 164, 176],
}
