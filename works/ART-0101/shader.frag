precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define PI 3.141592653589793

float hash11(float n){ return fract(sin(n) * 43758.5453123); }
float hash21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
vec2 hash22(vec2 p){
  return fract(sin(vec2(dot(p, vec2(269.5, 183.3)), dot(p, vec2(113.5, 271.9)))) * 43758.5453);
}
vec3 hexColor(float r, float g, float b){ return vec3(r, g, b) / 255.0; }

vec2 featurePoint(vec2 cell){
  vec2 h = hash22(cell + u_seed * 19.73);
  vec2 centered = h - 0.5;
  float relax = 0.24 + 0.05 * sin(cell.x * 1.27 + cell.y * 1.83 + u_seed * 6.2831);
  vec2 p = cell + 0.5 + centered * relax;
  p += 0.026 * vec2(sin(cell.y * 2.13 + u_seed * 4.4), cos(cell.x * 1.77 - u_seed * 5.3));
  return p;
}

void main(){
  vec2 res = u_resolution;
  vec2 uv = gl_FragCoord.xy / res.xy;
  vec2 p = (gl_FragCoord.xy - 0.5 * res.xy) / min(res.x, res.y);

  // Rework: denser 7x7 relaxed cell field and cell-phase propagation replace the old
  // single diagonal sweep that over-weighted the upper-left cover quadrant.
  float gridN = 7.0;
  vec2 gp = uv * gridN;
  vec2 base = floor(gp);

  float d1 = 100.0;
  float d2 = 100.0;
  vec2 bestCell = vec2(0.0);
  vec2 bestFeature = vec2(0.0);
  for(int j=-1; j<=1; j++){
    for(int i=-1; i<=1; i++){
      vec2 c = base + vec2(float(i), float(j));
      vec2 fp = featurePoint(c);
      vec2 diff = gp - fp;
      float d = dot(diff, diff);
      if(d < d1){
        d2 = d1;
        d1 = d;
        bestCell = c;
        bestFeature = fp;
      } else if(d < d2){
        d2 = d;
      }
    }
  }

  float dist1 = sqrt(d1);
  float dist2 = sqrt(d2);
  float boundary = dist2 - dist1;
  float edge = 1.0 - smoothstep(0.014, 0.066, boundary);
  float fineEdge = 1.0 - smoothstep(0.003, 0.029, boundary);

  float cellHash = hash21(bestCell + u_seed * 29.0);
  vec2 scanDir = normalize(vec2(0.79, 0.61));
  float scan = dot(uv, scanDir);
  float phase = fract(cellHash * 0.71 + scan * 0.82 - u_time);
  float front = exp(-pow((phase - 0.50) / 0.105, 2.0));
  float wake = exp(-pow((phase - 0.69) / 0.19, 2.0));
  float pre = exp(-pow((phase - 0.33) / 0.16, 2.0));
  float pulse = clamp(0.54 * front + 0.22 * wake + 0.16 * pre, 0.0, 1.0);

  // A persistent support lattice keeps all quadrants legible; temporal energy only thickens
  // selected cell edges, so no frame collapses into a sparse diagonal band.
  float pressure = 0.5 + 0.5 * sin(PI * 2.0 * (cellHash + u_time * 0.73));
  float faceTone = 0.14 + 0.08 * pressure + 0.12 * pulse;

  float angle = mix(-0.70, 0.86, hash11(cellHash * 47.0 + 3.0));
  vec2 dir = vec2(cos(angle), sin(angle));
  float localLine = dot(p, dir) * (46.0 + 28.0 * pulse + 8.0 * pressure) + cellHash * 11.0;
  float wave = abs(fract(localLine) - 0.5);
  float hatchLine = 1.0 - smoothstep(0.033, 0.092, wave);
  float cellInterior = smoothstep(0.032, 0.15, boundary);
  float hatchMask = hatchLine * cellInterior * (0.22 + 0.52 * pulse + 0.12 * pressure);

  // Narrow paper margin only trims renderer edge residue; it no longer erases whole corners.
  float margin = smoothstep(0.00, 0.055, uv.x) * smoothstep(0.00, 0.055, uv.y) *
                 smoothstep(0.00, 0.055, 1.0 - uv.x) * smoothstep(0.00, 0.055, 1.0 - uv.y);
  edge *= margin;
  fineEdge *= margin;
  hatchMask *= margin;

  vec3 paper = hexColor(241.0, 237.0, 228.0);
  vec3 umberDark = hexColor(76.0, 49.0, 31.0);
  vec3 umberLight = hexColor(169.0, 139.0, 104.0);
  vec3 ochre = hexColor(196.0, 159.0, 88.0);
  vec3 violet = hexColor(95.0, 55.0, 146.0);

  vec3 ink = mix(umberLight, umberDark, 0.56 + 0.32 * pulse + 0.09 * pressure);
  vec3 col = paper;
  col = mix(col, ochre, clamp(faceTone * cellInterior * margin, 0.0, 0.34));
  col = mix(col, ink, clamp(edge * (0.40 + 0.28 * pulse), 0.0, 0.82));
  col = mix(col, umberDark, clamp(hatchMask * (0.48 + 0.30 * pulse), 0.0, 0.78));

  float segment = smoothstep(0.62, 0.90, sin((cellHash * 6.0 + dot(uv, vec2(6.0, -4.0))) * PI * 2.0) * 0.5 + 0.5);
  float violetRim = fineEdge * segment * smoothstep(0.38, 0.50, phase) * (1.0 - smoothstep(0.58, 0.72, phase));
  col = mix(col, violet, clamp(violetRim * (0.18 + 0.72 * front), 0.0, 0.72));

  float tooth = (hash21(floor(uv * res.xy * 0.45) + bestCell) - 0.5) * 0.008;
  col += tooth;

  gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
