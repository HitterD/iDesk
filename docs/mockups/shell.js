// Shared shell for the iDesk redesign mockup: sidebar, toolbar, ⌘K palette, theme.
// Each page sets <body data-page="..." data-crumb="..." data-title="..."> and calls iDeskShell(contentHtml).
(function () {
  const NAV = {
    primary: [
      ['dashboard-me', 'user-round', 'var(--gray)', 'Dashboard Saya'],
      ['dashboard-team', 'layout-grid', 'var(--navy)', 'Dashboard Tim'],
    ],
    request: [
      ['it-support', 'ticket', 'var(--blue)', 'IT Support Tickets', '23', 'list.html?queue=it-support'],
      ['oracle', 'database', 'var(--red)', 'Oracle K2 Request', '4', 'list.html?queue=oracle'],
      ['web', 'code-xml', 'var(--teal)', 'Web Developer Request', '', 'list.html?queue=web'],
      ['mobile', 'smartphone', 'var(--sea)', 'Mobile Developer Request', '', 'list.html?queue=mobile'],
      ['hardware', 'monitor-smartphone', 'var(--orange)', 'Hardware Requests', '2'],
      ['eform', 'file-key-2', 'var(--mint)', 'E-Form Access'],
    ],
    resources: [
      ['zoom', 'video', 'var(--blue)', 'Zoom Calendar'],
      ['kb', 'book-open', 'var(--brown)', 'Knowledge Base'],
    ],
    management: [
      ['workloads', 'gauge', 'var(--navy)', 'Workloads'],
      ['reports', 'chart-column', 'var(--green)', 'Reports'],
      ['notifications', 'bell', 'var(--red)', 'Notifications', '78!'],
      ['renewal', 'calendar-clock', 'var(--orange)', 'Renewal Hub'],
    ],
  };

  const item = ([key, icon, c, label, count, href], active) => {
    const cnt = !count ? '' : count.endsWith('!') ? `<span class="count alert">${count.slice(0, -1)}</span>` : `<span class="count">${count}</span>`;
    return `<a class="item${key === active ? ' active' : ''}" href="${href || '#'}"${key === active ? ' aria-current="page"' : ''}>
      <span class="tile" style="--c:${c}"><i data-lucide="${icon}"></i></span><span class="label">${label}</span>${cnt}</a>`;
  };
  const group = (cls, label, items, active) =>
    `<div class="group ${cls}">${label ? `<div class="group-label">${label}</div>` : ''}${items.map((i) => item(i, active)).join('')}</div>`;

  window.iDeskShell = function (content) {
    const b = document.body.dataset;
    const active = b.page;
    document.body.insertAdjacentHTML('afterbegin', `
<div class="app" id="app">
  <aside class="sidebar" id="sidebar" aria-label="Navigasi utama">
    <div class="brand">
      <img src="../../apps/frontend/public/idesk-icon.png" alt="">
      <div class="brand-text"><b>iDesk</b><small>IT Helpdesk</small></div>
      <button class="collapse-btn" id="collapse" aria-label="Ciutkan sidebar"><i data-lucide="panel-left"></i></button>
    </div>
    <nav class="nav">
      ${group('primary', '', NAV.primary, active)}
      ${group('', 'Request Center', NAV.request, active)}
      ${group('quiet', 'Resources', NAV.resources, active)}
      ${group('quiet', 'Management', NAV.management, active)}
    </nav>
    <div class="side-foot">
      <a class="item" href="#"><span class="tile" style="--c:var(--gray)"><i data-lucide="settings"></i></span><span class="label">Settings</span></a>
      <button class="me" aria-label="Profil RM Bagastyo Anggoro Indra">
        <span class="avatar me-av">RI</span>
        <span class="me-text"><b>RM Bagastyo Anggoro Indra</b><small>Agent Operational</small></span>
        <span class="logout" title="Menu demo"><i data-lucide="chevron-down"></i></span>
      </button>
    </div>
  </aside>
  <div class="drawer-scrim" id="drawerScrim"></div>
  <div class="main">
    <header class="toolbar">
      <button class="icon-btn menu-btn" id="menuBtn" aria-label="Buka menu"><i data-lucide="menu"></i></button>
      <div class="crumbs"><small>${b.crumb || ''}</small><h1>${b.title || ''}${b.live ? ' <span class="live"><i></i>Live</span>' : ''}</h1></div>
      <button class="search" id="openPalette" aria-label="Cari"><i data-lucide="search"></i><span>Cari tiket, artikel, atau menu</span><kbd id="kbdHint">Ctrl K</kbd></button>
      <div class="tb-actions">
        <button class="status-pill" id="availability" title="Status kerja demo"><i></i><span class="availability-label">Online · demo</span><i data-lucide="chevron-down" style="width:13px;height:13px;background:none;opacity:.7"></i></button>
        <a class="btn cta tb-new" href="new.html" title="Buat tiket baru"><i data-lucide="plus"></i><span>Buat Tiket Baru</span></a>
        <button class="icon-btn theme-btn" id="themeBtn" aria-label="Ganti tema"><i data-lucide="moon"></i></button>
        <button class="icon-btn" aria-label="Notifikasi, 2 belum dibaca"><i data-lucide="bell"></i><span class="dot-badge">2</span></button>
      </div>
    </header>
    ${content}
  </div>
</div>
<nav class="tabbar" aria-label="Navigasi bawah">
  <a href="#"><i data-lucide="user-round"></i>Saya</a>
  <a href="list.html" class="${active !== 'new' ? 'on' : ''}"><i data-lucide="ticket"></i>Tiket</a>
  <a href="new.html" class="tab-new"><span class="fab"><i data-lucide="plus"></i></span>Tiket Baru</a>
  <a href="#"><i data-lucide="bell"></i><span class="dot-badge">2</span>Notifikasi</a>
  <button id="tabMore"><i data-lucide="grid-2x2"></i>Lainnya</button>
</nav>
<div class="scrim" id="scrim">
  <div class="palette" role="dialog" aria-label="Pencarian global">
    <div class="q"><i data-lucide="search"></i><input id="pq" placeholder="Cari tiket, artikel, menu, atau perintah"><kbd>Esc</kbd></div>
    <div class="sec"><small>Tiket</small>
      <a class="hit sel" href="ticket.html"><i data-lucide="ticket"></i>Servis printer marketing<small class="mono">#201026-FGW-0009</small></a>
      <a class="hit" href="ticket.html"><i data-lucide="ticket"></i>Email tidak bisa diakses<small class="mono">#191026-GA-0002</small></a>
    </div>
    <div class="sec"><small>Menu</small>
      <a class="hit" href="list.html?queue=oracle"><i data-lucide="database"></i>Oracle K2 Request<small>Request Center</small></a>
      <a class="hit" href="#"><i data-lucide="book-open"></i>Knowledge Base<small>Resources</small></a>
    </div>
    <div class="sec"><small>Perintah</small>
      <a class="hit" href="new.html"><i data-lucide="plus"></i>Buat tiket baru<small>N</small></a>
    </div>
    <div class="hint"><span>↑↓ pilih</span><span>↵ buka</span><span>Esc tutup</span></div>
  </div>
</div>`);

    const root = document.documentElement;
    const params = new URLSearchParams(location.search);
    const stored = params.get('theme') || localStorage.getItem('idesk-mock-theme');
    root.dataset.theme = stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const themeBtn = document.getElementById('themeBtn');
    const paintTheme = () => { themeBtn.innerHTML = `<i data-lucide="${root.dataset.theme === 'dark' ? 'sun' : 'moon'}"></i>`; lucide.createIcons(); };
    themeBtn.onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('idesk-mock-theme', root.dataset.theme); paintTheme(); };

    const app = document.getElementById('app'), side = document.getElementById('sidebar'), dScrim = document.getElementById('drawerScrim');
    document.getElementById('collapse').onclick = () => app.classList.toggle('collapsed');
    const drawer = (open) => { side.classList.toggle('open', open); dScrim.classList.toggle('open', open); };
    document.getElementById('menuBtn').onclick = () => drawer(true);
    document.getElementById('tabMore').onclick = () => drawer(true);
    dScrim.onclick = () => drawer(false);

    const scrim = document.getElementById('scrim');
    const palette = (open) => { scrim.classList.toggle('open', open); if (open) setTimeout(() => document.getElementById('pq').focus(), 20); };
    document.getElementById('openPalette').onclick = () => palette(true);
    scrim.addEventListener('click', (e) => { if (e.target === scrim) palette(false); });
    addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(!scrim.classList.contains('open')); }
      if (e.key === 'Escape') { palette(false); drawer(false); }
    });
    if (/Mac/.test(navigator.platform)) document.getElementById('kbdHint').textContent = '⌘K';
    paintTheme();
    wireDemoMenus(false);
  };

  // Requester portal: no sidebar, a single unified toolbar with the portal's few destinations.
  window.iDeskUserShell = function (content) {
    const active = document.body.dataset.page;
    const tabs = [['my', 'ticket', 'Tiket Saya', 'my-tickets.html'], ['hw', 'monitor-smartphone', 'Hardware', '#'], ['eform', 'file-key-2', 'E-Form Access', '#'], ['zoom', 'video', 'Zoom Calendar', '#'], ['help', 'life-buoy', 'Bantuan', '#']];
    document.body.insertAdjacentHTML('afterbegin', `
<div class="uapp">
  <header class="toolbar utoolbar">
    <a class="ubrand" href="my-tickets.html"><img src="../../apps/frontend/public/idesk-icon.png" alt=""><b>iDesk</b></a>
    <nav class="utabs" aria-label="Navigasi portal">${tabs.map(([k, i, l, h]) => `<a class="${k === active ? 'on' : ''}" href="${h}"${k === active ? ' aria-current="page"' : ''}><i data-lucide="${i}"></i><span>${l}</span></a>`).join('')}</nav>
    <div class="tb-actions">
      <button class="icon-btn" id="openPalette" aria-label="Cari"><i data-lucide="search"></i></button>
      <a class="btn cta tb-new" href="new.html?as=user" title="Buat tiket baru"><i data-lucide="plus"></i><span>Buat Tiket Baru</span></a>
      <button class="icon-btn theme-btn" id="themeBtn" aria-label="Ganti tema"><i data-lucide="moon"></i></button>
      <button class="icon-btn" aria-label="Notifikasi"><i data-lucide="bell"></i><span class="dot-badge">1</span></button>
      <button class="uprofile" aria-label="Akun User SPJ"><span class="avatar" style="--c:var(--pink)">US</span><span class="uprofile-text"><b>User SPJ</b><small>Pemohon</small></span><i data-lucide="chevron-down" class="caret"></i></button>
    </div>
  </header>
  ${content}
</div>
<nav class="tabbar" aria-label="Navigasi bawah">
  <a href="my-tickets.html" class="${active === 'my' ? 'on' : ''}"><i data-lucide="ticket"></i>Tiket</a>
  <a href="#"><i data-lucide="monitor-smartphone"></i>Hardware</a>
  <a href="new.html?as=user" class="tab-new"><span class="fab"><i data-lucide="plus"></i></span>Tiket Baru</a>
  <a href="#"><i data-lucide="bell"></i><span class="dot-badge">1</span>Notifikasi</a>
  <a href="#"><i data-lucide="user-round"></i>Akun</a>
</nav>`);
    const root = document.documentElement;
    const stored = new URLSearchParams(location.search).get('theme') || localStorage.getItem('idesk-mock-theme');
    root.dataset.theme = stored || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const themeBtn = document.getElementById('themeBtn');
    const paint = () => { themeBtn.innerHTML = `<i data-lucide="${root.dataset.theme === 'dark' ? 'sun' : 'moon'}"></i>`; lucide.createIcons(); };
    themeBtn.onclick = () => { root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem('idesk-mock-theme', root.dataset.theme); paint(); };
    paint();
    wireDemoMenus(true);
  };
  function wireDemoMenus(user) {
    const profile = document.querySelector(user ? '.uprofile' : '.me');
    profile.id = 'demo-profile';
    iDeskDropdown.bind(profile, {
      title: 'Profil · navigasi demo', actions: true,
      options: [
        { value: 'theme', label: 'Ganti tema', icon: 'sun-moon' },
        { value: 'agent', label: 'Buka demo agent', icon: 'headset' },
        { value: 'user', label: 'Buka demo pemohon', icon: 'user-round' },
        { value: 'about', label: 'Tentang prototype', icon: 'info', detail: 'Tidak ada login/logout atau perubahan akun nyata' },
      ],
      onSelect: (value) => {
        if (value === 'theme') document.getElementById('themeBtn').click();
        else if (value === 'agent') location.href = 'list.html';
        else if (value === 'user') location.href = 'my-tickets.html';
        else iDeskDropdown.notice('Demo navigasi saja. Tidak ada autentikasi, logout, atau panggilan backend.');
      },
    });
    const status = document.getElementById('availability');
    let availability = 'Online';
    iDeskDropdown.bind(status, {
      title: 'Ketersediaan · demo lokal', value: () => availability,
      options: iDeskMock.choices(['Online', 'Sibuk', 'Tidak tersedia']),
      onSelect: (value) => {
        availability = value; status.querySelector('.availability-label').textContent = value + ' · demo';
        status.querySelector('i').style.background = value === 'Online' ? 'var(--green)' : value === 'Sibuk' ? 'var(--orange)' : 'var(--gray)';
        iDeskDropdown.notice('Status ketersediaan hanya contoh lokal, tidak dikirim ke server.');
      },
    });
    document.querySelectorAll('a[href="#"], button[aria-label^="Notifikasi"]').forEach((el) => {
      el.onclick = (event) => { event.preventDefault(); iDeskDropdown.notice('Navigasi/aksi ini hanya tampilan contoh; belum dihubungkan ke backend.'); };
    });
    if (user) document.getElementById('openPalette').onclick = () => {
      const search = document.querySelector('.filters input');
      if (search) search.focus(); else iDeskDropdown.notice('Pencarian global belum dihubungkan pada halaman demo ini.');
    };
  }
  window.isUser = () => new URLSearchParams(location.search).get('as') === 'user';
  window.mountShell = (content) => (isUser() ? iDeskUserShell : iDeskShell)(content);

  window.initials = (n) => n.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
})();
