precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
uniform float u_frame;
uniform sampler2D u_prev;

#define PI 3.141592653589793
#define TAU 6.283185307179586

float hash11(float n){
  return fract(sin(n * 127.113 + u_seed * 311.719) * 43758.5453123);
}

vec2 rot(vec2 p, float a){
  float c = cos(a), s = sin(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

float sdSegment(vec2 p, vec2 a, vec2 b){
  vec2 pa = p - a;
  vec2 ba = b - a;
  float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * h);
}

vec3 ramp(float v, float accent){
  vec3 bone = vec3(0.9098, 0.8863, 0.8235); // #E8E2D2
  vec3 pale = vec3(0.660, 0.680, 0.560);
  vec3 moss = vec3(0.115, 0.165, 0.125); // deeper dark end
  vec3 ochre = vec3(0.6902, 0.4902, 0.1961); // #B07D32
  vec3 c = mix(bone, pale, smoothstep(0.05, 0.55, v));
  c = mix(c, moss, smoothstep(0.22, 0.68, v));
  c = mix(c, ochre, clamp(accent, 0.0, 1.0));
  return c;
}

vec2 phyPoint(float i, float count){
  float k = i + 0.5;
  float ga = 2.399963229728653;
  float baseR = sqrt(k / count);
  float band = sin(k * 0.31 + u_seed * TAU);
  float relax = mix(0.018, 0.052, hash11(90.0));
  float r = baseR + relax * band * (1.0 - baseR) * baseR;
  float a = k * ga + u_seed * TAU * 0.73;
  vec2 p = vec2(cos(a), sin(a)) * r;
  p = rot(p, (u_seed - 0.5) * 0.45);
  p.x *= 1.04;
  p.y *= 0.98;
  return p;
}

float gestureDistance(vec2 p){
  float d = 9.0;
  d = min(d, sdSegment(p, vec2(-0.62, -0.32), vec2(-0.46, -0.18)));
  d = min(d, sdSegment(p, vec2(-0.46, -0.18), vec2(-0.06,  0.04)));
  d = min(d, sdSegment(p, vec2(-0.06,  0.04), vec2( 0.38,  0.22)));
  d = min(d, sdSegment(p, vec2( 0.38,  0.22), vec2( 0.56,  0.34)));
  return d;
}

float gestureProgress(vec2 p){
  vec2 axis = normalize(vec2(1.0, 0.58));
  return clamp(dot(p, axis) * 0.58 + 0.50, 0.0, 1.0);
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  p *= 2.05;

  float count = 104.0;
  float d1 = 9.0;
  float d2 = 9.0;
  float nearest = 0.0;
  vec2 center = vec2(0.0);
  for(int i = 0; i < 104; i++){
    float fi = float(i);
    vec2 q = phyPoint(fi, count);
    float local = length(p - q);
    if(local < d1){
      d2 = d1;
      d1 = local;
      nearest = fi;
      center = q;
    } else if(local < d2){
      d2 = local;
    }
  }

  float px = 2.0 / min(u_resolution.x, u_resolution.y);
  float cell = 1.0 - smoothstep(0.060, 0.145, d1);
  float unitCore = 1.0 - smoothstep(0.046, 0.108, d1);
  float boundary = 1.0 - smoothstep(0.010, 0.055, d2 - d1);

  float gdist = gestureDistance(center);
  float gcore = 1.0 - smoothstep(0.030, 0.245, gdist);
  float gwide = 1.0 - smoothstep(0.160, 0.520, gdist);
  float order = gestureProgress(center);

  float phase = fract(u_time + 0.018 * sin(u_seed * TAU));
  float head = fract(phase + 0.12);
  float travel = abs(order - head);
  travel = min(travel, 1.0 - travel);
  float movingFront = 1.0 - smoothstep(0.030, 0.240, travel);

  float localDelay = 0.09 * sin(nearest * 0.19 + u_seed * TAU);
  float state = fract(phase + order * 0.66 + localDelay);
  float accumulate = smoothstep(0.08, 0.74, state) * (1.0 - smoothstep(0.86, 0.985, state));
  float saturate = smoothstep(0.58, 0.86, state) * (1.0 - smoothstep(0.86, 0.98, state));
  float reset = smoothstep(0.78, 0.91, state) * (1.0 - smoothstep(0.91, 0.995, state));

  vec2 lp = p - center;
  float hatchAngle = mix(-0.70, 0.78, hash11(floor(nearest / 5.0) + 4.0));
  vec2 hp = rot(lp, hatchAngle + 0.28 * sin(order * PI));
  float density = mix(15.0, 32.0, accumulate + 0.35 * gcore);
  float stripe = abs(fract(hp.y * density + nearest * 0.071) - 0.5);
  float hatch = 1.0 - smoothstep(0.022, 0.074, stripe);
  float hatchMask = smoothstep(0.116, 0.010, abs(hp.x)) * unitCore;

  float ring = (1.0 - smoothstep(0.007, 0.028, abs(d1 - (0.036 + 0.015 * saturate)))) * unitCore;
  float scaffold = max(boundary * 0.18, max(hatch * hatchMask, ring * 0.22));
  float gesture = scaffold * mix(0.24, 0.88, gwide) + unitCore * gcore * movingFront * 0.10;

  float ochreGate = reset * gcore * hatch * unitCore * step(0.66, hash11(nearest + 19.0));
  float heat = clamp(0.08 * boundary + 0.06 * cell + 0.14 * unitCore + 0.82 * gesture * (0.34 + 0.66 * accumulate) + 0.24 * saturate * gcore, 0.0, 1.0);

  vec3 current = ramp(heat, ochreGate * 0.72);
  vec3 bone = vec3(0.9098, 0.8863, 0.8235);
  vec3 prev = texture2D(u_prev, uv).rgb;

  float globalReset = smoothstep(0.82, 0.94, phase);
  float decay = mix(0.945, 0.46, globalReset);
  vec3 accumulated = mix(bone, prev, decay);
  vec3 color = min(vec3(0.96), mix(accumulated, current, 0.42 + 0.44 * heat + 0.14 * movingFront));

  float paperGrain = (hash11(floor(gl_FragCoord.x * 0.5) + floor(gl_FragCoord.y * 0.5) * 113.0) - 0.5) * 0.020;
  float edgeFade = smoothstep(1.34, 0.86, length(p));
  color = mix(bone, color, 0.86 + 0.14 * edgeFade);
  color += paperGrain;
  color = clamp(color, 0.0, 1.0);

  gl_FragColor = vec4(color, 1.0);
}
