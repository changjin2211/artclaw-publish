precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define TAU 6.28318530718

float hash11(float n) { return fract(sin(n * 127.1 + u_seed * 913.7) * 43758.5453123); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 719.3) * 43758.5453123); }
vec2 hash22(vec2 p) { return fract(sin(vec2(dot(p, vec2(269.5, 183.3)), dot(p, vec2(419.2, 371.9))) + u_seed * vec2(83.7, 191.1)) * 43758.5453123); }

vec3 bgCol() { return vec3(216.0, 222.0, 210.0) / 255.0; }
vec3 inkCol() { return vec3(37.0, 50.0, 56.0) / 255.0; }
vec3 umberCol() { return vec3(110.0, 91.0, 73.0) / 255.0; }
vec3 ochreCol() { return vec3(185.0, 130.0, 60.0) / 255.0; }

mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sdSegment(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a, ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-4), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 voronoiInfo(vec2 p, float breathe) {
  vec2 g = floor(p);
  float d1 = 99.0, d2 = 99.0, owner = 0.0;
  float w1 = 0.0;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 cell = g + vec2(float(i), float(j));
      vec2 jitter = (hash22(cell) - 0.5) * 0.56;
      vec2 site = cell + 0.5 + jitter;
      float weight = mix(-0.18, 0.22, hash21(cell + 17.0));
      weight += 0.06 * sin(dot(cell, vec2(0.73, 1.41)) + u_seed * TAU);
      float d = length(p - site) - weight * (1.0 + 0.11 * breathe);
      if (d < d1) { d2 = d1; d1 = d; owner = hash21(cell + 41.0); w1 = weight; }
      else if (d < d2) { d2 = d; }
    }
  }
  return vec3(d1, d2 - d1, owner + w1 * 0.31);
}

float chladni(vec2 q, float phase, float seedShift) {
  float m1 = 2.0 + floor(hash11(11.0) * 3.0);
  float n1 = 4.0 + floor(hash11(12.0) * 3.0);
  float m2 = 3.0 + floor(hash11(13.0) * 3.0);
  float n2 = 5.0 + floor(hash11(14.0) * 3.0);
  vec2 r = q * 3.14159265;
  float a = sin(m1 * r.x + 0.23 * phase) * sin(n1 * r.y - 0.17 * phase);
  float b = sin(n2 * r.x - 0.13 * phase + seedShift) * sin(m2 * r.y + 0.19 * phase);
  return 0.58 * a - 0.42 * b;
}

float scalarField(vec2 uv) {
  float tau = TAU * fract(u_time);
  float breathe = sin(tau);
  vec2 saddle = vec2(0.39 + 0.025 * (hash11(2.0) - 0.5), 0.42 + 0.025 * (hash11(3.0) - 0.5));
  vec2 rel = uv - saddle;
  float phaseGrad = 1.35 * rel.x - 0.98 * rel.y + 0.32 * sin(3.0 * rel.x + 1.2 * rel.y);
  vec2 q = saddle + rot(0.22 * phaseGrad + 0.035 * cos(tau)) * rel;
  vec2 gridP = vec2(q.x * 12.6 + 0.35, q.y * 12.6 - 0.15);
  vec3 v = voronoiInfo(gridP, breathe);
  float annex = 0.46 * (0.62 - smoothstep(0.03, 0.58, v.y)) + 0.13 * (v.z - 0.5);
  float ch = chladni(q + vec2(0.03 * sin(phaseGrad), -0.02 * cos(phaseGrad)), tau, u_seed * 3.7);
  float localPulse = 0.18 * sin(19.0 * q.x + 11.0 * q.y + 0.35 * cos(tau))
    + 0.12 * sin(15.0 * q.x - 17.0 * q.y + 0.30 * sin(tau));
  float edgeTaper = smoothstep(0.0, 0.04, uv.x) * smoothstep(0.0, 0.04, uv.y) * smoothstep(0.0, 0.04, 1.0 - uv.x) * smoothstep(0.0, 0.04, 1.0 - uv.y);
  return (0.31 * ch * (1.0 + 0.055 * breathe) + annex + 0.14 * phaseGrad + localPulse) * edgeTaper - 0.06 * (1.0 - edgeTaper);
}

float interp(float a, float b, float level) { return clamp((level - a) / max(abs(b - a), 1e-5), 0.0, 1.0); }

float caseLineDistance(vec2 f, float v00, float v10, float v01, float v11, float level) {
  int c = 0;
  if (v00 > level) c += 1;
  if (v10 > level) c += 2;
  if (v11 > level) c += 4;
  if (v01 > level) c += 8;
  vec2 e0 = vec2(interp(v00, v10, level), 0.0);
  vec2 e1 = vec2(1.0, interp(v10, v11, level));
  vec2 e2 = vec2(interp(v01, v11, level), 1.0);
  vec2 e3 = vec2(0.0, interp(v00, v01, level));
  float d = 9.0;
  if (c == 1 || c == 14) d = min(d, sdSegment(f, e3, e0));
  else if (c == 2 || c == 13) d = min(d, sdSegment(f, e0, e1));
  else if (c == 3 || c == 12) d = min(d, sdSegment(f, e3, e1));
  else if (c == 4 || c == 11) d = min(d, sdSegment(f, e1, e2));
  else if (c == 5) { d = min(d, sdSegment(f, e3, e2)); d = min(d, sdSegment(f, e0, e1)); }
  else if (c == 6 || c == 9) d = min(d, sdSegment(f, e0, e2));
  else if (c == 7 || c == 8) d = min(d, sdSegment(f, e3, e2));
  else if (c == 10) { d = min(d, sdSegment(f, e3, e0)); d = min(d, sdSegment(f, e1, e2)); }
  return d;
}

float contourMap(vec2 uv, out float major) {
  float cells = 46.0;
  vec2 p = uv * cells;
  vec2 g = floor(p);
  vec2 f = fract(p);
  vec2 inv = 1.0 / vec2(cells);
  vec2 base = g * inv;
  float v00 = scalarField(base);
  float v10 = scalarField(base + vec2(inv.x, 0.0));
  float v01 = scalarField(base + vec2(0.0, inv.y));
  float v11 = scalarField(base + inv);
  float tau = TAU * fract(u_time);
  float breath = 0.026 * sin(tau);
  float d = 9.0;
  major = 9.0;
  for (int k = 0; k < 7; k++) {
    float level = -0.54 + float(k) * 0.18 + breath * (0.5 - abs(float(k) - 3.0) / 6.0);
    float cd = caseLineDistance(f, v00, v10, v01, v11, level);
    d = min(d, cd);
    if (k == 1 || k == 3 || k == 5) major = min(major, cd);
  }
  return d;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = frag / u_resolution.xy;
  uv.x = (uv.x - 0.5) * (u_resolution.x / u_resolution.y) + 0.5;
  float field = scalarField(uv);
  float majorD;
  float d = contourMap(uv, majorD);

  vec3 color = bgCol();

  vec2 markCell = floor(uv * 22.0);
  vec2 markLocal = fract(uv * 22.0);
  float markRand = hash21(markCell + 29.0);
  float horizontal = step(0.5, markRand);
  float hMark = (1.0 - smoothstep(0.035, 0.105, abs(markLocal.y - (0.22 + 0.56 * hash21(markCell + 3.0)))))
    * step(0.14, markLocal.x) * step(markLocal.x, 0.72);
  float vMark = (1.0 - smoothstep(0.035, 0.105, abs(markLocal.x - (0.24 + 0.52 * hash21(markCell + 4.0)))))
    * step(0.16, markLocal.y) * step(markLocal.y, 0.74);
  float umberMark = mix(vMark, hMark, horizontal) * step(0.18, hash21(markCell + floor(field * 5.0))) * step(-0.42, field) * step(field, 0.58);
  if (umberMark > 0.54) color = umberCol();

  float thin = 1.0 - smoothstep(0.014, 0.038, d);
  float majorLine = 1.0 - smoothstep(0.026, 0.058, majorD);
  vec2 contourCell = floor(uv * 46.0);
  vec2 contourLocal = fract(uv * 46.0);
  float dash = step(0.28, fract(uv.x * 31.0 + uv.y * 23.0 + hash21(contourCell)));
  float shortWindow = step(0.08, contourLocal.x) * step(contourLocal.x, 0.88) * step(0.08, contourLocal.y) * step(contourLocal.y, 0.88);
  float structuralWindow = step(0.015, abs(field) + 0.11 * hash21(contourCell + 7.0));
  if ((majorLine > 0.55 || thin > 0.62) && dash > 0.5 && shortWindow > 0.5 && structuralWindow > 0.5) color = inkCol();

  vec2 gridP = uv * vec2(12.6) + vec2(0.35, -0.15);
  vec3 v = voronoiInfo(gridP, sin(TAU * u_time));
  float node = 1.0 - smoothstep(0.030, 0.092, abs(chladni(uv, TAU * u_time, u_seed * 3.7)));
  float tickGate = step(0.62, hash21(floor(gridP * 2.3) + 5.0));
  float stripe = 1.0 - smoothstep(0.04, 0.12, abs(fract((uv.x - uv.y) * 29.0 + v.z) - 0.5));
  float tick = node * tickGate * stripe * smoothstep(0.06, 0.20, v.y) * structuralWindow * shortWindow;
  if (tick > 0.50) color = ochreCol();

  // A few committed dark pins keep the quiet regions alive without making dead quadrants.
  float broken = step(0.989, hash21(floor(uv * 70.0))) * step(0.40, abs(field)) * structuralWindow;
  if (broken > 0.5) color = inkCol();

  gl_FragColor = vec4(color, 1.0);
}
