// 규칙 하나: 격자의 각 칸이 짧은 획 하나를 갖고, 그 각도만 장(field)을 따른다.
// 회전은 전체가 동시에 도는 것이 아니라 대각선으로 진행하는 위상 파동이다.
// 지배 질량도 반중량도 없다. 한 스케일, 한 규칙, 닫힌 루프.
#ifdef GL_ES
precision highp float;
#endif

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

const float PI = 3.141592653589793;
const float N = 9.0;

float hash21(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 97.3) * 43758.5453123);
}

float capsule(vec2 p, vec2 dir, float halfLen, float radius) {
  float h = clamp(dot(p, dir) / halfLen, -1.0, 1.0) * halfLen;
  return length(p - dir * h) - radius;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
  uv *= 2.0;

  float t = fract(u_time);

  vec2 cell = floor(uv * N);
  vec2 local = fract(uv * N) - 0.5;

  float h = hash21(cell);

  // 공간의 매끄러운 각도 장 — 이웃 칸끼리 연속이라 눈이 흐름으로 읽는다.
  float field = sin(cell.x * 0.31 + u_seed * 3.1) + cos(cell.y * 0.27 - u_seed * 2.3);

  // 대각선으로 흐르는 위상 파동. 칸마다 상수 오프셋이므로 루프는 정확히 닫힌다.
  float wave = dot(normalize(vec2(0.78, 0.62)), cell) * 0.40;
  // 캡슐 획은 180도 회전 대칭이다. 2pi를 돌리면 가시 주기가 0.5로 접혀 루프가 같은 것을
  // 두 번 재생한다. pi만 돌리면 t=1에서 획이 t=0과 겹치므로 루프는 그대로 닫히면서
  // 6초 전체가 한 번의 진행에 쓰인다.
  float angle = field * 0.95 + wave + PI * t + h * 0.35;
  vec2 dir = vec2(cos(angle), sin(angle));

  // 길이는 장의 세기를 따라 조금만 변한다 — 살아 있되 단위는 서로 견줄 만하게.
  float len = 0.27 + 0.07 * (0.5 + 0.5 * sin(field * 1.7));

  float aa = 2.0 / min(u_resolution.x, u_resolution.y) * N;
  float d = capsule(local, dir, len, 0.085);
  float mark = 1.0 - smoothstep(-aa, aa, d);

  vec3 paper = vec3(0xF2, 0xED, 0xE3) / 255.0;
  vec3 ink = vec3(0x1F, 0x23, 0x28) / 255.0;
  vec3 accent = vec3(0xC4, 0x5A, 0x2E) / 255.0;

  // 소수의 칸만 강조색. 장식이 아니라 격자 위의 리듬 표식이다.
  vec3 markColor = mix(ink, accent, step(0.90, h));

  gl_FragColor = vec4(mix(paper, markColor, mark), 1.0);
}
