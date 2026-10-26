precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
float hashCell(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float petal(float a){
  float c=abs(cos(2.0*a));
  float s=abs(sin(2.0*a));
  return pow(pow(c,4.0)+pow(s,4.0),-0.53);
}
float strokeBand(float d,float w,float aa){return 1.0-smoothstep(w-aa,w+aa,abs(d));}
vec3 pigment(float n){
  if(n<0.5) return vec3(0.91,0.20,0.29);
  if(n<1.5) return vec3(0.97,0.46,0.10);
  if(n<2.5) return vec3(0.98,0.78,0.13);
  if(n<3.5) return vec3(0.12,0.72,0.39);
  if(n<4.5) return vec3(0.12,0.42,0.88);
  if(n<5.5) return vec3(0.49,0.25,0.82);
  if(n<6.5) return vec3(0.95,0.30,0.61);
  return vec3(0.04,0.68,0.72);
}
void main(){
  vec2 xy=(gl_FragCoord.xy-0.5*u_resolution)/min(u_resolution.x,u_resolution.y)*0.85;
  vec2 cell=vec2(0.0);
  vec2 p=xy-cell;
  float h=hashCell(cell+vec2(0.39,0.71)*floor(u_seed*4096.0+0.5));
  // Pinwheel: the whole flower turns counterclockwise a quarter turn per loop.
  // Eight-fold symmetry closes the shape; the color shift of 2 sectors plus 6 outward bands is 8, which closes the colors.
  float spin=6.28318530718*0.25*fract(u_time);
  float a=atan(p.y,p.x)-(h-0.5)*0.15-spin;
  float rad=length(p);
  float turn=6.28318530718*fract(u_time);
  float rise=0.5-0.5*cos(turn);
  // The whole flower breathes as one form.
  float bloom=0.45+0.55*rise;
  float boundary=0.300*petal(a)*bloom;
  float signedDist=rad-boundary;
  float pixel=0.85/min(u_resolution.x,u_resolution.y);
  float interior=1.0-smoothstep(-0.6*pixel,0.6*pixel,signedDist);
  // One rule from the center to the rim: nested star bands of equal width.
  float inside=rad/max(boundary,0.0001);
  float bands=11.0;
  // Bands flow outward from the center, six bands per loop.
  float flow=6.0*fract(u_time);
  float band=inside*bands-flow;
  float ringIndex=floor(band);
  // Eight bent seams run from the rim into one central point.
  float bend=0.19*sin(turn+2.5*inside)
    *smoothstep(0.0,0.14,inside)*(1.0-smoothstep(0.62,0.79,inside));
  float sector=fract((a+3.14159265359+0.36*inside+bend)/6.28318530718)*8.0;
  float wedge=floor(sector);
  vec3 bg=vec3(20.0,22.0,43.0)/255.0;
  vec3 col=mix(bg,pigment(mod(ringIndex+wedge,8.0)),interior);
  // Thin background-colored lines of one width between every band and along every seam.
  float lineWidth=0.00170;
  float ringGap=min(fract(band),1.0-fract(band))/bands*boundary;
  float angularGap=rad*min(fract(sector),1.0-fract(sector))*6.28318530718/8.0;
  float seamWidth=min(lineWidth,max(0.00002,rad*0.020));
  float radialLine=1.0-smoothstep(max(0.0,lineWidth-0.48*pixel),lineWidth+0.48*pixel,ringGap);
  float angularLine=1.0-smoothstep(max(0.0,seamWidth-0.48*pixel),seamWidth+0.48*pixel,angularGap);
  float gap=max(radialLine*step(0.5,inside*bands),angularLine)*interior;
  col=mix(col,bg,gap);
  gl_FragColor=vec4(col,1.0);
}
