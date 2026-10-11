#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define PI 3.141592653589793
#define TAU 6.283185307179586

float sat(float x) { return clamp(x, 0.0, 1.0); }
float hash11(float n) { return fract(sin(n * 127.113 + u_seed * 913.71) * 43758.5453123); }
float hash21(vec2 p) { return fract(sin(dot(p + u_seed, vec2(127.1, 311.7))) * 43758.5453123); }

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

vec2 lloydSite(float i, float count) {
  float k = i + 0.5;
  float a = k * 2.399963229728653 + u_seed * TAU * 0.71;
  float r = sqrt(k / count);
  float relax = 0.035 * sin(k * 1.91 + u_seed * TAU) * r * (1.0 - r);
  vec2 p = vec2(cos(a), sin(a)) * (r + relax);
  p = rot((u_seed - 0.5) * 0.38) * p;
  p.x *= 1.03;
  p.y *= 0.97;
  return p;
}

vec3 nearestLloyd(vec2 p) {
  float d1 = 9.0;
  float d2 = 9.0;
  float id = 0.0;
  for (int i = 0; i < 46; i++) {
    float fi = float(i);
    vec2 q = lloydSite(fi, 46.0);
    float d = length(p - q);
    if (d < d1) { d2 = d1; d1 = d; id = fi; }
    else if (d < d2) { d2 = d; }
  }
  return vec3(d1, d2, id);
}

float kifsDistance(vec2 p, float localScale, out float iterSignal) {
  vec2 z = p;
  float scale = 1.0;
  float acc = 0.0;
  for (int i = 0; i < 7; i++) {
    z = abs(z);
    if (z.x < z.y) z.xy = z.yx;
    z = rot(0.785398163 + 0.035 * sin(float(i) + u_seed * TAU)) * z;
    z = abs(z) - vec2(0.42, 0.255) * localScale;
    z *= 1.34;
    scale *= 1.34;
    acc += exp(-3.4 * length(z)) * (0.65 + 0.35 * sin(float(i) * 1.7));
  }
  iterSignal = acc / 7.0;
  return length(z) / scale;
}

float rdStripe(float foldDistance, float cellId, float ridge, float t) {
  float phase = fract(t + foldDistance * 2.35 + 0.019 * cellId);
  float waveA = sin(TAU * (phase * 5.0 + ridge * 0.22));
  float waveB = sin(TAU * (phase * 8.0 - ridge * 0.13 + hash11(cellId + 4.0) * 0.17));
  float rd = 0.5 + 0.5 * sin(1.45 * waveA + 0.75 * waveB);
  return rd;
}

vec3 ramp(float v, float gold) {
  vec3 abyss = vec3(7.0, 20.0, 38.0) / 255.0;
  vec3 deep = vec3(18.0, 43.0, 72.0) / 255.0;
  vec3 steel = vec3(120.0, 151.0, 184.0) / 255.0;
  vec3 pale = vec3(154.0, 176.0, 199.0) / 255.0;
  vec3 burnish = vec3(215.0, 169.0, 75.0) / 255.0;
  vec3 c = mix(abyss, deep, smoothstep(0.02, 0.30, v));
  c = mix(c, steel, smoothstep(0.22, 0.70, v));
  c = mix(c, pale, smoothstep(0.64, 0.94, v) * 0.45);
  c = mix(c, burnish, sat(gold));
  return c;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  p *= 2.18;

  float t = fract(u_time);
  vec3 cvt = nearestLloyd(p * 0.92);
  float cellId = cvt.z;
  float local = mix(0.90, 1.12, hash11(cellId + 13.0));
  local += 0.035 * sin(cvt.x * 19.0 + hash11(cellId + 2.0) * TAU);

  float iterSignal = 0.0;
  float fd = kifsDistance(p, local, iterSignal);
  float foldDistance = fd * 4.2 + iterSignal * 0.55 + cvt.x * 0.35;
  float ridge = 1.0 - smoothstep(0.018, 0.115, fd);

  float rd = rdStripe(foldDistance, cellId, ridge, t);
  float phase = fract(t + foldDistance);
  float flow = 0.5 + 0.5 * sin(TAU * (phase * 3.0 + iterSignal * 0.85));

  float aa = 1.6 / min(u_resolution.x, u_resolution.y);
  float contour = 1.0 - smoothstep(0.010, 0.010 + aa * 5.0, abs(fract(foldDistance * 3.0) - 0.5));
  float broad = smoothstep(0.030, 0.190, fd) * (1.0 - smoothstep(0.56, 0.98, length(p)));
  float field = sat(0.22 + 0.50 * ridge + 0.30 * contour + 0.22 * rd + 0.20 * iterSignal);
  field *= 0.82 + 0.18 * broad;

  // Distributed rhythm: every quadrant receives CVT-regulated KIFS cells; no mass-balance pull.
  float qSpread = 0.92 + 0.08 * sin((p.x * 2.1 - p.y * 1.7) + u_seed * TAU);
  field *= qSpread;

  float poster = floor(field * 6.0 + rd * 0.68) / 6.0;
  float v = mix(field, poster, 0.42);

  // Finish gate: keep Burnished Gold legible on every phase without turning the field
  // into a gold fill; the weaker traveling band only rescues the sparse cover phase.
  float flowBand = 1.0 - smoothstep(0.16, 0.34, abs(fract(phase * 3.0 + iterSignal * 0.85) - 0.5));
  float temporalGold = max(smoothstep(0.58, 0.86, flow), flowBand * 0.42);
  float goldRidge = temporalGold * smoothstep(0.52, 0.82, rd) * smoothstep(0.32, 0.74, ridge + contour * 0.45);
  goldRidge *= smoothstep(0.00, 0.26, cvt.y - cvt.x + 0.17); // keep highlight on connected fold flow, not CVT borders.
  goldRidge = sat(goldRidge * 0.92);

  vec3 color = ramp(v, goldRidge);
  color += vec3(0.015, 0.019, 0.024) * contour;
  color *= 0.90 + 0.10 * smoothstep(1.16, 0.12, length(p));

  gl_FragColor = vec4(color, 1.0);
}
