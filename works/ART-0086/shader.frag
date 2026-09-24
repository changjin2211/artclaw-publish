precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 91.7) * 43758.5453123);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * u_resolution) / min(u_resolution.x, u_resolution.y);
    float t = u_time * 6.28318530718;
    vec2 warp = vec2(sin(uv.y * 7.0 + t), cos(uv.x * 7.0 - t));
    float v = sin((uv.x + uv.y) * 9.0 + length(warp) * 5.0 + t);
    vec3 col = 0.5 + 0.5 * cos(v + vec3(0.0, 2.1, 4.2) + t);
    col *= 0.85 + 0.15 * hash(gl_FragCoord.xy);
    gl_FragColor = vec4(col, 1.0);
}
