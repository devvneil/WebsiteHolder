/* ============================================================
   TANGERINE PRESS — engine
   1. Kinetic hero: variable-font weight follows the cursor
   2. Scroll-velocity-reactive ticker
   3. Type Gym: live variable axes
   4. Reveals
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
   1. Kinetic hero letters.
   Each letter's weight & width flex by proximity to the cursor —
   a wave of ink swelling under your hand. Idle: a slow breathing
   wave passes through the words.
------------------------------------------------------------ */
const words = [...document.querySelectorAll('.hero-word')];
const letters = words.flatMap(w => [...w.querySelectorAll('span:not(.hero-star)')]);
let mouse = { x: -9999, y: -9999 };
let lastMove = 0;

window.addEventListener('pointermove', (e) => {
  mouse.x = e.clientX; mouse.y = e.clientY;
  lastMove = performance.now();
}, { passive: true });

// cache letter centers; refresh on resize/scroll
let centers = [];
function measure() {
  centers = letters.map(el => {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
}
window.addEventListener('resize', measure);
window.addEventListener('scroll', measure, { passive: true });

const RANGE = 260;
function animateLetters(t) {
  const idle = performance.now() - lastMove > 2200;
  letters.forEach((el, i) => {
    let w, wd;
    if (idle || reduceMotion) {
      // breathing wave
      const phase = t / 900 - i * 0.55;
      const s = (Math.sin(phase) + 1) / 2;
      w = 300 + s * 500;
      wd = 88 + s * 30;
    } else {
      const c = centers[i];
      if (!c) return;
      const d = Math.hypot(mouse.x - c.x, mouse.y - c.y);
      const k = Math.max(0, 1 - d / RANGE);
      const e = k * k * (3 - 2 * k); // smoothstep
      w = 340 + e * 560;
      wd = 86 + e * 39;
    }
    el.style.fontVariationSettings = `'wght' ${w.toFixed(0)}, 'wdth' ${wd.toFixed(1)}`;
  });
}

/* ------------------------------------------------------------
   2. Ticker that reacts to scroll velocity.
------------------------------------------------------------ */
const ticker = document.getElementById('ticker');
let tickX = 0, tickVel = 0, lastScroll = window.scrollY;

function animateTicker(dt) {
  const s = window.scrollY;
  const raw = (s - lastScroll) / dt * 16;
  lastScroll = s;
  tickVel += (Math.abs(raw) * 0.35 - tickVel) * 0.06;
  const speed = reduceMotion ? 0 : 0.6 + Math.min(tickVel, 7);
  tickX -= speed * (dt / 16);
  const half = ticker.scrollWidth / 2;
  if (-tickX >= half) tickX += half;
  ticker.style.transform = `translateX(${tickX}px)`;
}

/* ------------------------------------------------------------
   3. Type Gym
------------------------------------------------------------ */
const specimen = document.getElementById('specimen');
const wght = document.getElementById('wght');
const wdth = document.getElementById('wdth');
const wghtVal = document.getElementById('wghtVal');
const wdthVal = document.getElementById('wdthVal');

function updateGym() {
  specimen.style.fontVariationSettings = `'wght' ${wght.value}, 'wdth' ${wdth.value}`;
  wghtVal.textContent = wght.value;
  wdthVal.textContent = wdth.value;
}
wght.addEventListener('input', updateGym);
wdth.addEventListener('input', updateGym);
updateGym();

/* ------------------------------------------------------------
   4. Reveals
------------------------------------------------------------ */
const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); obs.unobserve(e.target); }
  });
}, { threshold: 0.4 });
document.querySelectorAll('[data-reveal]').forEach(el => obs.observe(el));

/* ------------------------------------------------------------
   master loop
------------------------------------------------------------ */
let last = performance.now();
function frame(now) {
  const dt = Math.min(now - last, 64);
  last = now;
  animateLetters(now);
  animateTicker(dt);
  requestAnimationFrame(frame);
}
measure();
// letters may reflow once fonts finish loading
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
requestAnimationFrame(frame);
