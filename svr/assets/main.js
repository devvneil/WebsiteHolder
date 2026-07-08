/* ============================================================
   SVR ROBOTICS — engine
   1. A 3-link planar robot arm in SVG, solved with FABRIK
      inverse kinematics. Tracks the cursor; runs a pick &
      place cycle when idle. Live telemetry readout.
   2. Reveals, stat counters, clock.
   ============================================================ */

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ------------------------------------------------------------
   1. THE ARM
------------------------------------------------------------ */
const svg = document.getElementById('arm');
const NS = 'http://www.w3.org/2000/svg';
const W = 640, H = 640;

// base position & link lengths
const BASE = { x: 320, y: 560 };
const LINKS = [190, 160, 110];
const REACH = LINKS.reduce((a, b) => a + b, 0);

// joint positions (FABRIK works on points)
let joints = [
  { x: BASE.x, y: BASE.y },
  { x: BASE.x, y: BASE.y - LINKS[0] },
  { x: BASE.x, y: BASE.y - LINKS[0] - LINKS[1] },
  { x: BASE.x, y: BASE.y - REACH },
];
let target = { x: 420, y: 260 };   // smoothed IK goal
let goal = { x: 420, y: 260 };     // raw goal

function el(name, attrs) {
  const e = document.createElementNS(NS, name);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
}

/* --- static scene: floor, base pedestal, dimension marks --- */
function buildScene() {
  // ruler ticks along top and left edges (HUD feel)
  for (let x = 40; x <= W - 40; x += 40) {
    const major = (x - 40) % 120 === 0;
    svg.appendChild(el('line', { x1: x, y1: 16, x2: x, y2: major ? 30 : 24, stroke: 'rgba(56,214,224,0.35)', 'stroke-width': 1 }));
    if (major) {
      const t = el('text', { x: x + 4, y: 40, fill: 'rgba(232,234,237,0.25)', 'font-size': 8.5, 'font-family': 'IBM Plex Mono, monospace' });
      t.textContent = String(x).padStart(3, '0');
      svg.appendChild(t);
    }
  }
  for (let y = 80; y <= H - 80; y += 40) {
    const major = (y - 80) % 120 === 0;
    svg.appendChild(el('line', { x1: 16, y1: y, x2: major ? 30 : 24, y2: y, stroke: 'rgba(56,214,224,0.35)', 'stroke-width': 1 }));
  }
  // reach envelope
  svg.appendChild(el('circle', { cx: BASE.x, cy: BASE.y, r: REACH, fill: 'none', stroke: 'rgba(56,214,224,0.10)', 'stroke-width': 1, 'stroke-dasharray': '3 7' }));
  svg.appendChild(el('circle', { cx: BASE.x, cy: BASE.y, r: REACH * 0.55, fill: 'none', stroke: 'rgba(56,214,224,0.07)', 'stroke-width': 1, 'stroke-dasharray': '2 8' }));
  const envLabel = el('text', { x: BASE.x + REACH * 0.71, y: BASE.y - REACH * 0.71, fill: 'rgba(56,214,224,0.4)', 'font-size': 9, 'font-family': 'IBM Plex Mono, monospace', 'letter-spacing': 1.5 });
  envLabel.textContent = 'REACH ⌀920';
  svg.appendChild(envLabel);
  // floor
  svg.appendChild(el('line', { x1: 40, y1: BASE.y + 34, x2: W - 40, y2: BASE.y + 34, stroke: 'rgba(232,234,237,0.25)', 'stroke-width': 2 }));
  for (let x = 60; x < W - 40; x += 26) {
    svg.appendChild(el('line', { x1: x, y1: BASE.y + 34, x2: x - 12, y2: BASE.y + 46, stroke: 'rgba(232,234,237,0.14)', 'stroke-width': 1 }));
  }
  // pedestal
  svg.appendChild(el('path', { d: `M${BASE.x - 46} ${BASE.y + 34} L${BASE.x - 30} ${BASE.y - 6} L${BASE.x + 30} ${BASE.y - 6} L${BASE.x + 46} ${BASE.y + 34} Z`, fill: '#191d23', stroke: 'rgba(232,234,237,0.3)', 'stroke-width': 1.5 }));
  svg.appendChild(el('line', { x1: BASE.x - 34, y1: BASE.y + 12, x2: BASE.x + 34, y2: BASE.y + 12, stroke: 'rgba(255,106,0,0.6)', 'stroke-width': 2 }));
  // conveyor pallets (pick & place props)
  const pallet = (x, label) => {
    const g = el('g', {});
    g.appendChild(el('rect', { x: x - 30, y: BASE.y + 6, width: 60, height: 12, fill: '#191d23', stroke: 'rgba(232,234,237,0.25)' }));
    const t = el('text', { x, y: BASE.y + 30, 'text-anchor': 'middle', fill: 'rgba(232,234,237,0.3)', 'font-size': 9, 'font-family': 'IBM Plex Mono, monospace', 'letter-spacing': 2 });
    t.textContent = label;
    g.appendChild(t);
    svg.appendChild(g);
  };
  pallet(120, 'PICK');
  pallet(520, 'PLACE');
}

/* --- the box the arm carries --- */
const box = el('rect', { width: 26, height: 26, fill: '#ff6a00', stroke: '#0d0f12', 'stroke-width': 2, rx: 2 });
let boxHeld = false;
let boxPos = { x: 120, y: BASE.y - 8 };

/* --- arm segments (drawn as tapered capsules) --- */
const armGroup = el('g', {});
const segs = LINKS.map((len, i) => {
  const g = el('g', {});
  const wOuter = 26 - i * 6;
  g.appendChild(el('line', { class: 'seg-body', x1: 0, y1: 0, x2: len, y2: 0, stroke: '#2a3038', 'stroke-width': wOuter, 'stroke-linecap': 'round' }));
  g.appendChild(el('line', { class: 'seg-stripe', x1: 8, y1: 0, x2: len - 8, y2: 0, stroke: i === 1 ? '#ff6a00' : '#3a424d', 'stroke-width': Math.max(3, wOuter - 14), 'stroke-linecap': 'round' }));
  armGroup.appendChild(g);
  return g;
});
// joints drawn over segments
const jointDots = joints.map((_, i) => {
  const r = i === 0 ? 16 : i === 3 ? 0 : 11;
  const c = el('circle', { r, fill: '#14171c', stroke: i === 0 ? '#ff6a00' : 'rgba(232,234,237,0.5)', 'stroke-width': 2 });
  return c;
});
// gripper
const gripper = el('g', {});
gripper.appendChild(el('path', { d: 'M0 -12 L16 -12 L16 -20 L22 -20 L22 -4 L8 -4 Z', fill: '#3a424d', stroke: 'rgba(232,234,237,0.4)', 'stroke-width': 1 }));
gripper.appendChild(el('path', { d: 'M0 12 L16 12 L16 20 L22 20 L22 4 L8 4 Z', fill: '#3a424d', stroke: 'rgba(232,234,237,0.4)', 'stroke-width': 1 }));
gripper.appendChild(el('circle', { r: 7, fill: '#14171c', stroke: '#38d6e0', 'stroke-width': 2 }));

// target reticle
const reticle = el('g', { opacity: 0.9 });
reticle.appendChild(el('circle', { r: 14, fill: 'none', stroke: '#38d6e0', 'stroke-width': 1, 'stroke-dasharray': '4 4' }));
reticle.appendChild(el('line', { x1: -20, y1: 0, x2: -8, y2: 0, stroke: '#38d6e0', 'stroke-width': 1 }));
reticle.appendChild(el('line', { x1: 8, y1: 0, x2: 20, y2: 0, stroke: '#38d6e0', 'stroke-width': 1 }));
reticle.appendChild(el('line', { x1: 0, y1: -20, x2: 0, y2: -8, stroke: '#38d6e0', 'stroke-width': 1 }));
reticle.appendChild(el('line', { x1: 0, y1: 8, x2: 0, y2: 20, stroke: '#38d6e0', 'stroke-width': 1 }));

buildScene();
svg.appendChild(box);
svg.appendChild(armGroup);
jointDots.forEach(d => svg.appendChild(d));
svg.appendChild(gripper);
svg.appendChild(reticle);

/* --- FABRIK solver --- */
function solveIK(tx, ty) {
  // clamp target inside reach
  const dx = tx - BASE.x, dy = ty - BASE.y;
  const dist = Math.hypot(dx, dy);
  if (dist > REACH - 4) {
    tx = BASE.x + (dx / dist) * (REACH - 4);
    ty = BASE.y + (dy / dist) * (REACH - 4);
  }
  // elbow-up bias: nudge mid joints upward so FABRIK settles into the
  // over-shoulder configuration a real industrial arm would use
  joints[1].y -= 26;
  joints[2].y -= 14;
  for (let iter = 0; iter < 8; iter++) {
    // backward
    joints[3].x = tx; joints[3].y = ty;
    for (let i = 2; i >= 0; i--) {
      const d = Math.hypot(joints[i].x - joints[i + 1].x, joints[i].y - joints[i + 1].y) || 1;
      const r = LINKS[i] / d;
      joints[i].x = joints[i + 1].x + (joints[i].x - joints[i + 1].x) * r;
      joints[i].y = joints[i + 1].y + (joints[i].y - joints[i + 1].y) * r;
    }
    // forward
    joints[0].x = BASE.x; joints[0].y = BASE.y;
    for (let i = 0; i < 3; i++) {
      const d = Math.hypot(joints[i + 1].x - joints[i].x, joints[i + 1].y - joints[i].y) || 1;
      const r = LINKS[i] / d;
      joints[i + 1].x = joints[i].x + (joints[i + 1].x - joints[i].x) * r;
      joints[i + 1].y = joints[i].y + (joints[i + 1].y - joints[i].y) * r;
    }
  }
}

/* --- pointer interaction --- */
let pointerInCell = false;
let lastPointerTime = -99999;
svg.addEventListener('pointermove', (e) => {
  const r = svg.getBoundingClientRect();
  goal.x = ((e.clientX - r.left) / r.width) * W;
  goal.y = ((e.clientY - r.top) / r.height) * H;
  pointerInCell = true;
  lastPointerTime = performance.now();
});
svg.addEventListener('pointerleave', () => { pointerInCell = false; });

/* --- idle pick & place program --- */
const PICK = { x: 120, y: BASE.y - 20 };
const PLACE = { x: 520, y: BASE.y - 20 };
const LIFT = 190;
let phase = 0, phaseT = 0;
// phases: 0 hover-pick, 1 descend, 2 grab+lift, 3 traverse, 4 lower, 5 release+retreat
function idleProgram(dt) {
  phaseT += dt;
  const durations = [900, 700, 800, 1400, 700, 900];
  const t = Math.min(phaseT / durations[phase], 1);
  const ease = t * t * (3 - 2 * t);
  switch (phase) {
    case 0: goal.x = PICK.x; goal.y = PICK.y - LIFT + 40 * ease; break;
    case 1: goal.x = PICK.x; goal.y = PICK.y - LIFT + 40 + (LIFT - 52) * ease; break;
    case 2:
      if (t > 0.3 && !boxHeld) boxHeld = true;
      goal.x = PICK.x; goal.y = PICK.y - 12 - (LIFT - 30) * ease; break;
    case 3: goal.x = PICK.x + (PLACE.x - PICK.x) * ease; goal.y = PICK.y - LIFT + Math.sin(ease * Math.PI) * -40; break;
    case 4: goal.x = PLACE.x; goal.y = PLACE.y - LIFT + (LIFT - 42) * ease; break;
    case 5:
      if (t > 0.25 && boxHeld) { boxHeld = false; boxPos.x = PLACE.x; boxPos.y = BASE.y - 8; }
      goal.x = PLACE.x - (PLACE.x - PICK.x) * 0.4 * ease; goal.y = PLACE.y - 42 - (LIFT - 60) * ease; break;
  }
  if (t >= 1) {
    phase = (phase + 1) % 6;
    phaseT = 0;
    if (phase === 0) { boxPos.x = PICK.x; boxPos.y = BASE.y - 8; } // reset cycle
  }
}

/* --- telemetry --- */
const t1 = document.getElementById('t1');
const t2 = document.getElementById('t2');
const t3 = document.getElementById('t3');
const tcp = document.getElementById('tcp');
const modeEl = document.getElementById('mode');
const fmt = (deg) => (deg >= 0 ? '+' : '−') + Math.abs(deg).toFixed(1).padStart(5, '0') + '°';

/* --- render --- */
function renderArm() {
  for (let i = 0; i < 3; i++) {
    const a = joints[i], b = joints[i + 1];
    const ang = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
    segs[i].setAttribute('transform', `translate(${a.x} ${a.y}) rotate(${ang})`);
  }
  joints.forEach((j, i) => {
    jointDots[i].setAttribute('cx', j.x);
    jointDots[i].setAttribute('cy', j.y);
  });
  const wrist = joints[2], tip = joints[3];
  const wristAng = Math.atan2(tip.y - wrist.y, tip.x - wrist.x) * 180 / Math.PI;
  gripper.setAttribute('transform', `translate(${tip.x} ${tip.y}) rotate(${wristAng})`);
  reticle.setAttribute('transform', `translate(${goal.x} ${goal.y})`);
  // box
  if (boxHeld) {
    box.setAttribute('x', tip.x - 13 + Math.cos(wristAng * Math.PI / 180) * 18);
    box.setAttribute('y', tip.y - 13 + Math.sin(wristAng * Math.PI / 180) * 18);
  } else {
    box.setAttribute('x', boxPos.x - 13);
    box.setAttribute('y', boxPos.y - 18);
  }
}

/* --- master loop --- */
let last = performance.now();
let telemetryTick = 0;
function frame(now) {
  const dt = Math.min(now - last, 50);
  last = now;

  const manual = pointerInCell || (now - lastPointerTime < 1800);
  if (!manual) {
    idleProgram(dt);
  } else if (boxHeld) {
    // if interrupted mid-carry, drop the box back
    boxHeld = false; boxPos.x = PICK.x; boxPos.y = BASE.y - 8; phase = 0; phaseT = 0;
  }

  // smooth the target (servo lag makes it feel mechanical)
  const k = manual ? 0.14 : 0.10;
  target.x += (goal.x - target.x) * k;
  target.y += (goal.y - target.y) * k;
  solveIK(target.x, target.y);
  renderArm();

  // telemetry @ ~12 Hz
  telemetryTick += dt;
  if (telemetryTick > 80) {
    telemetryTick = 0;
    const a1 = Math.atan2(joints[1].y - joints[0].y, joints[1].x - joints[0].x) * 180 / Math.PI + 90;
    const a2 = Math.atan2(joints[2].y - joints[1].y, joints[2].x - joints[1].x) * 180 / Math.PI + 90;
    const a3 = Math.atan2(joints[3].y - joints[2].y, joints[3].x - joints[2].x) * 180 / Math.PI + 90;
    t1.textContent = fmt(a1);
    t2.textContent = fmt(a2 - a1);
    t3.textContent = fmt(a3 - a2);
    tcp.textContent = `X${Math.round(joints[3].x).toString().padStart(3, '0')} Y${Math.round(H - joints[3].y).toString().padStart(3, '0')}`;
    modeEl.textContent = manual ? 'TEACH' : 'AUTO';
    modeEl.style.color = manual ? '#ff6a00' : '';
  }

  if (!reduceMotion) requestAnimationFrame(frame);
}
solveIK(target.x, target.y);
renderArm();
if (!reduceMotion) requestAnimationFrame(frame);

/* ------------------------------------------------------------
   2. Page furniture
------------------------------------------------------------ */
// clock
const clock = document.getElementById('clock');
function tickClock() {
  const d = new Date();
  clock.textContent = 'IST ' + d.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour12: false });
}
tickClock();
setInterval(tickClock, 1000);

// reveals
const obs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); obs.unobserve(e.target); }
  });
}, { threshold: 0.25 });
document.querySelectorAll('[data-cap], [data-reveal]').forEach((el2, i) => {
  el2.style.transitionDelay = `${(i % 3) * 0.08}s`;
  obs.observe(el2);
});

// stat counters
const statObs = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    statObs.unobserve(e.target);
    const n = e.target.querySelector('.stat-n');
    const end = +e.target.dataset.stat;
    const t0 = performance.now();
    (function count(now) {
      const p = Math.min((now - t0) / 1200, 1);
      n.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(count);
    })(t0);
  });
}, { threshold: 0.6 });
document.querySelectorAll('[data-stat]').forEach(el2 => statObs.observe(el2));
