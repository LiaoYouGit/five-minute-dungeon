import { CHARACTERS, getAvailableCharacters } from '../data/characters.js';

export class CharacterSelectionScene {
  constructor(renderer, audio, onCharacterSelected) {
    this.renderer = renderer;
    this.audio = audio;
    this.onCharacterSelected = onCharacterSelected;
    this.particles = [];
    this.tick = 0;
    this.LW = renderer.logicalWidth;
    this.LH = renderer.logicalHeight;
    this.selectedCharacter = null;
    this.characterButtons = [];
    this._backBtn = null;
  }

  onEnter() {
    this.tick = 0;
    this.selectedCharacter = 'archer'; // 默认选中射手（唯一可选）
    this.audio.init();
  }

  update(dt) {
    this.tick += dt;

    // 背景粒子效果
    if (Math.random() < 0.05) {
      this.particles.push({
        x: Math.random() * this.LW,
        y: Math.random() * this.LH,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1.5 + Math.random() * 1.5,
        maxLife: 3,
        size: 1 + Math.random() * 1.5,
        color: Math.random() < 0.5 ? '#4ecdc4' : '#ff6b35',
      });
    }

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);
  }

  render(alpha) {
    const { renderer, LW, LH } = this;
    renderer.clear();
    renderer.applyTransform();
    renderer.drawRect(0, 0, LW, LH, '#1a1a2e');

    // 背景粒子
    for (const p of this.particles) {
      renderer.setAlpha(Math.max(0, p.life / p.maxLife) * 0.3);
      renderer.drawRect(p.x, p.y, p.size, p.size, p.color);
    }
    renderer.setAlpha(1);

    // 标题
    const bounce = Math.sin(this.tick * 2) * 2;
    renderer.drawText('选择角色', LW / 2, LH * 0.12 + bounce, {
      color: '#ffcc00',
      size: 20,
      align: 'center',
      font: 'monospace',
    });
    renderer.drawText('Choose Your Character', LW / 2, LH * 0.12 + 28, {
      color: '#888',
      size: 8,
      align: 'center',
      font: 'monospace',
    });

    // 角色卡片（2x2网格）
    const characters = Object.values(CHARACTERS);
    const cardW = 140;
    const cardH = 90;
    const gap = 15;

    // 计算网格布局（居中）
    const cols = 2;
    const rows = 2;
    const totalW = cols * cardW + (cols - 1) * gap;
    const totalH = rows * cardH + (rows - 1) * gap;
    const startX = (LW - totalW) / 2;
    const startY = LH * 0.25;

    this.characterButtons = [];

    characters.forEach((char, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = startX + col * (cardW + gap);
      const y = startY + row * (cardH + gap);

      // 保存按钮位置
      this.characterButtons.push({
        id: char.id,
        x,
        y,
        w: cardW,
        h: cardH,
      });

      // 卡片背景
      const isSelected = this.selectedCharacter === char.id;
      const isAvailable = char.available;

      // 选中/不可选边框颜色
      let borderColor = char.color;
      if (isSelected) {
        borderColor = '#ffcc00';
      } else if (!isAvailable) {
        borderColor = '#555';
      }

      // 选中脉冲效果
      const pulse = isSelected ? 0.8 + Math.sin(this.tick * 4) * 0.2 : 0.7;
      renderer.setAlpha(pulse);
      renderer.drawRect(x, y, cardW, cardH, borderColor);

      // 卡片内部背景
      renderer.setAlpha(1);
      const bgColor = isAvailable ? '#1a1a2e' : '#0d0d1a';
      renderer.drawRect(x + 2, y + 2, cardW - 4, cardH - 4, bgColor);

      // 角色图标和名称
      const iconY = y + 15;
      renderer.drawText(char.icon, x + cardW / 2, iconY, {
        color: isAvailable ? char.color : '#666',
        size: 18,
        align: 'center',
        font: 'monospace',
      });

      renderer.drawText(char.name, x + cardW / 2, iconY + 22, {
        color: isAvailable ? char.color : '#666',
        size: 12,
        align: 'center',
        font: 'monospace',
      });

      renderer.drawText(char.nameEn, x + cardW / 2, iconY + 36, {
        color: isAvailable ? '#888' : '#444',
        size: 7,
        align: 'center',
        font: 'monospace',
      });

      // 可选/不可选标记
      if (!isAvailable) {
        renderer.drawText('待开放', x + cardW / 2, iconY + 52, {
          color: '#ff4444',
          size: 8,
          align: 'center',
          font: 'monospace',
        });
      } else if (isSelected) {
        renderer.drawText('已选中', x + cardW / 2, iconY + 52, {
          color: '#ffcc00',
          size: 8,
          align: 'center',
          font: 'monospace',
        });
      }

      // 角色描述（可选）
      if (isAvailable) {
        renderer.drawText(char.desc, x + cardW / 2, y + cardH - 8, {
          color: '#666',
          size: 6,
          align: 'center',
          font: 'monospace',
        });
      }
    });

    // 确认按钮（底部）
    const confirmBtnW = 130;
    const confirmBtnH = 40;
    const confirmBtnX = (LW - confirmBtnW) / 2;
    const confirmBtnY = startY + totalH + 30;

    const confirmPulse = 0.8 + Math.sin(this.tick * 3) * 0.2;
    renderer.setAlpha(confirmPulse);
    renderer.drawRect(confirmBtnX, confirmBtnY, confirmBtnW, confirmBtnH, '#ffcc00');
    renderer.setAlpha(1);
    renderer.drawRect(confirmBtnX + 2, confirmBtnY + 2, confirmBtnW - 4, confirmBtnH - 4, '#1a1a2e');
    renderer.drawText('确认出战', confirmBtnX + confirmBtnW / 2, confirmBtnY + 12, {
      color: '#ffcc00',
      size: 12,
      align: 'center',
      font: 'monospace',
    });

    this._confirmBtn = { x: confirmBtnX, y: confirmBtnY, w: confirmBtnW, h: confirmBtnH };

    // 返回按钮
    const backBtnW = 80;
    const backBtnH = 30;
    const backBtnX = LW / 2 - backBtnW / 2;
    const backBtnY = LH * 0.92;

    renderer.setAlpha(0.7);
    renderer.drawRect(backBtnX, backBtnY, backBtnW, backBtnH, '#888');
    renderer.setAlpha(1);
    renderer.drawRect(backBtnX + 2, backBtnY + 2, backBtnW - 4, backBtnH - 4, '#1a1a2e');
    renderer.drawText('返回', backBtnX + backBtnW / 2, backBtnY + 10, {
      color: '#888',
      size: 10,
      align: 'center',
      font: 'monospace',
    });

    this._backBtn = { x: backBtnX, y: backBtnY, w: backBtnW, h: backBtnH };

    // 提示文字
    renderer.drawText('选择角色将获得独特的初始属性和技能羁绊', LW / 2, LH * 0.88, {
      color: '#666',
      size: 7,
      align: 'center',
      font: 'monospace',
    });

    renderer.restoreTransform();
    renderer.present();
  }

  handleTap(logicalX, logicalY) {
    // 检查角色卡片点击
    for (const btn of this.characterButtons) {
      if (logicalX >= btn.x && logicalX <= btn.x + btn.w && logicalY >= btn.y && logicalY <= btn.y + btn.h) {
        const character = CHARACTERS[btn.id];
        if (character && character.available) {
          this.selectedCharacter = btn.id;
          this.audio.playClick();
          return true;
        }
      }
    }

    // 检查确认按钮
    if (
      this._confirmBtn &&
      logicalX >= this._confirmBtn.x &&
      logicalX <= this._confirmBtn.x + this._confirmBtn.w &&
      logicalY >= this._confirmBtn.y &&
      logicalY <= this._confirmBtn.y + this._confirmBtn.h
    ) {
      if (this.selectedCharacter) {
        this.audio.playClick();
        this.onCharacterSelected(this.selectedCharacter);
        return true;
      }
    }

    // 检查返回按钮
    if (
      this._backBtn &&
      logicalX >= this._backBtn.x &&
      logicalX <= this._backBtn.x + this._backBtn.w &&
      logicalY >= this._backBtn.y &&
      logicalY <= this._backBtn.y + this._backBtn.h
    ) {
      this.audio.playClick();
      this.onCharacterSelected(null); // 返回菜单
      return true;
    }

    return false;
  }
}