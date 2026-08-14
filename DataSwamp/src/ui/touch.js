/* --------------------------------------------------------------------------
   Touch controls: twin sticks and a jump pad.

   The sticks are always drawn once touch mode is on, parked at a home position
   in each bottom corner with a label under them. An invisible control is not a
   control — the first version only drew a stick once a thumb had already found
   it, which meant you had to already know it was there.

   They still float, though: on touch-down the base jumps to wherever the thumb
   actually landed and slides home again on release. So the home position is an
   advertisement for where the stick is, not a target you have to hit.

   Left stick runs. Right stick turns and throws — holding it swings Jerry, and
   the camera follows him round, so "point at it" and "throw at it" stay one
   gesture and you can always see what you are pointing at.
   -------------------------------------------------------------------------- */

const RADIUS = 56;      // px from the stick origin that counts as full deflection
const DEAD = 5;         // px of slop before a drag registers at all

export function createTouch(input, root) {
  const sticks = {
    move: { el: root.querySelector('#stick-move'), pointer: null, target: input.stick.move },
    aim: { el: root.querySelector('#stick-aim'), pointer: null, target: input.stick.aim },
  };
  const jumpPad = root.querySelector('#tap-jump');

  for (const stick of Object.values(sticks)) {
    stick.knob = stick.el.querySelector('.knob');
    stick.origin = null;
  }

  let shown = false;

  function home(stick) {
    // Parked position comes from CSS so the layout stays in one place; clearing
    // the inline transform drops it back there.
    stick.el.style.transform = '';
    stick.knob.style.transform = '';
  }

  function show(on) {
    if (shown === on) return;
    shown = on;
    root.classList.toggle('on', on);
    document.body.classList.toggle('touching', on);
    // There is no mouse here, so pointer aiming would leave Jerry facing a
    // cursor that never moves and the camera pinned behind him forever. Commit
    // to direction aiming the moment the controls appear.
    if (on) input.aimMode = 'direction';
    if (!on) {
      release(sticks.move);
      release(sticks.aim);
    }
  }

  function release(stick) {
    stick.pointer = null;
    stick.origin = null;
    stick.target.set(0, 0);
    stick.el.classList.remove('live');
    home(stick);
    if (stick === sticks.aim) input.stick.firing = false;
  }

  function grab(stick, event) {
    stick.pointer = event.pointerId;
    stick.origin = { x: event.clientX, y: event.clientY };
    stick.el.classList.add('live');

    // Move the base to the thumb. Measured against where CSS parked it, so the
    // offset is a delta rather than an absolute position and the corner layout
    // stays entirely in the stylesheet.
    const box = stick.el.getBoundingClientRect();
    stick.parked = { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    stick.el.style.transform =
      `translate(${event.clientX - stick.parked.x}px, ${event.clientY - stick.parked.y}px)`;
    stick.knob.style.transform = '';
  }

  function drag(stick, event) {
    const dx = event.clientX - stick.origin.x;
    const dy = event.clientY - stick.origin.y;
    const distance = Math.hypot(dx, dy);

    if (distance < DEAD) {
      stick.target.set(0, 0);
      stick.knob.style.transform = '';
      // An aim thumb resting still is still aiming, so it keeps throwing.
      if (stick === sticks.aim) input.stick.firing = true;
      return;
    }

    // Clamp the knob to the ring, and let the reported vector saturate with it
    // so dragging past the ring does not keep accelerating.
    const clamped = Math.min(distance, RADIUS);
    const nx = dx / distance;
    const ny = dy / distance;
    stick.knob.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;

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
