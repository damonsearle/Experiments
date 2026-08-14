import * as THREE from 'three';

/* --------------------------------------------------------------------------
   Keyboard, mouse and stick state, kept as plain fields the game loop samples.
   Nothing here knows about the world — main.js turns whatever this reports into
   an aim point.

   Aim arrives in one of two shapes and the rest of the game must not care
   which. A mouse gives a *point* on screen to resolve against the ground; a
   thumbstick or IJKL gives a *direction* and no point at all. Rather than teach
   the player and the reticle about both, `aimMode` says which one is live and
   main.js resolves them to the same aim point.

   The mode follows whatever was touched last, so a hybrid laptop that has both
   a screen and a mouse does the right thing without being asked.
   -------------------------------------------------------------------------- */

export function createInput(canvas) {
  const held = new Set();
  const input = {
    move: new THREE.Vector2(),      // -1..1 on x (right) and y (forward), as the player pushed it
    // The same intent resolved against the camera, as world x/z. main.js owns the
    // camera so it fills this in; player.js reads only this and never has to know
    // which way round the view is.
    worldMove: new THREE.Vector2(),
    pointer: new THREE.Vector2(),   // normalised device coords, mouse only
    // Unit direction in the same screen axes as move. Defaults to straight up the
    // screen, which once the camera is following means "away from the camera" —
    // the natural resting facing for a third-person view.
    aim: new THREE.Vector2(0, 1),
    aimMode: 'pointer',
    jumpQueued: false,
    firing: false,
    tierQueued: 0,                  // 1-based tier the player asked for, 0 for none
    cycleQueued: 0,                 // accumulated scroll steps
    // Written by the touch layer, read here. Kept separate so a stick and a
    // keyboard held at once resolve predictably instead of fighting. There is
    // no aim stick: touch steers with `move` alone and throws with a button.
    stick: {
      move: new THREE.Vector2(),
      firing: false,
    },
  };

  const CODES = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right',
    KeyI: 'aimUp', KeyK: 'aimDown', KeyJ: 'aimLeft', KeyL: 'aimRight',
  };

  let mouseFiring = false;

  addEventListener('keydown', event => {
    if (event.code === 'Space') {
      event.preventDefault();
      // Queued rather than held, so a jump is consumed once and never auto-repeats.
      input.jumpQueued = true;
      return;
    }
    // Digit1..Digit4 rather than event.key, so the tier keys survive a layout
    // where the unshifted top row is not digits.
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

  // Losing focus mid-key would otherwise leave Jerry walking into the swamp forever.
  addEventListener('blur', () => {
    held.clear();
    mouseFiring = false;
    input.firing = false;
  });

  canvas.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    input.aimMode = 'pointer';
    const bounds = canvas.getBoundingClientRect();
    input.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    );
  });

  // Only a mouse press fires from the canvas. On a touchscreen every stick drag
  // starts as a canvas press, and treating those as trigger pulls would mean
  // Jerry fires continuously the whole time he is walking.
  canvas.addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') mouseFiring = true;
  });
  addEventListener('pointerup', event => {
    if (!event.pointerType || event.pointerType === 'mouse') mouseFiring = false;
  });

  // One step per gesture regardless of how much delta the device reports — a
  // trackpad flick otherwise cycles the whole arsenal several times over.
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
    // A stick overrides the keys rather than summing with them, so a stray held
    // key cannot drag Jerry off the direction a thumb is pointing.
    if (input.stick.move.lengthSq() > 0) input.move.copy(input.stick.move);
    if (input.move.lengthSq() > 1) input.move.normalize();

    keyAim.set(
      (held.has('aimRight') ? 1 : 0) - (held.has('aimLeft') ? 1 : 0),
      (held.has('aimUp') ? 1 : 0) - (held.has('aimDown') ? 1 : 0),
    );

    // IJKL still aims explicitly, because a keyboard has thumbs to spare. Touch
    // does not: there, running *is* aiming, and when both fall silent the last
    // direction is held rather than snapping back — stopping should stop Jerry
    // turning, not spin him to face east.
    if (keyAim.lengthSq() > 0) {
      input.aimMode = 'direction';
      input.aim.copy(keyAim).normalize();
    } else if (input.aimMode === 'direction' && input.move.lengthSq() > 0) {
      input.aim.copy(input.move).normalize();
    }

    input.firing = mouseFiring || input.stick.firing;
    return input;
  };

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
