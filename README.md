# darkmedia-x_megaman-game

Jeu de plateforme 2D au style moderne (rendu 960×540 lisse, dégradés, glow, parallaxe), développé avec **Phaser 3**, **TypeScript** et **Vite**.

## Stack

- [Phaser 3](https://phaser.io/) — moteur de jeu 2D
- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vitejs.dev/) — build tool
- [Cloudflare Pages](https://pages.cloudflare.com/) — déploiement

## Contrôles

| Touche | Action |
|--------|--------|
| ← → | Déplacement |
| ↑ | Saut |
| Z | Tir |

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

### Prérequis

1. Créer un projet Cloudflare Pages nommé **megaman-game**.
2. Ajouter ces secrets dans le repo GitHub :
   - `CF_API_TOKEN` — token Cloudflare avec permission `Cloudflare Pages:Edit`
   - `CF_ACCOUNT_ID` — ID du compte Cloudflare

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

Des aperçus agrandis sont écrits dans `scripts/preview/` (ignoré par git).

## Prochaines améliorations

- [x] Sprites HD procéduraux (perso, ennemis, boss, tuiles, parallaxe par stage)
- [x] Tilemap externe (Tiled, `public/assets/level.json`)
- [x] Écran-titre et sélection de stage
- [x] Boss de fin de niveau avec barre de vie
- [ ] Sons et musique
- [ ] Système de vies / game over
