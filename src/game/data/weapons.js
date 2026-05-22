export const WEAPONS = {
  ranged: {
    id: 'ranged', name: '远程射击', icon: '🔫',
    baseDmg: 1, dmgPerLevel: 1,
    baseInterval: 0.65, cdPerLevel: 0.05,
    baseSpeed: 220, maxLevel: 5,
    type: 'ranged',
  },
  melee_slash: {
    id: 'melee_slash', name: '近战·斩', icon: '🗡',
    baseDmg: 3, dmgPerLevel: 1.5,
    baseInterval: 1.2, cdPerLevel: 0.08,
    maxLevel: 5, type: 'melee',
    arc: Math.PI * 2 / 3, // 120 degrees
    range: 50, rangePerLevel: 0.1, // +10% per level
  },
  melee_orbit: {
    id: 'melee_orbit', name: '近战·旋', icon: '🌀',
    baseDmg: 2, dmgPerLevel: 1,
    baseInterval: 0.5, cdPerLevel: 0.03,
    maxLevel: 5, type: 'melee',
    orbitRadius: 35, baseBlades: 2,
  },
  melee_burst: {
    id: 'melee_burst', name: '近战·爆', icon: '💥',
    baseDmg: 4, dmgPerLevel: 2,
    baseInterval: 2.5, cdPerLevel: 0.15,
    maxLevel: 5, type: 'melee',
    radius: 60, radiusPerLevel: 0.15,
  },
  pierce_spear: {
    id: 'pierce_spear', name: '贯穿·矛', icon: '➹',
    baseDmg: 2, dmgPerLevel: 1,
    baseInterval: 1.5, cdPerLevel: 0.1,
    baseSpeed: 280, maxLevel: 5, type: 'pierce',
  },
  fireball: {
    id: 'fireball', name: '火球术', icon: '🔥',
    baseDmg: 3, dmgPerLevel: 1.5,
    baseInterval: 1.8, cdPerLevel: 0.1,
    baseSpeed: 140, maxLevel: 5, type: 'ranged',
    explodeRadius: 45, radiusPerLevel: 0.12,
  },
  chain_lightning: {
    id: 'chain_lightning', name: '闪电链', icon: '⚡',
    baseDmg: 2, dmgPerLevel: 0.8,
    baseInterval: 1.4, cdPerLevel: 0.08,
    maxLevel: 5, type: 'ranged',
    baseJumps: 2, jumpRange: 80, range: 200,
  },
  boomerang: {
    id: 'boomerang', name: '回旋镖', icon: '🪃',
    baseDmg: 1.5, dmgPerLevel: 1,
    baseInterval: 1.6, cdPerLevel: 0.1,
    baseSpeed: 220, maxLevel: 5, type: 'ranged',
    travelDist: 180,
  },
  ice_shard: {
    id: 'ice_shard', name: '冰锥', icon: '❄',
    baseDmg: 1.5, dmgPerLevel: 0.8,
    baseInterval: 1.0, cdPerLevel: 0.06,
    baseSpeed: 240, maxLevel: 5, type: 'pierce',
    slowDuration: 2.0, slowDurationPerLevel: 0.3, slowAmount: 0.5,
  },
};

export function calcDmg(def, level) {
  return def.baseDmg + (level - 1) * def.dmgPerLevel;
}

export function calcInterval(def, level) {
  return Math.max(0.15, def.baseInterval - (level - 1) * def.cdPerLevel);
}
