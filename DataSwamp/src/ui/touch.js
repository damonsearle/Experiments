/* --------------------------------------------------------------------------
   Touch controls: one stick and two pads.

   The stick is always drawn once touch mode is on, parked in the bottom-left
   corner with a label under it. An invisible control is not a control — the
   first version only drew a stick once a thumb had already found it, which
   meant you had to already know it was there.

   It still floats: on touch-down the base jumps to wherever the thumb actually
   landed and slides home again on release. So the home position advertises
   where the stick is rather than being a target you have to hit.

   Jerry aims where he runs, and the right hand is two buttons — throw and jump.
   There was a second stick here that aimed, and it had a nasty feedback loop:
   holding it turned Jerry, the camera followed him round, and so the same thumb
   position kept on turning him. Dragging a little too far span you on the spot.
   Steering with the left stick alone has none of that, and costs only the
   ability to shoot behind yourself.
   -------------------------------------------------------------------------- */

const RADIUS = 56;      // px from the stick origin that counts as full deflection
const DEAD = 5;         // px of slop before a drag registers at all

export function createTouch(input, root) {
  const sticks = {
    move: { el: root.querySelector('#stick-move'), pointer: null, target: input.stick.move },
  };
  const jumpPad = root.querySelector('#tap-jump');
  const firePad = root.querySelector('#tap-fire');

  for (const stick of Object.values(sticks)) {
    stick.knob = stick.el.querySelector('.knob');
    stick.origin = null;
  }

  let shown = false;
  let firing = null;      // pointerId currently holding the throw pad

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
      input.stick.firing = false;
      firing = null;
    }
  }

  function release(stick) {
    stick.pointer = null;
    stick.origin = null;
    stick.target.set(0, 0);
    stick.el.classList.remove('live');
    home(stick);
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

    // Only the left half drives the stick now; the right half is buttons, and
    // they claim their own taps below.
    if (event.clientX >= innerWidth / 2) return;
    if (sticks.move.pointer !== null) return;   // that thumb is already busy
    grab(sticks.move, event);
  });

  addEventListener('pointermove', event => {
    if (sticks.move.pointer === event.pointerId) drag(sticks.move, event);
  });

  for (const type of ['pointerup', 'pointercancel']) {
    addEventListener(type, event => {
      if (sticks.move.pointer === event.pointerId) release(sticks.move);
      // Released anywhere, not just over the pad — sliding off the button while
      // holding it should still count as letting go.
      if (firing === event.pointerId) {
        firing = null;
        input.stick.firing = false;
        firePad.classList.remove('held');
      }
    });
  }

  jumpPad.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    show(true);
    input.jumpQueued = true;
  });

  firePad.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    show(true);
    firing = event.pointerId;
    input.stick.firing = true;
    firePad.classList.add('held');
  });

  show(matchMedia('(pointer: coarse)').matches);

  return { show };
}
