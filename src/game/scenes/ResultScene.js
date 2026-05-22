export class ResultScene {
  constructor(renderer, audio, onRestart, onMenu) {
    this.renderer = renderer;
    this.audio = audio;
    this.onRestart = onRestart;
    this.onMenu = onMenu;
    this.LW = renderer.logicalWidth;
    this.LH = renderer.logicalHeight;
    this.run = null;
    this._restartBtn = null;
    this._menuBtn = null;
  }

  onEnter(data) {
    this.run = data.run;
    const btnW = 120, btnH = 32, gap = 12;
    const totalW = btnW * 2 + gap;
    const startX = (this.LW - totalW) / 2;
    const btnY = this.LH * 0.7;
    this._restartBtn = { x: startX, y: btnY, w: btnW, h: btnH };
    this._menuBtn = { x: startX + btnW + gap, y: btnY, w: btnW, h: btnH };
  }

  update() {}

  render() {
    const { renderer, LW, LH, run } = this;
    renderer.clear();
    renderer.drawRect(0, 0, LW, LH, '#1a1a2e');
    renderer.applyTransform();
    renderer.restoreTransform();
    renderer.present();

    // All text at native resolution
    renderer.beginOverlay();

    const isEndless = run.isEndless && run.isEndless();
    let title, titleColor;
    if (isEndless) {
      title = 'GAME OVER';
      titleColor = '#ff4444';
    } else {
      title = run.survived ? 'TIME UP!' : 'GAME OVER';
      titleColor = run.survived ? '#4ecdc4' : '#ff4444';
    }
    renderer.drawTextO(title, LW / 2, LH * 0.15, {
      color: titleColor, size: 22, align: 'center', bold: true,
    });

    if (isEndless) {
      renderer.drawTextO('无尽模式', LW / 2, LH * 0.15 + 28, {
        color: '#ff6b35', size: 12, align: 'center',
      });
    }

    const survived = `${Math.floor(run.gameTime / 60)}:${Math.floor(run.gameTime % 60).toString().padStart(2, '0')}`;
    const stats = [
      ['存活时间', survived],
      ['击杀数', `${run.kills}`],
      ['获得技能', `${run.skills.length}`],
      ['总分', `${run.score}`],
    ];

    stats.forEach(([label, value], i) => {
      const y = LH * 0.28 + i * 32;
      renderer.drawTextO(label, LW / 2 - 50, y, { color: '#888', size: 12, align: 'right' });
      renderer.drawTextO(value, LW / 2 + 50, y, { color: '#fff', size: 14, align: 'left' });
    });

    renderer.drawTextO('─'.repeat(16), LW / 2, LH * 0.28 + stats.length * 32, {
      color: '#333', size: 10, align: 'center',
    });

    renderer.drawTextO('TOTAL', LW / 2 - 50, LH * 0.28 + stats.length * 32 + 14, {
      color: '#888', size: 12, align: 'right',
    });
    renderer.drawTextO(`${run.score}`, LW / 2 + 50, LH * 0.28 + stats.length * 32 + 14, {
      color: '#ffcc00', size: 18, align: 'left', bold: true,
    });

    // Buttons
    const drawBtn = (btn, text, color) => {
      renderer.drawRectO(btn.x, btn.y, btn.w, btn.h, color);
      renderer.drawRectO(btn.x + 2, btn.y + 2, btn.w - 4, btn.h - 4, '#1a1a2e');
      renderer.drawTextO(text, btn.x + btn.w / 2, btn.y + 10, {
        color, size: 14, align: 'center',
      });
    };
    drawBtn(this._restartBtn, '再来一局', '#4ecdc4');
    drawBtn(this._menuBtn, '返回菜单', '#ff6b35');

    renderer.endOverlay();
  }

  handleTap(lx, ly) {
    const check = (btn) => btn && lx >= btn.x && lx <= btn.x + btn.w && ly >= btn.y && ly <= btn.y + btn.h;
    if (check(this._restartBtn)) {
      this.audio.playClick();
      this.onRestart();
      return true;
    }
    if (check(this._menuBtn)) {
      this.audio.playClick();
      this.onMenu();
      return true;
    }
    return false;
  }
}
