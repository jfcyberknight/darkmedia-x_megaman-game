// Spec du niveau SKY FORTRESS (stage 5 — LE PLUS DIFFICILE).
// « La forteresse céleste — le dernier bastion avant le WAR MACHINE ».
// Parcours du combattant final : trous et murs en rythme serré, plus
// d'ennemis que tout autre stage, difficulté croissante du spawn à l'arène.
//
// Format attendu par scripts/generate-level.mjs. Positions en TUILLES (16 px),
// sauf flyers.y en PIXELS. Largeur 270 -> arène du boss à partir de la tuile
// 231 (floor(((270-22)*16-270)/16)) : terrain plat, ni trou ni mur.
//
// Contraindications physiques (respectées ABSOLUMENT — voir validate-level.mjs) :
//   - pits : largeur <= 3, jamais < 14 (spawn), jamais dans l'arène, jamais
//     adjacents, >= 4 tuiles de sol entre deux trous.
//   - walls : hauteur EXACTEMENT 2, colonne seule, pas sur un trou,
//     >= 4 tuiles de sol après le trou précédent et avant le trou suivant.
//   - plats : row 10 ou 11 uniquement (dalles hautes décoratives).
//   - ennemis/CP/orbes : au sol, >= 2 tuiles claires de chaque côté d'un trou
//     (zones d'atterrissage de saut dégagées), jamais sur une colonne de mur.
//   - flyers : y en pixels entre 100 et 170.
export default {
  id: 'sky-fortress',
  width: 270,
  pits: [
    // Secteur 1 (initiation musclée)
    [24, 3], [37, 2], [50, 3],
    // Secteur 2
    [59, 3], [71, 2], [84, 3],
    // Secteur 3
    [97, 3], [110, 3], [122, 2],
    // Secteur 4
    [134, 3], [147, 3], [160, 2],
    // Secteur 5 (paroxysme)
    [172, 3], [185, 3], [198, 2],
    // Secteur 6 (ultime gauntlet avant l'arène @231)
    [209, 3], [221, 2],
  ],
  walls: [
    [31, 2], [44, 2],
    [66, 2], [78, 2],
    [92, 2], [105, 2], [117, 2],
    [129, 2], [142, 2], [155, 2],
    [167, 2], [180, 2], [193, 2],
    [204, 2], [216, 2], [227, 2], // porte finale de la forteresse
  ],
  plats: [
    [15, 11, 4], [24, 10, 4], [37, 11, 4], [44, 10, 3],
    [56, 11, 4], [69, 10, 4], [81, 11, 4], [94, 10, 3],
    [107, 11, 4], [120, 10, 4], [133, 11, 4], [145, 10, 4],
    [158, 11, 3], [170, 10, 4], [183, 11, 4], [196, 10, 4],
    [207, 11, 4], [217, 10, 4],
  ],
  walkers: [
    // S1 : patrouilles courtes pour apprivoiser le rythme trou+mur
    17, 29, 41,
    // S2-S3 : pression continue de part et d'autre des murs
    65, 75, 89, 102, 115, 126,
    // S4-S6 : flancs de murs doublés, fin de niveau saturée
    139, 144, 169, 182, 203, 214, 226,
    // approche / arène du boss (comme neon-city)
    236,
  ],
  turrets: [
    34, 47,
    68, 81, 94,
    107, 119, 131,
    157, 164, 177,
    195, 206,
    229, 244,
  ],
  flyers: [
    [24, 140], [47, 120], [63, 150], [86, 125], [103, 145],
    [124, 115], [148, 135], [173, 150], [199, 120], [223, 145],
    [241, 130],
  ],
  checkpoints: [20, 56, 104, 153, 192, 218],
  orbs: [
    10, 16, 30, 33, 42, 46, 55, 64, 76, 79, 91,
    116, 127, 140, 154, 166, 202, 215, 225, 233,
  ],
}
