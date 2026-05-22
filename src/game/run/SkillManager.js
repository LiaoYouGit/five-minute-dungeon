import { SKILL_POOL } from '../data/skills.js';
import { MAX_LEVEL } from '../data/weapons.js';
import { getCharacterBond } from '../data/characters.js';

const MAX_TOTAL_WEAPON_LEVEL = 18; // 三把满级武器（3 × MAX_LEVEL）

export class SkillManager {
  constructor(characterId = 'archer') {
    this.acquired = [];
    this.characterId = characterId;
    this.activeBonds = []; // 活化的羁绊
  }

  rollChoices(count = 3, level = 1, player = null) {
    // Calculate total weapon level if player provided
    const totalWeaponLevel = this._calculateTotalWeaponLevel(player);

    // Filter available skills
    const available = SKILL_POOL.filter((s) => {
      const stackCount = this.acquired.filter((a) => a.id === s.id).length;

      // Check max stack limit
      if (stackCount >= s.maxStack) return false;

      // Check weapon level limit: hide weapon options when total weapon level >= 18
      if (s.type === 'weapon' && totalWeaponLevel >= MAX_TOTAL_WEAPON_LEVEL) {
        return false;
      }

      return true;
    });

    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  /** Calculate total weapon level from player's Weapons component */
  _calculateTotalWeaponLevel(player) {
    if (!player || !player.components.Weapons) return 0;

    const weapons = player.components.Weapons;
    let total = 0;

    // Sum all weapon levels
    for (const [weaponId, slot] of Object.entries(weapons.slots)) {
      total += slot.level || 0;
    }

    return total;
  }

  acquire(skill) {
    this.acquired.push({ ...skill });

    // 检测并激活羁绊
    const bond = getCharacterBond(this.characterId, skill.id);
    if (bond) {
      this.activeBonds.push({
        skillId: skill.id,
        bond: bond,
      });
      console.log(`羁绊激活：${bond.desc}`);
    }
  }

  getStackCount(skillId) {
    return this.acquired.filter((a) => a.id === skillId).length;
  }

  hasSkill(skillId) {
    return this.acquired.some((a) => a.id === skillId);
  }

  hasBond(skillId) {
    return this.activeBonds.some((b) => b.skillId === skillId);
  }

  getBond(skillId) {
    const bondData = this.activeBonds.find((b) => b.skillId === skillId);
    return bondData ? bondData.bond : null;
  }

  getBuffs() {
    const buffs = {
      damageMult: 1,
      intervalMult: 1,
      projectileCount: 1,
      projectileSpeedMult: 1,
      rangeMult: 1,
      playerSpeedMult: 1,
      magnetMult: 1,
      expMult: 1,
      scoreMult: 1,
      pierce: 0,
      bigProjectile: 0,
      ricochet: 0,
      shield: 0,
      freezeAura: 0,
      burn: 0,
      thorns: 0,
      // 羁绊特殊效果
      bondSlowDurationBonus: 0, // 减速时间加成
      bondChainJumpBonus: 0, // 连跳加成
      bondExplodeRadiusBonus: 0, // 爆炸范围加成
      bondOrbitBladesBonus: 0, // 刀刃数量加成
    };

    for (const s of this.acquired) {
      switch (s.id) {
        case 'atk_up':
          buffs.damageMult *= 1.2;
          break;
        case 'atkspd_up':
          buffs.intervalMult *= 0.8;
          break;
        case 'extra_proj':
          buffs.projectileCount += 1;
          break;
        case 'range_up':
          buffs.rangeMult *= 1.25;
          break;
        case 'spd_up':
          buffs.playerSpeedMult *= 1.15;
          break;
        case 'magnet':
          buffs.magnetMult *= 1.5;
          break;
        case 'exp_boost':
          buffs.expMult *= 1.25;
          break;
        case 'pierce':
          buffs.pierce += 1;
          break;
        case 'big_proj':
          buffs.bigProjectile += 1;
          break;
        case 'ricochet':
          buffs.ricochet += 1;
          break;
        case 'shield':
          buffs.shield += 1;
          break;
        case 'freeze':
          buffs.freezeAura += 1;
          break;
        case 'burn':
          buffs.burn += 1;
          break;
        case 'thorns':
          buffs.thorns += 1;
          break;
      }
    }

    // 应用羁绊效果
    for (const bondData of this.activeBonds) {
      const bond = bondData.bond;
      switch (bond.effect) {
        case 'range_up':
          buffs.rangeMult *= 1 + bond.bonus;
          break;
        case 'slow_duration':
          buffs.bondSlowDurationBonus += bond.bonus;
          break;
        case 'chain_jump':
          buffs.bondChainJumpBonus += bond.bonus;
          break;
        case 'explode_radius':
          buffs.bondExplodeRadiusBonus += bond.bonus;
          break;
        case 'orbit_blades':
          buffs.bondOrbitBladesBonus += bond.bonus;
          break;
        case 'damage_mult':
          buffs.damageMult *= 1 + bond.bonus;
          break;
      }
    }

    return buffs;
  }

  reset() {
    this.acquired = [];
    this.activeBonds = [];
  }
}
