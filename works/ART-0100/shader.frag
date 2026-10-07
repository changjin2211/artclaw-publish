precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define PI 3.141592653589793

float hash11(float n) {
  return fract(sin(n * 127.1 + u_seed * 311.7) * 43758.5453123);
}

float hash21(vec2 p) {
  return fract(sin(dot(p + u_seed, vec2(127.1, 311.7))) * 43758.5453123);
}

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

float bayer4(vec2 p) {
  vec2 q = mod(floor(p), 4.0);
  float x = q.x;
  float y = q.y;
  float v = 0.0;
  if (y < 0.5) {
    if (x < 0.5) v = 0.0; else if (x < 1.5) v = 8.0; else if (x < 2.5) v = 2.0; else v = 10.0;
  } else if (y < 1.5) {
    if (x < 0.5) v = 12.0; else if (x < 1.5) v = 4.0; else if (x < 2.5) v = 14.0; else v = 6.0;
  } else if (y < 2.5) {
    if (x < 0.5) v = 3.0; else if (x < 1.5) v = 11.0; else if (x < 2.5) v = 1.0; else v = 9.0;
  } else {
    if (x < 0.5) v = 15.0; else if (x < 1.5) v = 7.0; else if (x < 2.5) v = 13.0; else v = 5.0;
  }
  return (v + 0.5) / 16.0;
}

vec2 wrapCell(vec2 c) {
  return mod(c + 64.0, 64.0);
}

float seedTile(vec2 c) {
  vec2 wc = wrapCell(c);
  float h = hash21(mod(wc, 8.0) + floor(wc / 8.0) * 13.17);
  float stripe = 0.5 + 0.5 * sin((wc.x * 0.72 + wc.y * 1.11) + u_seed * 6.28318);
  float diagonal = 0.5 + 0.5 * sin((wc.x - wc.y) * 0.53 + u_seed * 3.1);
  float threshold = 0.50 + 0.12 * (hash11(4.0) - 0.5);
  return step(threshold, h * 0.68 + stripe * 0.20 + diagonal * 0.12);
}

float neighborCount(vec2 c) {
  float n = 0.0;
  n += seedTile(c + vec2(-1.0, -1.0));
  n += seedTile(c + vec2( 0.0, -1.0));
  n += seedTile(c + vec2( 1.0, -1.0));
  n += seedTile(c + vec2(-1.0,  0.0));
  n += seedTile(c + vec2( 1.0,  0.0));
  n += seedTile(c + vec2(-1.0,  1.0));
  n += seedTile(c + vec2( 0.0,  1.0));
  n += seedTile(c + vec2( 1.0,  1.0));
  return n;
}

float caState(vec2 c, float gen, float gesturePressure) {
  float family = hash11(17.0);
  vec2 stepShift = vec2(mod(gen * (1.0 + step(0.5, family)), 8.0), mod(gen * (2.0 + step(family, 0.35)), 8.0));
  vec2 cc = c + stepShift;
  float alive0 = seedTile(cc);
  float count = neighborCount(cc);

  float birth = 1.0 - step(0.45, abs(count - (3.0 + step(0.67, family))));
  float surviveA = 1.0 - step(0.45, abs(count - 2.0));
  float surviveB = 1.0 - step(0.45, abs(count - 3.0));
  float surviveC = (1.0 - step(0.45, abs(count - 4.0))) * step(0.34, family) * (1.0 - step(0.67, family));
  float alive1 = max((1.0 - alive0) * birth, alive0 * max(max(surviveA, surviveB), surviveC));

  float waveBirth = smoothstep(0.22, 0.66, gesturePressure) * (1.0 - step(6.5, count));
  float gated = max(alive1, alive0 * smoothstep(0.06, 0.48, gesturePressure));
  gated = max(gated, waveBirth * step(1.0, count) * (1.0 - step(6.0, count)));
  gated = max(gated, smoothstep(0.34, 0.74, gesturePressure) * step(1.0, count) * (1.0 - step(6.5, count)) * 0.82);
  return clamp(gated, 0.0, 1.0);
}

float cellShape(vec2 f, float breathe) {
  vec2 q = abs(f - 0.5);
  float box = max(q.x, q.y);
  float radius = mix(0.100, 0.155, breathe);
  return 1.0 - smoothstep(radius, radius + 0.013, box);
}

vec3 palette(float tier, float teal, float ink, float dither) {
  vec3 paper = vec3(237.0, 234.0, 227.0) / 255.0;
  vec3 pale = vec3(188.0, 140.0, 116.0) / 255.0;
  vec3 mid = vec3(185.0, 138.0, 114.0) / 255.0;
  vec3 sienna = vec3(140.0, 74.0, 50.0) / 255.0;
  vec3 tealC = vec3(31.0, 122.0, 116.0) / 255.0;

  float q = floor(clamp(tier + (dither - 0.5) * 0.19, 0.0, 0.999) * 4.0) / 3.0;
  vec3 ramp = paper;
  ramp = mix(ramp, pale, smoothstep(0.02, 0.36, q));
  ramp = mix(ramp, mid, smoothstep(0.30, 0.70, q));
  ramp = mix(ramp, sienna, smoothstep(0.64, 1.00, q));
  ramp = mix(paper, ramp, ink);
  return mix(ramp, tealC, clamp(teal, 0.0, 1.0));
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / u_resolution.xy;
  vec2 p = (frag - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  float t = fract(u_time);
  float stepCount = 12.0;
  float gen = floor(t * stepCount);
  float sub = fract(t * stepCount);
  float breathe = 0.5 - 0.5 * cos(2.0 * PI * t);

  float gridN = 38.0;
  vec2 grid = uv * gridN;
  vec2 cell = floor(grid);
  vec2 f = fract(grid);

  vec2 gp = (cell + 0.5) / gridN;
  vec2 gestureCoord = rot(-0.58) * (gp - vec2(0.48, 0.50));
  float sweepCenter = mix(-0.82, 0.82, t);
  float wake = exp(-pow((gestureCoord.x - sweepCenter) / 0.20, 2.0));
  float tail = smoothstep(sweepCenter - 0.44, sweepCenter - 0.07, gestureCoord.x) * (1.0 - smoothstep(sweepCenter + 0.05, sweepCenter + 0.46, gestureCoord.x));
  float spine = exp(-pow(gestureCoord.y / 0.34, 2.0));
  float pathCore = exp(-pow(gestureCoord.y / 0.24, 2.0)) * smoothstep(-0.72, -0.46, gestureCoord.x) * (1.0 - smoothstep(0.46, 0.72, gestureCoord.x));
  float pathKnotA = exp(-pow((gestureCoord.x + 0.36) / 0.18, 2.0)) * exp(-pow((gestureCoord.y - 0.04) / 0.22, 2.0));
  float pathKnotB = exp(-pow((gestureCoord.x - 0.30) / 0.20, 2.0)) * exp(-pow((gestureCoord.y + 0.05) / 0.22, 2.0));
  float gesture = max(max(wake, tail * 0.70), max(pathCore * 0.60, max(pathKnotA, pathKnotB) * 0.50)) * spine;

  float current = caState(cell, gen, gesture);
  float nextv = caState(cell, mod(gen + 1.0, stepCount), gesture);
  float ramp = mix(current, nextv, smoothstep(0.18, 0.82, sub));

  float neighbors = neighborCount(cell + vec2(mod(gen, 8.0), mod(gen * 2.0, 8.0))) / 8.0;
  float phaseBand = 0.5 + 0.5 * sin(gp.x * 17.0 - gp.y * 11.0 + t * 2.0 * PI);
  float phaseLatch = smoothstep(0.18, 0.78, phaseBand);
  ramp *= max(smoothstep(0.20, 0.48, gesture), smoothstep(0.18, 0.40, neighbors));
  ramp *= mix(0.32, 1.48, phaseLatch);
  float cleanEdge = smoothstep(0.075, 0.165, uv.x) * smoothstep(0.075, 0.165, uv.y) * smoothstep(0.075, 0.165, 1.0 - uv.x) * smoothstep(0.075, 0.165, 1.0 - uv.y);
  ramp *= cleanEdge;
  float shell = cellShape(f, breathe);
  float tooth = 0.5 + 0.5 * sin((f.x + f.y) * PI * 2.0 + gen * 0.71);
  float body = shell * ramp;
  float tier = body * (0.60 + 0.36 * neighbors + 0.42 * gesture) + tooth * body * 0.08;
  float systemSupport = max(smoothstep(0.20, 0.58, gesture), phaseLatch * 0.70);
  tier *= mix(0.46, 1.0, systemSupport);

  // Keep paper gutters open between cells so the repeated CA units remain legible;
  // printed-grid evidence is carried by cell quantization, not by connected outlines.
  float ink = clamp(body, 0.0, 1.0);

  float ignition = smoothstep(0.70, 0.94, gesture) * smoothstep(0.56, 0.88, ramp) * smoothstep(0.28, 0.74, neighbors);
  float tealGate = step(0.74, ramp) * step(0.36, neighbors) * step(0.76, gesture);
  float teal = ignition * tealGate * shell * (0.34 + 0.34 * breathe);

  float edgeFade = smoothstep(0.00, 0.065, uv.x) * smoothstep(0.00, 0.065, uv.y) * smoothstep(0.00, 0.065, 1.0 - uv.x) * smoothstep(0.00, 0.065, 1.0 - uv.y);
  vec3 col = palette(tier, teal, ink * edgeFade, bayer4(frag + gen + u_seed * 17.0));
  gl_FragColor = vec4(col, 1.0);
}
