// The entire simulation is independent of rendering and advances at a fixed 60 Hz.
export const STEP = 1 / 60;
export const LEVEL_END = 196;
export const ENCOUNTER = { trigger: 144.6, rexX: 153, exitX: 157, duckAt: 1.3, turnAt: 3.5, duration: 5.1 };
const smooth = t => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };
// Rendering derives every cinematic pose from rewindable simulation state.
export function encounterPose(s) {
  const e = s.rex.encounter;
  if (!e) return null;
  const t = e.elapsed;
  const duck = smooth((t - .95) / .35) * (1 - smooth((t - 3.1) / .4));
  return { duck, turn: smooth((t - ENCOUNTER.turnAt) / (ENCOUNTER.duration - ENCOUNTER.turnAt)),
    caption: t < 1.3 ? 'JERRY: That is definitely not in the runbook.' : t < 3.5 ? 'JERRY: Small arms. Small gap. Go!' : 'T. REX: Unauthorised access detected.',
    roar: t < 1.3 ? Math.sin(Math.PI * Math.min(1, t / 1.3)) : .25 };
}
function advanceEncounter(session) {
  const s = session.state, e = s.rex.encounter;
  const before = e.elapsed; e.elapsed = Math.min(ENCOUNTER.duration, e.elapsed + STEP);
  const oldX = s.x;
  const run = smooth((e.elapsed - ENCOUNTER.duckAt) / (ENCOUNTER.turnAt - ENCOUNTER.duckAt));
  s.x = e.startX + (ENCOUNTER.exitX - e.startX) * run;
  s.y = 0; s.vy = 0; s.vx = (s.x - oldX) / STEP; s.grounded = true; s.facing = 1; s.jumpBuffer = 0;
  if (before < .35 && e.elapsed >= .35) session.events.push('roar');
  if (before < ENCOUNTER.duckAt && e.elapsed >= ENCOUNTER.duckAt) session.events.push('duck');
  if (e.elapsed >= ENCOUNTER.duration) {
    s.rex.encounter = null; s.rex.active = true; s.rex.chaseTime = 0;
    s.vx = 0; s.invulnerable = 1; session.events.push('chase');
  }
}
export function createEncounterPreview() {
  const session = createSession();
  Object.assign(session.state, { x: ENCOUNTER.trigger, cores: [0, 1, 2, 3, 4], checkpoint: 2 });
  session.state.enemies[5].alive = false;
  return session;
}
export const platforms = [
  { x: -5, w: 21, y: 0 }, { x: 19, w: 15, y: 0 }, { x: 37, w: 22, y: 0 },
  { x: 63, w: 20, y: 0 }, { x: 87, w: 28, y: 0 }, { x: 119, w: 15, y: 0 },
  { x: 138, w: 21, y: 0 }, { x: 163, w: 14, y: 0 }, { x: 181, w: 22, y: 0 },
  { x: 11, w: 5, y: 1.8 }, { x: 19, w: 6, y: 3.4 },
  { x: 38, w: 5, y: 1.7 }, { x: 46, w: 7, y: 3.4 },
  { x: 65, w: 5, y: 1.7 }, { x: 73, w: 7, y: 3.3 },
  { x: 94, w: 5, y: 1.7 }, { x: 102, w: 7, y: 3.4 },
  { x: 121, w: 6, y: 1.6 }, { x: 130, w: 5, y: 3 }, { x: 138, w: 6, y: 3.3 },
];
export const corePositions = [{ x: 22, y: 4.5 }, { x: 50, y: 4.5 }, { x: 77, y: 4.4 }, { x: 106, y: 4.5 }, { x: 141, y: 4.4 }];
export const bitPositions = platforms.flatMap((p, index) => {
  if (p.y === 0) return Array.from({ length: Math.floor((p.w - 4) / 3) }, (_, i) => ({ x: p.x + 3 + i * 3, y: p.y + 1.2 }));
  return [{ x: p.x + 1, y: p.y + 1.25 }, { x: p.x + p.w - 1, y: p.y + 1.25 }];
});
const initialEnemies = () => [{ x: 28, lo: 25, hi: 32 }, { x: 55, lo: 48, hi: 57 }, { x: 80, lo: 74, hi: 81 }, { x: 99, lo: 91, hi: 111 }, { x: 128, lo: 122, hi: 132 }, { x: 148, lo: 145, hi: 154 }].map(e => ({ ...e, y: 0, direction: -1, alive: true }));
export function newGame() {
  return { x: 3, y: 0, vx: 0, vy: 0, facing: 1, grounded: true, coyote: .1, jumpBuffer: 0, health: 3, invulnerable: 0, cores: [], bits: [], enemies: initialEnemies(), checkpoint: 0, rex: { active: false, x: ENCOUNTER.rexX, encounter: null, chaseTime: 0 }, time: 0, grace: 0, won: false };
}
export function createSession() { return { state: newGame(), history: [], charge: 3, rewinding: false, mode: 'playing', events: [] }; }
const snapshot = s => structuredClone(s);
export function checkpointRespawn(session) {
  const old = session.state;
  const fresh = newGame();
  Object.assign(fresh, { x: [3, 56, 111][old.checkpoint], cores: [...old.cores], bits: [...old.bits], checkpoint: old.checkpoint, time: old.time, invulnerable: 2 });
  session.state = fresh; session.history = []; session.charge = 3; session.mode = 'playing'; session.rewinding = false;
}
function hurt(session, reason) {
  const s = session.state;
  if (s.invulnerable > 0 || s.grace > 0) return;
  s.health = Math.max(0, s.health - 1); s.invulnerable = 1.8;
  session.events.push(reason);
  if (reason === 'fall' || s.health === 0) s.grace = 1.25;
  else { s.vy = 7; s.vx = -s.facing * 4; }
}
export function tick(session, input = {}) {
  session.events = [];
  if (session.mode !== 'playing') return;
  if (input.rewind && session.history.length && session.charge >= STEP) {
    session.state = session.history.pop(); session.charge = Math.max(0, session.charge - STEP); session.rewinding = true;
    return;
  }
  session.rewinding = false;
  const s = session.state;
  session.history.push(snapshot(s));
  if (session.history.length > 180) session.history.shift();
  session.charge = Math.min(3, session.charge + STEP * .32);
  s.time += STEP;
  if (s.rex.encounter) { advanceEncounter(session); return; }
  if (s.grace > 0) {
    s.grace -= STEP;
    if (s.grace <= 0) {
      if (s.health === 0) session.mode = 'over';
      else {
        const health = s.health;
        checkpointRespawn(session); session.state.health = health;
        session.events.push('respawn');
      }
    }
    return;
  }
  s.invulnerable = Math.max(0, s.invulnerable - STEP);
  s.coyote = s.grounded ? .1 : Math.max(0, s.coyote - STEP);
  s.jumpBuffer = input.jumpPressed ? .12 : Math.max(0, s.jumpBuffer - STEP);
  const axis = Math.max(-1, Math.min(1, input.axis || 0));
  const target = axis * 8.2;
  s.vx += Math.max(-.9, Math.min(.9, target - s.vx));
  if (axis) s.facing = Math.sign(axis);
  if (s.jumpBuffer > 0 && s.coyote > 0) {
    s.vy = 13; s.grounded = false; s.coyote = 0; s.jumpBuffer = 0; session.events.push('jump');
  }
  const previousY = s.y;
  s.x = Math.max(-2, Math.min(LEVEL_END + 2, s.x + s.vx * STEP));
  s.vy -= 26 * STEP;
  s.y += s.vy * STEP;
  s.grounded = false;
  // One-way platforms: allow upward passage and resolve only downward crossings.
  for (const p of [...platforms].sort((a, b) => b.y - a.y)) {
    if (s.vy <= 0 && previousY >= p.y - .02 && s.y <= p.y && s.x + .42 > p.x && s.x - .42 < p.x + p.w) {
      s.y = p.y; s.vy = 0; s.grounded = true; break;
    }
  }
  // Let Jerry land beyond the last platform before staging the face-to-face encounter.
  if (s.cores.length === 5 && !s.rex.active && s.x >= ENCOUNTER.trigger && s.grounded && s.y === 0) {
    s.rex.encounter = { elapsed: 0, startX: s.x }; s.vx = 0; s.vy = 0; s.facing = 1;
    // The rex clears its own arena; this enemy remains restored by rewind.
    s.enemies[5].alive = false; session.events.push('encounter'); return;
  }
  s.enemies.forEach(e => {
    if (!e.alive) return;
    e.x += e.direction * 2.3 * STEP;
    if (e.x < e.lo || e.x > e.hi) { e.x = Math.max(e.lo, Math.min(e.hi, e.x)); e.direction *= -1; }
    if (Math.abs(s.x - e.x) < 1.05 && s.y < 1.4 && s.y > -.8) {
      if (s.vy < -1 && previousY > 1.05) { e.alive = false; s.vy = 10; session.events.push('stomp'); }
      else hurt(session, 'hit');
    }
  });
  bitPositions.forEach((b, i) => {
    if (!s.bits.includes(i) && Math.abs(s.x - b.x) < .95 && Math.abs(s.y + 1.1 - b.y) < 1.5) { s.bits.push(i); session.events.push('bit'); }
  });
  corePositions.forEach((c, i) => {
    if (!s.cores.includes(i) && Math.abs(s.x - c.x) < 1.2 && Math.abs(s.y + 1.15 - c.y) < 1.45) { s.cores.push(i); session.events.push('core'); }
  });
  if (s.x > 53 && s.checkpoint < 1 && s.cores.includes(0) && s.cores.includes(1)) { s.checkpoint = 1; s.health = 3; session.events.push('checkpoint'); }
  if (s.x > 109 && s.checkpoint < 2 && s.cores.length >= 4) { s.checkpoint = 2; s.health = 3; session.events.push('checkpoint'); }
  if (s.rex.active) {
    s.rex.chaseTime += STEP;
    const pace = s.x - s.rex.x > 17 ? 9.1 : 7.1;
    s.rex.x += (4 + (pace - 4) * Math.min(1, s.rex.chaseTime / 3)) * STEP;
    if (s.x - s.rex.x < 2.5) hurt(session, 'hit');
  }
  if (s.y < -3.8) { s.invulnerable = 0; hurt(session, 'fall'); }
  if (s.x >= LEVEL_END && s.cores.length === 5 && s.grace <= 0 && s.health > 0) { s.won = true; session.mode = 'won'; session.events.push('win'); }
}
