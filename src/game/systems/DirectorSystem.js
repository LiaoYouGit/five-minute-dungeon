// Director AI — 动态难度调整系统
// 监控玩家状态，实时调整压力参数

export class DirectorSystem {
  constructor(world, runState) {
    this.world = world;
    this.runState = runState;

    // 状态追踪
    this.pressureLevel = 'normal'; // 'low' | 'normal' | 'high' | 'extreme'
    this.killCount = 0;
    this.killTimer = 0;
    this.lastDamageTime = 0;
    this.timeSinceLastDamage = 0;

    // 击杀率追踪（10秒窗口）
    this.killsInWindow = 0;
    this.killWindowTimer = 0;
    this.killRate = 0; // kills per second
  }

  // ── 时间阶段配置 ──────────────────────────────────────────

  getTimePhase(gameTime) {
    const minute = gameTime / 60;

    if (minute < 2) {
      return {
        name: 'tutorial',
        spawnMult: 0.8,
        eliteChance: 0,
        rangedWeight: 0,
        chargerMult: 1,
        tankMult: 1,
      };
    } else if (minute < 5) {
      return {
        name: 'early',
        spawnMult: 1.0,
        eliteChance: 0.02,
        rangedWeight: 0.5,
        chargerMult: 1.2,
        tankMult: 1,
      };
    } else if (minute < 8) {
      return {
        name: 'mid',
        spawnMult: 1.2,
        eliteChance: 0.05,
        rangedWeight: 1.0,
        chargerMult: 1.5,
        tankMult: 1.2,
      };
    } else if (minute < 12) {
      return {
        name: 'late',
        spawnMult: 1.4,
        eliteChance: 0.08,
        rangedWeight: 1.5,
        chargerMult: 1.8,
        tankMult: 1.5,
      };
    } else {
      return {
        name: 'hell',
        spawnMult: 1.6,
        eliteChance: 0.12,
        rangedWeight: 2.0,
        chargerMult: 2.5,
        tankMult: 2.0,
      };
    }
  }

  // ── 压力计算 ──────────────────────────────────────────

  update(dt, player, gameTime) {
    // 更新时间追踪
    this.timeSinceLastDamage += dt;
    this.killWindowTimer += dt;

    // 重置击杀窗口（每10秒）
    if (this.killWindowTimer >= 10) {
      this.killRate = this.killsInWindow / this.killWindowTimer;
      this.killsInWindow = 0;
      this.killWindowTimer = 0;
    }

    // 计算玩家状态
    let hpRatio = 1;
    if (player && player.active && player.components.Health) {
      const health = player.components.Health;
      hpRatio = health.hp / health.maxHp;
    }

    // 确定压力等级
    const minute = gameTime / 60;
    const highKillRate = this.killRate > 3; // 每秒击杀超过3个

    if (hpRatio < 0.3) {
      // 濒死 — 降低压力给喘息空间
      this.pressureLevel = 'low';
    } else if (hpRatio > 0.8 && this.timeSinceLastDamage > 10 && highKillRate && minute > 5) {
      // 极高压 — 玩家太强，大幅增加压力
      this.pressureLevel = 'extreme';
    } else if (hpRatio > 0.7 && this.timeSinceLastDamage > 5 && minute > 3) {
      // 高压 — 玩家状态良好，增加压力
      this.pressureLevel = 'high';
    } else {
      this.pressureLevel = 'normal';
    }

    return this.getPressureParams(gameTime);
  }

  getPressureParams(gameTime) {
    const timePhase = this.getTimePhase(gameTime);

    // 基础参数来自时间阶段
    let params = {
      spawnCountMult: timePhase.spawnMult,
      eliteChanceBonus: timePhase.eliteChance,
      chargerWeightMult: timePhase.chargerMult,
      rangedWeightMult: timePhase.rangedWeight,
      tankWeightMult: timePhase.tankMult,
      bossAttackSpeedMult: 1,
      bossCooldownMult: 1,
      bossSpeedMult: 1,
    };

    // 根据压力等级调整
    switch (this.pressureLevel) {
      case 'low':
        // 濒死喘息
        params.spawnCountMult *= 0.85;
        params.eliteChanceBonus -= 0.05;
        break;

      case 'high':
        // 增加压力
        params.spawnCountMult *= 1.2;
        params.eliteChanceBonus += 0.1;
        params.chargerWeightMult *= 1.3;
        break;

      case 'extreme':
        // 极高压
        params.spawnCountMult *= 1.4;
        params.eliteChanceBonus += 0.2;
        params.chargerWeightMult *= 2;
        params.rangedWeightMult *= 1.5;
        params.tankWeightMult *= 1.5;
        // Boss狂暴参数
        if (gameTime >= 720) { // 12分钟
          params.bossAttackSpeedMult = 1.3;
          params.bossCooldownMult = 0.6;
          params.bossSpeedMult = 1.3;
        }
        break;

      case 'normal':
        // 标准压力，不额外调整
        break;
    }

    return params;
  }

  // ── 事件记录 ──────────────────────────────────────────

  recordKill() {
    this.killsInWindow++;
    this.killCount++;
  }

  recordDamage() {
    this.timeSinceLastDamage = 0;
  }

  // ── 辅助方法 ──────────────────────────────────────────

  getMinute(gameTime) {
    return Math.floor(gameTime / 60);
  }

  getPressureLevel() {
    return this.pressureLevel;
  }

  getKillRate() {
    return this.killRate;
  }

  reset() {
    this.pressureLevel = 'normal';
    this.killCount = 0;
    this.killTimer = 0;
    this.lastDamageTime = 0;
    this.timeSinceLastDamage = 0;
    this.killsInWindow = 0;
    this.killWindowTimer = 0;
    this.killRate = 0;
  }
}