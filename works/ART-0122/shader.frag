precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_seed;
#define PI 3.141592653589793
float hash(float x){ return fract(sin(x*127.1+u_seed*19.23)*43758.5453); }
// Smoothed Lloyd-like kernel field: sites affect concentration, never outlines.
vec2 cvt(vec2 p){
  vec2 cell=floor(p*3.0); vec2 sum=vec2(0.0); float weight=0.0;
  for(int j=-1;j<=1;j++) for(int i=-1;i<=1;i++){
    vec2 id=cell+vec2(float(i),float(j));
    vec2 site=(id+0.5+0.105*(vec2(hash(dot(id,vec2(13.1,7.7))),hash(dot(id,vec2(3.7,17.3))))-0.5))/3.0;
    vec2 d=p-site; float w=exp(-17.0*dot(d,d));
    sum+=w*(site-(id+0.5)/3.0); weight+=w;
  }
  return sum/max(weight,0.001);
}
void main(){
  vec2 p=gl_FragCoord.xy/u_resolution.xy;
  vec2 c=cvt(p);
  vec2 n=vec2(0.825,0.565), tangent=vec2(-n.y,n.x);
  float s=dot(p-0.5,n), v=dot(p-0.5,tangent);
  float phase=0.055+0.075*u_seed;
  // Spatial field stays anchored; the periodic band phase travels one way.
  float flow=s;
  float reaction=0.036+0.0045*sin(6.0*v+27.0*c.y);
  float feed=0.058+0.003*sin(5.0*s+23.0*c.x);
  float bent=flow+0.066*sin(5.4*v+1.0)+0.095*c.x+0.03*sin(9.0*v+16.0*c.y);
  float early=smoothstep(0.06,0.20,u_time)*(1.0-smoothstep(0.31,0.47,u_time));
  float late=smoothstep(0.53,0.70,u_time)*(1.0-smoothstep(0.83,1.0,u_time));
  float band=sin(2.0*PI*(2.45*bent+0.16*sin(3.0*v)-u_time));
  float spots=sin(2.0*PI*(3.7*v+0.43*sin(4.6*flow)+5.0*c.y));
  // Analytic concentration approximation: broad reaction bands, local spot instability.
  float unstable=smoothstep(-0.13,0.47,band+0.31*spots*spots-0.21);
  float base=0.23+0.64*unstable;
  // The reaction substrate is stationary; a straight scan travels forward over it.
  // One complete sweep defines the substrate without a reverse fade.
  float exposure=0.0;
  for(int k=0;k<10;k++){
    float tau=(float(k)+0.5)/10.0;
    float active=1.0;
    float scan=fract(tau+phase)*1.35-0.675;
    float d=flow-scan;
    exposure+=active*exp(-45.0*d*d)*0.1;
  }
  float reset=1.0;
  float driven=(1.0-exp(-18.0*exposure))*reset;
  float scanNow=fract(u_time+phase)*1.35-0.675;
  float movingFront=exp(-23.0*pow(flow-scanNow,2.0))*reset;
  float grown=smoothstep(-0.26,0.62,band+0.31*spots*spots-0.21+driven*(0.38+0.35*spots));
  float concentration=clamp(base+0.70*(grown-unstable)+driven*(0.10-0.13*unstable+0.05*spots)+0.08*movingFront*(0.38-0.76*unstable),0.0,1.0);
  // Wide bands retain continuous tonal interpolation, not three hard palette cuts.
  float ink=smoothstep(0.30,0.78,concentration);
  float edge=smoothstep(0.35,0.53,concentration)*(1.0-smoothstep(0.62,0.79,concentration));
  float front=edge*driven*smoothstep(0.28,0.62,concentration);
  vec3 lemon=vec3(245.0,230.0,74.0)/255.0;
  vec3 purple=vec3(59.0,31.0,122.0)/255.0;
  vec3 green=vec3(31.0,168.0,116.0)/255.0;
  vec3 col=mix(lemon,purple,ink);
  col=mix(col,green,0.65*front);
  gl_FragColor=vec4(col,1.0);
}
