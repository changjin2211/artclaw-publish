precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

const float TAU = 6.28318530718;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
// A high-passed, low-correlation mask, blended across adjacent contour segments.
float blueMask(vec2 p) {
  vec2 q = p * 4.2 + vec2(u_seed * 127.0, u_seed * 79.0);
  vec2 i = floor(q);
  vec2 f = fract(q);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i) - 0.25 * (hash21(i + vec2(1.,0.)) + hash21(i + vec2(-1.,0.)) + hash21(i + vec2(0.,1.)) + hash21(i + vec2(0.,-1.)));
  float b = hash21(i + vec2(1.,0.)) - 0.25 * (hash21(i + vec2(2.,0.)) + hash21(i) + hash21(i + vec2(1.,1.)) + hash21(i + vec2(1.,-1.)));
  float c = hash21(i + vec2(0.,1.)) - 0.25 * (hash21(i + vec2(1.,1.)) + hash21(i + vec2(-1.,1.)) + hash21(i + vec2(0.,2.)) + hash21(i));
  float d = hash21(i + vec2(1.,1.)) - 0.25 * (hash21(i + vec2(2.,1.)) + hash21(i + vec2(0.,1.)) + hash21(i + vec2(1.,2.)) + hash21(i + vec2(1.,0.)));
  return mix(mix(a,b,f.x), mix(c,d,f.x),f.y);
}
float bayer4(vec2 pixel) {
  vec2 m = mod(floor(pixel), 4.0);
  float x = m.x, y = m.y;
  if (y < 1.0) { if (x < 1.0) return 0.0; if (x < 2.0) return 8.0; if (x < 3.0) return 2.0; return 10.0; }
  if (y < 2.0) { if (x < 1.0) return 12.0; if (x < 2.0) return 4.0; if (x < 3.0) return 14.0; return 6.0; }
  if (y < 3.0) { if (x < 1.0) return 3.0; if (x < 2.0) return 11.0; if (x < 3.0) return 1.0; return 9.0; }
  if (x < 1.0) return 15.0; if (x < 2.0) return 7.0; if (x < 3.0) return 13.0; return 5.0;
}
float foldField(vec2 p) {
  // One fixed local fold creates the focal bend, never seed-dependent.
  vec2 c = p - vec2(-0.37, 0.31);
  float e = exp(-dot(c,c) * 2.7);
  p += e * vec2(0.20 * c.y + 0.10, -0.19 * c.x);
  float s = 0.0;
  for (int j=0; j<5; j++) {
    float a = TAU * float(j) / 5.0;
    s += (0.81 + 0.24 * cos(2.0*a + 0.4)) * cos((4.55 + 0.62 * sin(a + 0.8)) * dot(p, vec2(cos(a),sin(a))) + 0.56 * sin(1.7*a));
  }
  return s * 0.22;
}
void main() {
  vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x,u_resolution.y) * 2.35;
  float t = fract(u_time);
  float field = foldField(p);
  // Integer-spaced level extraction: translation by one level closes exactly.
  float n = blueMask(p);
  float level = field * 3.30 + 0.010 * n - t;
  float phase = fract(level + 0.5) - 0.5;
  float d = abs(phase);

  // A smooth distance coordinate advances along the connected contour network.
  // The local fold bends it with the same scalar field; it never moves the field.
  float path = dot(p, vec2(0.69, 0.76)) * 0.67 + 0.09 * field;
  float travel = fract(t + path);
  float pulse = exp(-pow((travel - 0.5) / 0.115, 2.0));
  // Only finish the crop: taper existing contour strokes as they meet the paper edge.
  float margin = min(min(gl_FragCoord.x, gl_FragCoord.y),
                     min(u_resolution.x - gl_FragCoord.x, u_resolution.y - gl_FragCoord.y));
  float edgeTaper = 1.0 - smoothstep(0.0, 24.0, margin);
  float cornerCleanup = smoothstep(22.0, 35.0, length(gl_FragCoord.xy));
  float rightDist = u_resolution.x - gl_FragCoord.x;
  float rightSliver = (1.0 - smoothstep(28.0, 55.0, rightDist))
    * smoothstep(28.0, 48.0, gl_FragCoord.y)
    * (1.0 - smoothstep(130.0, 150.0, gl_FragCoord.y));
  float width = 0.080 + 0.006 * n + 0.023 * pulse
    - 0.055 * edgeTaper - 0.140 * rightSliver;
  // Structural threshold motion, not merely a traveling tint.
  float aa = 0.007 + 0.006 * length(vec2(foldField(p + vec2(0.004,0.0))-field, foldField(p + vec2(0.0,0.004))-field));
  float band = 1.0 - smoothstep(width-aa, width+aa, d);
  float ink = band * cornerCleanup;
  float rim = (1.0-smoothstep(width+0.005,width+0.050,d)) * (1.0-band)
    * (1.0 - 0.85 * edgeTaper) * cornerCleanup;
  vec3 bone = vec3(0.357,0.420,0.478);  // #5B6B7A, full-field slate
  vec3 violet = vec3(0.910,0.925,0.937); // #E8ECEF, contour light
  vec3 rose = mix(bone, violet, 0.55);    // continuous mid-tone ramp
  vec3 brass = vec3(0.498,0.949,0.784);  // #7FF2C8, passing accent
  vec3 support = vec3(0.118,0.149,0.180); // #1E262E, secondary dark
  float focal = exp(-dot(p-vec2(-0.37,0.31),p-vec2(-0.37,0.31))*1.7);
  float core = ink * (0.63 + 0.30 * focal + 0.08 * pulse);
  vec3 col = mix(bone, support, rim * 0.28);
  col = mix(col, rose, ink * 0.37);
  col = mix(col, violet, core);
  // The gold rides only short, passing stretches of existing ink.
  float gold = ink * pulse * smoothstep(0.12,0.85,focal) * 0.76;
  col = mix(col, brass, gold);
  float edge = rim * (0.10 + 0.13*ink);
  float dither = (bayer4(gl_FragCoord.xy) / 16.0 - 0.5) * 0.019 * edge;
  col += vec3(dither);
  gl_FragColor = vec4(clamp(col,0.0,1.0),1.0);
}
