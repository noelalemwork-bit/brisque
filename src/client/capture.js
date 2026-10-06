// Capture mode (?capture): a virtual clock for frame-perfect video recording.
//
// Replaces performance.now / Date.now / setTimeout / setInterval / requestAnimationFrame with a clock
// that only moves when the recorder calls window.__capture.step(ms). Each step advances time, fires due
// timers, runs one animation frame and advances CSS / Web Animations by the same amount, so a recording
// is perfectly smooth at any frame rate however slowly each frame renders. Must be imported first.

if (new URLSearchParams(location.search).has('capture')) {
  const vt = { now: 0, id: 1, timers: [], raf: [] };
  const dateBase = Date.now();
  performance.now = () => vt.now;
  Date.now = () => dateBase + vt.now;
  window.setTimeout = (fn, ms = 0, ...args) => { const id = vt.id++; vt.timers.push({ id, at: vt.now + Math.max(0, ms), fn: () => fn(...args) }); return id; };
  window.clearTimeout = (id) => { vt.timers = vt.timers.filter((t) => t.id !== id); };
  window.setInterval = (fn, ms = 0, ...args) => {
    const id = vt.id++;
    const tick = () => { fn(...args); vt.timers.push({ id, at: vt.now + Math.max(1, ms), fn: tick }); };
    vt.timers.push({ id, at: vt.now + Math.max(1, ms), fn: tick });
    return id;
  };
  window.clearInterval = window.clearTimeout;
  window.requestAnimationFrame = (fn) => { const id = vt.id++; vt.raf.push({ id, fn }); return id; };
  window.cancelAnimationFrame = (id) => { vt.raf = vt.raf.filter((r) => r.id !== id); };

  window.__capture = {
    get now() { return vt.now; },
    // advance the world by `ms` and render one frame
    async step(ms) {
      const end = vt.now + ms;
      for (;;) {
        vt.timers.sort((a, b) => a.at - b.at);
        const next = vt.timers[0];
        if (!next || next.at > end) break;
        vt.timers.shift();
        vt.now = next.at;
        next.fn();
        await Promise.resolve(); // let promise chains react to each timer
      }
      vt.now = end;
      for (let i = 0; i < 4; i++) await Promise.resolve();
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = (a.currentTime ?? 0) + ms; }
      const frames = vt.raf;
      vt.raf = [];
      for (const r of frames) r.fn(vt.now);
    },
  };
}
