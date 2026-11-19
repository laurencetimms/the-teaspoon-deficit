/* ===== the window: one fragment shader draws the sky, the hull, the belt and the fleet ===== */
const FRAG = `
precision mediump float;
uniform vec2 R; uniform float T, SEA, WARM, BEDS, POP, PH, COM, DRIFT, PULSE, TUN, GOLD, FLEET, BELT, HUTS, RACKS, ANT, OBS, STEAM, PRESS, MIND, HOT, CREW, BIG;
float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
float fbm(vec2 p){ float a=.5, s=0.; for(int i=0;i<4;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
float stars(vec2 uv, float sc, float th){ vec2 g=floor(uv*sc), f=fract(uv*sc)-.5; float r=h(g);
  vec2 o=vec2(h(g+3.1),h(g+7.7))-.5; float d=length(f-o*.6);
  return step(th,r)*smoothstep(.10,.0,d)*(.6+.4*sin(T*(1.+r*3.)+r*40.)); }
float hullY(float x){ return .27 - .10*x*x + .010*n(vec2(x*9.,1.)) - (PH>2.5?.08:0.); }
void main(){
  vec2 uv=gl_FragCoord.xy/R; float asp=R.x/R.y; vec2 p=vec2((uv.x-.5)*asp, uv.y);
  vec3 col=mix(vec3(.020,.030,.055), vec3(.045,.040,.095), uv.y);
  float nb=fbm(p*1.6+vec2(T*.004,0.));
  vec3 nc=PH<1.5?vec3(.08,.24,.26):PH<2.5?vec3(.27,.17,.08):vec3(.20,.09,.27);
  col+=nc*pow(nb,3.)*1.3;
  col+=vec3(.9,.95,1.)*(stars(p+vec2(T*.002,0.),38.,.86)+.6*stars(p*1.7+3.+vec2(T*.001,0.),60.,.9));
  /* the sun swings round with the seasons */
  float ang=SEA/4.*6.2832; vec2 sp=vec2(-sin(ang)*.36*asp, .74+.13*cos(ang));
  float sr=.018+.030*WARM, sd=length(p-sp);
  vec3 sunc=vec3(1.,.86,.62);
  col+=sunc*(smoothstep(sr,sr*.55,sd)+.10*WARM*sr/(sd*sd*14.+.004));
  /* the fleet: ladles in teal, forks in red */
  if(PH>2.5){ vec2 q=p*2.2+vec2(T*.006,T*.002); vec2 g=floor(q*26.); float r=h(g+9.);
    float s=stars(q,26.,1.-FLEET*.55);
    col+=mix(vec3(.25,.95,.85), vec3(1.,.25,.2), step(h(g+21.),DRIFT))*s*1.4; }
  /* the belt */
  if(PH>1.5){ float band=exp(-pow((p.y-.60)*6.5,2.));
    for(int i=0;i<2;i++){ float fi=float(i); vec2 q=vec2(p.x*(7.+fi*5.)+T*.02*(fi+1.), (p.y-.60)*(16.+fi*8.));
      vec2 g=floor(q), f=fract(q)-.5; float r=h(g+fi*17.);
      float rock=step(1.-.42*BELT,r)*smoothstep(.34,.20,length(f*vec2(1.,1.3)+(vec2(h(g+1.),h(g+2.))-.5)*.3)+.12*n(q*3.));
      col=mix(col, vec3(.16,.14,.12)+sunc*.22*smoothstep(-.3,.4,f.y+f.x*sign(sp.x-p.x)), rock*band); }
    vec2 dq=vec2(p.x*22., p.y*30.-T*1.2); vec2 dg=floor(dq); float dr=h(dg+5.);
    col+=vec3(.5,1.,.9)*step(.93,dr)*smoothstep(.25,0.,length(fract(dq)-.5))*smoothstep(.62,.5,p.y)*smoothstep(.2,.32,p.y)*.8; }
  /* comet */
  if(COM>=0.){ vec2 hd=vec2(mix(-.55,.55,COM)*asp, .90-.22*COM), dir=normalize(vec2(asp*1.1,-.22));
    vec2 v=p-hd; float al=dot(v,-dir), pe=length(v+dir*al);
    col+=vec3(.75,.9,1.)*(smoothstep(.014*(1.+al*6.),0.,pe)*smoothstep(.38,0.,al)*step(0.,al)*.7+.0007/(dot(v,v)+.0004)); }
  /* the hull, and the life on it */
  float hy=hullY(p.x);
  vec3 amber=vec3(1.,.72,.36);
  /* steam from the boilers, rising and leaning */
  if(STEAM>0.){ for(int i=0;i<3;i++){ float fi=float(i); float x0=(fi-1.)*.42*asp+.07; float bx=hullY(x0);
      float up=p.y-bx; if(up>0.&&up<.5){ float w=.012+up*.16; float lean=x0+up*up*.5;
        float m=exp(-pow((p.x-lean)/w,2.))*smoothstep(.5,.0,up)*fbm(vec2(p.x*14.-lean*14., up*7.-T*.5)+fi*7.);
        col=mix(col, vec3(.78,.8,.82), clamp(m*1.6*STEAM*step(fi+.5,STEAM*3.+.5),0.,.65)); } } }
  /* the Mind: a porthole that glows as it thinks */
  { vec2 mp=vec2(.0, hullY(0.)+.012); float md=length((p-mp)*vec2(1.,1.25));
    vec3 mc=mix(vec3(1.,.78,.4), vec3(1.,.25,.15), HOT*(.6+.4*sin(T*11.)));
    col+=mc*MIND*(.55+.45*sin(T*1.7))*exp(-md*md*900.)*.9; col+=mc*MIND*.25*exp(-md*14.)*smoothstep(-.02,.06,p.y-hy); }
  /* antennas */
  for(int i=0;i<3;i++){ float fi=float(i); if(fi<ANT){ float ax=(.18+fi*.11)*asp*(mod(fi,2.)<1.?1.:-1.); float ab=hullY(ax), at=ab+.09+.03*fi;
      float l=smoothstep(.0028,.0,abs(p.x-ax))*step(ab,p.y)*step(p.y,at); col=mix(col, vec3(.55,.6,.6), l);
      float blink=step(.5,fract(T*.6+fi*.37)); col+=vec3(1.,.2,.15)*blink*exp(-dot(p-vec2(ax,at),p-vec2(ax,at))*9000.)*1.4; } }
  /* observatory dome with its slit open */
  if(OBS>0.){ float ox=-.30*asp, ob=hullY(ox); vec2 q=p-vec2(ox,ob); float r=.034+.004*min(OBS,4.);
    if(length(q*vec2(1.,1.15))<r&&q.y>0.){ col=vec3(.12,.13,.14)+.05*q.y/r; float slit=smoothstep(.004,.0,abs(q.x+q.y*.4))*step(.004,q.y); col+=vec3(.6,.75,1.)*slit*.7; } }
  if(p.y<hy){ float dep=hy-p.y;
    vec3 hull=vec3(.085,.095,.105)+.03*n(p*vec2(30.,60.));
    float seam=smoothstep(.04,.0,abs(fract(p.x*7.+.5*floor(dep*13.))-.5)-.46)+smoothstep(.06,.0,abs(fract(dep*13.)-.5)-.44);
    hull*=1.-.35*clamp(seam,0.,1.);
    float l=fbm(p*vec2(8.,14.)+11.), lm=smoothstep(.78-BEDS*.5, .86-BEDS*.5, l)*smoothstep(0.,.02,dep);
    vec3 lich=mix(vec3(.36,.52,.10), vec3(.86,.74,.18), n(p*40.))*(.30+.55*WARM);
    hull=mix(hull, lich, lm*.9);
    hull+=sunc*smoothstep(.035,0.,dep)*.30*WARM;
    hull+=vec3(.9,.6,.3)*PRESS*.05*pow(max(0.,sin(T*7.+p.x*3.)),8.)*smoothstep(.12,.0,dep);
    float gx=floor(p.x*16.), r=h(vec2(gx,5.)); vec2 lp=vec2(fract(p.x*16.)-.5, (dep-.035-r*.12)*16.);
    float lit=step(r,POP)*smoothstep(.20,.0,length(lp))*(.75+.25*sin(T*2.+r*30.))*(1.-TUN*.85);
    hull+=amber*lit*1.2;
    float rx=floor(p.x*40.), ry=floor(dep*55.); float rr=h(vec2(rx,ry+3.));
    if(dep>.07&&dep<.16&&rr<RACKS*.5){ vec2 cl=fract(vec2(p.x*40.,dep*55.))-.5; hull+=amber*.5*smoothstep(.22,.1,max(abs(cl.x),abs(cl.y)))*(1.-TUN*.85)*step(rr, RACKS*.5*(.6+.4*sin(T*.3+rr*20.))); }
    hull+=vec3(.9,.95,1.)*PULSE*exp(-length(p-vec2(0.,hy-.04))*26.);
    col=hull; }
  /* moss huts along the skyline, windows lit as the crew grows */
  for(int i=0;i<20;i++){ float fi=float(i); if(fi<HUTS){ float hx=((h(vec2(fi,2.))-.5)*.92+(fi-9.5)*.004)*asp; float hb=hullY(hx);
      vec2 q=p-vec2(hx,hb-.004); float rr=.016+.006*h(vec2(fi,9.));
      if(length(q*vec2(1.,1.3))<rr&&q.y>-.004){ col=vec3(.16,.22,.12)+.06*n(q*300.); if(fi<POP*20.+.5&&length(q-vec2(0.,rr*.35))<rr*.32) col=mix(col, amber*(.8+.2*sin(T*1.3+fi)), 1.-TUN*.85); } } }
  /* crew out on the hull, at work */
  for(int i=0;i<24;i++){ float fi=float(i); if(fi<CREW*24.){ float sp=(h(vec2(fi,4.))-.5)*.02; float cx=(fract(h(vec2(fi,7.))+T*sp)-.5)*asp*.95; float cy=hullY(cx)+.004;
      float d=length((p-vec2(cx,cy))*vec2(1.,1.6)); col=mix(col, vec3(.85,.9,.8), smoothstep(.0035,.0015,d)*(1.-TUN)); } }
  col=mix(col, col*vec3(1.25,1.02,.62)+vec3(.03,.02,0.), GOLD);
  col*=1.-.35*pow(length(uv-.5)*1.25,2.5);
  col+=(h(gl_FragCoord.xy+T)-.5)*.012;
  gl_FragColor=vec4(col,1.);
}`;
const Sky = {
  ok: false, u: {}, t0: performance.now(),
  init(cv) {
    this.cv = cv;
    try {
      const gl = this.gl = cv.getContext('webgl', {antialias:false, alpha:false, powerPreference:'low-power'}) || cv.getContext('experimental-webgl');
      if (!gl) return;
      const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, 'attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}'));
      gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
      gl.linkProgram(pr); if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,3,-1,-1,3]), gl.STATIC_DRAW);
      const a = gl.getAttribLocation(pr, 'a'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
      for (const k of ['R','T','SEA','WARM','BEDS','POP','PH','COM','DRIFT','PULSE','TUN','GOLD','FLEET','BELT','HUTS','RACKS','ANT','OBS','STEAM','PRESS','MIND','HOT','CREW','BIG']) this.u[k] = gl.getUniformLocation(pr, k);
      this.ok = true;
    } catch (e) { this.ok = false; cv.classList.add('nogl'); }
  },
  draw(v) {
    if (!this.ok) return;
    const gl = this.gl, cv = this.cv, dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const w = Math.max(2, Math.round(cv.clientWidth*dpr)), hgt = Math.max(2, Math.round(cv.clientHeight*dpr));
    if (cv.width != w || cv.height != hgt) { cv.width = w; cv.height = hgt; }
    gl.viewport(0, 0, w, hgt);
    gl.uniform2f(this.u.R, w, hgt); gl.uniform1f(this.u.T, (performance.now() - this.t0)/1000);
    for (const k in v) if (this.u[k]) gl.uniform1f(this.u[k], v[k]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  },
  /* where the sun is, in 0..1 canvas coordinates, for people who cannot resist tapping it */
  sun(sea) { const asp = this.cv.clientWidth/Math.max(1,this.cv.clientHeight), a = sea/4*6.2832; return {x: 0.5 + (-Math.sin(a)*0.36*asp)/asp, y: 1 - (0.74 + 0.13*Math.cos(a))}; }
};
