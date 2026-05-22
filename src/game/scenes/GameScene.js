import { World } from '../../ecs/World.js';
import { Camera } from '../../engine/Camera.js';
import { CollisionSystem } from '../../engine/CollisionSystem.js';
import { MovementSystem } from '../systems/MovementSystem.js';
import { WeaponSystem } from '../systems/WeaponSystem.js';
import { EnemySpawnSystem } from '../systems/EnemySpawnSystem.js';
import { AISystem } from '../systems/AISystem.js';
import { ProjectileSystem } from '../systems/ProjectileSystem.js';
import { ContactDamageSystem } from '../systems/ContactDamageSystem.js';
import { ExperienceSystem } from '../systems/ExperienceSystem.js';
import { PickupSystem } from '../systems/PickupSystem.js';
import { RunState } from '../run/RunState.js';
import { SkillManager } from '../run/SkillManager.js';
import { DungeonGenerator } from '../dungeon/DungeonGenerator.js';
import { TILE } from '../dungeon/TileMap.js';
import { BossController } from '../boss/BossController.js';
import { DamageNumberSystem } from '../../ui/DamageNumberSystem.js';
import { MathUtils } from '../../engine/MathUtils.js';
import { FlowField } from '../../engine/FlowField.js';
import { SupplySystem } from '../run/SupplySystem.js';
import { WEAPONS } from '../data/weapons.js';

export class GameScene {
  constructor(renderer, input, audio, particles, onLevelUp, onGameOver) {
    this.renderer = renderer;
    this.input = input;
    this.audio = audio;
    this.particles = particles;
    this.onLevelUp = onLevelUp;
    this.onGameOver = onGameOver;
    this.LW = renderer.logicalWidth;
    this.LH = renderer.logicalHeight;
    this.paused = false;
    this.player = null;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.bossWarningTimer = 0;
    this._currentBuffs = {};
    this._levelUpFlash = 0;
  }

  onResume() {
    this.paused = false;
  }

  onEnter(data) {
    const mode = data?.mode || 'normal';
    this.world = new World();
    this.run = new RunState();
    this.run.setMode(mode);
    this.skillMgr = new SkillManager();
    this.expSystem = new ExperienceSystem(this.world);
    this.pickupSystem = new PickupSystem(this.world);
    this.pickupSystem.setExpSystem(this.expSystem);
    this.dmgNumbers = new DamageNumberSystem();
    this.collision = new CollisionSystem(64);

    const getBuffs = () => this.skillMgr.getBuffs();

    // Generate dungeon
    const gen = new DungeonGenerator(100, 140);
    const { map, rooms, supplyPoints } = gen.generate();
    this.tileMap = map;
    this.rooms = rooms;
    this.supplyPoints = supplyPoints;

    const spawnRoom = rooms.find(r => r.isSpawn) || rooms[0];
    const LW = map.width;
    const LH = map.height;

    this.camera = new Camera(this.LW, this.LH, LW, LH);

    this.movement = new MovementSystem(this.world, this.input);
    this.movement.setBounds(LW, LH);
    this.autoAttack = new WeaponSystem(this.world, getBuffs, (hits, weaponType) => this._onMeleeHit(hits, weaponType));
    this.enemySpawn = new EnemySpawnSystem(this.world, LW, LH);
    this.enemySpawn.setTileMap(this.tileMap);
    this.ai = new AISystem(this.world, getBuffs);
    this.flowField = new FlowField(this.tileMap);
    this.ai.setFlowField(this.flowField);
    // AI callbacks for summon/explode/hazard
    this.ai.onSpawnMinion = (x, y, hp) => this.enemySpawn.spawnMinion(x, y, hp);
    this.ai.onSpawnHazard = (x, y) => this._spawnHazard(x, y);
    this.ai.onExplode = (e) => this._handleExplode(e);
    this.projectile = new ProjectileSystem(this.world, LW, LH, (hits) => this._onHits(hits));
    this.projectile.setTileMap(this.tileMap);
    this.contactDmg = new ContactDamageSystem(this.world, (p, e) => this._onPlayerHit(p, e), getBuffs);

    // Boss
    this.boss = new BossController(this.world, LW, LH);
    this.boss.onDeath = () => {
      this.run.bossDefeated = true;
      this.audio.playLevelUp();
      this.bossDefeated = true;
      this.camera.shake(8, 1.0);
      if (this.boss.entity) {
        const bt = this.boss.entity.components.Transform;
        this.particles.emit(bt.x, bt.y, 30, { colors: ['#ff6b35', '#ffcc00', '#fff'], speed: 150, life: 1.2 });
      }
      this.run.addScore(500);
    };

    this.expSystem.onLevelUp = (level) => this._onLevelUp(level);

    // Supply system (4 援助点)
    this.supplySystem = new SupplySystem(this.world, this.supplyPoints, {
      expSystem: this.expSystem,
      particles: this.particles,
      camera: this.camera,
      audio: this.audio,
      dmgNumbers: this.dmgNumbers,
      enemySpawnSystem: this.enemySpawn,
      LW, LH,
      gameTime: 0,
    });

    // Player
    const px = spawnRoom ? spawnRoom.cx * map.tileSize + map.tileSize / 2 : LW / 2;
    const py = spawnRoom ? spawnRoom.cy * map.tileSize + map.tileSize / 2 : LH * 0.6;
    this.player = this.world.createEntity();
    this.world.addComponent(this.player, 'Transform', { x: px, y: py });
    this.world.addComponent(this.player, 'Sprite', { w: 14, h: 14, color: '#4ecdc4' });
    this.world.addComponent(this.player, 'Health', { hp: 6, maxHp: 6, invTimer: 0 });
    this.world.addComponent(this.player, 'PlayerTag', {});
    this.world.addComponent(this.player, 'PlayerSpeed', { value: 120 });
    this.world.addComponent(this.player, 'Weapons', {
      slots: {
        ranged:          { level: 1, cooldown: 0 },
        melee_slash:     { level: 0, cooldown: 0 },
        melee_orbit:     { level: 0, cooldown: 0, hitTimers: new Map() },
        melee_burst:     { level: 0, cooldown: 0 },
        pierce_spear:    { level: 0, cooldown: 0 },
        fireball:        { level: 0, cooldown: 0 },
        chain_lightning: { level: 0, cooldown: 0 },
        boomerang:       { level: 0, cooldown: 0 },
        ice_shard:       { level: 0, cooldown: 0 },
      },
    });
    this.world.addComponent(this.player, 'Collider', { radius: 7 });

    this.paused = false;
    this._gameOverFired = false;
    this.bossSpawned = false;
    this.bossDefeated = false;
    this.bossWarningTimer = 0;
    this.dungeonW = LW;
    this.dungeonH = LH;

    // Pre-render minimap
    this._buildMinimap();

    // Initial buffs
    this.applySkillBuffs();

    // Camera initial position
    this.camera.x = px - this.LW / 2;
    this.camera.y = py - this.LH / 2;
  }

  applySkillBuffs() {
    const buffs = this.skillMgr.getBuffs();
    this._currentBuffs = buffs;
    const speed = this.player.components.PlayerSpeed;
    speed.value = 120 * buffs.playerSpeedMult;
    // Weapon levels are read directly from skillMgr via _applyWeaponLevels
    this._applyWeaponLevels();
  }

  _applyWeaponLevels() {
    const weapons = this.player.components.Weapons;
    if (!weapons) return;
    // Map skill ids to weapon ids; ranged starts at lv1 by default
    const map = {
      weapon_ranged_up: 'ranged',
      weapon_melee_slash: 'melee_slash',
      weapon_melee_orbit: 'melee_orbit',
      weapon_melee_burst: 'melee_burst',
      weapon_pierce_spear: 'pierce_spear',
      weapon_fireball: 'fireball',
      weapon_chain_lightning: 'chain_lightning',
      weapon_boomerang: 'boomerang',
      weapon_ice_shard: 'ice_shard',
    };
    for (const [skillId, weaponId] of Object.entries(map)) {
      const stacks = this.skillMgr.getStackCount(skillId);
      if (weaponId === 'ranged') {
        weapons.slots.ranged.level = 1 + stacks;
      } else {
        weapons.slots[weaponId].level = stacks;
      }
    }
  }

  _renderWeaponFX(cam) {
    const renderer = this.renderer;
    const ctx = renderer.ctx;

    // Slash arcs
    for (const e of this.world.query('Transform', 'SlashFX')) {
      if (!e.active) continue;
      const t = e.components.Transform;
      const fx = e.components.SlashFX;
      const sx = t.x - cam.offsetX;
      const sy = t.y - cam.offsetY;
      const alpha = Math.max(0, fx.life / fx.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha * 0.7;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.arc(sx, sy, fx.range, fx.angle - fx.arc / 2, fx.angle + fx.arc / 2);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // Burst rings
    for (const e of this.world.query('Transform', 'BurstFX')) {
      if (!e.active) continue;
      const t = e.components.Transform;
      const fx = e.components.BurstFX;
      const sx = t.x - cam.offsetX;
      const sy = t.y - cam.offsetY;
      const alpha = Math.max(0, fx.life / fx.maxLife);
      const r = fx.radius * (1 - alpha) + fx.radius * 0.5;
      ctx.save();
      ctx.globalAlpha = alpha * 0.5;
      ctx.strokeStyle = '#ffaa44';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = alpha * 0.2;
      ctx.fillStyle = '#ff8822';
      ctx.fill();
      ctx.restore();
    }

    // Lightning chain
    for (const e of this.world.query('Transform', 'LightningFX')) {
      if (!e.active) continue;
      const fx = e.components.LightningFX;
      const alpha = Math.max(0, fx.life / fx.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = '#aaddff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < fx.points.length; i++) {
        const sx = fx.points[i].x - cam.offsetX;
        const sy = fx.points[i].y - cam.offsetY;
        if (i === 0) ctx.moveTo(sx, sy);
        else {
          // jittered intermediate point for lightning effect
          const prev = fx.points[i - 1];
          const midX = (prev.x + fx.points[i].x) / 2 - cam.offsetX + (Math.random() - 0.5) * 8;
          const midY = (prev.y + fx.points[i].y) / 2 - cam.offsetY + (Math.random() - 0.5) * 8;
          ctx.lineTo(midX, midY);
          ctx.lineTo(sx, sy);
        }
      }
      ctx.stroke();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // Orbit blades around player
    const weapons = this.player?.components.Weapons;
    if (weapons && weapons.slots.melee_orbit && weapons.slots.melee_orbit.level > 0) {
      const orbit = weapons.slots.melee_orbit;
      const blades = 2 + (orbit.level - 1);
      const radius = 35;
      const ang0 = this.autoAttack.orbitAngle;
      const pt = this.player.components.Transform;
      for (let i = 0; i < blades; i++) {
        const ang = ang0 + (Math.PI * 2 / blades) * i;
        const bx = pt.x + Math.cos(ang) * radius - cam.offsetX;
        const by = pt.y + Math.sin(ang) * radius - cam.offsetY;
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(ang + Math.PI / 2);
        ctx.fillStyle = '#bb88ff';
        ctx.fillRect(-2, -6, 4, 12);
        ctx.fillStyle = '#fff';
        ctx.fillRect(-1, -6, 2, 12);
        ctx.restore();
      }
    }
  }

  _onMeleeHit(hits, weaponType) {
    for (const { enemy, dmg } of hits) {
      if (!enemy.active) continue;
      enemy.components.Health.hp -= dmg;
      const et = enemy.components.Transform;
      this.dmgNumbers.add(et.x, et.y, dmg, { color: weaponType === 'orbit' ? '#bb88ff' : (weaponType === 'burst' ? '#ffaa44' : (weaponType === 'lightning' ? '#aaddff' : '#fff')) });
      if (enemy.components.Health.hp <= 0) {
        this._killEnemy(enemy);
      } else {
        this.audio.playHit();
      }
    }
  }

  _onHits(hits) {
    const buffs = this._currentBuffs;
    for (const { projectile, enemy } of hits) {
      if (!enemy.active) continue;
      const dmg = projectile.components.Damage.value;
      enemy.components.Health.hp -= dmg;

      const pt = enemy.components.Transform;
      const projColor = projectile.components.Sprite.color;
      this.dmgNumbers.add(pt.x, pt.y, dmg, { color: projColor });
      this.particles.emit(pt.x, pt.y, 3, { colors: ['#ffcc00'], speed: 40 });

      // Slow on hit (ice shard / controller slow)
      const slow = projectile.components.SlowOnHit;
      if (slow) {
        enemy.components.Slow = { duration: slow.duration, amount: slow.amount };
        this.particles.emit(pt.x, pt.y, 4, { colors: ['#7fdbff', '#fff'], speed: 30, life: 0.5 });
      }

      // Root on hit (controller root projectile)
      const rootHit = projectile.components.RootOnHit;
      if (rootHit) {
        enemy.components.Root = { duration: rootHit.duration };
        this.particles.emit(pt.x, pt.y, 4, { colors: ['#1abc9c', '#fff'], speed: 30, life: 0.5 });
      }

      // Explode on hit (fireball)
      const explode = projectile.components.ExplodeOnHit;
      if (explode) {
        this.particles.emit(pt.x, pt.y, 20, { colors: ['#ff5522', '#ffaa00', '#fff'], speed: 150, life: 0.7, sizeMax: 4 });
        const nearbyEnemies = this.world.query('Transform', 'EnemyTag', 'Health');
        for (const ne of nearbyEnemies) {
          if (ne.id === enemy.id || !ne.active) continue;
          const d = MathUtils.distance(pt, ne.components.Transform);
          if (d < explode.radius) {
            ne.components.Health.hp -= explode.damage;
            const net = ne.components.Transform;
            this.dmgNumbers.add(net.x, net.y, explode.damage, { color: '#ff5522' });
            if (ne.components.Health.hp <= 0) {
              this._killEnemy(ne);
            }
          }
        }
      }

      // Burn damage
      const burn = projectile.components.Burn?.value ?? 0;
      if (burn > 0) {
        const burnDmg = burn * 0.5;
        enemy.components.Health.hp -= burnDmg;
        this.dmgNumbers.add(pt.x + 5, pt.y - 5, burnDmg, { color: '#ff6b35' });
      }

      if (enemy.components.Health.hp <= 0) {
        // ExplodeOnDeath (legacy for bomber-type enemies killed by projectiles)
        if (enemy.components.ExplodeOnDeath) {
          const boom = enemy.components.ExplodeOnDeath;
          this.particles.emit(pt.x, pt.y, 15, { colors: ['#ff4444', '#ff8800', '#ffcc00'], speed: 120 });
          this.camera.shake(5, 0.3);
          const nearby = this.world.query('Transform', 'EnemyTag', 'Health');
          for (const ne of nearby) {
            if (ne.id === enemy.id || !ne.active) continue;
            const d = MathUtils.distance(pt, ne.components.Transform);
            if (d < boom.radius) {
              ne.components.Health.hp -= boom.damage;
              if (ne.components.Health.hp <= 0) {
                this._killEnemy(ne);
              }
            }
          }
          const pp = this.player.components.Transform;
          const pd = MathUtils.distance(pt, pp);
          if (pd < boom.radius && this.player.components.Health.invTimer <= 0) {
            const shieldChance = Math.min(0.3 * (buffs.shield || 0), 0.9);
            if (Math.random() < shieldChance) {
              this.dmgNumbers.add(pp.x, pp.y, 'BLOCK', { color: '#4ecdc4', size: 10 });
            } else {
              this.player.components.Health.hp -= boom.damage;
            }
          }
        }
        this._killEnemy(enemy);
      } else {
        this.audio.playHit();
      }
    }
  }

  _onPlayerHit(player, enemy) {
    this.audio.playHurt();
    const pt = player.components.Transform;
    this.particles.emit(pt.x, pt.y, 6, { colors: ['#ff4444', '#ff8888'], speed: 60 });
    this.camera.shake(4, 0.2);

    // Thorns visual feedback
    const thorns = this._currentBuffs.thorns || 0;
    if (thorns > 0 && enemy.active) {
      const et = enemy.components.Transform;
      this.dmgNumbers.add(et.x, et.y - 10, thorns, { color: '#2ecc71' });
      this.particles.emit(et.x, et.y, 3, { colors: ['#2ecc71'], speed: 40 });
    }

    if (player.components.Health.hp <= 0 && !this._gameOverFired) {
      this._gameOverFired = true;
      this.audio.playGameOver();
      this.run.survived = false;
      setTimeout(() => this.onGameOver(this.run), 800);
    }
  }

  _spawnHazard(x, y) {
    const e = this.world.createEntity();
    this.world.addComponent(e, 'Transform', { x, y });
    this.world.addComponent(e, 'Sprite', { w: 40, h: 40, color: '#1abc9c' });
    this.world.addComponent(e, 'HazardZone', {
      radius: 20, damage: 1, delay: 1.5, duration: 3, _tickTimer: 0,
    });
  }

  _handleExplode(e) {
    if (!e.active) return;
    const et = e.components.Transform;
    const boom = e.components.ExplodeOnDeath;
    if (!boom) { this.world.removeEntity(e.id); return; }

    this.particles.emit(et.x, et.y, 15, { colors: ['#ff4444', '#ff8800', '#ffcc00'], speed: 120 });
    this.camera.shake(5, 0.3);

    // Damage nearby enemies
    const nearby = this.world.query('Transform', 'EnemyTag', 'Health');
    for (const ne of nearby) {
      if (ne.id === e.id || !ne.active) continue;
      const d = MathUtils.distance(et, ne.components.Transform);
      if (d < boom.radius) {
        ne.components.Health.hp -= boom.damage;
        if (ne.components.Health.hp <= 0) {
          this._killEnemy(ne);
        }
      }
    }

    // Damage player
    const pp = this.player.components.Transform;
    const pd = MathUtils.distance(et, pp);
    if (pd < boom.radius && this.player.components.Health.invTimer <= 0) {
      const shieldChance = Math.min(0.3 * (this._currentBuffs.shield || 0), 0.9);
      if (Math.random() < shieldChance) {
        this.dmgNumbers.add(pp.x, pp.y, 'BLOCK', { color: '#4ecdc4', size: 10 });
      } else {
        this.player.components.Health.hp -= boom.damage;
        this.camera.shake(4, 0.2);
      }
    }

    this.world.removeEntity(e.id);
  }

  _killEnemy(enemy) {
    if (!enemy.active) return;
    const et = enemy.components.Transform;
    const isMinion = !!enemy.components.MinionTag;

    if (!isMinion) {
      this.audio.playKill();
      const expMult = this._currentBuffs.expMult || 1;
      const expValue = 1 + Math.floor(this.expSystem.level / 2);
      this.expSystem.spawnGem(et.x, et.y, expValue, expMult);
      const scoreMult = this._currentBuffs.scoreMult || 1;
      const sv = Math.ceil((enemy.components.ScoreValue?.value ?? 10) * scoreMult);
      this.run.addKill(sv);
      this.pickupSystem.spawnDrop(et.x, et.y);
      this.particles.emit(et.x, et.y, 6, { colors: [enemy.components.Sprite.color, '#ffcc00'] });
    } else {
      this.particles.emit(et.x, et.y, 3, { colors: ['#8e44ad'], speed: 30, life: 0.3 });
    }
    this.world.removeEntity(enemy.id);
  }

  _onLevelUp(level) {
    this.audio.playLevelUp();
    const pt = this.player.components.Transform;
    this.particles.emit(pt.x, pt.y, 30, { colors: ['#4ecdc4', '#fff', '#ffcc00', '#ff6b35'], speed: 150, life: 1.2 });
    this.camera.shake(3, 0.3);
    this._levelUpFlash = 0.5;
    this.paused = true;
    const choices = this.skillMgr.rollChoices(3, level);
    this.onLevelUp(level, choices, (skill) => {
      this.skillMgr.acquire(skill);
      this.run.addSkill(skill);

      // Instant effects: heal, max_hp, damage_all
      if (skill.id === 'heal') {
        const ph = this.player.components.Health;
        ph.hp = Math.min(ph.hp + 1, ph.maxHp);
      } else if (skill.id === 'max_hp') {
        const ph = this.player.components.Health;
        ph.maxHp += 1;
        ph.hp += 1;
      } else if (skill.id === 'damage_all') {
        const buffs = this.skillMgr.getBuffs();
        const enemies = this.world.query('Transform', 'EnemyTag', 'Health');
        for (const e of enemies) {
          const dmg = 3 * (buffs.damageMult || 1);
          e.components.Health.hp -= dmg;
          const et = e.components.Transform;
          this.dmgNumbers.add(et.x, et.y, dmg, { color: '#ff4444', size: 12 });
          if (e.components.Health.hp <= 0) {
            this.run.addKill(e.components.ScoreValue?.value ?? 10);
            this.particles.emit(et.x, et.y, 5, { colors: ['#ffcc00'] });
            this.world.removeEntity(e.id);
          }
        }
        this.camera.shake(5, 0.3);
      }

      this.applySkillBuffs();
      this.paused = false;
      this.audio.playClick();
    });
  }

  update(dt) {
    if (this._levelUpFlash > 0) this._levelUpFlash -= dt;
    if (this.paused) return;

    this.run.gameTime += dt;

    if (!this.run.isEndless()) {
      this.run.timeRemaining = Math.max(0, 300 - this.run.gameTime);
      if (this.run.timeRemaining <= 0) {
        this.run.survived = true;
        this.onGameOver(this.run);
        return;
      }
    }

    const playerAlive = this.player && this.player.active && this.player.components.Health.hp > 0;

    if (playerAlive) {
      if (!this.input.isKeyboardMoving()) {
        const ptr = this.input.getPointerScreenPos();
        if (ptr) {
          const logical = this.renderer.screenToLogical(ptr.x, ptr.y);
          const targetWX = logical.x + this.camera.x;
          const targetWY = logical.y + this.camera.y;
          const pt = this.player.components.Transform;
          const dx = targetWX - pt.x;
          const dy = targetWY - pt.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist > 8) {
            this.input.direction.x = dx / dist;
            this.input.direction.y = dy / dist;
          } else {
            this.input.direction.x = 0;
            this.input.direction.y = 0;
          }
        }
      }
      const pt = this.player.components.Transform;
      const oldPX = pt.x;
      const oldPY = pt.y;
      this.movement.update(dt);
      this.collision.resolveWalls(this.player, this.tileMap, oldPX, oldPY);
    }

    if (playerAlive) this.autoAttack.update(dt);

    // Boss spawn at 4:30 (normal mode only)
    if (!this.run.isEndless()) {
      if (!this.bossSpawned && this.run.timeRemaining <= 30) {
        this.bossSpawned = true;
        this.bossWarningTimer = 2.0;
      }

      if (this.bossWarningTimer > 0) {
        this.bossWarningTimer -= dt;
        if (this.bossWarningTimer <= 0 && !this.boss.active) {
          const bossRoom = this.rooms.find(r => r.isBoss) || this.rooms[this.rooms.length - 1];
          const bx = bossRoom.cx * this.tileMap.tileSize + this.tileMap.tileSize / 2;
          const by = bossRoom.cy * this.tileMap.tileSize + this.tileMap.tileSize / 2;
          const bossHp = 40 + Math.floor(this.run.gameTime / 30) * 10;
          this.boss.spawn(bx, by, bossHp);
          this.camera.shake(6, 0.5);
        }
      }

      if (!this.bossSpawned) {
        this.enemySpawn.update(dt, this.run.gameTime);
      }
    } else {
      this.enemySpawn.update(dt, this.run.gameTime);
    }

    // Supply system (spawns mission enemies, updates mini-bosses)
    if (this.supplySystem) {
      this.supplySystem.setGameTime(this.run.gameTime);
      this.supplySystem.update(dt, this.player);
    }

    // Boss update
    if (this.boss.active) {
      this.boss.update(dt);
    }

    // Update flow field for enemy pathfinding
    if (playerAlive) {
      const pt = this.player.components.Transform;
      this.flowField.update(pt.x, pt.y);
    }

    // Wall collision for ALL enemies (use last frame's resolved position as old)
    const enemyOldPos = this._lastFrameEnemyPos || new Map();
    this.ai.update(dt);

    for (const e of this.world.query('Transform', 'EnemyTag', 'Collider')) {
      if (!e.active) continue;
      const old = enemyOldPos.get(e.id);
      if (old) {
        this.collision.resolveWalls(e, this.tileMap, old.x, old.y);
      } else {
        this.collision.resolveWalls(e, this.tileMap);
      }
    }

    // Save resolved positions for next frame
    this._lastFrameEnemyPos = new Map();
    for (const e of this.world.query('Transform', 'EnemyTag', 'Collider')) {
      if (e.active) {
        const t = e.components.Transform;
        this._lastFrameEnemyPos.set(e.id, { x: t.x, y: t.y });
      }
    }

    this.projectile.update(dt);
    this.projectile.checkHits();
    this.contactDmg.update(dt);
    this.expSystem.update(dt);
    this.pickupSystem.update(dt, this._currentBuffs.magnetMult || 1);
    this.dmgNumbers.update(dt);

    // Tick weapon FX lifetimes
    for (const e of this.world.query('SlashFX')) {
      if (!e.active) continue;
      e.components.SlashFX.life -= dt;
      if (e.components.SlashFX.life <= 0) this.world.removeEntity(e.id);
    }
    for (const e of this.world.query('BurstFX')) {
      if (!e.active) continue;
      e.components.BurstFX.life -= dt;
      if (e.components.BurstFX.life <= 0) this.world.removeEntity(e.id);
    }
    for (const e of this.world.query('LightningFX')) {
      if (!e.active) continue;
      e.components.LightningFX.life -= dt;
      if (e.components.LightningFX.life <= 0) this.world.removeEntity(e.id);
    }

    this.particles.update(dt);

    // Camera follow
    if (playerAlive) {
      this.camera.follow(this.player.components.Transform.x, this.player.components.Transform.y, dt);
    }

    if (this.player && this.player.components.Health.hp <= 0 && !this._gameOverFired) {
      this.run.survived = false;
      this.onGameOver(this.run);
    }
  }

  render(alpha) {
    const { renderer, LW, LH } = this;
    renderer.clear();
    renderer.applyTransform();
    renderer.drawRect(0, 0, LW, LH, '#0d0d1a');

    const cam = this.camera;

    // Render tilemap (visible tiles + padding to prevent edge flicker)
    const ts = this.tileMap.tileSize;
    const pad = 2;
    const startCol = Math.max(0, Math.floor(cam.offsetX / ts) - pad);
    const endCol = Math.min(this.tileMap.cols, Math.ceil((cam.offsetX + LW) / ts) + pad);
    const startRow = Math.max(0, Math.floor(cam.offsetY / ts) - pad);
    const endRow = Math.min(this.tileMap.rows, Math.ceil((cam.offsetY + LH) / ts) + pad);

    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const tile = this.tileMap.get(c, r);
        const sx = c * ts - cam.offsetX;
        const sy = r * ts - cam.offsetY;
        if (tile === TILE.WALL) {
          // Interior wall — don't render, shows as dark background (hollow)
        } else if (tile === TILE.WALL_TOP) {
          renderer.drawRect(sx, sy, ts, ts, '#3d3d5c');
          renderer.drawRect(sx, sy, ts, ts * 0.5, '#555580');
        } else if (tile === TILE.FLOOR) {
          if ((c + r) % 2 === 0) {
            renderer.drawRect(sx, sy, ts, ts, '#222238');
          } else {
            renderer.drawRect(sx, sy, ts, ts, '#282845');
          }
        }
      }
    }

    // Boss room marker
    const bossRoom = this.rooms.find(r => r.isBoss);
    if (bossRoom) {
      const bx = bossRoom.x * ts - cam.offsetX;
      const by = bossRoom.y * ts - cam.offsetY;
      const bw = bossRoom.w * ts;
      const bh = bossRoom.h * ts;
      renderer.ctx.strokeStyle = '#331111';
      renderer.ctx.lineWidth = 2;
      renderer.ctx.strokeRect(bx, by, bw, bh);
    }

    // Render entities with camera offset
    const renderEntities = (query) => {
      for (const e of this.world.query(...query)) {
        if (!e.active) continue;
        const t = e.components.Transform;
        const s = e.components.Sprite;
        const sx = t.x - cam.offsetX;
        const sy = t.y - cam.offsetY;
        if (sx < -50 || sx > LW + 50 || sy < -50 || sy > LH + 50) continue;
        renderer.drawRect(sx - s.w / 2, sy - s.h / 2, s.w, s.h, s.color);
      }
    };

    renderEntities(['Transform', 'PickupTag', 'Sprite', 'PickupType']);
    renderEntities(['Transform', 'ProjectileTag', 'Sprite']);

    // Melee weapon visual effects
    this._renderWeaponFX(cam);

    // Supply points (under enemies/player so they don't occlude combat)
    if (this.supplySystem) {
      this.supplySystem.render(renderer, cam);
    }

    // Enemies (with HP bar for tough ones)
    for (const e of this.world.query('Transform', 'EnemyTag', 'Sprite', 'Health')) {
      const t = e.components.Transform;
      const s = e.components.Sprite;
      const sx = t.x - cam.offsetX;
      const sy = t.y - cam.offsetY;
      if (sx < -50 || sx > LW + 50 || sy < -50 || sy > LH + 50) continue;

      // Support aura visual
      const aura = e.components.SupportAura;
      if (aura) {
        renderer.setAlpha(0.12 + Math.sin(this.run.gameTime * 3) * 0.05);
        renderer.drawCircle(sx, sy, aura.radius, '#f39c12');
        renderer.setAlpha(0.25);
        renderer.ctx.strokeStyle = '#f39c12';
        renderer.ctx.lineWidth = 1;
        renderer.ctx.beginPath();
        renderer.ctx.arc(Math.floor(sx), Math.floor(sy), aura.radius, 0, Math.PI * 2);
        renderer.ctx.stroke();
        renderer.setAlpha(1);
      }

      // Charge telegraph flash
      const ai = e.components.EnemyAI;
      if (ai && ai.type === 'charge' && ai.phase === 'telegraph') {
        if (ai._flash) {
          renderer.setAlpha(0.6);
          renderer.drawCircle(sx, sy, s.w, '#ff0000');
          renderer.setAlpha(1);
        }
      }

      // Explode fuse pulsing
      if (ai && ai.type === 'explode' && ai.phase === 'fuse') {
        const fuseProgress = (ai.fuseTimer || 0) / 2.0;
        const pulse = Math.sin(fuseProgress * Math.PI * 6) * 0.4 + 0.6;
        const expandSize = s.w * (1 + fuseProgress * 0.5);
        renderer.setAlpha(pulse * 0.5);
        renderer.drawCircle(sx, sy, expandSize, '#ffcc00');
        renderer.setAlpha(1);
      }

      // Root visual (immobilized enemy)
      if (e.components.Root) {
        renderer.setAlpha(0.4);
        renderer.drawCircle(sx, sy, s.w * 0.8, '#1abc9c');
        renderer.setAlpha(1);
      }

      renderer.drawRect(sx - s.w / 2, sy - s.h / 2, s.w, s.h, s.color);

      if (e.components.Health.maxHp > 1) {
        const hbw = s.w + 4;
        renderer.drawRect(sx - hbw / 2, sy - s.h / 2 - 5, hbw, 2, '#333');
        const ratio = Math.max(0, e.components.Health.hp / e.components.Health.maxHp);
        renderer.drawRect(sx - hbw / 2, sy - s.h / 2 - 5, hbw * ratio, 2, '#e74c3c');
      }
    }

    // Hazard zones (ground spikes)
    for (const h of this.world.query('Transform', 'HazardZone')) {
      if (!h.active) continue;
      const ht = h.components.Transform;
      const hz = h.components.HazardZone;
      const sx = ht.x - cam.offsetX;
      const sy = ht.y - cam.offsetY;
      if (sx < -50 || sx > LW + 50 || sy < -50 || sy > LH + 50) continue;

      if (hz.delay > 0) {
        // Warning circle
        renderer.setAlpha(0.3);
        renderer.drawCircle(sx, sy, hz.radius, '#ffcc00');
        renderer.setAlpha(1);
      } else {
        // Active hazard
        renderer.setAlpha(0.4 + Math.sin(this.run.gameTime * 8) * 0.15);
        renderer.drawCircle(sx, sy, hz.radius, '#1abc9c');
        renderer.setAlpha(0.6);
        // Spike markers
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 / 6) * i;
          const px = sx + Math.cos(a) * hz.radius * 0.6;
          const py = sy + Math.sin(a) * hz.radius * 0.6;
          renderer.drawRect(px - 2, py - 2, 4, 4, '#1abc9c');
        }
        renderer.setAlpha(1);
      }
    }

    // Poison zones
    for (const z of this.world.query('Transform', 'PoisonZone')) {
      if (!z.active) continue;
      const zt = z.components.Transform;
      const zone = z.components.PoisonZone;
      const sx = zt.x - cam.offsetX;
      const sy = zt.y - cam.offsetY;
      if (sx < -50 || sx > LW + 50 || sy < -50 || sy > LH + 50) continue;
      renderer.setAlpha(0.2 + Math.sin(this.run.gameTime * 4) * 0.1);
      renderer.drawCircle(sx, sy, zone.radius, '#2ecc71');
      renderer.setAlpha(1);
    }

    // Player
    if (this.player && this.player.active) {
      const pt = this.player.components.Transform;
      const ps = this.player.components.Sprite;
      const ph = this.player.components.Health;
      const sx = pt.x - cam.offsetX;
      const sy = pt.y - cam.offsetY;
      const visible = ph.invTimer <= 0 || Math.floor(ph.invTimer * 10) % 2 === 0;

      // Freeze aura visual
      const freezeAura = this._currentBuffs.freezeAura || 0;
      if (freezeAura > 0) {
        const pulse = 0.8 + Math.sin(this.run.gameTime * 3) * 0.2;
        renderer.setAlpha(0.15 * freezeAura * pulse);
        renderer.drawCircle(sx, sy, 100, '#00bcd4');
        renderer.setAlpha(1);
      }

      if (visible) {
        renderer.drawRect(sx - ps.w / 2, sy - ps.h / 2, ps.w, ps.h, ps.color);
        renderer.ctx.strokeStyle = '#2ab7a9';
        renderer.ctx.lineWidth = 1;
        renderer.ctx.strokeRect(sx - ps.w / 2 - 1, sy - ps.h / 2 - 1, ps.w + 2, ps.h + 2);

        // Thorns aura visual
        const thorns = this._currentBuffs.thorns || 0;
        if (thorns > 0) {
          renderer.setAlpha(0.4);
          renderer.ctx.strokeStyle = '#2ecc71';
          renderer.ctx.lineWidth = 1;
          renderer.ctx.strokeRect(sx - ps.w / 2 - 3, sy - ps.h / 2 - 3, ps.w + 6, ps.h + 6);
          renderer.setAlpha(1);
        }

        // Shield visual
        const shield = this._currentBuffs.shield || 0;
        if (shield > 0) {
          renderer.setAlpha(0.5);
          renderer.ctx.strokeStyle = '#3498db';
          renderer.ctx.lineWidth = 2;
          renderer.ctx.beginPath();
          renderer.ctx.arc(sx, sy, 12, 0, Math.PI * 2);
          renderer.ctx.stroke();
          renderer.setAlpha(1);
        }
      }
    }

    // Particles (with camera)
    renderer.ctx.save();
    renderer.ctx.translate(-cam.offsetX, -cam.offsetY);
    this.particles.render(renderer.ctx);
    this.dmgNumbers.render(renderer.ctx);
    renderer.ctx.restore();

    // Boss warning text
    if (this.bossWarningTimer > 0) {
      const flash = Math.floor(this.bossWarningTimer * 6) % 2 === 0;
      if (flash) {
        renderer.drawText('WARNING', LW / 2, LH * 0.4, {
          color: '#ff4444', size: 24, align: 'center',
        });
        renderer.drawText('BOSS APPROACHING', LW / 2, LH * 0.4 + 30, {
          color: '#ff8888', size: 10, align: 'center',
        });
      }
    }

    this._renderHUD();

    // Level-up flash overlay
    if (this._levelUpFlash > 0) {
      renderer.setAlpha(this._levelUpFlash * 0.6);
      renderer.drawRect(0, 0, LW, LH, '#ffcc00');
      renderer.setAlpha(1);
    }

    renderer.restoreTransform();
    renderer.present();
  }

  _renderHUD() {
    const { renderer, run, expSystem, player, LW, LH, skillMgr } = this;
    if (!player) return;
    const ph = player.components.Health;

    // HP bar
    const hpX = 10, hpY = 10, hpW = 80, hpH = 8;
    renderer.drawRect(hpX - 1, hpY - 1, hpW + 2, hpH + 2, '#222');
    renderer.drawRect(hpX, hpY, hpW, hpH, '#333');
    const hpRatio = Math.max(0, ph.hp / ph.maxHp);
    const hpColor = hpRatio > 0.5 ? '#4ecdc4' : hpRatio > 0.25 ? '#ffa500' : '#ff4444';
    renderer.drawRect(hpX, hpY, hpW * hpRatio, hpH, hpColor);
    renderer.drawText(`HP ${ph.hp}/${ph.maxHp}`, hpX + 2, hpY + 1, { color: '#fff', size: 7 });

    // Timer
    let timeStr, timeColor;
    if (run.isEndless()) {
      const m = Math.floor(run.gameTime / 60);
      const s = Math.floor(run.gameTime % 60);
      timeStr = `${m}:${s.toString().padStart(2, '0')}`;
      timeColor = '#ff6b35';
    } else {
      const mins = Math.floor(run.timeRemaining / 60);
      const secs = Math.floor(run.timeRemaining % 60);
      timeStr = `${mins}:${secs.toString().padStart(2, '0')}`;
      timeColor = run.timeRemaining <= 30 ? (Math.floor(run.gameTime * 4) % 2 === 0 ? '#ff4444' : '#ff8888') : '#fff';
    }
    renderer.drawText(timeStr, LW / 2, 10, { color: timeColor, size: 16, align: 'center' });
    if (run.isEndless()) {
      renderer.drawText('ENDLESS', LW / 2, 28, { color: '#ff6b35', size: 7, align: 'center' });
    }

    // Supply warnings (top center, below timer)
    if (this.supplySystem) {
      const warnings = this.supplySystem.getActiveWarnings();
      let warnY = 40;
      for (const w of warnings) {
        renderer.drawText(`${w.label}: ${w.time}s`, LW / 2, warnY, { color: w.color, size: 8, align: 'center' });
        warnY += 12;
      }
    }

    // Wave HUD
    const waveNum = this.enemySpawn.getWaveNum();
    const waveWarning = this.enemySpawn.getWaveWarning();
    const waveTimer = this.enemySpawn.getWaveTimer();
    renderer.drawText(`Wave ${waveNum}`, LW / 2, 54, { color: '#aaa', size: 8, align: 'center' });
    if (waveWarning > 0) {
      const isDanger = waveNum > 0 && (waveNum + 1) % 5 === 0;
      const flashAlpha = Math.floor(run.gameTime * 6) % 2 === 0 ? 1 : 0.4;
      renderer.setAlpha(flashAlpha);
      if (isDanger) {
        renderer.drawText('!! DANGER WAVE !!', LW / 2, 66, { color: '#ffcc00', size: 10, align: 'center' });
      } else {
        renderer.drawText('WAVE INCOMING', LW / 2, 66, { color: '#ff6b35', size: 9, align: 'center' });
      }
      renderer.setAlpha(1);
    } else if (waveNum > 0 && waveTimer > 0 && waveTimer < 30) {
      renderer.drawText(`Next: ${Math.ceil(waveTimer)}s`, LW / 2, 64, { color: '#666', size: 7, align: 'center' });
    }

    // Level
    renderer.drawText(`LV.${expSystem.level}`, 10, 22, { color: '#4ecdc4', size: 10 });

    // EXP bar
    const expY = 35, expW = 80, expH = 4;
    renderer.drawRect(10, expY, expW, expH, '#333');
    renderer.drawRect(10, expY, expW * expSystem.getProgress(), expH, '#4ecdc4');

    // Kills + Score (below EXP bar)
    renderer.drawText(`Kills: ${run.kills}`, 10, 44, { color: '#ff6b35', size: 8 });
    renderer.drawText(`Score: ${run.score}`, 10, 54, { color: '#888', size: 8 });

    // Active skills list (bottom-left)
    const acquired = skillMgr.acquired;
    if (acquired.length > 0) {
      const startY = LH - 14;
      const showCount = Math.min(acquired.length, 4);
      // Show last acquired skills (most recent first)
      const recent = acquired.slice(-showCount).reverse();
      for (let i = 0; i < recent.length; i++) {
        const s = recent[i];
        const y = startY - i * 12;
        renderer.setAlpha(0.8);
        renderer.drawRect(4, y - 1, 3, 3, '#4ecdc4');
        renderer.setAlpha(1);
        renderer.drawText(s.icon + s.name, 10, y - 2, { color: '#666', size: 7 });
      }
    }

    // Buff indicators (below kills/score)
    const buffs = this._currentBuffs;
    let buffY = 64;
    if (buffs.freezeAura > 0) {
      renderer.drawText('❄ FREEZE', 10, buffY, { color: '#00bcd4', size: 7 });
      buffY += 10;
    }
    if (buffs.thorns > 0) {
      renderer.drawText('🌿 THORNS', 10, buffY, { color: '#2ecc71', size: 7 });
      buffY += 10;
    }
    if (buffs.burn > 0) {
      renderer.drawText('🔥 BURN', 10, buffY, { color: '#ff6b35', size: 7 });
      buffY += 10;
    }
    if (buffs.shield > 0) {
      renderer.drawText(`◆ SHIELD x${buffs.shield}`, 10, buffY, { color: '#3498db', size: 7 });
      buffY += 10;
    }
    if (buffs.pierce > 0) {
      renderer.drawText(`➹ PIERCE x${buffs.pierce}`, 10, buffY, { color: '#e74c3c', size: 7 });
      buffY += 10;
    }
    if (buffs.ricochet > 0) {
      renderer.drawText(`⟳ RICO x${buffs.ricochet}`, 10, buffY, { color: '#f39c12', size: 7 });
    }

    // Boss HP bar
    if (this.boss && this.boss.active && this.boss.entity) {
      const bossHpRatio = Math.max(0, this.boss.hp / this.boss.maxHp);
      const bw = LW - 40;
      const bx = 20, by = LH - 30;
      renderer.drawRect(bx - 1, by - 1, bw + 2, 12, '#222');
      renderer.drawRect(bx, by, bw, 10, '#333');

      let bColor = '#e74c3c';
      if (this.boss.phase === 2) bColor = '#c0392b';
      if (this.boss.phase === 3) bColor = '#ff0000';
      renderer.drawRect(bx, by, bw * bossHpRatio, 10, bColor);

      renderer.drawText('BOSS', bx + bw / 2, by + 1, {
        color: '#fff', size: 8, align: 'center',
      });

      const phaseText = this.boss.phase === 1 ? '' : this.boss.phase === 2 ? ' ENRAGED' : ' FRENZY';
      if (phaseText) {
        const flash = Math.floor(run.gameTime * 4) % 2 === 0;
        renderer.drawText(phaseText, bx + bw + 5, by + 1, {
          color: flash ? '#ff4444' : '#ff8888', size: 7, align: 'left',
        });
      }
    }

    this._renderMinimap();
  }

  _buildMinimap() {
    const map = this.tileMap;
    const ts = map.tileSize;
    const scale = 0.75;
    const mw = map.cols * scale;
    const mh = map.rows * scale;

    const offscreen = document.createElement('canvas');
    offscreen.width = mw;
    offscreen.height = mh;
    const ctx = offscreen.getContext('2d');

    const bossRoom = this.rooms.find(r => r.isBoss);
    const spawnRoom = this.rooms.find(r => r.isSpawn);

    for (let r = 0; r < map.rows; r++) {
      for (let c = 0; c < map.cols; c++) {
        const tile = map.get(c, r);
        if (tile === 0) { // FLOOR
          let color = '#282845';
          if (spawnRoom && c >= spawnRoom.x && c < spawnRoom.x + spawnRoom.w && r >= spawnRoom.y && r < spawnRoom.y + spawnRoom.h) {
            color = '#1a4a3a';
          } else if (bossRoom && c >= bossRoom.x && c < bossRoom.x + bossRoom.w && r >= bossRoom.y && r < bossRoom.y + bossRoom.h) {
            color = '#4a1a1a';
          }
          ctx.fillStyle = color;
        } else {
          ctx.fillStyle = '#0d0d1a';
        }
        ctx.fillRect(Math.floor(c * scale), Math.floor(r * scale), Math.ceil(scale), Math.ceil(scale));
      }
    }

    this._minimapCanvas = offscreen;
    this._minimapW = mw;
    this._minimapH = mh;
  }

  _renderMinimap() {
    const { renderer, player, LW } = this;
    if (!this._minimapCanvas || !player) return;

    const mmW = this._minimapW;
    const mmH = this._minimapH;
    const mmX = LW - mmW - 6;
    const mmY = 42;

    // Background border
    renderer.setAlpha(0.7);
    renderer.drawRect(mmX - 2, mmY - 2, mmW + 4, mmH + 4, '#111');
    renderer.setAlpha(1);

    // Cached dungeon image
    const ctx = renderer.ctx;
    ctx.drawImage(this._minimapCanvas, Math.floor(mmX), Math.floor(mmY), Math.floor(mmW), Math.floor(mmH));

    // Player dot
    const pt = player.components.Transform;
    const ts = this.tileMap.tileSize;
    const scale = 0.75;
    const px = mmX + (pt.x / ts) * scale;
    const py = mmY + (pt.y / ts) * scale;
    renderer.setAlpha(0.9);
    renderer.drawCircle(px, py, 2.5, '#4ecdc4');
    renderer.setAlpha(1);

    // Supply points
    if (this.supplyPoints) {
      for (const sp of this.supplyPoints) {
        const sx2 = mmX + (sp.x / ts) * scale;
        const sy2 = mmY + (sp.y / ts) * scale;
        const colors = { heal: '#2ecc71', bomb: '#e74c3c', mission: '#f1c40f', miniboss: '#9b59b6' };
        const color = colors[sp.type] || '#fff';
        // find state from supplySystem
        const stateInfo = this.supplySystem ? this.supplySystem.points.find(p => p.cx === sp.cx && p.cy === sp.cy) : null;
        const isActive = stateInfo && (stateInfo.state === 'active' || stateInfo.state === 'warning');
        renderer.setAlpha(isActive ? 0.95 : 0.6);
        renderer.drawCircle(sx2, sy2, isActive ? 2.5 : 2, color);
        renderer.setAlpha(1);
      }
    }

    // Enemies dots
    const enemies = this.world.query('Transform', 'EnemyTag');
    if (enemies.length > 0) {
      renderer.setAlpha(0.5);
      for (const e of enemies) {
        if (!e.active) continue;
        const et = e.components.Transform;
        const ex = mmX + (et.x / ts) * scale;
        const ey = mmY + (et.y / ts) * scale;
        renderer.drawRect(ex - 0.5, ey - 0.5, 1.5, 1.5, '#e74c3c');
      }
      renderer.setAlpha(1);
    }

    // Boss dot
    if (this.boss && this.boss.entity && this.boss.entity.active) {
      const bt = this.boss.entity.components.Transform;
      const bx = mmX + (bt.x / ts) * scale;
      const by = mmY + (bt.y / ts) * scale;
      renderer.drawCircle(bx, by, 3, '#ff4444');
    }
  }
}
