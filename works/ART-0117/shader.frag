#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define PI 3.141592653589793
#define TAU 6.283185307179586

float sat(float x) { return clamp(x, 0.0, 1.0); }
float hash11(float n) { return fract(sin(n * 127.113 + u_seed * 571.31) * 43758.5453123); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 97.73) * 43758.5453123); }
vec2 hash22(vec2 p) {
  float a = hash21(p + 17.17);
  float b = hash21(p + vec2(43.31, 91.79) + a);
  return vec2(a, b);
}

vec3 hexColor(float r, float g, float b) { return vec3(r, g, b) / 255.0; }

float bayer4(vec2 frag) {
  vec2 p = mod(floor(frag), 4.0);
  float x = p.x;
  float y = p.y;
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

vec2 blueFeature(vec2 cell, float phaseMix, float signedPhase) {
  vec2 a = hash22(cell + 11.0) - 0.5;
  vec2 b = hash22(cell * mat2(0.73, -0.31, 0.27, 0.91) + 67.0) - 0.5;
  vec2 pa = 0.5 + 0.56 * a / (0.72 + length(a));
  vec2 pb = 0.5 + 0.56 * b / (0.72 + length(b));
  vec2 p = mix(pa, pb, phaseMix);
  float h = hash21(cell + 23.0);
  vec2 tangent = vec2(cos(TAU * h + cell.y * 0.37), sin(TAU * h - cell.x * 0.29));
  p += tangent * (0.045 * signedPhase) * (0.55 + 0.45 * hash21(cell + 5.0));
  return p;
}

vec4 voronoi(vec2 p, float phaseMix, float signedPhase) {
  vec2 g = floor(p);
  float d1 = 99.0;
  float d2 = 99.0;
  float id = 0.0;
  vec2 nearestCell = vec2(0.0);
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 off = vec2(float(i), float(j));
      vec2 c = g + off;
      vec2 f = c + blueFeature(c, phaseMix, signedPhase);
      vec2 delta = p - f;
      float bias = mix(0.92, 1.08, hash21(c + 31.0));
      float d = length(delta * vec2(bias, 1.0 / bias));
      if (d < d1) {
        d2 = d1;
        d1 = d;
        id = hash21(c + 101.0);
        nearestCell = c;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }
  return vec4(d1, d2, id, hash21(nearestCell + 211.0));
}

float chladni(vec2 p, float phase, float transition) {
  vec2 q = p - 0.5;
  q.x *= mix(0.94, 1.10, transition);
  q.y *= mix(1.12, 0.90, transition);
  float m = mix(3.0, 5.0, step(0.5, fract(u_seed * 3.17)));
  float n = mix(4.0, 6.0, step(0.5, fract(u_seed * 5.91)));
  float a = sin(PI * (m * q.x + 0.17 * sin(phase))) * sin(PI * (n * q.y - 0.13 * cos(phase)));
  float b = sin(PI * (n * (q.x * 0.72 + q.y * 0.21) - 0.11 * cos(phase))) * sin(PI * (m * (q.y * 0.86 - q.x * 0.18) + 0.15 * sin(phase)));
  return 0.5 + 0.5 * (a - b);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = uv;
  p.x = (uv.x - 0.5) * (u_resolution.x / u_resolution.y) + 0.5;

  float t = fract(u_time);
  float phaseMix = 0.5 - 0.5 * cos(TAU * t);
  float signedPhase = sin(TAU * t);

  // field_transition is the only composition driver: one diagonal pressure gradient changes density and contrast.
  vec2 axis = normalize(vec2(0.82, -0.57));
  float transition = smoothstep(-0.54, 0.62, dot(p - 0.5, axis) + 0.10 * signedPhase);
  float scale = mix(7.2, 5.15, transition);
  vec2 warp = vec2(
    sin((p.y * 3.7 + t + u_seed * 0.31) * TAU),
    cos((p.x * 3.2 - t + u_seed * 0.27) * TAU)
  ) * mix(0.010, 0.030, transition);
  vec2 cellP = (p + warp) * scale + vec2(0.17 * signedPhase, -0.11 * signedPhase);

  vec4 v = voronoi(cellP, phaseMix, signedPhase);
  float edge = max(v.y - v.x, 0.0);
  float cellId = v.z;
  float pressure = chladni(p + 0.020 * vec2(signedPhase, -signedPhase), TAU * t + cellId, transition);
  float node = 1.0 - smoothstep(0.12, 0.42, abs(pressure - 0.5));

  float borderWidth = mix(0.048, 0.020, transition) + node * mix(0.040, 0.022, transition);
  float border = 1.0 - smoothstep(borderWidth, borderWidth + 0.028, edge);
  float innerRamp = 1.0 - smoothstep(0.08, 0.44, v.x);
  float face = sat(innerRamp * (0.42 + 0.58 * pressure));

  float cellPhase = fract(cellId + t + pressure * 0.13);
  float pulse = 0.5 + 0.5 * sin(TAU * (cellPhase + edge * 1.8));
  float value = sat(face * mix(0.45, 0.75, transition) + border * mix(0.62, 1.05, node) + 0.22 * pulse * node);
  value *= mix(1.08, 0.82, transition);

  float threshold = bayer4(gl_FragCoord.xy + floor(cellId * 11.0));
  float duty = smoothstep(threshold - 0.18, threshold + 0.18, value);
  float aaTone = sat(value * 0.72 + duty * 0.34);

  vec3 bg = hexColor(11.0, 8.0, 32.0);
  vec3 cyan = hexColor(51.0, 221.0, 242.0);
  vec3 magenta = hexColor(255.0, 43.0, 214.0);
  vec3 lime = hexColor(198.0, 255.0, 61.0);

  float magentaMix = sat(border * (0.36 + 0.56 * node) + pressure * 0.20 - transition * 0.06);
  vec3 neon = mix(cyan, magenta, magentaMix);
  vec3 color = mix(bg, neon, aaTone);

  float cornerPulse = smoothstep(0.82, 0.96, node * border * pulse) * (1.0 - smoothstep(0.92, 1.0, transition));
  float rareTick = cornerPulse * step(0.88, fract(cellId * 13.37 + floor(t * 4.0) * 0.17));
  color = mix(color, lime, rareTick * 0.55);

  float vignette = smoothstep(0.86, 0.22, length((uv - 0.5) * vec2(0.92, 1.0)));
  color *= 0.82 + 0.18 * vignette;
  gl_FragColor = vec4(color, 1.0);
}
