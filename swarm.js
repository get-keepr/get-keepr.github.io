// Keepr site opening: a swarm of little coloured cursors builds the whole
// page in front of you. They come in as a flock; the page scrolls down one
// section at a time, and in each section the cursors spread out and drag a
// selection box over each piece, which is wiped into view under the box.
// At the bottom they fly off and the page glides back to the top.
// Once per visit; tap, scroll, a key or "Skip" ends it. Skipped completely
// with "reduce motion".
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('swarming')) return;
  window.__swarmStarted = true;

  // ---- what gets built, section by section ----
  // a section's pieces: its children, opening up any big wrapper one level
  // (so nothing in it shows before the cursors place it), at most 14
  const piecesOf = (sec) => {
    const out = [];
    const visit = (el, depth) => {
      for (const ch of el.children) {
        if (ch.matches('script, style, canvas, .swarm-skip')) continue;
        const r = ch.getBoundingClientRect();
        if (r.width < 8 || r.height < 6) continue;
        if (depth < 2 && ch.children.length > 1 && r.height > H0 * 0.45) visit(ch, depth + 1);
        else out.push(ch);
      }
    };
    visit(sec, 0);
    return out.slice(0, 14);
  };
  const H0 = window.innerHeight;
  const sections = [...document.querySelectorAll('main > section, footer')].map((sec) => {
    const els = piecesOf(sec);
    if (sec.classList.contains('hero')) els.unshift(...document.querySelectorAll('.nav .brand, .nav nav'));
    return { sec, pieces: els.map((el) => ({ el, rect: null })) };
  }).filter((s) => s.pieces.length);
  const allPieces = sections.flatMap((s) => s.pieces);
  allPieces.forEach((p) => p.el.classList.add('swarm-piece'));
  // pieces are hidden one by one now; the page itself can show
  root.classList.add('swarm-ready');

  // ---- the canvas and a Skip button ----
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:100;pointer-events:none';
  document.body.appendChild(canvas);
  const skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'swarm-skip';
  skipBtn.textContent = 'Skip';
  document.body.appendChild(skipBtn);
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
  const N = 9;
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const phase = Array.from({ length: N }, () => random() * Math.PI * 2);
  const orbit = Array.from({ length: N }, () => 30 + random() * 60);

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const io = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

  // each cursor's own position, carried from phase to phase
  const cur = Array.from({ length: N }, (_, i) => ({ x: W / 2 + (i - N / 2) * 16, y: H + 40 }));
  const flockAt = (i, s) => {
    const a = phase[i] + s * 4.5, wob = Math.sin(s * 6 + i) * 10;
    return { x: W / 2 + Math.cos(a) * (orbit[i] + wob), y: H * 0.5 + Math.sin(a) * (orbit[i] * 0.6 + wob) };
  };

  const arrow = (x, y, color, alpha) => {
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
    ctx.restore();
  };

  const selection = (r, u, alpha) => {
    const gw = r.width * u, gh = r.height * u;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.fillStyle = 'rgba(88,101,242,.08)';
    ctx.fillRect(r.left, r.top, gw, gh);
    ctx.strokeRect(r.left, r.top, gw, gh);
    [[r.left, r.top], [r.left + gw, r.top], [r.left, r.top + gh], [r.left + gw, r.top + gh]].forEach(([x, y]) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
      ctx.strokeRect(x - 3.5, y - 3.5, 7, 7);
    });
    ctx.restore();
  };

  const reveal = (p, u) => {
    const right = (1 - u) * 100;
    // 'none' (not ''), or the hiding rule would apply again
    p.el.style.clipPath = u >= 1 ? 'none' : `inset(0 ${right}% ${right}% 0)`;
  };

  // ---- the timeline: a list of phases, each with its length ----
  const FLY = 280, DRAG = 420, GAP = 50;
  const phases = [{ kind: 'enter', ms: 900 }];
  sections.forEach((s, i) => {
    if (i > 0) phases.push({ kind: 'scroll', ms: 750, section: s });
    const rounds = Math.ceil(s.pieces.length / N);
    phases.push({ kind: 'build', ms: rounds * (FLY + DRAG + GAP) + 250, section: s });
  });
  phases.push({ kind: 'leave', ms: 700 }, { kind: 'top', ms: 900 });

  let phaseIndex = 0, phaseStart = performance.now(), scrollFrom = 0, scrollTo = 0, stopped = false;
  const startPhase = (now) => {
    const ph = phases[phaseIndex];
    phaseStart = now;
    ph.from = cur.map((c) => ({ ...c }));
    if (ph.kind === 'scroll') {
      scrollFrom = window.scrollY;
      const el = ph.target || ph.section.sec;
      scrollTo = Math.max(0, el.getBoundingClientRect().top + window.scrollY - (ph.target ? 90 : 40));
    }
    if (ph.kind === 'top') { scrollFrom = window.scrollY; scrollTo = 0; }
    if (ph.kind === 'build') {
      // pieces on screen get built; any outside the screen just appear
      ph.jobs = [];
      const below = [];
      ph.section.pieces.forEach((p) => {
        p.rect = p.el.getBoundingClientRect();
        if (p.rect.bottom < 0) reveal(p, 1);
        else if (p.rect.top > H - 40) below.push(p);
        else ph.jobs.push(p);
      });
      // a tall section: build what's on screen, then scroll on and build
      // the rest (a few screens at most)
      const depth = ph.section.depth || 0;
      if (below.length && depth < 4) {
        const rest = { sec: ph.section.sec, pieces: below, depth: depth + 1 };
        phases.splice(phaseIndex + 1, 0,
          { kind: 'scroll', ms: 650, target: below[0].el },
          { kind: 'build', ms: Math.ceil(below.length / N) * (FLY + DRAG + GAP) + 250, section: rest });
      } else {
        below.forEach((p) => reveal(p, 1));
      }
      // the build takes as long as its own pieces need
      ph.ms = Math.ceil(Math.max(ph.jobs.length, 1) / N) * (FLY + DRAG + GAP) + 250;
    }
    if (ph.kind === 'leave') ph.exits = cur.map(() => ({ x: random() < 0.5 ? -40 : W + 40, y: random() * H }));
  };

  const finish = () => {
    if (stopped) return;
    stopped = true;
    allPieces.forEach((p) => { p.el.classList.remove('swarm-piece'); p.el.style.clipPath = ''; });
    root.classList.remove('swarming', 'swarm-ready');
    canvas.remove();
    skipBtn.remove();
    try { sessionStorage.setItem('keepr-swarm', '1'); } catch (_) {}
  };
  const skip = () => finish();
  skipBtn.addEventListener('click', skip);
  ['wheel', 'touchmove', 'keydown'].forEach((e) => window.addEventListener(e, skip, { once: true, passive: true }));
  canvas.ownerDocument.addEventListener('pointerdown', (e) => { if (e.target !== skipBtn) skip(); }, { once: true });

  startPhase(phaseStart);
  const frame = (now) => {
    if (stopped) return;
    let ph = phases[phaseIndex];
    let elapsed = now - phaseStart;
    if (elapsed >= ph.ms) {
      phaseIndex++;
      if (phaseIndex >= phases.length) return finish();
      startPhase(now);
      ph = phases[phaseIndex];
      elapsed = 0;
    }
    const u = clamp01(elapsed / ph.ms);
    const s = now / 1000;
    ctx.clearRect(0, 0, W, H);

    if (ph.kind === 'scroll' || ph.kind === 'top') {
      // 'instant': the page's smooth scrolling would lag behind each step
      window.scrollTo({ top: scrollFrom + (scrollTo - scrollFrom) * io(u), behavior: 'instant' });
    }

    // sections already built keep their pieces; the current one builds now
    if (ph.kind === 'build') {
      ph.jobs.forEach((p, k) => {
        const i = k % N, round = Math.floor(k / N);
        const t0 = round * (FLY + DRAG + GAP) + i * 25;
        const fly = io(clamp01((elapsed - t0) / FLY));
        const drag = io(clamp01((elapsed - t0 - FLY) / DRAG));
        const r = p.rect;
        reveal(p, drag);
        if (drag > 0 && drag < 1) selection(r, drag, 1);
        else if (drag >= 1) selection(r, 1, 1 - clamp01((elapsed - t0 - FLY - DRAG) / 220));
        if (elapsed >= t0) {
          const start = round === 0 ? ph.from[i] : (() => { const q = ph.jobs[k - N].rect; return { x: q.right, y: q.bottom }; })();
          let pos = lerp(start, { x: r.left, y: r.top }, fly);
          if (drag > 0) pos = lerp({ x: r.left, y: r.top }, { x: r.right, y: r.bottom }, drag);
          cur[i] = pos;
        }
      });
      // cursors with nothing to do in this section drift in the flock
      for (let i = ph.jobs.length; i < N; i++) cur[i] = lerp(ph.from[i], flockAt(i, s), io(u));
    } else if (ph.kind === 'enter' || ph.kind === 'scroll' || ph.kind === 'top') {
      for (let i = 0; i < N; i++) cur[i] = lerp(ph.from[i], flockAt(i, s), io(clamp01(u * 1.4)));
    } else if (ph.kind === 'leave') {
      for (let i = 0; i < N; i++) cur[i] = lerp(ph.from[i], ph.exits[i], io(u));
    }

    const alpha = ph.kind === 'leave' ? 1 - u : ph.kind === 'top' ? 0 : 1;
    if (alpha > 0) for (let i = 0; i < N; i++) arrow(cur[i].x, cur[i].y, colors[i % colors.length], alpha);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
