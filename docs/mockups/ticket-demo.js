// Detail-page interaction adapter. Historical messages and SLA times are sample content.
(function () {
  'use strict';
  const D = iDeskDropdown, M = iDeskMock, A = iDeskActions;
  const user = isUser();
  const TICKET_NO = '201026-FGW-0009';
  const TEAMS = [
    { value: 'OPS_SUPPORT', label: 'IT Support / Ops Support', detail: 'Infrastruktur, perangkat, jaringan' },
    { value: 'ORACLE_DEV', label: 'Oracle / K2 Developer', detail: 'ERP, database, workflow K2' },
    { value: 'WEB_DEV', label: 'Web Developer Team', detail: 'Web portal, frontend, integrasi' },
    { value: 'MOBILE_DEV', label: 'Mobile Developer Team', detail: 'Aplikasi iOS / Android' },
  ];
  const EXTEND = [{ value: '7', label: '1 Minggu' }, { value: '14', label: '2 Minggu' }, { value: '30', label: '1 Bulan' }];
  const REMIND = [{ value: '1 jam lagi', label: '1 jam lagi' }, { value: 'Besok, 09.00', label: 'Besok, 09.00' }, { value: 'Kamis, 22 Okt · 08.00', label: 'Kamis, 22 Okt · 08.00', detail: 'Sebelum kunjungan vendor' }];
  const MEMBERS = [{ value: 'Merda Della Sovira', label: 'Merda Della Sovira', detail: 'HC Development' }, { value: 'Yanuar Ari Widodo', label: 'Yanuar Ari Widodo', detail: 'GA Management' }, { value: 'Maria Yuliani Br Purba', label: 'Maria Yuliani Br Purba', detail: 'Finance' }];
  let record = { id: TICKET_NO, t: 'Servis printer marketing', s: 'WAITING_VENDOR', p: 'HIGH', pic: 'Alphin Santoso H.', category: 'General', device: 'Tidak ada' };
  let members = ['Nofie Kristihina Kullau'];
  const props = [...document.querySelectorAll('.inspector .prop button')];
  const headerBadges = document.querySelectorAll('.convo-head .line1:first-child > .bub');
  const $ = (sel) => document.querySelector(sel);
  const say = (text) => window.iDeskChat?.system(`Demo: ${text} · oleh ${user ? 'Anda' : M.ACTOR}`);

  function paintBadge(el, option) {
    el.replaceChildren(D.node('span', 'dot'), D.node('span', 'v', option.label));
    el.style.setProperty('--c', option.color);
    if (option.ink) el.style.setProperty('--ink', option.ink); else el.style.removeProperty('--ink');
  }
  function commit(updated, reason) {
    const previous = record; record = updated;
    if (reason) say(`PIC ${previous.pic} → ${record.pic} · Alasan: ${reason}`);
    paint();
  }
  function paint() {
    const status = M.statuses.find((opt) => opt.value === record.s);
    const priority = M.priorities.find((opt) => opt.value === record.p);
    paintBadge(headerBadges[0], status); paintBadge(headerBadges[2], priority);
    const slaLabel = M.isTerminal(record.s) ? 'Selesai · contoh' : record.s === 'WAITING_VENDOR' ? (user ? 'Menunggu vendor' : 'SLA dijeda · sisa 5j 20m') : 'SLA aktif · sisa 5j 20m';
    headerBadges[1].textContent = slaLabel;
    $('.inspector .sla-big b').textContent = slaLabel;
    const locked = M.isTerminal(record.s);
    document.querySelectorAll('[data-terminal-lock], .inspector .actions button, #addMember').forEach((b) => { b.disabled = locked; if (locked) b.dataset.hint = 'Tiket terminal — hanya baca'; });
    if (locked) {
      const statusProp = $('.inspector .readonly .bub');
      if (statusProp) paintBadge(statusProp, status);
    }
    if (user) return;
    const fields = [
      ['pic', M.pics, 'Cari PIC…'], ['s', M.editableStatuses], ['p', M.priorities],
      ['category', M.categories], ['device', M.devices, 'Cari perangkat…'],
    ];
    fields.forEach(([key, options, search], index) => {
      const button = props[index]; button.id = 'inspector-' + key;
      button.querySelector('.v').textContent = options.find((opt) => opt.value === record[key])?.label || record[key];
      if (key === 'pic') button.querySelector('.avatar').textContent = initials(record.pic);
      const opt = options.find((o) => o.value === record[key]); const color = opt?.color;
      if (color) { button.style.setProperty('--c', color); if (opt.ink) button.style.setProperty('--ink', opt.ink); else button.style.removeProperty('--ink'); }
      M.bindEditor(button, record, key, options, commit, search);
    });
  }

  // ---------- Header actions ----------
  async function resolve() {
    const result = await A.resolveDialog(record);
    if (!result) return;
    record = { ...record, s: 'RESOLVED' }; paint();
    say(`Tiket di-resolve · ${result.note}${result.files.length ? ` · ${result.files.length} lampiran` : ''}`);
    D.notice('Tiket contoh di-resolve. Pemohon tidak benar-benar menerima email.');
  }
  async function selfResolve() {
    const ok = await D.confirm({ title: 'Masalah sudah selesai?', description: `Tiket #${TICKET_NO} akan ditutup. Anda bisa membuat tiket baru jika kendala muncul lagi.`, confirmLabel: 'Ya, tutup tiket', cancelLabel: 'Belum', busyLabel: 'Menutup…' });
    if (!ok) return;
    record = { ...record, s: 'CLOSED' }; paint();
    say('Pemohon menandai masalah selesai'); D.notice('Tiket contoh ditutup. Tidak ada perubahan di server.');
  }
  async function cancel() {
    let read = null;
    const reason = await D.confirm({
      title: 'Batalkan tiket ini?', description: `Tiket #${TICKET_NO} yang dibatalkan tidak dapat diproses kembali.`,
      confirmLabel: 'Batalkan tiket', cancelLabel: 'Kembali', danger: true, busyLabel: 'Membatalkan…',
      body: (form) => { read = A.textField(form, { label: 'Alasan pembatalan', placeholder: user ? 'Contoh: kendala sudah teratasi sendiri' : 'Contoh: tiket duplikat dari #201026-FGW-0008' }); return read; },
    });
    if (reason === null) return;
    record = { ...record, s: 'CANCELLED' }; paint();
    say(`Tiket dibatalkan · Alasan: ${reason}`); D.notice('Tiket contoh dibatalkan; properti sekarang hanya baca.');
  }
  async function forward() {
    let team = null, note = null;
    const result = await D.confirm({
      title: 'Teruskan ke tim lain', description: `#${TICKET_NO} · ${record.t}. Tiket pindah antrian dan PIC dikosongkan.`,
      confirmLabel: 'Teruskan tiket', cancelLabel: 'Kembali', busyLabel: 'Meneruskan…',
      body: (form) => {
        team = A.choiceField(form, { legend: 'Tim tujuan', name: 'team', options: TEAMS.slice(1) });
        note = A.textField(form, { label: 'Catatan untuk tim tujuan', placeholder: 'Jelaskan konteks agar tim tujuan tidak perlu bertanya ulang…', rows: 3 });
        return () => { const n = note(); return n === null ? null : { team: team(), note: n }; };
      },
    });
    if (!result) return;
    const label = TEAMS.find((t) => t.value === result.team).label;
    say(`Diteruskan ke ${label} · ${result.note}`); D.notice(`Contoh: tiket diteruskan ke ${label}. Tidak ada perpindahan antrian nyata.`);
  }
  function togglePanel() {
    const detail = $('.detail'), btn = $('#togglePanel');
    const hidden = detail.classList.toggle('no-inspector');
    btn.setAttribute('aria-pressed', String(!hidden));
    btn.dataset.hint = hidden ? 'Tampilkan properti' : 'Sembunyikan properti';
    btn.setAttribute('aria-label', btn.dataset.hint);
    btn.innerHTML = `<i data-lucide="${hidden ? 'panel-right-open' : 'panel-right-close'}"></i>`;
    lucide.createIcons(); A.showHint(btn);
  }
  const HANDLERS = { resolve, 'self-resolve': selfResolve, cancel, forward };
  function wireHeader() {
    document.querySelectorAll('.convo-head [data-act]').forEach((b) => {
      const fn = HANDLERS[b.dataset.act];
      if (fn) b.onclick = fn;
    });
    $('[data-act="copy-id"]').onclick = () => A.copyText('#' + TICKET_NO, `Nomor tiket #${TICKET_NO} disalin.`);
    $('#togglePanel').onclick = togglePanel;
    const more = $('[data-act="more"]'); more.id = 'head-more';
    D.bind(more, {
      title: 'Aksi lainnya', actions: true,
      options: () => [
        ...(user ? [] : [{ value: 'forward', label: 'Teruskan ke tim lain', icon: 'forward' }]),
        { value: 'copy', label: 'Salin nomor tiket', icon: 'copy' },
        { value: 'cancel', label: 'Batalkan tiket', icon: 'circle-x', tone: 'danger', detail: 'Perlu konfirmasi' },
      ],
      onSelect: (value) => (value === 'copy' ? A.copyText('#' + TICKET_NO, `Nomor tiket #${TICKET_NO} disalin.`) : HANDLERS[value]()),
    });
  }

  // ---------- Inspector actions ----------
  async function pickDialog({ title, description, legend, name, options, confirmLabel }) {
    let read = null;
    return D.confirm({ title, description, confirmLabel, cancelLabel: 'Kembali', body: (form) => { read = A.choiceField(form, { legend, name, options }); return read; } });
  }
  function wireInspector() {
    const extend = $('[data-act="extend-sla"]'), remind = $('[data-act="reminder"]');
    if (extend) extend.onclick = async () => {
      const days = await pickDialog({ title: 'Perpanjang SLA', description: `#${TICKET_NO}: tambahkan waktu target penyelesaian. Perpanjangan dicatat di aktivitas.`, legend: 'Tambahan waktu', name: 'extend', options: EXTEND, confirmLabel: 'Perpanjang' });
      if (!days) return;
      const label = EXTEND.find((o) => o.value === days).label;
      say(`SLA diperpanjang ${label}`); D.notice(`Contoh: SLA diperpanjang ${label}. Waktu SLA tetap ilustrasi.`);
    };
    if (remind) remind.onclick = async () => {
      const when = await pickDialog({ title: 'Set reminder', description: 'Anda akan diingatkan untuk menindaklanjuti tiket ini.', legend: 'Ingatkan saya', name: 'remind', options: REMIND, confirmLabel: 'Simpan reminder' });
      if (!when) return;
      const chip = $('#reminderChip'); chip.hidden = false; chip.querySelector('span').textContent = `Reminder: ${when} (contoh)`;
      D.notice(`Reminder contoh disetel: ${when}. Tidak ada notifikasi nyata.`);
    };
    const add = $('#addMember');
    D.bind(add, {
      title: 'Tambah anggota tiket', actions: true, search: 'Cari nama…',
      options: () => MEMBERS.filter((m) => !members.includes(m.value)).map((m) => ({ ...m, icon: 'user-plus' })),
      onSelect: (value) => {
        members = [...members, value];
        const row = D.node('div', 'person'), av = D.node('span', 'avatar', initials(value)), copy = D.node('div');
        av.style.setProperty('--c', 'var(--teal)'); copy.append(D.node('b', '', value), D.node('small', '', 'Anggota · ditambahkan (contoh)'));
        row.append(av, copy); $('#members').append(row);
        $('#memberCount').textContent = String(members.length);
        say(`${value} ditambahkan sebagai anggota`);
      },
    });
    add.setAttribute('aria-label', 'Tambah anggota tiket');
  }

  M.sessionNote($('.detail'));
  wireHeader(); wireInspector();
  document.querySelectorAll('.convo-head .seg button').forEach((button) => {
    button.onclick = () => D.notice('Percakapan dan aktivitas yang terlihat adalah sampel; penggantian tab belum dihubungkan.');
  });
  paint();
  A.nameIcons();
})();
