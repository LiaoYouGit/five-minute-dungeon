export const MathUtils = {
  distance(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
  },

  distanceSq(a, b) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return dx * dx + dy * dy;
  },

  normalize(v) {
    const len = Math.sqrt(v.x * v.x + v.y * v.y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: v.x / len, y: v.y / len };
  },

  lerp(a, b, t) {
    return a + (b - a) * t;
  },

  lerpVec(a, b, t) {
    return { x: MathUtils.lerp(a.x, b.x, t), y: MathUtils.lerp(a.y, b.y, t) };
  },

  clamp(v, min, max) {
    return v < min ? min : v > max ? max : v;
  },

  clampVec(v, minVal, maxVal) {
    return { x: MathUtils.clamp(v.x, minVal, maxVal), y: MathUtils.clamp(v.y, minVal, maxVal) };
  },

  randomRange(min, max) {
    return min + Math.random() * (max - min);
  },

  randomInt(min, max) {
    return Math.floor(MathUtils.randomRange(min, max + 1));
  },

  angleBetween(a, b) {
    return Math.atan2(b.y - a.y, b.x - a.x);
  },

  toRad(deg) {
    return deg * (Math.PI / 180);
  },

  toDeg(rad) {
    return rad * (180 / Math.PI);
  },

  pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  },

  circleRectOverlap(cx, cy, cr, rx, ry, rw, rh) {
    const closestX = MathUtils.clamp(cx, rx, rx + rw);
    const closestY = MathUtils.clamp(cy, ry, ry + rh);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy < cr * cr;
  },
};
