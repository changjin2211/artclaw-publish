precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
#define PI 3.141592653589793

float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1,311.7)) + u_seed * 67.37) * 43758.5453);
}
float periodicJitter(vec2 uv) {
  // Two-by-two jittered grid, smooth and exactly periodic over a 2pi domain.
  vec2 q=fract(uv / PI)*2.0;
  vec2 i=floor(q), f=fract(q);
  f=f*f*(3.0-2.0*f);
  float a=hash2(mod(i,2.0));
  float b=hash2(mod(i+vec2(1.0,0.0),2.0));
  float c=hash2(mod(i+vec2(0.0,1.0),2.0));
  float d=hash2(mod(i+vec2(1.0,1.0),2.0));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y)-0.5;
}
float surface(vec3 p) {
  float base=cos(p.x)*sin(p.y)+cos(p.y)*sin(p.z)+cos(p.z)*sin(p.x);
  float octave=cos(2.0*p.x)*sin(2.0*p.y)+cos(2.0*p.y)*sin(2.0*p.z)+cos(2.0*p.z)*sin(2.0*p.x);
  float gradient=0.11*sin(p.x*0.5+p.y*0.5); // period 4pi in world, but viewport translates in matching period below
  return base+0.16*octave+gradient+0.09*periodicJitter(p.xy);
}
void main() {
  vec2 uv=(gl_FragCoord.xy-0.5*u_resolution)/u_resolution.y;
  float t=fract(u_time);
  // Translation by exactly 4pi over one cycle: common period of all terms.
  vec2 xy=uv*10.7+vec2(0.44,-0.18)+vec2(4.0*PI*t,0.0);
  vec3 accum=vec3(0.0);
  float trans=1.0;
  for(int k=0;k<36;k++) {
    float z=-4.65+(float(k)+0.5)*(9.3/36.0);
    vec3 p=vec3(xy+vec2(0.23*z,-0.13*z),z+0.27);
    float s=surface(p);
    float j=periodicJitter(p.xy);
    float nearSurface=exp(-16.0*s*s);
    // Traveling phase follows a periodic coordinate on the connected surface.
    float path=p.x+0.43*p.y+0.22*p.z;
    float wave=0.5+0.5*cos(path-2.0*PI*t+0.36*j);
    float ridge=pow(wave,5.0);
    // One curved focal passage, not a second drawing layer.
    float gesture=exp(-2.3*pow(uv.y-0.29*uv.x+0.055*sin(uv.x*7.0),2.0));
    float focus=0.43+0.57*gesture*exp(-3.5*dot(uv-vec2(0.03,0.02),uv-vec2(0.03,0.02)));
    float density=nearSurface*(0.008+0.095*ridge)*focus;
    float depth=0.74+0.26*(z+4.65)/9.3;
    float activeFace=nearSurface*ridge*smoothstep(0.48,0.85,wave);
    vec3 gold=vec3(0.788,0.706,0.227);
    vec3 blue=vec3(0.243,0.498,0.651);
    vec3 emission=mix(gold,blue,0.22*activeFace)*depth;
    accum+=trans*density*emission;
    trans*=1.0-density*0.56;
  }
  vec3 background=vec3(0.0706,0.0745,0.0980);
  vec3 color=background+accum*2.95;
  // Tone map produces intermediate emission values without clipping the saffron.
  color=background+(color-background)/(1.0+0.34*(color-background));
  gl_FragColor=vec4(clamp(color,0.0,1.0),1.0);
}
