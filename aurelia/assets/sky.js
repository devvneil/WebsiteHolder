/* AURELIA — the generative sky, as a reusable module.
   Domain-warped simplex fbm nebula, film-graded, mouse & scroll aware. */

const SKY_FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_mouse;
uniform float u_scroll;

vec3 mod289(vec3 x){return x - floor(x*(1.0/289.0))*289.0;}
vec2 mod289(vec2 x){return x - floor(x*(1.0/289.0))*289.0;}
vec3 permute(vec3 x){return mod289(((x*34.0)+1.0)*x);}
float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0,0.0) : vec2(0.0,1.0);
  vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0,i1.y,1.0)) + i.x + vec3(0.0,i1.x,1.0));
  vec3 m = max(0.5 - vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);
  m = m*m; m = m*m;
  vec3 x = 2.0*fract(p*C.www)-1.0;
  vec3 h = abs(x)-0.5;
  vec3 ox = floor(x+0.5);
  vec3 a0 = x-ox;
  m *= 1.79284291400159 - 0.85373472095314*(a0*a0+h*h);
  vec3 g;
  g.x = a0.x*x0.x + h.x*x0.y;
  g.yz = a0.yz*x12.xz + h.yz*x12.yw;
  return 130.0*dot(m,g);
}

float fbm(vec2 p){
  float v = 0.0, a = 0.5;
  mat2 rot = mat2(0.87, 0.48, -0.48, 0.87);
  for(int i=0;i<5;i++){
    v += a*snoise(p);
    p = rot*p*2.02;
    a *= 0.5;
  }
  return v;
}

void main(){
  vec2 p = (gl_FragCoord.xy*2.0 - u_res) / min(u_res.x, u_res.y);

  float t = u_time*0.03;
  vec2 m = (u_mouse - 0.5)*0.55;
  vec2 q = p*0.85 + vec2(0.0, u_scroll*1.4);

  vec2 w1 = vec2(fbm(q + t + m), fbm(q + vec2(5.2,1.3) - t));
  vec2 w2 = vec2(fbm(q + 1.6*w1 + vec2(1.7,9.2) + 0.25*t),
                 fbm(q + 1.6*w1 + vec2(8.3,2.8) - 0.20*t));
  float f = fbm(q + 1.8*w2);

  vec3 cVoid  = vec3(0.027,0.023,0.051);
  vec3 cViolet= vec3(0.106,0.078,0.251);
  vec3 cBlue  = vec3(0.247,0.427,0.949);
  vec3 cTeal  = vec3(0.400,0.886,0.768);
  vec3 cGold  = vec3(0.851,0.725,0.541);

  float lum = f*0.5 + 0.5;
  lum = pow(lum, 1.6);

  vec3 col = mix(cVoid, cViolet, smoothstep(0.05, 0.55, lum));
  col = mix(col, cBlue, smoothstep(0.40, 0.74, lum) * 0.85);
  col = mix(col, cTeal, smoothstep(0.56, 0.88, lum) * (0.6 + 0.25*length(w2)));
  col = mix(col, cGold, smoothstep(0.74, 0.98, lum) * 0.85);

  float fil = smoothstep(0.65, 0.0, abs(f)) * 0.14;
  col += cGold * fil * (0.4 + 0.6*(sin(t*4.0 + p.x*3.0)*0.5+0.5));

  vec2 sp = gl_FragCoord.xy / 3.0;
  vec2 cell = floor(sp);
  float h = fract(sin(dot(cell, vec2(12.9898,78.233)))*43758.5453);
  if(h > 0.9975){
    float tw = 0.5 + 0.5*sin(u_time*(1.0+h*3.0) + h*40.0);
    col += vec3(0.9,0.87,0.8) * tw * smoothstep(0.9975, 1.0, h) * 60.0 * (1.0-lum*0.6);
  }

  float vig = smoothstep(1.55, 0.35, length(p*vec2(0.85,1.0)));
  col *= 0.25 + 0.75*vig;
  float dither = (fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233)))*43758.5453)-0.5)/255.0;
  col += dither;

  gl_FragColor = vec4(col, 1.0);
}`;

const SKY_VERT = `
attribute vec2 a_pos;
void main(){ gl_Position = vec4(a_pos, 0.0, 1.0); }`;

export function initSky(canvas) {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
  if (!gl) return null;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }
  const vs = compile(gl.VERTEX_SHADER, SKY_VERT);
  const fs = compile(gl.FRAGMENT_SHADER, SKY_FRAG);
  if (!vs || !fs) return null;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 3,-1, -1,3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = {};
  ['u_res','u_time','u_mouse','u_scroll'].forEach(n => u[n] = gl.getUniformLocation(prog, n));

  function size() {
    const scale = Math.min(window.devicePixelRatio, 1.5) * 0.75;
    canvas.width = Math.floor(window.innerWidth * scale);
    canvas.height = Math.floor(window.innerHeight * scale);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
  size();
  window.addEventListener('resize', size);

  return {
    draw({ time, mouseX, mouseY, scroll }) {
      gl.uniform2f(u.u_res, canvas.width, canvas.height);
      gl.uniform1f(u.u_time, time);
      gl.uniform2f(u.u_mouse, mouseX, 1 - mouseY);
      gl.uniform1f(u.u_scroll, scroll);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
  };
}
