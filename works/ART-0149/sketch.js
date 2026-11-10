const LOOP = 'exact';

const FOLD_COUNT = 7; // @dial 4..11 int
const RIDGE_LIFT = 0.18; // @dial 0.08..0.33
const PANEL_CUT = 0.39; // @dial 0.27..0.55
const SLOPE_SWAY = 0.13; // @dial 0.035..0.18
const INK_DENSITY = 2300; // @dial 1200..3600 int

const PAPER = [0.5882, 0.8196, 0.6667]; // @color background
const EMBER = [0.3098, 0.2510, 0.5255]; // @color structure
const SUNLIT = [0.3230, 0.4870, 0.5520]; // @color mid
const PLUM = [0.5745, 0.4784, 0.3843]; // @color secondary
const SPARK = [0.8392, 0.7059, 0.2431]; // @color accent
const CROSSING = [0.5050, 0.4450, 0.4550]; // @color ochre-violet crossing
const SHADE = [0.2250, 0.3810, 0.4670]; // @color broad-face shade

function setup() {
  createCanvas(W, H);
  noLoop();
}

function ridgeAt(x, level, phase) {
  const q = x / W;
  // One continuous, softly rolling contour spans the full page.
  const roll = Math.sin(TWO_PI * (q * 1.12 + level * 0.075) + 0.38);
  const shoulder = 0.24 * Math.sin(TWO_PI * (q * 2.18 - level * 0.035) - 0.5);
  const slow = Math.sin(q * 4.1 + level * 1.74);
  const teeth = Math.sin(q * 24.7 + level * 3.6) * 0.009;
  const drift = Math.sin(phase + level * 0.95) * SLOPE_SWAY * (0.72 + 0.28 * level / Math.max(1, FOLD_COUNT - 1));
  const diagonal = (q - PANEL_CUT) * 0.075;
  return H * (0.14 + level * (0.72 / FOLD_COUNT) +
    RIDGE_LIFT * (0.52 * (roll + shoulder) + 0.14 * slow) + teeth + diagonal + drift);
}

function bandTail(layer) {
  return H * 0.045;
}

function pigment(c, opacity) {
  fill(c[0] * 255, c[1] * 255, c[2] * 255, opacity);
}

function mountainTone(tone, layer) {
  const depth = layer / Math.max(1, FOLD_COUNT - 1);
  const fade = 0.53 * (1 - depth);
  const ink = 0.34 * depth;
  return tone.map((v, channel) => v * (1 - fade - ink) + PAPER[channel] * fade + SHADE[channel] * ink);
}

function draw() {
  const phase = TWO_PI * (T % 1);
  background(PAPER[0] * 255, PAPER[1] * 255, PAPER[2] * 255);
  noStroke();
  const left = W * 0.026;
  const right = W * 0.974;
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(left, H * 0.028, right - left, H * 0.944);
  drawingContext.clip();
  for (let layer = 0; layer < FOLD_COUNT; layer++) {
    const tone = layer % 3 === 0 ? SUNLIT : layer % 3 === 1 ? PLUM : EMBER;
    pigment(mountainTone(tone, layer), layer === FOLD_COUNT - 1 ? 255 : 118 + layer * 19);
    beginShape();
    for (let col = 0; col <= 160; col++) {
      const x = left + (right - left) * col / 160;
      vertex(x, ridgeAt(x, layer, phase));
    }
    for (let col = 160; col >= 0; col--) {
      const x = left + (right - left) * col / 160;
      vertex(x, layer === FOLD_COUNT - 1 ? H * 0.974 : Math.min(H, ridgeAt(x, layer + 1, phase) + bandTail(layer)));
    }
    endShape(CLOSE);
    if (layer === FOLD_COUNT - 1) {
      // The foreground ridge alone receives a full-height, chromatic face gradient.
      const crest = mountainTone(tone, layer).map((v, i) => v * 0.62 + PAPER[i] * 0.38);
      const foot = SHADE.map((v, i) => v * 0.64 + EMBER[i] * 0.36);
      for (let col = 0; col < 160; col++) {
        const x0 = left + (right - left) * col / 160;
        const x1 = left + (right - left) * (col + 1) / 160;
        const top0 = ridgeAt(x0, layer, phase);
        const top1 = ridgeAt(x1, layer, phase);
        for (let row = 0; row < 32; row++) {
          const a = row / 32;
          const b = (row + 1) / 32;
          const blend = Math.pow((row + 0.5) / 32, 0.85);
          pigment(crest.map((v, i) => v * (1 - blend) + foot[i] * blend), 255);
          beginShape();
          vertex(x0, top0 + (H * 0.974 - top0) * a);
          vertex(x1, top1 + (H * 0.974 - top1) * a);
          vertex(x1, top1 + (H * 0.974 - top1) * b);
          vertex(x0, top0 + (H * 0.974 - top0) * b);
          endShape(CLOSE);
        }
      }
    }
    if (layer % 3 === 0) {
      for (let col = 0; col < 160; col++) {
        const x0 = left + (right - left) * col / 160;
        const x1 = left + (right - left) * (col + 1) / 160;
        const xm = (x0 + x1) * 0.5;
        pigment(SHADE, 10 + 33 * (0.5 + 0.5 * Math.sin(TWO_PI * xm / W + layer * 0.8)));
        beginShape();
        vertex(x0, ridgeAt(x0, layer, phase));
        vertex(x1, ridgeAt(x1, layer, phase));
        vertex(x1, layer === FOLD_COUNT - 1 ? H * 0.974 : Math.min(H, ridgeAt(x1, layer + 1, phase) + bandTail(layer)));
        vertex(x0, layer === FOLD_COUNT - 1 ? H * 0.974 : Math.min(H, ridgeAt(x0, layer + 1, phase) + bandTail(layer)));
        endShape(CLOSE);
      }
    }
    if (layer >= 2 && layer % 3 === 2) {
      pigment(CROSSING, 104 + layer * 18);
      beginShape();
      for (let col = 0; col <= 160; col++) {
        const x = left + (right - left) * col / 160;
        vertex(x, ridgeAt(x, layer, phase));
      }
      for (let col = 160; col >= 0; col--) {
        const x = left + (right - left) * col / 160;
        const lower = Math.min(ridgeAt(x, layer + 1, phase) + bandTail(layer),
          ridgeAt(x, layer, phase) + H * 0.032);
        vertex(x, lower);
      }
      endShape(CLOSE);
    }
    const count = Math.floor(INK_DENSITY * 2 / FOLD_COUNT);
    for (let speck = 0; speck < count; speck++) {
      const seed = layer * 4879 + speck * 31;
      const u = (Math.sin(seed * 0.73) * 17353.19) % 1;
      const v = (Math.sin(seed * 1.43) * 27183.37) % 1;
      const x = left + (right - left) * Math.abs(u);
      const top = ridgeAt(x, layer, phase);
      const lower = ridgeAt(x, layer + 1, phase) + bandTail(layer);
      const y = top + Math.max(H * 0.028, lower - top) * Math.abs(v);
      const fleck = (speck % 9 === 0) ? SPARK : (speck % 2 ? EMBER : PLUM);
      stroke(fleck[0] * 255, fleck[1] * 255, fleck[2] * 255, 48);
      strokeWeight(W * (speck % 7 === 0 ? 0.0023 : 0.0011));
      line(x, y, x + W * 0.0017, y - W * 0.0011);
    }
    noStroke();
    if (layer === FOLD_COUNT - 1) {
      noFill();
      // Preserve the contour weight while removing its saturated violet hue.
      const outlineValue = EMBER[0] * 0.2126 + EMBER[1] * 0.7152 + EMBER[2] * 0.0722;
      const paperValue = PAPER[0] * 0.2126 + PAPER[1] * 0.7152 + PAPER[2] * 0.0722;
      const mutedOutline = outlineValue * 0.55 + paperValue * 0.45;
      stroke(mutedOutline * 255, mutedOutline * 255, mutedOutline * 255, 255);
      strokeWeight(W * 0.022);
      strokeJoin(ROUND);
      beginShape();
      for (let col = 0; col <= 160; col++) {
        const x = left + (right - left) * col / 160;
        vertex(x, ridgeAt(x, layer, phase));
      }
      endShape();
      noStroke();
    }
  }
  drawingContext.restore();
  noStroke();
  pigment(PAPER, 255);
  rect(0, 0, W, H * 0.026);
  rect(0, H * 0.974, W, H * 0.026);
  rect(0, 0, W * 0.024, H);
  rect(W * 0.976, 0, W * 0.024, H);
}
