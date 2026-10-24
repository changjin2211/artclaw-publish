precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
#define TAU 6.283185307179586

float hash21(vec2 v) { return fract(sin(dot(v,vec2(127.1,311.7)))*43758.5453); }
// Jitter is bounded below the separation of the hexagonal Poisson darts.
vec2 poisson(vec2 id) {
  vec2 p=vec2(0.15+id.x*0.32+mod(id.y,2.0)*0.16,0.14+id.y*0.277);
  vec2 j=vec2(hash21(id+vec2(u_seed*19.0+3.0,8.0)),
              hash21(id+vec2(11.0,u_seed*23.0+5.0)))-0.5;
  return p+0.036*j;
}
// The parent triangle itself is the card; quantized bow-front timing is shared by its pixels.
float cardBeat(vec2 center) {
  float progress=0.5*(center.x+center.y);
  float lateral=abs(center.x-center.y);
  float travel=progress+1.0*lateral;
  return floor(clamp(travel/1.5,0.0,0.9999)*12.0);
}
void main() {
  vec2 uv=gl_FragCoord.xy/u_resolution;
  float px=1.0/min(u_resolution.x,u_resolution.y);
  vec3 bg=vec3(243.0,238.0,255.0)/255.0;
  vec3 mainInk=vec3(46.0,33.0,112.0)/255.0;
  vec3 midInk=vec3(142.0,124.0,255.0)/255.0;
  vec3 accent=vec3(47.0,199.0,154.0)/255.0;
  vec3 secondary=vec3(255.0,158.0,199.0)/255.0;
  // Seed samples only vary the later cosine emptying threshold.
  float nearD=2.0;
  for(int j=0;j<3;j++) for(int i=0;i<3;i++) {
    nearD=min(nearD,length(uv-poisson(vec2(float(i),float(j)))));
  }
  vec2 r=0.70710678*vec2(uv.x+uv.y,uv.y-uv.x);
  float qy=r.y*8.8/0.8660254;
  vec2 q=vec2(r.x*8.8-0.5*qy,qy);
  vec2 tile=floor(q), f=fract(q);
  vec3 b;
  if(f.x+f.y<1.0) b=vec3(1.0-f.x-f.y,f.x,f.y);
  else b=vec3(f.x+f.y-1.0,1.0-f.x,1.0-f.y);
  float side=step(1.0,f.x+f.y);
  vec2 id=tile+vec2(side*0.37,side*0.71);
  // Centroid of the actual upright or inverted large triangle, in screen coordinates.
  float centroid=side<0.5 ? 1.0/3.0 : 2.0/3.0;
  vec2 c=tile+vec2(centroid);
  vec2 cr=vec2((c.x+0.5*c.y)/8.8,c.y*0.8660254/8.8);
  vec2 parentUv=0.70710678*vec2(cr.x-cr.y,cr.x+cr.y);
  float beat=cardBeat(parentUv);
  float start=beat*0.035; // twelve discrete beats; the final beat begins at 38.5%.
  float span=0.014; // 84 ms in the six-second loop, one simultaneous card flip.
  float sweep=smoothstep(start,start+span,u_time);
  // The original cosine-driven disappearance starts only after the full hold.
  float resetPhase=clamp((u_time-0.55)/0.45,0.0,1.0);
  float resetThreshold=0.02+0.13*(hash21(tile+vec2(u_seed*53.0+7.0,side*11.0))-0.5)
                       +0.08*(nearD-0.2);
  float reset=1.0-step(cos(3.141592653589793*resetPhase + 0.75*(parentUv.x+parentUv.y-1.0)),resetThreshold);
  float fill=sweep*reset;
  if(u_time>=1.0) fill=0.0;
  // Empty cards leave no stationary triangular support; their own seam follows their fill.

  float scale=1.0/8.8;
  float depth=0.0;
  float seam=0.0;
  float parentEdge=0.0;
  float active=0.0;
  for(int level=0;level<3;level++) {
    float m=min(b.x,min(b.y,b.z));
    float edge=1.0-smoothstep(px*0.35,px*1.3,m*scale);
    if(level==0) parentEdge=edge;
    seam=max(seam,edge*fill);
    if(level==2) break;
    float split=step(0.5,fill);
    if(split<0.5) break;
    active+=1.0;
    vec3 child;
    if(b.x>0.5) { child=2.0*b-vec3(1.0,0.0,0.0); id=id*2.0+vec2(1.0,0.0); }
    else if(b.y>0.5) { child=2.0*b-vec3(0.0,1.0,0.0); id=id*2.0+vec2(0.0,1.0); }
    else if(b.z>0.5) { child=2.0*b-vec3(0.0,0.0,1.0); id=id*2.0+vec2(1.0,1.0); }
    else { child=vec3(1.0)-2.0*b; id=id*2.0; }
    b=child;
    scale*=0.5;
    depth+=1.0;
  }
  // Exactly one diagonal accent gesture within the SAME repeating leaf system.
  float axis=abs(uv.y-(0.76-0.52*uv.x));
  float gesture=exp(-axis*axis/0.025)*exp(-pow((uv.x-0.48)*1.3,2.0));
  float focus=exp(-pow(length((uv-vec2(0.48,0.51))*3.2),2.0));
  float inset=smoothstep(0.0,0.014,min(b.x,min(b.y,b.z)));
  float tone=clamp(0.27+0.055*depth+0.23*gesture+0.25*focus,0.0,0.89);
  vec3 ink=mix(mainInk,midInk,smoothstep(0.15,0.92,tone));
  ink=mix(ink,bg,0.12*focus);
  ink=mix(ink,accent,0.70*gesture);
  // Filled faces meet like tangram pieces; their original parent/child seams separate cards.
  vec3 color=mix(bg,ink,inset*fill);
  color=mix(color,bg,fill*(0.32*seam+0.52*parentEdge));
  float stripe=abs(fract(b.x*(2.0+depth))-0.5)/(2.0+depth);
  float glyph=(1.0-smoothstep(px/scale*0.45,px/scale*1.25,stripe));
  glyph*=smoothstep(0.25,0.31,b.y)*(1.0-smoothstep(0.42,0.48,b.y));
  glyph*=smoothstep(0.18,0.24,min(b.x,min(b.y,b.z)))*step(1.5,active)*fill;
  color=mix(color,secondary,0.52*glyph);
  gl_FragColor=vec4(color,1.0);
}
