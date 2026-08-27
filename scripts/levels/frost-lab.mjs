// Spec du niveau FROST LAB (stage 4 — « les corniches de glace »).
// Identité : PLATEFORMING VERTICAL. Beaucoup de dalles étagées (rows 10/11)
// qui dessinent un chemin en hauteur (corniches de glace), peu de fosses.
// Les DRONES dominent — ils zigzaguent entre les corniches.
export default {
  id: 'frost-lab',
  width: 250,
  pits: [
    [24, 3], [48, 3], [72, 3], [96, 2], [124, 3], [152, 3], [176, 2],
  ],
  walls: [
    [36, 2], [60, 2], [86, 2], [132, 2], [162, 2],
  ],
  plats: [
    [16, 10, 3], [22, 11, 3], [30, 10, 3], [40, 11, 3], [52, 10, 3],
    [62, 11, 3], [74, 10, 3], [84, 11, 3], [94, 10, 3], [104, 11, 3],
    [114, 10, 3], [126, 11, 3], [136, 10, 3], [146, 11, 3], [156, 10, 3],
    [166, 11, 3], [176, 10, 3], [186, 11, 3], [196, 10, 3], [206, 11, 3],
  ],
  shafts: [[90, 6]],
  walkers: [34, 55, 80, 100, 116, 141, 168, 190],
  turrets: [46, 88, 110, 140, 172],
  spitters: [28, 78, 114, 178],
  chargers: [68, 150],
  flyers: [
    [26, 150], [42, 122], [58, 152], [70, 116], [82, 154], [98, 112],
    [110, 150], [122, 120], [134, 152], [148, 114], [162, 150], [174, 120],
    [186, 152], [198, 124], [206, 150],
  ],
  checkpoints: [20, 66, 112, 158, 200],
  orbs: [12, 20, 28, 38, 46, 58, 66, 78, 88, 100, 112, 122, 138, 146, 164, 170, 190, 202],
  // Ponts à plateforme : gouffres gelés — le passage se fait sur la dalle centrale.
  bridges: [[29, 6], [78, 5], [140, 7]],
}
