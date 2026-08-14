/* --------------------------------------------------------------------------
   Procedural audio. Nothing is loaded, same rule as every other asset here —
   the whole soundtrack is a handful of oscillators and one noise buffer.

   Mobile browsers refuse to start an AudioContext without a user gesture, which
   is exactly what the opening panel is: `unlock()` is called when it is
   dismissed, so the first sound is never the one that gets swallowed.
   -------------------------------------------------------------------------- */

export function createAudio() {
  let context = null;
  let master = null;
  let noise = null;

  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (!Ctor) return;
    context = new Ctor();
    master = context.createGain();
    master.gain.value = .3;
    master.connect(context.destination);

    // One second of white noise, reused for every percussive sound.
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }

  function tone({ from, to = from, duration, type = 'sine', gain = .5, delay = 0 }) {
    if (!context) return;
    const at = context.currentTime + delay;
    const osc = context.createOscillator();
    const level = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, at);
    if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(to, 1), at + duration);
    level.gain.setValueAtTime(0, at);
    level.gain.linearRampToValueAtTime(gain, at + .012);
    level.gain.exponentialRampToValueAtTime(.0001, at + duration);
    osc.connect(level).connect(master);
    osc.start(at);
    osc.stop(at + duration + .02);
  }

  function hiss({ duration, gain = .4, frequency = 1400, sweep = 0, delay = 0 }) {
    if (!context) return;
    const at = context.currentTime + delay;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(frequency, at);
    if (sweep) filter.frequency.exponentialRampToValueAtTime(Math.max(sweep, 40), at + duration);
    const level = context.createGain();
    level.gain.setValueAtTime(gain, at);
    level.gain.exponentialRampToValueAtTime(.0001, at + duration);
    source.connect(filter).connect(level).connect(master);
    source.start(at);
    source.stop(at + duration + .02);
  }

  return {
    unlock,

    // A flat spinning thing leaving Jerry's hand.
    throw: () => hiss({ duration: .12, gain: .22, frequency: 2200, sweep: 700 }),

    // Something landing on a dinosaur.
    hit: () => {
      hiss({ duration: .09, gain: .3, frequency: 900, sweep: 220 });
      tone({ from: 180, to: 90, duration: .1, type: 'square', gain: .12 });
    },

    // Something falling over for good.
    kill: () => {
      tone({ from: 260, to: 70, duration: .5, type: 'sawtooth', gain: .18 });
      hiss({ duration: .35, gain: .18, frequency: 500, sweep: 90, delay: .04 });
    },

    // Jerry taking one. Deliberately the ugliest sound in the game.
    hurt: () => {
      tone({ from: 150, to: 55, duration: .34, type: 'square', gain: .26 });
      hiss({ duration: .2, gain: .22, frequency: 300, sweep: 80 });
    },

    // Restocking.
    pickup: () => {
      tone({ from: 620, duration: .1, type: 'triangle', gain: .18 });
      tone({ from: 930, duration: .16, type: 'triangle', gain: .16, delay: .07 });
    },

    // A wave arriving: two notes, low then lower, so it reads as a warning
    // rather than as a reward.
    wave: () => {
      tone({ from: 300, to: 300, duration: .28, type: 'triangle', gain: .18 });
      tone({ from: 200, to: 200, duration: .46, type: 'triangle', gain: .2, delay: .2 });
    },

    over: () => {
      tone({ from: 220, to: 40, duration: 1.3, type: 'sawtooth', gain: .22 });
    },
  };
}
