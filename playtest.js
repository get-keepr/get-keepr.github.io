// Google Play testing: one guided flow instead of three separate links.
// 1. "Join the group" opens Google Groups in a new tab.
// 2. Coming back to this page moves on by itself to Play's test page
//    ("Become a tester").
// 3. Coming back again opens Keepr if it's installed, or its Play Store page.
// A website can't see whether you really joined (Google doesn't tell other
// sites), so each step moves on when you come back after a moment away;
// every step can also be tapped by hand.
(() => {
  const box = document.querySelector('.play-test');
  if (!box) return;
  const GROUP = 'https://groups.google.com/g/keepr-app-testers';
  const TEST = 'https://play.google.com/apps/testing/app.vibe.chat';
  const STORE = 'https://play.google.com/store/apps/details?id=app.vibe.chat';
  const android = /Android/i.test(navigator.userAgent);
  // Android: open Keepr if it's installed, otherwise its Play Store page
  const OPEN = android
    ? 'intent://chat#Intent;scheme=keepr;package=app.vibe.chat;S.browser_fallback_url=' +
      encodeURIComponent(STORE) + ';end'
    : STORE;

  const KEY = 'keepr-playtest';
  const get = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { step: 0, at: 0 }; } catch (_) { return { step: 0, at: 0 }; }
  };
  const set = (step) => {
    try { localStorage.setItem(KEY, JSON.stringify({ step, at: Date.now() })); } catch (_) {}
    show();
  };

  const status = document.createElement('p');
  status.className = 'play-test-status';
  status.setAttribute('aria-live', 'polite');
  box.querySelector('.play-test-links').after(status);

  const links = [...box.querySelectorAll('.play-test-links a')];
  const show = () => {
    const { step } = get();
    links.forEach((a, i) => {
      a.classList.toggle('primary', i === Math.min(step, 2));
      a.classList.toggle('ghost', i !== Math.min(step, 2));
      a.classList.toggle('done', i < step);
    });
    status.innerHTML = [
      'Start with step 1. Each step opens the next one when you come back here.',
      'Joined the group? Come back to this page and the test page opens by itself.',
      'Tapped "Become a tester"? Come back here and Keepr opens (or its Play Store page).',
      'All set. <button type="button" class="play-test-reset">Start over</button>',
    ][Math.min(step, 3)];
    const reset = status.querySelector('.play-test-reset');
    if (reset) reset.onclick = () => set(0);
  };

  // the buttons: step 1 opens a new tab (so this page can take over after),
  // steps 2 and 3 go there directly
  links[0].target = '_blank';
  links[0].rel = 'noopener';
  links[0].addEventListener('click', () => set(1));
  links[1].addEventListener('click', () => set(2));
  links[2].href = OPEN;
  links[2].addEventListener('click', () => set(3));
  box.querySelectorAll('.play-test-steps a').forEach((a, i) => {
    if (i === 0) { a.target = '_blank'; a.rel = 'noopener'; a.addEventListener('click', () => set(1)); }
    if (i === 1) a.addEventListener('click', () => set(2));
  });

  // coming back to this page after a moment away: the next step
  let away = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { away = Date.now(); return; }
    const { step, at } = get();
    const gone = Date.now() - Math.max(away, at);
    if (!away || gone < 3000 || Date.now() - at > 30 * 60 * 1000) return;
    if (step === 1) {
      set(2);
      status.textContent = 'Opening the test page…';
      location.href = TEST;
    } else if (step === 2) {
      set(3);
      status.textContent = 'Opening Keepr…';
      location.href = OPEN;
    }
  });

  // back on this page from Play's test page (the back button): Keepr next
  window.addEventListener('pageshow', () => {
    const { step, at } = get();
    const since = Date.now() - at;
    if (step === 2 && since > 3000 && since < 30 * 60 * 1000) {
      set(3);
      status.textContent = 'Opening Keepr…';
      location.href = OPEN;
    }
  });

  show();
})();
