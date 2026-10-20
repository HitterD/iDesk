// Detail-page interaction adapter. Historical messages and SLA times are sample content.
(function () {
  'use strict';
  const D = iDeskDropdown, M = iDeskMock;
  const user = isUser();
  let record = { id: '201026-FGW-0009', s: 'WAITING_VENDOR', p: 'HIGH', pic: 'Alphin Santoso H.', category: 'General', device: 'Tidak ada' };
  const props = [...document.querySelectorAll('.inspector .prop button')];
  const headerBadges = document.querySelectorAll('.convo-head .line1:first-child > .bub');
  function paintBadge(el, option) {
    el.replaceChildren(D.node('span', 'dot'), D.node('span', 'v', option.label));
    el.style.setProperty('--c', option.color);
    el.style.removeProperty('--ink');
  }
  function commit(updated, reason) {
    const previous = record; record = updated;
    if (reason) {
      const entry = D.node('div', 'sys');
      entry.textContent = `Demo: PIC ${previous.pic} → ${record.pic} · Alasan: ${reason} · oleh ${M.ACTOR}`;
      document.querySelector('.stream').append(entry);
    }
    paint();
  }
  function paint() {
    const status = M.statuses.find((opt) => opt.value === record.s);
    const priority = M.priorities.find((opt) => opt.value === record.p);
    paintBadge(headerBadges[0], status); paintBadge(headerBadges[2], priority);
    const slaLabel = M.isTerminal(record.s) ? 'Selesai · contoh' : record.s === 'WAITING_VENDOR' ? 'SLA dijeda · sisa 5j 20m' : 'SLA aktif · sisa 5j 20m';
    headerBadges[1].textContent = slaLabel;
    document.querySelector('.inspector .sla-big b').textContent = slaLabel;
    if (user) return;
    const fields = [
      ['pic', M.pics, 'Cari PIC…'], ['s', M.editableStatuses], ['p', M.priorities],
      ['category', M.categories], ['device', M.devices, 'Cari perangkat…'],
    ];
    fields.forEach(([key, options, search], index) => {
      const button = props[index]; button.id = 'inspector-' + key;
      button.querySelector('.v').textContent = options.find((opt) => opt.value === record[key])?.label || record[key];
      if (key === 'pic') button.querySelector('.avatar').textContent = initials(record.pic);
      const color = options.find((opt) => opt.value === record[key])?.color;
      if (color) { button.style.setProperty('--c', color); button.style.removeProperty('--ink'); }
      M.bindEditor(button, record, key, options, commit, search);
    });
    document.querySelectorAll('.convo-head .btn').forEach((button) => { button.disabled = M.isTerminal(record.s); });
  }
  function wireActions() {
    const actions = document.querySelectorAll('.convo-head .line1:nth-child(2) .btn');
    if (user) {
      actions[0].onclick = () => D.notice('Action pemohon hanya tampilan contoh; tidak menutup tiket produksi.');
    } else {
      actions[0].onclick = () => D.notice('Teruskan belum dihubungkan. Gunakan pilihan PIC untuk demo pengalihan dengan alasan.');
      actions[1].onclick = async () => {
        const ok = await D.confirm({ title: 'Batalkan tiket contoh?', description: 'Status sampel menjadi Cancelled dan propertinya hanya baca.', confirmLabel: 'Batalkan contoh' });
        if (ok) M.change(record, 's', 'CANCELLED', commit);
      };
      actions[2].onclick = () => M.change(record, 's', 'RESOLVED', commit);
    }
    document.querySelectorAll('.inspector .actions button, .inspector .act, .composer button').forEach((button) => {
      button.onclick = () => D.notice('Aksi ini hanya tampilan contoh; tidak mengirim pesan, berkas, reminder, atau perubahan SLA.');
    });
    document.querySelectorAll('.convo-head .seg button').forEach((button) => {
      button.onclick = () => D.notice('Percakapan dan aktivitas yang terlihat adalah sampel; penggantian tab belum dihubungkan.');
    });
  }
  M.sessionNote(document.querySelector('.detail'));
  wireActions();
  if (!user) paint();
})();
