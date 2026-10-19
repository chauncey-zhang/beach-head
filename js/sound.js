/* 音效：WebAudio 实时合成，无需素材文件，兼容 Chrome 69 */
window.BH = window.BH || {};

BH.Sound = (function () {
  var ctx = null;
  var enabled = true;

  function ensure() {
    if (!enabled) return;
    try {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    } catch (e) {
      enabled = false;
    }
  }

  function beep(freq, dur, type, vol) {
    if (!enabled) return;
    ensure();
    if (!ctx) return;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.value = freq;
    g.gain.value = vol || 0.06;
    o.connect(g); g.connect(ctx.destination);
    var t = ctx.currentTime;
    o.start(t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.stop(t + dur + 0.02);
  }

  function noise(dur, vol) {
    if (!enabled) return;
    ensure();
    if (!ctx) return;
    var n = Math.floor(ctx.sampleRate * dur);
    var buf = ctx.createBuffer(1, n, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    var s = ctx.createBufferSource();
    s.buffer = buf;
    var g = ctx.createGain();
    g.gain.value = vol || 0.15;
    s.connect(g); g.connect(ctx.destination);
    s.start();
  }

  return {
    init: ensure,
    resume: ensure,
    shoot: function () { beep(240, 0.09, 'square', 0.05); },
    mg: function () { beep(150, 0.04, 'square', 0.035); },
    explosion: function () { noise(0.35, 0.18); },
    click: function () { beep(680, 0.05, 'sine', 0.05); },
    hit: function () { beep(420, 0.03, 'triangle', 0.04); },
    win: function () {
      beep(523, 0.15, 'sine', 0.08);
      setTimeout(function () { beep(659, 0.15, 'sine', 0.08); }, 150);
      setTimeout(function () { beep(784, 0.25, 'sine', 0.08); }, 300);
    },
    lose: function () {
      beep(200, 0.4, 'sawtooth', 0.08);
      setTimeout(function () { beep(140, 0.5, 'sawtooth', 0.08); }, 200);
    }
  };
})();
