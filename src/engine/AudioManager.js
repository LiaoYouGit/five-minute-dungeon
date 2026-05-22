export class AudioManager {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.volume = 0.3;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this._initialized = true;
    } catch (e) {
      this.enabled = false;
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, duration, { type = 'square', vol = 1 } = {}) {
    if (!this.enabled || !this.ctx) return;
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    gain.gain.setValueAtTime(this.volume * vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  }

  playShoot() {
    this.playTone(800, 0.05, { type: 'square', vol: 0.4 });
  }

  playHit() {
    this.playTone(200, 0.1, { type: 'sawtooth', vol: 0.5 });
  }

  playKill() {
    this.playTone(600, 0.08, { type: 'square', vol: 0.3 });
    setTimeout(() => this.playTone(900, 0.06, { type: 'square', vol: 0.2 }), 40);
  }

  playPickup() {
    this.playTone(1200, 0.03, { type: 'sine', vol: 0.3 });
  }

  playLevelUp() {
    this.playTone(523, 0.1, { type: 'sine', vol: 0.4 });
    setTimeout(() => this.playTone(659, 0.1, { type: 'sine', vol: 0.4 }), 80);
    setTimeout(() => this.playTone(784, 0.15, { type: 'sine', vol: 0.5 }), 160);
  }

  playHurt() {
    this.playTone(100, 0.15, { type: 'sawtooth', vol: 0.6 });
  }

  playGameOver() {
    this.playTone(400, 0.2, { type: 'sawtooth', vol: 0.5 });
    setTimeout(() => this.playTone(300, 0.2, { type: 'sawtooth', vol: 0.4 }), 150);
    setTimeout(() => this.playTone(200, 0.3, { type: 'sawtooth', vol: 0.3 }), 300);
  }

  playClick() {
    this.playTone(1000, 0.03, { type: 'sine', vol: 0.2 });
  }
}
