precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define PI 3.141592653589793
#define TAU 6.283185307179586

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031 + u_seed * vec3(0.37, 0.19, 0.61));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
  float n = hash12(p);
  float m = hash12(p + vec2(17.7, 9.2));
  return vec2(n, m);
}

vec3 hexColor(float r, float g, float b) {
  return vec3(r, g, b) / 255.0;
}

mat2 rot(float a) {
  float s = sin(a), c = cos(a);
  return mat2(c, -s, s, c);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv01 = frag / u_resolution.xy;
  vec2 uv = (frag - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float px = 1.0 / min(u_resolution.x, u_resolution.y);

  vec3 bg = hexColor(221.0, 233.0, 245.0);
  vec3 mainC = hexColor(42.0, 87.0, 207.0);
  vec3 accentC = hexColor(42.0, 175.0, 192.0);
  vec3 darkC = hexColor(15.0, 29.0, 63.0);

  float loop = sin(TAU * u_time);
  float loopCos = cos(TAU * u_time);
  float breath = 0.5 + 0.5 * loop;

  vec2 p = uv * (5.65 + 0.20 * loop);
  vec2 base = floor(p);
  vec2 f = fract(p);

  float d1 = 100.0;
  float d2 = 100.0;
  vec2 bestCell = vec2(0.0);
  vec2 bestLocal = vec2(0.0);
  vec2 bestPoint = vec2(0.0);

  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      vec2 g = vec2(float(i), float(j));
      vec2 id = base + g;
      vec2 jitter = hash22(id) - 0.5;
      // Bounded jitter keeps a Poisson-like minimum interval and prevents macro scatter.
      vec2 point = g + 0.5 + 0.34 * jitter;
      float scaleBias = 0.96 + 0.08 * hash12(id + 4.1);
      vec2 diff = f - point;
      float d = dot(diff, diff) * scaleBias;
      if (d < d1) {
        d2 = d1;
        d1 = d;
        bestCell = id;
        bestPoint = point;
        bestLocal = diff;
      } else if (d < d2) {
        d2 = d;
      }
    }
  }

  float dist1 = sqrt(d1);
  float dist2 = sqrt(d2);
  float borderMetric = max(0.0, dist2 - dist1);
  float cellRand = hash12(bestCell + 11.0);
  float phase = hash12(bestCell + 23.0) * TAU;

  vec2 focalAnchor = vec2(0.5 + 0.22 * sin(u_seed * 19.1), 0.5 + 0.22 * cos(u_seed * 13.7));
  vec2 cellCenter01 = (base + bestPoint) / 5.65 + 0.5;
  float focal = smoothstep(0.34, 0.02, distance(cellCenter01, focalAnchor));
  focal *= 0.75 + 0.25 * cellRand;

  float edgeWidth = 0.050 + 0.020 * breath + 0.012 * cellRand + 0.022 * focal;
  float boundary = 1.0 - smoothstep(edgeWidth, edgeWidth + 2.2 * px * 5.65, borderMetric);
  float innerRim = smoothstep(edgeWidth + 0.012, edgeWidth + 0.052, borderMetric);

  vec2 local = rot(phase * 0.35) * bestLocal;
  float radial = length(local);
  float rdPhase = 9.0 * local.x + 5.5 * sin(6.0 * local.y + phase) + 4.0 * radial;
  rdPhase += 0.95 * loop + 0.55 * loopCos * sin(phase + local.y * 3.0);
  float stripes = 0.5 + 0.5 * sin(rdPhase);
  float stripeBand = smoothstep(0.42 - 0.05 * breath, 0.78, stripes);

  float ramp = smoothstep(0.12, 0.62, borderMetric) * (0.72 + 0.28 * sin(phase + radial * 7.0 + loop));
  float cellValue = clamp(0.18 + 0.52 * ramp + 0.32 * stripeBand + 0.18 * focal, 0.0, 1.0);

  vec2 dotGrid = uv01 * (42.0 + 3.0 * loop) + vec2(hash12(bestCell + 31.0), hash12(bestCell + 37.0));
  vec2 dotCell = fract(dotGrid) - 0.5;
  float dotDist = length(dotCell);
  float dotRadius = mix(0.050, 0.245, cellValue) * (0.92 + 0.10 * loop * sin(phase));
  float dots = 1.0 - smoothstep(dotRadius, dotRadius + 0.020, dotDist);
  dots *= smoothstep(edgeWidth + 0.022, edgeWidth + 0.080, borderMetric);

  float lineStripe = smoothstep(0.74, 0.90, stripes) * innerRim;
  float mainInk = clamp(boundary * (0.30 + 0.18 * focal) + lineStripe * 0.20 + dots * 0.50, 0.0, 1.0);
  float accentInk = clamp(boundary * 0.16 + dots * (0.26 + 0.40 * stripeBand) + lineStripe * 0.24, 0.0, 1.0);
  float darkInk = clamp(boundary * (0.02 + 0.22 * focal) + lineStripe * 0.06, 0.0, 1.0);

  vec3 mid = mix(bg, accentC, 0.18 * cellValue);
  mid = mix(mid, mainC, 0.16 * stripeBand * innerRim);
  vec3 col = mid;
  col = mix(col, accentC, accentInk * 0.42);
  col = mix(col, mainC, mainInk * 0.78);
  col = mix(col, darkC, darkInk * 0.86);

  // A thin ice wash keeps the sheet unified; all visible modulation is derived from the cell scaffold.
  float vignette = smoothstep(0.86, 0.20, length(uv));
  col = mix(bg, col, 0.90 + 0.10 * vignette);

  gl_FragColor = vec4(col, 1.0);
}
