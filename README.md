# darkmedia-x_megaman-game

Jeu de plateforme 2D style Megaman (SNES), développé avec **Phaser 3**, **TypeScript** et **Vite**.

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
  objects/
    Bullet.ts     # Projectile du joueur
  scenes/
    GameScene.ts  # Niveau, plateformes, caméra, UI
  main.ts         # Configuration Phaser
```

## Prochaines améliorations

- [x] Sprites pixel-art (générés par `scripts/generate-assets.mjs`)
- [x] Tilemap externe (Tiled, `public/assets/level.json`)
- [ ] Sons et musique chiptune
- [ ] Boss de fin de niveau
- [ ] Système de vies / game over
- [ ] Écran-titre et sélection de stage

## Génération des assets

Les sprites et la tilemap sont générés par script (regénérer après modification) :

```bash
node scripts/generate-assets.mjs
```
