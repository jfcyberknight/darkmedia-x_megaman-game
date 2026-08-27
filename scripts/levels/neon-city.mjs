// Spec du niveau NEON CITY (niveau 1 — « blocs urbains »).
// Identité : gauntlet de BÂTIMENTS. Beaucoup de murs (immeubles) à franchir,
// tourelles en force sur les façades, rythme trou+mur serré. Se joue surtout
// horizontalement avec des sauts de mur pour franchir les blocs.
//
// Contraintes (dérivées de la physique réelle, voir validate-level.mjs) :
// pits <= 3 tuiles, jamais x<14 ni dans l'arène (ARENA=171 pour W=210),
// walls hauteur 2, plats rows 10/11, ennemis au sol >= 2 tuiles d'un trou,
// flyers y en pixels 100..170.
export default {
  id: 'neon-city',
  width: 210,
  // Trous : rythme régulier (~24 tuiles), plus épars qu'avant (on saute des blocs).
  pits: [
    [20, 3], [43, 3], [67, 3], [91, 3], [115, 3], [139, 3], [159, 3],
  ],
  // Murs : les « buildings » — un par segment de sol, beaucoup plus nombreux.
  walls: [
    [32, 2], [55, 2], [79, 2], [103, 2], [127, 2], [150, 2],
  ],
  // Dalles (toits) qui relient les mur-à-mur : gros volume de plateformes.
  plats: [
    [15, 10, 4], [26, 11, 3], [38, 10, 4], [61, 11, 3], [73, 10, 4],
    [96, 11, 3], [107, 10, 4], [120, 11, 3], [132, 10, 4], [145, 11, 3], [156, 10, 3], [166, 11, 4],
  ],
  shafts: [],
  // Marcheurs de rue, répartis dans les segments dégagés.
  walkers: [62, 84, 105, 134, 145, 155],
  // Tourelles de façade : LE point fort de la ville (en force).
  turrets: [26, 50, 72, 98, 122, 131, 148, 163],
  chargers: [39],
  spitters: [86],
  // Drones qui surveillent depuis les toits.
  flyers: [[24, 150], [58, 130], [88, 145], [118, 132], [143, 150], [158, 140], [166, 150]],
  checkpoints: [28, 64, 104, 144, 170],
  orbs: [
    12, 28, 36, 46, 57, 66, 76, 89, 101, 108, 118, 126, 136, 146, 158, 164,
  ],
  // Ponts à plateforme : larges « sauts de toit » — fossé infranchissable au saut,
  // traversé via une dalle — force l'usage des plateformes entre deux buildings.
  bridges: [[35, 7], [96, 5], [143, 6]],
}
