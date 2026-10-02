// Left thumb moves; right-side swipes look. Hold Throw and drag it to aim while firing.
const DEAD = 8;
export function createTouch(input, root, { surface, enabled = () => true }) {
  const move = root.querySelector('#stick-move');
  const knob = move.querySelector('.knob');
  const look = root.querySelector('#stick-aim');
  const jump = root.querySelector('#tap-jump');
  const fire = root.querySelector('#tap-fire');
  const pointers = new Map();
  let shown = false;
  function show(on) {
    if (shown === on) return;
    shown = on;
    root.classList.toggle('on', on);
    document.body.classList.toggle('touching', on);
    if (!on) reset();
  }
  function release(id) {
    const pointer = pointers.get(id);
    if (!pointer) return;
    pointers.delete(id);
    if (pointer.role === 'move') {
      input.stick.move.set(0, 0);
      move.classList.remove('live');
      move.style.transform = knob.style.transform = '';
    }
    if (pointer.role === 'fire') { input.stick.firing = false; fire.classList.remove('held'); }
    if (pointer.role === 'look') look.classList.remove('live');
    if (pointer.role === 'jump') jump.classList.remove('held');
    if (pointer.owner.hasPointerCapture(id)) pointer.owner.releasePointerCapture(id);
  }
  function reset() { for (const id of [...pointers.keys()]) release(id); }
  function grab(event, role, owner) {
    event.preventDefault();
    event.stopPropagation();
    show(true);
    if (!enabled() || [...pointers.values()].some(p => p.role === role)) return;
    const pointer = { role, owner, x: event.clientX, y: event.clientY, lastX: event.clientX, lastY: event.clientY };
    pointers.set(event.pointerId, pointer);
    owner.setPointerCapture(event.pointerId);
    if (role === 'move') {
      move.style.transform = '';
      const box = move.getBoundingClientRect();
      pointer.radius = box.width / 2;
      move.style.transform = `translate(${pointer.x - box.left - box.width / 2}px, ${pointer.y - box.top - box.height / 2}px)`;
      move.classList.add('live');
    } else if (role === 'look') look.classList.add('live');
    else if (role === 'fire') { input.stick.firing = true; fire.classList.add('held'); }
    else { input.jumpQueued = true; jump.classList.add('held'); }
  }
  addEventListener('pointerdown', event => {
    if (event.pointerType === 'mouse') { show(false); return; }
    if (event.target !== surface) return;
    grab(event, event.clientX < innerWidth / 2 ? 'move' : 'look', surface);
  });
  fire.addEventListener('pointerdown', event => grab(event, 'fire', fire));
  jump.addEventListener('pointerdown', event => grab(event, 'jump', jump));
  addEventListener('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    if (!enabled()) { reset(); return; }
    event.preventDefault();
    if (pointer.role === 'move') {
      const dx = event.clientX - pointer.x, dy = event.clientY - pointer.y;
      const length = Math.hypot(dx, dy) || 1;
      const reach = Math.min(length, pointer.radius);
      const strength = Math.max(0, (reach - DEAD) / (pointer.radius - DEAD));
      input.stick.move.set(dx / length * strength, -dy / length * strength);
      knob.style.transform = `translate(${dx / length * reach}px, ${dy / length * reach}px)`;
    } else if (pointer.role === 'look' || pointer.role === 'fire') {
      const sensitivity = 2.5 / Math.min(innerWidth, innerHeight);
      input.lookDelta.x += (event.clientX - pointer.lastX) * sensitivity;
      input.lookDelta.y -= (event.clientY - pointer.lastY) * sensitivity;
    }
    pointer.lastX = event.clientX; pointer.lastY = event.clientY;
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) addEventListener(type, event => release(event.pointerId));
  addEventListener('blur', reset);
  addEventListener('resize', reset);
  addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  show(matchMedia('(pointer: coarse)').matches);
  return { show, reset };
}
