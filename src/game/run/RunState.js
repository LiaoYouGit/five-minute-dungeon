export const STAGE_DURATION = 180; // 180 seconds per stage (12 min / 4 stages)
export const TOTAL_DURATION = 720; // 12 minutes total
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
    return 1 + (this.currentStage - 1) * 1.5; // Stage 1: 1x, Stage 2: 2.5x, Stage 3: 4x, Stage 4: 5.5x
  }

  getStageCountMult() {
    return 1 + (this.currentStage - 1) * 0.2; // Stage 1: 1x, Stage 2: 1.2x, Stage 3: 1.4x, Stage 4: 1.6x
  }

  // Can elites spawn? (after first minute)
  canSpawnElite() {
    return this.gameTime >= 60;
  }

  // Should mini boss spawn? (at ~9 minutes)
  shouldSpawnMiniBoss() {
    return this.gameTime >= 540 && !this.miniBossSpawned;
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
