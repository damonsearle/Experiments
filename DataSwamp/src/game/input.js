import * as THREE from 'three';

// Keyboard state plus a normalised pointer, kept as plain state the game loop samples.
// Nothing here knows about the world — main.js turns the pointer into an aim point.
export function createInput(canvas) {
  const held = new Set();
  const input = {
    move: new THREE.Vector2(),   // -1..1 on x (right) and y (forward)
    pointer: new THREE.Vector2(), // normalised device coords
    jumpQueued: false,
    firing: false,
  };

  const CODES = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
  };

  addEventListener('keydown', event => {
    if (event.code === 'Space') {
      event.preventDefault();
      // Queued rather than held, so a jump is consumed once and never auto-repeats.
      input.jumpQueued = true;
      return;
    }
    const action = CODES[event.code];
    if (!action) return;
    event.preventDefault();
    held.add(action);
  });

  addEventListener('keyup', event => {
    const action = CODES[event.code];
    if (action) held.delete(action);
  });

  // Losing focus mid-key would otherwise leave Jerry walking into the swamp forever.
  addEventListener('blur', () => {
    held.clear();
    input.firing = false;
  });

  canvas.addEventListener('pointermove', event => {
    const bounds = canvas.getBoundingClientRect();
    input.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
  });

  canvas.addEventListener('pointerdown', () => { input.firing = true; });
  addEventListener('pointerup', () => { input.firing = false; });

  input.sample = () => {
    input.move.set(
      (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
      (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0),
    );
    if (input.move.lengthSq() > 1) input.move.normalize();
    return input;
  };

  input.takeJump = () => {
    const queued = input.jumpQueued;
    input.jumpQueued = false;
    return queued;
  };

  return input;
}
