// Keepr site opening, built like a designer at work. A flock of cursors
// comes in; on each screen they first drag out a wireframe (an outlined
// frame with its size), then fill the frames in: text is typed in with a
// text cursor, everything else settles into place. The page moves down one
// screen at a time; at the end the cursors gather in a turning ring, fly
// off, and the page glides back to the top.
// Once per visit; tap, scroll, a key or "Skip" ends it at once. Skipped
// completely with "reduce motion".
(() => {
  const root = document.documentElement;
  if (!root.classList.contains('swarming')) return;
  window.__swarmStarted = true;

  // ---- what gets built, section by section ----
  const H0 = window.innerHeight;
  // a section's pieces: its children, opening up any big wrapper (so nothing
  // shows before a cursor places it), at most 14
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
  const sections = [...document.querySelectorAll('main > section, footer')].map((sec) => {
    const els = piecesOf(sec);
    if (sec.classList.contains('hero')) els.unshift(...document.querySelectorAll('.nav .brand, .nav nav'));
    return { pieces: els.map((el) => ({ el })) };
  }).filter((s) => s.pieces.length);
  const allPieces = sections.flatMap((s) => s.pieces);
  allPieces.forEach((p) => p.el.classList.add('swarm-piece'));
  root.classList.add('swarm-ready');

  // ---- typing: plain text pieces are typed in, the rest settles in ----
  const typed = []; // every text node changed, to put back exactly
  const textNodes = (el) => {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const out = [];
    for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim()) out.push(n);
    return out;
  };
  const canType = (el) => {
    if (el.querySelector('img, svg, canvas, video, picture, iframe, input')) return false;
    if (el.matches('img, svg, canvas, video, picture, iframe, input')) return false;
    const len = (el.textContent || '').trim().length;
    return len > 0 && len <= 420;
  };
  const prepType = (p) => {
    const r = p.el.getBoundingClientRect();
    p.lock = { minHeight: p.el.style.minHeight, minWidth: p.el.style.minWidth };
    p.el.style.minHeight = r.height + 'px';
    p.el.style.minWidth = r.width + 'px';
    p.nodes = textNodes(p.el).map((n) => {
      const t = { n, full: n.data, set: '' };
      typed.push(t);
      n.data = '';
      return t;
    });
    p.total = p.nodes.reduce((a, t) => a + t.full.length, 0);
  };
  // shows the first [count] letters; returns where the text cursor is
  const typeTo = (p, count) => {
    let left = count, caret = null;
    for (const t of p.nodes) {
      const take = Math.max(0, Math.min(t.full.length, left));
      const next = t.full.slice(0, take);
      if (t.set !== next) { t.n.data = next; t.set = next; }
      left -= take;
      if (take > 0) caret = t;
    }
    if (!caret) return null;
    try {
      const range = document.createRange();
      range.setStart(caret.n, Math.max(0, caret.set.length - 1));
      range.setEnd(caret.n, caret.set.length);
      const rects = range.getClientRects();
      const r = rects[rects.length - 1];
      if (r) return { x: r.right, y: r.top, h: r.height };
    } catch (_) {}
    return null;
  };
  const unlock = (p) => {
    if (!p.lock) return;
    p.el.style.minHeight = p.lock.minHeight;
    p.el.style.minWidth = p.lock.minWidth;
    p.lock = null;
  };
  const settle = (p, u) => {
    // filter and translate only, so the page's own animations keep their
    // opacity and transform
    if (u >= 1) { p.el.style.filter = ''; p.el.style.translate = ''; return; }
    p.el.style.filter = `blur(${(1 - u) * 6}px) opacity(${u})`;
    p.el.style.translate = `0 ${(1 - u) * 10}px`;
  };
  const show = (p) => { p.el.style.clipPath = 'none'; };

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

  const colors = ['#64D2FF', '#BF5AF2', '#FF9F0A', '#FF375F', '#30D158', '#FFD60A', '#5E5CE6', '#FF6B4A', '#66D4CF'];
  const blue = '#0A84FF';
  const N = 9;
  let seed = 11;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const phase = Array.from({ length: N }, () => random() * Math.PI * 2);
  const orbit = Array.from({ length: N }, () => 34 + random() * 56);

  const clamp01 = (v) => Math.min(1, Math.max(0, v));
  const io = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const out5 = (t) => 1 - Math.pow(1 - t, 5);
  const lerp = (a, b, u) => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });

  const cur = Array.from({ length: N }, (_, i) => ({ x: W / 2 + (i - N / 2) * 18, y: H + 40, beam: false }));
  const flockAt = (i, s) => {
    const a = phase[i] + s * 2.6, wob = Math.sin(s * 3 + i) * 8;
    return { x: W / 2 + Math.cos(a) * (orbit[i] + wob), y: H * 0.5 + Math.sin(a) * (orbit[i] * 0.62 + wob) };
  };

  // ---- drawing ----
  const arrow = (x, y, color, alpha, turn = 0) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (turn) ctx.rotate(turn);
    ctx.beginPath();
    const k = 1.15;
    [[0, 0], [0, 17], [4.4, 13], [7.4, 19.6], [10.2, 18.4], [7.2, 12], [13, 12]].forEach(([a, b], i) =>
      i ? ctx.lineTo(a * k, b * k) : ctx.moveTo(a * k, b * k));
    ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 1;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
  };
  const beam = (x, y, color, alpha) => {
    // the text cursor (I-beam), in the cursor's colour
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3.4;
    ctx.lineCap = 'round';
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(x - 4, y - 9); ctx.lineTo(x + 4, y - 9);
      ctx.moveTo(x, y - 9); ctx.lineTo(x, y + 9);
      ctx.moveTo(x - 4, y + 9); ctx.lineTo(x + 4, y + 9);
    };
    path(); ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = 1.6;
    path(); ctx.stroke();
    ctx.restore();
  };
  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  const chip = (cx, y, text, alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "SF Pro Text", Figtree, system-ui, sans-serif';
    const w = ctx.measureText(text).width + 10;
    roundRect(cx - w / 2, y, w, 16, 4);
    ctx.fillStyle = blue;
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(text, cx, y + 8.5);
    ctx.restore();
  };
  // a frame: wireframe (outline + soft fill) or selected (blue, with handles)
  const frame = (r, u, alpha, selected, label) => {
    if (alpha <= 0) return;
    const gw = Math.max(1, r.width * u), gh = Math.max(1, r.height * u);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = selected ? 'rgba(10,132,255,.06)' : 'rgba(255,255,255,.035)';
    ctx.fillRect(r.left, r.top, gw, gh);
    ctx.strokeStyle = selected ? blue : 'rgba(10,132,255,.55)';
    ctx.lineWidth = 1;
    ctx.strokeRect(r.left + 0.5, r.top + 0.5, gw - 1, gh - 1);
    if (selected) {
      [[r.left, r.top], [r.left + gw, r.top], [r.left, r.top + gh], [r.left + gw, r.top + gh]].forEach(([x, y]) => {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - 3, y - 3, 6, 6);
        ctx.strokeRect(x - 3, y - 3, 6, 6);
      });
    }
    ctx.restore();
    if (label) chip(r.left + gw / 2, r.top + gh + 6, `${Math.round(gw)} × ${Math.round(gh)}`, alpha);
  };
  const grid = (alpha) => {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(255,255,255,.22)';
    for (let x = 12; x < W; x += 24) for (let y = 12; y < H; y += 24) ctx.fillRect(x, y, 1, 1);
    ctx.restore();
  };

  // ---- the timeline ----
  // a phone has more screens to build, so it goes a little quicker
  const K = window.innerWidth < 700 ? 0.7 : 1;
  const FLY = 240 * K, DRAG = 300 * K, MOVE = 200 * K, SETTLE = 460 * K;
  const phases = [{ kind: 'enter', ms: 1100 }];
  sections.forEach((s, i) => {
    if (i > 0) phases.push({ kind: 'scroll', ms: 750, pieces: s.pieces });
    phases.push({ kind: 'wire', pieces: s.pieces }, { kind: 'fill' });
  });
  phases.push({ kind: 'ring', ms: 1700 }, { kind: 'leave', ms: 800 }, { kind: 'top', ms: 1100 });

  let phaseIndex = 0, phaseStart = performance.now(), scrollFrom = 0, scrollTo = 0, stopped = false;
  let gridAlpha = 0;
  // the current screen's frames, kept from the wireframe to the fill
  let jobs = [];

  const startPhase = (now) => {
    const ph = phases[phaseIndex];
    phaseStart = now;
    ph.from = cur.map((c) => ({ ...c }));
    if (ph.kind === 'scroll') {
      scrollFrom = window.scrollY;
      const el = ph.pieces[0].el;
      scrollTo = Math.max(0, el.getBoundingClientRect().top + window.scrollY - (ph.split ? 90 : 60));
    }
    if (ph.kind === 'top') { scrollFrom = window.scrollY; scrollTo = 0; }
    if (ph.kind === 'wire') {
      jobs = [];
      const below = [];
      ph.pieces.forEach((p) => {
        p.rect = p.el.getBoundingClientRect();
        if (p.rect.bottom < 0) { show(p); }
        else if (p.rect.top > H - 40) below.push(p);
        else jobs.push(p);
      });
      // a tall section: build what's on screen, then move on and build the
      // rest (a few screens at most)
      const depth = ph.depth || 0;
      if (below.length && depth < 4) {
        phases.splice(phaseIndex + 2, 0,
          { kind: 'scroll', ms: 650, pieces: below, split: true },
          { kind: 'wire', pieces: below, depth: depth + 1 }, { kind: 'fill' });
      } else {
        below.forEach(show);
      }
      // each cursor drags out its own frames one after another
      jobs.forEach((p, k) => {
        const i = k % N, round = Math.floor(k / N);
        p.cursor = i;
        p.w0 = round * (FLY + DRAG + 60) + i * 45;
      });
      ph.ms = jobs.length ? Math.max(...jobs.map((p) => p.w0 + FLY + DRAG)) + 260 : 1;
    }
    if (ph.kind === 'fill') {
      // then each cursor fills its frames in, one after another
      const t = new Array(N).fill(0);
      jobs.forEach((p) => {
        const i = p.cursor;
        p.typing = canType(p.el);
        if (p.typing) prepType(p);
        show(p);
        if (!p.typing) settle(p, 0);
        const dur = p.typing ? Math.min(850, Math.max(280, p.total * 11)) * K : SETTLE;
        p.f0 = t[i] + i * 40;
        p.f1 = p.f0 + MOVE + dur;
        t[i] = p.f1 + 60;
      });
      ph.ms = jobs.length ? Math.max(...jobs.map((p) => p.f1)) + 320 : 1;
    }
  };

  const finishPiece = (p) => {
    if (p.nodes) typeTo(p, p.total);
    unlock(p);
    settle(p, 1);
  };

  const finish = () => {
    if (stopped) return;
    stopped = true;
    // put every typed text back exactly (unless the page changed it since)
    typed.forEach((t) => { if (t.n.data === t.set) t.n.data = t.full; });
    allPieces.forEach((p) => {
      unlock(p);
      settle(p, 1);
      p.el.classList.remove('swarm-piece');
      p.el.style.clipPath = '';
    });
    root.classList.remove('swarming', 'swarm-ready');
    canvas.remove();
    skipBtn.remove();
    try { sessionStorage.setItem('keepr-swarm', '1'); } catch (_) {}
  };
  const skip = () => finish();
  skipBtn.addEventListener('click', skip);
  ['wheel', 'touchmove', 'keydown'].forEach((e) => window.addEventListener(e, skip, { once: true, passive: true }));
  document.addEventListener('pointerdown', (e) => { if (e.target !== skipBtn) skip(); }, { once: true });

  startPhase(phaseStart);
  const frameLoop = (now) => {
    if (stopped) return;
    let ph = phases[phaseIndex];
    let elapsed = now - phaseStart;
    if (elapsed >= ph.ms) {
      if (ph.kind === 'fill') jobs.forEach(finishPiece);
      phaseIndex++;
      if (phaseIndex >= phases.length) return finish();
      startPhase(now);
      ph = phases[phaseIndex];
      elapsed = 0;
    }
    const u = clamp01(elapsed / ph.ms);
    const s = now / 1000;
    ctx.clearRect(0, 0, W, H);

    // a faint design-canvas grid while the first screen is drawn
    const wantGrid = phaseIndex <= 2 ? 1 : 0;
    gridAlpha += (wantGrid - gridAlpha) * 0.06;
    grid(gridAlpha);

    if (ph.kind === 'scroll' || ph.kind === 'top') {
      // 'instant': the page's smooth scrolling would lag behind each step
      window.scrollTo({ top: scrollFrom + (scrollTo - scrollFrom) * io(u), behavior: 'instant' });
    }

    const busy = new Array(N).fill(false);
    if (ph.kind === 'wire') {
      jobs.forEach((p) => {
        const i = p.cursor, r = p.rect, t0 = p.w0;
        const fly = io(clamp01((elapsed - t0) / FLY));
        const drag = out5(clamp01((elapsed - t0 - FLY) / DRAG));
        if (elapsed < t0) return;
        const prev = jobs.filter((q) => q.cursor === i && q.w0 < t0).pop();
        const start = prev ? { x: prev.rect.right, y: prev.rect.bottom } : ph.from[i];
        let pos = lerp(start, { x: r.left, y: r.top }, fly);
        if (drag > 0) {
          pos = lerp({ x: r.left, y: r.top }, { x: r.right, y: r.bottom }, drag);
          const done = drag >= 1;
          frame(r, drag, 1, !done, !done || elapsed - t0 - FLY - DRAG < 300);
        }
        cur[i] = { ...pos, beam: false };
        busy[i] = true;
      });
      // frames already drawn stay as the wireframe
    }

    if (ph.kind === 'fill') {
      jobs.forEach((p) => {
        const i = p.cursor, r = p.rect;
        if (elapsed < p.f0) { frame(r, 1, 1, false, false); return; }
        if (elapsed >= p.f1) {
          // done: the frame lets go
          frame(r, 1, 1 - clamp01((elapsed - p.f1) / 240), true, false);
          return;
        }
        busy[i] = true;
        // where this cursor was when it picked up this frame
        if (!p.start) p.start = { x: cur[i].x, y: cur[i].y };
        const start = p.start;
        const into = io(clamp01((elapsed - p.f0) / MOVE));
        const work = clamp01((elapsed - p.f0 - MOVE) / (p.f1 - p.f0 - MOVE));
        frame(r, 1, 1, true, false);
        if (p.typing) {
          const caret = typeTo(p, Math.round(p.total * work));
          const at = caret ? { x: caret.x + 3, y: caret.y + caret.h / 2 } : { x: r.left + 4, y: r.top + 12 };
          cur[i] = { ...lerp(start, at, into), beam: true };
          if (caret && work > 0) {
            ctx.fillStyle = blue;
            ctx.fillRect(caret.x, caret.y, 1.5, caret.h);
          }
        } else {
          settle(p, out5(work));
          const at = { x: r.right - 2, y: r.bottom - 2 };
          cur[i] = { ...lerp(start, at, into), beam: false };
        }
        if (work >= 1) finishPiece(p);
      });
    }

    // cursors with nothing to do drift in the flock
    if (ph.kind === 'wire' || ph.kind === 'fill') {
      for (let i = 0; i < N; i++) if (!busy[i]) {
        const c = cur[i], f = flockAt(i, s);
        cur[i] = { x: c.x + (f.x - c.x) * 0.06, y: c.y + (f.y - c.y) * 0.06, beam: false };
      }
    } else if (ph.kind === 'enter' || ph.kind === 'scroll' || ph.kind === 'top') {
      for (let i = 0; i < N; i++) cur[i] = { ...lerp(ph.from[i], flockAt(i, s), io(clamp01(u * 1.3))), beam: false };
    }

    let turns = null;
    if (ph.kind === 'ring' || ph.kind === 'leave') {
      // the finish: a turning ring, then it opens up and they fly off
      const R = Math.min(W, H) * 0.13;
      const radius = ph.kind === 'ring' ? R : R + out5(u) * Math.max(W, H) * 0.7;
      const spin = s * 2.2;
      turns = [];
      for (let i = 0; i < N; i++) {
        const a = spin + (i / N) * Math.PI * 2;
        const target = { x: W / 2 + Math.cos(a) * radius, y: H / 2 + Math.sin(a) * radius };
        cur[i] = ph.kind === 'ring' ? { ...lerp(ph.from[i], target, out5(clamp01(u * 2))), beam: false } : { ...target, beam: false };
        turns.push(a + Math.PI * 1.12); // pointing along the ring
      }
    }

    const alpha = ph.kind === 'leave' ? 1 - u : ph.kind === 'top' ? 0 : 1;
    if (alpha > 0) for (let i = 0; i < N; i++) {
      const c = cur[i], col = colors[i % colors.length];
      if (c.beam) beam(c.x, c.y, col, alpha);
      else arrow(c.x, c.y, col, alpha, turns ? turns[i] : 0);
    }
    requestAnimationFrame(frameLoop);
  };
  requestAnimationFrame(frameLoop);
})();
