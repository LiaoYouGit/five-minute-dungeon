import { MathUtils } from '../../engine/MathUtils.js';
import { MiniBossController } from '../boss/MiniBossController.js';

const TYPE_META = {
  heal:     { color: '#2ecc71', idleColor: '#1a4a3a', label: '治疗援助',   icon: '🩹', warningDuration: 30, activeDuration: 25, cycleDuration: 90 },
  bomb:     { color: '#e74c3c', idleColor: '#4a1a1a', label: '武力援助',   icon: '💥', warningDuration: 30, activeDuration: 6,  cycleDuration: 100 },
  mission:  { color: '#f1c40f', idleColor: '#4a4020', label: '任务援助',   icon: '🎯', warningDuration: 30, activeDuration: 20, cycleDuration: 120 },
  miniboss: { color: '#9b59b6', idleColor: '#3a1a4a', label: '小Boss援助', icon: '👑', warningDuration: 30, activeDuration: 60, cycleDuration: 300 }, // longer cycle, mini boss spawns at 4min via separate trigger
};

export class SupplySystem {
  constructor(world, supplyPoints, deps) {
    this.world = world;
    this.deps = deps;  // { expSystem, particles, camera, audio, dmgNumbers, enemySpawnSystem, LW, LH }
    this.miniBosses = [];
    this.miniBossSpawned = false; // Track if 4-minute mini boss spawned
    this.points = supplyPoints.map((sp, idx) => ({
      ...sp,
      meta: TYPE_META[sp.type],
      state: 'idle',
      timer: 15 + idx * 15, // staggered initial warmup so they don't all fire at once
      progress: 0,
      missionSpawnTimer: 0,
      bombTimer: 0,
      miniBoss: null,
    }));
  }

  setGameTime(t) {
    this.deps.gameTime = t;
  }

  getActiveWarnings() {
    return this.points
      .filter(p => p.state === 'warning')
      .map(p => ({ label: p.meta.label, time: Math.ceil(p.timer), color: p.meta.color }));
  }

  // Spawn mini boss at specific position (called when gameTime >= 240)
  spawnMiniBossAt(x, y) {
    const hp = 400 + Math.floor((this.deps.gameTime || 240) / 60) * 100; // Adjusted for player 100HP baseline
    const mb = new MiniBossController(this.world, this.deps.LW, this.deps.LH);
    mb.spawn(x, y, hp, (dx, dy) => {
      // 大量经验奖励（150 EXP）
      if (this.deps.expSystem) {
        // 15个gem散落在Boss周围
        for (let i = 0; i < 15; i++) {
          const ang = (Math.PI * 2 / 15) * i + Math.random() * 0.3;
          const radius = 25 + Math.random() * 30;
          this.deps.expSystem.spawnGem(
            dx + Math.cos(ang) * radius,
            dy + Math.sin(ang) * radius,
            10, // value per gem
            1
          );
        }
      }
      if (this.deps.particles) {
        this.deps.particles.emit(dx, dy, 60, { colors: ['#9b59b6', '#fff', '#ffcc00', '#ff6b35'], speed: 220, life: 1.3 });
      }
      if (this.deps.audio) this.deps.audio.play('kill');
      if (this.deps.dmgNumbers) this.deps.dmgNumbers.add(dx, dy - 20, '+150 EXP', { color: '#ffd700', size: 18 });
    });
    this.miniBosses.push(mb);
    this.miniBossSpawned = true;
    if (this.deps.camera) this.deps.camera.shake(6, 0.5);
    if (this.deps.audio) this.deps.audio.play('levelup');
  }

  update(dt, player) {
    if (!player || !player.active) return;
    const pt = player.components.Transform;
    const ph = player.components.Health;

    // Check for 4-minute mini boss spawn
    const gameTime = this.deps.gameTime || 0;
    if (gameTime >= 240 && !this.miniBossSpawned && this.deps.LW && this.deps.LH) {
      // Spawn mini boss near player
      const spawnX = MathUtils.clamp(pt.x + (Math.random() - 0.5) * 100, 50, this.deps.LW - 50);
      const spawnY = MathUtils.clamp(pt.y + (Math.random() - 0.5) * 100, 50, this.deps.LH - 50);
      this.spawnMiniBossAt(spawnX, spawnY);
    }

    // update mini bosses
    for (let i = this.miniBosses.length - 1; i >= 0; i--) {
      const mb = this.miniBosses[i];
      mb.update(dt);
      if (!mb.active) this.miniBosses.splice(i, 1);
    }

    for (const p of this.points) {
      p.timer -= dt;
      switch (p.state) {
        case 'idle':
          if (p.timer <= 0) {
            p.state = 'warning';
            p.timer = p.meta.warningDuration;
          }
          break;
        case 'warning':
          if (p.timer <= 0) {
            this._activate(p);
          }
          break;
        case 'active':
          this._updateActive(p, dt, pt, ph);
          if (p.timer <= 0) {
            this._deactivate(p);
          }
          break;
        case 'cooldown':
          if (p.timer <= 0) {
            p.state = 'idle';
            p.timer = p.meta.cycleDuration - p.meta.warningDuration - p.meta.activeDuration;
          }
          break;
      }
    }
  }

  _activate(p) {
    p.state = 'active';
    p.timer = p.meta.activeDuration;
    p.progress = 0;
    p.missionSpawnTimer = 0;
    p.bombTimer = p.type === 'bomb' ? 4.0 : 0;
    p.leaveTimer = 0; // Timer for mission failure (离开区域计时)
    p.missionFailed = false; // Mission failure flag
    if (this.deps.camera) this.deps.camera.shake(3, 0.3);

    if (p.type === 'miniboss') {
      const hp = 150 + Math.floor((this.deps.gameTime || 0) / 30) * 40; // Adjusted for player 100HP baseline
      const mb = new MiniBossController(this.world, this.deps.LW, this.deps.LH);
      mb.spawn(p.x, p.y, hp, (dx, dy) => {
        // 大量经验奖励（96 EXP）
        if (this.deps.expSystem) {
          // 12个gem散落在援助点周围
          for (let i = 0; i < 12; i++) {
            const ang = (Math.PI * 2 / 12) * i + Math.random() * 0.3;
            const radius = 20 + Math.random() * 25;
            this.deps.expSystem.spawnGem(
              dx + Math.cos(ang) * radius,
              dy + Math.sin(ang) * radius,
              8, // value per gem
              1
            );
          }
        }
        if (this.deps.particles) {
          this.deps.particles.emit(dx, dy, 45, { colors: ['#9b59b6', '#fff', '#ffcc00'], speed: 180, life: 1.2 });
        }
        if (this.deps.dmgNumbers) this.deps.dmgNumbers.add(dx, dy - 15, '+96 EXP', { color: '#9b59b6', size: 16 });
        p.timer = 0; // end the supply event
      });
      this.miniBosses.push(mb);
      p.miniBoss = mb;
    }
  }

  _deactivate(p) {
    p.state = 'cooldown';
    p.timer = 3.0;
  }

  _updateActive(p, dt, pt, ph) {
    const dist = MathUtils.distance(pt, p);
    if (p.type === 'heal') {
      if (dist < 24 && ph.hp < ph.maxHp) {
        ph.hp = Math.min(ph.hp + 3, ph.maxHp);
        if (this.deps.particles) this.deps.particles.emit(pt.x, pt.y, 12, { colors: ['#2ecc71', '#fff'], speed: 100, life: 0.6 });
        if (this.deps.dmgNumbers) this.deps.dmgNumbers.add(pt.x, pt.y - 10, '+HP', { color: '#2ecc71', size: 10 });
        p.timer = 0;
      }
    } else if (p.type === 'bomb') {
      p.bombTimer -= dt;
      if (p.bombTimer <= 0) {
        this._detonateBomb(p);
        p.timer = 0;
      }
    } else if (p.type === 'mission') {
      if (dist < 40) {
        // Player in mission area
        p.leaveTimer = 0; // Reset leave timer when back in area
        p.missionFailed = false;

        if (!p.missionFailed) {
          p.progress += dt;
          if (p.progress >= 15) {
            // Success! - 大量经验奖励（100 EXP）
            if (this.deps.expSystem) {
              // 20个gem散落在区域周围
              for (let i = 0; i < 20; i++) {
                const ang = (Math.PI * 2 / 20) * i + Math.random() * 0.2;
                const radius = 30 + Math.random() * 20;
                this.deps.expSystem.spawnGem(
                  p.x + Math.cos(ang) * radius,
                  p.y + Math.sin(ang) * radius,
                  5, // value per gem
                  1
                );
              }
            }
            if (this.deps.particles) this.deps.particles.emit(p.x, p.y, 40, { colors: ['#f1c40f', '#fff', '#ffcc00'], speed: 150, life: 1.0 });
            if (this.deps.dmgNumbers) this.deps.dmgNumbers.add(p.x, p.y - 15, '+100 EXP', { color: '#f1c40f', size: 16 });
            p.timer = 0;
          }
        }
      } else {
        // Player left mission area
        p.leaveTimer += dt;

        if (p.leaveTimer >= 5.0 && !p.missionFailed) {
          // Mission failed - player left area for >5s
          p.missionFailed = true;
          p.progress = 0;
          p.leaveTimer = 0;

          // Visual feedback for failure
          if (this.deps.camera) this.deps.camera.shake(4, 0.4);
          if (this.deps.particles) {
            this.deps.particles.emit(p.x, p.y, 15, { colors: ['#e74c3c', '#ff0000'], speed: 80, life: 0.7 });
          }
          if (this.deps.dmgNumbers) {
            this.deps.dmgNumbers.add(p.x, p.y - 15, '任务失败', { color: '#e74c3c', size: 14 });
          }
        }
      }

      // spawn extra enemies near mission point (only if not failed)
      if (!p.missionFailed) {
        p.missionSpawnTimer -= dt;
        if (p.missionSpawnTimer <= 0 && this.deps.enemySpawnSystem) {
          p.missionSpawnTimer = 2.5;
          this.deps.enemySpawnSystem.spawnAt?.(p.x + MathUtils.randomRange(-60, 60), p.y + MathUtils.randomRange(-60, 60), this.deps.gameTime || 0);
        }
      }
    }
    // miniboss handled via onDeath callback
  }

  _detonateBomb(p) {
    if (this.deps.camera) this.deps.camera.shake(8, 0.6);
    if (this.deps.particles) {
      this.deps.particles.emit(p.x, p.y, 50, { colors: ['#e74c3c', '#ff8800', '#ffcc00', '#fff'], speed: 200, life: 1.2, sizeMax: 5 });
    }
    const enemies = this.world.query('Transform', 'EnemyTag', 'Health');
    for (const e of enemies) {
      if (!e.active) continue;
      const et = e.components.Transform;
      if (MathUtils.distance(et, p) < 80) {
        e.components.Health.hp -= 100; // Adjusted for player 100HP baseline (high damage AOE)
        if (this.deps.dmgNumbers) this.deps.dmgNumbers.add(et.x, et.y, 100, { color: '#ff6b35', size: 10 });
        if (e.components.Health.hp <= 0) {
          if (this.deps.expSystem) this.deps.expSystem.spawnGem(et.x, et.y, 1, 1);
          this.world.removeEntity(e.id);
        }
      }
    }
  }

  render(renderer, camera) {
    for (const p of this.points) {
      const sx = p.x - camera.offsetX;
      const sy = p.y - camera.offsetY;
      if (sx < -50 || sx > renderer.logicalWidth + 50 || sy < -50 || sy > renderer.logicalHeight + 50) continue;

      const meta = p.meta;
      const isActive = p.state === 'active';
      const isWarning = p.state === 'warning';

      // bomb warning area circle
      if (p.type === 'bomb' && isActive) {
        const pulse = 0.3 + Math.sin(p.bombTimer * 8) * 0.2;
        renderer.setAlpha(pulse);
        renderer.drawCircle(sx, sy, 80, '#e74c3c');
        renderer.setAlpha(1);
      }
      // mission area circle
      if (p.type === 'mission' && isActive) {
        // Area circle - red if player is leaving, yellow if in area
        const circleColor = p.leaveTimer > 0 ? '#e74c3c' : '#f1c40f';
        const circleAlpha = p.leaveTimer > 0 ? 0.4 : 0.2;
        renderer.setAlpha(circleAlpha);
        renderer.drawCircle(sx, sy, 40, circleColor);
        renderer.setAlpha(1);

        // Progress bar (yellow)
        const bw = 40, bh = 4;
        renderer.drawRect(sx - bw / 2, sy - 28, bw, bh, '#222');
        if (!p.missionFailed) {
          renderer.drawRect(sx - bw / 2, sy - 28, bw * (p.progress / 15), bh, '#f1c40f');
        }

        // Leave timer warning (red countdown bar) - only show when player is outside
        if (p.leaveTimer > 0 && p.leaveTimer < 5.0) {
          const leaveBw = 40, leaveBh = 4;
          renderer.drawRect(sx - leaveBw / 2, sy - 20, leaveBw, leaveBh, '#222');
          renderer.drawRect(sx - leaveBw / 2, sy - 20, leaveBw * (p.leaveTimer / 5.0), leaveBh, '#e74c3c');

          // Warning text above progress bar
          const timeLeft = Math.ceil(5.0 - p.leaveTimer);
          renderer.drawText(`离开区域 ${timeLeft}s`, sx - 30, sy - 35, { color: '#e74c3c', size: 8 });
        }

        // Mission failed text
        if (p.missionFailed) {
          renderer.drawText('任务失败', sx - 20, sy - 35, { color: '#e74c3c', size: 10 });
        }
      }

      // pad base
      const color = isActive ? meta.color : (isWarning ? meta.color : meta.idleColor);
      const padAlpha = isActive ? 1.0 : (isWarning ? 0.7 : 0.5);
      renderer.setAlpha(padAlpha);
      renderer.drawCircle(sx, sy, 14, color);
      renderer.setAlpha(1);
      renderer.drawCircle(sx, sy, 9, '#0d0d1a');
      renderer.setAlpha(padAlpha);
      renderer.drawCircle(sx, sy, 7, color);
      renderer.setAlpha(1);

      // warning pulse ring
      if (isWarning) {
        const pulse = 0.4 + Math.sin(p.timer * 4) * 0.3;
        renderer.setAlpha(pulse);
        renderer.drawCircle(sx, sy, 18, color);
        renderer.setAlpha(1);
      }
    }

    // Render mini bosses (charge warnings, fire patches, etc.)
    for (const mb of this.miniBosses) {
      mb.render(renderer, camera);
    }
  }
}
