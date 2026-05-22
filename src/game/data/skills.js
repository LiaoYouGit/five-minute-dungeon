export const SKILL_POOL = [
  // --- Weapons (武器/升级) ---
  { id: 'weapon_ranged_up',     name: '远程·升级', desc: '强化远程射击：伤害+1，攻速+5%',     type: 'weapon', maxStack: 4, icon: '🔫' },
  { id: 'weapon_melee_slash',   name: '近战·斩',   desc: '解锁/强化扇形挥砍：120°范围AOE',   type: 'weapon', maxStack: 5, icon: '🗡' },
  { id: 'weapon_melee_orbit',   name: '近战·旋',   desc: '解锁/强化旋转刀刃：每级+1刀刃',     type: 'weapon', maxStack: 5, icon: '🌀' },
  { id: 'weapon_melee_burst',   name: '近战·爆',   desc: '解锁/强化周围爆破：每级+15%范围',   type: 'weapon', maxStack: 5, icon: '☄' },
  { id: 'weapon_pierce_spear',  name: '贯穿·矛',   desc: '解锁/强化穿透长矛：穿透+1敌人/级', type: 'weapon', maxStack: 5, icon: '➹' },
  { id: 'weapon_fireball',      name: '火球术',    desc: '解锁/强化火球：命中后爆炸AOE',     type: 'weapon', maxStack: 5, icon: '🔥' },
  { id: 'weapon_chain_lightning', name: '闪电链',  desc: '解锁/强化闪电：命中后连锁跳跃',    type: 'weapon', maxStack: 5, icon: '⚡' },
  { id: 'weapon_boomerang',     name: '回旋镖',    desc: '解锁/强化回旋镖：往返双倍命中',     type: 'weapon', maxStack: 5, icon: '🪃' },
  { id: 'weapon_ice_shard',     name: '冰锥',      desc: '解锁/强化冰锥：穿透+减速2秒',       type: 'weapon', maxStack: 5, icon: '❄' },

  // --- Attack (全局buff，影响所有武器) ---
  { id: 'atk_up',     name: '攻击力+20%',  desc: '所有武器伤害提升20%',         type: 'stat', maxStack: 5, icon: '⚔' },
  { id: 'atkspd_up',  name: '攻速+20%',    desc: '所有武器攻击间隔缩短20%',     type: 'stat', maxStack: 5, icon: '⏩' },
  { id: 'extra_proj', name: '+1 弹丸',     desc: '远程射击同时多发1颗子弹',     type: 'stat', maxStack: 4, icon: '✦' },
  { id: 'range_up',   name: '射程+25%',    desc: '所有攻击范围扩大',            type: 'stat', maxStack: 3, icon: '◎' },
  { id: 'pierce',     name: '穿透弹',      desc: '所有弹丸额外穿透1个敌人',     type: 'stat', maxStack: 2, icon: '✜' },
  { id: 'big_proj',   name: '大型弹',      desc: '远程子弹体积和伤害+50%',      type: 'stat', maxStack: 2, icon: '●' },
  { id: 'ricochet',   name: '弹射弹',      desc: '远程子弹击中后弹射到附近敌人', type: 'stat', maxStack: 2, icon: '⟳' },

  // --- Defense ---
  { id: 'heal',    name: '恢复1HP', desc: '立即恢复1点生命',         type: 'instant', maxStack: 99, icon: '♥' },
  { id: 'max_hp',  name: '生命+1',  desc: '最大生命值+1',            type: 'instant', maxStack: 5,  icon: '♡' },
  { id: 'shield',  name: '护盾',    desc: '受伤时有概率抵挡1点伤害', type: 'stat',    maxStack: 3,  icon: '◆' },

  // --- Speed ---
  { id: 'spd_up',  name: '移速+15%', desc: '玩家移动速度提升', type: 'stat', maxStack: 5, icon: '↑' },

  // --- Utility ---
  { id: 'magnet',     name: '磁铁+50%', desc: '经验/掉落吸取范围增大', type: 'stat', maxStack: 3, icon: '⊗' },
  { id: 'exp_boost',  name: '经验+25%', desc: '获取经验值提升',         type: 'stat', maxStack: 3, icon: '★' },

  // --- Special ---
  { id: 'damage_all', name: '全屏伤害', desc: '对所有敌人造成3点伤害',   type: 'instant', maxStack: 99, icon: '✸' },
  { id: 'freeze',     name: '冰冻光环', desc: '附近敌人减速40%',         type: 'stat',    maxStack: 3,  icon: '❅' },
  { id: 'burn',       name: '燃烧弹',   desc: '远程子弹附带持续伤害',     type: 'stat',    maxStack: 3,  icon: '♨' },
  { id: 'thorns',     name: '荆棘护甲', desc: '接触你的敌人受到1点伤害', type: 'stat',    maxStack: 3,  icon: '🌿' },
];
