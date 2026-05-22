// --- Archetype & Tag Constants ---

export const ARCHETYPE = {
  MELEE: 'melee',
  CHARGER: 'charger',
  RANGED: 'ranged',
  EXPLODER: 'exploder',
  SUMMONER: 'summoner',
  CONTROLLER: 'controller',
  SUPPORT: 'support',
  ELITE: 'elite',
};

export const TAG = {
  SWARM: 'swarm',
  TANK: 'tank',
  FLYING: 'flying',
  ARMORED: 'armored',
  FIRE: 'fire',
  ICE: 'ice',
  POISON: 'poison',
  DARK: 'dark',
};

export const ELEM_COLOR = {
  fire: '#ff5522',
  ice: '#7fdbff',
  poison: '#2ecc71',
  dark: '#9b59b6',
};

// --- Enemy Type Definitions (16 types, grouped by archetype) ---

export const ENEMY_TYPES = [
  // ── Melee ────────────────────────────────
  {
    id: 'skeleton', name: '骷髅',
    color: '#e74c3c', hp: 1, speed: 40, size: 10, score: 10,
    minWave: 1, archetype: ARCHETYPE.MELEE, tags: [],
  },
  {
    id: 'slime', name: '史莱姆',
    color: '#2ecc71', hp: 2, speed: 25, size: 14, score: 25,
    minWave: 2, archetype: ARCHETYPE.MELEE, tags: [TAG.SWARM],
  },
  {
    id: 'golem', name: '石像鬼',
    color: '#7f8c8d', hp: 6, speed: 20, size: 18, score: 50,
    minWave: 5, archetype: ARCHETYPE.MELEE, tags: [TAG.TANK],
  },

  // ── Charger ──────────────────────────────
  {
    id: 'bat', name: '蝙蝠',
    color: '#8e44ad', hp: 1, speed: 55, size: 8, score: 15,
    minWave: 1, archetype: ARCHETYPE.CHARGER, tags: [TAG.SWARM],
  },
  {
    id: 'assassin', name: '刺客',
    color: '#2c3e50', hp: 2, speed: 70, size: 8, score: 35,
    minWave: 5, archetype: ARCHETYPE.CHARGER, tags: [],
  },

  // ── Ranged ───────────────────────────────
  {
    id: 'skeleton_archer', name: '骷髅弓手',
    color: '#e67e22', hp: 2, speed: 30, size: 10, score: 30,
    minWave: 2, archetype: ARCHETYPE.RANGED, tags: [],
    shootInterval: 2.5, projectileSpeed: 100,
  },
  {
    id: 'dark_mage', name: '暗黑法师',
    color: '#9b59b6', hp: 3, speed: 35, size: 10, score: 40,
    minWave: 4, archetype: ARCHETYPE.RANGED, tags: [TAG.DARK],
    shootInterval: 2.0, projectileSpeed: 130,
  },

  // ── Exploder ─────────────────────────────
  {
    id: 'bomber', name: '炸弹人',
    color: '#ff5522', hp: 1, speed: 45, size: 10, score: 20,
    minWave: 3, archetype: ARCHETYPE.EXPLODER, tags: [TAG.FIRE],
    explodeRadius: 50, explodeDamage: 2,
  },
  {
    id: 'swarm_bomber', name: '蜂群炸弹',
    color: '#ff8844', hp: 2, speed: 55, size: 8, score: 30,
    minWave: 6, archetype: ARCHETYPE.EXPLODER, tags: [TAG.SWARM, TAG.FIRE],
    explodeRadius: 40, explodeDamage: 1,
  },

  // ── Summoner ─────────────────────────────
  {
    id: 'necromancer', name: '死灵法师',
    color: '#6c3483', hp: 4, speed: 25, size: 12, score: 60,
    minWave: 5, archetype: ARCHETYPE.SUMMONER, tags: [TAG.DARK],
    summonInterval: 5, maxMinions: 6, minionHp: 1,
  },

  // ── Controller ───────────────────────────
  {
    id: 'frost_mage', name: '冰霜法师',
    color: '#5dade2', hp: 3, speed: 30, size: 10, score: 40,
    minWave: 4, archetype: ARCHETYPE.CONTROLLER, tags: [TAG.ICE],
    shootInterval: 3.0, projectileSpeed: 90,
    controlType: 'slow', controlDuration: 2.0,
  },
  {
    id: 'vine', name: '藤蔓怪',
    color: '#1abc9c', hp: 4, speed: 20, size: 14, score: 35,
    minWave: 5, archetype: ARCHETYPE.CONTROLLER, tags: [TAG.POISON],
    ai: 'spike', spikeInterval: 4.0,
  },

  // ── Support ──────────────────────────────
  {
    id: 'shaman', name: '萨满',
    color: '#f39c12', hp: 3, speed: 30, size: 10, score: 45,
    minWave: 5, archetype: ARCHETYPE.SUPPORT, tags: [],
    auraRadius: 60, speedBuff: 0.2, healInterval: 3,
  },

  // ── Elite ────────────────────────────────
  {
    id: 'vampire', name: '吸血鬼',
    color: '#c0392b', hp: 5, speed: 45, size: 12, score: 60,
    minWave: 6, archetype: ARCHETYPE.ELITE, tags: [TAG.DARK],
    lifesteal: 0.3,
  },
  {
    id: 'ghost_king', name: '幽灵王',
    color: '#bdc3c7', hp: 8, speed: 35, size: 16, score: 80,
    minWave: 7, archetype: ARCHETYPE.ELITE, tags: [TAG.DARK, TAG.TANK],
  },
];

// --- Wave Rules ---

export const WAVE_RULES = {
  baseCount: 4,
  growth: 1.5,
  waveInterval: 30,
  trickleInterval: 2.5,
  dangerWaveInterval: 5,

  archetypeSchedule: {
    [ARCHETYPE.MELEE]:     { startWave: 1, weight: 10 },
    [ARCHETYPE.CHARGER]:   { startWave: 1, weight: 7 },
    [ARCHETYPE.RANGED]:    { startWave: 2, weight: 6 },
    [ARCHETYPE.EXPLODER]:  { startWave: 3, weight: 4 },
    [ARCHETYPE.CONTROLLER]:{ startWave: 4, weight: 3 },
    [ARCHETYPE.SUMMONER]:  { startWave: 5, weight: 2 },
    [ARCHETYPE.SUPPORT]:   { startWave: 5, weight: 2 },
    [ARCHETYPE.ELITE]:     { startWave: 6, weight: 1 },
  },

  chemistry: [
    { combo: [ARCHETYPE.SUMMONER, ARCHETYPE.MELEE],     effect: 'meat_shield' },
    { combo: [ARCHETYPE.CONTROLLER, ARCHETYPE.RANGED],  effect: 'kill_zone' },
    { combo: [ARCHETYPE.SUPPORT, ARCHETYPE.TANK],       effect: 'unkillable' },
    { combo: [ARCHETYPE.EXPLODER, TAG.SWARM],           effect: 'chain_reaction' },
    { combo: [ARCHETYPE.CHARGER, ARCHETYPE.CONTROLLER], effect: 'lockdown' },
  ],
};

// --- Helpers ---

const _byArchetype = new Map();
for (const e of ENEMY_TYPES) {
  let list = _byArchetype.get(e.archetype);
  if (!list) { list = []; _byArchetype.set(e.archetype, list); }
  list.push(e);
}

/** Get all enemy types available at a given wave */
export function getAvailableEnemies(waveNum) {
  return ENEMY_TYPES.filter(e => waveNum >= e.minWave);
}

/** Weighted random roll from the full pool (for trickle spawn) */
export function rollEnemyType(gameTime) {
  // Approximate wave from gameTime (30s per wave)
  const waveNum = Math.max(1, Math.floor(gameTime / 30) + 1);
  const pool = getAvailableEnemies(waveNum);
  const totalWeight = pool.length;
  if (totalWeight === 0) return ENEMY_TYPES[0];
  // Simple uniform for trickle — each available type equally likely
  return pool[Math.floor(Math.random() * totalWeight)];
}

/** Roll a random enemy from a specific archetype pool */
export function rollEnemyByArchetype(archetype, waveNum) {
  const pool = (_byArchetype.get(archetype) || []).filter(e => waveNum >= e.minWave);
  if (pool.length === 0) {
    // Fallback to melee
    const fallback = (_byArchetype.get(ARCHETYPE.MELEE) || []).filter(e => waveNum >= e.minWave);
    return fallback[0] || ENEMY_TYPES[0];
  }
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Generate a wave composition: returns [{ enemyDef, count }] */
export function rollWaveComposition(waveNum, timeScale = 1) {
  const rules = WAVE_RULES;
  const isDanger = waveNum % rules.dangerWaveInterval === 0;

  // Total enemy count for this wave (scaled by time)
  const totalCount = Math.floor((rules.baseCount + waveNum * rules.growth) * timeScale);

  // Build weighted archetype pool for this wave
  const schedule = rules.archetypeSchedule;
  const weightedArchetypes = [];
  for (const [arch, cfg] of Object.entries(schedule)) {
    if (waveNum >= cfg.startWave) {
      let w = cfg.weight;
      if (isDanger && arch === ARCHETYPE.ELITE) w *= 3;
      weightedArchetypes.push({ arch, weight: w });
    }
  }

  // Danger wave: guarantee summoner or support
  const guaranteed = [];
  if (isDanger && waveNum >= 5) {
    const ga = Math.random() < 0.5 ? ARCHETYPE.SUMMONER : ARCHETYPE.SUPPORT;
    guaranteed.push(ga);
  }
  // Always have at least 1 melee
  if (!guaranteed.includes(ARCHETYPE.MELEE)) {
    guaranteed.push(ARCHETYPE.MELEE);
  }

  // Assign archetypes to each slot
  const slots = [...guaranteed];
  const remaining = totalCount - slots.length;

  if (remaining > 0 && weightedArchetypes.length > 0) {
    const totalW = weightedArchetypes.reduce((s, a) => s + a.weight, 0);
    for (let i = 0; i < remaining; i++) {
      let roll = Math.random() * totalW;
      for (const { arch, weight } of weightedArchetypes) {
        roll -= weight;
        if (roll <= 0) { slots.push(arch); break; }
      }
    }
  }

  // Convert slots → [{ enemyDef, count }]
  const archCounts = new Map();
  for (const arch of slots) {
    archCounts.set(arch, (archCounts.get(arch) || 0) + 1);
  }

  const composition = [];
  for (const [arch, count] of archCounts) {
    // Pick one enemy type per archetype for this wave
    const enemyDef = rollEnemyByArchetype(arch, waveNum);
    composition.push({ enemyDef, count });
  }

  return composition;
}
