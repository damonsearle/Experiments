// Floating twin sticks: left moves, right aims and fires outside its dead zone.
// Each pointer keeps its original role even if the thumb crosses the screen.
const DEAD = 8;

export function createTouch(input, root, { surface, enabled = () => true }) {
  const sticks = {
    move: { el: root.querySelector('#stick-move'), pointer: null, target: input.stick.move },
    aim: { el: root.querySelector('#stick-aim'), pointer: null, target: input.stick.aim },
  };
  const jumpPad = root.querySelector('#tap-jump');
  for (const stick of Object.values(sticks)) stick.knob = stick.el.querySelector('.knob');
  let shown = false;

  function release(stick) {
    const pointer = stick.pointer;
    stick.pointer = null;
    stick.origin = null;
    stick.target.set(0, 0);
    stick.el.classList.remove('live', 'firing');
    stick.el.style.transform = '';
    stick.knob.style.transform = '';
    if (stick === sticks.aim) input.stick.firing = false;
    if (pointer !== null && surface.hasPointerCapture(pointer)) surface.releasePointerCapture(pointer);
  }
  function reset() {
    for (const stick of Object.values(sticks)) release(stick);
    jumpPad.classList.remove('held');
  }
  function show(on) {
    if (shown === on) return;
    shown = on;
    root.classList.toggle('on', on);
    document.body.classList.toggle('touching', on);
    if (on) input.aimMode = 'direction';
    else reset();
  }
  function grab(stick, event) {
    // Clear the return animation before measuring the parked position.
    stick.el.style.transform = '';
    stick.el.classList.add('live');
    const box = stick.el.getBoundingClientRect();
    stick.radius = Math.max(DEAD + 1, box.width / 2);
    stick.pointer = event.pointerId;
    stick.origin = { x: event.clientX, y: event.clientY };
    stick.el.style.transform = `translate(${event.clientX - box.left - box.width / 2}px, ${event.clientY - box.top - box.height / 2}px)`;
    stick.knob.style.transform = '';
    surface.setPointerCapture(event.pointerId);
  }
  function drag(stick, event) {
    const dx = event.clientX - stick.origin.x;
    const dy = event.clientY - stick.origin.y;
    const distance = Math.hypot(dx, dy);
    const clamped = Math.min(distance, stick.radius);
    const strength = Math.max(0, (clamped - DEAD) / (stick.radius - DEAD));
    const nx = distance ? dx / distance : 0;
    const ny = distance ? dy / distance : 0;
    stick.knob.style.transform = `translate(${nx * clamped}px, ${ny * clamped}px)`;
    stick.target.set(nx * strength, -ny * strength);
    if (stick === sticks.aim) {
      input.stick.firing = strength > 0;
      stick.el.classList.toggle('firing', strength > 0);
    }
  }

  addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') { show(false); return; }
    if (event.target !== surface && !root.contains(event.target)) return;
    show(true);
    if (!enabled()) return;
    event.preventDefault();
    input.aimMode = 'direction';
    const stick = event.clientX < innerWidth / 2 ? sticks.move : sticks.aim;
    if (stick.pointer !== null) return;
    grab(stick, event);
  });
  addEventListener('pointermove', event => {
    for (const stick of Object.values(sticks)) {
      if (stick.pointer !== event.pointerId) continue;
      if (!enabled()) { reset(); return; }
      event.preventDefault();
      drag(stick, event);
    }
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) addEventListener(type, event => {
    for (const stick of Object.values(sticks)) if (stick.pointer === event.pointerId) release(stick);
    jumpPad.classList.remove('held');
  });
  jumpPad.addEventListener('pointerdown', event => {
    event.preventDefault();
    event.stopPropagation();
    show(true);
    if (!enabled()) return;
    input.jumpQueued = true;
    jumpPad.classList.add('held');
  });
  addEventListener('blur', reset);
  addEventListener('resize', reset);
  addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  show(matchMedia('(pointer: coarse)').matches);
  return { show, reset };
}
