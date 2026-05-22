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
    if (Math.random() < 0.3) {
      this.particles.push({
        x: Math.random() * this.LW,
        y: this.LH + 5,
        vy: -(30 + Math.random() * 40),
        life: 3 + Math.random() * 2,
        maxLife: 5,
        size: 1 + Math.random() * 2,
        color: Math.random() < 0.5 ? '#4ecdc4' : '#ff6b35',
      });
    }
    for (const p of this.particles) {
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(alpha) {
    const { renderer, LW, LH } = this;
    renderer.clear();
    renderer.drawRect(0, 0, LW, LH, '#1a1a2e');
    renderer.applyTransform();

    // Particles on buffer (pixel art style)
    for (const p of this.particles) {
      renderer.setAlpha(Math.max(0, p.life / p.maxLife) * 0.5);
      renderer.drawRect(p.x, p.y, p.size, p.size, p.color);
    }
    renderer.setAlpha(1);

    renderer.restoreTransform();
    renderer.present();

    // All text and buttons at native resolution
    renderer.beginOverlay();

    const bounce = Math.sin(this.tick * 2) * 3;
    renderer.drawTextO('五分钟地牢', LW / 2, LH * 0.22 + bounce, {
      color: '#ff6b35', size: 24, align: 'center', font: 'monospace', bold: true,
    });
    renderer.drawTextO('5-Minute Dungeon Rush', LW / 2, LH * 0.22 + 32, {
      color: '#4ecdc4', size: 11, align: 'center', font: 'monospace',
    });

    // Two mode buttons
    const btnW = 130, btnH = 40, gap = 16;
    const totalW = btnW * 2 + gap;
    const startX = (LW - totalW) / 2;
    const btnY = LH * 0.46;

    // Normal mode button
    const pulseN = 0.8 + Math.sin(this.tick * 3) * 0.2;
    renderer.setAlphaO(pulseN);
    renderer.drawRectO(startX, btnY, btnW, btnH, '#4ecdc4');
    renderer.setAlphaO(1);
    renderer.drawRectO(startX + 2, btnY + 2, btnW - 4, btnH - 4, '#1a1a2e');
    renderer.drawTextO('常规模式', startX + btnW / 2, btnY + 8, {
      color: '#4ecdc4', size: 14, align: 'center', font: 'monospace',
    });
    renderer.drawTextO('5分钟限时', startX + btnW / 2, btnY + 26, {
      color: '#4ecdc4', size: 10, align: 'center', font: 'monospace',
    });

    // Endless mode button
    const endX = startX + btnW + gap;
    const pulseE = 0.8 + Math.sin(this.tick * 3 + 1) * 0.2;
    renderer.setAlphaO(pulseE);
    renderer.drawRectO(endX, btnY, btnW, btnH, '#ff6b35');
    renderer.setAlphaO(1);
    renderer.drawRectO(endX + 2, btnY + 2, btnW - 4, btnH - 4, '#1a1a2e');
    renderer.drawTextO('无尽模式', endX + btnW / 2, btnY + 8, {
      color: '#ff6b35', size: 14, align: 'center', font: 'monospace',
    });
    renderer.drawTextO('死亡为止', endX + btnW / 2, btnY + 26, {
      color: '#ff6b35', size: 10, align: 'center', font: 'monospace',
    });

    this._normalBtn = { x: startX, y: btnY, w: btnW, h: btnH };
    this._endlessBtn = { x: endX, y: btnY, w: btnW, h: btnH };

    renderer.drawTextO('WASD / 鼠标拖动移动', LW / 2, LH * 0.68, {
      color: '#666', size: 10, align: 'center', font: 'monospace',
    });
    renderer.drawTextO('自动攻击最近敌人', LW / 2, LH * 0.68 + 16, {
      color: '#666', size: 10, align: 'center', font: 'monospace',
    });
    renderer.drawTextO('升级选择技能强化角色', LW / 2, LH * 0.68 + 32, {
      color: '#666', size: 10, align: 'center', font: 'monospace',
    });

    renderer.endOverlay();
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
