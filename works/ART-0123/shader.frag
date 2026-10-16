precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float gielis(float a, float m, float n1, float n2, float n3) {
  float x = pow(abs(cos(m*a*0.25)), n2);
  float y = pow(abs(sin(m*a*0.25)), n3);
  return pow(max(x+y, 0.0001), -1.0/n1);
}
vec3 contourBands(vec2 q, float tau, float h, float k, float m,
                  float n1, float n2, float n3, float scale, float aa) {
  float a = atan(q.y, q.x) - tau - 0.90*(h-0.5) - 0.42*(k-0.5);
  float r = length(q) / max(0.05, scale*gielis(a, m, n1, n2, n3));
  return vec3(1.0-smoothstep(0.042-aa, 0.042+aa, abs(r-0.50)),
              1.0-smoothstep(0.040-aa, 0.040+aa, abs(r-0.74)),
              1.0-smoothstep(0.038-aa, 0.038+aa, abs(r-1.0)));
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 p = uv * 6.0;
  vec2 id = floor(p);
  vec2 q = fract(p) - 0.5;
  float h = hash21(id + vec2(u_seed*31.71, u_seed*13.49));
  float k = hash21(id + vec2(29.3+u_seed*8.4, 7.8));
  vec2 jitter = 0.08 * vec2(h-0.5, k-0.5);
  q -= jitter;
  float tau = 6.28318530718 * u_time;
  float ca = cos(tau), sa = sin(tau);
  float m = 5.0;
  float n1 = 1.49 + 0.20*ca + 0.17*sa + 0.48*(h-0.5);
  float n2 = 4.1 + 0.95*ca - 0.78*sa + 1.20*(k-0.5);
  float n3 = 4.0 - 0.83*ca + 0.90*sa + 1.12*(h-0.5);
  float angle = atan(q.y, q.x) - tau - 0.90*(h-0.5) - 0.42*(k-0.5);
  float radius = gielis(angle, m, n1, n2, n3);
  float scale = 0.200 + 0.018*(k-0.5) + 0.009*ca*(h-0.5) + 0.008*sa;
  float radial = length(q) / max(0.05, scale*radius);
  // Four subpixel coverage taps retain the contour geometry at sharp tips.
  vec2 pixel = 6.0 / u_resolution;
  float aa = max(0.004, 0.34 * max(pixel.x, pixel.y) / max(0.05, scale*radius));
  vec3 bands = (
    contourBands(q + pixel*vec2(-0.25,-0.25), tau,h,k,m,n1,n2,n3,scale,aa) +
    contourBands(q + pixel*vec2( 0.25,-0.25), tau,h,k,m,n1,n2,n3,scale,aa) +
    contourBands(q + pixel*vec2(-0.25, 0.25), tau,h,k,m,n1,n2,n3,scale,aa) +
    contourBands(q + pixel*vec2( 0.25, 0.25), tau,h,k,m,n1,n2,n3,scale,aa)) * 0.25;
  float band1 = bands.x, band2 = bands.y, band3 = bands.z;
  float ink = max(max(band1*0.72, band2*0.86), band3);
  vec3 bg = vec3(34.0,54.0,166.0)/255.0;
  vec3 ivory = vec3(242.0,238.0,228.0)/255.0;
  vec3 vermilion = vec3(255.0,138.0,70.0)/255.0;
  float inner = 1.0-smoothstep(0.80, 0.84, radial);
  vec3 color = mix(bg, ivory, 0.17*inner);
  // Color only: the existing third contour carries a legible warm role in every cell.
  vec3 lineColor = mix(ivory, vermilion, band3);
  color = mix(color, lineColor, ink);
  gl_FragColor = vec4(color, 1.0);
}
