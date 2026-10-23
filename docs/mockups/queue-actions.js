// Row/card actions and the bulk action bar shared by list.html (Tabel) and kanban.html.
// Edits go through iDeskQueue (immutable records); nothing leaves the page.
(function () {
  'use strict';
  const D = iDeskDropdown, M = iDeskMock, A = iDeskActions, Q = iDeskQueue;
  const ic = Q.ic;
  const editable = (r) => !M.isTerminal(r.s);
  const byId = (id) => Q.records().find((r) => r.id === id);

  // ---------- Per-record actions ----------
  function rowActionsHtml(r) {
    const quick = editable(r) ? `<button class="btn icon ok" data-row-act="resolve" data-hint="Tandai selesai" aria-label="Tandai selesai #${Q.displayId(r)}">${ic('circle-check')}</button>` : '';
    return `<span class="row-acts">${quick}<button class="btn icon" data-row-act="more" id="more-${r.id}" data-hint="Aksi lainnya" aria-label="Aksi lainnya #${Q.displayId(r)}">${ic('ellipsis')}</button></span>`;
  }
  function hwLinkHtml(r) {
    return r.hw ? `<button class="hw-link" data-row-act="hw" data-hint="Buka Hardware Request ${r.hw}" aria-label="Terkait Hardware Request ${r.hw}">${ic('monitor-smartphone')}Hardware</button>` : '';
  }
  async function quickResolve(r) {
    if (!editable(r)) return;
    const result = await A.resolveDialog(r);
    if (!result) return;
    Q.commit({ ...r, s: 'RESOLVED' });
    D.notice(`#${Q.displayId(r)} ditandai selesai (contoh) oleh ${M.ACTOR}.`);
  }
  function openHardware(r) { location.href = `hardware.html?highlight=${encodeURIComponent(r.hw)}`; }
  // selection: optional { isOn(id), toggle(id) } so the menu can offer select on touch, where the checkbox is hidden
  function bindRecordMenu(button, r, selection) {
    if (!button) return;
    D.bind(button, {
      title: `Aksi #${Q.displayId(r)}`, actions: true,
      options: () => [
        { value: 'open', label: 'Buka tiket', icon: 'arrow-up-right' },
        ...(editable(r) ? [{ value: 'resolve', label: 'Tandai selesai', icon: 'circle-check', detail: 'Isi catatan solusi' }] : []),
        ...(r.hw ? [{ value: 'hw', label: 'Buka Hardware Request', icon: 'monitor-smartphone', detail: r.hw }] : []),
        { value: 'copy', label: 'Salin nomor tiket', icon: 'copy' },
        ...(selection ? [{ value: 'select', label: selection.isOn(r.id) ? 'Batal pilih' : 'Pilih untuk aksi massal', icon: 'list-checks' }] : []),
      ],
      onSelect: (value) => {
        const current = byId(r.id) || r;
        if (value === 'open') location.href = 'ticket.html';
        else if (value === 'resolve') quickResolve(current);
        else if (value === 'hw') openHardware(current);
        else if (value === 'copy') A.copyText('#' + Q.displayId(current), `Nomor tiket #${Q.displayId(current)} disalin.`);
        else if (value === 'select') selection.toggle(r.id);
      },
    });
    button.setAttribute('aria-label', `Aksi lainnya #${Q.displayId(r)}`);
  }
  // Wires [data-row-act] inside a row/card element.
  function bindRecordActions(root, r, selection) {
    bindRecordMenu(root.querySelector('[data-row-act="more"]'), r, selection);
    const quick = root.querySelector('[data-row-act="resolve"]');
    if (quick) quick.onclick = (e) => { e.stopPropagation(); quickResolve(byId(r.id) || r); };
    const hw = root.querySelector('[data-row-act="hw"]');
    if (hw) hw.onclick = (e) => { e.stopPropagation(); openHardware(r); };
  }

  // ---------- Bulk bar ----------
  const BULK_HTML = `
  <div class="bulk-bar" id="bulkBar" role="toolbar" aria-label="Aksi massal" hidden>
    <span class="bulk-count" aria-live="polite"><b id="bulkCount">0</b><span>tiket dipilih</span></span>
    <span class="act-sep" aria-hidden="true"></span>
    <button class="btn" id="bulk-status" data-hint="Ubah status">${ic('circle-dot')}<span>Status</span>${Q.caret}</button>
    <button class="btn" id="bulk-priority" data-hint="Ubah prioritas">${ic('flag')}<span>Prioritas</span>${Q.caret}</button>
    <button class="btn" id="bulk-pic" data-hint="Tetapkan PIC">${ic('user-round-plus')}<span>PIC</span>${Q.caret}</button>
    <button class="btn" id="bulk-merge" data-hint="Gabungkan tiket terpilih menjadi 1 tiket">${ic('git-merge')}<span>Gabungkan</span></button>
    <span class="act-sep" aria-hidden="true"></span>
    <button class="btn danger" id="bulk-delete" data-hint="Hapus tiket terpilih">${ic('trash-2')}<span>Hapus</span></button>
    <button class="btn icon ghost" id="bulk-clear" data-hint="Batal pilih" data-kbd="Esc">${ic('x')}</button>
  </div>`;

  function mountBulk({ getSelected, setSelected }) {
    const bar = document.getElementById('bulkBar');
    const picked = () => Q.records().filter((r) => getSelected().has(r.id));
    const done = (n, what) => D.notice(`${n} tiket contoh ${what} oleh ${M.ACTOR}. Hanya di halaman ini.`);
    function apply(patchFn, label) {
      const ids = getSelected(), skipped = picked().filter((r) => !editable(r)).length;
      let changed = 0;
      Q.update((rows) => rows.map((r) => { if (!ids.has(r.id) || !editable(r)) return r; changed += 1; return { ...r, ...patchFn(r) }; }));
      done(changed, label + (skipped ? ` · ${skipped} tiket terminal dilewati` : ''));
    }
    async function withReason(title, description, confirmLabel) {
      return D.confirm({ title, description, reason: true, confirmLabel });
    }
    D.bind(document.getElementById('bulk-status'), {
      title: 'Ubah status', options: M.editableStatuses,
      onSelect: async (value) => {
        if (value === 'RESOLVED') {
          const result = await A.resolveDialog({ id: `${getSelected().size} tiket`, t: 'aksi massal' });
          if (result) apply(() => ({ s: 'RESOLVED' }), 'di-resolve');
          return;
        }
        const takeover = value === 'IN_PROGRESS' && picked().some((r) => editable(r) && r.pic && r.pic !== M.ACTOR);
        if (takeover && (await withReason('Ambil & mulai tiket', `Memulai tiket milik PIC lain akan mengalihkan PIC kepada ${M.ACTOR}.`, 'Ambil & mulai')) === null) return;
        apply((r) => ({ s: value, ...(value === 'IN_PROGRESS' && (takeover || !r.pic) ? { pic: M.ACTOR } : {}) }), 'diperbarui');
      },
    });
    D.bind(document.getElementById('bulk-priority'), { title: 'Ubah prioritas', options: M.priorities, onSelect: (value) => apply(() => ({ p: value }), 'diubah prioritasnya') });
    D.bind(document.getElementById('bulk-pic'), {
      title: 'Tetapkan PIC', options: M.pics, search: 'Cari PIC…',
      onSelect: async (value) => {
        if ((await withReason('Konfirmasi perubahan PIC', `${getSelected().size} tiket → ${value}. Pelaku demo: ${M.ACTOR}.`, 'Tetapkan PIC')) === null) return;
        apply(() => ({ pic: value }), `ditetapkan ke ${value}`);
      },
    });
    document.getElementById('bulk-merge').onclick = async () => {
      const rows = picked();
      if (rows.length < 2) { D.notice('Pilih minimal 2 tiket untuk digabungkan.'); return; }
      let read = null;
      const primary = await D.confirm({
        title: `Gabungkan ${rows.length} tiket`, description: 'Pesan dan lampiran tiket lain dipindahkan ke tiket utama; tiket lain ditutup sebagai bagian dari tiket utama.',
        confirmLabel: `Gabungkan ${rows.length} tiket`, cancelLabel: 'Kembali', busyLabel: 'Menggabungkan…',
        body: (form) => { read = A.choiceField(form, { legend: 'Tiket utama', name: 'primary', options: rows.map((r) => ({ value: r.id, label: '#' + Q.displayId(r), detail: r.t })) }); return read; },
      });
      if (!primary) return;
      const ids = getSelected();
      Q.update((all) => all.map((r) => (ids.has(r.id) && r.id !== primary ? { ...r, s: 'CLOSED', t: `${r.t} (digabung ke #${primary})` } : r)));
      setSelected(new Set());
      D.notice(`Contoh: ${rows.length - 1} tiket digabung ke #${primary}.`);
    };
    document.getElementById('bulk-delete').onclick = async () => {
      const n = getSelected().size;
      const ok = await D.confirm({ title: `Hapus ${n} tiket?`, description: 'Tiket terhapus permanen beserta pesan dan lampirannya. Tindakan ini tidak dapat dibatalkan.', confirmLabel: `Hapus ${n} tiket`, cancelLabel: 'Kembali', danger: true, busyLabel: 'Menghapus…' });
      if (!ok) return;
      const ids = getSelected();
      Q.update((all) => all.filter((r) => !ids.has(r.id)));
      setSelected(new Set());
      D.notice(`${n} tiket contoh dihapus dari halaman ini. Reload mengembalikan sampel.`);
    };
    document.getElementById('bulk-clear').onclick = () => { setSelected(new Set()); document.querySelector('.row[tabindex="0"], .kcard')?.focus(); };
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && getSelected().size && !document.querySelector('dialog[open], .dd-popover')) setSelected(new Set());
    });
    A.nameIcons(bar);
    return function paintBulk() {
      const n = getSelected().size;
      const wasHidden = bar.hidden;
      bar.hidden = n === 0;
      document.getElementById('bulkCount').textContent = String(n);
      document.getElementById('bulk-merge').disabled = n < 2;
      document.getElementById('bulk-merge').dataset.hint = n < 2 ? 'Pilih minimal 2 tiket untuk digabungkan' : 'Gabungkan tiket terpilih menjadi 1 tiket';
      if (wasHidden && n) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = ''; }
    };
  }

  window.iDeskQueueActions = { rowActionsHtml, hwLinkHtml, bindRecordActions, quickResolve, BULK_HTML, mountBulk };
})();
