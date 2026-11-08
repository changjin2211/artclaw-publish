const LOOP = 'exact';

const AVENUES = 20; // @dial 16..30 int
const CROSSINGS = 19; // @dial 16..29 int
const STOREYS = 4; // @dial 2..6 int
const FOOTPRINT = 0.78; // @dial 0.57..0.91
const RISE = 0.88; // @dial 0.68..1.24
const DRIFT = 0.17; // @dial 0.06..0.34

const PAPER = [0.7529, 0.6627, 0.7020]; // @color background
const INK = [0.0902, 0.3882, 0.5529]; // @color structure
const SEA = [0.3647, 0.4020, 0.6000]; // @color secondary
const CLAY = [0.4216, 0.5255, 0.6275]; // @color mid
const SUN = [0.6392, 0.4157, 0.6471]; // @color accent

let parcels = [];

function setup() {
  createCanvas(W, H);
  noLoop();
  let stepX = W / (AVENUES - 3);
  let stepY = H / (CROSSINGS - 3);
  for (let band = -CROSSINGS; band < CROSSINGS * 3; band++) {
    for (let lane = -AVENUES; lane < AVENUES * 3; lane++) {
      if ((band + 183) % 7 === 0 || grain(band * 71.83 + lane * 91.47) < 0.075) continue;
      let px = (lane + band * 0.43) * stepX - W * 0.23;
      let py = (band - lane * 0.38) * stepY - H * 0.29;
      if (px < -W * 0.13 || px > W * 1.13 || py < -W * 0.23 || py > H + W * 0.13) continue;
      let id = band * 137.73 + lane * 63.41;
      parcels.push({px, py, id, stepX, stepY, lane, band});
    }
  }
  parcels.sort((a, b) => a.py - b.py);
}

function grain(v) {
  let s = Math.sin(v * 81.713 + 19.271) * 43758.197;
  return s - Math.floor(s);
}

function pigment(c, a = 255) {
  fill(c[0] * 255, c[1] * 255, c[2] * 255, a);
}

function outline(c, weight) {
  stroke(c[0] * 255, c[1] * 255, c[2] * 255);
  strokeWeight(weight);
}

function pane(vertices) {
  beginShape();
  for (let p of vertices) vertex(p[0], p[1]);
  endShape(CLOSE);
}

function district(px, py) {
  let wave = Math.sin(px / W * 17.63 + py / H * 5.39) + 0.69 * Math.sin(px / W * 6.27 - py / H * 13.71);
  if (wave < -0.36) return SEA;
  if (wave < 0.94) return CLAY;
  return SUN;
}

function tower(site, phase) {
  let {px, py, id, stepX, stepY} = site;
  let jitter = grain(id + 7.31);
  let local = phase + grain(id + 2.73) * TWO_PI;
  let dx = W * DRIFT * 0.095 * Math.sin(local);
  let up = stepY * RISE * (2.25 + STOREYS * 0.31 + jitter * 0.91) * (1 + 0.075 * Math.cos(local));
  let tier = Math.max(2, Math.min(STOREYS + Math.floor(jitter * 2.7) - 1, 8));
  let spread = stepX * FOOTPRINT * (grain(id + 4.29) > 0.83 ? 1.34 : 1);
  let slope = stepY * 0.30;
  let X = px + dx, Y = py;
  let apex = [X, Y - up], east = [X + spread, Y - slope - up], west = [X - spread * 0.66, Y - slope * 0.77 - up];
  let base = [X, Y], eastBase = [X + spread, Y - slope], westBase = [X - spread * 0.66, Y - slope * 0.77];
  let districtColor = district(px, py);
  let thin = W * 0.0011;
  outline(INK, thin);
  pigment(INK);
  pane([west, apex, base, westBase]);
  pigment(districtColor);
  pane([apex, east, eastBase, base]);
  pigment(PAPER);
  pane([west, [X + spread * 0.25, Y - slope * 1.62 - up], east, apex]);
  noStroke();
  for (let floor = 0; floor < tier; floor++) {
    let v = (floor + 0.67) / (tier + 0.27);
    let width = grain(id + 8.37) > 0.81 ? 3 : 2;
    for (let windowIndex = 0; windowIndex < width; windowIndex++) {
      let u = (windowIndex + 0.65) / (width + 0.32);
      let wx = X + spread * u;
      let wy = Y - up * v - slope * u;
      let pw = spread / (width + 1.8);
      let ph = Math.min(up / (tier + 2.4) * 0.48, W * 0.009);
      pigment(grain(id + floor * 11.37 + windowIndex * 3.29) > 0.19 ? PAPER : INK);
      pane([[wx - pw * 0.5, wy - ph], [wx + pw * 0.5, wy - ph - slope * pw / spread],
        [wx + pw * 0.5, wy + ph - slope * pw / spread], [wx - pw * 0.5, wy + ph]]);
    }
  }
  if (grain(id + 13.57) > 0.87) {
    outline(PAPER, W * 0.0014);
    line(X - spread * 0.36, Y - up * 0.24, X - spread * 0.36, Y - up * 0.39);
  }
}

function draw() {
  clear();
  pigment(PAPER);
  background(PAPER[0] * 255, PAPER[1] * 255, PAPER[2] * 255);
  let phase = TWO_PI * (T % 1);
  outline(SUN, W * 0.00105);
  for (let k = -65; k < 105; k++) {
    let y = k * W * 0.024 + W * 0.003 * Math.sin(phase + k * 0.43);
    line(0, y, W, y - W * 0.36);
  }
  for (let site of parcels) tower(site, phase);
}
