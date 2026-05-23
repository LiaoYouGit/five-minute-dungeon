import { MathUtils } from '../../engine/MathUtils.js';
import { rollEnemyType, rollWaveComposition, ARCHETYPE } from '../data/enemies.js';

export class EnemySpawnSystem {
  constructor(world, lw, lh, runState) {
    this.world = world;
    this.lw = lw;
    this.lh = lh;
    this.tileMap = null;
    this.runState = runState;
    this.maxAttackRange = 500;
    this.director = null; // Director AI system

    // Wave state
    this.waveNum = 0;
    this.waveTimer = 3;
    this.wavePhase = 'trickle';
    this.waveSpawnQueue = [];
    this.waveSpawnTimer = 0;
    this.waveWarning = 0;

    // Trickle
    this.trickleTimer = 0;
    this.trickleInterval = 0.8;

    // Fixed spawn points
    this.spawnPoints = [];

    this._minionCounter = 0;
    this.spawnCount = 0;
    this._gameTime = 0;
    this._playerLevel = 1;
  }

  setDirector(director) { this.director = director; }

  setTileMap(tileMap) {
    this.tileMap = tileMap;
  }

  setSpawnPoints(points) {
    this.spawnPoints = points;
  }

  setRunState(runState) { this.runState = runState; }
  setMaxAttackRange(range) { this.maxAttackRange = range; }
  getWaveNum() { return this.waveNum; }
  getWaveWarning() { return this.waveWarning; }
  getWaveTimer() { return this.waveTimer; }

  /** Pick a random spawn point from fixed dungeon spawn points */
  _pickSpawnPoint() {
    if (this.spawnPoints.length === 0) return null;
    const idx = Math.floor(Math.random() * this.spawnPoints.length);
    return this.spawnPoints[idx];
  }

  /** Pick a spawn point far from the player */
  _pickSpawnPointFarFromPlayer(px, py) {
    if (this.spawnPoints.length === 0) return null;

    // Sort by distance to player, pick from the farthest half
    const sorted = this.spawnPoints
      .map(p => ({ ...p, dist: MathUtils.distance({ x: p.x, y: p.y }, { x: px, y: py }) }))
      .sort((a, b) => b.dist - a.dist);

    const pool = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
    return pool[Math.floor(Math.random() * pool.length)];
  }

  update(dt, gameTime, playerTransform) {
    if (gameTime === undefined) gameTime = 0;
    this._gameTime = gameTime;

    const px = playerTransform ? playerTransform.x : 0;
    const py = playerTransform ? playerTransform.y : 0;

    if (this.waveWarning > 0) this.waveWarning -= dt;

    // Trickle: spawn at fixed points
    this.trickleTimer -= dt;
    if (this.trickleTimer <= 0) {
      const timeScale = Math.max(0.5, 1.0 - gameTime / 600);
      this.trickleTimer = this.trickleInterval * timeScale + Math.random() * 0.2;
      this._trickleSpawn(gameTime, px, py);
    }

    // Wave timer
    this.waveTimer -= dt;
    if (this.waveTimer <= 3 && this.wavePhase === 'trickle' && this.waveWarning <= 0) {
      this.waveWarning = 3;
    }

    if (this.waveTimer <= 0 && this.wavePhase === 'trickle') {
      this.waveNum++;
      this.wavePhase = 'wave_spawning';
      const timeScale = gameTime > 30 ? Math.min(1 + (gameTime - 30) / 180, 1.5) : 1;
      this.waveSpawnQueue = rollWaveComposition(this.waveNum, timeScale);
      this.waveSpawnTimer = 0;
    }

    // Burst spawn wave enemies
    if (this.wavePhase === 'wave_spawning') {
      this.waveSpawnTimer -= dt;
      if (this.waveSpawnTimer <= 0 && this.waveSpawnQueue.length > 0) {
        const group = this.waveSpawnQueue[0];

        // Director压力加成
        let spawnMult = 1;
        if (this.director) {
          const params = this.director.getPressureParams(this._gameTime);
          spawnMult = params.spawnCountMult;
        }

        const baseBurst = 2 + Math.floor(this.waveNum / 3);
        const burstSize = Math.ceil(Math.min(group.count, baseBurst) * spawnMult);

        for (let i = 0; i < burstSize && group.count > 0; i++) {
          this._spawnAtFixedPoint(group.enemyDef, this.waveNum, px, py);
          group.count--;
        }
        if (group.count <= 0) this.waveSpawnQueue.shift();
        this.waveSpawnTimer = 0.08;
      }
      if (this.waveSpawnQueue.length === 0) {
        this.wavePhase = 'trickle';
        const baseInterval = Math.max(8, 14 - this.waveNum * 0.5);
        this.waveTimer = baseInterval + Math.random() * 3;
      }
    }

    this._updateRangedEnemies(dt);
  }

  /** Spawn at a fixed spawn point, preferring points far from player */
  _spawnAtFixedPoint(enemyDef, waveNum, px, py) {
    let point = this._pickSpawnPointFarFromPlayer(px, py);
    if (!point) point = this._pickSpawnPoint();

    if (point) {
      // Add small random offset so enemies don't stack on same spot
      const offset = 8;
      const sx = point.x + (Math.random() - 0.5) * offset;
      const sy = point.y + (Math.random() - 0.5) * offset;
      this._createEnemy(sx, sy, enemyDef, waveNum, this._gameTime);
      this.spawnCount++;
    }
  }

  /** Trickle spawn at fixed points */
  _trickleSpawn(gameTime, px, py) {
    // 基础数量 + 时间加成
    const baseCount = 2;
    const timeBonus = Math.floor(gameTime / 90);

    // Director压力加成
    let spawnMult = 1;
    if (this.director) {
      const params = this.director.getPressureParams(gameTime);
      spawnMult = params.spawnCountMult;
    }

    const count = Math.ceil((baseCount + timeBonus) * spawnMult);

    for (let i = 0; i < count; i++) {
      let tmpl = rollEnemyType(gameTime);
      // 早期(0-2分钟)不生成精英
      if (gameTime < 120 && tmpl.archetype === ARCHETYPE.ELITE) {
        tmpl = rollEnemyType(30);
      }
      // Director精英概率加成
      if (this.director && gameTime >= 120 && tmpl.archetype !== ARCHETYPE.ELITE) {
        const params = this.director.getPressureParams(gameTime);
        if (Math.random() < params.eliteChanceBonus) {
          // 强制生成精英
          const elitePool = [
            { id: 'vampire', hp: 5, speed: 45, size: 12, score: 60, archetype: ARCHETYPE.ELITE },
            { id: 'ghost_king', hp: 8, speed: 35, size: 16, score: 80, archetype: ARCHETYPE.ELITE },
          ];
          tmpl = elitePool[Math.floor(Math.random() * elitePool.length)];
        }
      }
      this._spawnAtFixedPoint(tmpl, Math.max(1, this.waveNum), px, py);
    }
  }

  spawnAt(x, y, gameTime) {
    const waveNum = Math.max(1, Math.floor(gameTime / 15) + 1);
    const tmpl = rollEnemyType(gameTime);
    // Find nearest floor tile to the given position
    if (this.tileMap) {
      const ts = this.tileMap.tileSize;
      const cx = Math.floor(x / ts);
      const cy = Math.floor(y / ts);
      for (let r = 0; r <= 10; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const tx = cx + dx, ty = cy + dy;
            if (tx >= 0 && ty >= 0 && tx < this.tileMap.cols && ty < this.tileMap.rows) {
              if (!this.tileMap.isWall(tx, ty)) {
                this._createEnemy(tx * ts + ts / 2, ty * ts + ts / 2, tmpl, waveNum, gameTime);
                return;
              }
            }
          }
        }
      }
    }
    this._createEnemy(x, y, tmpl, waveNum, gameTime);
  }

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
    this.world.addComponent(e, 'Damage', { value: 3 });
    this.world.addComponent(e, 'Collider', { radius: 3 });
    this.world.addComponent(e, 'Speed', { value: 50 });
    this.world.addComponent(e, 'EnemyAI', { type: 'chase', timer: 0 });
  }

  // ── 新成长公式 ──────────────────────────────────────────

  /**
   * 计算怪物成长属性
   * 普通怪: HP = base + level×12 + minute×8, ATK = base + level×3 + minute×2, SPD = base + minute×0.8
   * 精英怪: HP×4, ATK×2, SPD×1.15
   */
  _calcEnemyStats(tmpl, gameTime) {
    const minute = gameTime / 60;
    const playerLevel = this._playerLevel || 1;
    const isElite = tmpl.archetype === ARCHETYPE.ELITE;

    // 基础属性
    const baseHp = tmpl.hp;
    const baseAtk = 3; // 基础攻击力
    const baseSpeed = tmpl.speed;

    // 时间成长
    let hp = baseHp + playerLevel * 12 + minute * 8;
    let atk = baseAtk + playerLevel * 3 + minute * 2;
    let speed = baseSpeed + minute * 0.8;

    // 精英怪倍率
    if (isElite) {
      hp *= 4;
      atk *= 2;
      speed *= 1.15;
    }

    // 取整
    hp = Math.ceil(hp);
    atk = Math.ceil(atk);
    speed = Math.ceil(speed);

    return { hp, atk, speed, isElite };
  }

  setPlayerLevel(level) { this._playerLevel = level; }

  _createEnemy(x, y, tmpl, waveNum, gameTime) {
    // 使用新成长公式
    const stats = this._calcEnemyStats(tmpl, gameTime || 0);
    const hpValue = stats.hp;
    const dmgValue = stats.atk;
    const speedValue = stats.speed;

    const e = this.world.createEntity();
    this.world.addComponent(e, 'Transform', { x, y });

    const spriteSize = tmpl.size;
    this.world.addComponent(e, 'Sprite', { w: spriteSize, h: spriteSize, color: tmpl.color, imageKey: tmpl.id });

    this.world.addComponent(e, 'Health', { hp: hpValue, maxHp: hpValue });
    this.world.addComponent(e, 'EnemyTag', {});
    this.world.addComponent(e, 'Damage', { value: dmgValue });
    this.world.addComponent(e, 'Collider', { radius: spriteSize / 2 });
    this.world.addComponent(e, 'ScoreValue', { value: tmpl.score });
    this.world.addComponent(e, 'Speed', { value: speedValue });

    const aiType = tmpl.ai || this._aiFromArchetype(tmpl.archetype);
    this.world.addComponent(e, 'EnemyAI', { type: aiType, timer: 0 });

    switch (tmpl.archetype) {
      case ARCHETYPE.RANGED:
        this.world.addComponent(e, 'RangedAttack', {
          interval: tmpl.shootInterval || 5.0,
          cooldown: Math.random() * 2,
          projectileSpeed: tmpl.projectileSpeed || 120,
          casting: false,
          castTime: 0.8,
          castTimer: 0,
        });
        break;
      case ARCHETYPE.EXPLODER:
        this.world.addComponent(e, 'ExplodeOnDeath', {
          radius: tmpl.explodeRadius || 50,
          damage: dmgValue,
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
            interval: tmpl.shootInterval || 6.0,
            cooldown: Math.random() * 2,
            projectileSpeed: tmpl.projectileSpeed || 90,
            casting: false,
            castTime: 1.0,
            castTimer: 0,
          });
          this.world.addComponent(e, 'ControlEffect', {
            type: tmpl.controlType,
            duration: tmpl.controlDuration || 2.0,
          });
        }
        if (tmpl.spikeInterval) {
          this.world.addComponent(e, 'SpikeAbility', { interval: tmpl.spikeInterval });
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
      const et = e.components.Transform;

      // Casting phase: windup before firing
      if (ranged.casting) {
        ranged.castTimer -= dt;
        if (ranged.castTimer <= 0) {
          ranged.casting = false;
          // Re-check distance at fire time
          if (MathUtils.distance(et, pt) > this.maxAttackRange) {
            ranged.cooldown = 0.5;
            continue;
          }
          this._fireRangedProjectile(e, et, pt, ranged);
          ranged.cooldown = ranged.interval;
        }
        continue;
      }

      // Cooldown phase
      ranged.cooldown -= dt;
      if (ranged.cooldown <= 0) {
        // Skip if enemy is outside attack range
        if (MathUtils.distance(et, pt) > this.maxAttackRange) {
          ranged.cooldown = 0.5;
          continue;
        }
        // Start casting
        ranged.casting = true;
        ranged.castTimer = ranged.castTime;
      }
    }
  }

  _fireRangedProjectile(e, et, pt, ranged) {
    const angle = MathUtils.angleBetween(et, pt);

    const control = e.components.ControlEffect;
    const projColor = control
      ? (control.type === 'slow' ? '#7fdbff' : '#1abc9c')
      : '#e67e22';
    const projImageKey = control
      ? (control.type === 'slow' ? 'enemy_projectile_ice' : 'enemy_projectile')
      : 'frost_mage_projectile';

    const projDmg = e.components.Damage ? e.components.Damage.value : (3 + (this.runState ? this.runState.getStage() : 1) * 2);
    const p = this.world.createEntity();
    this.world.addComponent(p, 'Transform', { x: et.x, y: et.y });
    this.world.addComponent(p, 'Velocity', { x: Math.cos(angle) * ranged.projectileSpeed, y: Math.sin(angle) * ranged.projectileSpeed });
    this.world.addComponent(p, 'Sprite', { w: 5, h: 5, color: projColor, imageKey: projImageKey });
    this.world.addComponent(p, 'ProjectileTag', {});
    this.world.addComponent(p, 'Damage', { value: projDmg });
    this.world.addComponent(p, 'Lifetime', { remaining: 3.0 });

    if (control) {
      if (control.type === 'slow') {
        this.world.addComponent(p, 'SlowOnHit', { duration: control.duration, amount: 0.5 });
      } else if (control.type === 'root') {
        this.world.addComponent(p, 'RootOnHit', { duration: control.duration });
      }
    }
  }
}
