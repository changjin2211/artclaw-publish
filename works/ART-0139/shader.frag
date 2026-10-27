precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
const float TAU=6.28318530718;
const float GOLD=2.39996322973;
const float COUNT=196.0;
// The tail reaches the snout's position LAG of a loop later (about one body length along the ellipse).
const float LAG=0.152; // r8's 0.19, scaled with SHARK_SCALE so the body keeps its proportions

float hash1(float n){ return fract(sin(n*127.17+u_seed*719.31)*43758.5453); }
vec2 rawMark(float i){
  float q=(i+0.5)/COUNT;
  float a=i*GOLD+0.18+0.035*(u_seed-0.5);
  vec2 d=vec2(cos(a),sin(a));
  // Squircle embedding keeps the golden-angle order while filling the corners.
  float square=1.0/(max(abs(d.x),abs(d.y))*0.42+0.58);
  float r=(0.017+0.456*sqrt(q))*square;
  r+=0.0018*(hash1(i+11.0)-0.5);
  return r*d;
}
float seg(vec2 p,vec2 a,vec2 b){
  vec2 v=b-a;
  return length(p-a-v*clamp(dot(p-a,v)/max(dot(v,v),0.000001),0.0,1.0));
}
// The shark swims a closed figure-eight that stays inside the frame.
vec2 path(float s){ float a=TAU*s; return vec2(0.29*sin(a),0.18*sin(2.0*a)); }
vec2 pathDir(float s){ float a=TAU*s; return normalize(vec2(0.29*cos(a),0.36*cos(2.0*a))); }
// Spine point u (0 snout .. 1 tail): it follows the snout's path with a delay, so the body bends into turns.
// SHARK_SCALE shrinks the whole shark (length, widths, mark size) without changing its proportions.
const float SHARK_SCALE=0.80;
// Six tail beats per loop, growing toward the tail.
float tailSway(float u,float t){ return 0.020*SHARK_SCALE*u*u*sin(TAU*6.0*t-5.0*u); }
// Every spine point follows the snout's path with a delay (r8's motion), so the whole body bends into turns.
vec2 spine(float u,float t,out vec2 dir){
  float s=t-LAG*u;
  dir=pathDir(s);
  vec2 nrm=vec2(-dir.y,dir.x);
  return path(s)+nrm*tailSway(u,t);
}
// Top-view silhouette half width at u: a long slender body (about 7:1), narrow swept-back
// pectoral fins, and a forked crescent tail. Overall span stays near a third of the length.
float halfWidthUnit(float u);
float halfWidth(float u){ return SHARK_SCALE*halfWidthUnit(u); }
float halfWidthUnit(float u){
  float w=0.037*sqrt(clamp(u/0.16,0.0,1.0));
  w=mix(w,0.008,smoothstep(0.38,0.86,u));
  // Pectoral fins: root at u 0.22..0.32, tip swept back to u 0.40.
  float fin=0.060*smoothstep(0.22,0.38,u)*(1.0-smoothstep(0.37,0.41,u));
  // Small pelvic fins farther back.
  float pelvic=0.020*smoothstep(0.62,0.68,u)*(1.0-smoothstep(0.68,0.71,u));
  float tail=0.066*smoothstep(0.84,1.0,u);
  return max(w+fin+pelvic,0.008+tail);
}
// The fork between the two tail lobes.
bool inTailNotch(float u,float y){ return u>0.93&&abs(y)<0.038*SHARK_SCALE*smoothstep(0.93,1.0,u); }
float glyphY(vec2 p,float aa,float local){
  float d0=seg(p,vec2(-0.67,-0.34),vec2(0.08,0.18));
  float d1=seg(p,vec2(0.08,0.18),vec2(0.56,-0.36));
  float d2=seg(p,vec2(0.08,0.18),vec2(0.31,0.70));
  float mainStroke=1.0-smoothstep(0.235,0.235+aa,d0);
  float second=(1.0-smoothstep(0.215,0.215+aa,d1))*smoothstep(0.11,0.38,local);
  float third=(1.0-smoothstep(0.19,0.19+aa,d2))*smoothstep(0.52,0.88,local);
  return max(mainStroke,max(second,third));
}
void main(){
  vec2 uv=(gl_FragCoord.xy-0.5*u_resolution)/u_resolution.y;
  float t=fract(u_time);
  // Seven spine samples: the fish read the shark's body from these.
  vec2 sp[7];
  vec2 dummy;
  for(int k=0;k<7;k++) sp[k]=spine(float(k)/6.0,t,dummy);

  // The school: a clockwise bait-ball vortex. Fish sit evenly on rings and every ring slides two slots
  // per loop, so the same arrangement returns at the seam. All fish face the current, so the flow
  // lines read even in a still frame. Near the shark they are pushed clear of its outline.
  float fishB=0.0;
  float rho=length(uv);
  float ang=atan(uv.y,uv.x);
  for(int ri=0;ri<11;ri++){
    float R=0.075+0.060*float(ri);
    if(abs(rho-R)>0.26) continue;
    float n=floor(TAU*R/0.066);
    float slot=TAU/n;
    float rot=-2.0*slot*t;
    float off=hash1(float(ri)*7.0+3.0)*slot;
    float jc=floor((ang-rot-off)/slot+0.5);
    // Shape varies by ring; sway alternates fish to fish, so a two-slot shift maps every fish onto an identical one.
    float local=0.38+0.62*hash1(float(ri)*13.0+41.0);
    for(int dj=-3;dj<=3;dj++){
      float j=jc+float(dj);
      float a=off+rot+j*slot;
      float alt=mod(j,2.0);
      float sway=0.010*sin(TAU*t+3.14159265*alt);
      vec2 dirOut=vec2(cos(a),sin(a));
      vec2 home=(R+sway)*dirOut;
      vec2 heading=vec2(sin(a),-cos(a));
      if(length(uv-home)>0.25) continue;
      float best=1e3; vec2 near=home; float nearU=0.0;
      for(int k=0;k<6;k++){
        vec2 sa=sp[k], sb=sp[k+1], v=sb-sa;
        float f=clamp(dot(home-sa,v)/max(dot(v,v),1e-6),0.0,1.0);
        vec2 cp=sa+v*f;
        float d=length(home-cp);
        if(d<best){best=d;near=cp;nearU=(float(k)+f)/6.0;}
      }
      vec2 away=normalize(home-near+vec2(1e-5));
      // Distance from the outline, not the spine: the pectoral fins and the tail reach much wider than the body.
      float hwNear=halfWidth(nearU);
      float outside=best-hwNear;
      // Fish inside the outline are carried out to it first; the wide falloff then spreads them instead of packing them.
      float fear=exp(-pow(max(outside,0.0)/0.14,2.0));
      vec2 pos=home+away*(max(-outside,0.0)+0.13*fear);
      vec2 dp=uv-pos;
      if(max(abs(dp.x),abs(dp.y))>0.032) continue;
      float radius=(0.0140+0.0040*local)*(0.95+0.10*alt);
      // Even when displaced, every fish keeps facing the vortex current.
      vec2 axis=heading;
      vec2 side=vec2(-axis.y,axis.x);
      vec2 p=vec2(dot(dp,axis),dot(dp,side))/radius;
      float g=glyphY(p,0.55/u_resolution.y/radius,local);
      fishB=max(fishB,g*(0.42+0.50*fear));
    }
  }

  // The shark: marks on a body grid, each riding its own delayed point of the spine like scales.
  float sharkB=0.0;
  float toBody=1e3;
  for(int k=0;k<7;k++) toBody=min(toBody,length(uv-sp[k]));
  if(toBody<0.17){
    for(int r=0;r<38;r++){
      float u=(float(r)+0.5)/38.0;
      vec2 dir;
      vec2 base=spine(u,t,dir);
      if(length(uv-base)>0.17) continue;
      vec2 nrm=vec2(-dir.y,dir.x);
      float hw=halfWidth(u);
      // Symmetric about the spine: even rows hold a mark on it, odd rows sit half a step to either side.
      float odd=mod(float(r),2.0);
      for(int c=0;c<14;c++){
        if(odd<0.5&&c==13) continue;
        float y=(float(c)-6.0-0.5*odd)*0.0140*SHARK_SCALE;
        if(abs(y)>hw||inTailNotch(u,y)) continue;
        // A mark reaching half a step past both neighboring rows stands alone at a fin tip; leave it out.
        if(abs(y)>min(halfWidth(u-1.0/38.0),halfWidth(u+1.0/38.0))+0.007*SHARK_SCALE) continue;
        vec2 pos=base+nrm*y;
        vec2 dp=uv-pos;
        if(max(abs(dp.x),abs(dp.y))>0.024) continue;
        float radius=0.0096*SHARK_SCALE;
        vec2 side=vec2(-dir.y,dir.x);
        vec2 p=vec2(dot(dp,dir),dot(dp,side))/radius;
        float aaS=0.55/u_resolution.y/radius;
        // The Y mark is lopsided, so the left half of the body draws it mirrored; marks on the spine
        // draw both, an arrow pointing forward.
        float g;
        if(abs(y)<0.001) g=max(glyphY(p,aaS,1.0),glyphY(vec2(p.x,-p.y),aaS,1.0));
        else g=glyphY(vec2(p.x,y<0.0?-p.y:p.y),aaS,1.0);
        sharkB=max(sharkB,g);
      }
    }
  }

  // Ukiyo-e color: a washi ground with bokashi, the woodblock printer's soft gradation, of Prussian
  // blue sinking from the top and a faint cherry haze rising from the bottom. The school is a grey
  // indigo; the shark is the darkest ink on the sheet, so the eye goes to it first.
  float yv=gl_FragCoord.y/u_resolution.y;
  vec3 washi=vec3(236.0,226.0,205.0)/255.0;
  vec3 beroai=vec3(70.0,106.0,150.0)/255.0;
  vec3 sakura=vec3(232.0,184.0,178.0)/255.0;
  vec3 bg=mix(washi,beroai,0.88*smoothstep(0.55,1.0,yv));
  bg=mix(bg,sakura,0.60*smoothstep(0.42,0.0,yv));
  vec3 school=vec3(74.0,104.0,140.0)/255.0;
  vec3 ink=vec3(27.0,40.0,72.0)/255.0;
  vec3 col=mix(bg,school,clamp(fishB,0.0,1.0));
  col=mix(col,ink,clamp(sharkB,0.0,1.0));
  gl_FragColor=vec4(col,1.0);
}
