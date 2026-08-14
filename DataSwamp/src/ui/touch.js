/* --------------------------------------------------------------------------
   Touch controls: twin sticks and a jump pad.

   The sticks float — each one is drawn wherever the thumb lands rather than
   pinned to a fixed spot. Fixed sticks only work if you know the screen size
   and how the player is holding the device, and we know neither; a floating
   origin means the control is always exactly under the thumb that reached for
   it.

   Left half moves, right half aims and fires while held. Firing is bound to the
   aim stick rather than a separate button because on a two-thumb layout there
   is no third thumb to press it with, and because it makes "point at it" and
   "throw at it" the same gesture.

   The layer shows itself when the primary input is coarse, or the moment a real
   touch arrives, and hides again as soon as a mouse is used. That way one build
   serves a phone, a desktop and a hybrid laptop without asking anyone which
   they are.
   -------------------------------------------------------------------------- */

const RADIUS = 58;      // px from the stick origin that counts as full deflection
const DEAD = 6;         // px of slop before a drag registers at all

export function createTouch(input, root) {
  const sticks = {
    move: { el: root.querySelector('#stick-move'), pointer: null, target: input.stick.move },
    aim: { el: root.querySelector('#stick-aim'), pointer: null, target: input.stick.aim },
  };
  const jumpPad = root.querySelector('#tap-jump');

  let shown = false;

  function show(on) {
    if (shown === on) return;
    shown = on;
    root.classList.toggle('on', on);
    document.body.classList.toggle('touching', on);
    if (!on) release(sticks.move), release(sticks.aim);
  }

  function place(stick, x, y) {
    stick.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  function knob(stick, dx, dy) {
    stick.el.querySelector('.knob').style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function release(stick) {
    stick.pointer = null;
    stick.target.set(0, 0);
    stick.el.classList.remove('live');
    knob(stick, 0, 0);
    if (stick === sticks.aim) input.stick.firing = false;
  }

  function grab(stick, event) {
    stick.pointer = event.pointerId;
    stick.origin = { x: event.clientX, y: event.clientY };
    stick.el.classList.add('live');
    place(stick, event.clientX, event.clientY);
    knob(stick, 0, 0);
  }

  function drag(stick, event) {
    let dx = event.clientX - stick.origin.x;
    let dy = event.clientY - stick.origin.y;
    const distance = Math.hypot(dx, dy);

    if (distance < DEAD) {
      stick.target.set(0, 0);
      knob(stick, 0, 0);
      // An aim thumb resting still is still aiming, so it keeps firing.
      if (stick === sticks.aim) input.stick.firing = true;
      return;
    }

    // Clamp the knob to the ring, but let the reported vector saturate at 1 so
    // dragging further than the ring does not keep accelerating.
    const clamped = Math.min(distance, RADIUS);
    const nx = dx / distance;
    const ny = dy / distance;
    knob(stick, nx * clamped, ny * clamped);

    // Screen y grows downward and the game's forward axis grows upward.
    stick.target.set(nx * (clamped / RADIUS), -ny * (clamped / RADIUS));
    if (stick === sticks.aim) input.stick.firing = true;
  }

  // The sticks listen on the window rather than on the overlay. The overlay is
  // purely visual and stays pointer-transparent, because an overlay that only
  // becomes interactive once touch mode is on can never see the first touch
  // that was supposed to turn touch mode on.
  //
  // Bubble phase, not capture, so anything that wants a tap for itself — the
  // tier chips, the jump pad — can stopPropagation and be left alone.
  addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') {
      show(false);
      return;
    }
    show(true);

    const stick = event.clientX < innerWidth / 2 ? sticks.move : sticks.aim;
    if (stick.pointer !== null) return;   // that thumb is already busy
    grab(stick, event);
  });

  addEventListener('pointermove', event => {
    for (const stick of Object.values(sticks)) {
      if (stick.pointer === event.pointerId) drag(stick, event);
    }
  });

  for (const type of ['pointerup', 'pointercancel']) {
    addEventListener(type, event => {
      for (const stick of Object.values(sticks)) {
        if (stick.pointer === event.pointerId) release(stick);
      }
    });
  }

  jumpPad.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    show(true);
    input.jumpQueued = true;
  });

  show(matchMedia('(pointer: coarse)').matches);

  return { show };
}
