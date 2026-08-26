/** Armes de boss : chaque gardien vaincu donne SON pouvoir (comme les
 *  armes de boss dans Mega Man). Le joueur peut équiper celles absorbées. */

export type WeaponId = 'buster' | 'ram' | 'drill' | 'venom' | 'cryo' | 'aeron'

export interface WeaponDef {
  id: WeaponId
  name: string
  desc: string
  tint: number
  damage: number
  speed: number
  pierce: boolean
  burst?: number   // nombre de balles en éventail (tir simultané)
  homing?: boolean // la balle se dirige vers l'ennemi le plus proche
  explode?: boolean // explose (zone) en touchant
  freeze?: boolean  // gèle / stoppe brièvement l'ennemi touché
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  buster: { id: 'buster', name: 'BUSTER', desc: 'Fiable — énergie ∞', tint: 0xff2436, damage: 1, speed: 140, pierce: false },
  ram:    { id: 'ram',    name: 'RAM SHOT', desc: 'Triple tir en éventail', tint: 0xffd166, damage: 2, speed: 150, pierce: false, burst: 3 },
  venom:  { id: 'venom',  name: 'VENOM',    desc: 'Projectile explosif', tint: 0x4ade80, damage: 2, speed: 110, pierce: false, explode: true },
  drill:  { id: 'drill',  name: 'DRILL',    desc: 'Perforant', tint: 0xfb923c, damage: 3, speed: 120, pierce: true },
  cryo:   { id: 'cryo',   name: 'CRYO',     desc: 'Gèle les ennemis', tint: 0x93c5fd, damage: 2, speed: 130, pierce: false, freeze: true },
  aeron:  { id: 'aeron',  name: 'AERON',    desc: 'Tir guidé', tint: 0xf472b6, damage: 2, speed: 135, pierce: false, homing: true },
}

/** Pouvoir donné par le gardien de chaque stage (id de stage -> arme). */
export const BOSS_WEAPON: Record<string, WeaponId> = {
  'neon-city': 'ram',
  'toxic-plant': 'venom',
  'scorched-desert': 'drill',
  'frost-lab': 'cryo',
  'sky-fortress': 'aeron',
}

export const WEAPON_LIST: WeaponId[] = ['buster', 'ram', 'venom', 'drill', 'cryo', 'aeron']
