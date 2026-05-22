import { Renderer } from './engine/Renderer.js';
import { InputManager } from './engine/InputManager.js';
import { GameLoop } from './engine/GameLoop.js';
import { AudioManager } from './engine/AudioManager.js';
import { ParticleSystem } from './engine/ParticleSystem.js';
import { SceneManager } from './game/scenes/SceneManager.js';
import { MenuScene } from './game/scenes/MenuScene.js';
import { GameScene } from './game/scenes/GameScene.js';
import { LevelUpScene } from './game/scenes/LevelUpScene.js';
import { ResultScene } from './game/scenes/ResultScene.js';

const canvas = document.getElementById('game');
const renderer = new Renderer(canvas);
const input = new InputManager();
const audio = new AudioManager();
const particles = new ParticleSystem();
const scenes = new SceneManager();

input.bind(canvas);

// --- Menu ---
let _loading = null;

const menuScene = new MenuScene(renderer, audio, (mode) => {
  audio.init();
  _loading = { mode, progress: 0, phase: 0, timer: 0 };
});
scenes.register('menu', menuScene);

// --- Game ---
const gameScene = new GameScene(renderer, input, audio, particles,
  (level, choices, onSelect) => {
    scenes.push('levelup', { level, choices, onSelect, skillMgr: gameScene.skillMgr, onPop: () => scenes.pop() });
  },
  (run) => {
    input.setEnabled(false);
    scenes.switchTo('result', { run });
  }
);
scenes.register('game', gameScene);

// --- Level Up ---
const levelUpScene = new LevelUpScene(renderer, audio);
scenes.register('levelup', levelUpScene);

// --- Result ---
const resultScene = new ResultScene(renderer, audio,
  () => { input.setEnabled(true); scenes.switchTo('game'); },
  () => { input.setEnabled(true); scenes.switchTo('menu'); },
);
scenes.register('result', resultScene);

scenes.push('menu');

// --- Unified touch handling ---
let _tapStart = null;
let _tapHandled = false;

function getLogicalPos(clientX, clientY) {
  return renderer.screenToLogical(clientX, clientY);
}

function handleSceneTap(lx, ly) {
  const name = scenes.getCurrentName();
  if (name === 'menu') return menuScene.handleTap(lx, ly);
  if (name === 'levelup') return levelUpScene.handleTap(lx, ly);
  if (name === 'result') return resultScene.handleTap(lx, ly);
  return false;
}

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  _tapStart = { x: touch.clientX, y: touch.clientY, time: Date.now() };
  _tapHandled = false;

  // Always feed to input manager for joystick
  input.handleTouchStart(touch);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  if (_tapStart) {
    const dx = touch.clientX - _tapStart.x;
    const dy = touch.clientY - _tapStart.y;
    // If finger moved more than 15px, it's a drag (joystick), not a tap
    if (Math.sqrt(dx * dx + dy * dy) > 15) _tapHandled = true;
  }
  input.handleTouchMove(touch);
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  input.handleTouchEnd();

  // If finger didn't move much, treat as tap
  if (!_tapHandled && _tapStart && Date.now() - _tapStart.time < 300) {
    const pos = getLogicalPos(_tapStart.x, _tapStart.y);
    handleSceneTap(pos.x, pos.y);
  }
  _tapStart = null;
}, { passive: false });

canvas.addEventListener('touchcancel', () => {
  input.handleTouchEnd();
  _tapStart = null;
}, { passive: false });

// Mouse for desktop — click+drag works as joystick
let _mouseDown = false;
let _mouseStart = null;
let _mouseHandled = false;

canvas.addEventListener('mousedown', (e) => {
  _mouseDown = true;
  _mouseHandled = false;
  _mouseStart = { x: e.clientX, y: e.clientY };
  // Feed to input manager as virtual touch
  input.handleTouchStart(e);
});

canvas.addEventListener('mousemove', (e) => {
  if (!_mouseDown) return;
  if (_mouseStart) {
    const dx = e.clientX - _mouseStart.x;
    const dy = e.clientY - _mouseStart.y;
    if (Math.sqrt(dx * dx + dy * dy) > 10) _mouseHandled = true;
  }
  input.handleTouchMove(e);
});

canvas.addEventListener('mouseup', (e) => {
  input.handleTouchEnd();
  if (!_mouseHandled && _mouseStart) {
    const pos = getLogicalPos(_mouseStart.x, _mouseStart.y);
    handleSceneTap(pos.x, pos.y);
  }
  _mouseDown = false;
  _mouseStart = null;
});

// --- Game Loop ---
const gameLoop = new GameLoop({
  update(dt) {
    input.snapshot();

    if (_loading) {
      _loading.timer += dt;
      if (_loading.phase === 0 && _loading.timer > 0.3) {
        _loading.phase = 1;
        _loading.progress = 0.3;
      }
      if (_loading.phase === 1 && _loading.timer > 0.5) {
        input.setEnabled(true);
        scenes.push('game', { mode: _loading.mode });
        _loading.phase = 2;
        _loading.progress = 0.7;
      }
      if (_loading.phase === 2 && _loading.timer > 0.9) {
        _loading.phase = 3;
        _loading.progress = 1;
      }
      if (_loading.phase === 3 && _loading.timer > 1.1) {
        _loading = null;
        return;
      }
      return;
    }

    scenes.update(dt);
  },
  render(alpha) {
    if (_loading) {
      renderLoading();
      return;
    }
    scenes.render(alpha);
    if (scenes.getCurrentName() === 'game') {
      renderer.applyTransform();
      renderer.drawText(`${Math.round(gameLoop.fps)}fps`, 10, renderer.logicalHeight - 16, {
        color: '#555', size: 8,
      });
      renderer.restoreTransform();
    }
    renderer.present();
  },
});

function renderLoading() {
  const LW = renderer.logicalWidth;
  const LH = renderer.logicalHeight;
  renderer.clear();
  renderer.applyTransform();
  renderer.drawRect(0, 0, LW, LH, '#0d0d1a');

  const steps = ['正在生成地牢...', '正在创建实体...', '准备就绪'];
  const stepIndex = Math.min(_loading.phase, steps.length - 1);

  renderer.drawText('LOADING', LW / 2, LH * 0.38, {
    color: '#4ecdc4', size: 18, align: 'center', font: 'monospace',
  });
  renderer.drawText(steps[stepIndex], LW / 2, LH * 0.38 + 28, {
    color: '#888', size: 9, align: 'center', font: 'monospace',
  });

  // Progress bar
  const barX = 60, barY = LH * 0.52, barW = LW - 120, barH = 14;
  renderer.drawRect(barX - 1, barY - 1, barW + 2, barH + 2, '#333');
  renderer.drawRect(barX, barY, barW, barH, '#1a1a2e');
  const fillW = barW * _loading.progress;
  renderer.drawRect(barX, barY, fillW, barH, '#4ecdc4');
  renderer.drawText(`${Math.floor(_loading.progress * 100)}%`, barX + barW / 2, barY + 2, {
    color: '#fff', size: 8, align: 'center', font: 'monospace',
  });

  // Decorative dots animation
  const tick = _loading.timer;
  for (let i = 0; i < 3; i++) {
    const alpha = (Math.sin(tick * 4 + i * 1.2) + 1) / 2 * 0.6;
    renderer.setAlpha(alpha);
    renderer.drawRect(LW / 2 - 12 + i * 12, LH * 0.62, 6, 6, '#4ecdc4');
  }
  renderer.setAlpha(1);

  renderer.restoreTransform();
  renderer.present();
}

gameLoop.start();