/* --------------------------------------------------------------------------
   The wave director.

   Replaces M2's fixed encounter, which threw six enemies of three species at
   Jerry the instant the page loaded and gave nobody time to work out which
   thumb did what. The ladder now starts with three Compsognathus and nothing
   else, and every wave opens with a breather long enough to read the banner and
   find the controls.

   Composition follows PLAN.md section 4.5. Numbers are deliberately gentle at
   the bottom: the first three waves are a tutorial that does not admit to being
   one.
   -------------------------------------------------------------------------- */

const WAVES = [
  { compy: 3 },
  { compy: 5 },
  { compy: 4, dilo: 2 },
  { compy: 4, dilo: 2, stego: 1 },
  { compy: 5, dilo: 3, ptero: 1 },
  { compy: 4, dilo: 3, stego: 2, ptero: 2 },
  { compy: 5, dilo: 3, trike: 1 },
  { compy: 3, dilo: 4, stego: 2, ptero: 2, anky: 1 },
  { compy: 6, dilo: 3, trike: 2, anky: 2 },
  { rex: 1, compy: 4 },
];

// What each wave is called on the banner. The joke only works if you can read
// what is about to be thrown at you.
const BILLING = {
  compy: '.TXT', dilo: '.CSV', stego: '.XLS',
  ptero: '.PDF', trike: '.ZIP', anky: '.ISO', rex: '.SQL',
};

// Long enough to get oriented before the first one, shorter once you know how.
const FIRST_BREATHER = 5;
const BREATHER = 3.5;

export function createWaves(enemies, arena) {
  const state = {
    index: 0,          // 0 before the first wave has started
    phase: 'breather',
    timer: FIRST_BREATHER,
    banner: '',
    cleared: false,
  };

  function billing(composition) {
    // Newest species first — that is the one you need to know about.
    const names = Object.keys(composition).reverse().map(id => BILLING[id]);
    return names.join(' · ');
  }

  function spawn(composition) {
    const entries = [];
    for (const [species, count] of Object.entries(composition)) {
      for (let i = 0; i < count; i++) entries.push(species);
    }

    // Spread around the rim at an even angle with jitter, so a wave arrives from
    // every side rather than as one clump you can simply back away from.
    const step = (Math.PI * 2) / entries.length;
    entries.forEach((species, i) => {
      const angle = i * step + (Math.random() - .5) * step * .6;
      const distance = arena.radius - 2 - Math.random() * 3;
      enemies.spawn(species, Math.cos(angle) * distance, Math.sin(angle) * distance);
    });
  }

  function start(index) {
    state.index = index + 1;
    state.phase = 'fighting';
    state.banner = '';
    spawn(WAVES[index]);
  }

  return {
    state,
    total: WAVES.length,

    reset() {
      state.index = 0;
      state.phase = 'breather';
      state.timer = FIRST_BREATHER;
      state.banner = `Wave 1 — ${billing(WAVES[0])}`;
      state.cleared = false;
      enemies.prewarm(Object.keys(WAVES[0]));
    },

    update(dt) {
      if (state.cleared) return;

      if (state.phase === 'breather') {
        state.timer -= dt;
        if (state.timer <= 0) start(state.index);
        return;
      }

      // A wave ends when the last of it has finished dying, not when the last
      // hit lands — otherwise the banner for the next one covers the collapse.
      if (enemies.list.length > 0) return;

      if (state.index >= WAVES.length) {
        state.cleared = true;
        state.banner = 'Swamp cleared';
        return;
      }

      state.phase = 'breather';
      state.timer = BREATHER;
      state.banner = `Wave ${state.index + 1} — ${billing(WAVES[state.index])}`;
      // Pay for the next wave's geometry now, while nothing is happening.
      enemies.prewarm(Object.keys(WAVES[state.index]));
    },
  };
}
