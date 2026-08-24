# darkmedia-x_megaman-game

Jeu de plateforme 2D au rendu **16-bit authentique** (256×224 natif, pixel-art, palette limitée — esprit Mega Man X), développé avec **Phaser 3**, **TypeScript** et **Vite**.

## Stack

- [Phaser 3](https://phaser.io/) — moteur de jeu 2D
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — build tool
- [Cloudflare Pages](https://pages.cloudflare.com/) — déploiement

## Contrôles

### 📱 Mobile / tactile

Sur écran tactile, un **D-pad virtuel + boutons** apparaît automatiquement :

| Contrôle | Action |
|----------|--------|
| ◀ ▶ | Déplacement |
| **A** | Saut (maintenir = saut plus haut) |
| **B** | Tir — tap = tir rapide, **maintenu** = charge, relâcher = tir chargé |
| 🔊 / ⛶ (haut-droit) | Son on/off · Plein écran |

Menus : tap pour avancer dans l'intro ; sur la sélection de stage, tap = sélection,
re-tap sur la carte sélectionnée = confirmer. Le clavier reste fonctionnel en parallèle.

### ⌨️ Clavier

| Touche | Action |
|--------|--------|
| ← → | Déplacement (avec accélération/friction) |
| ↑ | Saut (hauteur variable — relâcher tôt pour un petit saut) |
| ← → contre un mur + ↑ | **Saut de mur** (glissade automatique le long du mur) |
| Z (tap) | Tir rapide |
| Z (maintenu) | Charge l'énergie — relâcher : tir moyen (0,4 s) ou gros tir perforant (1 s) |
| M | Son on/off |

## Boucle de jeu

- **3 vies** : à mort, le stage recommence avec une vie en moins ; à 0, écran **GAME OVER** puis retour à la sélection.
- 6 ennemis patrouilleurs + un boss **WAR MACHINE** en fin de niveau.
- Les ennemis vaincus lâchent parfois des **orbes d'énergie** (+2 HP) ; d'autres sont placées sur les plateformes (aimantées quand on approche).
- Vaincre le boss laisse tomber son **noyau de pouvoir** : en le collectant, le héros absorbe son pouvoir (+1 dégât sur tous les tirs, teinte flamme, charge maximale cyclée) puis le stage est terminé.
- **Sons et musique** 100 % synthétisés en Web Audio (aucun asset) : jingle d'intro DarkMedia-X, thème de menu mystérieux, thème de stage MMX, tirs, charge, impacts, explosions, collecte, jingles de pouvoir/game over.

## Développement local

```bash
npm install
npm run dev
```

Puis ouvre http://localhost:5173.

## Build de production

```bash
npm run build
```

Le résultat est dans `dist/`.

## Déploiement

Le déploiement est automatisé via GitHub Actions sur Cloudflare Pages.

**URL de production : <https://mega-blaster.darkmedia-x.com>** (alias `megaman-game.pages.dev`)

### Prérequis

1. Créer un projet Cloudflare Pages nommé **megaman-game**.
2. Ajouter ces secrets dans le repo GitHub :
   - `CF_API_TOKEN` — token Cloudflare avec permission `Cloudflare Pages:Edit`
   - `CF_ACCOUNT_ID` — ID du compte Cloudflare

### Domaine personnalisé

`mega-blaster.darkmedia-x.com` est attaché au projet Pages. Pour le (re)configurer :

- **Automatique** : GitHub → Actions → *Setup custom domain* → *Run workflow*
  (attache le domaine au projet Pages + crée le CNAME proxifié ; nécessite `DNS:Edit` sur le token)
- **Manuel** : Cloudflare → Pages → *megaman-game* → *Custom domains* → ajouter
  `mega-blaster.darkmedia-x.com` (le CNAME est créé automatiquement si la zone est sur le même compte).

À chaque push sur `main`, le workflow build et déploie automatiquement.

## Structure du projet

```
src/
  entities/
    Player.ts     # Joueur (déplacement, saut, tir, dégâts)
    Enemy.ts      # Ennemi patrouilleur
    Boss.ts       # Boss de fin de niveau
  objects/
    Bullet.ts     # Projectile du joueur
  scenes/
    BootScene.ts        # Preload des textures partagées + splash
    TitleScene.ts       # Écran-titre
    StageSelectScene.ts # Sélection de stage
    GameScene.ts        # Niveau, plateformes, caméra, HUD
  main.ts         # Configuration Phaser (960x540, lissage)
```

## Génération des assets (art HD procédural)

Tous les sprites et décors sont générés par script en style 2D moderne :
formes lisses anti-aliasées, dégradés, rim light, glow additif. Le monde est
à l'échelle x2.5 (tuiles 80px, monde 4000x1600) et le rendu est lissé
(`pixelArt: false`).

```bash
npm run assets   # régénère public/assets/*.png + level.json (échelle 80px)
```

Sprites en pixel-art procédural (grille de pixels, palette limitée, outline 1px). Des aperçus agrandis sont écrits dans `scripts/preview/` (ignoré par git).

## Prochaines améliorations

- [x] Sprites HD procéduraux (perso, ennemis, boss, tuiles, parallaxe par stage)
- [x] Tilemap externe (Tiled, `public/assets/level.json`)
- [x] Écran-titre et sélection de stage
- [x] Boss de fin de niveau avec barre de vie
- [x] Tir chargé (maintenir Z) + orbes d'énergie + pouvoir de boss absorbable
- [x] Sons et musique (Web Audio procédural, touche M)
- [x] Système de vies / game over
- [x] Contrôles tactiles mobiles (D-pad virtuel + A/B, tap menus)
