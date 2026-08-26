precision highp float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

#define PI 3.14159265358979323846
#define TAU 6.28318530717958647692

// --- Kiln semaphore: characteristic hinge / event operators ---
float phaseDistance(float a, float b) {
    return abs(fract(a - b + 0.5) - 0.5);
}

float phaseEvent(float phase, float center, float radius, float feather) {
    return 1.0 - smoothstep(radius, radius + feather, phaseDistance(phase, center));
}

// Arrival is followed by a visibly delayed fold, then a longer lock.
// All offsets are circular, so phase 0 and 1 remain identical.
float spatialEvent(float position, float center, float radius, float feather) {
    return 1.0 - smoothstep(radius, radius + feather, abs(position - center));
}

// Folding is spatially locked to the one travelling packet. The event width
// is narrower than the spacing between relays, so only the visited plate moves.
vec4 hingeEvent(float packetPos, float arrival, float temperament) {
    float approach = spatialEvent(packetPos, arrival, 0.030, 0.012);
    float lock = spatialEvent(packetPos, arrival, 0.014, 0.010);
    float angle = clamp(approach * (0.90 + 0.08 * temperament), 0.0, 1.0);
    return vec4(1.0 - approach, angle, lock, approach - lock);
}

float projectedWidth(vec4 eventState) {
    float a = eventState.y * (1.34 + 0.22 * eventState.z);
    return 0.14 + 0.86 * abs(cos(a));
}

float hash11(float p) {
    return fract(sin(p * 127.1 + u_seed * 41.73) * 43758.5453123);
}

float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + u_seed * 19.19) * 43758.5453123);
}

// Smooth fired-clay variation avoids a repeated tile/checker read on plate faces.
float clayNoise(vec2 p, float id) {
    vec2 cell = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash21(cell + vec2(id * 0.37, id * 0.19));
    float b = hash21(cell + vec2(1.0, 0.0) + vec2(id * 0.37, id * 0.19));
    float c = hash21(cell + vec2(0.0, 1.0) + vec2(id * 0.37, id * 0.19));
    float d = hash21(cell + vec2(1.0, 1.0) + vec2(id * 0.37, id * 0.19));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

mat2 rotate2(float a) {
    float c = cos(a), s = sin(a);
    return mat2(c, -s, s, c);
}

float boxSDF(vec2 p, vec2 b) {
    vec2 d = abs(p) - b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}

float segmentSDF(vec2 p, vec2 a, vec2 b) {
    vec2 pa = p - a, ba = b - a;
    float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
    return length(pa - ba * h);
}

float ink(float d, float width, float aa) {
    return 1.0 - smoothstep(width, width + aa, d);
}

vec3 overColor(vec3 base, vec3 layer, float alpha) {
    return mix(base, layer, clamp(alpha, 0.0, 1.0));
}

// A single packet traverses one continuous hinge route. The cosine clock
// makes a legible outbound call and return response with an integer-period loop.
float signalWire(vec2 p, vec2 a, vec2 b, float packetPos,
                 float routeStart, float routeEnd, float aa) {
    float d = segmentSDF(p, a, b);
    float along = dot(p - a, normalize(b - a)) / max(length(b - a), 0.001);
    float routePos = mix(routeStart, routeEnd, clamp(along, 0.0, 1.0));
    float packet = 1.0 - smoothstep(0.022, 0.042, abs(routePos - packetPos));
    // Guide and packet share exactly one centerline; there is no split route.
    float guide = ink(d, 0.0015, aa) * 0.16;
    float moving = ink(d, 0.0090, aa) * packet;
    return max(guide, moving);
}

void drawSignalGraph(inout vec3 col, vec2 p, float phase, float aa) {
    vec3 oxide = vec3(0.72, 0.245, 0.085);
    float packetPos = 0.5 - 0.5 * cos(TAU * phase);
    float w = 0.0;
    // One continuous itinerary visits every plate exactly in graph order.
    w += signalWire(p,vec2(-1.02,-0.80),vec2(-1.15,-0.48),packetPos,0.000,0.071,aa);
    w += signalWire(p,vec2(-1.15,-0.48),vec2(-0.93,-0.43),packetPos,0.071,0.143,aa);
    w += signalWire(p,vec2(-0.93,-0.43),vec2(-0.82,-0.66),packetPos,0.143,0.214,aa);
    w += signalWire(p,vec2(-0.82,-0.66),vec2(-0.72,-0.88),packetPos,0.214,0.286,aa);
    w += signalWire(p,vec2(-0.72,-0.88),vec2(-0.52,-0.69),packetPos,0.286,0.357,aa);
    w += signalWire(p,vec2(-0.52,-0.69),vec2(-0.67,-0.48),packetPos,0.357,0.429,aa);
    w += signalWire(p,vec2(-0.67,-0.48),vec2(-0.40,-0.27),packetPos,0.429,0.500,aa);
    w += signalWire(p,vec2(-0.40,-0.27),vec2( 0.40, 0.29),packetPos,0.500,0.571,aa);
    w += signalWire(p,vec2( 0.40, 0.29),vec2( 0.55, 0.68),packetPos,0.571,0.643,aa);
    w += signalWire(p,vec2( 0.55, 0.68),vec2( 0.70, 0.49),packetPos,0.643,0.714,aa);
    w += signalWire(p,vec2( 0.70, 0.49),vec2( 0.98, 0.42),packetPos,0.714,0.786,aa);
    w += signalWire(p,vec2( 0.98, 0.42),vec2( 1.16, 0.52),packetPos,0.786,0.857,aa);
    w += signalWire(p,vec2( 1.16, 0.52),vec2( 0.86, 0.69),packetPos,0.857,0.929,aa);
    w += signalWire(p,vec2( 0.86, 0.69),vec2( 1.08, 0.84),packetPos,0.929,1.000,aa);
    col = overColor(col, oxide, min(w, 1.0) * 0.96);
}

void drawPlate(inout vec3 col, vec2 p, vec2 center, vec2 size,
               float angle, float id, float phase, float aa) {
    // Explicit graph positions bind each main hinge to the one visible packet.
    // Satellites inherit the nearest relay time rather than folding randomly.
    float graphDelay = 0.000;
    if      (id == 1.0)  graphDelay = 0.000;
    else if (id == 7.0)  graphDelay = 0.071;
    else if (id == 4.0)  graphDelay = 0.143;
    else if (id == 2.0)  graphDelay = 0.214;
    else if (id == 8.0)  graphDelay = 0.286;
    else if (id == 5.0)  graphDelay = 0.357;
    else if (id == 3.0)  graphDelay = 0.429;
    else if (id == 6.0)  graphDelay = 0.500;
    else if (id == 26.0) graphDelay = 0.571;
    else if (id == 25.0) graphDelay = 0.643;
    else if (id == 23.0) graphDelay = 0.714;
    else if (id == 24.0) graphDelay = 0.786;
    else if (id == 27.0) graphDelay = 0.857;
    else if (id == 22.0) graphDelay = 0.929;
    else if (id == 21.0) graphDelay = 1.000;
    float packetPos = 0.5 - 0.5 * cos(TAU * phase);
    vec4 ev = hingeEvent(packetPos, graphDelay, hash11(id + 9.7));
    float pw = projectedWidth(ev);
    float handed = mix(-1.0, 1.0, step(0.5, hash11(id + 3.1)));
    float swing = handed * (0.13 + 0.30 * ev.y + 0.06 * ev.w);
    vec2 q = rotate2(-(angle + swing)) * (p - center);
    vec2 halfSize = vec2(size.x * pw, size.y) * 0.5;
    float d = boxSDF(q, halfSize);
    float body = 1.0 - smoothstep(0.0, aa * 1.6, d);

    float lightSide = 0.5 + 0.5 * normalize(vec3(handed*sin(swing), cos(swing), 0.7)).y;
    vec3 clayA = vec3(0.68, 0.285, 0.17);
    vec3 clayB = vec3(0.88, 0.49, 0.30);
    vec3 face = mix(clayA, clayB, 0.23 + 0.50 * lightSide);
    float clayGrain = 0.68 * clayNoise(q * 9.0, id)
                    + 0.32 * clayNoise(q * 21.0 + vec2(7.3, -4.1), id + 13.0);
    face *= 0.91 + 0.09 * clayGrain;
    face *= 0.84 + 0.16 * ev.z;
    col = overColor(col, face, body);

    // paired architectural rim lines, compressed with projected face width
    float rimX = min(abs(q.x - halfSize.x), abs(q.x + halfSize.x));
    float rimPair = ink(abs(rimX - 0.010), 0.0022, aa)
                  + ink(abs(rimX - 0.022), 0.0016, aa);
    float inY = 1.0 - smoothstep(halfSize.y - 0.012, halfSize.y, abs(q.y));
    col = overColor(col, vec3(0.38,0.135,0.085), rimPair * inY * body * 0.86);

    // hinge barrel and pin at one long edge
    vec2 h = q - vec2(-halfSize.x, 0.0);
    float barrel = ink(abs(abs(h.y) - halfSize.y * 0.34), 0.0045, aa)
                 * (1.0 - smoothstep(0.014, 0.021, abs(h.x)));
    float pin = ink(length(h - vec2(0.0, halfSize.y * 0.34)), 0.0060, aa)
              + ink(length(h + vec2(0.0, halfSize.y * 0.34)), 0.0060, aa);
    col = overColor(col, vec3(0.27,0.105,0.065), clamp(barrel + pin, 0.0, 1.0));

    // Reception ember: the same graph delay that folds the plate briefly
    // fires its hinge pins, making signal arrival legible without a new layer.
    float receive = spatialEvent(packetPos, graphDelay, 0.026, 0.012);
    float receivedPin = ink(length(h - vec2(0.0, halfSize.y * 0.34)), 0.010, aa)
                      + ink(length(h + vec2(0.0, halfSize.y * 0.34)), 0.010, aa);
    col = overColor(col, vec3(0.98,0.66,0.35), clamp(receivedPin, 0.0, 1.0) * receive * body);

    // sparse perforations tied to locked state
    for (int k = 0; k < 3; k++) {
        float fk = float(k);
        float keep = step(0.42, hash11(id * 7.0 + fk));
        vec2 hp = vec2(halfSize.x * 0.42, (fk - 1.0) * halfSize.y * 0.43);
        float hole = ink(length(q - hp), 0.0040 + 0.002 * ev.z, aa) * keep * body;
        col = overColor(col, vec3(0.25,0.095,0.055), hole);
    }

    // Selected firing scars replace an evenly repeated hatch: the same clay
    // field that shades a plate now breaks and varies each impressed line.
    float hatchGate = step(0.58, hash11(id + 17.0)) * (0.20 + 0.62 * ev.y + 0.18 * ev.z);
    float hatchBand = 1.0 - smoothstep(halfSize.x * 0.76, halfSize.x * 0.88, abs(q.x));
    float scarFlow = q.x + q.y * (0.46 + 0.16 * hash11(id + 5.0));
    float scarLine = abs(fract(scarFlow * 31.0 + id * 0.37) - 0.5);
    float scarBreak = smoothstep(0.34, 0.62, clayNoise(q * 13.0 + vec2(id), id + 29.0));
    float scars = (1.0 - smoothstep(0.055, 0.13, scarLine)) * scarBreak;
    col = overColor(col, vec3(0.46,0.17,0.10), scars * hatchGate * hatchBand * body * 0.29);

    // lock tab gives the state transition a structural silhouette
    vec2 tabQ = q - vec2(halfSize.x + 0.010, halfSize.y * 0.12);
    float tab = 1.0 - smoothstep(0.0, aa, boxSDF(tabQ, vec2(0.018 * ev.z, 0.032)));
    col = overColor(col, vec3(0.43,0.16,0.09), tab);
}

void main() {
    vec2 frag = gl_FragCoord.xy;
    vec2 p = (2.0 * frag - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
    float aa = 1.65 / min(u_resolution.x, u_resolution.y);
    float phase = fract(u_time); // exact circular endpoint continuity

    // Macro: bright lime-plaster space with a quiet, unoccupied center.
    float edgeWarm = smoothstep(0.18, 1.35, length(p * vec2(0.78, 1.05)));
    float plaster = hash21(floor(frag * 0.17)) * 0.012;
    vec3 col = mix(vec3(0.965,0.925,0.805), vec3(0.895,0.835,0.690), edgeWarm * 0.42);
    col += plaster;

    // Meso I: independent delayed signal paths beneath the plates.
    drawSignalGraph(col, p, phase, aa);

    // Meso II: asymmetrical diagonal plate masses, deliberately frame-clipped.
    // Lower-left kiln rack: broad, heavy, and branching upward.
    drawPlate(col,p,vec2(-1.02,-0.80),vec2(0.42,0.24), 0.54,  1.0,phase,aa);
    drawPlate(col,p,vec2(-0.82,-0.66),vec2(0.31,0.18), 0.67,  2.0,phase,aa);
    drawPlate(col,p,vec2(-0.67,-0.48),vec2(0.38,0.16), 0.53,  3.0,phase,aa);
    drawPlate(col,p,vec2(-0.93,-0.43),vec2(0.25,0.14), 0.82,  4.0,phase,aa);
    drawPlate(col,p,vec2(-0.52,-0.69),vec2(0.27,0.13), 0.33,  5.0,phase,aa);
    drawPlate(col,p,vec2(-0.40,-0.27),vec2(0.34,0.12), 0.68,  6.0,phase,aa);
    drawPlate(col,p,vec2(-1.15,-0.48),vec2(0.36,0.20), 0.44,  7.0,phase,aa);
    drawPlate(col,p,vec2(-0.72,-0.88),vec2(0.34,0.15), 0.78,  8.0,phase,aa);

    // Upper-right kiln rack: slimmer, more vertical, different event timings.
    drawPlate(col,p,vec2( 1.08, 0.84),vec2(0.37,0.20), 0.60, 21.0,phase,aa);
    drawPlate(col,p,vec2( 0.86, 0.69),vec2(0.28,0.13), 0.83, 22.0,phase,aa);
    drawPlate(col,p,vec2( 0.70, 0.49),vec2(0.34,0.15), 0.52, 23.0,phase,aa);
    drawPlate(col,p,vec2( 0.98, 0.42),vec2(0.23,0.12), 0.75, 24.0,phase,aa);
    drawPlate(col,p,vec2( 0.55, 0.68),vec2(0.26,0.12), 0.39, 25.0,phase,aa);
    drawPlate(col,p,vec2( 0.40, 0.29),vec2(0.31,0.11), 0.70, 26.0,phase,aa);
    drawPlate(col,p,vec2( 1.16, 0.52),vec2(0.31,0.17), 0.48, 27.0,phase,aa);

    // Subtle fired-paper vignette, never a noisy full-frame overlay.
    col *= 1.0 - 0.055 * smoothstep(0.75, 1.55, length(p));
    col = pow(max(col, 0.0), vec3(0.96));
    gl_FragColor = vec4(col, 1.0);
}
