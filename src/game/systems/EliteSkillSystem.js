import { MathUtils } from '../../engine/MathUtils.js';

export class EliteSkillSystem {
  constructor(world, LW, LH, onSpawnProjectile) {
    this.world = world;
    this.LW = LW;
    this.LH = LH;
    this.onSpawnProjectile = onSpawnProjectile;
    this.maxAttackRange = 500;
  }

  setMaxAttackRange(range) {
    this.maxAttackRange = range;
  }

  update(dt, gameTime) {
    const elites = this.world.query('Transform', 'EnemyTag', 'EliteTag', 'Health');

    for (const e of elites) {
      if (!e.active) continue;
      const et = e.components.Transform;
      const hp = e.components.Health;
      const elite = e.components.EliteTag;

      // Vampire: Bat Swarm (CD: 8s, cast: 0.5s)
      if (elite.type === 'vampire') {
        if (!elite.batSwarmCD) elite.batSwarmCD = 0;

        // Casting phase
        if (elite.batSwarmCasting) {
          elite.batSwarmCastTimer -= dt;
          if (elite.batSwarmCastTimer <= 0) {
            elite.batSwarmCasting = false;
            this._vampireBatSwarm(e, et);
            elite.batSwarmCD = 16.0;
          }
        } else {
          elite.batSwarmCD -= dt;
          if (elite.batSwarmCD <= 0) {
            const players = this.world.query('Transform', 'PlayerTag');
            if (players.length > 0) {
              const pt = players[0].components.Transform;
              if (MathUtils.distance(et, pt) <= this.maxAttackRange) {
                elite.batSwarmCasting = true;
                elite.batSwarmCastTimer = 1.0;
              } else {
                elite.batSwarmCD = 1.0;
              }
            }
          }
        }
      }

      // Ghost King: Phase Shift (CD: 12s) + Ghost Summon (CD: 10s)
      if (elite.type === 'ghost_king') {
        if (!elite.phaseShiftCD) elite.phaseShiftCD = 0;
        if (!elite.ghostSummonCD) elite.ghostSummonCD = 0;

        elite.phaseShiftCD -= dt;
        elite.ghostSummonCD -= dt;

        // Phase shift - become invulnerable for 2s when HP < 50%
        if (elite.phaseShiftCD <= 0 && hp.hp < hp.maxHp * 0.5) {
          this._ghostKingPhaseShift(e);
          elite.phaseShiftCD = 12.0;
        }

        // Ghost summon - spawn 2 ghost minions
        if (elite.ghostSummonCD <= 0) {
          this._ghostKingSummon(e, et);
          elite.ghostSummonCD = 10.0;
        }
      }
    }

    // Update phase shift timer (remove when expired)
    const phased = this.world.query('PhaseShift');
    for (const e of phased) {
      if (!e.active || !e.components.PhaseShift) continue;
      const phase = e.components.PhaseShift;
      phase.timer -= dt;
      if (phase.timer <= 0) {
        delete e.components.PhaseShift;
      }
    }
  }

  // ── Vampire Skills ──────────────────────────────────────────

  _vampireBatSwarm(e, et) {
    const count = 3 + Math.floor(Math.random() * 2);
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) return;
    const pt = players[0].components.Transform;

    for (let i = 0; i < count; i++) {
      const angle = MathUtils.angleBetween(et, pt) + (Math.random() - 0.5) * 0.8;
      const bat = this.world.createEntity();
      const offset = 15;
      this.world.addComponent(bat, 'Transform', {
        x: MathUtils.clamp(et.x + Math.cos(angle) * offset, 10, this.LW - 10),
        y: MathUtils.clamp(et.y + Math.sin(angle) * offset, 10, this.LH - 10),
      });
      this.world.addComponent(bat, 'Velocity', {
        x: Math.cos(angle) * 80,
        y: Math.sin(angle) * 80,
      });
      this.world.addComponent(bat, 'Sprite', { w: 6, h: 6, color: '#8e44ad', imageKey: 'bat' });
      this.world.addComponent(bat, 'ProjectileTag', {});
      this.world.addComponent(bat, 'Damage', { value: 5 }); // Adjusted for player 100HP baseline (5% damage)
      this.world.addComponent(bat, 'Lifetime', { remaining: 2.5 });
      this.world.addComponent(bat, 'BatSwarmTag', {});
    }
  }

  // ── Ghost King Skills ────────────────────────────────────────

  _ghostKingPhaseShift(e) {
    // Become invulnerable for 2 seconds (PhaseShift component blocks damage)
    this.world.addComponent(e, 'PhaseShift', { timer: 2.0 });
    // Visual: add a pulsing alpha effect
    const sprite = e.components.Sprite;
    if (sprite) {
      sprite._phaseAlpha = 0.3;
    }
  }

  _ghostKingSummon(e, et) {
    // Spawn 2 ghost minions that persist for 8s
    const count = 2;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const ghost = this.world.createEntity();
      const offset = 20;
      this.world.addComponent(ghost, 'Transform', {
        x: MathUtils.clamp(et.x + Math.cos(angle) * offset, 10, this.LW - 10),
        y: MathUtils.clamp(et.y + Math.sin(angle) * offset, 10, this.LH - 10),
      });
      this.world.addComponent(ghost, 'Sprite', { w: 8, h: 8, color: '#bdc3c7', imageKey: 'ghost_king' });
      this.world.addComponent(ghost, 'Health', { hp: 2, maxHp: 2 });
      this.world.addComponent(ghost, 'EnemyTag', {});
      this.world.addComponent(ghost, 'MinionTag', {});
      this.world.addComponent(ghost, 'Damage', { value: 1 });
      this.world.addComponent(ghost, 'Collider', { radius: 4 });
      this.world.addComponent(ghost, 'Speed', { value: 40 });
      this.world.addComponent(ghost, 'EnemyAI', { type: 'chase', timer: 0 });
      this.world.addComponent(ghost, 'Lifetime', { remaining: 8.0 });
    }
  }
}