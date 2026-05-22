import { MathUtils } from '../../engine/MathUtils.js';
import { rollEnemyType, rollWaveComposition, ARCHETYPE } from '../data/enemies.js';

export class EnemySpawnSystem {
  constructor(world, lw, lh) {
    this.world = world;
    this.lw = lw;
    this.lh = lh;
    this.tileMap = null;

    // Wave state machine
    this.waveNum = 0;
    this.waveTimer = 15; // first wave at 15s
    this.wavePhase = 'trickle'; // 'trickle' | 'wave_spawning'
    this.waveSpawnQueue = []; // [{ enemyDef, count }]
    this.waveSpawnTimer = 0;
    this.waveWarning = 0; // >0 means showing incoming warning

    // Trickle spawn between waves
    this.trickleTimer = 0;
    this.trickleInterval = 2.5;

    // Ranged enemies shoot timer (handled in _updateRangedEnemies)
    this._minionCounter = 0;
  }

  setTileMap(tileMap) {
    this.tileMap = tileMap;
  }

  getWaveNum() { return this.waveNum; }
  getWaveWarning() { return this.waveWarning; }
  getWaveTimer() { return this.waveTimer; }

  update(dt, gameTime) {
    if (gameTime === undefined) gameTime = 0;

    // Wave warning countdown
    if (this.waveWarning > 0) this.waveWarning -= dt;

    // Trickle spawn: small enemies between waves
    if (this.wavePhase === 'trickle' || this.wavePhase === 'wave_spawning') {
      this.trickleTimer -= dt;
      if (this.trickleTimer <= 0) {
        this.trickleTimer = this.trickleInterval + Math.random() * 0.5;
        this._trickleSpawn(gameTime);
      }
    }

    // Wave timer
    this.waveTimer -= dt;
    if (this.waveTimer <= 5 && this.wavePhase === 'trickle' && this.waveWarning <= 0) {
      this.waveWarning = 5;
    }

    if (this.waveTimer <= 0 && this.wavePhase === 'trickle') {
      // Start a new wave
      this.waveNum++;
      this.wavePhase = 'wave_spawning';
      this.waveSpawnQueue = rollWaveComposition(this.waveNum);
      this.waveSpawnTimer = 0;
    }

    // Spawn wave enemies one by one
    if (this.wavePhase === 'wave_spawning') {
      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0 && this.waveSpawnQueue.length > 0) {
        const group = this.waveSpawnQueue[0];
        if (group.count > 0) {
          this._spawn(group.enemyDef, this.waveNum);
          group.count--;
        }
        if (group.count <= 0) {
          this.waveSpawnQueue.shift();
        }
        this.waveSpawnTimer = 0.3; // spawn interval within wave
      }

      if (this.waveSpawnQueue.length === 0) {
        this.wavePhase = 'trickle';
        this.waveTimer = 30; // next wave in 30s
      }
    }

    // Ranged enemies shoot
    this._updateRangedEnemies(dt);
  }

  /** Spawn a single trickle enemy using legacy roll */
  _trickleSpawn(gameTime) {
    const tmpl = rollEnemyType(gameTime);
    this._spawnAtRandomPos(tmpl, Math.max(1, this.waveNum));
  }

  /** Spawn at a random position around the player */
  _spawnAtRandomPos(tmpl, waveNum) {
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) return;
    const pt = players[0].components.Transform;

    const angle = Math.random() * Math.PI * 2;
    const dist = 180 + Math.random() * 40;
    let x = MathUtils.clamp(pt.x + Math.cos(angle) * dist, 20, this.lw - 20);
    let y = MathUtils.clamp(pt.y + Math.sin(angle) * dist, 20, this.lh - 20);

    x = this._resolveSpawnPos(x, y);
    if (x === null) return;
    const { px, py } = x;
    this._createEnemy(px, py, tmpl, waveNum);
  }

  /** Try to find a valid spawn position. Returns {px, py} or null */
  _resolveSpawnPos(x, y) {
    if (!this.tileMap) return { px: x, py: y };

    const ts = this.tileMap.tileSize;
    const cx = Math.floor(x / ts);
    const cy = Math.floor(y / ts);

    const isClear = (tx, ty) => {
      if (this.tileMap.isWall(tx, ty)) return false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (this.tileMap.isWall(tx + dx, ty + dy)) return false;
        }
      }
      return true;
    };

    if (isClear(cx, cy)) {
      return { px: cx * ts + ts / 2, py: cy * ts + ts / 2 };
    }

    // Search outward for a clear tile
    for (let r = 1; r <= 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (isClear(cx + dx, cy + dy)) {
            return { px: (cx + dx) * ts + ts / 2, py: (cy + dy) * ts + ts / 2 };
          }
        }
      }
    }

    // Fallback: any floor tile
    for (let r = 1; r <= 10; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (!this.tileMap.isWall(cx + dx, cy + dy)) {
            return { px: (cx + dx) * ts + ts / 2, py: (cy + dy) * ts + ts / 2 };
          }
        }
      }
    }

    return null;
  }

  /** Spawn a specific enemy definition at a random position */
  _spawn(enemyDef, waveNum) {
    this._spawnAtRandomPos(enemyDef, waveNum);
  }

  /** Spawn at specific position (used by SupplySystem) */
  spawnAt(x, y, gameTime) {
    const waveNum = Math.max(1, Math.floor(gameTime / 30) + 1);
    const tmpl = rollEnemyType(gameTime);
    const resolved = this._resolveSpawnPos(x, y);
    if (!resolved) return;
    this._createEnemy(resolved.px, resolved.py, tmpl, waveNum);
  }

  /** Spawn a minion (summoned by necromancer) — no drops, no score */
  spawnMinion(x, y, hp) {
    this._minionCounter++;
    const e = this.world.createEntity();
    const offset = 20;
    const mx = x + (Math.random() - 0.5) * offset * 2;
    const my = y + (Math.random() - 0.5) * offset * 2;
    this.world.addComponent(e, 'Transform', { x: mx, y: my });
    this.world.addComponent(e, 'Sprite', { w: 6, h: 6, color: '#8e44ad' });
    this.world.addComponent(e, 'Health', { hp, maxHp: hp });
    this.world.addComponent(e, 'EnemyTag', {});
    this.world.addComponent(e, 'MinionTag', {});
    this.world.addComponent(e, 'Damage', { value: 1 });
    this.world.addComponent(e, 'Collider', { radius: 3 });
    this.world.addComponent(e, 'Speed', { value: 50 });
    this.world.addComponent(e, 'EnemyAI', { type: 'chase', timer: 0 });
  }

  /** Create an enemy entity from a definition */
  _createEnemy(x, y, tmpl, waveNum) {
    const hpMult = 1 + waveNum * 0.15;
    const speedBonus = waveNum * 1.5;

    const e = this.world.createEntity();
    this.world.addComponent(e, 'Transform', { x, y });
    this.world.addComponent(e, 'Sprite', { w: tmpl.size, h: tmpl.size, color: tmpl.color });
    this.world.addComponent(e, 'Health', { hp: Math.ceil(tmpl.hp * hpMult), maxHp: Math.ceil(tmpl.hp * hpMult) });
    this.world.addComponent(e, 'EnemyTag', {});
    this.world.addComponent(e, 'Damage', { value: 1 });
    this.world.addComponent(e, 'Collider', { radius: tmpl.size / 2 });
    this.world.addComponent(e, 'ScoreValue', { value: tmpl.score });
    this.world.addComponent(e, 'Speed', { value: tmpl.speed + speedBonus });

    // Determine AI type from archetype (or override)
    const aiType = tmpl.ai || this._aiFromArchetype(tmpl.archetype);
    this.world.addComponent(e, 'EnemyAI', { type: aiType, timer: 0 });

    // Archetype-specific components
    switch (tmpl.archetype) {
      case ARCHETYPE.RANGED:
        this.world.addComponent(e, 'RangedAttack', {
          interval: tmpl.shootInterval || 2.5,
          cooldown: Math.random() * 2,
          projectileSpeed: tmpl.projectileSpeed || 120,
        });
        break;

      case ARCHETYPE.EXPLODER:
        this.world.addComponent(e, 'ExplodeOnDeath', {
          radius: tmpl.explodeRadius || 50,
          damage: tmpl.explodeDamage || 2,
        });
        break;

      case ARCHETYPE.SUMMONER:
        this.world.addComponent(e, 'SummonAbility', {
          interval: tmpl.summonInterval || 5,
          maxMinions: tmpl.maxMinions || 6,
          minionHp: tmpl.minionHp || 1,
        });
        break;

      case ARCHETYPE.CONTROLLER:
        if (tmpl.controlType) {
          this.world.addComponent(e, 'RangedAttack', {
            interval: tmpl.shootInterval || 3.0,
            cooldown: Math.random() * 2,
            projectileSpeed: tmpl.projectileSpeed || 90,
          });
          this.world.addComponent(e, 'ControlEffect', {
            type: tmpl.controlType, // 'slow' or 'root'
            duration: tmpl.controlDuration || 2.0,
          });
        }
        if (tmpl.spikeInterval) {
          this.world.addComponent(e, 'SpikeAbility', {
            interval: tmpl.spikeInterval,
          });
        }
        break;

      case ARCHETYPE.SUPPORT:
        this.world.addComponent(e, 'SupportAura', {
          radius: tmpl.auraRadius || 60,
          speedBuff: tmpl.speedBuff || 0.2,
          healInterval: tmpl.healInterval || 3,
          _healTimer: 0,
        });
        break;

      case ARCHETYPE.ELITE:
        if (tmpl.lifesteal) {
          this.world.addComponent(e, 'Lifesteal', { value: tmpl.lifesteal });
        }
        break;
    }
  }

  _aiFromArchetype(archetype) {
    switch (archetype) {
      case ARCHETYPE.MELEE: return 'chase';
      case ARCHETYPE.CHARGER: return 'charge';
      case ARCHETYPE.RANGED: return 'ranged';
      case ARCHETYPE.EXPLODER: return 'explode';
      case ARCHETYPE.SUMMONER: return 'summon';
      case ARCHETYPE.CONTROLLER: return 'controller';
      case ARCHETYPE.SUPPORT: return 'support';
      case ARCHETYPE.ELITE: return 'chase';
      default: return 'chase';
    }
  }

  _updateRangedEnemies(dt) {
    const enemies = this.world.query('Transform', 'EnemyTag', 'RangedAttack');
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) return;
    const pt = players[0].components.Transform;

    for (const e of enemies) {
      if (!e.active) continue;
      const ranged = e.components.RangedAttack;
      ranged.cooldown -= dt;
      if (ranged.cooldown <= 0) {
        ranged.cooldown = ranged.interval;
        const et = e.components.Transform;
        const angle = MathUtils.angleBetween(et, pt);

        // Check if this is a controller with control effect
        const control = e.components.ControlEffect;
        const projColor = control
          ? (control.type === 'slow' ? '#7fdbff' : '#1abc9c')
          : '#e67e22';

        const p = this.world.createEntity();
        this.world.addComponent(p, 'Transform', { x: et.x, y: et.y });
        this.world.addComponent(p, 'Velocity', { x: Math.cos(angle) * ranged.projectileSpeed, y: Math.sin(angle) * ranged.projectileSpeed });
        this.world.addComponent(p, 'Sprite', { w: 5, h: 5, color: projColor });
        this.world.addComponent(p, 'ProjectileTag', {});
        this.world.addComponent(p, 'Damage', { value: 1 });
        this.world.addComponent(p, 'Lifetime', { remaining: 3.0 });

        // Control projectiles apply debuff
        if (control) {
          if (control.type === 'slow') {
            this.world.addComponent(p, 'SlowOnHit', { duration: control.duration, amount: 0.5 });
          } else if (control.type === 'root') {
            this.world.addComponent(p, 'RootOnHit', { duration: control.duration });
          }
        }
      }
    }
  }
}
