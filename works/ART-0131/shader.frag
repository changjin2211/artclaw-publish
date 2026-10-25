precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;

float hash1(float n) { return fract(sin(n * 127.1 + u_seed * 917.31) * 43758.5453); }
float segmentDistance(vec2 p, vec2 a, vec2 b) {
  vec2 v=b-a;
  return length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),0.00001),0.0,1.0));
}
void main() {
  vec2 uv=gl_FragCoord.xy/u_resolution.xy;
  float aspect=u_resolution.x/u_resolution.y;
  vec2 p=vec2(uv.x*aspect,uv.y);
  float density=0.0;
  float core=0.0;
  float arrival=0.0;
  // Invisible jittered origins. The same finite walks own every deposited pixel.
  for (int y=0;y<5;y++) {
    for (int x=0;x<5;x++) {
      float id=float(x+y*5);
      vec2 pos=(vec2(float(x),float(y))+0.20+vec2(hash1(id*7.1),hash1(id*7.1+1.3))*.90)/5.6;
      pos.x*=aspect;
      for (int k=0;k<6;k++) {
        float j=float(k);
        float bend=(hash1(id*29.7+j*3.17)-0.5)*1.85;
        float angle=0.62+bend+0.30*sin(j*.71+id*.6);
        float lengthStep=0.020+0.014*hash1(id*19.3+j*5.1);
        vec2 next=pos+lengthStep*vec2(cos(angle),sin(angle));
        float dist=segmentDistance(p,pos*.78+vec2(.10*aspect,.10),next*.78+vec2(.10*aspect,.10));
        float footprint=1.0-smoothstep(0.008,0.022,dist);
        float inner=1.0-smoothstep(0.002,0.009,dist);
        // One diagonally ordered sweep, with a cyclic local growth-decay envelope.
        float coord=clamp(dot((pos+next)*.5/vec2(aspect,1.0),vec2(.58,.42)),0.0,1.0);
        float lag=fract(u_time-coord+1.0);
        float envelope=smoothstep(0.0,0.14,lag)*(1.0-smoothstep(0.18,0.78,lag));
        float weight=0.08+1.35*envelope;
        density+=footprint*weight;
        core+=inner*weight;
        arrival+=footprint*envelope;
        pos=next;
      }
    }
  }
  float mass=smoothstep(0.13,0.78,density);
  float spine=smoothstep(0.12,0.76,core);
  vec3 background=vec3(226.0,87.0,43.0)/255.0;
  vec3 deposit=vec3(18.0,52.0,59.0)/255.0;
  vec3 crest=vec3(143.0,240.0,224.0)/255.0;
  // Compress the weak, overlapping stain into a clean teal midtone without moving the walks.
  float coverage=clamp(mass*.78+spine*.18,0.0,1.0);
  vec3 color=mix(background,deposit,smoothstep(0.23,0.77,coverage));
  // Density-controlled halftone exists only within the antialiased deposit.
  vec2 cell=fract(gl_FragCoord.xy/6.0)-0.5;
  float dotRadius=0.075+0.28*clamp(density/1.9,0.0,1.0);
  float dotMask=1.0-smoothstep(dotRadius-.055,dotRadius+.055,length(cell));
  float fresh=clamp(arrival/2.1,0.0,1.0);
  float highlight=dotMask*mass*fresh*fresh*0.42;
  color=mix(color,crest,highlight);
  gl_FragColor=vec4(color,1.0);
}
