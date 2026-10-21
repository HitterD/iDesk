// Shared agent queue for list.html (Tabel) and kanban.html (Kanban): sample records, queue header,
// counters, filters and the view toggle. Each page supplies only its body renderer.
(function () {
  'use strict';
  const QUEUES = {
    'it-support': { title: 'IT Support Tickets', icon: 'ticket', c: 'var(--blue)', sub: 'Antrian IT Support untuk semua site Anda', prefix: '' },
    oracle: { title: 'Oracle K2 Request', icon: 'database', c: 'var(--red)', sub: 'ERP, database, dan workflow K2', prefix: 'ORA' },
    web: { title: 'Web Developer Request', icon: 'code-xml', c: 'var(--teal)', sub: 'Bug, fitur, dan integrasi web portal', prefix: 'WEB' },
    mobile: { title: 'Mobile Developer Request', icon: 'smartphone', c: 'var(--sea)', sub: 'Aplikasi mobile, APK, dan notifikasi', prefix: 'MOB' },
  };
  const params = new URLSearchParams(location.search);
  const key = Object.hasOwn(QUEUES, params.get('queue')) ? params.get('queue') : 'it-support';
  const Q = QUEUES[key];
  const STATS = [
    { key: 'all', name: 'Total', icon: 'layers', c: 'var(--gray)' },
    { key: 'TODO', name: 'Open', icon: 'inbox', c: 'var(--blue)' },
    { key: 'IN_PROGRESS', name: 'In Progress', icon: 'circle-dot', c: 'var(--navy)' },
    { key: 'WAITING_VENDOR', name: 'Waiting Vendor', icon: 'hourglass', c: 'var(--orange)', ink: 'var(--ink-orange)', attn: true },
    { key: 'DONE', name: 'Resolved', icon: 'circle-check', c: 'var(--green)' },
    { key: 'overdue', name: 'Overdue', icon: 'triangle-alert', c: 'var(--red)', ink: 'var(--ink-red)', attn: true },
    { key: 'critical', name: 'Critical', icon: 'flame', c: 'var(--pink)', ink: 'var(--ink-red)', attn: true },
  ];
  const STATUS = { CANCELLED: ['Cancelled', 'var(--red)'], TODO: ['Open', 'var(--blue)'], IN_PROGRESS: ['In Progress', 'var(--navy)'], WAITING_VENDOR: ['Waiting Vendor', 'var(--orange)'], RESOLVED: ['Resolved', 'var(--green)'], CLOSED: ['Closed', 'var(--gray)'] };
  const PRI = { LOW: ['Low', 'var(--gray)'], MEDIUM: ['Normal', 'var(--blue)'], HIGH: ['Urgent', 'var(--orange)'], CRITICAL: ['Blocker', 'var(--red)'] };
  const SITES = ['SPJ', 'SMG', 'JTB', 'SPJ', 'SPJ', 'JTB', 'SPJ', 'SMG', 'SPJ', 'JTB'];
  // Synthetic sample data
  let records = [
    { id: '201026-HC-0003', t: 'Wifi di PC tidak muncul', p: 'MEDIUM', s: 'WAITING_VENDOR', req: ['Merda Della Sovira', 'HC Development · Pusat'], pic: 'RM Bagastyo Anggoro', sla: { paused: '5j 20m', used: 38 }, d: '20 Okt' },
    { id: '201026-OPE-0001', t: 'E-KALOSI error saat login', p: 'MEDIUM', s: 'IN_PROGRESS', req: ['Tjan Siauw Hwa', 'Operation'], pic: 'Alphin Santoso H.', sla: { left: '2h 14j', used: 22 }, d: '20 Okt' },
    { id: '191026-GA-0002', t: 'Email tidak bisa diakses', p: 'HIGH', s: 'IN_PROGRESS', req: ['Yanuar Ari Widodo', 'GA Management · Sepanjang'], pic: 'Alphin Santoso H.', sla: { left: '1h 11j', used: 64 }, d: '19 Okt' },
    { id: '181026-PRO-0009', t: 'Printer label gudang mati total', p: 'CRITICAL', s: 'IN_PROGRESS', req: ['Nur Ayni', 'Production 1'], pic: 'Beny Saputra', sla: { over: '1j 40m' }, d: '18 Okt', overdue: true },
    { id: '191026-LEA-0018', t: 'Kamera laptop HR57 tidak bisa digunakan saat zoom', p: 'MEDIUM', s: 'IN_PROGRESS', req: ['Shanon Maria', 'Learning & Engagement'], pic: 'Yudi Arta Trirensila', sla: { left: '2h 14j', used: 18 }, d: '19 Okt' },
    { id: '191026-QC-0009', t: 'Kebutuhan kabel type A to B', p: 'MEDIUM', s: 'TODO', req: ['Yusuf Wijaya', 'QC AB Reguler'], pic: null, sla: { left: '2h 8j', used: 6 }, d: '19 Okt', src: 'via iPop' },
    { id: '141026-HSE-0026', t: 'Kendala UPS ruang server HSE', p: 'LOW', s: 'WAITING_VENDOR', req: ['Agung Permadhi', 'HSE · Sepanjang'], pic: 'Alphin Santoso H.', sla: { paused: '1h 3j', used: 52 }, d: '14 Okt' },
    { id: '131026-FIN-0007', t: 'Permintaan printer pengganti yang rusak', p: 'HIGH', s: 'WAITING_VENDOR', req: ['Maria Yuliani Br Purba', 'Finance'], pic: 'Alphin Santoso H.', sla: { paused: '40m', used: 91 }, d: '13 Okt', hw: 'HR-2026-014' },
    { id: '191026-PRO-0015', t: 'Komputer factory 32 not responding', p: 'HIGH', s: 'RESOLVED', req: ['Nur Ayni', 'Production 1'], pic: 'Beny Saputra', sla: { done: true }, d: '19 Okt' },
    { id: '011026-PRO-0017', t: 'Excel tidak berfungsi', p: 'CRITICAL', s: 'CLOSED', req: ['Dwi Esti Ariyanti', 'Production 1'], pic: 'Yudi Arta Trirensila', sla: { done: true }, d: '01 Okt' },
  ].map((r, i) => ({ ...r, site: SITES[i] }));
  const HUES = ['var(--pink)', 'var(--blue)', 'var(--orange)', 'var(--teal)', 'var(--green)', 'var(--navy)', 'var(--red)', 'var(--brown)'];
  const DONE = ['RESOLVED', 'CLOSED'], ACTIVE = ['TODO', 'IN_PROGRESS', 'WAITING_VENDOR'];
  const SKELETON_MS = 520;
  const ic = (n) => `<i data-lucide="${n}"></i>`;
  const caret = '<i data-lucide="chevron-down" class="caret"></i>';
  const hue = (n) => HUES[[...n].reduce((a, ch) => a + ch.charCodeAt(0), 0) % HUES.length];
  const av = (n, cls = '') => `<span class="avatar ${cls}" style="--c:${hue(n)}">${initials(n)}</span>`;
  const displayId = (r) => (Q.prefix ? r.id.replace(/-[A-Z]+-/, `-${Q.prefix}-`) : r.id);
  let state = { filter: 'all', priority: 'all', site: 'all', scope: 'all' };
  let page = { body: () => {}, skeleton: null };

  function slaBub(r) {
    if (iDeskMock.isTerminal(r.s)) return `<span class="bub" style="--c:var(--green);--ink:var(--ink-green)">${ic('circle-check')}Selesai</span>`;
    if (r.s === 'WAITING_VENDOR') return `<span class="bub" style="--c:var(--orange);--ink:var(--ink-orange)">${ic('pause')}Dijeda · sisa ${r.sla.paused || r.sla.left || 'contoh'}</span>`;
    if (r.sla.over) return `<span class="bub" style="--c:var(--red);--ink:var(--ink-red)">${ic('triangle-alert')}Lewat ${r.sla.over}</span>`;
    const warn = r.sla.used > 55;
    return `<span class="bub mono" style="--c:${warn ? 'var(--orange)' : 'var(--blue)'};--ink:${warn ? 'var(--ink-orange)' : 'var(--text-2)'}">${ic('timer')}${r.sla.left || r.sla.paused || '5j 20m · contoh'}</span>`;
  }
  function priParts(r) {
    const active = ACTIVE.includes(r.s);
    const ink = r.p === 'CRITICAL' ? 'var(--ink-red)' : r.p === 'HIGH' ? 'var(--ink-orange)' : 'var(--text-2)';
    const icon = r.p === 'CRITICAL' && active ? ic('flame') : r.p === 'HIGH' || r.p === 'CRITICAL' ? ic('triangle-alert') : '<span class="dot"></span>';
    return { label: PRI[r.p][0], color: PRI[r.p][1], ink, icon };
  }
  function matchesStat(r, filter) {
    if (filter === 'all') return true;
    if (filter === 'DONE') return DONE.includes(r.s);
    if (filter === 'overdue') return r.overdue && ['TODO', 'IN_PROGRESS'].includes(r.s);
    if (filter === 'critical') return r.p === 'CRITICAL' && ACTIVE.includes(r.s);
    return r.s === filter;
  }
  function visible() {
    const q = document.getElementById('q').value.trim().toLowerCase();
    return records.filter((r) => matchesStat(r, state.filter)
      && (state.priority === 'all' || r.p === state.priority)
      && (state.site === 'all' || r.site === state.site)
      && (state.scope === 'all' || (state.scope === 'mine' && r.pic === iDeskMock.ACTOR))
      && (!q || (r.t + r.id + r.req[0]).toLowerCase().includes(q)));
  }
  function renderStats() {
    document.getElementById('stats').innerHTML = STATS.map((s) => {
      const n = records.filter((r) => matchesStat(r, s.key)).length;
      const on = state.filter === s.key;
      const cls = ['stat', s.attn && n > 0 ? 'attn' : '', n === 0 ? 'zero' : '', on ? 'on' : ''].join(' ');
      return `<button class="${cls}" style="--c:${s.c};--ink:${s.ink || 'var(--text)'}" data-key="${s.key}" aria-pressed="${on}">
      <span class="top"><span class="ic">${ic(s.icon)}</span><span class="n">${n}</span></span><span class="name">${s.name}</span></button>`;
    }).join('');
  }
  function paintFilters() {
    const stat = STATS.find((x) => x.key === state.filter);
    document.getElementById('statusLabel').textContent = state.filter === 'all' ? 'Semua' : stat ? stat.name : STATUS[state.filter][0];
    document.querySelector('#filter-priority .v').textContent = state.priority === 'all' ? 'Semua' : PRI[state.priority][0];
    document.querySelector('#filter-site .v').textContent = state.site === 'all' ? 'Semua' : state.site;
    const searching = document.getElementById('q').value.trim() !== '';
    const chips = document.getElementById('chips');
    chips.replaceChildren();
    if (searching || Object.values(state).some((v) => v !== 'all')) {
      const chip = iDeskDropdown.node('button', 'chip', 'Reset filter');
      chip.dataset.clear = ''; chips.append(chip);
    }
    document.querySelectorAll('.head .seg.scope button').forEach((b) => b.classList.toggle('on', b.dataset.scope === state.scope));
  }
  function render() {
    renderStats();
    page.body(visible());
    paintFilters();
    lucide.createIcons();
  }
  const set = (patch) => { state = { ...state, ...patch }; render(); };
  function viewHref(file) {
    const next = new URLSearchParams();
    if (params.has('queue')) next.set('queue', key);
    if (params.has('theme')) next.set('theme', params.get('theme'));
    const qs = next.toString();
    return file + (qs ? `?${qs}` : '');
  }
  function viewToggle(view) {
    const link = (file, name, icon, label) => `<a href="${viewHref(file)}" class="${view === name ? 'on' : ''}" aria-label="Tampilan ${label}"${view === name ? ' aria-current="page"' : ''}>${ic(icon)}<span>${label}</span></a>`;
    return `<div class="seg view" role="group" aria-label="Tampilan" data-seg-key="queue-view">${link('kanban.html', 'kanban', 'columns-3', 'Kanban')}${link('list.html', 'list', 'rows-3', 'Tabel')}</div>`;
  }
  function frame(view, body) {
    const scope = [['all', 'Semua'], ['mine', 'Tugas Saya'], ['created', 'Saya Buat']].map(([v, l]) => `<button data-scope="${v}" class="${v === 'all' ? 'on' : ''}">${l}</button>`).join('');
    return `
<main class="content ${view}-view">
  <div class="head">
    <span class="tile ptile" style="--c:${Q.c}">${ic(Q.icon)}</span>
    <div><h2>${Q.title}</h2><p>${Q.sub}</p></div>
    <span class="spacer"></span>
    <div class="seg scope" role="group" aria-label="Cakupan">${scope}</div>
    ${viewToggle(view)}
  </div>
  <section class="stats" id="stats" aria-label="Ringkasan status"></section>
  <div class="filters">
    <label class="field">${ic('search')}<input id="q" placeholder="Cari judul, nomor tiket, atau pemohon" aria-label="Cari tiket"></label>
    <button class="pop" id="filter-status"><span class="k">Status</span><span class="v" id="statusLabel">Semua</span>${caret}</button>
    <button class="pop" id="filter-priority"><span class="k">Prioritas</span><span class="v">Semua</span>${caret}</button>
    <button class="pop" id="filter-site"><span class="k">Site</span><span class="v">Semua</span>${caret}</button>
    <button class="pop icon-pop" id="refresh-sample" aria-label="Muat ulang">${ic('refresh-cw')}</button>
    <span id="chips" style="display:contents"></span>
  </div>
  ${body}
</main>`;
  }
  function refresh() {
    if (!page.skeleton) { render(); return; }
    page.skeleton();
    setTimeout(() => { render(); iDeskDropdown.notice('Tampilan contoh diperbarui. Tidak ada pengambilan data server.'); }, SKELETON_MS);
  }
  function wire() {
    document.getElementById('stats').addEventListener('click', (e) => {
      const b = e.target.closest('.stat'); if (!b) return;
      set({ filter: state.filter === b.dataset.key && b.dataset.key !== 'all' ? 'all' : b.dataset.key });
    });
    document.getElementById('chips').addEventListener('click', (e) => {
      if (!e.target.closest('[data-clear]')) return;
      document.getElementById('q').value = '';
      set({ filter: 'all', priority: 'all', site: 'all', scope: 'all' });
    });
    document.getElementById('q').addEventListener('input', render);
    const all = { value: 'all', label: 'Semua' };
    iDeskDropdown.bind(document.getElementById('filter-status'), { title: 'Filter status', options: [all, ...iDeskMock.statuses], value: () => state.filter, onSelect: (v) => set({ filter: v }) });
    iDeskDropdown.bind(document.getElementById('filter-priority'), { title: 'Filter prioritas', options: [all, ...iDeskMock.priorities], value: () => state.priority, onSelect: (v) => set({ priority: v }) });
    iDeskDropdown.bind(document.getElementById('filter-site'), { title: 'Filter site', options: [all, ...iDeskMock.choices(['SPJ', 'SMG', 'JTB'])], value: () => state.site, onSelect: (v) => set({ site: v }) });
    document.getElementById('refresh-sample').onclick = refresh;
    document.querySelectorAll('.head .seg.scope button').forEach((button) => {
      button.onclick = () => {
        set({ scope: button.dataset.scope });
        if (state.scope === 'created') iDeskDropdown.notice('Tidak ada tiket sampel yang dibuat actor demo.');
      };
    });
  }
  // view: 'list' | 'kanban'; body: static HTML below the filters; onRender(rows) paints it; skeleton() paints a loading state.
  function mount({ view, body, onRender, skeleton }) {
    document.body.dataset.page = key;
    document.body.dataset.title = Q.title;
    page = { body: onRender, skeleton: skeleton || null };
    iDeskShell(frame(view, body));
    wire();
    iDeskMock.sessionNote(document.querySelector('main'));
    render();
  }
  window.iDeskQueue = {
    Q, STATUS, PRI, ACTIVE, DONE, ic, caret, av, hue, displayId, slaBub, priParts, mount, render,
    records: () => records,
    count: () => records.length,
    update: (fn) => { records = fn(records); render(); },
    commit: (updated) => { records = records.map((r) => (r.id === updated.id ? updated : r)); render(); },
  };
})();
