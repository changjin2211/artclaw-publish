precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define PI 3.14159265358979323846
#define TAU 6.28318530717958647692

float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 33.33 + u_seed * 0.013);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p) {
    float n = hash21(p);
    return fract(vec2(n, n * 1.2154 + 0.317) * vec2(13.73, 8.41));
}

float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
    float s = 0.0;
    float a = 0.52;
    mat2 r = mat2(0.82, -0.57, 0.57, 0.82);
    for (int i = 0; i < 5; i++) {
        s += a * valueNoise(p);
        p = r * p * 2.03 + vec2(4.17, -3.31);
        a *= 0.49;
    }
    return s;
}

// Distance to the nearest and second-nearest sediment nuclei.
vec3 voronoi(vec2 x, vec2 orbit) {
    vec2 n = floor(x);
    vec2 f = fract(x);
    float f1 = 9.0;
    float f2 = 9.0;
    float id = 0.0;
    for (int j = -1; j <= 1; j++) {
        for (int i = -1; i <= 1; i++) {
            vec2 g = vec2(float(i), float(j));
            vec2 h = hash22(n + g);
            float ph = TAU * hash21(n + g + 17.7);
            // Every cell moves on a closed, differently oriented tidal orbit.
            vec2 drift = 0.16 * vec2(
                orbit.x * cos(ph) - orbit.y * sin(ph),
                orbit.x * sin(ph) + orbit.y * cos(ph)
            );
            vec2 d = g + 0.18 + 0.64 * h + drift - f;
            float q = dot(d, d);
            if (q < f1) {
                f2 = f1;
                f1 = q;
                id = hash21(n + g + 91.3);
            } else if (q < f2) {
                f2 = q;
            }
        }
    }
    return vec3(sqrt(f1), sqrt(f2), id);
}

vec3 palette(float t) {
    vec3 deepSilt = vec3(0.055, 0.105, 0.115);
    vec3 wetClay  = vec3(0.175, 0.245, 0.235);
    vec3 ochreSand = vec3(0.665, 0.505, 0.285);
    vec3 shellLime = vec3(0.835, 0.775, 0.610);
    vec3 c = mix(deepSilt, wetClay, smoothstep(0.02, 0.38, t));
    c = mix(c, ochreSand, smoothstep(0.34, 0.72, t));
    c = mix(c, shellLime, smoothstep(0.74, 1.0, t));
    return c;
}

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 uv = (2.0 * frag - u_resolution.xy) / max(u_resolution.y, 1.0);
    float phase = TAU * u_time;
    vec2 orbit = vec2(cos(phase), sin(phase));
    float seed = u_seed * 0.071;

    // MACRO: a coastal basin bent by two broad, closed tidal currents.
    vec2 basinP = uv;
    float coastNoise = fbm(vec2(uv.x * 0.62 + seed, uv.y * 0.38 - seed));
    float estuary = 0.24 * sin(uv.x * 1.23 + 1.8 * coastNoise + 0.22 * orbit.x);
    estuary += 0.11 * sin(uv.x * 2.71 - 0.9 * coastNoise - 0.18 * orbit.y);
    basinP.y += estuary;

    vec2 flowA = vec2(
        fbm(basinP * vec2(1.15, 0.78) + vec2(8.1, 2.7) + orbit * 0.23),
        fbm(basinP.yx * vec2(0.83, 1.26) - vec2(3.6, 6.4) - orbit.yx * 0.21)
    ) - 0.5;
    vec2 flowB = vec2(
        fbm(basinP * 2.15 + 3.1 * flowA + vec2(orbit.y, orbit.x) * 0.17),
        fbm(basinP.yx * 1.92 - 2.7 * flowA + vec2(-orbit.x, orbit.y) * 0.19)
    ) - 0.5;
    vec2 warped = basinP + 0.35 * flowA + 0.16 * flowB;

    // Depositional layers migrate, compact, and return after one tide cycle.
    float layerCoord = warped.y * 8.2;
    layerCoord += 1.35 * fbm(vec2(warped.x * 1.35, warped.y * 0.38 + seed));
    layerCoord += 0.20 * orbit.x * flowB.x + 0.15 * orbit.y * flowA.y;
    float bedPhase = fract(layerCoord);
    float bedIndex = floor(layerCoord);
    float lamina = smoothstep(0.025, 0.12, bedPhase) *
                   (1.0 - smoothstep(0.58, 0.98, bedPhase));
    float unconformity = 1.0 - smoothstep(0.0, 0.035,
        abs(basinP.y + 0.12 + 0.22 * fbm(vec2(uv.x * 0.72 + seed, 2.4))));

    // MESO: Voronoi grains become lenses along streamlines rather than a grid.
    vec2 cellP = warped * vec2(5.4, 7.7);
    cellP.x += 1.15 * flowB.y + 0.10 * orbit.y;
    vec3 cell = voronoi(cellP, orbit);
    float rim = 1.0 - smoothstep(0.018, 0.115, cell.y - cell.x);
    float core = 1.0 - smoothstep(0.10, 0.54, cell.x);
    float cellBed = hash11(bedIndex * 4.71 + cell.z * 13.1 + u_seed);
    float sorting = smoothstep(0.24, 0.78,
        fbm(warped * vec2(2.7, 4.1) + vec2(seed, -seed) + 0.13 * orbit));
    float deposit = core * mix(0.28, 1.0, cellBed) * mix(0.55, 1.0, sorting);
    deposit *= mix(0.58, 1.0, lamina);

    // Tidal exposure is asymmetric in space but periodic in time.
    float tidalFront = uv.y + 0.30 * flowA.x - 0.16 * coastNoise;
    float waterline = 0.12 * orbit.y + 0.035 * orbit.x;
    float submerged = 1.0 - smoothstep(waterline - 0.13, waterline + 0.10, tidalFront);
    float settlingPulse = 0.5 + 0.5 * (orbit.x * 0.74 + orbit.y * 0.26);
    deposit *= mix(0.76, 1.13, submerged * settlingPulse);

    // MICRO: compacted laminae, mineral specks, and cell-edge shell fragments.
    float fineLayer = abs(fract(layerCoord * 7.0 + 0.8 * flowA.x) - 0.5);
    fineLayer = 1.0 - smoothstep(0.018, 0.095, fineLayer);
    float grain = hash21(floor((warped + 0.004 * flowB) * 310.0));
    float specks = smoothstep(0.925, 0.995, grain);
    float pores = smoothstep(0.955, 0.995,
        hash21(floor(warped * 185.0) + floor(layerCoord) * 0.71));
    float fragments = rim * smoothstep(0.50, 0.91,
        hash21(floor(cellP * 3.0) + 31.0));

    float material = 0.16 + 0.43 * lamina + 0.31 * deposit;
    material += 0.10 * sorting + 0.08 * fineLayer;
    material += 0.12 * unconformity;
    material = clamp(material, 0.0, 1.0);
    vec3 color = palette(material);

    color *= mix(0.72, 1.04, 1.0 - submerged);
    color += vec3(0.16, 0.13, 0.075) * fineLayer * (0.22 + 0.40 * deposit);
    color += vec3(0.29, 0.25, 0.17) * fragments * 0.48;
    color += vec3(0.19, 0.145, 0.085) * specks * (0.25 + 0.55 * sorting);
    color *= 1.0 - 0.43 * pores;
    color *= 1.0 - 0.30 * rim * (1.0 - fragments);

    // Shallow wet-film tint follows the estuary, never becoming a central glow.
    vec3 wetTint = vec3(0.035, 0.105, 0.115);
    color = mix(color, color + wetTint, submerged * 0.38);
    float edgeShade = 1.0 - 0.12 * smoothstep(0.55, 1.45, length(uv * vec2(0.62, 0.86)));
    color *= edgeShade;
    color = pow(max(color, 0.0), vec3(0.91));

    gl_FragColor = vec4(color, 1.0);
}
