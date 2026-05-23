import { MathUtils } from '../../engine/MathUtils.js';

export class AISystem {
  constructor(world, getBuffs) {
    this.world = world;
    this.getBuffs = getBuffs || (() => ({}));
    this.flowField = null;
    this.onSpawnMinion = null;
    this.onSpawnHazard = null;
    this.onExplode = null;
  }

  setFlowField(flowField) {
    this.flowField = flowField;
  }

  update(dt) {
    const enemies = this.world.query('Transform', 'EnemyTag', 'Speed', 'EnemyAI');
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) return;
    const pt = players[0].components.Transform;
    const buffs = this.getBuffs();
    const freezeAura = buffs.freezeAura || 0;
    const freezeRange = 100;
    const freezeMult = freezeAura > 0 ? (1 - 0.15 * freezeAura) : 1;

    for (const e of enemies) {
      if (!e.active) continue;
      const et = e.components.Transform;
      const ai = e.components.EnemyAI;
      let speed = e.components.Speed.value;

      if (freezeAura > 0) {
        const distToPlayer = MathUtils.distance(et, pt);
        if (distToPlayer < freezeRange) {
          speed *= freezeMult;
        }
      }

      // Slow debuff
      const slow = e.components.Slow;
      if (slow) {
        slow.duration -= dt;
        if (slow.duration <= 0) {
          delete e.components.Slow;
        } else {
          speed *= (1 - slow.amount);
        }
      }

      // Root debuff — complete immobilization
      const root = e.components.Root;
      if (root) {
        root.duration -= dt;
        if (root.duration <= 0) {
          delete e.components.Root;
        } else {
          speed = 0;
        }
      }

      // Support aura speed buff
      const auraBuff = e.components.AuraSpeedBuff;
      if (auraBuff && speed > 0) {
        speed *= (1 + auraBuff.amount);
      }

      // Stop movement during ranged casting
      const rangedAttack = e.components.RangedAttack;
      if (rangedAttack && rangedAttack.casting) {
        speed = 0;
      }

      // Stop movement during elite casting (vampire bat swarm)
      const elite = e.components.EliteTag;
      if (elite && elite.batSwarmCasting) {
        speed = 0;
      }

      ai.timer += dt;

      switch (ai.type) {
        case 'chase':
          this._moveToward(et, pt, speed, dt);
          break;
        case 'ranged': {
          const dist = MathUtils.distance(et, pt);
          if (dist > 140) {
            this._moveToward(et, pt, speed, dt);
          } else if (dist < 80) {
            this._moveAway(et, pt, speed * 0.6, dt);
          }
          break;
        }
        case 'zigzag': {
          const lateral = Math.sin(ai.timer * 4) * 0.6;
          this._moveToward(et, pt, speed, dt, lateral);
          break;
        }
        case 'dash': {
          ai.dashTimer -= dt;
          if (ai.dashTimer <= 0) {
            ai.dashTimer = 2.0 + Math.random();
            ai.dashing = true;
            ai._dashDir = MathUtils.normalize({ x: pt.x - et.x, y: pt.y - et.y });
            ai._dashDuration = 0.3;
          }
          if (ai.dashing) {
            ai._dashDuration -= dt;
            et.x += ai._dashDir.x * speed * 3 * dt;
            et.y += ai._dashDir.y * speed * 3 * dt;
            if (ai._dashDuration <= 0) ai.dashing = false;
          } else {
            this._moveToward(et, pt, speed * 0.3, dt);
          }
          break;
        }
        case 'charge':
          this._handleCharge(e, et, pt, speed, dt, ai);
          break;
        case 'explode':
          this._handleExplode(e, et, pt, speed, dt, ai);
          break;
        case 'summon':
          this._handleSummon(e, et, pt, speed, dt, ai);
          break;
        case 'support':
          this._handleSupport(e, et, pt, speed, dt, ai);
          break;
        case 'controller': {
          const dist = MathUtils.distance(et, pt);
          if (dist > 150) {
            this._moveToward(et, pt, speed, dt);
          } else if (dist < 80) {
            this._moveAway(et, pt, speed * 0.6, dt);
          }
          break;
        }
        case 'spike':
          this._handleSpike(e, et, pt, speed, dt, ai);
          break;
        default:
          this._moveToward(et, pt, speed, dt);
      }
    }

    // Support aura processing
    this._processAuras(dt);
  }

  // ── Charge AI (approach → telegraph → charging → recover) ──

  _handleCharge(e, et, pt, speed, dt, ai) {
    if (!ai.phase) ai.phase = 'approach';
    if (!ai.phaseTimer) ai.phaseTimer = 0;

    const dist = MathUtils.distance(et, pt);

    switch (ai.phase) {
      case 'approach':
        if (dist > 150) {
          this._moveToward(et, pt, speed * 0.5, dt);
        } else if (dist < 60) {
          this._moveAway(et, pt, speed * 0.3, dt);
        } else {
          this._moveToward(et, pt, speed * 0.3, dt);
        }
        if (dist <= 160 && dist >= 60) {
          ai.phaseTimer += dt;
          if (ai.phaseTimer > 2.0) {
            ai.phase = 'telegraph';
            ai.phaseTimer = 0;
            ai._chargeDir = MathUtils.normalize({ x: pt.x - et.x, y: pt.y - et.y });
          }
        } else {
          ai.phaseTimer = 0;
        }
        break;

      case 'telegraph':
        ai.phaseTimer += dt;
        // Flash visual: toggle visible flag
        ai._flash = Math.floor(ai.phaseTimer * 10) % 2 === 0;
        if (ai.phaseTimer >= 0.8) {
          ai._chargeDir = MathUtils.normalize({ x: pt.x - et.x, y: pt.y - et.y });
          ai.phase = 'charging';
          ai.phaseTimer = 0;
        }
        break;

      case 'charging':
        ai.phaseTimer += dt;
        et.x += ai._chargeDir.x * speed * 3.5 * dt;
        et.y += ai._chargeDir.y * speed * 3.5 * dt;
        if (ai.phaseTimer >= 0.4) {
          ai.phase = 'recover';
          ai.phaseTimer = 0;
        }
        break;

      case 'recover':
        ai.phaseTimer += dt;
        // Stand still (stunned)
        if (ai.phaseTimer >= 1.0) {
          ai.phase = 'approach';
          ai.phaseTimer = 0;
        }
        break;
    }
  }

  // ── Explode AI (approach → fuse → detonate) ──

  _handleExplode(e, et, pt, speed, dt, ai) {
    if (!ai.phase) ai.phase = 'approach';
    if (!ai.fuseTimer) ai.fuseTimer = 0;

    const dist = MathUtils.distance(et, pt);

    switch (ai.phase) {
      case 'approach':
        this._moveToward(et, pt, speed * 0.8, dt);
        if (dist < 35) {
          ai.phase = 'fuse';
          ai.fuseTimer = 0;
        }
        break;

      case 'fuse':
        ai.fuseTimer += dt;
        // Slow drift toward player during fuse
        this._moveToward(et, pt, speed * 0.15, dt);
        if (ai.fuseTimer >= 2.0) {
          ai.phase = 'detonate';
        }
        break;

      case 'detonate':
        this.onExplode?.(e);
        return; // entity removed by onExplode callback
    }
  }

  // ── Summon AI (kite + spawn minions) ──

  _handleSummon(e, et, pt, speed, dt, ai) {
    if (!ai.summonTimer) ai.summonTimer = 0;

    // Kite: stay away from player
    const dist = MathUtils.distance(et, pt);
    if (dist < 120) {
      this._moveAway(et, pt, speed * 0.5, dt);
    } else if (dist > 200) {
      this._moveToward(et, pt, speed * 0.3, dt);
    }

    // Summon minions on timer
    const summon = e.components.SummonAbility;
    if (!summon) return;
    ai.summonTimer += dt;
    if (ai.summonTimer >= summon.interval) {
      ai.summonTimer = 0;
      // Count existing minions
      const minions = this.world.query('Transform', 'MinionTag');
      if (minions.length < summon.maxMinions) {
        this.onSpawnMinion?.(et.x, et.y, summon.minionHp);
      }
    }
  }

  // ── Support AI (follow ally + aura buff) ──

  _handleSupport(e, et, pt, speed, dt, ai) {
    // Find nearest non-support enemy to follow
    const enemies = this.world.query('Transform', 'EnemyTag', 'Speed', 'EnemyAI');
    let nearestAlly = null;
    let nearestDist = Infinity;
    for (const ally of enemies) {
      if (ally.id === e.id || !ally.active) continue;
      const allyAI = ally.components.EnemyAI;
      if (allyAI.type === 'support') continue;
      const d = MathUtils.distance(et, ally.components.Transform);
      if (d < nearestDist) {
        nearestDist = d;
        nearestAlly = ally;
      }
    }

    if (nearestAlly) {
      const allyT = nearestAlly.components.Transform;
      const dist = MathUtils.distance(et, allyT);
      if (dist > 80) {
        this._moveToward(et, allyT, speed * 0.5, dt);
      } else if (dist < 40) {
        this._moveAway(et, allyT, speed * 0.3, dt);
      }
    } else {
      // No allies, move toward player at reduced speed
      this._moveToward(et, pt, speed * 0.3, dt);
    }
  }

  /** Process support auras: buff speed + heal allies */
  _processAuras(dt) {
    const supporters = this.world.query('Transform', 'SupportAura', 'EnemyTag');
    const enemies = this.world.query('Transform', 'EnemyTag', 'Speed');

    for (const s of supporters) {
      if (!s.active) continue;
      const st = s.components.Transform;
      const aura = s.components.SupportAura;

      // Heal timer
      if (!aura._healTimer) aura._healTimer = 0;
      aura._healTimer += dt;

      for (const e of enemies) {
        if (e.id === s.id || !e.active) continue;
        const d = MathUtils.distance(st, e.components.Transform);
        if (d < aura.radius) {
          // Speed buff
          e.components.AuraSpeedBuff = { amount: aura.speedBuff };

          // Heal
          if (aura._healTimer >= aura.healInterval) {
            const hp = e.components.Health;
            if (hp && hp.hp < hp.maxHp) {
              hp.hp = Math.min(hp.hp + 1, hp.maxHp);
            }
          }
        } else {
          // Remove buff if out of range
          if (e.components.AuraSpeedBuff) {
            delete e.components.AuraSpeedBuff;
          }
        }
      }

      if (aura._healTimer >= aura.healInterval) {
        aura._healTimer = 0;
      }
    }
  }

  // ── Spike AI (stationary, spawn ground hazards at player position) ──

  _handleSpike(e, et, pt, speed, dt, ai) {
    if (!ai.spikeTimer) ai.spikeTimer = 0;
    ai.spikeTimer += dt;

    const interval = e.components.SpikeAbility?.interval || 4.0;
    if (ai.spikeTimer >= interval) {
      ai.spikeTimer = 0;
      this.onSpawnHazard?.(pt.x, pt.y);
    }
  }

  // ── Movement helpers ──

  _moveToward(et, pt, speed, dt, lateralOffset = 0) {
    let dx, dy;
    if (this.flowField) {
      const flow = this.flowField.getDirection(et.x, et.y);
      if (flow) {
        dx = flow.x;
        dy = flow.y;
        if (lateralOffset !== 0) {
          const angle = Math.atan2(dy, dx) + lateralOffset;
          dx = Math.cos(angle);
          dy = Math.sin(angle);
        }
      } else {
        const dir = MathUtils.normalize({ x: pt.x - et.x, y: pt.y - et.y });
        dx = dir.x;
        dy = dir.y;
      }
    } else {
      const dir = MathUtils.normalize({ x: pt.x - et.x, y: pt.y - et.y });
      dx = dir.x;
      dy = dir.y;
    }
    et.x += dx * speed * dt;
    et.y += dy * speed * dt;
  }

  _moveAway(et, pt, speed, dt) {
    if (this.flowField) {
      const flow = this.flowField.getDirection(et.x, et.y);
      if (flow) {
        et.x -= flow.x * speed * dt;
        et.y -= flow.y * speed * dt;
        return;
      }
    }
    const dir = MathUtils.normalize({ x: et.x - pt.x, y: et.y - pt.y });
    et.x += dir.x * speed * dt;
    et.y += dir.y * speed * dt;
  }
}
