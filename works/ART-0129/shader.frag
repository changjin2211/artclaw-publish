#ifdef GL_ES
precision highp float;
#endif
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
const float TAU = 6.28318530718;

float hash(float n) {
    return fract(sin(n * 127.1 + u_seed * 311.7) * 43758.5453);
}
vec2 candidate(float i) {
    return vec2(hash(i * 2.0 + 11.0), hash(i * 2.0 + 12.0)) * 6.0;
}
// Matérn inhibition: every surviving pair is at least 1.12 tiles apart.
// Decisions depend only on seed; time never relocates a sample or port.
vec3 influence(vec2 tile) {
    float nearest = 1000.0;
    float chosen = 0.0;
    float distanceToSample = 0.0;
    for (int i = 0; i < 12; i++) {
        vec2 s = candidate(float(i));
        float keep = 1.0;
        for (int j = 0; j < 12; j++) {
            if (j < i) {
                vec2 delta = s - candidate(float(j));
                if (dot(delta, delta) < 1.2544) keep = 0.0;
            }
        }
        float d = length(tile - s);
        if (keep > 0.5 && d < nearest) {
            nearest = d;
            chosen = float(i);
            distanceToSample = d;
        }
    }
    return vec3(hash(chosen + 71.0), hash(chosen + 109.0), distanceToSample);
}
float bayer2(vec2 p) {
    return 2.0 * p.x + 3.0 * p.y - 4.0 * p.x * p.y;
}
float bayer4(vec2 p) {
    p = mod(floor(p), 4.0);
    return (4.0 * bayer2(mod(p, 2.0)) + bayer2(floor(p / 2.0)) + 0.5) / 16.0;
}
// Endpoints are shared mid-edge ports. The deformation and its first
// derivative vanish there, retaining normal boundary tangents at all times.
float bend(vec2 p, vec2 corner, float shape, float widthDelta) {
    vec2 v = abs(p - corner);
    float angle = atan(v.y, v.x);
    float e = sin(2.0 * angle);
    e *= e;
    float radius = 0.5 + shape * e;
    float derivative = shape * 2.0 * sin(4.0 * angle);
    float metric = sqrt(1.0 + derivative * derivative / max(radius * radius, 0.01));
    return (length(v) - radius) / metric;
}
void main() {
    vec2 q = gl_FragCoord.xy / u_resolution * 6.0;
    vec2 tile = floor(q);
    vec2 p = fract(q);
    vec3 inf = influence(tile + 0.5);
    float orientation = step(0.5, fract(inf.x + 0.23 * inf.z));
    vec2 c0 = vec2(0.0, orientation);
    vec2 c1 = vec2(1.0, 1.0 - orientation);
    // One traveling cycle crosses the whole field from left to right.
    // Its integer temporal winding closes exactly at u_time = 1.
    float phase = TAU * (u_time - q.x / 6.0);
    float travel = fract(u_time - q.x / 6.0 + 0.5);
    float swap = smoothstep(0.0, 0.12, travel)
               * (1.0 - smoothstep(0.28, 0.57, travel));
    float a = mix(-0.145, -0.065, inf.y);
    float b = mix(0.085, 0.165, inf.x);
    float shape = mix(a, b, swap) + 0.032 * sin(phase) * swap * (0.4 + inf.y);
    float d0 = bend(p, c0, shape, 0.0);
    float d1 = bend(p, c1, -shape * 0.78, 0.0);
    vec2 corner = abs(d0) < abs(d1) ? c0 : c1;
    vec2 v = abs(p - corner);
    float envelope = sin(2.0 * atan(v.y, v.x));
    envelope *= envelope;
    float halfWidth = 0.12 + 0.022 * envelope * (0.35 + 0.65 * swap);
    float centerDistance = min(abs(d0), abs(d1));
    float edge = centerDistance - halfWidth;
    float px = 6.0 / min(u_resolution.x, u_resolution.y);
    float aa = 0.8 * px;
    float narrowBand = 1.0 - smoothstep(0.0, 1.8 * px, abs(edge));
    float threshold = (bayer4(gl_FragCoord.xy) - 0.5) * 0.48 * px * narrowBand;
    float ink = 1.0 - smoothstep(-aa, aa, edge + threshold);

    // Exactly one selected interior bend; its focal point follows its curve.
    vec2 focalTile = vec2(2.0 + floor(hash(211.0) * 2.0), 2.0);
    vec3 fi = influence(focalTile + 0.5);
    float fo = step(0.5, fract(fi.x + 0.23 * fi.z));
    float focalPhase = TAU * (u_time - (focalTile.x + 0.5) / 6.0);
    float focalTravel = fract(u_time - (focalTile.x + 0.5) / 6.0 + 0.5);
    float focalSwap = smoothstep(0.0, 0.12, focalTravel)
                    * (1.0 - smoothstep(0.28, 0.57, focalTravel));
    float fs = mix(mix(-0.145, -0.065, fi.y), mix(0.085, 0.165, fi.x), focalSwap)
             + 0.032 * sin(focalPhase) * focalSwap * (0.4 + fi.y);
    vec2 fc = vec2(0.0, fo);
    vec2 direction = vec2(0.70710678118, (1.0 - 2.0 * fo) * 0.70710678118);
    vec2 focal = focalTile + fc + direction * (0.5 + fs);
    float focus = exp(-dot(q - focal, q - focal) / 0.19);
    float cadence = 0.5 + 0.5 * sin(q.x * 1.31 + sin(q.y * 1.13) * 0.7);
    float core = 1.0 - smoothstep(0.0, halfWidth, centerDistance);
    float depth = clamp(0.17 + 0.31 * core + 0.13 * cadence + 0.46 * focus
                      + 0.38 * swap, 0.0, 1.0);
    vec3 chalk = vec3(0.9254902, 0.9372549, 0.9137255);
    vec3 lightTeal = vec3(0.55, 0.73, 0.65);
    vec3 verdigris = vec3(0.1803922, 0.4196078, 0.3529412);
    vec3 deepTeal = vec3(0.075, 0.245, 0.207);
    vec3 color = mix(lightTeal, verdigris, smoothstep(0.0, 0.66, depth));
    color = mix(color, deepTeal, smoothstep(0.60, 1.0, depth));
    gl_FragColor = vec4(mix(chalk, color, ink), 1.0);
}
