import { MathUtils } from '../../engine/MathUtils.js';
import { rollEnemyType, rollWaveComposition, ARCHETYPE } from '../data/enemies.js';

export class EnemySpawnSystem {
  constructor(world, lw, lh, runState) {
    this.world = world;
    this.lw = lw;
    this.lh = lh;
    this.tileMap = null;
    this.runState = runState;

    // Fixed spawn points (will be populated when tileMap is set)
    this.spawnPoints = [];

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
    // Generate fixed spawn points from tileMap
    this._generateSpawnPoints();
  }

  /** Generate fixed spawn points in map corners and strategic locations */
  _generateSpawnPoints() {
    if (!this.tileMap) return;

    const ts = this.tileMap.tileSize;
    const cols = this.tileMap.cols;
    const rows = this.tileMap.rows;

    // Spawn points: corners + center-ish positions (total 8 points)
    const spawnPositions = [
      // Corners
      { x: ts * 3, y: ts * 3 }, // top-left
      { x: cols * ts - ts * 3, y: ts * 3 }, // top-right
      { x: ts * 3, y: rows * ts - ts * 3 }, // bottom-left
      { x: cols * ts - ts * 3, y: rows * ts - ts * 3 }, // bottom-right
      // Midpoints along edges
      { x: cols * ts / 2, y: ts * 3 }, // top-center
      { x: cols * ts / 2, y: rows * ts - ts * 3 }, // bottom-center
      { x: ts * 3, y: rows * ts / 2 }, // left-center
      { x: cols * ts - ts * 3, y: rows * ts / 2 }, // right-center
    ];

    // Validate each position is on a floor tile
    this.spawnPoints = [];
    for (const pos of spawnPositions) {
      const resolved = this._resolveSpawnPos(pos.x, pos.y);
      if (resolved) {
        this.spawnPoints.push(resolved);
      }
    }

    // Ensure we have at least some spawn points
    if (this.spawnPoints.length < 4) {
      // Fallback: use any floor tiles
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (this.spawnPoints.length >= 8) break;
          if (!this.tileMap.isWall(c, r)) {
            const px = c * ts + ts / 2;
            const py = r * ts + ts / 2;
            if (!this.spawnPoints.some(sp => sp.px === px && sp.py === py)) {
              this.spawnPoints.push({ px, py });
            }
          }
        }
        if (this.spawnPoints.length >= 8) break;
      }
    }
  }

  setRunState(runState) {
    this.runState = runState;
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
      // Time-based scaling: increase wave size after 1 minute
      const timeScale = gameTime > 60 ? Math.min(1 + (gameTime - 60) / 120, 2.0) : 1; // Max 2x after 3 minutes
      this.waveSpawnQueue = rollWaveComposition(this.waveNum, timeScale);
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
    let tmpl = rollEnemyType(gameTime);
    // No elites before 1 minute
    if (gameTime < 60 && tmpl.archetype === ARCHETYPE.ELITE) {
      // Roll a non-elite fallback
      const fallbackPool = rollWaveComposition(this.waveNum).flatMap(g => {
        const arr = [];
        for (let i = 0; i < g.count; i++) arr.push(g.enemyDef);
        return arr;
      });
      tmpl = fallbackPool[0] || rollEnemyType(30); // fallback to early game enemy
    }
    // Apply stage count multiplier
    const stageCountMult = this.runState ? this.runState.getStageCountMult() : 1;
    const count = Math.ceil(1 * stageCountMult);
    for (let i = 0; i < count; i++) {
      this._spawnAtRandomPos(tmpl, Math.max(1, this.waveNum));
    }
  }

  /** Spawn at a fixed spawn point */
  _spawnAtRandomPos(tmpl, waveNum) {
    if (this.spawnPoints.length === 0) return;

    // Choose a random spawn point
    const spawnPoint = this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
    this._createEnemy(spawnPoint.px, spawnPoint.py, tmpl, waveNum);
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
    this.world.addComponent(e, 'Sprite', { w: 6, h: 6, color: '#8e44ad', imageKey: 'skeleton_minion' });
    this.world.addComponent(e, 'Health', { hp, maxHp: hp });
    this.world.addComponent(e, 'EnemyTag', {});
    this.world.addComponent(e, 'MinionTag', {});
    this.world.addComponent(e, 'Damage', { value: 3 }); // Adjusted for player 100HP baseline (3% damage)
    this.world.addComponent(e, 'Collider', { radius: 3 });
    this.world.addComponent(e, 'Speed', { value: 50 });
    this.world.addComponent(e, 'EnemyAI', { type: 'chase', timer: 0 });
  }

  /** Create an enemy entity from a definition */
  _createEnemy(x, y, tmpl, waveNum) {
    // Wave-based scaling (old)
    const waveHpMult = 1 + waveNum * 0.15;
    const waveSpeedBonus = waveNum * 1.5;

    // Stage-based scaling (new, stronger effect)
    const stageHpMult = this.runState ? this.runState.getStageHpMult() : 1;

    // Player HP scaling - enemies grow proportionally to player max HP
    const players = this.world.query('Transform', 'PlayerTag', 'Health');
    const playerHpMult = players.length > 0 ? players[0].components.Health.maxHp / 100 : 1;

    const finalHpMult = waveHpMult * stageHpMult * playerHpMult;

    const e = this.world.createEntity();
    this.world.addComponent(e, 'Transform', { x, y });
    this.world.addComponent(e, 'Sprite', { w: tmpl.size, h: tmpl.size, color: tmpl.color, imageKey: tmpl.id });
    this.world.addComponent(e, 'Health', { hp: Math.ceil(tmpl.hp * finalHpMult), maxHp: Math.ceil(tmpl.hp * finalHpMult) });
    this.world.addComponent(e, 'EnemyTag', {});
    this.world.addComponent(e, 'Damage', { value: 5 }); // Adjusted for player 100HP baseline (5% damage)
    this.world.addComponent(e, 'Collider', { radius: tmpl.size / 2 });
    this.world.addComponent(e, 'ScoreValue', { value: tmpl.score });
    this.world.addComponent(e, 'Speed', { value: tmpl.speed + waveSpeedBonus });

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
          damage: 15, // Adjusted for player 100HP baseline (15% damage)
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
        this.world.addComponent(e, 'EliteTag', { type: tmpl.id });
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

        const projImageKey = control
          ? (control.type === 'slow' ? 'enemy_projectile_ice' : 'enemy_projectile')
          : 'frost_mage_projectile';

        const p = this.world.createEntity();
        this.world.addComponent(p, 'Transform', { x: et.x, y: et.y });
        this.world.addComponent(p, 'Velocity', { x: Math.cos(angle) * ranged.projectileSpeed, y: Math.sin(angle) * ranged.projectileSpeed });
        this.world.addComponent(p, 'Sprite', { w: 5, h: 5, color: projColor, imageKey: projImageKey });
        this.world.addComponent(p, 'ProjectileTag', {});
        this.world.addComponent(p, 'Damage', { value: 5 }); // Adjusted for player 100HP baseline (5% damage)
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
