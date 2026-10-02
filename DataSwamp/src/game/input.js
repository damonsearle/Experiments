import * as THREE from 'three';

export function createInput(canvas, { enabled = () => true, locked = () => document.pointerLockElement === canvas } = {}) {
  const held = new Set();
  const input = {
    move: new THREE.Vector2(), worldMove: new THREE.Vector2(),
    lookDelta: new THREE.Vector2(), lookRate: new THREE.Vector2(),
    jumpQueued: false, firing: false, tierQueued: 0, cycleQueued: 0,
    stick: { move: new THREE.Vector2(), aim: new THREE.Vector2(), firing: false },
  };
  const codes = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    KeyI: 'lookUp', KeyK: 'lookDown', KeyJ: 'lookLeft', KeyL: 'lookRight',
    KeyF: 'fire',
  };
  let mouseFiring = false;
  let dragging = false;
  input.lock = () => {
    if (!enabled() || locked() || !canvas.requestPointerLock) return;
    try { canvas.requestPointerLock()?.catch(() => {}); } catch { /* Drag-to-look remains available. */ }
  };
  addEventListener('keydown', event => {
    if (!enabled()) return;
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) input.jumpQueued = true;
    } else if (/^Digit[1-7]$/.test(event.code)) {
      input.tierQueued = Number(event.code.slice(5));
    } else if (codes[event.code]) {
      event.preventDefault();
      held.add(codes[event.code]);
    }
  });
  addEventListener('keyup', event => held.delete(codes[event.code]));
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || !enabled()) return;
    if (event.button === 0) {
      // Capturing the mouse never also throws a shot.
      if (locked()) mouseFiring = true;
      else input.lock();
    }
    if (event.button === 2) dragging = true;
  });
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  addEventListener('mousemove', event => {
    if (!enabled() || (!locked() && !dragging)) return;
    input.lookDelta.x += event.movementX * .0024;
    input.lookDelta.y -= event.movementY * .0024;
  });
  for (const type of ['pointerup', 'pointercancel']) addEventListener(type, event => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    if (event.button === 0 || type === 'pointercancel') mouseFiring = false;
    if (event.button === 2 || type === 'pointercancel') dragging = false;
  });
  canvas.addEventListener('wheel', event => {
    if (!enabled()) return;
    event.preventDefault();
    input.cycleQueued += Math.sign(event.deltaY);
  }, { passive: false });
  input.sample = () => {
    input.move.set(Number(held.has('right')) - Number(held.has('left')),
      Number(held.has('up')) - Number(held.has('down')));
    if (input.stick.move.lengthSq()) input.move.copy(input.stick.move);
    if (input.move.lengthSq() > 1) input.move.normalize();
    input.lookRate.set(Number(held.has('lookRight')) - Number(held.has('lookLeft')),
      Number(held.has('lookUp')) - Number(held.has('lookDown')));
    input.firing = mouseFiring || input.stick.firing || held.has('fire');
    return input;
  };
  input.reset = () => {
    held.clear();
    mouseFiring = dragging = input.firing = input.jumpQueued = false;
    input.move.set(0, 0); input.worldMove.set(0, 0);
    input.lookDelta.set(0, 0); input.lookRate.set(0, 0);
    input.stick.move.set(0, 0); input.stick.aim.set(0, 0);
    input.stick.firing = false;
    input.tierQueued = input.cycleQueued = 0;
  };
  addEventListener('blur', input.reset);
  for (const [name, key] of [['Jump', 'jumpQueued'], ['Tier', 'tierQueued'], ['Cycle', 'cycleQueued']]) {
    input[`take${name}`] = () => { const value = input[key]; input[key] = name === 'Jump' ? false : 0; return value; };
  }
  return input;
}
