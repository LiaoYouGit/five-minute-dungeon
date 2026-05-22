import { SKILL_POOL } from '../data/skills.js';

export class SkillManager {
  constructor() {
    this.acquired = [];
  }

  rollChoices(count = 3) {
    const available = SKILL_POOL.filter((s) => {
      const stackCount = this.acquired.filter((a) => a.id === s.id).length;
      return stackCount < s.maxStack;
    });
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  acquire(skill) {
    this.acquired.push({ ...skill });
  }

  getStackCount(skillId) {
    return this.acquired.filter((a) => a.id === skillId).length;
  }

  hasSkill(skillId) {
    return this.acquired.some((a) => a.id === skillId);
  }

  getBuffs() {
    const buffs = {
      damageMult: 1, intervalMult: 1, projectileCount: 1,
      projectileSpeedMult: 1, rangeMult: 1, playerSpeedMult: 1,
      magnetMult: 1, expMult: 1, scoreMult: 1,
      pierce: 0, bigProjectile: 0, ricochet: 0,
      shield: 0, freezeAura: 0, burn: 0,
      thorns: 0,
    };
    for (const s of this.acquired) {
      switch (s.id) {
        case 'atk_up': buffs.damageMult *= 1.2; break;
        case 'atkspd_up': buffs.intervalMult *= 0.8; break;
        case 'extra_proj': buffs.projectileCount += 1; break;
        case 'range_up': buffs.rangeMult *= 1.25; break;
        case 'spd_up': buffs.playerSpeedMult *= 1.15; break;
        case 'magnet': buffs.magnetMult *= 1.5; break;
        case 'exp_boost': buffs.expMult *= 1.25; break;
        case 'pierce': buffs.pierce += 1; break;
        case 'big_proj': buffs.bigProjectile += 1; break;
        case 'ricochet': buffs.ricochet += 1; break;
        case 'shield': buffs.shield += 1; break;
        case 'freeze': buffs.freezeAura += 1; break;
        case 'burn': buffs.burn += 1; break;
        case 'thorns': buffs.thorns += 1; break;
      }
    }
    return buffs;
  }

  reset() {
    this.acquired = [];
  }
}
