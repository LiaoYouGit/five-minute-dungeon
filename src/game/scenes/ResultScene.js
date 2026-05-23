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
    renderer.applyTransform();
    renderer.drawRect(0, 0, LW, LH, '#1a1a2e');

    const isEndless = run.isEndless && run.isEndless();
    let title, titleColor;
    if (isEndless) {
      title = 'GAME OVER';
      titleColor = '#ff4444';
    } else if (run.bossDefeated) {
      title = 'VICTORY!';
      titleColor = '#ffd700';
    } else {
      title = run.survived ? 'TIME UP!' : 'GAME OVER';
      titleColor = run.survived ? '#4ecdc4' : '#ff4444';
    }
    renderer.drawText(title, LW / 2, LH * 0.15, {
      color: titleColor, size: 20, align: 'center',
    });

    if (isEndless) {
      renderer.drawText('无尽模式', LW / 2, LH * 0.15 + 26, {
        color: '#ff6b35', size: 10, align: 'center',
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
      const y = LH * 0.28 + i * 30;
      renderer.drawText(label, LW / 2 - 50, y, { color: '#888', size: 10, align: 'right' });
      renderer.drawText(value, LW / 2 + 50, y, { color: '#fff', size: 12, align: 'left' });
    });

    renderer.drawText('─'.repeat(16), LW / 2, LH * 0.28 + stats.length * 30, {
      color: '#333', size: 8, align: 'center',
    });

    renderer.drawText('TOTAL', LW / 2 - 50, LH * 0.28 + stats.length * 30 + 12, {
      color: '#888', size: 10, align: 'right',
    });
    renderer.drawText(`${run.score}`, LW / 2 + 50, LH * 0.28 + stats.length * 30 + 12, {
      color: '#ffcc00', size: 16, align: 'left',
    });

    const drawBtn = (btn, text, color) => {
      renderer.drawRect(btn.x, btn.y, btn.w, btn.h, color);
      renderer.drawRect(btn.x + 2, btn.y + 2, btn.w - 4, btn.h - 4, '#1a1a2e');
      renderer.drawText(text, btn.x + btn.w / 2, btn.y + 10, {
        color, size: 12, align: 'center',
      });
    };
    drawBtn(this._restartBtn, '再来一局', '#4ecdc4');
    drawBtn(this._menuBtn, '返回菜单', '#ff6b35');

    renderer.restoreTransform();
    renderer.present();
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
