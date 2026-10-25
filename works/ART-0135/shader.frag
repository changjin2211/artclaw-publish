precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
const float PI = 3.141592653589793;
const float N = 48.0;

vec2 wrapCell(vec2 q) { return mod(q + N, N); }
float initialVariant(vec2 q, float variant) {
  q = wrapCell(q);
  vec2 tile = floor(q / 6.0);
  vec2 local = mod(q, 6.0);
  // Seven tetromino silhouettes; adjacent seeded tile types always differ.
  float kind = mod(3.0 * tile.x + 4.0 * tile.y + floor(u_seed * 997.0) + variant, 7.0);
  float rotation = floor(4.0 * fract(sin(dot(tile + u_seed, vec2(127.1, 311.7))) * 43758.5453));
  vec2 p = local - 1.0;
  if (rotation < 0.5) p = vec2(3.0 - p.y, p.x);
  else if (rotation < 1.5) p = vec2(3.0 - p.x, 3.0 - p.y);
  else if (rotation < 2.5) p = vec2(p.y, 3.0 - p.x);
  float x = p.x, y = p.y;
  float occupied = 0.0;
  if (kind < 0.5) occupied = float(y == 1.0 && x >= 0.0 && x <= 3.0); // I
  else if (kind < 1.5) occupied = float((x == 1.0 || x == 2.0) && (y == 1.0 || y == 2.0)); // O
  else if (kind < 2.5) occupied = float((y == 1.0 && x <= 2.0 && x >= 0.0) || (x == 1.0 && y == 2.0)); // T
  else if (kind < 3.5) occupied = float((y == 1.0 && x <= 2.0 && x >= 0.0) || (x == 2.0 && y == 2.0)); // L
  else if (kind < 4.5) occupied = float((y == 1.0 && x <= 2.0 && x >= 0.0) || (x == 0.0 && y == 2.0)); // J
  else if (kind < 5.5) occupied = float((y == 1.0 && x >= 1.0 && x <= 2.0) || (y == 2.0 && x >= 0.0 && x <= 1.0)); // S
  else occupied = float((y == 1.0 && x >= 0.0 && x <= 1.0) || (y == 2.0 && x >= 1.0 && x <= 2.0)); // Z
  return occupied;
}
float initial(vec2 q) { return initialVariant(q, 0.0); }
float neighborCount(vec2 q) {
  float n = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      if (x != 0 || y != 0) n += initial(q + vec2(float(x), float(y)));
    }
  }
  return n;
}
float nextLife(vec2 q, float old, float neighbors) {
  float born = (1.0 - old) * (1.0 - step(0.5, abs(neighbors - 3.0)));
  float survive = old * step(1.5, neighbors) * (1.0 - step(3.5, neighbors));
  return max(born, survive);
}
vec3 paper() { return vec3(237.0,240.0,243.0)/255.0; }
vec3 deep() { return vec3(30.0,58.0,95.0)/255.0; }
vec3 mid() { return vec3(110.0,140.0,174.0)/255.0; }
vec3 amber() { return vec3(208.0,138.0,44.0)/255.0; }
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  vec2 cellPos = uv * N;
  vec2 q = floor(cellPos);
  vec2 f = fract(cellPos);
  float old = initial(q);
  // Life at the tile site selects one of two distinct next tetrominoes.
  // Screen occupancy stays four squares in both scanned states.
  vec2 site = floor(q / 6.0) * 6.0 + vec2(2.0, 2.0);
  float neighbors = neighborCount(site);
  float newState = initialVariant(q, 1.0 + nextLife(site, initial(site), neighbors));

  // One straight travel gesture: a full 48-column pass on each half-loop.
  float halfPhase = u_time >= 1.0 ? 1.0 : fract(u_time * 2.0);
  float scan = halfPhase * N;
  float distanceToScan = cellPos.x - scan;
  float wake = 1.0 - smoothstep(-0.55, 0.55, distanceToScan);
  float fromState = mix(old, newState, step(0.5, u_time));
  float toState = mix(newState, old, step(0.5, u_time));
  float state = mix(fromState, toState, wake);
  float changing = abs(toState - fromState) * (1.0 - smoothstep(0.0, 1.15, abs(distanceToScan)));
  float breath = 0.68 + 0.32 * sin(2.0 * PI * u_time);

  // Insets separate cells without drawing an independent grid.
  float edge = min(min(f.x, 1.0 - f.x), min(f.y, 1.0 - f.y));
  float aa = max(0.006, 1.2 / min(u_resolution.x, u_resolution.y));
  float body = smoothstep(0.018 - aa, 0.018 + aa, edge);
  float inner = smoothstep(0.11, 0.33, edge);
  float nearCenter = exp(-dot(uv - vec2(0.5), uv - vec2(0.5)) * 16.0);
  // Existing cell shading stays attached to persistent and newly appearing tetromino squares.
  float persistent = fromState * toState;
  float arriving = (1.0 - fromState) * toState * wake;
  vec3 ink = mix(mid(), deep(), clamp(0.47 + 0.32 * inner + 0.17 * nearCenter - 0.24 * persistent + 0.10 * arriving * sin(PI * halfPhase), 0.0, 1.0));
  float bayer = mod(q.x + 2.0 * q.y, 4.0) / 4.0 - 0.375;
  float narrow = (1.0 - smoothstep(0.01, 0.05, abs(edge - 0.018)));
  float fill = clamp(body * state + narrow * bayer * 0.045 * state, 0.0, 1.0);
  vec3 color = mix(paper(), ink, fill);
  float tinyCore = smoothstep(0.31, 0.34, edge);
  float accent = changing * breath * body * tinyCore * 0.27 * (0.32 + 0.68 * nearCenter);
  color = mix(color, amber(), accent);
  gl_FragColor = vec4(color, 1.0);
}
