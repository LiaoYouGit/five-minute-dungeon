import { MathUtils } from '../../engine/MathUtils.js';

const PHASE_THRESHOLDS = [0.6, 0.3]; // Phase 2 @ 60%, Phase 3 @ 30%

const PHASE_CONFIG = {
  1: { attackCooldown: 2.5, moveSpeed: 40, color: '#c0392b', size: 32 },
  2: { attackCooldown: 2.0, moveSpeed: 55, color: '#e74c3c', size: 36 },
  3: { attackCooldown: 1.5, moveSpeed: 70, color: '#ff0000', size: 42 },
};

export class FinalBossController {
  constructor(world, LW, LH, deps) {
    this.world = world;
    this.LW = LW;
    this.LH = LH;
    this.deps = deps; // { particles, camera, audio, enemySpawn, dmgNumbers }
    this.entity = null;
    this.hp = 0;
    this.maxHp = 0;
    this.phase = 1;
    this.active = false;
    this.timer = 0;
    this.attackTimer = 2.0;

    // Phase transition state
    this.phaseTransitioning = false;
    this.phaseTransitionTimer = 0;
    this.phaseTransitionEffect = null;

    // Skill cooldowns
    this.skillCooldowns = {
      fanSlash: 0,
      ringBarrage: 0,
      groundSpike: 0,
      summon: 0,
      rotatingBarrage: 0,
      domainPressure: 0,
      trackingEye: 0,
      chainBind: 0,
      mirrorClone: 0,
      darkWave: 0,
      rotatingLaser: 0,
      abyssGaze: 0,
      frenzySummon: 0,
      finalStrike: 0,
    };

    // Active skill state (state machine)
    this.activeSkillState = null;

    // Special mechanics entities
    this.trackingEyes = [];
    this.mirrorClones = [];
    this.abyssGaze = null;

    // Warning data (rendered in render())
    this.warningData = [];

    this.onDeath = null;
  }

  spawn(x, y, maxHp = 120, onDeath = null) {
    this.entity = this.world.createEntity();
    this.world.addComponent(this.entity, 'Transform', { x, y });
    this.world.addComponent(this.entity, 'Sprite', {
      w: PHASE_CONFIG[1].size,
      h: PHASE_CONFIG[1].size,
      color: PHASE_CONFIG[1].color,
      imageKey: 'boss_phase1',
    });
    this.world.addComponent(this.entity, 'Health', { hp: maxHp, maxHp });
    this.world.addComponent(this.entity, 'EnemyTag', {});
    this.world.addComponent(this.entity, 'BossTag', {});
    this.world.addComponent(this.entity, 'Damage', { value: 10 }); // Adjusted for player 100HP baseline (10% damage)
    this.world.addComponent(this.entity, 'Speed', { value: PHASE_CONFIG[1].moveSpeed });
    this.world.addComponent(this.entity, 'ScoreValue', { value: 1000 });
    this.world.addComponent(this.entity, 'Collider', { radius: 16 });

    this.maxHp = maxHp;
    this.hp = maxHp;
    this.active = true;
    this.phase = 1;
    this.timer = 0;
    this.attackTimer = 2.0;
    this.onDeath = onDeath;

    // Reset cooldowns
    for (const key of Object.keys(this.skillCooldowns)) {
      this.skillCooldowns[key] = 0;
    }

    this.trackingEyes = [];
    this.mirrorClones = [];
    this.abyssGaze = null;
    this.warningData = [];

    if (this.deps.camera) this.deps.camera.shake(6, 0.5);
    if (this.deps.audio) this.deps.audio.play('levelup');
  }

  update(dt) {
    if (!this.active || !this.entity || !this.entity.active) return;

    this.timer += dt;

    const h = this.entity.components.Health;
    this.hp = h.hp;

    // Check death
    if (h.hp <= 0) {
      this.active = false;
      const t = this.entity.components.Transform;
      const cb = this.onDeath;
      this.world.removeEntity(this.entity.id);
      this.entity = null;

      // Clean up all special entities
      this._cleanupSpecialEntities();

      if (cb) cb(t.x, t.y);
      return;
    }

    // Phase transition check
    if (!this.phaseTransitioning) {
      this._checkPhaseTransition();
    }

    // Phase transition cinematic
    if (this.phaseTransitioning) {
      this.phaseTransitionTimer -= dt;
      if (this.phaseTransitionTimer <= 0) {
        this.phaseTransitioning = false;
        this.phaseTransitionEffect = null;
        this.attackTimer = PHASE_CONFIG[this.phase].attackCooldown;
      }
      return;
    }

    // Tick cooldowns
    for (const key of Object.keys(this.skillCooldowns)) {
      if (this.skillCooldowns[key] > 0) {
        this.skillCooldowns[key] -= dt;
      }
    }

    // Update active skill state
    if (this.activeSkillState) {
      this._updateActiveSkill(dt);
    } else {
      // Movement
      this._updateMovement(dt);

      // Attack timer
      this.attackTimer -= dt;
      if (this.attackTimer <= 0) {
        this.attackTimer = PHASE_CONFIG[this.phase].attackCooldown;
        this._chooseAndExecuteSkill();
      }
    }

    // Update special mechanics
    this._updateTrackingEyes(dt);
    this._updateMirrorClones(dt);
    this._updateAbyssGaze(dt);

    // Tick warning durations
    this.warningData = this.warningData.filter(w => {
      w.timer -= dt;
      return w.timer > 0;
    });
  }

  _checkPhaseTransition() {
    const hpRatio = this.hp / this.maxHp;

    if (hpRatio <= PHASE_THRESHOLDS[1] && this.phase < 3) {
      this.phase = 3;
      this._triggerPhase3Transition();
    } else if (hpRatio <= PHASE_THRESHOLDS[0] && this.phase < 2) {
      this.phase = 2;
      this._triggerPhase2Transition();
    }
  }

  _triggerPhase2Transition() {
    this.phaseTransitioning = true;
    this.phaseTransitionTimer = 2.0;

    // Visual effects
    if (this.deps.camera) this.deps.camera.shake(8, 2.0);

    const bt = this.entity.components.Transform;
    if (this.deps.particles) {
      this.deps.particles.emit(bt.x, bt.y, 40, {
        colors: ['#ff0000', '#880000', '#440000'],
        speed: 200,
        life: 2.0,
        sizeMin: 3,
        sizeMax: 6,
      });
    }

    // Boss transformation
    const sprite = this.entity.components.Sprite;
    sprite.color = PHASE_CONFIG[2].color;
    sprite.imageKey = 'boss_phase2';
    sprite.w = PHASE_CONFIG[2].size;
    sprite.h = PHASE_CONFIG[2].size;

    this.entity.components.Speed.value = PHASE_CONFIG[2].moveSpeed;

    // Black fog effect
    this.phaseTransitionEffect = {
      type: 'fog',
      startTime: this.timer,
      duration: 2.0,
      color: '#220000',
    };

    // Clear small enemies
    const enemies = this.world.query('Transform', 'EnemyTag', 'Health');
    for (const e of enemies) {
      if (!e.components.BossTag && !e.components.EliteTag) {
        e.components.Health.hp -= 2;
        if (e.components.Health.hp <= 0) {
          this.world.removeEntity(e.id);
        }
      }
    }

    // Reset cooldowns for Phase 2 skills
    this.skillCooldowns.rotatingBarrage = 0;
    this.skillCooldowns.domainPressure = 0;
    this.skillCooldowns.trackingEye = 0;
    this.skillCooldowns.chainBind = 0;
  }

  _triggerPhase3Transition() {
    this.phaseTransitioning = true;
    this.phaseTransitionTimer = 3.0;

    // Extreme visual effects
    if (this.deps.camera) this.deps.camera.shake(12, 3.0);

    const bt = this.entity.components.Transform;
    if (this.deps.particles) {
      this.deps.particles.emit(bt.x, bt.y, 80, {
        colors: ['#ff0000', '#ff4400', '#ff8800', '#ffffff'],
        speed: 300,
        life: 3.0,
        sizeMin: 4,
        sizeMax: 8,
      });
    }

    // Boss transformation
    const sprite = this.entity.components.Sprite;
    sprite.color = PHASE_CONFIG[3].color;
    sprite.imageKey = 'boss_phase3';
    sprite.w = PHASE_CONFIG[3].size;
    sprite.h = PHASE_CONFIG[3].size;

    this.entity.components.Speed.value = PHASE_CONFIG[3].moveSpeed;

    // Blood moon effect
    this.phaseTransitionEffect = {
      type: 'bloodMoon',
      startTime: this.timer,
      duration: 3.0,
      overlayColor: '#330000',
      moonColor: '#ff0000',
    };

    // Clear all enemies
    const enemies = this.world.query('Transform', 'EnemyTag', 'Health');
    for (const e of enemies) {
      if (!e.components.BossTag) {
        const et = e.components.Transform;
        if (this.deps.particles) {
          this.deps.particles.emit(et.x, et.y, 10, { colors: ['#ff0000'], speed: 80 });
        }
        this.world.removeEntity(e.id);
      }
    }

    // Reset cooldowns for Phase 3 skills
    this.skillCooldowns.mirrorClone = 0;
    this.skillCooldowns.darkWave = 0;
    this.skillCooldowns.rotatingLaser = 0;
    this.skillCooldowns.abyssGaze = 0;
    this.skillCooldowns.frenzySummon = 0;
    this.skillCooldowns.finalStrike = 0;

    // Immediately spawn mirror clones
    this._spawnMirrorClones();
  }

  _cleanupSpecialEntities() {
    // Remove tracking eyes
    for (const eyeId of this.trackingEyes) {
      const eye = this.world.getEntity(eyeId);
      if (eye && eye.active) {
        this.world.removeEntity(eye.id);
      }
    }
    this.trackingEyes = [];

    // Remove mirror clones
    for (const cloneId of this.mirrorClones) {
      const clone = this.world.getEntity(cloneId);
      if (clone && clone.active) {
        this.world.removeEntity(clone.id);
      }
    }
    this.mirrorClones = [];

    // Remove abyss gaze
    if (this.abyssGaze) {
      const gaze = this.world.getEntity(this.abyssGaze);
      if (gaze && gaze.active) {
        this.world.removeEntity(gaze.id);
      }
      this.abyssGaze = null;
    }
  }

  _updateMovement(dt) {
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) return;

    const pt = players[0].components.Transform;
    const bt = this.entity.components.Transform;
    const speed = this.entity.components.Speed.value;

    const dist = MathUtils.distance(bt, pt);

    // Phase-specific movement patterns
    if (this.phase === 1) {
      // Slow strafe around player
      let targetDist = 120;
      let moveAngle = MathUtils.angleBetween(bt, pt);

      if (dist < 80) {
        moveAngle += Math.PI; // Move away
      } else if (dist > 150) {
        // Move closer
      } else {
        moveAngle += Math.PI / 2 + Math.sin(this.timer * 0.5) * 0.5; // Circle
      }

      bt.x += Math.cos(moveAngle) * speed * dt;
      bt.y += Math.sin(moveAngle) * speed * dt;
    } else if (this.phase === 2) {
      // Aggressive dash + teleport
      if (dist > 100) {
        const moveAngle = MathUtils.angleBetween(bt, pt);
        bt.x += Math.cos(moveAngle) * speed * 1.5 * dt;
        bt.y += Math.sin(moveAngle) * speed * 1.5 * dt;
      } else if (dist < 60) {
        // Teleport away
        const teleportDist = 150;
        const teleportAngle = MathUtils.angleBetween(pt, bt) + (Math.random() - 0.5) * 1.0;
        bt.x = MathUtils.clamp(pt.x + Math.cos(teleportAngle) * teleportDist, 20, this.LW - 20);
        bt.y = MathUtils.clamp(pt.y + Math.sin(teleportAngle) * teleportDist, 20, this.LH - 20);
      }
    } else if (this.phase === 3) {
      // Frantic erratic movement
      const erraticAngle = MathUtils.angleBetween(bt, pt) + Math.sin(this.timer * 2) * 0.8;
      bt.x += Math.cos(erraticAngle) * speed * dt;
      bt.y += Math.sin(erraticAngle) * speed * dt;
    }

    // Bounds
    bt.x = MathUtils.clamp(bt.x, 20, this.LW - 20);
    bt.y = MathUtils.clamp(bt.y, 20, this.LH - 20);
  }

  _chooseAndExecuteSkill() {
    const available = [];

    // Phase 1 skills
    if (this.phase >= 1) {
      if (this.skillCooldowns.fanSlash <= 0) available.push('fanSlash');
      if (this.skillCooldowns.ringBarrage <= 0) available.push('ringBarrage');
      if (this.skillCooldowns.groundSpike <= 0) available.push('groundSpike');
      if (this.skillCooldowns.summon <= 0) available.push('summon');
    }

    // Phase 2 skills
    if (this.phase >= 2) {
      if (this.skillCooldowns.rotatingBarrage <= 0) available.push('rotatingBarrage');
      if (this.skillCooldowns.domainPressure <= 0) available.push('domainPressure');
      if (this.skillCooldowns.trackingEye <= 0) available.push('trackingEye');
      if (this.skillCooldowns.chainBind <= 0) available.push('chainBind');
    }

    // Phase 3 skills
    if (this.phase >= 3) {
      if (this.skillCooldowns.mirrorClone <= 0) available.push('mirrorClone');
      if (this.skillCooldowns.darkWave <= 0) available.push('darkWave');
      if (this.skillCooldowns.rotatingLaser <= 0) available.push('rotatingLaser');
      if (this.skillCooldowns.abyssGaze <= 0) available.push('abyssGaze');
      if (this.skillCooldowns.frenzySummon <= 0) available.push('frenzySummon');
      if (this.skillCooldowns.finalStrike <= 0) available.push('finalStrike');
    }

    if (available.length === 0) return;

    const choice = available[Math.floor(Math.random() * available.length)];
    this._executeSkill(choice);
  }

  _executeSkill(skillName) {
    const bt = this.entity.components.Transform;
    const players = this.world.query('Transform', 'PlayerTag');
    if (players.length === 0) return;
    const pt = players[0].components.Transform;

    switch (skillName) {
      case 'fanSlash':
        this._fanSlash(bt, pt);
        break;
      case 'ringBarrage':
        this._ringBarrage(bt);
        break;
      case 'groundSpike':
        this._groundSpike(bt, pt);
        break;
      case 'summon':
        this._summon(bt);
        break;
      case 'rotatingBarrage':
        this._rotatingBarrage(bt);
        break;
      case 'domainPressure':
        this._domainPressure(bt);
        break;
      case 'trackingEye':
        this._spawnTrackingEyes(bt);
        break;
      case 'chainBind':
        this._chainBind(bt, pt);
        break;
      case 'mirrorClone':
        this._spawnMirrorClones();
        break;
      case 'darkWave':
        this._darkWave(bt);
        break;
      case 'rotatingLaser':
        this._rotatingLaser(bt);
        break;
      case 'abyssGaze':
        this._spawnAbyssGaze(bt);
        break;
      case 'frenzySummon':
        this._frenzySummon(bt);
        break;
      case 'finalStrike':
        this._finalStrike(bt, pt);
        break;
    }
  }

  // Phase 1 Skills

  _fanSlash(bt, pt) {
    const angle = MathUtils.angleBetween(bt, pt);
    const arc = MathUtils.toRad(120);
    const range = 100;
    const damage = 15; // 15% of player 100HP
    const warningDuration = 1.2;

    // Add warning
    this.warningData.push({
      type: 'sector',
      x: bt.x,
      y: bt.y,
      radius: range,
      angle: angle,
      arc: arc,
      duration: warningDuration,
      timer: warningDuration,
      color: '#ff0000',
      alpha: 0.5,
    });

    // Execute after warning
    this.activeSkillState = {
      type: 'fanSlash',
      phase: 'warning',
      timer: warningDuration,
      angle,
      arc,
      range,
      damage,
    };

    this.skillCooldowns.fanSlash = 8.0;
  }

  _ringBarrage(bt) {
    const count = 8 + this.phase * 2;
    const speed = 80;
    const warningDuration = 0.8;

    // Add warning
    this.warningData.push({
      type: 'circle',
      x: bt.x,
      y: bt.y,
      radius: 20,
      duration: warningDuration,
      timer: warningDuration,
      color: '#ff0000',
      alpha: 0.5,
    });

    this.activeSkillState = {
      type: 'ringBarrage',
      phase: 'warning',
      timer: warningDuration,
      count,
      speed,
      startAngle: Math.random() * Math.PI * 2,
    };

    this.skillCooldowns.ringBarrage = 5.0;
  }

  _groundSpike(bt, pt) {
    const count = 3;
    const radius = 30;
    const delay = 1.5;
    const duration = 2.0;
    const damage = 1;

    // Spawn HazardZones near player
    for (let i = 0; i < count; i++) {
      const offsetX = (Math.random() - 0.5) * 100;
      const offsetY = (Math.random() - 0.5) * 100;
      const x = MathUtils.clamp(pt.x + offsetX, 20, this.LW - 20);
      const y = MathUtils.clamp(pt.y + offsetY, 20, this.LH - 20);

      const zone = this.world.createEntity();
      this.world.addComponent(zone, 'Transform', { x, y });
      this.world.addComponent(zone, 'Sprite', { w: radius * 2, h: radius * 2, color: '#f1c40f' });
      this.world.addComponent(zone, 'HazardZone', {
        radius,
        damage,
        delay,
        duration,
        _tickTimer: 0,
      });
      this.world.addComponent(zone, 'Lifetime', { remaining: delay + duration });

      // Add warning
      this.warningData.push({
        type: 'circle',
        x,
        y,
        radius,
        duration: delay,
        timer: delay,
        color: '#f1c40f',
        alpha: 0.6,
      });
    }

    this.skillCooldowns.groundSpike = 6.0;
  }

  _summon(bt) {
    const count = 2;

    // Summon elite enemies
    if (this.deps.enemySpawn) {
      for (let i = 0; i < count; i++) {
        const offsetX = (Math.random() - 0.5) * 80;
        const offsetY = (Math.random() - 0.5) * 80;
        const x = MathUtils.clamp(bt.x + offsetX, 20, this.LW - 20);
        const y = MathUtils.clamp(bt.y + offsetY, 20, this.LH - 20);

        // Spawn vampire or ghost_king
        const gameTime = this.deps.gameTime || 300;
        this.deps.enemySpawn.spawnAt(x, y, gameTime);
      }
    }

    if (this.deps.particles) {
      this.deps.particles.emit(bt.x, bt.y, 20, {
        colors: ['#9b59b6', '#c0392b'],
        speed: 100,
        life: 1.0,
      });
    }

    this.skillCooldowns.summon = 12.0;
  }

  // Phase 2 Skills

  _rotatingBarrage(bt) {
    const rings = 2;
    const countPerRing = 12;
    const spinRate = 0.5; // rad/s
    const duration = 3.0;
    const warningDuration = 1.0;

    this.warningData.push({
      type: 'circle',
      x: bt.x,
      y: bt.y,
      radius: 25,
      duration: warningDuration,
      timer: warningDuration,
      color: '#ff0000',
      alpha: 0.5,
    });

    this.activeSkillState = {
      type: 'rotatingBarrage',
      phase: 'warning',
      timer: warningDuration,
      rings,
      countPerRing,
      spinRate,
      duration,
      elapsed: 0,
    };

    this.skillCooldowns.rotatingBarrage = 6.0;
  }

  _domainPressure(bt) {
    const radius = 150;
    const slowAmount = 0.5;
    const duration = 5.0;
    const damage = 3; // Per tick, 3% of player 100HP
    const warningDuration = 2.0;

    this.warningData.push({
      type: 'zone',
      x: bt.x,
      y: bt.y,
      radius,
      duration: warningDuration,
      timer: warningDuration,
      color: '#220000',
      alpha: 0.6,
    });

    this.activeSkillState = {
      type: 'domainPressure',
      phase: 'warning',
      timer: warningDuration,
      radius,
      slowAmount,
      duration,
      damage,
    };

    this.skillCooldowns.domainPressure = 10.0;
  }

  _spawnTrackingEyes(bt) {
    const count = 2;
    const eyeHp = 5;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 60 + Math.random() * 40;

      const eye = this.world.createEntity();
      this.world.addComponent(eye, 'Transform', {
        x: bt.x + Math.cos(angle) * dist,
        y: bt.y + Math.sin(angle) * dist,
      });
      this.world.addComponent(eye, 'Sprite', {
        w: 12,
        h: 12,
        color: '#9b59b6',
        imageKey: 'abyss_eye',
      });
      this.world.addComponent(eye, 'Health', { hp: eyeHp, maxHp: eyeHp });
      this.world.addComponent(eye, 'EnemyTag', {});
      this.world.addComponent(eye, 'FloatingEyeAI', {
        orbitAngle: angle,
        orbitRadius: 80,
        shootCooldown: 2.0,
        shootTimer: 1.0,
      });

      this.trackingEyes.push(eye.id);
    }

    if (this.deps.particles) {
      this.deps.particles.emit(bt.x, bt.y, 15, {
        colors: ['#9b59b6', '#bb66ff'],
        speed: 120,
        life: 0.8,
      });
    }

    this.skillCooldowns.trackingEye = 15.0;
  }

  _chainBind(bt, pt) {
    const count = 3;
    const maxDist = 200;
    const rootDuration = 1.5;
    const damage = 1;
    const warningDuration = 0.8;

    for (let i = 0; i < count; i++) {
      const angle = MathUtils.angleBetween(bt, pt) + (Math.random() - 0.5) * 0.6;

      this.warningData.push({
        type: 'line',
        x: bt.x,
        y: bt.y,
        angle,
        length: maxDist,
        duration: warningDuration,
        timer: warningDuration,
        color: '#ff0044',
        alpha: 0.5,
      });
    }

    this.activeSkillState = {
      type: 'chainBind',
      phase: 'warning',
      timer: warningDuration,
      count,
      maxDist,
      rootDuration,
      damage,
      targetAngle: MathUtils.angleBetween(bt, pt),
    };

    this.skillCooldowns.chainBind = 8.0;
  }

  // Phase 3 Skills

  _spawnMirrorClones() {
    const bt = this.entity.components.Transform;
    const count = 2;
    const cloneHp = 10;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i + Math.PI / 4;
      const dist = 80;

      const clone = this.world.createEntity();
      this.world.addComponent(clone, 'Transform', {
        x: bt.x + Math.cos(angle) * dist,
        y: bt.y + Math.sin(angle) * dist,
      });
      this.world.addComponent(clone, 'Sprite', {
        w: 32,
        h: 32,
        color: '#ff4444',
        imageKey: 'boss_phase3',
        _flickerTimer: 0,
      });
      this.world.addComponent(clone, 'Health', { hp: cloneHp, maxHp: cloneHp });
      this.world.addComponent(clone, 'EnemyTag', {});
      this.world.addComponent(clone, 'MirrorCloneTag', {
        skillChance: 0.5,
        attackCooldown: 3.0,
        attackTimer: Math.random() * 2.0,
      });

      this.mirrorClones.push(clone.id);
    }

    if (this.deps.particles) {
      this.deps.particles.emit(bt.x, bt.y, 30, {
        colors: ['#ff4444', '#ff0000'],
        speed: 150,
        life: 1.0,
      });
    }

    this.skillCooldowns.mirrorClone = 20.0;
  }

  _darkWave(bt) {
    const maxRadius = 300;
    const expansionSpeed = 80;
    const safeZoneRadius = 50;
    const damage = 25; // 25% of player 100HP
    const warningDuration = 3.0;

    // Find safe zone position
    const safeZoneAngle = Math.random() * Math.PI * 2;
    const safeZoneDist = 100 + Math.random() * 100;
    const safeX = MathUtils.clamp(bt.x + Math.cos(safeZoneAngle) * safeZoneDist, 20, this.LW - 20);
    const safeY = MathUtils.clamp(bt.y + Math.sin(safeZoneAngle) * safeZoneDist, 20, this.LH - 20);

    this.warningData.push({
      type: 'wave',
      x: bt.x,
      y: bt.y,
      radius: 0,
      maxRadius,
      safeZone: { x: safeX, y: safeY, radius: safeZoneRadius },
      duration: warningDuration,
      timer: warningDuration,
      color: '#ff0000',
      alpha: 0.6,
    });

    this.activeSkillState = {
      type: 'darkWave',
      phase: 'warning',
      timer: warningDuration,
      maxRadius,
      expansionSpeed,
      safeZone: { x: safeX, y: safeY, radius: safeZoneRadius },
      damage,
    };

    this.skillCooldowns.darkWave = 15.0;
  }

  _rotatingLaser(bt) {
    const beamCount = 4;
    const rotationSpeed = Math.PI / 2; // 90° per second
    const duration = 4.0;
    const damage = 5; // Per tick, 5% of player 100HP
    const warningDuration = 1.5;

    this.warningData.push({
      type: 'laser',
      x: bt.x,
      y: bt.y,
      angle: 0,
      beamCount,
      radius: 250,
      duration: warningDuration,
      timer: warningDuration,
      color: '#ff0044',
      alpha: 0.5,
    });

    this.activeSkillState = {
      type: 'rotatingLaser',
      phase: 'warning',
      timer: warningDuration,
      beamCount,
      rotationSpeed,
      duration,
      damage,
      elapsed: 0,
      currentAngle: 0,
    };

    this.skillCooldowns.rotatingLaser = 10.0;
  }

  _spawnAbyssGaze(bt) {
    const gazeAngle = MathUtils.toRad(60);
    const gazeRange = 200;
    const slowAmount = 0.7;
    const damagePerSecond = 3; // 3% per second of player 100HP
    const duration = 8.0;
    const openingDuration = 1.0;

    const eye = this.world.createEntity();
    this.world.addComponent(eye, 'Transform', { x: bt.x, y: bt.y });
    this.world.addComponent(eye, 'Sprite', {
      w: 60,
      h: 60,
      color: '#ff0000',
      imageKey: 'abyss_giant_eye',
    });
    this.world.addComponent(eye, 'AbyssGaze', {
      gazeAngle,
      gazeRange,
      slowAmount,
      damagePerSecond,
      duration,
      timer: duration,
      openingDuration,
      openingTimer: openingDuration,
    });

    this.abyssGaze = eye.id;

    if (this.deps.particles) {
      this.deps.particles.emit(bt.x, bt.y, 20, {
        colors: ['#ff0000', '#ff4400'],
        speed: 180,
        life: 1.2,
      });
    }

    this.skillCooldowns.abyssGaze = 12.0;
  }

  _frenzySummon(bt) {
    const count = 4;

    if (this.deps.enemySpawn) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 / count) * i;
        const dist = 80;
        const x = MathUtils.clamp(bt.x + Math.cos(angle) * dist, 20, this.LW - 20);
        const y = MathUtils.clamp(bt.y + Math.sin(angle) * dist, 20, this.LH - 20);

        const gameTime = this.deps.gameTime || 450;
        this.deps.enemySpawn.spawnAt(x, y, gameTime);
      }
    }

    if (this.deps.camera) this.deps.camera.shake(6, 0.5);
    if (this.deps.particles) {
      this.deps.particles.emit(bt.x, bt.y, 30, {
        colors: ['#ff0000', '#ff6600'],
        speed: 200,
        life: 1.0,
      });
    }

    this.skillCooldowns.frenzySummon = 8.0;
  }

  _finalStrike(bt, pt) {
    const chainCount = 3;
    const dashSpeed = 400;
    const damage = 40; // Fixed damage, 40% of player 100HP
    const warningDuration = 2.0;

    // Charge warning lines (similar to MiniBossController)
    this.activeSkillState = {
      type: 'finalStrike',
      phase: 'marking',
      chainCount,
      dashSpeed,
      damage,
      warningDuration,
      currentChain: 0,
      startX: bt.x,
      startY: bt.y,
      targetX: pt.x,
      targetY: pt.y,
      timer: warningDuration / chainCount,
      speed: 0,
    };

    // Add warning line
    this.warningData.push({
      type: 'line',
      x: bt.x,
      y: bt.y,
      angle: MathUtils.angleBetween(bt, pt),
      length: MathUtils.distance(bt, pt),
      duration: warningDuration / chainCount,
      timer: warningDuration / chainCount,
      color: '#ff0000',
      alpha: 0.7,
    });

    this.skillCooldowns.finalStrike = 20.0;
  }

  // Update active skill state machine
  _updateActiveSkill(dt) {
    if (!this.activeSkillState) return;

    const state = this.activeSkillState;
    state.timer -= dt;

    switch (state.type) {
      case 'fanSlash':
        this._updateFanSlash(dt, state);
        break;
      case 'ringBarrage':
        this._updateRingBarrage(dt, state);
        break;
      case 'rotatingBarrage':
        this._updateRotatingBarrage(dt, state);
        break;
      case 'domainPressure':
        this._updateDomainPressure(dt, state);
        break;
      case 'chainBind':
        this._updateChainBind(dt, state);
        break;
      case 'darkWave':
        this._updateDarkWave(dt, state);
        break;
      case 'rotatingLaser':
        this._updateRotatingLaser(dt, state);
        break;
      case 'finalStrike':
        this._updateFinalStrike(dt, state);
        break;
    }
  }

  _updateFanSlash(dt, state) {
    if (state.phase === 'warning') {
      if (state.timer <= 0) {
        state.phase = 'executing';
        state.timer = 0.3;

        // Execute fan slash damage
        const bt = this.entity.components.Transform;
        const players = this.world.query('Transform', 'PlayerTag', 'Health');
        for (const p of players) {
          const pt = p.components.Transform;
          const ph = p.components.Health;

          const dist = MathUtils.distance(bt, pt);
          if (dist <= state.range) {
            const angleToPlayer = MathUtils.angleBetween(bt, pt);
            let angleDiff = Math.abs(angleToPlayer - state.angle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

            if (angleDiff <= state.arc / 2) {
              ph.hp -= state.damage;
              ph.invTimer = 1.0;
              if (this.deps.dmgNumbers) {
                this.deps.dmgNumbers.add(pt.x, pt.y, state.damage, { color: '#ff0000', size: 14 });
              }
              if (this.deps.particles) {
                this.deps.particles.emit(pt.x, pt.y, 10, {
                  colors: ['#ff0000', '#fff'],
                  speed: 100,
                  life: 0.5,
                });
              }
            }
          }
        }

        if (this.deps.camera) this.deps.camera.shake(4, 0.3);
      }
    } else if (state.phase === 'executing') {
      if (state.timer <= 0) {
        this.activeSkillState = null;
      }
    }
  }

  _updateRingBarrage(dt, state) {
    if (state.phase === 'warning') {
      if (state.timer <= 0) {
        state.phase = 'executing';
        state.timer = 0.5;

        const bt = this.entity.components.Transform;
        for (let i = 0; i < state.count; i++) {
          const a = state.startAngle + (Math.PI * 2 / state.count) * i;
          this._fireProjectile(bt.x, bt.y, a, state.speed);
        }
      }
    } else if (state.phase === 'executing') {
      if (state.timer <= 0) {
        this.activeSkillState = null;
      }
    }
  }

  _updateRotatingBarrage(dt, state) {
    if (state.phase === 'warning') {
      if (state.timer <= 0) {
        state.phase = 'executing';
        state.elapsed = 0;
      }
    } else if (state.phase === 'executing') {
      state.elapsed += dt;

      // Spawn rotating projectiles over time
      const spawnInterval = 0.3;
      if (state.elapsed >= spawnInterval) {
        state.elapsed -= spawnInterval;

        const bt = this.entity.components.Transform;
        const currentAngle = this.timer * state.spinRate;

        for (let i = 0; i < state.countPerRing; i++) {
          const a = currentAngle + (Math.PI * 2 / state.countPerRing) * i;
          this._fireProjectile(bt.x, bt.y, a, 90);
        }
      }

      if (state.elapsed >= state.duration) {
        this.activeSkillState = null;
      }
    }
  }

  _updateDomainPressure(dt, state) {
    if (state.phase === 'warning') {
      if (state.timer <= 0) {
        state.phase = 'executing';

        const bt = this.entity.components.Transform;
        const zone = this.world.createEntity();
        this.world.addComponent(zone, 'Transform', { x: bt.x, y: bt.y });
        this.world.addComponent(zone, 'Sprite', {
          w: state.radius * 2,
          h: state.radius * 2,
          color: '#220000',
        });
        this.world.addComponent(zone, 'HazardZone', {
          radius: state.radius,
          damage: state.damage,
          delay: 0,
          duration: state.duration,
          slowAmount: state.slowAmount,
          _tickTimer: 0,
        });
        this.world.addComponent(zone, 'Lifetime', { remaining: state.duration });

        if (this.deps.particles) {
          this.deps.particles.emit(bt.x, bt.y, 25, {
            colors: ['#220000', '#ff0000'],
            speed: 150,
            life: 1.0,
          });
        }
      }
    }
  }

  _updateChainBind(dt, state) {
    if (state.phase === 'warning') {
      if (state.timer <= 0) {
        state.phase = 'executing';

        const bt = this.entity.components.Transform;
        for (let i = 0; i < state.count; i++) {
          const angle = state.targetAngle + (Math.random() - 0.5) * 0.6;
          const p = this.world.createEntity();
          this.world.addComponent(p, 'Transform', { x: bt.x, y: bt.y });
          this.world.addComponent(p, 'Velocity', {
            x: Math.cos(angle) * 120,
            y: Math.sin(angle) * 120,
          });
          this.world.addComponent(p, 'Sprite', {
            w: 6,
            h: 6,
            color: '#ff0044',
            imageKey: 'chain_projectile',
          });
          this.world.addComponent(p, 'ProjectileTag', {});
          this.world.addComponent(p, 'Damage', { value: state.damage });
          this.world.addComponent(p, 'Lifetime', { remaining: 2.0 });
          this.world.addComponent(p, 'Boomerang', {
            traveled: 0,
            maxDist: state.maxDist,
            returning: false,
          });
          this.world.addComponent(p, 'HitTracker', {
            hitSet: new Set(),
            pierceLeft: 99,
            ricochetLeft: 0,
          });
          this.world.addComponent(p, 'RootOnHit', { duration: state.rootDuration });
        }
      }
    }
  }

  _updateDarkWave(dt, state) {
    if (state.phase === 'warning') {
      if (state.timer <= 0) {
        state.phase = 'executing';
        state.elapsed = 0;
      }
    } else if (state.phase === 'executing') {
      state.elapsed += dt;

      // Expanding wave
      const bt = this.entity.components.Transform;
      const waveRadius = state.elapsed * state.expansionSpeed;

      // Check player distance from safe zone and wave
      const players = this.world.query('Transform', 'PlayerTag', 'Health');
      for (const p of players) {
        const pt = p.components.Transform;
        const ph = p.components.Health;

        const distToBoss = MathUtils.distance(pt, bt);
        const distToSafe = MathUtils.distance(pt, state.safeZone);

        // If wave hits player and player not in safe zone
        if (distToBoss <= waveRadius && distToSafe > state.safeZone.radius) {
          ph.hp -= state.damage;
          ph.invTimer = 1.0;
          if (this.deps.dmgNumbers) {
            this.deps.dmgNumbers.add(pt.x, pt.y, state.damage, { color: '#ff0000', size: 16 });
          }
        }
      }

      if (waveRadius >= state.maxRadius) {
        this.activeSkillState = null;
      }
    }
  }

  _updateRotatingLaser(dt, state) {
    if (state.phase === 'warning') {
      if (state.timer <= 0) {
        state.phase = 'executing';
        state.elapsed = 0;
        state.currentAngle = 0;
      }
    } else if (state.phase === 'executing') {
      state.elapsed += dt;
      state.currentAngle += state.rotationSpeed * dt;

      const bt = this.entity.components.Transform;

      // Check laser collision
      const players = this.world.query('Transform', 'PlayerTag', 'Health');
      for (const p of players) {
        const pt = p.components.Transform;
        const ph = p.components.Health;

        // Simplified laser collision: check if player within laser radius and angle
        const dist = MathUtils.distance(pt, bt);
        if (dist <= 250) {
          const angleToPlayer = MathUtils.angleBetween(bt, pt);
          for (let i = 0; i < state.beamCount; i++) {
            const laserAngle = state.currentAngle + (Math.PI * 2 / state.beamCount) * i;
            let angleDiff = Math.abs(angleToPlayer - laserAngle);
            if (angleDiff > Math.PI) angleDiff = Math.PI * 2 - angleDiff;

            // If player within narrow angle of laser
            if (angleDiff <= 0.1) {
              ph.hp -= state.damage * dt;
              if (this.deps.dmgNumbers && Math.floor(state.elapsed * 10) % 2 === 0) {
                this.deps.dmgNumbers.add(pt.x, pt.y, Math.floor(state.damage), {
                  color: '#ff0044',
                  size: 10,
                });
              }
            }
          }
        }
      }

      if (state.elapsed >= state.duration) {
        this.activeSkillState = null;
      }
    }
  }

  _updateFinalStrike(dt, state) {
    const bt = this.entity.components.Transform;
    const players = this.world.query('Transform', 'PlayerTag', 'Health');
    if (players.length === 0) {
      this.activeSkillState = null;
      return;
    }
    const pt = players[0].components.Transform;
    const ph = players[0].components.Health;

    if (state.phase === 'marking') {
      if (state.timer <= 0) {
        state.phase = 'charging';
        state.timer = 0.5;

        const dist = MathUtils.distance(bt, { x: state.targetX, y: state.targetY });
        state.speed = dist / 0.5;
      }
    } else if (state.phase === 'charging') {
      const dirX = state.targetX - bt.x;
      const dirY = state.targetY - bt.y;
      const dist = Math.sqrt(dirX * dirX + dirY * dirY);

      if (dist > 5) {
        bt.x += (dirX / dist) * state.speed * dt;
        bt.y += (dirY / dist) * state.speed * dt;
      }

      // Check collision with player
      if (MathUtils.distance(bt, pt) < 20 && ph.hp > 0) {
        ph.hp -= state.damage;
        ph.invTimer = 1.0;
        if (this.deps.dmgNumbers) {
          this.deps.dmgNumbers.add(pt.x, pt.y, state.damage, { color: '#ff0000', size: 18 });
        }
        if (this.deps.particles) {
          this.deps.particles.emit(pt.x, pt.y, 20, {
            colors: ['#ff0000', '#ff4444'],
            speed: 200,
            life: 0.8,
          });
        }
        if (this.deps.camera) this.deps.camera.shake(10, 0.5);
      }

      if (state.timer <= 0 || dist <= 5) {
        state.currentChain++;

        if (state.currentChain < state.chainCount) {
          // Chain to next position
          const newAngle = MathUtils.angleBetween(bt, pt);
          const newTargetDist = 300;
          state.startX = bt.x;
          state.startY = bt.y;
          state.targetX = MathUtils.clamp(bt.x + Math.cos(newAngle) * newTargetDist, 20, this.LW - 20);
          state.targetY = MathUtils.clamp(bt.y + Math.sin(newAngle) * newTargetDist, 20, this.LH - 20);
          state.phase = 'marking';
          state.timer = state.warningDuration / state.chainCount;

          // Add new warning
          this.warningData.push({
            type: 'line',
            x: bt.x,
            y: bt.y,
            angle: newAngle,
            length: newTargetDist,
            duration: state.timer,
            timer: state.timer,
            color: '#ff0000',
            alpha: 0.7,
          });
        } else {
          this.activeSkillState = null;
        }
      }
    }
  }

  // Update special mechanics
  _updateTrackingEyes(dt) {
    for (const eyeId of this.trackingEyes) {
      const eye = this.world.getEntity(eyeId);
      if (!eye || !eye.active) {
        this.trackingEyes = this.trackingEyes.filter(id => id !== eyeId);
        continue;
      }

      const ai = eye.components.FloatingEyeAI;
      const et = eye.components.Transform;
      const bt = this.entity?.components.Transform;

      if (!bt) continue;

      // Orbit around boss
      ai.orbitAngle += dt * 0.5;
      et.x = bt.x + Math.cos(ai.orbitAngle) * ai.orbitRadius;
      et.y = bt.y + Math.sin(ai.orbitAngle) * ai.orbitRadius;

      // Shoot projectile
      ai.shootTimer -= dt;
      if (ai.shootTimer <= 0) {
        ai.shootTimer = ai.shootCooldown;

        const players = this.world.query('Transform', 'PlayerTag');
        if (players.length > 0) {
          const pt = players[0].components.Transform;
          const angle = MathUtils.angleBetween(et, pt);

          this._fireProjectile(et.x, et.y, angle, 100, '#bb66ff', 'eye_projectile');
        }
      }
    }
  }

  _updateMirrorClones(dt) {
    for (const cloneId of this.mirrorClones) {
      const clone = this.world.getEntity(cloneId);
      if (!clone || !clone.active) {
        this.mirrorClones = this.mirrorClones.filter(id => id !== cloneId);
        continue;
      }

      const tag = clone.components.MirrorCloneTag;
      const ct = clone.components.Transform;
      const sprite = clone.components.Sprite;
      const bt = this.entity?.components.Transform;

      if (!bt) continue;

      // Flicker effect
      sprite._flickerTimer += dt;
      if (sprite._flickerTimer > 0.1) {
        sprite._flickerTimer = 0;
        sprite.alpha = 0.5 + Math.random() * 0.5;
      }

      // Follow boss
      const angle = MathUtils.angleBetween(ct, bt) + Math.PI;
      ct.x = bt.x + Math.cos(angle) * 80;
      ct.y = bt.y + Math.sin(angle) * 80;

      // Use skills
      tag.attackTimer -= dt;
      if (tag.attackTimer <= 0 && Math.random() < tag.skillChance) {
        tag.attackTimer = tag.attackCooldown;

        const players = this.world.query('Transform', 'PlayerTag');
        if (players.length > 0) {
          const pt = players[0].components.Transform;
          if (Math.random() < 0.5) {
            // Fan slash (simplified)
            const angle = MathUtils.angleBetween(ct, pt);
            this._fireProjectile(ct.x, ct.y, angle, 80, '#ff4444', 'boss_bullet');
          } else {
            // Ring barrage (simplified)
            for (let i = 0; i < 6; i++) {
              const a = (Math.PI * 2 / 6) * i;
              this._fireProjectile(ct.x, ct.y, a, 60, '#ff4444', 'boss_bullet');
            }
          }
        }
      }
    }
  }

  _updateAbyssGaze(dt) {
    if (!this.abyssGaze) return;

    const eye = this.world.getEntity(this.abyssGaze);
    if (!eye || !eye.active) {
      this.abyssGaze = null;
      return;
    }

    const gaze = eye.components.AbyssGaze;
    const et = eye.components.Transform;

    gaze.timer -= dt;

    if (gaze.timer <= 0) {
      this.world.removeEntity(eye.id);
      this.abyssGaze = null;
      return;
    }

    // Opening animation
    if (gaze.openingTimer > 0) {
      gaze.openingTimer -= dt;
      return;
    }

    // Track player
    const players = this.world.query('Transform', 'PlayerTag', 'Health', 'PlayerSpeed');
    if (players.length === 0) return;

    const p = players[0];
    const pt = p.components.Transform;
    const ph = p.components.Health;
    const playerSpeed = p.components.PlayerSpeed;

    const dist = MathUtils.distance(et, pt);

    if (dist < gaze.gazeRange) {
      ph.hp -= gaze.damagePerSecond * dt;
      if (playerSpeed) {
        playerSpeed.value = 120 * (1 - gaze.slowAmount);
      }
    } else {
      // Reset speed when out of gaze
      if (playerSpeed) {
        playerSpeed.value = 120;
      }
    }
  }

  // Helper: fire projectile
  _fireProjectile(x, y, angle, speed, color = '#e74c3c', imageKey = 'boss_bullet', damage = 5) {
    const p = this.world.createEntity();
    this.world.addComponent(p, 'Transform', { x, y });
    this.world.addComponent(p, 'Velocity', {
      x: Math.cos(angle) * speed,
      y: Math.sin(angle) * speed,
    });
    this.world.addComponent(p, 'Sprite', { w: 6, h: 6, color, imageKey });
    this.world.addComponent(p, 'ProjectileTag', {});
    this.world.addComponent(p, 'Damage', { value: damage || 5 }); // Use parameter or default 5 for player 100HP baseline
    this.world.addComponent(p, 'Lifetime', { remaining: 3.0 });
  }

  // Rendering
  render(renderer, cam) {
    if (!this.active) return;

    const ctx = renderer.ctx;

    // Render warnings
    for (const w of this.warningData) {
      ctx.save();

      const sx = w.x - cam.offsetX;
      const sy = w.y - cam.offsetY;
      const pulse = 0.5 + Math.sin(this.timer * 8) * 0.3;

      ctx.globalAlpha = pulse * w.alpha;

      switch (w.type) {
        case 'sector':
          ctx.fillStyle = w.color;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.arc(sx, sy, w.radius, w.angle - w.arc / 2, w.angle + w.arc / 2);
          ctx.closePath();
          ctx.fill();
          break;

        case 'circle':
          ctx.strokeStyle = w.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(sx, sy, w.radius, 0, Math.PI * 2);
          ctx.stroke();
          break;

        case 'line':
          ctx.strokeStyle = w.color;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(sx, sy);
          ctx.lineTo(sx + Math.cos(w.angle) * w.length, sy + Math.sin(w.angle) * w.length);
          ctx.stroke();
          break;

        case 'zone':
          ctx.fillStyle = w.color;
          ctx.beginPath();
          ctx.arc(sx, sy, w.radius, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#ff0000';
          ctx.lineWidth = 2;
          ctx.stroke();
          break;

        case 'wave':
          // Safe zone
          ctx.fillStyle = '#00ff00';
          ctx.globalAlpha = 0.8;
          ctx.beginPath();
          ctx.arc(w.safeZone.x - cam.offsetX, w.safeZone.y - cam.offsetY, w.safeZone.radius, 0, Math.PI * 2);
          ctx.fill();

          // Wave preview
          ctx.globalAlpha = pulse * w.alpha;
          ctx.strokeStyle = w.color;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(sx, sy, w.radius, 0, Math.PI * 2);
          ctx.stroke();
          break;

        case 'laser':
          ctx.strokeStyle = w.color;
          ctx.lineWidth = 3;
          for (let i = 0; i < w.beamCount; i++) {
            const ang = w.angle + (Math.PI * 2 / w.beamCount) * i;
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.lineTo(sx + Math.cos(ang) * w.radius, sy + Math.sin(ang) * w.radius);
            ctx.stroke();
          }
          break;
      }

      ctx.restore();
    }

    // Render phase transition effects
    if (this.phaseTransitioning && this.phaseTransitionEffect) {
      ctx.save();

      const effect = this.phaseTransitionEffect;
      const alpha = this.phaseTransitionTimer / effect.duration;
      const bt = this.entity?.components.Transform;

      if (!bt) {
        ctx.restore();
        return;
      }

      const sx = bt.x - cam.offsetX;
      const sy = bt.y - cam.offsetY;

      if (effect.type === 'fog') {
        const radius = (effect.duration - this.phaseTransitionTimer) * 100;
        ctx.globalAlpha = alpha * 0.6;
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
      } else if (effect.type === 'bloodMoon') {
        // Screen overlay
        ctx.globalAlpha = alpha * 0.4;
        ctx.fillStyle = effect.overlayColor;
        ctx.fillRect(0, 0, renderer.logicalWidth, renderer.logicalHeight);

        // Blood moon
        ctx.globalAlpha = alpha;
        ctx.fillStyle = effect.moonColor;
        ctx.beginPath();
        ctx.arc(renderer.logicalWidth / 2, 30, 20, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }
}