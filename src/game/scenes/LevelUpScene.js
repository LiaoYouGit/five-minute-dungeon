export class LevelUpScene {
  constructor(renderer, audio) {
    this.renderer = renderer;
    this.audio = audio;
    this.LW = renderer.logicalWidth;
    this.LH = renderer.logicalHeight;
    this.choices = [];
    this.level = 1;
    this.onSelect = null;
    this._cards = [];
    this._dismissed = false;
    this._timer = 0;
    this._phase = 'in'; // 'in' | 'idle' | 'out'
    this._selectedCard = null;
  }

  onEnter(data) {
    this.choices = data.choices;
    this.level = data.level;
    this.onSelect = data.onSelect;
    this.onPop = data.onPop;
    this.skillMgr = data.skillMgr;
    this._dismissed = false;
    this._timer = 0;
    this._phase = 'in';
    this._selectedCard = null;

    const { LW, LH } = this;
    const cardW = LW * 0.85, gap = 8, baseCardH = 44;
    const cardsInfo = this.choices.map((c) => {
      const lines = this._wrapText(c.desc, cardW - 16, 7);
      const h = Math.max(baseCardH, 20 + lines.length * 10 + 8);
      return { lines, h };
    });
    const cardH = Math.max(...cardsInfo.map(ci => ci.h));
    const totalH = this.choices.length * cardH + (this.choices.length - 1) * gap;
    const startX = (LW - cardW) / 2;
    const startY = LH * 0.3 + (LH * 0.4 - totalH) / 2;
    this._cards = this.choices.map((c, i) => ({
      x: startX,
      y: startY + i * (cardH + gap),
      w: cardW,
      h: cardH,
      skill: c,
      _descLines: cardsInfo[i].lines,
      _stack: this.skillMgr ? this.skillMgr.getStackCount(c.id) : 0,
      _delay: i * 0.08, // stagger per card
    }));
  }

  update(dt) {
    this._timer += dt;
    if (this._phase === 'in') {
      const maxDelay = this._cards.length > 0 ? this._cards[this._cards.length - 1]._delay : 0;
      if (this._timer > maxDelay + 0.35) this._phase = 'idle';
    }
    if (this._phase === 'out' && this._timer > 0.35) {
      this.onPop?.();
    }
  }

  /** Ease-out-back for enter, ease-in for exit */
  _cardProgress(card) {
    const dur = 0.3;
    if (this._phase === 'in') {
      const raw = Math.max(0, Math.min(1, (this._timer - card._delay) / dur));
      // ease-out-back
      const t = raw - 1;
      return t * t * ((1.7 + 1) * t + 1.7) + 1;
    }
    if (this._phase === 'out') {
      const raw = Math.max(0, Math.min(1, this._timer / dur));
      // which card was selected — it stays, others fade
      if (this._selectedCard && card === this._selectedCard) return 1;
      return 1 - raw;
    }
    return 1; // idle
  }

  _bgAlpha() {
    const dur = 0.25;
    if (this._phase === 'in') return Math.min(1, this._timer / dur) * 0.7;
    if (this._phase === 'out') return Math.max(0, 1 - this._timer / dur) * 0.7;
    return 0.7;
  }

  render(alpha) {
    const { renderer, LW, LH } = this;

    renderer.applyTransform();

    // Dark backdrop
    renderer.setAlpha(this._bgAlpha());
    renderer.drawRect(0, 0, LW, LH, '#000');
    renderer.setAlpha(1);

    // Title (fade in)
    const titleAlpha = this._phase === 'in' ? Math.min(1, this._timer / 0.3) : (this._phase === 'out' ? Math.max(0, 1 - this._timer / 0.2) : 1);
    renderer.setAlpha(titleAlpha);
    renderer.drawText('LEVEL UP!', LW / 2, LH * 0.18, {
      color: '#ffcc00', size: 20, align: 'center',
    });
    renderer.drawText(`Lv.${this.level}`, LW / 2, LH * 0.18 + 26, {
      color: '#4ecdc4', size: 11, align: 'center',
    });
    renderer.setAlpha(1);

    // Skill cards
    for (const card of this._cards) {
      const p = this._cardProgress(card);
      if (p <= 0) continue;

      const isSelected = this._selectedCard && card === this._selectedCard;
      const scale = isSelected ? 1 + (this._timer / 0.35) * 0.08 : 1;
      const offsetY = isSelected ? 0 : (1 - p) * 30;

      const cx = card.x + card.w / 2;
      const cy = card.y + card.h / 2;
      const dx = cx - (card.w * scale) / 2;
      const dy = cy - (card.h * scale) / 2 + offsetY;

      renderer.setAlpha(Math.min(1, p));

      // Card border
      renderer.drawRect(dx - 1, dy - 1, card.w * scale + 2, card.h * scale + 2, '#555');
      renderer.drawRect(dx, dy, card.w * scale, card.h * scale, '#2a2a3e');
      renderer.drawRect(dx + 1, dy + 1, card.w * scale - 2, card.h * scale - 2, '#1a1a2e');

      // Skill name
      renderer.drawText(card.skill.name, dx + 8, dy + 8, {
        color: '#fff', size: 10, align: 'left',
      });
      // Stack badge
      const stackText = card._stack > 0 ? `Lv.${card._stack + 1}` : 'NEW';
      const stackColor = card._stack > 0 ? '#ffcc00' : '#4ecdc4';
      renderer.drawRect(dx + card.w * scale - 28, dy + 4, 24, 12, stackColor);
      renderer.setAlpha(Math.min(1, p) * 0.3);
      renderer.drawRect(dx + card.w * scale - 28, dy + 4, 24, 12, '#000');
      renderer.setAlpha(Math.min(1, p));
      renderer.drawText(stackText, dx + card.w * scale - 16, dy + 5, {
        color: '#000', size: 7, align: 'center',
      });
      // Description
      for (let li = 0; li < card._descLines.length; li++) {
        renderer.drawText(card._descLines[li], dx + 8, dy + 22 + li * 10, {
          color: '#aaa', size: 7, align: 'left',
        });
      }

      renderer.setAlpha(1);
    }

    renderer.restoreTransform();
    renderer.present();
  }

  _wrapText(text, maxWidth, fontSize) {
    const ctx = this.renderer.ctx;
    ctx.font = `${fontSize}px monospace`;
    const lines = [];
    let line = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\n') { lines.push(line); line = ''; continue; }
      const test = line + ch;
      if (ctx.measureText(test).width > maxWidth && line.length > 0) {
        lines.push(line);
        line = ch;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  handleTap(lx, ly) {
    if (this._dismissed || this._phase !== 'idle') return false;
    for (const card of this._cards) {
      if (lx >= card.x && lx <= card.x + card.w && ly >= card.y && ly <= card.y + card.h) {
        this.audio.playClick();
        this._selectedCard = card;
        this._dismissed = true;
        this._phase = 'out';
        this._timer = 0;
        this.onSelect?.(card.skill);
        return true;
      }
    }
    return false;
  }
}
