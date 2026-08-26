// Spec du niveau FROST LAB (stage 4 — « Un laboratoire gelé », layout validé
// par scripts/validate-level.mjs). Format attendu par scripts/generate-level.mjs.
// Toutes les positions sont en TUILLES (16 px) ; le y des flyers est en PIXELS.
//
// Orientation difficulté (STAGE 4, plus dur que le stage 3) :
//   - level axé PLATEFORMES : nombreuses dalles hautes en rows 10/11 alternées
//     qui dessinent un chemin vertical étagé (plusieurs servent de pont au-dessus
//     des fosses) ;
//   - beaucoup de drones qui zigzaguent entre les dalles (12), densité croissante
//     dans la seconde moitié ;
//   - peu de murs (5) mais placés en milieu de segments de sol ;
//   - 12 fosses (largeurs 2-3) espacées de >= 12 tuiles de sol plat.
//
// Rappels de contraintes (dérivées de la physique réelle du joueur) :
//   - pits : largeur <= 3, jamais avant la tuile 14, jamais dans l'arène du boss
//     (tuiles >= 211 pour width 250), jamais sous un ennemi/CP/orbe, jamais adjacents ;
//   - walls : hauteur EXACTEMENT 2, colonne seule, pas sur un trou,
//     >= 4 tuiles de sol après le trou précédent et avant le trou suivant ;
//   - plats : row 10 ou 11 UNIQUEMENT (jamais <= 12 sinon ça plaque les sauts) ;
//   - arène (tuiles 211..249) : complètement plate, le boss y apparaît.
export default {
  id: 'frost-lab',
  width: 250,
  pits: [
    [20, 3], [36, 3], [52, 2], [66, 3], [84, 3], [100, 2],
    [114, 3], [132, 3], [148, 2], [162, 3], [180, 3], [196, 2],
  ],
  walls: [
    [30, 2], [60, 2], [93, 2], [124, 2], [157, 2],
  ],
  plats: [
    // Escalier d'introduction au-dessus des premières fosses
    [16, 11, 3], [22, 10, 3], [31, 11, 3],
    // Première moitié : dalles alternées 10/11, plusieurs en pont de fosse
    [41, 10, 4], [47, 11, 3], [56, 10, 3], [67, 11, 4],
    [76, 10, 3], [85, 11, 4], [96, 10, 3], [105, 11, 3],
    // Seconde moitié : rythme plus serré, chemins hauts privilégiés
    [115, 10, 4], [126, 11, 3], [133, 10, 4], [143, 11, 3],
    [151, 10, 3], [163, 11, 4], [172, 10, 3], [181, 11, 4],
    [191, 10, 3], [199, 11, 3],
  ],
  walkers: [26, 43, 58, 74, 79, 90, 107, 121, 127, 141, 154, 169, 188, 202],
  turrets: [48, 95, 111, 137, 173, 192, 206],
  chargers: [70, 135],
  spitters: [40, 118],
  flyers: [
    [34, 140], [50, 118], [64, 152], [81, 112], [98, 158], [113, 126],
    [131, 142], [147, 108], [161, 148], [179, 118], [195, 152], [207, 128],
  ],
  checkpoints: [18, 62, 104, 144, 188],
  orbs: [
    6, 12, 17, 25, 32, 41, 47, 56, 63, 73, 82, 91,
    106, 119, 140, 151, 159, 170, 176, 187, 193, 204, 208,
  ],
}
