const LOOP = 'exact';

// Continuous diagonal braids of alternating enamel leaves, not radial territories.
const BANDS = 10; // @dial 8..12 int [space]
const BEATS = 12; // @dial 10..15 int [space]
const LEAF_REACH = 0.08016; // @dial 0.065..0.096 [form]
const SLOPE = 0.24; // @dial 0.15..0.32 [form]
const WAVE = 0.018; // @dial 0.010..0.025 [motion]
const EYE_SIZE = 0.009; // @dial 0.007..0.012 [form]

const BACKGROUND = [1.0000, 0.8863, 0.1608]; // @color background
const STRUCTURE = [0.0510, 0.3098, 0.2784]; // @color structure
const ACCENT = [0.8863, 0.3843, 0.3686]; // @color accent
const SECONDARY = [0.1137, 0.7059, 0.6235]; // @color secondary
const MID = [0.5255, 0.5980, 0.2196]; // @color mid

let shifts = [];
function ink(c, a = 255) { return [c[0] * 255, c[1] * 255, c[2] * 255, a]; }
function setup() {
  createCanvas(W, H);
  noLoop();
  for (let r = -3; r <= BANDS + 3; r++) shifts.push({ phase: random(TWO_PI), drift: random(-0.13, 0.13) });
}
function axis(x, r, clock) {
  const s = shifts[r + 3];
  return (r + 0.5 + s.drift) * H / BANDS + SLOPE * (x - W * 0.5)
    + W * WAVE * sin(TWO_PI * (x / W * 1.45) + s.phase + clock);
}
function leaf(x, y, dir, len, tall, variant) {
  push();
  translate(x, y);
  // A narrow keel and offset shadow anchor every leaf to the braid.
  noStroke();
  fill(...ink(STRUCTURE, 236));
  beginShape();
  vertex(-len * 0.54, 0);
  bezierVertex(-len * 0.38, dir * tall * 0.44, len * 0.12, dir * tall * 1.16, len * 0.59, dir * tall * 0.66);
  bezierVertex(len * 0.32, dir * tall * 0.17, -len * 0.11, dir * tall * 0.04, -len * 0.54, 0);
  endShape(CLOSE);
  fill(...ink(variant ? ACCENT : SECONDARY, 241));
  beginShape();
  vertex(-len * 0.46, -dir * tall * 0.04);
  bezierVertex(-len * 0.20, dir * tall * 0.41, len * 0.19, dir * tall * 0.98, len * 0.52, dir * tall * 0.59);
  bezierVertex(len * 0.18, dir * tall * 0.29, -len * 0.17, dir * tall * 0.11, -len * 0.46, -dir * tall * 0.04);
  endShape(CLOSE);
  fill(...ink(MID, 227));
  beginShape();
  vertex(-len * 0.35, dir * tall * 0.04);
  bezierVertex(-len * 0.10, dir * tall * 0.27, len * 0.23, dir * tall * 0.67, len * 0.41, dir * tall * 0.59);
  bezierVertex(len * 0.07, dir * tall * 0.49, -len * 0.10, dir * tall * 0.20, -len * 0.35, dir * tall * 0.04);
  endShape(CLOSE);
  // A continuous double vein, with pearl apertures recessed into the enamel.
  noFill();
  stroke(...ink(STRUCTURE, 220));
  strokeWeight(W * 0.0020);
  bezier(-len * 0.39, 0, -len * 0.08, dir * tall * 0.20, len * 0.28, dir * tall * 0.69, len * 0.52, dir * tall * 0.59);
  stroke(...ink(BACKGROUND, 190));
  strokeWeight(W * 0.0013);
  bezier(-len * 0.19, dir * tall * 0.16, len * 0.06, dir * tall * 0.32, len * 0.25, dir * tall * 0.43, len * 0.41, dir * tall * 0.53);
  noStroke();
  for (let q = 0; q < 3; q++) {
    const u = -0.14 + q * 0.18;
    const v = dir * tall * (0.24 + q * 0.14);
    fill(...ink(BACKGROUND));
    circle(len * u, v, W * EYE_SIZE * (1 - q * 0.10));
    fill(...ink(ACCENT));
    circle(len * u, v, W * EYE_SIZE * (0.51 - q * 0.06));
  }
  pop();
}
function draw() {
  clear();
  background(...ink(BACKGROUND));
  const clock = TWO_PI * (T % 1);
  const pitch = W / BEATS;
  for (let r = -3; r <= BANDS + 3; r++) {
    // Broad uninterrupted under-ribbon makes the strands read as a woven field.
    noFill();
    stroke(...ink(SECONDARY, 142));
    strokeWeight(W * 0.015);
    beginShape();
    for (let i = -2; i <= 18; i++) {
      const x = i * W / 16;
      curveVertex(x, axis(x, r, clock));
    }
    endShape();
    stroke(...ink(STRUCTURE, 205));
    strokeWeight(W * 0.0030);
    beginShape();
    for (let i = -2; i <= 18; i++) {
      const x = i * W / 16;
      curveVertex(x, axis(x, r, clock));
    }
    endShape();
    for (let j = -2; j <= BEATS + 2; j++) {
      const x = (j + 0.5 * (r & 1)) * pitch;
      const y = axis(x, r, clock);
      const rise = sin(clock + shifts[r + 3].phase + j * 0.57) * W * 0.003;
      const len = pitch * (1.20 + 0.08 * sin(j * 2.1 + r));
      const tall = W * LEAF_REACH * (0.90 + 0.12 * sin(j * 1.9 + r * 0.8));
      leaf(x, y + rise, (j + r) % 2 ? 1 : -1, len, tall, (j + 2 * r) % 4 === 0);
    }
    // The central wire is drawn last: a continuous structural seam over every blade.
    noFill();
    stroke(...ink(STRUCTURE, 235));
    strokeWeight(W * 0.0026);
    beginShape();
    for (let i = -2; i <= 18; i++) {
      const x = i * W / 16;
      curveVertex(x, axis(x, r, clock));
    }
    endShape();
    stroke(...ink(ACCENT, 180));
    strokeWeight(W * 0.0013);
    beginShape();
    for (let i = -2; i <= 18; i++) {
      const x = i * W / 16;
      curveVertex(x, axis(x, r, clock) - W * 0.004);
    }
    endShape();
  }
}
