// Motion helpers that CSS alone cannot do: the segmented-control thumb and the sidebar tab slide.
// Durations come from the CSS tokens, so prefers-reduced-motion (which zeroes them) disables both.
(function () {
  'use strict';
  const TAB_KEY = 'idesk-mock-tab-from';
  const DESKTOP = '(min-width: 861px)';
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ms = (token) => parseFloat(getComputedStyle(document.documentElement).getPropertyValue(token)) || 0;

  // ---------- Segmented control: one thumb slides behind the selected segment ----------
  function placeThumb(seg, thumb, instant) {
    const on = seg.querySelector(':scope > .on');
    thumb.hidden = !on;
    if (!on) return;
    if (instant) thumb.classList.add('instant');
    thumb.style.width = on.offsetWidth + 'px';
    thumb.style.height = on.offsetHeight + 'px';
    thumb.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
    if (instant) requestAnimationFrame(() => thumb.classList.remove('instant'));
  }
  function wireSeg(seg) {
    if (seg.dataset.thumb) return;
    seg.dataset.thumb = '1';
    const thumb = document.createElement('span');
    thumb.className = 'seg-thumb'; thumb.setAttribute('aria-hidden', 'true');
    seg.prepend(thumb); seg.classList.add('has-thumb');
    placeThumb(seg, thumb, true);
    new MutationObserver((list) => { if (list.some((m) => m.target !== thumb)) placeThumb(seg, thumb, false); }).observe(seg, { subtree: true, attributes: true, attributeFilter: ['class'] });
    new ResizeObserver(() => placeThumb(seg, thumb, true)).observe(seg);
    // Links that switch page (Kanban ↔ Tabel): let the thumb arrive before navigating.
    seg.querySelectorAll(':scope > a[href]').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (link.classList.contains('on') || event.metaKey || event.ctrlKey || event.shiftKey) return;
        event.preventDefault();
        seg.querySelectorAll(':scope > a').forEach((a) => a.classList.toggle('on', a === link));
        setTimeout(() => { location.href = link.href; }, reduced() ? 0 : ms('--dur-2'));
      });
    });
  }

  // ---------- Sidebar: the white tab slides from the previously active item ----------
  const navTop = (nav, el) => el.getBoundingClientRect().top - nav.getBoundingClientRect().top + nav.scrollTop;
  function rememberTab(nav) {
    nav.addEventListener('click', (event) => {
      const target = event.target.closest('.item');
      const current = nav.querySelector('.item.active');
      if (!target || !current || target === current || target.getAttribute('href') === '#') return;
      sessionStorage.setItem(TAB_KEY, String(navTop(nav, current)));
    });
  }
  function slideTab(nav) {
    const from = sessionStorage.getItem(TAB_KEY);
    sessionStorage.removeItem(TAB_KEY);
    const active = nav.querySelector('.item.active');
    if (from === null || !active || reduced() || !matchMedia(DESKTOP).matches) return;
    const to = navTop(nav, active);
    if (Math.abs(to - Number(from)) < 1) return;
    const ghost = document.createElement('span');
    ghost.className = 'tab-ghost'; ghost.setAttribute('aria-hidden', 'true');
    ghost.style.height = active.offsetHeight + 'px';
    ghost.style.transform = `translateY(${from}px)`;
    nav.prepend(ghost); active.classList.add('arriving');
    requestAnimationFrame(() => requestAnimationFrame(() => { ghost.style.transform = `translateY(${to}px)`; }));
    const done = () => { ghost.remove(); active.classList.remove('arriving'); };
    ghost.addEventListener('transitionend', done, { once: true });
    setTimeout(done, ms('--dur-3') * 2);
  }

  function init() {
    document.querySelectorAll('.seg').forEach(wireSeg);
    const nav = document.querySelector('.sidebar .nav');
    if (nav) { rememberTab(nav); slideTab(nav); }
  }
  // Pages mount their shell synchronously in body scripts; run after them.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.iDeskMotion = { wireSeg };
})();
