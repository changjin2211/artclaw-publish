precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
uniform float u_frame;
uniform sampler2D u_prev;

#define PI 3.141592653589793

float hash11(float n){ return fract(sin(n * 127.1 + u_seed * 311.7) * 43758.5453123); }
vec2 hash21(float n){ return fract(sin(vec2(n * 269.5 + 17.1, n * 183.3 + 91.7) + u_seed * vec2(43.2, 71.9)) * 43758.5453); }

mat2 rot(float a){ float c = cos(a), s = sin(a); return mat2(c,-s,s,c); }

vec2 foldKaleido(vec2 p){
  float sectors = 8.0;
  float a = atan(p.y, p.x);
  float r = length(p);
  float tau = 2.0 * PI / sectors;
  a = mod(a + tau * (0.18 + 0.18 * step(0.5, u_seed)), tau);
  a = abs(a - 0.5 * tau);
  return vec2(cos(a), sin(a)) * r;
}

vec2 fibPoint(float i){
  float n = 34.0;
  float ga = 2.39996323;
  float k = i + 0.5;
  float r = sqrt(k / n) * 1.08;
  float a = k * ga + u_seed * 6.28318;
  vec2 p = vec2(cos(a), sin(a)) * r;
  p += (hash21(i) - 0.5) * 0.055;
  return p;
}

vec3 palette(float q, float glint){
  vec3 bg = vec3(0.0902, 0.0667, 0.1020);     // #17111A
  vec3 cyan = vec3(0.7176, 0.9020, 0.8824);   // #B7E6E1
  vec3 amber = vec3(0.8784, 0.6431, 0.3608);  // #E0A45C
  vec3 c = mix(bg, cyan, clamp(q, 0.0, 1.0));
  c = mix(c, amber, clamp(glint, 0.0, 1.0));
  return c;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  p *= 2.22;

  vec2 fp = foldKaleido(p);
  fp = rot((u_seed - 0.5) * 0.34) * fp;

  float d1 = 9.0;
  float d2 = 9.0;
  float nearest = 0.0;
  for(int i = 0; i < 34; i++){
    float fi = float(i);
    vec2 q = fibPoint(fi);
    // tiny seed-scoped cell-size variation, not a separate noise field
    float stretch = mix(0.94, 1.06, hash11(fi + 9.0));
    float d = length((fp - q) * vec2(stretch, 1.0 / stretch));
    if(d < d1){ d2 = d1; d1 = d; nearest = fi; }
    else if(d < d2){ d2 = d; }
  }

  float edge = d2 - d1;
  float tier = mix(17.0, 23.0, hash11(nearest + 3.0));
  float contours = abs(fract((edge + 0.012 * sin(nearest)) * tier) - 0.5);
  float line = 1.0 - smoothstep(0.010, 0.052, contours);
  float boundary = 1.0 - smoothstep(0.022, 0.105, edge);
  float segmentWave = abs(sin((fp.x * 5.7 + fp.y * 4.3 + nearest * 0.41) * PI));
  float segment = smoothstep(0.18, 0.54, segmentWave);
  float crossSegment = smoothstep(0.12, 0.48, abs(sin((fp.x * 3.1 - fp.y * 6.2 + nearest * 0.23) * PI)));
  float scaffold = max(line * 0.98 * segment, boundary * 0.58 * crossSegment);
  // Brief/form finish: the fold converges at the center; damp only that convergence so
  // boundaries remain readable instead of blooming into a blurred knot.
  float centerContain = mix(0.42, 1.0, smoothstep(0.075, 0.25, length(fp)));
  scaffold *= centerContain;

  // Distributed rhythm: cell-local offsets modulate the same field without creating a focal mass.
  float localPhase = fract(u_time + hash11(nearest + 21.0) * 0.42);
  float wave = 0.5 + 0.5 * sin(6.28318 * (localPhase + edge * 2.4));
  float phaseGate = smoothstep(0.18, 0.58, wave);
  float rhythm = scaffold * mix(0.28, 1.0, phaseGate);

  float reset = smoothstep(0.74, 0.88, u_time) * (1.0 - smoothstep(0.92, 0.985, u_time));
  float glintGate = smoothstep(0.985, 0.998, wave) * smoothstep(0.78, 0.90, reset);
  float glint = glintGate * line * centerContain * step(0.58 + 0.18 * u_seed, hash11(nearest + 41.0));

  vec3 prev = texture2D(u_prev, uv).rgb;
  float decay = mix(0.935, 0.58, reset);
  vec3 base = vec3(0.0902, 0.0667, 0.1020);
  vec3 current = palette(rhythm, glint);

  vec3 accumulated = max(base, prev * decay);
  vec3 color = max(accumulated, current * (0.72 + 0.28 * scaffold));
  color = mix(color, base + (color - base) * 0.38, smoothstep(0.90, 0.99, u_time));
  color = mix(base, color, 0.72 + 0.28 * centerContain);

  // Keep the field contained: no edge bloom, no floating fragments.
  float vignette = smoothstep(1.34, 0.78, length(p));
  color = mix(base, color, 0.90 + 0.10 * vignette);
  gl_FragColor = vec4(color, 1.0);
}
