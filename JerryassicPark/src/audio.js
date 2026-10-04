export function createAudio() {
  let context, enabled = true;
  function unlock() { context ??= new (window.AudioContext || window.webkitAudioContext)(); context.resume().catch(() => {}); }
  function tone(frequency, duration = .1, type = 'sine', delay = 0, volume = .035) {
    if (!context || !enabled) return;
    const now = context.currentTime + delay;
    const oscillator = context.createOscillator(), gain = context.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * .65, now + duration);
    gain.gain.setValueAtTime(.001, now); gain.gain.linearRampToValueAtTime(volume, now + .008); gain.gain.exponentialRampToValueAtTime(.001, now + duration);
    oscillator.connect(gain); gain.connect(context.destination); oscillator.start(now); oscillator.stop(now + duration + .01);
  }
  return {
    unlock,
    toggle() { enabled = !enabled; return enabled; },
    play(event) {
      if (event === 'jump') tone(440, .16, 'triangle');
      if (event === 'bit') tone(1100, .09);
      if (event === 'core' || event === 'checkpoint' || event === 'win') [440, 554, 660, 880].forEach((f, i) => tone(f, .24, 'sine', i * .085));
      if (event === 'hit' || event === 'fall') tone(100, .35, 'sawtooth', 0, .03);
      if (event === 'stomp') { tone(130, .12, 'triangle'); tone(520, .15, 'sine', .06); }
      if (event === 'roar') { tone(58, 1.05, 'sawtooth', 0, .06); tone(83, .8, 'triangle', .12, .055); }
      if (event === 'duck') tone(220, .25, 'triangle', 0, .02);
      if (event === 'chase') [0, .3, .6].forEach(d => tone(95, .3, 'sawtooth', d, .045));
      if (event === 'rewind') tone(700, .18, 'triangle', 0, .018);
    },
  };
}
