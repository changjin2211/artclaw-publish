precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define PI 3.14159265358979323846
#define TAU 6.28318530717958647692

float sat(float x) { return clamp(x, 0.0, 1.0); }
vec3 hexColor(float r, float g, float b) { return vec3(r, g, b) / 255.0; }

float hash11(float p) {
  return fract(sin(p * 127.1 + u_seed * 913.73) * 43758.5453123);
}

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 41.97) * 43758.5453123);
}

float blueEdge(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  float a = hash21(cell);
  float b = hash21(cell + vec2(1.0, 0.0));
  float c = hash21(cell + vec2(0.0, 1.0));
  float d = hash21(cell + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y) - 0.5;
}

mat2 rot(float a) {
  float c = cos(a), s = sin(a);
  return mat2(c, -s, s, c);
}

vec2 gesturePoint(float th, float freqPick, float ph, float lean) {
  float ax = 3.0;
  float ay = 2.0;
  if (freqPick > 0.25) { ax = 4.0; ay = 3.0; }
  if (freqPick > 0.50) { ax = 5.0; ay = 3.0; }
  if (freqPick > 0.75) { ax = 5.0; ay = 4.0; }

  // One closed integer-period curve, biased into a single sweeping gesture.
  vec2 q = vec2(
    sin(ax * th + ph),
    sin(ay * th + ph * 0.73 + 0.5 * PI)
  );
  q.x += 0.18 * sin((ax + ay) * th + ph * 1.31);
  q.y += 0.10 * sin((ay + 1.0) * th - ph * 0.57);
  q = rot(-0.42 + 0.34 * lean) * q;
  q.x *= 0.78;
  q.y *= 0.64;
  q += vec2(-0.03 + 0.06 * lean, 0.02 * sin(ph));
  return q;
}

float segDist(vec2 p, vec2 a, vec2 b) {
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 0.0001), 0.0, 1.0);
  return length(pa - ba * h);
}

float lissajousField(vec2 p, float freqPick, float ph, float lean) {
  float d = 10.0;
  vec2 prev = gesturePoint(0.0, freqPick, ph, lean);
  for (int i = 1; i <= 160; i++) {
    float th = TAU * float(i) / 160.0;
    vec2 cur = gesturePoint(th, freqPick, ph, lean);
    d = min(d, segDist(p, prev, cur));
    prev = cur;
  }
  return d;
}

float ringBand(float v, float center, float width, float aa) {
  return smoothstep(width + aa, width, abs(v - center));
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = fract(u_time);
  float flow = t;
  float flowPhase = TAU * flow;
  // Directional loop phase: closed at 0==1, but advances rather than yo-yoing.
  float breath = sin(flowPhase - 2.4 * p.x + 1.6 * p.y);
  float closeBreath = 0.5 + 0.5 * breath;

  float pick = hash11(1.0);
  float phase = TAU * hash11(2.0);
  float lean = hash11(3.0) - 0.5;
  float scale = 1.02;
  vec2 q = p / scale;

  vec2 flowOffset = vec2(cos(flowPhase + 0.4), sin(flowPhase + 0.4)) * vec2(0.018, 0.012);
  float d0 = lissajousField(q, pick, phase, lean);
  float d1 = lissajousField(q + flowOffset, pick, phase + 0.025 * sin(flowPhase), lean);
  float d = min(d0, d1 + 0.006);

  float edgeNoise = blueEdge(uv * 95.0 + vec2(hash11(9.0), hash11(10.0)) * 17.0);
  float aa = 0.0065 + 0.0015 * closeBreath;
  d += edgeNoise * 0.0038;

  // Distance-derived family: broad inner ramp, cream contours, terracotta crests.
  float webBody = 1.0 - smoothstep(0.145 + 0.014 * breath, 0.39 + 0.022 * breath, d);
  float nearInk = 1.0 - smoothstep(0.020, 0.085 + 0.008 * closeBreath, d);
  float contourFlow = 2.0 * flow;
  float contourValue = d * (15.0 - 0.55 * breath) + contourFlow;
  float contour = 0.0;
  contour += ringBand(fract(contourValue), 0.15, 0.040 + 0.006 * closeBreath, aa);
  contour += 0.72 * ringBand(fract(contourValue * 0.72 + 0.21), 0.55, 0.034, aa);
  contour *= smoothstep(0.34, 0.02, d);

  float crestWave = sin(17.0 * atan(q.y, q.x) + 5.0 * length(q) + phase - flowPhase);
  float crest = ringBand(fract(contourValue * 0.48 + 0.33 + flow), 0.70, 0.055, aa)
             * smoothstep(0.25, 0.02, d)
             * (0.68 + 0.32 * crestWave);

  // Single-gesture emphasis: a central knot glows but does not become a separate object.
  float knot = 1.0 - smoothstep(0.055, 0.26, length(q - vec2(-0.10 + 0.16 * lean, 0.05)));
  crest += 0.28 * knot * nearInk;
  contour += 0.30 * knot * smoothstep(0.22, 0.015, d);

  float vignette = smoothstep(0.98, 0.18, length(p));
  webBody *= 0.74 + 0.26 * vignette;
  contour *= 0.82 + 0.18 * closeBreath;
  crest *= 0.72 + 0.28 * closeBreath;

  vec3 kiln = hexColor(37.0, 23.0, 19.0);       // #251713
  vec3 mid = hexColor(143.0, 90.0, 67.0);       // #8F5A43
  vec3 cream = hexColor(233.0, 210.0, 170.0);   // #E9D2AA
  vec3 terra = hexColor(200.0, 100.0, 59.0);    // #C8643B

  vec3 color = kiln;
  color = mix(color, mid, sat(webBody * 0.62));
  color = mix(color, cream, sat(contour * 0.86 + nearInk * 0.28));
  color = mix(color, terra, sat(crest * 0.72));
  color += cream * 0.05 * webBody * (0.4 + 0.6 * closeBreath);
  color *= 0.93 + 0.07 * vignette;

  gl_FragColor = vec4(color, 1.0);
}
