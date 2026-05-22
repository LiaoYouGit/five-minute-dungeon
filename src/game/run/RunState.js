export const STAGE_DURATION = 120; // 2 minutes per stage
export const TOTAL_DURATION = 480; // 8 minutes total
export const STAGE_COUNT = 4;

export class RunState {
  constructor() {
    this.reset();
  }

  reset() {
    this.mode = 'normal';
    this.timeRemaining = TOTAL_DURATION;
    this.score = 0;
    this.kills = 0;
    this.skills = [];
    this.gameTime = 0;
    this.survived = false;
    this.bossDefeated = false;
    this.currentStage = 1;
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

  // Update stage based on gameTime (called each frame)
  updateStage() {
    const newStage = Math.min(STAGE_COUNT, Math.floor(this.gameTime / STAGE_DURATION) + 1);
    if (newStage !== this.currentStage) {
      this.currentStage = newStage;
    }
  }

  getStage() {
    return this.currentStage;
  }

  // Stage-based multipliers for difficulty scaling
  getStageHpMult() {
    return 1 + (this.currentStage - 1) * 0.5; // Stage 1: 1x, Stage 2: 1.5x, Stage 3: 2x, Stage 4: 2.5x
  }

  getStageCountMult() {
    return 1 + (this.currentStage - 1) * 0.3; // Stage 1: 1x, Stage 2: 1.3x, Stage 3: 1.6x, Stage 4: 1.9x
  }

  // Can elites spawn? (after first minute)
  canSpawnElite() {
    return this.gameTime >= 60;
  }

  // Should mini boss spawn? (at 4 minutes)
  shouldSpawnMiniBoss() {
    return this.gameTime >= 240 && !this.miniBossSpawned;
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
