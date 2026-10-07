precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define PI 3.141592653589793

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33 + u_seed * 7.17);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  float n = hash12(p);
  return vec2(n, hash12(p + n + 19.19));
}

float aastep(float edge, float x) {
  float w = 0.0022;
  return smoothstep(edge - w, edge + w, x);
}

vec3 hexColor(vec3 c) { return c / 255.0; }

vec2 cvtCenter(vec2 id, float state) {
  vec2 h0 = hash22(id + floor(u_seed * 211.0));
  vec2 h1 = hash22(id + 47.0 + floor(u_seed * 157.0));
  vec2 j = mix(h0, h1, state) - 0.5;
  // Lloyd pressure: jitter is intentionally narrow, pulled back toward the cell center.
  return id + 0.5 + j * 0.34;
}

vec4 nearestCell(vec2 g, float state) {
  vec2 base = floor(g);
  float best = 1e9;
  float second = 1e9;
  vec2 bestId = base;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 id = base + vec2(float(x), float(y));
      vec2 c = cvtCenter(id, state);
      float d = dot(g - c, g - c);
      if (d < best) {
        second = best;
        best = d;
        bestId = id;
      } else if (d < second) {
        second = d;
      }
    }
  }
  return vec4(bestId, sqrt(best), sqrt(second));
}

float threadBand(float x, float period, float width) {
  float d = abs(fract(x / period) - 0.5) * period;
  return 1.0 - aastep(width, d);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);

  float loop = 0.5 - 0.5 * cos(2.0 * PI * u_time);
  float theta = -0.055 + 0.03 * sin(2.0 * PI * u_time + u_seed * 6.28318);
  mat2 rot = mat2(cos(theta), -sin(theta), sin(theta), cos(theta));
  vec2 q = rot * p + 0.5;

  vec2 g = q * 7.15 + vec2(0.15, -0.08);
  vec4 cell = nearestCell(g, loop);
  vec2 id = cell.xy;
  float edge = clamp((cell.w - cell.z) * 1.8, 0.0, 1.0);

  float h = hash12(id);
  float h2 = hash12(id + 31.7);
  float depth = 0.72 + 0.28 * sin(2.0 * PI * (h + 0.33 * sin(2.0 * PI * u_time)));
  float phase = floor(h2 * 4.0) + 0.5 * sin(2.0 * PI * (u_time + h));

  float spacingX = mix(0.064, 0.079, h);
  float spacingY = mix(0.061, 0.077, h2);
  float warp = 0.008 * sin(2.0 * PI * (q.y * 3.0 + h + loop))
             + 0.006 * sin(2.0 * PI * (q.x * 2.0 - h2 - loop));
  float vx = threadBand(q.x + warp + phase * 0.007, spacingX, spacingX * 0.28);
  float hy = threadBand(q.y - warp * 0.8 - phase * 0.006, spacingY, spacingY * 0.27);

  float strand = max(vx, hy);
  float cross = vx * hy;
  float over = step(0.0, sin(PI * (floor((q.x + phase * 0.011) / spacingX) + floor((q.y - phase * 0.009) / spacingY) + phase)));
  float underShadow = cross * mix(0.30, 0.95, over) * depth;

  float hatchA = 0.5 + 0.5 * sin(2.0 * PI * (q.x * 62.0 + q.y * 9.0 + phase));
  float hatchB = 0.5 + 0.5 * sin(2.0 * PI * (q.y * 66.0 - q.x * 8.0 - phase));
  float hatch = mix(hatchA, hatchB, over);
  hatch = (1.0 - aastep(mix(0.38, 0.63, depth), hatch)) * strand * (0.35 + 0.65 * cross);

  float rimWave = 0.5 + 0.5 * sin(2.0 * PI * (h + u_time + q.x * 0.7 - q.y * 0.4));
  float amberRim = cross * smoothstep(0.78, 0.98, rimWave) * (0.45 + 0.55 * edge);
  // Keep amber local to phase crests; no global dots.
  amberRim *= 1.0 - smoothstep(0.12, 0.24, abs(fract(q.x / spacingX) - fract(q.y / spacingY)));

  float paperGap = 1.0 - strand;
  float ink = strand * (0.35 + 0.50 * underShadow) + hatch * 0.20;
  ink *= mix(0.88, 1.08, edge);
  ink = clamp(ink, 0.0, 1.0);

  vec3 paper = hexColor(vec3(237.0, 240.0, 243.0));
  vec3 prussian = hexColor(vec3(30.0, 58.0, 95.0));
  vec3 amber = hexColor(vec3(208.0, 138.0, 44.0));
  vec3 mid = mix(paper, prussian, 0.42);

  vec3 col = mix(paper, mid, strand * 0.28);
  col = mix(col, prussian, ink);
  col = mix(col, amber, clamp(amberRim * 0.62, 0.0, 0.62));

  float boundary = (1.0 - smoothstep(0.015, 0.09, abs(cell.w - cell.z))) * 0.10;
  col = mix(col, prussian, boundary * (0.55 + 0.45 * strand));

  float vignette = smoothstep(0.78, 0.20, length(p));
  col = mix(paper * 0.96, col, 0.93 + 0.07 * vignette);
  col += (hash12(gl_FragCoord.xy + u_seed * 13.0) - 0.5) / 255.0; // tiny dither only

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
