// Spec du niveau SKY FORTRESS (stage 5 — « les ponts du vide », LE PLUS DUR).
// Identité : PLATEFORMES AU-DESSUS DU VIDE. Beaucoup de dalles hautes qui
// servent de ponts au-dessus de larges fosses (peu de sol continu), dense en
// tourelles + drones. On traverse surtout en sautant de pont en pont.
export default {
  id: 'sky-fortress',
  width: 270,
  pits: [
    [26, 3], [44, 3], [62, 2], [78, 3],
    [98, 3], [114, 2], [130, 3],
    [150, 3], [166, 3], [182, 2],
    [198, 3], [214, 2], [224, 3],
  ],
  walls: [
    [36, 2], [54, 2], [70, 2], [90, 2], [106, 2], [122, 2],
    [140, 2], [174, 2], [190, 2], [206, 2], [220, 2],
  ],
  plats: [
    [15, 10, 4], [24, 11, 3], [40, 10, 4], [52, 11, 3], [68, 10, 3],
    [82, 11, 4], [96, 10, 3], [110, 11, 4], [124, 10, 3], [138, 11, 4],
    [152, 10, 3], [164, 11, 4], [178, 10, 3], [194, 11, 4], [208, 10, 4],
    [220, 11, 4],
  ],
  shafts: [[144, 6]],
  walkers: [
    18, 30, 48, 64, 86, 102, 118, 134, 204, 228,
  ],
  turrets: [
    34, 50, 74, 92, 108, 128, 186, 210, 222,
  ],
  chargers: [42, 116],
  spitters: [60, 136, 180],
  flyers: [
    [22, 145], [46, 122], [66, 150], [88, 128], [104, 148], [120, 118],
    [142, 150], [162, 126], [180, 148], [196, 120], [212, 148], [224, 128],
  ],
  checkpoints: [20, 66, 112, 164, 194, 228],
  orbs: [12, 20, 29, 40, 48, 58, 72, 88, 94, 112, 126, 136, 156, 164, 178, 192, 202, 222],
}
