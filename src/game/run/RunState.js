export class RunState {
  constructor() {
    this.reset();
  }

  reset() {
    this.mode = 'normal';
    this.timeRemaining = 300;
    this.score = 0;
    this.kills = 0;
    this.skills = [];
    this.gameTime = 0;
    this.survived = false;
    this.bossDefeated = false;
  }

  setMode(mode) {
    this.mode = mode;
    if (mode === 'endless') {
      this.timeRemaining = Infinity;
    }
  }

  isEndless() {
    return this.mode === 'endless';
  }

  addKill(score) {
    this.kills++;
    this.score += score;
  }

  addScore(amount) {
    this.score += amount;
  }

  addSkill(skill) {
    this.skills.push(skill);
  }
}
