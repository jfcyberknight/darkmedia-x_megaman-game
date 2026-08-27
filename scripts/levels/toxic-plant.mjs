// Spec du niveau TOXIC PLANT (stage 2 — « les couloirs de tuyaux »).
// Identité : COULOIRS. Rythme trou+mur régulier dans une usine corrompue,
// avec un accent d'escalade (1 tour de tuyaux) et surtout des CRACHEURS +
// CHARGEURS toxiques en force. Pas un "trou-mania" ni un défi d'escalade.
export default {
  id: 'toxic-plant',
  width: 220,
  pits: [
    [22, 3], [46, 3], [70, 3], [94, 3], [118, 3], [142, 3],
  ],
  walls: [
    [34, 2], [58, 2], [82, 2], [106, 2], [130, 2], [154, 2],
  ],
  plats: [
    [16, 10, 3], [28, 11, 3], [40, 10, 3], [52, 11, 3], [76, 10, 3],
    [88, 11, 3], [100, 10, 3], [112, 11, 3], [124, 10, 3], [136, 11, 3], [158, 10, 3], [168, 11, 4],
  ],
  shafts: [[66, 6]],
  walkers: [32, 80, 122],
  turrets: [30, 74, 100, 146, 164],
  // CRACHEURS + CHARGEURS : les deux familles dominent l'usine.
  spitters: [28, 62, 86, 114, 138, 162],
  chargers: [38, 90, 128, 156],
  flyers: [
    [26, 150], [50, 128], [74, 145], [96, 130], [120, 148], [144, 126], [166, 152],
  ],
  checkpoints: [20, 64, 110, 148, 176],
  orbs: [12, 26, 36, 44, 54, 64, 76, 90, 102, 116, 126, 140, 152, 166],
  // Ponts à plateforme : coulées de toxique — le passage se fait sur la dalle
  // centrale, le sol étant une large ouverture infranchissable.
  bridges: [[38, 6], [110, 6], [163, 6]],
}
