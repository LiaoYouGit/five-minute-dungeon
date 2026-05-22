export const CHARACTERS = {
  archer: {
    id: 'archer',
    name: '射手',
    nameEn: 'Archer',
    icon: '🏹',
    available: true, // 当前只有射手可选
    desc: '远程攻击专家，擅长精准打击',
    baseStats: {
      hp: 100,
      speed: 80,
      attackRange: 150,
    },
    bonds: {
      // 羁绊：射手+远程射击 = 攻击范围+50%
      weapon_ranged_up: {
        type: 'range',
        bonus: 0.5,
        desc: '远程精通：攻击范围+50%',
        effect: 'range_up',
      },
      // 羁绊：射手+冰锥 = 减速时间+1秒
      weapon_ice_shard: {
        type: 'slow',
        bonus: 1.0,
        desc: '冰霜射手：减速时间+1秒',
        effect: 'slow_duration',
      },
      // 羁绊：射手+闪电链 = 连跳+2
      weapon_chain_lightning: {
        type: 'jump',
        bonus: 2,
        desc: '雷电射手：连锁+2目标',
        effect: 'chain_jump',
      },
      // 羁绊：射手+火球 = 爆炸范围+30%
      weapon_fireball: {
        type: 'radius',
        bonus: 0.3,
        desc: '火焰射手：爆炸范围+30%',
        effect: 'explode_radius',
      },
    },
    color: '#4ecdc4', // 青色
  },

  warrior: {
    id: 'warrior',
    name: '战士',
    nameEn: 'Warrior',
    icon: '⚔',
    available: false, // 待开放
    desc: '近战之王，高伤害高血量',
    baseStats: {
      hp: 120,
      speed: 70,
      attackRange: 60,
    },
    bonds: {
      // 羁绊：战士+斩击 = 伤害+30%
      weapon_melee_slash: {
        type: 'damage',
        bonus: 0.3,
        desc: '斩击精通：伤害+30%',
        effect: 'damage_mult',
      },
      // 羁绊：战士+旋 = 刀刃+2
      weapon_melee_orbit: {
        type: 'blades',
        bonus: 2,
        desc: '旋刃精通：刀刃+2',
        effect: 'orbit_blades',
      },
      // 羁绊：战士+爆 = 爆炸伤害+50%
      weapon_melee_burst: {
        type: 'burst',
        bonus: 0.5,
        desc: '爆破精通：爆炸伤害+50%',
        effect: 'burst_damage',
      },
    },
    color: '#e74c3c', // 红色
  },

  tank: {
    id: 'tank',
    name: '坦克',
    nameEn: 'Tank',
    icon: '🛡',
    available: false, // 待开放
    desc: '防御专家，超高血量',
    baseStats: {
      hp: 150,
      speed: 60,
      attackRange: 50,
    },
    bonds: {
      // 羁绊：坦克+攻速 = 减伤+10%
      atkspd_up: {
        type: 'defense',
        bonus: 0.1,
        desc: '坚韧意志：减伤+10%',
        effect: 'damage_reduction',
      },
      // 羁绊：坦克+HP = HP再+20%
      hp_up: {
        type: 'hp',
        bonus: 0.2,
        desc: '钢铁之躯：HP+20%',
        effect: 'hp_mult',
      },
    },
    color: '#f39c12', // 黄色
  },

  mage: {
    id: 'mage',
    name: '法师',
    nameEn: 'Mage',
    icon: '✨',
    available: false, // 待开放
    desc: '魔法大师，AOE控制专家',
    baseStats: {
      hp: 80,
      speed: 70,
      attackRange: 120,
    },
    bonds: {
      // 羁绊：法师+火球 = 爆炸范围+50%
      weapon_fireball: {
        type: 'radius',
        bonus: 0.5,
        desc: '烈焰风暴：爆炸范围+50%',
        effect: 'explode_radius',
      },
      // 羁绊：法师+闪电链 = 连跳+3
      weapon_chain_lightning: {
        type: 'jump',
        bonus: 3,
        desc: '雷霆万钧：连锁+3目标',
        effect: 'chain_jump',
      },
      // 羁绊：法师+冰锥 = 减速+20%
      weapon_ice_shard: {
        type: 'slow_amount',
        bonus: 0.2,
        desc: '冰封领域：减速效果+20%',
        effect: 'slow_amount',
      },
    },
    color: '#9b59b6', // 紫色
  },
};

export function getAvailableCharacters() {
  return Object.values(CHARACTERS).filter((c) => c.available);
}

export function getCharacterById(id) {
  return CHARACTERS[id] || null;
}

export function getCharacterBond(characterId, skillId) {
  const character = CHARACTERS[characterId];
  if (!character) return null;
  return character.bonds[skillId] || null;
}