precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

const float PI = 3.141592653589793;
const float GOLDEN = 2.399963229728653;
const float COUNT = 128.0;

float hash1(float x) { return fract(sin(x * 127.1 + u_seed * 391.67) * 43758.5453); }
vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c*p.x-s*p.y,s*p.x+c*p.y); }
vec2 site(float index, float phase) {
  float a = index * GOLDEN;
  float radius = 1.15 * sqrt((index + 0.5) / COUNT);
  return rot(radius * vec2(cos(a), sin(a)), phase);
}
float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 d = b - a;
  return length(p-a-d*clamp(dot(p-a,d)/max(dot(d,d),0.00001),0.0,1.0));
}
// Clip only the visible part of an existing stroke to an inset box.
// Its centerline and neighbors stay fixed; both visible ends retain round caps.
float finishedSegment(vec2 p, vec2 a, vec2 b, float width, float aa, float inset) {
  vec2 d = b-a;
  vec2 safeD = d + vec2(d.x >= 0.0 ? 0.000001 : -0.000001,
                        d.y >= 0.0 ? 0.000001 : -0.000001);
  vec2 lo = (-vec2(inset)-a)/safeD;
  vec2 hi = ( vec2(inset)-a)/safeD;
  float first = max(0.0,max(min(lo.x,hi.x),min(lo.y,hi.y)));
  float last = min(1.0,min(max(lo.x,hi.x),max(lo.y,hi.y)));
  if (last <= first) return 0.0;
  return 1.0-smoothstep(width-aa,width+aa,
                        segmentDistance(p,a+d*first,a+d*last));
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) * (2.0 / min(u_resolution.x,u_resolution.y));
  float t = fract(u_time);
  float angle = 2.0 * PI * t;
  // A single sweep travels right->left->right; each site switches twice.
  float front = 1.33 * cos(angle);
  float carbon = 0.0;
  float heat = 0.0;
  vec3 strokeInk = vec3(21.0)/255.0;
  for (int n = 0; n < 128; n++) {
    float i = float(n);
    vec2 canonical = site(i,0.0);
    vec2 a = site(i,angle);
    if (length(p-a) > 0.165) continue;
    float idx8 = i < 120.0 ? i+8.0 : i-8.0;
    float idx13 = i < 115.0 ? i+13.0 : i-13.0;
    vec2 b0 = site(idx8,angle);
    vec2 b1 = site(idx13,angle);
    vec2 v0 = b0-a;
    vec2 v1 = b1-a;
    float localDensity = clamp(0.12/(0.045+min(length(v0),length(v1))),0.4,1.0);
    // The jitter affects only threshold and mark weight, never placement.
    float blue = hash1(mod(i*73.0,127.0)) - 0.5;
    float boundary = front + blue*0.025;
    float state = smoothstep(-0.022,0.022,canonical.x-boundary);
    // Retain the center weight; grow the same round-capped strokes toward the outer spiral.
    float radialWeight = mix(1.0,1.8,smoothstep(0.08,1.10,length(a)));
    float width = (0.0064+0.0027*localDensity)*(1.0+blue*0.15)*radialWeight;
    float reach0 = clamp(0.94/ max(length(v0),0.001),0.0,0.96);
    float reach1 = clamp(0.94/ max(length(v1),0.001),0.0,0.96);
    // Limit tip to part of neighbor gap, preserving breathing gutters.
    float outer = smoothstep(0.82,1.01,max(abs(a.x),abs(a.y)));
    float reachCap = mix(0.91,0.78,outer);
    vec2 tip0 = a + v0*min(reach0,reachCap);
    vec2 tip1 = a + v1*min(reach1,reachCap);
    float aa = 1.25 * (2.0 / min(u_resolution.x,u_resolution.y));
    // Slightly stagger the cap positions so the outer glyphs do not form a box.
    float inset = 0.925 + 0.030*hash1(i*19.0+11.0);
    float mark0 = finishedSegment(p,a,tip0,width,aa,inset);
    float mark1 = finishedSegment(p,a,tip1,width,aa,inset);
    float hub = (1.0-smoothstep(width*1.25-aa,width*1.25+aa,length(p-a)))
                * (1.0-step(inset,max(abs(a.x),abs(a.y))));
    // Select one neighbor at the moving front, never draw a translucent second path.
    float mark = max(hub,mix(mark0,mark1,step(0.5,state)));
    float edge = 1.0-smoothstep(0.980,0.995,max(abs(p.x),abs(p.y)));
    float densityInk = (0.78+0.22*localDensity)*mark*edge;
    // Stable, distinct pigment for each existing site; geometry is unchanged.
    float hue = fract(i*0.61803398875 + u_seed*0.17);
    vec3 hueRgb = clamp(abs(mod(hue*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0,0.0,1.0);
    if (densityInk > carbon) strokeInk = vec3(0.04) + 0.32*hueRgb;
    carbon = max(carbon,densityInk);
    float transition = 1.0-smoothstep(0.015,0.11,abs(canonical.x-boundary));
    float active = transition * smoothstep(0.56,0.84,localDensity);
    heat = max(heat,mark*active*edge*0.8);
  }
  vec3 paper = vec3(243.0,243.0,241.0)/255.0;
  vec3 rust = vec3(180.0,74.0,42.0)/255.0;
  // Heat is a temperature of the existing ink, not a second motif.
  vec3 pigment = mix(strokeInk,rust,clamp(heat,0.0,0.85));
  gl_FragColor = vec4(mix(paper,pigment,clamp(carbon,0.0,1.0)),1.0);
}
