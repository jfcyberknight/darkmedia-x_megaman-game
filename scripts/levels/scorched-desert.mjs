// Spec du niveau SCORCHED DESERT (stage 3 — « plaines ouvertes »).
// Identité : ESPACE OUVERT. Très peu de fosses et de murs — de longues dunes
// plates où les CHARGEURS (qui foncent) et les marcheurs arrivent en meute.
export default {
  id: 'scorched-desert',
  width: 235,
  pits: [
    [26, 3], [64, 3], [118, 3], [156, 2],
  ],
  walls: [
    [44, 2], [90, 2], [176, 2],
  ],
  plats: [
    [16, 10, 4], [56, 11, 4], [82, 10, 4], [104, 11, 4], [144, 10, 4], [166, 11, 4],
  ],
  walkers: [20, 38, 52, 74, 84, 100, 110, 130, 146, 184],
  chargers: [30, 48, 78, 96, 124, 140, 162, 188],
  turrets: [22, 70, 134, 178],
  spitters: [58, 154],
  flyers: [
    [30, 150], [50, 132], [72, 148], [90, 138], [114, 152], [132, 126],
    [150, 148], [168, 132], [182, 152], [190, 140],
  ],
  checkpoints: [20, 74, 110, 150, 188],
  orbs: [12, 18, 32, 35, 47, 55, 63, 75, 86, 94, 105, 116, 127, 138, 150, 160, 173, 186],
  // Ponts à plateforme : chasmes du désert — larges ouvertures traversées sur une
  // dalle, le sol étant infranchissable au saut.
  bridges: [[34, 6], [102, 6], [164, 6]],
}
