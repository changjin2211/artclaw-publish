precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

// All geometry is analytic and closes identically at time 0 and 1.
float hash21(vec2 p) {
  return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715))));
}
float ribbon(float distanceToAxis, float halfWidth, float aa) {
  return 1.0 - smoothstep(halfWidth-aa, halfWidth+aa, distanceToAxis);
}
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 z = uv - 0.5;
  // A single diagonally advancing gesture across an unbroken woven sheet.
  vec2 p = vec2(0.968*z.x - 0.250*z.y, 0.250*z.x + 0.968*z.y);
  float spacing = 0.151;
  vec2 q = (p + vec2(0.453)) / spacing;
  vec2 id = floor(q + 0.5);
  vec2 local = (q - id) * spacing;
  // Very shallow common warp: each entire strand remains continuous.
  float dx = local.x - 0.006 * sin(7.0*p.y + 0.35);
  float dy = local.y - 0.006 * sin(7.0*p.x - 0.60);

  float ch = cos(9.424778*p.x)*cos(6.283185*p.y)
           - cos(6.283185*p.x)*cos(9.424778*p.y);
  float pressure = 1.0 - smoothstep(0.02, 0.86, abs(ch));
  float contactBlue = hash21(id + vec2(floor(u_seed*999.0), 37.0));
  float front = u_time < 0.5
    ? pow(2.0*u_time, 0.78)
    : pow(2.0*(1.0-u_time), 1.44);
  float diagonal = clamp(0.5 + 0.61*(p.x+p.y), 0.08, 0.92);
  float activated = smoothstep(diagonal - 0.065, diagonal + 0.065,
                              front + 0.014*(contactBlue-0.5));
  float width = 0.048 + activated*(0.008 + 0.015*pressure
                          + 0.004*(contactBlue-0.5));
  float aa = 1.2 / min(u_resolution.x, u_resolution.y);
  float horizontal = ribbon(abs(dy), width, aa);
  float vertical = ribbon(abs(dx), width, aa);
  float overHorizontal = 1.0 - mod(id.x + id.y, 2.0);
  float cross = horizontal * vertical;
  // The lower band stops at the contact; no detached endpoints are drawn.
  float over = mix(vertical, horizontal, overHorizontal);
  float under = mix(horizontal, vertical, overHorizontal);
  float sheet = over + under*(1.0-over);
  float edgeH = clamp(1.0 - abs(dy)/max(width, 0.001), 0.0, 1.0);
  float edgeV = clamp(1.0 - abs(dx)/max(width, 0.001), 0.0, 1.0);
  float edge = mix(edgeV, edgeH, overHorizontal);
  float contactDepth = cross * (0.15 + 0.55*activated);
  float shade = 0.43 + 0.43*edge + contactDepth*0.15 + 0.05*pressure;
  // Restrict dither to fiber interiors; no free background grain.
  float blue = hash21(mod(gl_FragCoord.xy, 71.0) + vec2(19.0, 31.0));
  shade = clamp(shade + sheet*0.014*(blue-0.5), 0.0, 1.0);
  vec3 bg = vec3(23.0,17.0,26.0)/255.0;
  vec3 ice = vec3(165.0,235.0,233.0)/255.0;
  vec3 mid = mix(bg, ice, 0.31);
  vec3 fiber = mix(mid, ice, smoothstep(0.21, 0.96, shade));
  fiber = mix(fiber, fiber * vec3(0.97, 1.014, 1.019),
              0.32 + 0.28*sin(6.283185*u_time + 2.0*pressure));
  // No isolated warm color at the center; the original woven fiber continues through it.

  vec3 color = mix(bg, fiber, sheet);
  gl_FragColor = vec4(color, 1.0);
}
