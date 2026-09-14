precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define PI 3.141592653589793

float hash11(float p) {
  return fract(sin(p * 127.1 + u_seed * 931.7) * 43758.5453123);
}

vec3 hexColor(float r, float g, float b) { return vec3(r, g, b) / 255.0; }

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  vec2 p = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
  float t = fract(u_time);
  float cyclePhase = 2.0 * PI * t;

  // 규칙 그리드: 소용돌이를 화면 전체에 고르게 배치
  // (lattice 4x4, 각 셀 중심에 나선 소용돌이 anchor)
  vec2 cell = vec2(4.0, 4.0);
  vec2 cellSize = vec2(2.0, 2.0) / cell;
  vec2 cellF = (p + 1.0) / cellSize;          // -1..1 -> 0..4
  vec2 cellId = floor(cellF);
  vec2 inCell = fract(cellF) - 0.5;           // 셀 내부 좌표 (-0.5..0.5)
  float cidx = cellId.x + cellId.y * cell.x;
  // 규칙 배치 유지하되, 셀 단위로 회전 방향·위상·나선 매개변수를 seed로 살짝 변형
  float spin = sign(hash11(cidx + 3.0) - 0.5);      // 회전 방향 (+/-)
  float ang0 = hash11(cidx + 9.0) * 2.0 * PI;       // 초기 회전각
  float rad = 0.78 + 0.24 * hash11(cidx + 17.0);    // 소용돌이 반경(셀 기준)
  float freq = 9.5 + 3.5 * hash11(cidx + 25.0);     // 줄무늬 주파수
  float localDelay = hash11(cidx + 33.0) * 0.25;    // 국소 시차

  float ph = fract(t - localDelay);
  float ph2 = 2.0 * PI * ph;
  // 성장-붕괴 창: 소용돌이가 자랐다가 같은 위치에서 붕괴
  float grow = smoothstep(0.02, 0.28, ph) * (1.0 - smoothstep(0.55, 0.92, ph));

  // 나선 좌표: 셀 중심 기준 극좌표 + 나선 비틀림
  vec2 dd = inCell * 2.0;
  float r = length(dd);
  float angle = atan(dd.y, dd.x);
  // 나선 비틀림: 회전각이 반지름에 따라 선형 증가 + 시간에 따라 천천히 회전
  float spiralAngle = angle * spin + r * (5.0 + freq * 0.3) + ang0 * spin + cyclePhase * spin;
  // 소용돌이 줄무늬: 나선을 따라가는 밴드
  float stripe = 0.5 + 0.5 * sin(spiralAngle * (2.0 + freq * 0.2) + ang0);
  // 반지름에 따른 소용돌이 폭(코어가 뚜렷하고 가장자리로 퍼짐)
  float swirlCore = exp(-(r * r) / (0.16 + 0.38 * grow));
  float swirlSpokes = smoothstep(0.04, 0.18, r) * smoothstep(0.92, 0.70, r);
  float reaction = swirlSpokes * (0.45 + 0.55 * stripe) * swirlCore * (0.35 + 0.65 * grow);

  // 셀 경계는 부드럽게 이어지도록: 셀 내부 소용돌이가 가장자리에서 감쇠
  reaction *= smoothstep(0.56, 0.46, length(inCell)) * 0.5 + 0.5;

  // 열점(crest): 나선 밴드가 겹치는 고휘도 — 소용돌이 코어의 국소 peak
  float crest = smoothstep(0.80, 0.97, stripe) * swirlCore * grow;
  float residue = (1.0 - grow) * swirlCore * (0.25 + 0.35 * stripe);

  // 준결정 변조는 약하게 남겨 나선 방향에 미세한 이등분선 변화만 (선택적)
  float q = 0.0;
  for (int k = 0; k < 5; k++) {
    float fk = float(k);
    float a = 2.0 * PI * fk / 5.0 + 0.17 * sin(u_seed * 8.0);
    vec2 dir = vec2(cos(a), sin(a));
    q += cos(dot(p, dir) * 7.0 + 1.7 * sin(a + u_seed));
  }
  q /= 5.0;
  reaction += q * 0.04 * swirlSpokes;   // 미세한 위상 리플만

  float density = clamp(reaction * 0.80 + residue * 0.40, 0.0, 1.0);

  vec3 bg = hexColor(37.0, 38.0, 33.0);       // #252621 warm graphite paper
  vec3 low = hexColor(47.0, 111.0, 115.0);    // #2F6F73 oxidized blue-green
  vec3 mid = hexColor(179.0, 122.0, 46.0);    // #B37A2E mineral ochre
  vec3 high = hexColor(211.0, 75.0, 46.0);    // #D34B2E heated vermilion
  vec3 peakCol = hexColor(226.0, 200.0, 91.0);// #E2C85B pale sulphur

  vec3 color = bg;
  float lowInk = smoothstep(0.05, 0.30, density);
  float midInk = smoothstep(0.34, 0.66, reaction + density * 0.10);
  float highInk = smoothstep(0.66, 0.92, crest + reaction * 0.30);
  float peakInk = smoothstep(0.84, 1.00, crest * smoothstep(0.86, 0.96, stripe));

  color = mix(color, low, lowInk * 0.62);
  color = mix(color, mid, midInk * 0.60);
  color = mix(color, high, highInk * 0.72);
  color = mix(color, peakCol, min(peakInk, 0.7));

  // 종이 질감은 미세하게만
  float paper = (hash11(floor(uv.x * 720.0) + floor(uv.y * 720.0) * 911.0) - 0.5) * 0.014;
  color += paper * (1.0 - lowInk * 0.4);
  color = clamp(color, 0.0, 1.0);
  gl_FragColor = vec4(color, 1.0);
}
