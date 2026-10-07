precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

const float PI = 3.141592653589793;

float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32 + u_seed * 17.17);
    return fract(p.x * p.y);
}

vec2 wrapCell(vec2 c, float n) {
    return mod(mod(c, n) + n, n);
}

float phaseSeed(vec2 cell, float n) {
    vec2 c = wrapCell(cell, n);
    float h = hash21(c + floor(u_seed * 997.0));
    vec2 q = (c + 0.5) / n;
    vec2 knot = vec2(0.31 + 0.12 * sin(u_seed * 6.2831), 0.63 + 0.10 * cos(u_seed * 5.113));
    float d = length(q - knot);
    float ignition = smoothstep(0.34, 0.02, d);
    float diagonal = smoothstep(-0.15, 0.35, q.x * 0.82 + (1.0 - q.y) * 0.58 - 0.38);
    return floor(mod(h * 12.0 + ignition * 3.0 + diagonal * 2.0, 12.0));
}

float primitiveAlive(vec2 cell, float gen, float n) {
    float ph = phaseSeed(cell, n);
    float delta = abs(mod(ph - gen + 18.0, 12.0) - 6.0);
    float pulse = 1.0 - step(1.35, delta);
    float ember = step(0.77, hash21(wrapCell(cell, n) * 1.71 + 9.0));
    return max(pulse, ember * step(delta, 2.15) * 0.65);
}

float neighborPrimitive(vec2 cell, float gen, float n) {
    float s = 0.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            if (x == 0 && y == 0) continue;
            s += primitiveAlive(cell + vec2(float(x), float(y)), gen, n);
        }
    }
    return s;
}

float caAlive(vec2 cell, float gen, float n) {
    float a = primitiveAlive(cell, gen, n);
    float nb = neighborPrimitive(cell, gen - 1.0, n);
    float survive = a * step(1.65, nb) * (1.0 - step(4.35, nb));
    float born = (1.0 - a) * smoothstep(2.35, 3.05, nb) * (1.0 - smoothstep(3.85, 4.65, nb));
    float crowded = a * smoothstep(4.1, 5.7, nb) * 0.35;
    return clamp(max(survive, born) + crowded, 0.0, 1.0);
}

float fieldAlive(vec2 cell, float gen, float n) {
    // A second local evaluation tightens the transition without adding another visual system.
    float a = caAlive(cell, gen, n);
    float nb = 0.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            if (x == 0 && y == 0) continue;
            nb += caAlive(cell + vec2(float(x), float(y)), gen, n);
        }
    }
    float birthRim = (1.0 - a) * smoothstep(2.55, 3.25, nb) * (1.0 - smoothstep(4.05, 4.7, nb));
    float survival = a * step(1.5, nb) * (1.0 - step(4.85, nb));
    return clamp(max(survival, birthRim), 0.0, 1.0);
}

float neighborContrast(vec2 cell, float gen, float n, float center) {
    float e = 0.0;
    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            if (x == 0 && y == 0) continue;
            float v = fieldAlive(cell + vec2(float(x), float(y)), gen, n);
            e += abs(center - v);
        }
    }
    return clamp(e / 4.5, 0.0, 1.0);
}

float lineDistance(vec2 f) {
    vec2 d = abs(f - 0.5);
    return min(d.x, d.y);
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    float loop = fract(u_time);
    float gen = floor(loop * 12.0);
    float breathe = 0.5 + 0.5 * sin(2.0 * PI * loop);

    float n = 24.0;
    vec2 grid = uv * n;
    vec2 cell = floor(grid);
    vec2 f = fract(grid);

    float center = fieldAlive(cell, gen, n);
    float edgeSignal = neighborContrast(cell, gen, n, center);
    float nextGen = mod(gen + 1.0, 12.0);
    float future = fieldAlive(cell, nextGen, n);
    float transition = abs(future - center);

    vec2 knot = vec2(0.31 + 0.12 * sin(u_seed * 6.2831), 0.63 + 0.10 * cos(u_seed * 5.113));
    float focal = smoothstep(0.50, 0.03, length(uv - knot));
    float phasePath = smoothstep(0.12, -0.015, abs((uv.x * 0.82 + (1.0 - uv.y) * 0.58) - 0.54));

    // Reworked for form gate: each CA unit is an isolated, contrast-bearing capsule inside
    // its own cell. Dark gutters stay unpainted, so the blurred silhouette reads many
    // repeated units instead of one merged reaction surface.
    vec2 d = abs(f - 0.5);
    float aa = 2.2 / min(u_resolution.x, u_resolution.y) + 0.010;
    float body = smoothstep(0.405, 0.405 - aa, max(d.x, d.y));
    float core = smoothstep(0.245, 0.245 - aa, max(d.x, d.y));
    float innerVoid = smoothstep(0.115, 0.115 + aa, max(d.x, d.y));
    float ring = body * innerVoid;

    float hbar = (1.0 - smoothstep(0.060, 0.060 + aa, abs(f.y - 0.5)))
      * smoothstep(0.18, 0.26, f.x) * (1.0 - smoothstep(0.74, 0.82, f.x));
    float vbar = (1.0 - smoothstep(0.060, 0.060 + aa, abs(f.x - 0.5)))
      * smoothstep(0.18, 0.26, f.y) * (1.0 - smoothstep(0.74, 0.82, f.y));
    float hatch = max(hbar, vbar) * (0.35 + 0.65 * edgeSignal);

    float liveUnit = max(center * (0.55 + 0.25 * phasePath), edgeSignal * 0.58);
    float wakeUnit = transition * smoothstep(0.22, 0.74, edgeSignal + center) * (0.35 + 0.65 * breathe);
    float unit = clamp(ring * liveUnit + core * wakeUnit * 0.85 + hatch * max(center, transition) * 0.45, 0.0, 1.0);

    // Seed-ordered anchors keep all quadrants populated without forming a wallpaper grid:
    // sparse ember cells remain tied to the same CA rule and phase lattice.
    float ph = phaseSeed(cell, n);
    float emberPhase = 1.0 - step(1.15, abs(mod(ph - gen + 18.0, 12.0) - 6.0));
    float ember = step(0.84, hash21(wrapCell(cell, n) * 2.13 + 31.0)) * emberPhase;
    unit = max(unit, body * ember * 0.42);

    float ignition = unit * (0.72 + 0.20 * focal + 0.18 * phasePath);
    float face = body * center * 0.22 + ring * edgeSignal * 0.16;

    vec3 ink = vec3(0.0706, 0.0745, 0.0980);      // #121319
    vec3 umber = vec3(0.4196, 0.3725, 0.1725);    // #6B5F2C
    vec3 saffron = vec3(0.7882, 0.7059, 0.2275);  // #C9B43A
    vec3 paper = vec3(0.9098, 0.8627, 0.6275);    // #E8DCA0
    vec3 blue = vec3(0.2431, 0.4980, 0.6510);     // #3E7FA6

    vec3 col = ink;
    col = mix(col, umber, clamp(face * 2.3 + unit * 0.22, 0.0, 1.0));
    col = mix(col, saffron, clamp(ignition * 0.90, 0.0, 1.0));
    col = mix(col, paper, clamp(unit * focal * 0.18 + wakeUnit * 0.08, 0.0, 1.0));

    float blueRim = ring * edgeSignal * transition * (0.45 + 0.35 * sin(2.0 * PI * loop + ph * 0.41));
    col = mix(col, blue, clamp(blueRim * 0.55, 0.0, 0.58));

    float checker = mod(gl_FragCoord.x + gl_FragCoord.y, 2.0) * 2.0 - 1.0;
    col += checker * 0.0028 * (0.25 + unit);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
}
