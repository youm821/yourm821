'use strict';
// Light / dark theme. Dark is the default; the choice is remembered in this browser.
(function () {
  const root = document.documentElement;
  let t = null; try { t = localStorage.getItem('theme'); } catch { /* storage blocked */ }
  if (t === 'light') root.dataset.theme = 'light';
  addEventListener('DOMContentLoaded', () => {
    const spot = document.querySelector('.foot span:last-child') || document.querySelector('.foot');
    if (!spot) return;
    const b = document.createElement('button'); b.className = 'linkbtn'; b.type = 'button';
    const paint = () => { b.textContent = root.dataset.theme === 'light' ? 'Dark mode' : 'Light mode'; };
    b.onclick = () => { if (root.dataset.theme === 'light') delete root.dataset.theme; else root.dataset.theme = 'light'; try { localStorage.setItem('theme', root.dataset.theme || 'dark'); } catch { /* ignore */ } paint(); };
    paint(); spot.prepend(b, ' ');
  });
})();
