// Keepr site opening: a swarm of little coloured cursors builds the top of
// the page. They come in as a flock, spread out, and each one drags a
// selection box over a piece of the page; the piece is wiped into view under
// the box, then the cursors fly off. Once per visit; tap anywhere to skip.
// Skipped completely with "reduce motion".
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('swarming')) return;

  const selectors = [
    '.nav .brand',
    '.nav nav',
    '.hero-copy > .play-test',
    '.hero-copy > .eyebrow',
    '.headline .line:nth-child(1)',
    '.headline .line:nth-child(2)',
    '.hero-copy > .lede',
    '.cta .btn:nth-child(1)',
    '.cta .btn:nth-child(2)',
    '.hero-copy > .trust',
    '.fan .phone.main',
  ];
  const tags = { '.nav .brand': 'logo', '.headline .line:nth-child(1)': 'headline', '.cta .btn:nth-child(1)': 'button', '.fan .phone.main': 'app' };
  const pieces = selectors
    .map((s) => ({ sel: s, el: document.querySelector(s), tag: tags[s] || '' }))
    .filter((p) => p.el && p.el.getClientRects().length);

  const done = () => {
    root.classList.remove('swarming');
    pieces.forEach((p) => (p.el.style.clipPath = ''));
    canvas.remove();
    try { sessionStorage.setItem('keepr-swarm', '1'); } catch (_) {}
  };

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:100;pointer-events:none';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  let W = 0, H = 0;
  const size = () => {
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  window.addEventListener('resize', size);

  const colors = ['#5BC0FF', '#8C96F6', '#FFA45B', '#EB459E', '#3BCB78', '#FFD54F', '#FF6B4A'];
  const accent = '#5865F2';
  const N = Math.min(10, pieces.length);
  const DURATION = 3600;
  let rnd = 7;
  const random = () => ((rnd = (rnd * 16807) % 2147483647) / 2147483647);
  const phase = Array.from({ length: N }, () => random() * Math.PI * 2);
  const orbit = Array.from({ length: N }, () => 30 + random() * 70);
  const exitTo = Array.from({ length: N }, () => ({ x: random() < 0.5 ? -40 : W + 40, y: random() * H }));

  const seg = (t, a, b) => Math.min(1, Math.max(0, (t - a) / (b - a)));
  const io = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

  const center = () => ({ x: W / 2, y: H * 0.45 });
  const flock = (i, t) => {
    const a = phase[i] + t * 9, wob = Math.sin(t * 13 + i) * 12, c = center();
    return { x: c.x + Math.cos(a) * (orbit[i] + wob) + Math.sin(t * 4) * 30, y: c.y + Math.sin(a) * (orbit[i] * 0.6 + wob) + Math.cos(t * 3) * 18 };
  };

  // timing: pieces are dealt to the cursors in turn
  const buildStart = 0.2, buildSpan = 0.56;
  const perSlot = buildSpan / Math.ceil(pieces.length / N);
  const FLY = 0.34, DRAG = 0.4;
  const startOf = (k) => buildStart + Math.floor(k / N) * perSlot + (k % N) * 0.012;
  const rectOf = (p) => {
    const r = p.el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  };

  // the classic pointer arrow
  const arrow = (x, y, color, alpha, tag) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.beginPath();
    const k = 1.25;
    [[0, 0], [0, 17], [4.4, 13], [7.4, 19.6], [10.2, 18.4], [7.2, 12], [13, 12]].forEach(([a, b], i) =>
      i ? ctx.lineTo(a * k, b * k) : ctx.moveTo(a * k, b * k));
    ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,.45)';
    ctx.shadowBlur = 4;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    if (tag) {
      ctx.font = '700 11px Figtree, system-ui, sans-serif';
      const w = ctx.measureText(tag).width + 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(14, 20, w, 18, 6);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.fillText(tag, 20, 33);
    }
    ctx.restore();
  };

  const t0 = performance.now();
  let stop = false;
  const skip = () => { stop = true; };
  window.addEventListener('pointerdown', skip, { once: true });
  window.addEventListener('keydown', skip, { once: true });
  window.addEventListener('wheel', skip, { once: true, passive: true });

  const frame = (now) => {
    const t = stop ? 1 : Math.min(1, (now - t0) / DURATION);
    ctx.clearRect(0, 0, W, H);

    // pieces: wiped in under their selection box
    pieces.forEach((p, k) => {
      const s0 = startOf(k);
      const u = io(seg(t, s0 + perSlot * FLY, s0 + perSlot * (FLY + DRAG)));
      const right = (1 - u) * 100;
      // 'none' (not ''), or the page's own hiding rule would apply again
      p.el.style.clipPath = u >= 1 ? 'none' : `inset(0 ${right}% ${right}% 0)`;
      if (u <= 0) return;
      const r = (p.rect = p.rect || rectOf(p));
      const fadeSel = 1 - seg(t, s0 + perSlot * (FLY + DRAG), s0 + perSlot * (FLY + DRAG) + 0.06);
      if (fadeSel <= 0) return;
      const gw = r.w * u, gh = r.h * u;
      ctx.save();
      ctx.globalAlpha = fadeSel;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(r.x, r.y, gw, gh);
      ctx.fillStyle = 'rgba(88,101,242,.08)';
      ctx.fillRect(r.x, r.y, gw, gh);
      [[r.x, r.y], [r.x + gw, r.y], [r.x, r.y + gh], [r.x + gw, r.y + gh]].forEach(([x, y]) => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
        ctx.strokeRect(x - 3.5, y - 3.5, 7, 7);
      });
      ctx.restore();
    });

    // cursors
    for (let i = 0; i < N; i++) {
      const enter = io(seg(t, i * 0.01, 0.13 + i * 0.01));
      let pos = lerp({ x: center().x + (i - N / 2) * 16, y: H + 40 }, flock(i, t), enter);
      let tag = '', lastEnd = buildStart;
      const mine = [];
      for (let k = i; k < pieces.length; k += N) mine.push(k);
      mine.forEach((k, j) => {
        const s0 = startOf(k);
        if (t < s0) return;
        const r = (pieces[k].rect = pieces[k].rect || rectOf(pieces[k]));
        const flyU = io(seg(t, s0, s0 + perSlot * FLY));
        const dragU = io(seg(t, s0 + perSlot * FLY, s0 + perSlot * (FLY + DRAG)));
        const prev = j === 0 ? flock(i, s0) : (() => { const q = pieces[mine[j - 1]].rect; return { x: q.x + q.w, y: q.y + q.h }; })();
        pos = lerp(prev, { x: r.x, y: r.y }, flyU);
        if (dragU > 0) pos = lerp({ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, dragU);
        tag = pieces[k].tag;
        lastEnd = s0 + perSlot * (FLY + DRAG);
      });
      const leaveAt = Math.max(lastEnd, 0.72);
      const leave = io(seg(t, leaveAt, leaveAt + 0.2));
      if (leave > 0) pos = lerp(pos, exitTo[i], leave);
      arrow(pos.x, pos.y, colors[i % colors.length], 1 - leave, leave > 0 ? '' : tag);
    }

    if (t >= 1) done();
    else requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
