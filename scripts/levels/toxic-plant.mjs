// Spec du niveau TOXIC PLANT (stage 2 — usine toxique corrompue, difficulté moyenne).
// Format attendu par scripts/generate-level.mjs. Toutes les positions sont en
// TUILLES (16 px). Largeur = nombre de tuiles. Le générateur convertit en px.
//
// Contraindications (à respecter ABSOLUMENT — dérivées de la physique réelle) :
//   - pits : largeur <= 3, jamais dans les 14 premières tuiles (spawn), jamais
//     dans l'arène du boss (tuiles >= 181 pour W=220), jamais sous un
//     ennemi/CP/orbe, jamais adjacents (>= 4 tuiles de sol entre deux trous).
//   - walls : hauteur = 2 uniquement (3 = fenêtre de saut trop courte), colonne
//     seule, pas sur un trou, >= 4 tuiles de sol après un trou et avant le suivant.
//   - plats : row 10 ou 11 uniquement (dalles hautes décoratives).
//   - ennemis/CP/orbes : au sol (pas sur trou ni mur), >= 2 tuiles d'un bord de trou.
//   - flyers : y en pixels entre 100 et 170.
//   - arène : tuiles 181..219 sans trou ni mur (boss), approche plate dès 169.
export default {
  id: 'toxic-plant',
  width: 220,
  // 9 fosses (mix 2/3 de large), rythme régulier ~15-19 tuiles, fin à 169 < arène.
  pits: [
    [23, 3], [41, 2], [59, 3], [78, 2], [96, 3], [114, 2], [131, 3], [149, 2], [166, 3],
  ],
  // 8 murs h=2 : un précoce (tutoriel), puis un par segment entre deux fosses.
  walls: [
    [17, 2], [33, 2], [52, 2], [70, 2], [88, 2], [106, 2], [123, 2], [141, 2],
  ],
  // Dalles hautes décoratives (row 10/11 seulement).
  plats: [
    [15, 10, 4], [26, 11, 4], [36, 10, 4], [47, 11, 4], [65, 10, 4],
    [85, 11, 4], [103, 10, 4], [121, 11, 4], [139, 10, 4], [158, 11, 4], [174, 10, 4],
  ],
  // Marcheurs au sol, espacés, jamais à moins de 2 tuiles d'un bord de trou.
  shafts: [[158, 6]],
  walkers: [28, 46, 66, 84, 102, 120, 137, 155, 172],
  // Tourelles qui gardent les passages délicats (avant/après fosses et murs).
  turrets: [38, 56, 93, 127, 162, 178],
  // Drones volants (y en px, 100..170), répartis sur toute la longueur.
  flyers: [[20, 150], [34, 140], [62, 125], [81, 150], [110, 132], [144, 145], [170, 155]],
  // 6 checkpoints au sol, premier à 20, espacés de >= 25 tuiles ; dernier avant l'arène.
  checkpoints: [20, 50, 75, 111, 145, 179],
  // 18 orbes au sol répartis (un dans la zone de spawn comme neon-city).
  orbs: [12, 27, 30, 39, 49, 57, 68, 76, 86, 94, 104, 119, 128, 138, 147, 157, 163, 175],
}
