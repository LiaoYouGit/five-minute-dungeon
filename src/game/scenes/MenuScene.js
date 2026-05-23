export class MenuScene {
  constructor(renderer, audio, onStart) {
    this.renderer = renderer;
    this.audio = audio;
    this.onStart = onStart;
    this.particles = [];
    this.tick = 0;
    this.LW = renderer.logicalWidth;
    this.LH = renderer.logicalHeight;
    this._normalBtn = null;
    this._endlessBtn = null;
  }

  onEnter() {
    this.tick = 0;
    this.audio.init();
  }

  update(dt) {
    this.tick += dt;
    if (Math.random() < 0.08) {
      this.particles.push({
        x: Math.random() * this.LW,
        y: this.LH + 5,
        vx: (Math.random() - 0.5) * 20,
        vy: -(30 + Math.random() * 40),
        life: 1.5 + Math.random() * 1.5,
        maxLife: 3,
        size: 1 + Math.random() * 1.5,
        color: Math.random() < 0.5 ? '#4ecdc4' : '#ff6b35',
      });
    }
    for (const p of this.particles) {
      p.y += p.vy * dt;
      p.x += p.vx * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(alpha) {
    const { renderer, LW, LH } = this;
    renderer.clear();
    renderer.applyTransform();
    renderer.drawRect(0, 0, LW, LH, '#1a1a2e');

    for (const p of this.particles) {
      renderer.setAlpha(Math.max(0, p.life / p.maxLife) * 0.5);
      renderer.drawRect(p.x, p.y, p.size, p.size, p.color);
    }
    renderer.setAlpha(1);

    const bounce = Math.sin(this.tick * 2) * 3;
    renderer.drawText('地牢危机', LW / 2, LH * 0.22 + bounce, {
      color: '#ff6b35', size: 22, align: 'center', font: 'monospace',
    });
    renderer.drawText('Dungeon Crisis', LW / 2, LH * 0.22 + 30, {
      color: '#4ecdc4', size: 9, align: 'center', font: 'monospace',
    });

    // 按钮纵向排列
    const btnW = 130, btnH = 40, gap = 20;
    const startX = (LW - btnW) / 2; // 居中
    const btnY1 = LH * 0.42; // 第一个按钮起始位置

    // 快速游戏按钮（上）
    const pulseN = 0.8 + Math.sin(this.tick * 3) * 0.2;
    renderer.setAlpha(pulseN);
    renderer.drawRect(startX, btnY1, btnW, btnH, '#4ecdc4');
    renderer.setAlpha(1);
    renderer.drawRect(startX + 2, btnY1 + 2, btnW - 4, btnH - 4, '#1a1a2e');
    renderer.drawText('快速游戏', startX + btnW / 2, btnY1 + 8, {
      color: '#4ecdc4', size: 13, align: 'center', font: 'monospace',
    });
    renderer.drawText('12分钟限时', startX + btnW / 2, btnY1 + 24, {
      color: '#4ecdc480', size: 8, align: 'center', font: 'monospace',
    });

    // 无尽模式按钮（下）
    const btnY2 = btnY1 + btnH + gap;
    const pulseE = 0.8 + Math.sin(this.tick * 3 + 1) * 0.2;
    renderer.setAlpha(pulseE);
    renderer.drawRect(startX, btnY2, btnW, btnH, '#ff6b35');
    renderer.setAlpha(1);
    renderer.drawRect(startX + 2, btnY2 + 2, btnW - 4, btnH - 4, '#1a1a2e');
    renderer.drawText('无尽模式', startX + btnW / 2, btnY2 + 8, {
      color: '#ff6b35', size: 13, align: 'center', font: 'monospace',
    });
    renderer.drawText('死亡为止', startX + btnW / 2, btnY2 + 24, {
      color: '#ff6b3580', size: 8, align: 'center', font: 'monospace',
    });

    this._normalBtn = { x: startX, y: btnY1, w: btnW, h: btnH };
    this._endlessBtn = { x: startX, y: btnY2, w: btnW, h: btnH };

    renderer.drawText('WASD / 触屏拖动摇杆移动', LW / 2, LH * 0.68, {
      color: '#666', size: 8, align: 'center', font: 'monospace',
    });
    renderer.drawText('自动攻击最近敌人', LW / 2, LH * 0.68 + 14, {
      color: '#666', size: 8, align: 'center', font: 'monospace',
    });
    renderer.drawText('升级选择技能强化角色', LW / 2, LH * 0.68 + 28, {
      color: '#666', size: 8, align: 'center', font: 'monospace',
    });

    renderer.restoreTransform();
    renderer.present();
  }

  handleTap(logicalX, logicalY) {
    const check = (btn) => btn && logicalX >= btn.x && logicalX <= btn.x + btn.w && logicalY >= btn.y && logicalY <= btn.y + btn.h;
    if (check(this._normalBtn)) {
      this.audio.playClick();
      this.onStart('normal');
      return true;
    }
    if (check(this._endlessBtn)) {
      this.audio.playClick();
      this.onStart('endless');
      return true;
    }
    return false;
  }
}
