import * as THREE from 'three';

// Movement and aim are independent screen-space inputs. The fixed camera maps
// them into the world; releasing an aim source never replaces it with movement.
export function createInput(canvas) {
  const held = new Set();
  const input = {
    move: new THREE.Vector2(),
    worldMove: new THREE.Vector2(),
    pointer: new THREE.Vector2(),
    aim: new THREE.Vector2(1, 0),
    aimMode: 'direction',
    aimActive: false,
    jumpQueued: false,
    firing: false,
    tierQueued: 0,
    cycleQueued: 0,
    stick: { move: new THREE.Vector2(), aim: new THREE.Vector2(), firing: false },
  };
  const CODES = {
    KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
    KeyI: 'aimUp', KeyK: 'aimDown', KeyJ: 'aimLeft', KeyL: 'aimRight',
  };
  let mouseFiring = false;

  addEventListener('keydown', event => {
    if (event.code === 'Space') {
      event.preventDefault();
      if (!event.repeat) input.jumpQueued = true;
      return;
    }
    if (event.code.startsWith('Digit')) {
      const tier = Number(event.code.slice(5));
      if (tier >= 1 && tier <= 7) {
        event.preventDefault();
        input.tierQueued = tier;
      }
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

  function point(event) {
    input.aimMode = 'pointer';
    const bounds = canvas.getBoundingClientRect();
    input.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
  }
  canvas.addEventListener('pointermove', event => {
    if (event.pointerType === 'mouse') point(event);
  });
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse' && event.button === 0) {
      point(event);
      mouseFiring = true;
    }
  });
  for (const type of ['pointerup', 'pointercancel']) addEventListener(type, event => {
    if (!event.pointerType || event.pointerType === 'mouse') mouseFiring = false;
  });
  canvas.addEventListener('wheel', event => {
    event.preventDefault();
    input.cycleQueued += Math.sign(event.deltaY);
  }, { passive: false });

  const keyAim = new THREE.Vector2();
  input.sample = () => {
    input.move.set(
      (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
      (held.has('up') ? 1 : 0) - (held.has('down') ? 1 : 0),
    );
    if (input.stick.move.lengthSq() > 0) input.move.copy(input.stick.move);
    if (input.move.lengthSq() > 1) input.move.normalize();
    keyAim.set(
      (held.has('aimRight') ? 1 : 0) - (held.has('aimLeft') ? 1 : 0),
      (held.has('aimUp') ? 1 : 0) - (held.has('aimDown') ? 1 : 0),
    );
    const touchAiming = input.stick.aim.lengthSq() > 0;
    const keyAiming = keyAim.lengthSq() > 0;
    input.aimActive = touchAiming || keyAiming;
    if (input.aimActive) {
      input.aimMode = 'direction';
      input.aim.copy(touchAiming ? input.stick.aim : keyAim).normalize();
    }
    input.firing = mouseFiring || (touchAiming && input.stick.firing) || keyAiming;
    return input;
  };

  // Clear both held and queued actions on pause/focus loss; keep the aim itself.
  input.reset = () => {
    held.clear();
    mouseFiring = false;
    input.move.set(0, 0);
    input.worldMove.set(0, 0);
    input.stick.move.set(0, 0);
    input.stick.aim.set(0, 0);
    input.stick.firing = false;
    input.firing = input.aimActive = input.jumpQueued = false;
    input.tierQueued = input.cycleQueued = 0;
  };
  addEventListener('blur', input.reset);

  input.takeJump = () => {
    const queued = input.jumpQueued;
    input.jumpQueued = false;
    return queued;
  };
  input.takeTier = () => {
    const queued = input.tierQueued;
    input.tierQueued = 0;
    return queued;
  };
  input.takeCycle = () => {
    const queued = input.cycleQueued;
    input.cycleQueued = 0;
    return queued;
  };
  return input;
}
