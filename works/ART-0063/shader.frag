precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define TAU 6.28318530717958647692

float sat(float x) { return clamp(x, 0.0, 1.0); }
float hash11(float x) { return fract(sin(x * 127.1 + 311.7) * 43758.5453123); }
float hash21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }

// The algorithmic heart: one three-octave TPMS and its own four-step tangent flow.
float tpmsBase(vec2 q, float phase) {
    vec3 p3 = vec3(q.x, q.y, q.x - q.y);
    return (cos(p3.x + phase) + cos(p3.y - phase * 0.73) +
            cos(p3.z + phase * 0.41)) / 3.0;
}

vec3 orbitWeights(float t, float seed) {
    float a = TAU * t;
    float cs = cos(a), sn = sin(a);
    return vec3(0.63 + 0.075 * cs + 0.045 * sn,
                0.255 - 0.038 * cs + 0.062 * sn,
                0.115 - 0.037 * cs - 0.107 * sn);
}

vec3 orbitPhases(float t, float seed) {
    float a = TAU * t;
    return TAU * vec3(hash11(seed + 1.2), hash11(seed + 5.7), hash11(seed + 9.4)) +
           vec3(0.31 * cos(a) + 0.22 * sin(a),
                0.24 * cos(a + 2.1) + 0.35 * sin(a + 2.1),
                0.39 * cos(a + 4.2) + 0.18 * sin(a + 4.2));
}

float tpms3(vec2 q, float t, float seed, float phase3Mod) {
    vec3 w = orbitWeights(t, seed);
    vec3 ph = orbitPhases(t, seed);
    float o0 = tpmsBase(q, ph.x);
    float o1 = tpmsBase(q * 2.0 + vec2(0.37, -0.21), ph.y);
    float o2 = tpmsBase(q * 4.0 + vec2(-0.13, 0.29), ph.z + phase3Mod);
    return o0 * w.x + o1 * w.y + o2 * w.z;
}

vec2 tpmsGradient(vec2 q, float t, float seed, float pm) {
    const float e = 0.018;
    return vec2(tpms3(q + vec2(e, 0.0), t, seed, pm) - tpms3(q - vec2(e, 0.0), t, seed, pm),
                tpms3(q + vec2(0.0, e), t, seed, pm) - tpms3(q - vec2(0.0, e), t, seed, pm)) / (2.0 * e);
}

vec2 fourStepFlow(vec2 q, float t, float seed) {
    vec2 x = q;
    for (int i = 0; i < 4; i++) {
        vec2 g = tpmsGradient(x, t, seed, 0.0);
        vec2 tangent = vec2(-g.y, g.x) / max(length(g), 0.08);
        x += tangent * (0.045 + 0.022 * hash11(seed + float(i) * 3.1));
    }
    return x - q;
}

float sdBox(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float sdSegment(vec2 p, vec2 a, vec2 b, float r) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h) - r;
}

float glyphDistance(vec2 p, float kind, float fillBit) {
    float d = 9.0;
    if (kind < 0.5) {
        d = length(p) - 0.105;
    } else if (kind < 1.5) {
        d = sdBox(p, vec2(0.34, 0.075));
    } else if (kind < 2.5) {
        d = min(sdSegment(p, vec2(-0.27, 0.27), vec2(-0.27, -0.22), 0.065),
                sdSegment(p, vec2(-0.27, -0.22), vec2(0.25, -0.22), 0.065));
    } else if (kind < 3.5) {
        d = min(sdBox(p, vec2(0.31, 0.055)), sdBox(p, vec2(0.055, 0.31)));
    } else if (kind < 4.5) {
        d = min(sdSegment(p, vec2(-0.31, 0.18), vec2(0.0, -0.16), 0.06),
                sdSegment(p, vec2(0.0, -0.16), vec2(0.31, 0.18), 0.06));
    } else if (kind < 5.5) {
        float outer = sdBox(p, vec2(0.29, 0.29));
        float inner = sdBox(p, vec2(0.18, 0.18));
        d = max(outer, -inner);
    } else {
        d = min(sdSegment(p, vec2(-0.28, -0.12), vec2(0.28, -0.12), 0.052),
                sdSegment(p, vec2(-0.28, 0.12), vec2(0.28, 0.12), 0.052));
    }
    if (fillBit > 0.72 && kind > 0.5 && kind < 5.5) d -= 0.025;
    return d;
}

vec3 palette(float id) {
    if (id < 0.5) return vec3(48.0, 59.0, 55.0) / 255.0;
    if (id < 1.5) return vec3(44.0, 78.0, 156.0) / 255.0;
    if (id < 2.5) return vec3(139.0, 89.0, 64.0) / 255.0;
    return vec3(215.0, 199.0, 164.0) / 255.0;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 p = (gl_FragCoord.xy - 0.5 * u_resolution.xy) / u_resolution.y;
    float seed = fract(u_seed * 0.754877666 + 0.117);

    float angle = radians(11.0 + 13.0 * hash11(seed + 2.3));
    vec2 travelDir = vec2(cos(angle), sin(angle));
    vec2 travelPerp = vec2(-travelDir.y, travelDir.x);
    float trips = hash11(seed + 8.8) < 0.5 ? 2.0 : 3.0;
    float cells = 3.15 + 0.35 * hash11(seed + 4.4);
    vec2 q = TAU * cells * vec2(dot(p, travelDir), dot(p, travelPerp));
    q.x += TAU * trips * u_time;

    float leftW = mix(0.23, 0.29, hash11(seed + 10.0));
    float centerW = mix(0.41, 0.48, hash11(seed + 12.0));
    float edge1 = leftW;
    float edge2 = leftW + centerW;
    float interlock = mix(0.035, 0.075, hash11(seed + 14.0));

    vec2 flow = fourStepFlow(q, u_time, seed);
    float flowAccum = dot(flow, vec2(0.73, -0.41));
    float pm = 0.48 * sin(flowAccum * 3.0);

    vec2 offL = TAU * vec2(hash11(seed + 20.0), hash11(seed + 21.0));
    vec2 offC = TAU * vec2(hash11(seed + 22.0), hash11(seed + 23.0));
    vec2 offR = TAU * vec2(hash11(seed + 24.0), hash11(seed + 25.0));
    float fL = tpms3(q + offL, u_time, seed, pm);
    float fC = tpms3(q + offC, u_time, seed, pm);
    float fR = tpms3(q + offR, u_time, seed, pm);

    float b1 = smoothstep(edge1 - interlock, edge1 + interlock, uv.x + 0.012 * sin(q.y));
    float b2 = smoothstep(edge2 - interlock, edge2 + interlock, uv.x + 0.014 * cos(q.y + 1.7));
    float field = mix(mix(fL, fC, b1), fR, b2);

    // Compositional pressure is threshold-only: one heavy knot, two counter-knots,
    // and a central-right quiet channel which reconnects above and below.
    vec2 aspectUV = vec2((uv.x - 0.5) * u_resolution.x / u_resolution.y, uv.y - 0.5);
    float heavy = exp(-dot(aspectUV - vec2(-0.055, -0.015), aspectUV - vec2(-0.055, -0.015)) / 0.010);
    float upper = exp(-dot(aspectUV - vec2(0.305, 0.205), aspectUV - vec2(0.305, 0.205)) / 0.006);
    float lower = exp(-dot(aspectUV - vec2(0.285, -0.215), aspectUV - vec2(0.285, -0.215)) / 0.007);
    float channelX = 1.0 - smoothstep(0.055, 0.078, abs(uv.x - edge2));
    float midGate = smoothstep(0.12, 0.24, uv.y) * (1.0 - smoothstep(0.76, 0.88, uv.y));
    float channel = channelX * midGate;
    float threshold = 0.13 + 0.25 * heavy + 0.17 * (upper + lower) - 0.38 * channel;
    threshold += 0.055 * flowAccum;

    float section = abs(field - threshold);
    bool interior = section < (0.235 + 0.035 * hash11(seed + 30.0));
    float baseId = field > threshold ? 0.0 : 3.0;
    if (interior) baseId = field + 0.12 * flowAccum > threshold ? 1.0 : 2.0;

    // Blue-noise-like discrete dispersion: a shuffled lattice, never a texture layer.
    float glyphCells = 18.0 + floor(7.0 * hash11(seed + 31.0));
    vec2 gp = uv * vec2(glyphCells, glyphCells * u_resolution.y / u_resolution.x);
    vec2 cell = floor(gp);
    vec2 local = fract(gp) - 0.5;
    float blue = hash21(cell + vec2(hash11(seed + 32.0) * 19.0));
    float blueN = fract(blue + hash21(cell + vec2(17.0, -11.0)) * 0.6180339);
    float rot = floor(hash21(cell + seed * 23.0) * 4.0) * 1.57079632679;
    local = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * local;

    vec2 cellUv = (cell + 0.5) / vec2(glyphCells, glyphCells * u_resolution.y / u_resolution.x);
    vec2 cp = (cellUv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
    vec2 cq = TAU * cells * vec2(dot(cp, travelDir), dot(cp, travelPerp));
    cq.x += TAU * trips * u_time;
    float cb1 = smoothstep(edge1 - interlock, edge1 + interlock, cellUv.x + 0.012 * sin(cq.y));
    float cb2 = smoothstep(edge2 - interlock, edge2 + interlock, cellUv.x + 0.014 * cos(cq.y + 1.7));
    float cL = tpms3(cq + offL, u_time, seed, pm);
    float cC = tpms3(cq + offC, u_time, seed, pm);
    float cR = tpms3(cq + offR, u_time, seed, pm);
    float c0 = mix(mix(cL, cC, cb1), cR, cb2);
    vec2 cg = tpmsGradient(cq + mix(mix(offL, offC, cb1), offR, cb2), u_time, seed, pm);
    float lap = tpms3(cq + vec2(0.05, 0.0) + offC, u_time, seed, pm) + tpms3(cq - vec2(0.05, 0.0) + offC, u_time, seed, pm) +
                tpms3(cq + vec2(0.0, 0.05) + offC, u_time, seed, pm) + tpms3(cq - vec2(0.0, 0.05) + offC, u_time, seed, pm) - 4.0 * tpms3(cq + offC, u_time, seed, pm);
    float descriptor = c0 * 2.7 + sign(cg.x * cg.y) * 1.3 + lap * 18.0 + blueN * 2.2;
    float kind = mod(floor(abs(descriptor) * 3.1), 7.0);
    float gd = glyphDistance(local, kind, blueN);
    bool glyphInk = gd < 0.0;
    bool glyphAllowed = interior && blueN > 0.24;
    if (glyphAllowed && glyphInk) baseId = (kind < 2.5 || kind > 5.5) ? 3.0 : 0.0;

    // Reworked macro composition: compress the continuous register field into
    // one low diagonal pressure plate and one detached upper-right echo.
    // The empty upper-left quadrant is structural negative space, not a low-detail texture.
    vec2 primaryP = (aspectUV - vec2(-0.04, -0.18)) / vec2(0.40, 0.21);
    vec2 echoP = (aspectUV - vec2(0.30, 0.28)) / vec2(0.13, 0.10);
    float primaryD = length(primaryP) - 1.0 + 0.045 * fC;
    float echoD = length(echoP) - 1.0 + 0.065 * fR;
    float plateD = min(primaryD, echoD);
    bool inPlate = plateD < 0.0;
    bool pressureRim = inPlate && plateD > -0.075;
    if (!inPlate) baseId = 3.0;
    if (pressureRim) baseId = primaryD < echoD ? 0.0 : 1.0;

    gl_FragColor = vec4(palette(baseId), 1.0);
}
