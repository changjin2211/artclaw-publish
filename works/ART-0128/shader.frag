precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
const float TAU = 6.28318530718;
const float N = 8.0;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
vec2 jitter(vec2 id) {
  return (vec2(hash21(id + vec2(17.0, u_seed * 19.0)),
               hash21(id + vec2(53.0, u_seed * 31.0))) - 0.5) * 0.18;
}
// A bounded Lloyd step: average the four neighboring Voronoi bisector
// positions of a jittered lattice. The boundary sites remain clamped.
vec2 site(vec2 id) {
  vec2 j = jitter(id);
  vec2 l = max(id - vec2(1.0, 0.0), vec2(0.0));
  vec2 r = min(id + vec2(1.0, 0.0), vec2(7.0));
  vec2 b = max(id - vec2(0.0, 1.0), vec2(0.0));
  vec2 t = min(id + vec2(0.0, 1.0), vec2(7.0));
  vec2 bisector = 0.25 * (jitter(l) + jitter(r) + jitter(b) + jitter(t));
  return (id + 0.5 + mix(j, bisector, 0.76)) / N;
}
float hilbert(vec2 id) {
  vec2 p = id;
  float d = 0.0;
  for (int k = 0; k < 3; k++) {
    float s = 4.0 / pow(2.0, float(k));
    float rx = mod(floor(p.x / s), 2.0);
    float ry = mod(floor(p.y / s), 2.0);
    d += s*s * (3.0*rx + ry - 2.0*rx*ry);
    if (ry < 0.5) {
      if (rx > 0.5) p = vec2(s-1.0) - p;
      p = p.yx;
    }
  }
  return d;
}
vec2 hilbertPoint(float d) {
  vec2 p = vec2(0.0);
  float v = d;
  for (int k = 0; k < 3; k++) {
    float s = pow(2.0, float(k));
    float rx = mod(floor(v * 0.5), 2.0);
    float ry = abs(mod(v, 2.0) - rx);
    if (ry < 0.5) {
      if (rx > 0.5) p = vec2(s - 1.0) - p;
      p = p.yx;
    }
    p += s * vec2(rx, ry);
    v = floor(v * 0.25);
  }
  return p;
}
float fold(vec2 p) {
  float f = 0.0;
  for (int k = 0; k < 5; k++) {
    float a = TAU * float(k) / 5.0;
    f += cos(24.0 * dot(p, vec2(cos(a),sin(a))) + 0.37 * float(k));
  }
  return f / 5.0;
}
vec3 ramp(float q, float active, float core) {
  vec3 paper = vec3(0.8667,0.9137,0.9608);
  vec3 cobalt = vec3(0.1647,0.3412,0.8118);
  vec3 cyan = vec3(0.1647,0.6863,0.7529);
  vec3 navy = vec3(0.0588,0.1137,0.2471);
  vec3 ink = mix(cobalt, navy, clamp(core, 0.0, 1.0));
  ink = mix(ink, cyan, clamp(active, 0.0, 0.46));
  return mix(paper, ink, clamp(q, 0.0, 1.0));
}
void main() {
  vec2 p = gl_FragCoord.xy / u_resolution;
  vec2 grid = clamp(floor(p * N), vec2(0.0), vec2(7.0));
  float best = 2.0;
  float progress = 0.0;
  vec2 foot = p;
  // Search only nearby Hilbert edges; all edges belong to the same gesture.
  for (int yy = -1; yy <= 1; yy++) {
    for (int xx = -1; xx <= 1; xx++) {
      vec2 id = grid + vec2(float(xx),float(yy));
      if (id.x < 0.0 || id.y < 0.0 || id.x > 7.0 || id.y > 7.0) continue;
      float order = hilbert(id);
      if (order > 62.5) continue;
      vec2 a = site(id);
      vec2 b = site(hilbertPoint(order + 1.0));
      vec2 delta = b-a;
      float along = clamp(dot(p-a, delta) / max(dot(delta,delta),0.00001), 0.0, 1.0);
      vec2 fp = a + delta*along;
      float dist = length(p-fp);
      if (dist < best) { best=dist; progress=(order+along)/63.0; foot=fp; }
    }
  }
  float qc = fold(foot);
  // One asymmetric packet travels the whole connected path once per loop.
  float travelPhase = mod(progress-u_time+1.5,1.0)-0.5;
  float travel = smoothstep(-0.25,-0.04,travelPhase) *
                 (1.0-smoothstep(0.005,0.065,travelPhase));
  float breath = 2.0*travel-0.35;
  float focal = exp(-dot(foot-vec2(0.35,0.58),foot-vec2(0.35,0.58))*24.0);
  float width = 0.0235 + 0.0037*qc + 0.0060*breath + 0.002*focal;
  float aa = 1.4 / min(u_resolution.x,u_resolution.y);
  float body = 1.0 - smoothstep(width-aa,width+aa,best);
  // Glyph dashes are tonal engraving within the uninterrupted main ink.
  float dash = smoothstep(0.24,0.82,sin(TAU*(progress*44.0 + qc*0.18)));
  float inward = 1.0 - smoothstep(width*0.37,width*0.88,best);
  float glyph = dash*inward;
  float strength = clamp(0.78 + 0.16*qc + 0.18*breath + 0.09*focal - 0.16*glyph,0.52,1.0);
  float active = smoothstep(0.12,0.95,breath) * (0.25+0.17*qc);
  float core = 0.17 + 0.69*focal*(0.75+0.25*qc) + 0.12*(1.0-glyph);
  gl_FragColor = vec4(ramp(body*strength,active,core),1.0);
}
