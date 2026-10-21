// Shared helpers for the dashboard, resource, management and admin mockup pages.
// Builds charts from tokens, wires tabs (with direction-aware transitions), switches, tooltips and demo actions.
// Every value rendered from data is a fixture literal in this repo; user input is only read via .value/.textContent.
(function () {
  'use strict';
  const HUES = ['var(--pink)', 'var(--blue)', 'var(--orange)', 'var(--teal)', 'var(--green)', 'var(--navy)', 'var(--red)', 'var(--brown)'];
  const GRID_STEPS = 4;
  const DONUT_R = 52;
  const DONUT_GAP = 2;
  const TIP_OFFSET = 14;
  const ic = (n) => `<i data-lucide="${n}"></i>`;
  const caret = '<i data-lucide="chevron-down" class="caret"></i>';
  const hue = (n) => HUES[[...n].reduce((a, ch) => a + ch.charCodeAt(0), 0) % HUES.length];
  const av = (n, cls = '') => `<span class="avatar ${cls}" style="--c:${hue(n)}">${initials(n)}</span>`;
  const bub = (label, c, opts = {}) => `<span class="bub${opts.mono ? ' mono' : ''}" style="--c:${c}${opts.ink ? `;--ink:${opts.ink}` : ''}">${opts.icon ? ic(opts.icon) : '<span class="dot"></span>'}${label}</span>`;
  const niceMax = (v) => { const step = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1)))); return Math.ceil(v / step) * step; };

  function gridLines(max) {
    return Array.from({ length: GRID_STEPS + 1 }, (_, i) => {
      const v = Math.round((max / GRID_STEPS) * i);
      return `<div class="gl${i === 0 ? ' base' : ''}" style="bottom:${(i / GRID_STEPS) * 100}%"><span>${v}</span></div>`;
    }).join('');
  }
  function legend(series) {
    return `<div class="chart-legend">${series.map((s) => `<span style="--c:${s.c}"><i></i>${s.name}</span>`).join('')}</div>`;
  }
  function dataTable(labels, series, caption) {
    const head = `<tr><th>${caption}</th>${series.map((s) => `<th>${s.name}</th>`).join('')}</tr>`;
    const rows = labels.map((l, i) => `<tr><td>${l}</td>${series.map((s) => `<td>${s.data[i]}</td>`).join('')}</tr>`).join('');
    return `<details class="chart-table"><summary>Lihat sebagai tabel</summary><table>${head}${rows}</table></details>`;
  }
  // Grouped columns: labels[], series [{name, c, data[]}]
  function columns({ labels, series, label, sparse }) {
    const max = niceMax(Math.max(...series.flatMap((s) => s.data)));
    const groups = labels.map((l, i) => {
      const tip = `${l}\n${series.map((s) => `${s.name}: ${s.data[i]}`).join('\n')}`;
      const bars = series.map((s) => `<i class="cb" style="--c:${s.c};--h:${(s.data[i] / max) * 100}%;animation-delay:${i * 12}ms"></i>`).join('');
      return `<div class="cg" tabindex="0" data-tip="${tip}" aria-label="${tip.replace(/\n/g, ', ')}">${bars}</div>`;
    }).join('');
    return `<figure class="chart" style="margin:0" aria-label="${label}">${series.length > 1 ? legend(series) : ''}
      <div class="plot">${gridLines(max)}<div class="cols">${groups}</div></div>
      <div class="xl${sparse ? ' sparse' : ''}">${labels.map((l) => `<span>${l}</span>`).join('')}</div>
      ${dataTable(labels, series, 'Tanggal')}</figure>`;
  }
  // Lines with hover crosshair: one y-axis, 2px lines, light area under the first series.
  function lines({ labels, series, label, sparse }) {
    const max = niceMax(Math.max(...series.flatMap((s) => s.data)));
    const n = labels.length;
    const x = (i) => ((i + 0.5) / n) * 100;
    const y = (v) => 100 - (v / max) * 100;
    const path = (d) => d.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    const svg = series.map((s, k) => `${k === 0 ? `<path class="area" style="--c:${s.c}" d="${path(s.data)} L${x(n - 1)},100 L${x(0)},100 Z"/>` : ''}<path style="--c:${s.c}" d="${path(s.data)}"/>`).join('');
    const hits = labels.map((l, i) => {
      const tip = `${l}\n${series.map((s) => `${s.name}: ${s.data[i]}`).join('\n')}`;
      return `<div class="hc" tabindex="0" data-tip="${tip}" aria-label="${tip.replace(/\n/g, ', ')}">${series.map((s) => `<i style="--c:${s.c};--v:${(s.data[i] / max) * 100}%"></i>`).join('')}</div>`;
    }).join('');
    return `<figure class="chart" style="margin:0" aria-label="${label}">${legend(series)}
      <div class="plot">${gridLines(max)}<svg class="lsvg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${svg}</svg><div class="hcols">${hits}</div></div>
      <div class="xl${sparse ? ' sparse' : ''}">${labels.map((l) => `<span>${l}</span>`).join('')}</div>
      ${dataTable(labels, series, 'Tanggal')}</figure>`;
  }
  // Donut with 2px surface gaps between segments and a legend that always names each slice.
  function donut({ items, label, unit = 'tiket' }) {
    const total = items.reduce((a, b) => a + b.v, 0);
    const circ = 2 * Math.PI * DONUT_R;
    let offset = 0;
    const segs = items.filter((it) => it.v > 0).map((it) => {
      const len = (it.v / total) * circ;
      const seg = `<circle class="seg" r="${DONUT_R}" cx="64" cy="64" style="--c:${it.c}" stroke-dasharray="${Math.max(len - DONUT_GAP, 0.5)} ${circ}" stroke-dashoffset="${-offset}" data-tip="${it.label}: ${it.v} (${Math.round((it.v / total) * 100)}%)"></circle>`;
      offset += len;
      return seg;
    }).join('');
    return `<div class="donut-wrap" role="img" aria-label="${label}: ${items.map((i) => `${i.label} ${i.v}`).join(', ')}">
      <div class="donut-center"><svg class="donut" viewBox="0 0 128 128"><circle class="track" r="${DONUT_R}" cx="64" cy="64"></circle>${segs}</svg><b>${total}<small>${unit}</small></b></div>
      <div class="dlegend">${items.map((i) => `<div style="--c:${i.c}"><i></i><span>${i.label}</span><b>${i.v}</b></div>`).join('')}</div></div>`;
  }
  function hbars(items, { suffix = '', max } = {}) {
    const top = max || Math.max(...items.map((i) => i.v));
    return `<div class="hbars">${items.map((i) => `<div class="hb" data-tip="${i.label}: ${i.v}${suffix}"><span>${i.label}</span><span class="track"><i style="--p:${(i.v / top) * 100}%;--c:${i.c || 'var(--accent)'}"></i></span><b>${i.v}${suffix}</b></div>`).join('')}</div>`;
  }

  // ---------- Tooltip: one floating node, follows pointer or the focused mark ----------
  function wireTips() {
    const tip = iDeskDropdown.node('div', 'chart-tip'); tip.hidden = true; tip.setAttribute('role', 'tooltip');
    document.body.append(tip);
    const show = (el, x, y) => {
      tip.textContent = el.dataset.tip; tip.hidden = false;
      const w = tip.offsetWidth, h = tip.offsetHeight;
      tip.style.left = `${Math.min(x + TIP_OFFSET, innerWidth - w - 8)}px`;
      tip.style.top = `${Math.max(8, y - h - TIP_OFFSET)}px`;
    };
    document.addEventListener('pointermove', (e) => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) show(el, e.clientX, e.clientY); else tip.hidden = true; });
    document.addEventListener('focusin', (e) => { const el = e.target.closest('[data-tip]'); if (!el) return; const r = el.getBoundingClientRect(); show(el, r.left + r.width / 2, r.top); });
    document.addEventListener('focusout', () => { tip.hidden = true; });
    addEventListener('scroll', () => { tip.hidden = true; }, { passive: true });
  }

  // ---------- Tabs: [data-tabs] container of buttons with data-tab; panels [data-panel] ----------
  function wireTabs(root = document) {
    root.querySelectorAll('[data-tabs]').forEach((bar) => {
      const buttons = [...bar.querySelectorAll('[data-tab]')];
      const scope = document.getElementById(bar.dataset.tabs) || document;
      bar.setAttribute('role', 'tablist');
      const select = (btn, focus) => {
        const prev = buttons.findIndex((b) => b.classList.contains('on'));
        const next = buttons.indexOf(btn);
        buttons.forEach((b) => { const on = b === btn; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
        const names = buttons.map((b) => b.dataset.tab);
        scope.querySelectorAll('[data-panel]').forEach((p) => {
          if (!names.includes(p.dataset.panel)) return;
          const on = p.dataset.panel === btn.dataset.tab;
          p.hidden = !on;
          p.classList.remove('enter-l', 'enter-r');
          if (on && prev !== -1 && prev !== next) { void p.offsetWidth; p.classList.add(next > prev ? 'enter-r' : 'enter-l'); }
        });
        if (focus) btn.focus();
        bar.dispatchEvent(new CustomEvent('tabchange', { detail: btn.dataset.tab }));
      };
      buttons.forEach((b) => {
        b.setAttribute('role', 'tab');
        b.onclick = () => select(b, false);
        b.onkeydown = (e) => {
          const i = buttons.indexOf(b);
          const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
          if (step) { e.preventDefault(); select(buttons[(i + step + buttons.length) % buttons.length], true); }
        };
      });
      const initial = buttons.find((b) => b.dataset.tab === new URLSearchParams(location.search).get('tab')) || buttons.find((b) => b.classList.contains('on')) || buttons[0];
      select(initial, false);
    });
  }
  function wireSwitches(root = document) {
    root.querySelectorAll('.switch').forEach((s) => {
      s.setAttribute('role', 'switch');
      if (!s.hasAttribute('aria-checked')) s.setAttribute('aria-checked', 'false');
      s.onclick = () => {
        const next = s.getAttribute('aria-checked') !== 'true';
        s.setAttribute('aria-checked', String(next));
        s.dispatchEvent(new CustomEvent('toggle', { detail: next, bubbles: true }));
        if (s.dataset.say) iDeskDropdown.notice(`${s.dataset.say} ${next ? 'diaktifkan' : 'dinonaktifkan'} · hanya di halaman ini, tidak disimpan ke server.`);
      };
    });
  }
  // Buttons/links marked data-demo explain what they would do instead of faking success.
  function wireDemo(root = document) {
    root.querySelectorAll('[data-demo]').forEach((el) => {
      el.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); iDeskDropdown.notice(el.dataset.demo || 'Aksi contoh — belum dihubungkan ke backend.'); });
    });
  }
  function skeletonList(host, rows) {
    host.innerHTML = Array.from({ length: rows }, () => '<div class="li" aria-hidden="true"><i class="sk w30" style="width:32px;height:32px;border-radius:10px"></i><div class="grow1" style="display:grid;gap:6px"><i class="sk w60"></i><i class="sk w40"></i></div></div>').join('');
  }
  // Mount: shell + session note + icons + shared wiring. html is a string of page markup.
  function mount(html) {
    iDeskShell(html);
    const main = document.querySelector('main');
    if (main) iDeskMock.sessionNote(main);
    wireTabs(); wireSwitches(); wireDemo(); wireTips();
    lucide.createIcons();
    document.querySelectorAll('.seg').forEach((s) => window.iDeskMotion && iDeskMotion.wireSeg(s));
  }
  window.iDeskPages = { ic, caret, av, hue, bub, columns, lines, donut, hbars, wireTabs, wireSwitches, wireDemo, skeletonList, mount };
})();
