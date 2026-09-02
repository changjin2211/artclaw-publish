precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define PI 3.141592653589793
#define TAU 6.283185307179586

float hash1(float n) { return fract(sin(n * 127.1 + u_seed * 911.73) * 43758.5453123); }
float halton(float i, float b) {
  float f = 1.0;
  float r = 0.0;
  for (int k = 0; k < 7; k++) {
    f = f / b;
    r += f * mod(i, b);
    i = floor(i / b);
  }
  return r;
}
vec2 fibAnchor(float i) {
  float n = 17.0 + floor(u_seed * 83.0) + i;
  return vec2(fract(n * 0.61803398875), halton(n, 3.0));
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 hexColor(float r, float g, float b) { return vec3(r, g, b) / 255.0; }

float gyroid(vec3 p) {
  return sin(p.x) * cos(p.y) + sin(p.y) * cos(p.z) + sin(p.z) * cos(p.x);
}
float schwarz(vec3 p) {
  return cos(p.x) + cos(p.y) + cos(p.z);
}

float tpmsField(vec2 p, float t, float seedJitter) {
  vec2 a0 = fibAnchor(0.0);
  vec2 a1 = fibAnchor(1.0);
  vec2 a2 = fibAnchor(2.0);
  float f0 = 5.85 + 1.35 * a0.x;
  vec2 q = rot(0.32 + 0.18 * seedJitter) * p;
  float z = (q.x * 0.34 - q.y * 0.22) + TAU * (t + a1.y);
  vec3 p0 = vec3(q * f0 + TAU * vec2(a0.x, a0.y), z * 2.0);
  float v = 0.58 * gyroid(p0);
  vec3 p1 = vec3(q * (f0 * 1.72) + TAU * vec2(a1.x, a2.y), z * 3.0 + TAU * a2.x);
  v += 0.27 * schwarz(p1);
  vec3 p2 = vec3(q * (f0 * 2.85) + TAU * vec2(a2.x, a1.y), z * 5.0 + TAU * a0.y);
  v += 0.15 * gyroid(p2);
  return v;
}

float ellipse(vec2 p, vec2 c, vec2 axis, float r1, float r2) {
  vec2 d = p - c;
  vec2 n = vec2(-axis.y, axis.x);
  float e = pow(dot(d, axis) / r1, 2.0) + pow(dot(d, n) / r2, 2.0);
  return 1.0 - smoothstep(0.72, 1.18, e);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  vec3 bg = hexColor(231.0, 222.0, 200.0);     // #E7DEC8 locked parchment
  vec3 lowC = hexColor(41.0, 77.0, 69.0);       // #294D45
  vec3 midC = hexColor(78.0, 117.0, 103.0);     // #4E7567
  vec3 vioC = hexColor(59.0, 41.0, 69.0);       // #3B2945
  vec3 safC = hexColor(215.0, 168.0, 75.0);     // #D7A84B

  float t = fract(u_time);
  float seedJ = hash1(3.0);
  vec2 entry = vec2(0.05 + 0.05 * hash1(4.0), 0.18 + 0.08 * hash1(5.0));
  vec2 exitp = vec2(0.98, 0.66 + 0.08 * hash1(6.0));
  vec2 dir = normalize(exitp - entry);
  vec2 nor = vec2(-dir.y, dir.x);
  float s = dot(uv - entry, dir);
  float d = dot(uv - entry, nor);

  float curve = 0.026 * sin(TAU * (s * 1.35 + 0.17 * seedJ)) + 0.014 * sin(TAU * (s * 2.0 - 0.11));
  float dc = d - curve;
  float width = 0.205 + 0.035 * hash1(7.0);
  float spineW = 0.080 + 0.014 * hash1(8.0);
  float shoal = 1.0 - smoothstep(width, width + 0.070, abs(dc));
  float spine = 1.0 - smoothstep(spineW, spineW + 0.045, abs(dc));

  float c1 = ellipse(uv, vec2(0.71 + 0.030 * hash1(9.0), 0.245 + 0.025 * hash1(10.0)), dir, 0.120, 0.035);
  float c2 = ellipse(uv, vec2(0.86 + 0.026 * hash1(11.0), 0.145 + 0.025 * hash1(12.0)), dir, 0.100, 0.032);
  float c3 = ellipse(uv, vec2(0.91, 0.090 + 0.020 * hash1(16.0)), dir, 0.095, 0.030);
  float counter = max(max(c1, c2), c3) * 0.42;

  float quiet = smoothstep(0.53, 0.18, distance((uv - vec2(0.17, 0.82)) * vec2(1.0, 1.12), vec2(0.0)));
  float quietFilament = (1.0 - smoothstep(0.095, 0.215, abs(dc))) * smoothstep(-0.16, 0.18, s) * (1.0 - smoothstep(0.52, 0.76, s));
  float rearFilament = (1.0 - smoothstep(0.086, 0.205, abs(dc))) * smoothstep(0.66, 0.92, s) * (1.0 - smoothstep(1.18, 1.42, s));
  float macroMask = max(max(shoal * 0.98, counter * 1.08), max(quietFilament * 0.44, rearFilament * 0.68));
  macroMask *= mix(1.0, 0.86, quiet);
  float quietWipe = (1.0 - smoothstep(0.28, 0.46, uv.x)) * smoothstep(0.58, 0.76, uv.y);
  quietWipe = smoothstep(0.30, 0.86, quietWipe);
  macroMask *= 1.0 - 0.08 * quietWipe;
  float tlReach = (1.0 - smoothstep(0.36, 0.58, uv.x)) * smoothstep(0.50, 0.72, uv.y);
  float tlCurrentOffset = 0.255 + 0.040 * sin(TAU * (s * 1.18 + seedJ));
  float tlUpperCurrent = (1.0 - smoothstep(0.125, 0.285, abs(dc - tlCurrentOffset))) * smoothstep(-0.10, 0.10, s) * (1.0 - smoothstep(0.48, 0.76, s));
  float tlReturnCurrent = (1.0 - smoothstep(0.070, 0.205, abs(dc - 0.155))) * smoothstep(0.04, 0.18, s) * (1.0 - smoothstep(0.40, 0.64, s));
  float tlWeave = 0.72 + 0.28 * sin(TAU * (dot(uv, dir) * 3.0 + dot(uv, nor) * 1.0 + seedJ));
  float tlLattice = tlReach * max(tlUpperCurrent, max(tlReturnCurrent * 0.82, quietFilament * 0.48)) * tlWeave;
  float brQuiet = smoothstep(0.70, 0.03, distance((uv - vec2(0.91, 0.13)) * vec2(1.00, 0.92), vec2(0.0)));
  float brLattice = brQuiet * (0.72 + 0.22 * sin(TAU * (dot(uv, dir) * 2.4 - seedJ)));
  macroMask = max(macroMask, max(tlLattice * 0.88, brLattice * 1.02));

  vec2 off;
  off.x = 0.030 * sin(TAU * (p.y * 1.55 + t * 1.0 + hash1(13.0))) + 0.018 * sin(TAU * (dot(p, dir) * 2.0 - t * 2.0));
  off.y = 0.026 * cos(TAU * (p.x * 1.35 - t * 1.0 + hash1(14.0))) + 0.014 * sin(TAU * (dot(p, nor) * 1.7 + t));
  vec2 travel = dir * (t * 0.77); // arguments below use integer TAU cycles, so phase closes
  vec2 q = p + off + travel;

  float field = tpmsField(q, t, seedJ);
  float val = abs(field);
  float frontPhase = fract(s * 0.68 - t + 0.22 * hash1(15.0));
  float frontDist = abs(frontPhase - 0.5) * 2.0;
  float front = 1.0 - smoothstep(0.00, 0.34, frontDist);
  float collapse = smoothstep(0.22, 0.92, frontPhase) * (1.0 - front);

  float aperture = mix(0.32, 0.57, front) - 0.15 * collapse - 0.070 * spine;
  float wall = 1.0 - smoothstep(aperture, aperture + 0.135, val);
  float roomRim = 1.0 - smoothstep(0.012, 0.168, abs(val - aperture));
  float neck = smoothstep(aperture + 0.19, aperture - 0.070, val);
  float seam = 1.0 - smoothstep(0.040, 0.205, abs(val - (aperture + 0.112)));
  float mass = macroMask * max(wall * 0.78, max(roomRim * 1.16, seam * 0.58));

  float fx = tpmsField(q + vec2(0.0028, 0.0), t, seedJ);
  float fy = tpmsField(q + vec2(0.0, 0.0028), t, seedJ);
  float curvature = sat((abs(fx - field) + abs(fy - field)) * 4.8 + roomRim * 0.34);
  float angle = 0.45 + 0.35 * (fibAnchor(3.0).x - 0.5) + 0.22 * sign(sin(TAU * (floor(s * 7.0) * 0.618 + seedJ)));
  angle += 0.30 * (curvature - 0.5) + 0.18 * sign(field);
  vec2 hatchDir = vec2(cos(angle), sin(angle));
  float hatchFreq = mix(30.0, 118.0, sat(curvature * 0.92 + front * 0.66 + spine * 0.28));
  float hatchWave = abs(sin(TAU * (dot(uv, hatchDir) * hatchFreq + 0.19 * sin(TAU * (s * 2.0 + seedJ)) + field * 0.045)));
  float cutPhase = sin(TAU * (dot(uv, vec2(-hatchDir.y, hatchDir.x)) * mix(7.0, 15.0, curvature) + field * 0.31 + front * 0.17)) * 0.5 + 0.5;
  float segmentGate = smoothstep(0.18 - 0.12 * front, 0.62, cutPhase) * (1.0 - smoothstep(0.88, 0.99, cutPhase));
  float edgeBind = sat(roomRim * 1.05 + seam * 0.48 + front * 0.58 + spine * 0.25);
  float hatch = (1.0 - smoothstep(0.015, mix(0.060, 0.112, sat(curvature + front * 0.60)), hatchWave)) * segmentGate;
  hatch *= mix(0.28, 1.0, edgeBind);
  float ink = mass * (0.52 + 0.68 * hatch) * (0.72 + 0.46 * neck + 0.42 * roomRim);
  ink += brLattice * (0.24 + 0.34 * seam + 0.48 * roomRim) * (0.52 + 0.58 * hatch);
  ink += brLattice * (0.20 + 0.24 * hatch + 0.22 * seam);
  ink += tlLattice * (0.34 + 0.54 * roomRim + 0.38 * seam) * (0.58 + 0.70 * hatch);

  ink *= 1.0 - 0.06 * quietWipe;

  float ridge = mass * front * smoothstep(0.010, 0.140, spine + roomRim * 0.35) * (0.34 + 0.66 * hatch);
  ridge *= smoothstep(aperture + 0.20, aperture - 0.08, val);
  ridge *= 1.0 - smoothstep(0.12, 0.24, abs(dc));
  ridge *= 1.0 - 0.06 * quietWipe;

  float ramp = sat(0.50 + 0.45 * field + 0.18 * spine - 0.25 * collapse);
  vec3 structure = mix(lowC, midC, smoothstep(0.24, 0.76, ramp));
  structure = mix(structure, vioC, sat(collapse * (0.38 + 0.58 * (1.0 - front))));
  structure = mix(structure, safC, sat(ridge * 1.20));

  float alpha = sat(ink * (0.86 + 0.34 * spine + 0.42 * front + 0.26 * roomRim));
  alpha = max(alpha, ridge * 0.94);
  alpha = max(alpha, tlLattice * (0.32 + 0.30 * roomRim + 0.20 * seam + 0.16 * hatch));
  alpha *= smoothstep(0.0, 0.025, uv.x) * smoothstep(0.0, 0.025, uv.y) * smoothstep(0.0, 0.025, 1.0 - uv.x) * smoothstep(0.0, 0.025, 1.0 - uv.y);

  vec3 color = mix(bg, structure, alpha);
  gl_FragColor = vec4(color, 1.0);
}
