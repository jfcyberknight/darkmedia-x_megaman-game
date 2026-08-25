# Modèle physique — Mega Blaster (réparé le 2025-08-25)

Mémoire des décisions physiques du jeu. À lire avant de toucher à la boucle,
aux vitesses ou aux durées de vie.

## Le modèle

| Paramètre | Valeur | Pourquoi |
|---|---|---|
| `physics.arcade.fixedStep` | **`false`** | La physique avance avec le **temps réel** quelle que soit la fréquence d'écran. Avec `true` (défaut Phaser), 1 pas de 16,6 ms par frame rendue : **2× trop vite sur 120 Hz**, 1,5× sur 90 Hz, 0,5× sur 30 Hz. |
| Delta physique | **clampé à 33,4 ms** (voir `main.ts`) | Sous ~30 fps, le jeu **ralentit** au lieu de laisser les corps sauter à travers les tuiles (tunneling). Pire cas : chute `maxFall` 260 px/s × 33 ms ≈ 8,7 px < tuile 16 px. |
| Portée des balles | **200 px en distance** (`Bullet.MAX_RANGE`) | L'ancienne limite temporelle (1400 ms via `delayedCall`, temps réel) tuait les balles après ~50 px à bas FPS : l'horloge des timers ne ralentit pas avec la physique. Toute durée de vie d'projectile doit être **en distance**, jamais en ms. |
| Gravité | 450 px/s² | — |
| Vitesse max chute (`maxFall`) | 260 px/s | Garde la chute < 1 tuile par frame clampée. |

## Règles d'or (à ne pas violer)

1. **Aucune durée de vie / cooldown de gameplay en ms temps réel** pour ce qui
   se déplace (balles, ennemis) : utiliser des **distances** ou des états.
   Les timers temps réel ne sont acceptables que pour ce qui est purement
   cosmétique (clignotements, toasts).
2. **Ne pas réactiver `fixedStep: true`** sans avoir une solution de
   multi-pas : le jeu redeviendrait dépendant du taux de rafraîchissement.
3. Le clamp delta vit dans `main.ts` (wrap de `world.update`). Si vous créez
   un second monde physique, appliquer le même clamp.
4. Vitesse max horizontale corps : 120 px/s (`setMaxVelocity`) → 2 px par
   frame clampée : aucun tunneling possible sur tuiles 16 px.

## Symptômes historiques (avant correctif)

- « Les balles disparaissent après le 2e saut » → limite temporelle des
  balles vs pas fixe (écrans 90/120 Hz : mort à ~98 px au lieu de 196).
- Jeu « trop rapide / étrange » sur téléphone récent → 120 Hz × pas fixe.
- Taps perdus à bas FPS → voir `src/touch.ts` (file d'attente des appuis).

## Vérification

`node scripts/diag-mobile.mjs [url] [cpuThrottle]` — teste tir, portée,
saut, contact, anti-latch, à 60 fps comme throttlé (téléphone faible).
`node scripts/playthrough.mjs [url]` — niveau 1 complet.
