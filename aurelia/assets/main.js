/* ============================================================
   AURELIA — engine
   1. Sky: raw-WebGL full-screen fragment shader (domain-warped
      simplex fbm nebula, film graded, mouse-aware, scroll-aware)
   2. Artifact: three.js iridescent vertex-displaced icosahedron
   3. Instruments: 2D-canvas generative star charts
   4. Interactions: cursor, magnetics, reveals, progress
   ============================================================ */

import * as THREE from './three.module.js';
import { initSky } from './sky.js';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
   Shared pointer state (lerped for smoothness)
------------------------------------------------------------ */
const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };
window.addEventListener('pointermove', (e) => {
  pointer.tx = e.clientX / window.innerWidth;
  pointer.ty = e.clientY / window.innerHeight;
}, { passive: true });

let scrollY = 0, scrollNorm = 0;
function readScroll() {
  scrollY = window.scrollY;
  const max = document.documentElement.scrollHeight - window.innerHeight;
  scrollNorm = max > 0 ? scrollY / max : 0;
}
window.addEventListener('scroll', readScroll, { passive: true });
readScroll();

/* ============================================================
   1. THE SKY — see sky.js
============================================================ */
const sky = initSky(document.getElementById('sky'));

/* ============================================================
   2. THE ARTIFACT — three.js iridescent form
============================================================ */
const artCanvas = document.getElementById('artifact');
const renderer = new THREE.WebGLRenderer({ canvas: artCanvas, alpha: true, antialias: true });
renderer.setClearColor(0x000000, 0);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.z = 7;

const artifactUniforms = {
  u_time: { value: 0 },
  u_scroll: { value: 0 },
  u_mouse: { value: new THREE.Vector2(0.5, 0.5) },
};

const artifactMat = new THREE.ShaderMaterial({
  transparent: true,
  side: THREE.DoubleSide,
  uniforms: artifactUniforms,
  vertexShader: `
    uniform float u_time;
    uniform float u_scroll;
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vDisp;

    // classic 3D value-ish noise via sin folding (cheap, organic)
    float n3(vec3 p){
      return sin(p.x*1.7 + u_time*0.6)*sin(p.y*2.1 - u_time*0.4)*sin(p.z*1.9 + u_time*0.5);
    }
    void main(){
      float amp = 0.22 + u_scroll*0.55;
      float d = n3(position*1.4) * 0.5 + n3(position*3.1)*0.25;
      vDisp = d;
      vec3 pos = position + normal * d * amp;
      vNormal = normalize(normalMatrix * normal);
      vec4 mv = modelViewMatrix * vec4(pos, 1.0);
      vView = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform float u_time;
    varying vec3 vNormal;
    varying vec3 vView;
    varying float vDisp;
    void main(){
      float fres = pow(1.0 - abs(dot(normalize(vNormal), normalize(vView))), 2.4);
      // iridescence constrained to the site palette: violet -> teal -> gold
      float ph = fract(fres*1.1 + vDisp*0.45 + u_time*0.03);
      vec3 cViolet = vec3(0.16,0.12,0.38);
      vec3 cTeal   = vec3(0.40,0.886,0.768);
      vec3 cGold   = vec3(0.851,0.725,0.541);
      vec3 irid = ph < 0.5 ? mix(cViolet, cTeal, smoothstep(0.0,0.5,ph))
                           : mix(cTeal, cGold, smoothstep(0.5,1.0,ph));
      vec3 base = mix(vec3(0.08,0.06,0.20), cGold, fres);
      vec3 col = mix(base, irid, 0.55);
      float alpha = 0.04 + fres*0.62;
      gl_FragColor = vec4(col, alpha);
    }`,
});

const artifact = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 48), artifactMat);
scene.add(artifact);

// Orbiting halo ring of points
const ringGeo = new THREE.BufferGeometry();
const N_PTS = 900;
{
  const pos = new Float32Array(N_PTS * 3);
  for (let i = 0; i < N_PTS; i++) {
    const a = (i / N_PTS) * Math.PI * 2;
    const r = 3.1 + (Math.random() - 0.5) * 0.5;
    pos[i*3] = Math.cos(a) * r;
    pos[i*3+1] = (Math.random() - 0.5) * 0.18;
    pos[i*3+2] = Math.sin(a) * r;
  }
  ringGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
}
const ring = new THREE.Points(ringGeo, new THREE.PointsMaterial({
  color: 0xd9b98a, size: 0.022, transparent: true, opacity: 0.75,
  blending: THREE.AdditiveBlending, depthWrite: false,
}));
ring.rotation.x = 1.15;
scene.add(ring);

function sizeArtifact() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

/* ============================================================
   3. INSTRUMENTS — generative 2D star charts
============================================================ */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

const GOLD = '#d9b98a', TEAL = '#66e2c4', BLUE = '#3f6df2', DIM = 'rgba(239,233,221,0.35)';

const charts = {
  /* CH·01 — orbital rings + epicycles + seeded stars */
  orbits(ctx, w, h, t, rand) {
    const cx = w/2, cy = h/2;
    ctx.clearRect(0, 0, w, h);
    // seeded stars
    for (let i = 0; i < 220; i++) {
      const x = rand()*w, y = rand()*h, r = rand()*1.1 + 0.2;
      ctx.globalAlpha = 0.25 + 0.5*Math.abs(Math.sin(t*0.8 + i));
      ctx.fillStyle = i % 9 === 0 ? GOLD : 'rgba(239,233,221,0.8)';
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // rings
    for (let i = 0; i < 6; i++) {
      const r = 40 + i * 38;
      ctx.strokeStyle = i === 3 ? GOLD : DIM;
      ctx.lineWidth = i === 3 ? 1.2 : 0.5;
      ctx.setLineDash(i % 2 ? [2, 6] : []);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      // planet on ring
      const a = t * (0.12 + i * 0.05) * (i % 2 ? -1 : 1) + i * 2.2;
      const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
      ctx.fillStyle = i === 3 ? GOLD : TEAL;
      ctx.beginPath(); ctx.arc(px, py, i === 3 ? 5 : 2.5, 0, 7); ctx.fill();
      // epicycle on the gold ring
      if (i === 3) {
        const ea = t * 1.4;
        ctx.strokeStyle = 'rgba(102,226,196,0.5)';
        ctx.beginPath(); ctx.arc(px, py, 16, 0, 7); ctx.stroke();
        ctx.fillStyle = TEAL;
        ctx.beginPath(); ctx.arc(px + Math.cos(ea)*16, py + Math.sin(ea)*16, 2, 0, 7); ctx.fill();
      }
    }
    // center
    ctx.fillStyle = GOLD;
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(217,185,138,0.4)';
    ctx.beginPath(); ctx.arc(cx, cy, 12 + 3*Math.sin(t*2), 0, 7); ctx.stroke();
    // crosshair
    ctx.strokeStyle = DIM; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx, 26); ctx.moveTo(cx, h-26); ctx.lineTo(cx, h-8);
    ctx.moveTo(8, cy); ctx.lineTo(26, cy); ctx.moveTo(w-26, cy); ctx.lineTo(w-8, cy); ctx.stroke();
  },

  /* CH·02 — two-source interference field as contour dots */
  waves(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const s1x = w*0.32 + Math.sin(t*0.4)*30, s1y = h*0.4;
    const s2x = w*0.68, s2y = h*0.6 + Math.cos(t*0.33)*30;
    const step = 13;
    for (let y = step; y < h; y += step) {
      for (let x = step; x < w; x += step) {
        const d1 = Math.hypot(x-s1x, y-s1y), d2 = Math.hypot(x-s2x, y-s2y);
        const v = Math.sin(d1*0.09 - t*2.0) + Math.sin(d2*0.09 - t*1.6);
        const a = Math.abs(v)/2;
        const r = a * 4.4;
        if (r < 0.3) continue;
        ctx.fillStyle = v > 0.9 ? GOLD : v < -0.9 ? BLUE : TEAL;
        ctx.globalAlpha = 0.18 + a*0.6;
        ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    [ [s1x,s1y], [s2x,s2y] ].forEach(([x,y]) => {
      ctx.strokeStyle = GOLD; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(x, y, 7 + 3*Math.sin(t*3), 0, 7); ctx.stroke();
      ctx.fillStyle = GOLD;
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, 7); ctx.fill();
    });
  },

  /* CH·03 — maurer rose traced live */
  rose(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const cx = w/2, cy = h/2, R = Math.min(w,h)*0.4;
    const n = 6, dDeg = 71;
    const steps = 361;
    const drawn = Math.floor((t*22) % (steps*1.6));
    // faint full rose underneath
    ctx.strokeStyle = 'rgba(63,109,242,0.10)'; ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const k = i * dDeg * Math.PI/180;
      const r = R * Math.sin(n*k);
      const x = cx + r*Math.cos(k), y = cy + r*Math.sin(k);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    // live golden pen
    ctx.strokeStyle = 'rgba(217,185,138,0.5)'; ctx.lineWidth = 0.7;
    ctx.shadowColor = 'rgba(217,185,138,0.5)'; ctx.shadowBlur = 4;
    ctx.beginPath();
    const upto = Math.min(drawn, steps);
    for (let i = 0; i <= upto; i++) {
      const k = i * dDeg * Math.PI/180;
      const r = R * Math.sin(n*k);
      const x = cx + r*Math.cos(k), y = cy + r*Math.sin(k);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;
    // pen head
    if (upto > 0 && upto < steps) {
      const k = upto * dDeg * Math.PI/180;
      const r = R * Math.sin(n*k);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(cx + r*Math.cos(k), cy + r*Math.sin(k), 3, 0, 7); ctx.fill();
    }
    // frame ring
    ctx.strokeStyle = DIM; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.arc(cx, cy, R + 24, 0, 7); ctx.stroke();
    ctx.setLineDash([1, 5]);
    ctx.strokeStyle = 'rgba(102,226,196,0.4)';
    ctx.beginPath(); ctx.arc(cx, cy, R + 34, t*0.2, t*0.2 + 4.6); ctx.stroke();
    ctx.setLineDash([]);
  },
};

const chartCanvases = [...document.querySelectorAll('.chart')].map((c, i) => ({
  el: c,
  ctx: c.getContext('2d'),
  fn: charts[c.dataset.chart],
  rand: mulberry32(1000 + i * 777),
  visible: false,
}));

const chartObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    const rec = chartCanvases.find(r => r.el === e.target);
    if (rec) rec.visible = e.isIntersecting;
  });
}, { rootMargin: '80px' });
chartCanvases.forEach(r => chartObserver.observe(r.el));

/* ============================================================
   4. INTERACTIONS
============================================================ */
// reveals
const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('is-in');
      revealObserver.unobserve(e.target);
    }
  });
}, { threshold: 0.18 });
document.querySelectorAll('.reveal, .atlas-text, .chamber-title').forEach(el => revealObserver.observe(el));

// stagger line reveals inside masked headings
document.querySelectorAll('.atlas-text, .chamber-title').forEach(head => {
  [...head.querySelectorAll('.line')].forEach((ln, i) => {
    ln.style.transitionDelay = `${i * 0.12}s`;
  });
});

// custom cursor
const cursorEl = document.querySelector('.cursor');
const dot = document.querySelector('.cursor-dot');
const halo = document.querySelector('.cursor-halo');
const cur = { x: -100, y: -100, hx: -100, hy: -100 };
window.addEventListener('pointermove', (e) => { cur.x = e.clientX; cur.y = e.clientY; }, { passive: true });
document.querySelectorAll('a, button, .swatch').forEach(el => {
  el.addEventListener('pointerenter', () => cursorEl.classList.add('is-hover'));
  el.addEventListener('pointerleave', () => cursorEl.classList.remove('is-hover'));
});

// magnetic elements
const magnets = [...document.querySelectorAll('[data-magnet]')].map(el => ({ el, x: 0, y: 0 }));
window.addEventListener('pointermove', (e) => {
  magnets.forEach(m => {
    const r = m.el.getBoundingClientRect();
    const cx = r.left + r.width/2, cy = r.top + r.height/2;
    const dx = e.clientX - cx, dy = e.clientY - cy;
    const dist = Math.hypot(dx, dy);
    const range = Math.max(r.width, 90);
    if (dist < range) {
      const pull = (1 - dist/range) * 0.35;
      m.x = dx * pull; m.y = dy * pull;
    } else { m.x = 0; m.y = 0; }
  });
}, { passive: true });

// progress bar
const progressFill = document.querySelector('.progress-fill');

// live coordinate readout — the observatory is always drifting
const coordEl = document.getElementById('coord');
if (coordEl && !reduceMotion) {
  setInterval(() => {
    const t = Date.now() / 1000;
    const ra_m = 4 + Math.floor((Math.sin(t * 0.05) * 0.5 + 0.5) * 56);
    const dec_m = 22 + Math.floor((Math.cos(t * 0.037) * 0.5 + 0.5) * 37);
    const z = (0.0034 + Math.sin(t * 0.11) * 0.0008).toFixed(4);
    coordEl.textContent = `RA 21ʰ ${String(ra_m).padStart(2, '0')}ᵐ · DEC −11° ${dec_m}′ · z = ${z}`;
  }, 1200);
}

/* ============================================================
   MASTER LOOP
============================================================ */
const start = performance.now();
let artScroll = 0;

function frame(now) {
  const t = (now - start) / 1000;

  // lerp pointer
  pointer.x += (pointer.tx - pointer.x) * 0.045;
  pointer.y += (pointer.ty - pointer.y) * 0.045;

  // sky
  if (sky) sky.draw({ time: reduceMotion ? 20 : t, mouseX: pointer.x, mouseY: pointer.y, scroll: scrollNorm });

  // artifact: fades in during atlas/chambers, parallax with scroll
  artScroll += (scrollNorm - artScroll) * 0.06;
  artifactUniforms.u_time.value = reduceMotion ? 10 : t;
  artifactUniforms.u_scroll.value = artScroll;
  // fade in after the hero, fade out fully before the colophon
  const fadeIn = Math.min(1, Math.max(0, (artScroll - 0.07) * 10));
  const fadeOut = Math.min(1, Math.max(0, (0.62 - artScroll) * 7));
  const vis = fadeIn * fadeOut;
  artifact.material.opacity = vis;
  artifact.rotation.y = t * 0.12 + artScroll * 2.4;
  artifact.rotation.x = 0.35 + Math.sin(t * 0.1) * 0.15 + (pointer.y - 0.5) * 0.3;
  // drift along the outer thirds so it frames the text instead of covering it
  artifact.position.x = Math.sin(artScroll * Math.PI * 4 + Math.PI) * 3.4 + (pointer.x - 0.5) * 0.3;
  artifact.position.y = -0.1 + Math.cos(artScroll * Math.PI * 2) * 0.5;
  artifact.scale.setScalar(0.42 + vis * 0.22);
  ring.rotation.z = t * 0.05;
  ring.rotation.y = t * 0.08;
  ring.position.copy(artifact.position);
  ring.material.opacity = vis * 0.75;
  artCanvas.style.opacity = vis;
  if (vis > 0.01) renderer.render(scene, camera);

  // charts (only visible ones, at ~30fps)
  if (Math.floor(t * 60) % 2 === 0) {
    chartCanvases.forEach(r => {
      if (r.visible && r.fn) {
        const seeded = mulberry32(1234);
        r.fn(r.ctx, r.el.width, r.el.height, reduceMotion ? 8 : t, seeded);
      }
    });
  }

  // cursor
  cur.hx += (cur.x - cur.hx) * 0.16;
  cur.hy += (cur.y - cur.hy) * 0.16;
  dot.style.transform = `translate(${cur.x}px, ${cur.y}px) translate(-50%,-50%)`;
  halo.style.transform = `translate(${cur.hx}px, ${cur.hy}px) translate(-50%,-50%)`;

  // magnets
  magnets.forEach(m => {
    const curT = m.el.style.transform;
    const target = `translate(${m.x.toFixed(1)}px, ${m.y.toFixed(1)}px)`;
    if (curT !== target) m.el.style.transform = target;
  });

  // progress
  progressFill.style.transform = `scaleX(${scrollNorm})`;

  requestAnimationFrame(frame);
}

function sizeAll() { sizeArtifact(); }
window.addEventListener('resize', sizeAll);
sizeAll();
requestAnimationFrame(frame);
