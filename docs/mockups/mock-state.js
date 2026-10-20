// Shared sample vocabulary and guarded, immutable edits. State lasts until reload.
(function () {
  'use strict';
  const ACTOR = 'RM Bagastyo Anggoro';
  const TERMINAL = ['RESOLVED', 'CLOSED', 'CANCELLED'];
  const statuses = [
    ['TODO', 'Open', 'var(--blue)'], ['IN_PROGRESS', 'In Progress', 'var(--navy)'],
    ['WAITING_VENDOR', 'Waiting Vendor', 'var(--orange)'], ['RESOLVED', 'Resolved', 'var(--green)'],
    ['CLOSED', 'Closed', 'var(--gray)'], ['CANCELLED', 'Cancelled', 'var(--red)'],
  ].map(([value, label, color]) => ({ value, label, color }));
  const priorities = [
    ['LOW', 'Low', 'var(--gray)'], ['MEDIUM', 'Normal', 'var(--blue)'],
    ['HIGH', 'Urgent', 'var(--orange)'], ['CRITICAL', 'Blocker', 'var(--red)'],
  ].map(([value, label, color]) => ({ value, label, color }));
  const choices = (values) => values.map((value) => ({ value, label: value }));
  const pics = choices([ACTOR, 'Alphin Santoso H.', 'Beny Saputra', 'Yudi Arta Trirensila']);
  const categories = choices(['General', 'Hardware', 'Software', 'Jaringan', 'Akses']);
  const devices = choices(['Tidak ada', 'Printer Marketing 40', 'Printer Marketing 41', 'Laptop HR57', 'PC Factory 32']);
  const apps = choices(['Tidak ada', 'Oracle', 'K2', 'E-KALOSI', 'Microsoft 365', 'iDesk']);
  const isTerminal = (status) => TERMINAL.includes(status);
  async function change(record, key, value, commit) {
    if (isTerminal(record.s) || record[key] === value) return;
    let patch = { [key]: value }, reason = null;
    const takeover = key === 's' && value === 'IN_PROGRESS' && record.pic && record.pic !== ACTOR;
    if (key === 'pic' || takeover) {
      const target = takeover ? ACTOR : value;
      reason = await iDeskDropdown.confirm({
        title: 'Konfirmasi perubahan PIC',
        description: `${record.id}: ${record.pic || 'Belum ditetapkan'} → ${target}. ${takeover ? 'Memulai tiket ini akan mengalihkan PIC kepada Anda. ' : ''}Pelaku demo: ${ACTOR}.`,
        reason: true, confirmLabel: takeover ? 'Ambil & mulai tiket' : 'Ubah PIC contoh',
      });
      if (reason === null) return;
      patch = { ...patch, pic: target };
    } else if (key === 's' && value === 'IN_PROGRESS' && !record.pic) patch = { ...patch, pic: ACTOR };
    commit({ ...record, ...patch }, reason);
    iDeskDropdown.notice(`Contoh diperbarui oleh ${ACTOR}. Hanya di halaman ini sampai dimuat ulang.`);
  }
  function bindEditor(button, record, key, options, commit, search) {
    if (!button) return;
    button.disabled = isTerminal(record.s);
    if (button.disabled) {
      button.title = 'Tiket terminal — hanya baca'; button.removeAttribute('aria-haspopup');
      button.removeAttribute('aria-expanded'); button.onclick = null; return;
    }
    iDeskDropdown.bind(button, {
      title: `Ubah ${key === 's' ? 'status' : key === 'p' ? 'prioritas' : key === 'pic' ? 'PIC' : key}`,
      options, value: record[key], search, onSelect: async (value) => { await change(record, key, value, commit); const current = document.getElementById(button.id); if (current && !current.disabled) current.focus({ preventScroll: true }); else if (current) { const fallback = current.closest('.row') || document.querySelector('.convo-head h2'); if (fallback) { fallback.tabIndex = -1; fallback.focus({ preventScroll: true }); } } },
    });
  }
  function sessionNote(container) {
    const note = iDeskDropdown.node('p', 'demo-session', 'Prototype interaktif · data contoh hanya di halaman ini; reload mengembalikan sampel. Tidak ada koneksi backend.');
    container.prepend(note);
    document.querySelectorAll('.live').forEach((badge) => { badge.textContent = 'Demo'; badge.title = 'Data contoh, bukan koneksi live'; });
  }
  window.iDeskMock = { ACTOR, TERMINAL, statuses, editableStatuses: statuses.slice(0, 4), priorities, pics, categories, devices, apps, choices, isTerminal, change, bindEditor, sessionNote };
})();
