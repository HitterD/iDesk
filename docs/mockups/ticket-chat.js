// Chat adapter for ticket.html: message toolbar (reaction, reply, more), reactions, reply/edit context,
// Public Reply / Internal Note, attach + sticker menu, canned replies, drag/paste tray and Send states.
// Sample only: nothing is sent, uploaded or stored. Typed text is written with textContent.
(function () {
  'use strict';
  const D = iDeskDropdown, A = iDeskActions, M = iDeskMock;
  const user = isUser();
  const LONG_PRESS_MS = 450, SEND_MS = 520, EXCERPT = 80;
  const ME = user ? { name: 'Nofie Kristihina Kullau', av: 'NK', c: 'var(--orange)' } : { name: M.ACTOR, av: initials(M.ACTOR), c: 'var(--green)' };
  const REACTIONS = [['👍', 'Setuju'], ['❤️', 'Suka'], ['😂', 'Tertawa'], ['😮', 'Wow'], ['😢', 'Sedih'], ['🎉', 'Rayakan'], ['✅', 'Selesai'], ['👀', 'Sedang dilihat']];
  const STICKERS = ['👍', '👎', '✅', '❌', '🔄', '⚠️', '🎉', '🙏', '🤔', '💡', '🔧', '💻', '📋', '🚀', '⏳', '🛑', '✔️', '📞', '🔍', '📌', '🔒'];
  const CANNED = [
    { value: 'Selamat pagi Bu, tiket sudah kami terima dan sedang kami cek.', label: 'Salam & tiket diterima' },
    { value: 'Mohon kirimkan foto atau screenshot kendalanya agar kami bisa cek lebih cepat.', label: 'Minta screenshot' },
    { value: 'Perangkat sudah dijadwalkan untuk kunjungan vendor hari Kamis. Kami kabari lagi setelah vendor datang.', label: 'Menunggu vendor' },
    { value: 'Kendala sudah kami perbaiki. Mohon dicoba kembali dan konfirmasi jika sudah normal.', label: 'Konfirmasi perbaikan' },
  ].map((c) => ({ ...c, detail: c.value.slice(0, 56) + '…' }));
  const SAMPLE_FILES = ['foto-printer-40.jpg', 'hasil-cetak-41.pdf', 'surat-jalan-scan.png', 'log-printer.txt', 'nota-vendor.pdf'];

  const requester = { name: 'Nofie Kristihina Kullau', av: 'NK', c: 'var(--orange)', role: 'Pemohon' };
  const agent = { name: 'Alphin Santoso H.', av: 'AS', c: 'var(--pink)', role: 'IT Support' };
  let messages = [
    { id: 'm1', by: requester, staff: false, own: user, time: '20 Okt, 10.29', title: 'Servis printer', text: 'Kertas surat jalan sering nyangkut di printer (marketing 40), tulisan putus-putus dan tidak jelas (marketing 41).', reacts: [] },
    { id: 'm2', by: agent, staff: true, own: false, time: '10.55', text: 'Baik Bu, printer akan dicek vendor hari Kamis. Sementara silakan pakai printer marketing 42.', reacts: [{ e: '👍', n: 1, mine: user }] },
    { id: 'm3', by: { name: M.ACTOR, av: initials(M.ACTOR), c: 'var(--green)' }, staff: true, own: true, internal: true, time: '11.02', text: 'Vendor sudah konfirmasi lewat WA, teknisi bawa roller pengganti untuk printer 40.', reacts: [{ e: '👀', n: 1, mine: false }] },
  ].filter((m) => !(user && m.internal));
  let state = { mode: 'public', ctx: null, files: [], sending: false };
  let seq = 3;

  const stream = document.getElementById('stream');
  const composer = document.getElementById('composer');
  const draft = document.getElementById('draft');
  const sendBtn = document.getElementById('sendBtn');
  const tray = document.getElementById('tray');
  const ctxBar = document.getElementById('composeCtx');
  const el = (tag, cls, text) => D.node(tag, cls, text);
  const excerpt = (t) => (t.length > EXCERPT ? t.slice(0, EXCERPT) + '…' : t);
  const find = (id) => messages.find((m) => m.id === id);
  const update = (id, patch) => { messages = messages.map((m) => (m.id === id ? { ...m, ...patch } : m)); };
  // The viewer's side sits right: the requester's own messages in the portal, staff messages in the agent view.
  const isOutgoing = (m) => (user ? !m.staff : m.staff);

  // ---------- Render ----------
  function who(m) {
    const line = el('div', 'who'), name = el('b', '', m.own ? (user ? 'Anda' : m.by.name) : m.by.name);
    const time = el('span', '', m.time);
    const parts = [name];
    if (!m.own && m.by.role && (user ? m.staff : !m.staff)) parts.push(el('span', 'badge', m.by.role));
    if (m.internal) { const lock = el('span', 'lock-badge'); lock.append(D.icon('lock'), el('span', '', 'Internal')); parts.push(lock); }
    parts.push(time);
    if (m.edited) parts.push(el('span', 'edited', 'diedit'));
    line.append(...(isOutgoing(m) ? parts.reverse() : parts));
    return line;
  }
  function bubble(m) {
    const b = el('div', 'bubble');
    if (m.deleted) { b.classList.add('deleted'); b.textContent = 'Pesan ini telah dihapus'; return b; }
    if (m.sticker) { b.classList.add('sticker'); b.textContent = m.sticker; b.setAttribute('role', 'img'); b.setAttribute('aria-label', 'Sticker ' + m.sticker); return b; }
    if (m.quote) { const q = el('div', 'quote'); q.append(el('b', '', m.quote.name), el('span', '', m.quote.text)); b.append(q); }
    if (m.title) { const p = el('p'); p.append(el('b', '', m.title)); b.append(p); }
    if (m.text) b.append(el('p', '', m.text));
    if (m.files?.length) {
      const files = el('div', 'files');
      m.files.forEach((f) => { const chip = el('span', 'file-chip'); chip.append(D.icon('paperclip'), el('span', 'v', f)); files.append(chip); });
      b.append(files);
    }
    return b;
  }
  function toolButton(kind, icon, hint) {
    const b = el('button'); b.type = 'button'; b.dataset.mt = kind; b.dataset.hint = hint; b.setAttribute('aria-label', hint);
    b.append(D.icon(icon)); return b;
  }
  function tools(m) {
    const bar = el('div', 'msg-tools'); bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Aksi pesan');
    const react = toolButton('react', 'smile-plus', 'Tambah reaksi'); react.setAttribute('aria-haspopup', 'dialog'); react.setAttribute('aria-expanded', 'false');
    const more = toolButton('more', 'ellipsis', 'Aksi lainnya'); more.id = `more-${m.id}`;
    bar.append(react, toolButton('reply', 'reply', 'Balas'), more);
    return bar;
  }
  function reacts(m, popped) {
    const row = el('div', 'reacts'); row.setAttribute('aria-label', 'Reaksi');
    m.reacts.forEach((r) => {
      const label = REACTIONS.find(([e]) => e === r.e)?.[1] || r.e;
      const chip = el('button', `react${r.mine ? ' on' : ''}${popped === r.e ? ' pop' : ''}`);
      chip.type = 'button'; chip.dataset.react = r.e; chip.setAttribute('aria-pressed', String(r.mine));
      chip.setAttribute('aria-label', `${label} · ${r.n} · ${r.mine ? 'hapus reaksi Anda' : 'tambah reaksi'}`);
      chip.append(el('span', '', r.e), el('b', '', String(r.n)));
      row.append(chip);
    });
    return row;
  }
  function messageNode(m, popped) {
    const node = el('div', `msg${isOutgoing(m) ? ' out' : ''}${m.internal ? ' internal' : ''}`);
    node.dataset.msg = m.id;
    const av = el('span', 'avatar', m.by.av); av.style.setProperty('--c', m.by.c);
    const col = el('div'), wrap = el('div', 'bubble-wrap');
    wrap.append(bubble(m));
    if (!m.deleted) wrap.append(tools(m));
    col.append(who(m), wrap, reacts(m, popped));
    node.append(av, col);
    return node;
  }
  function paint(id, popped) {
    const slot = stream.querySelector(`[data-msg="${id}"]`), m = find(id);
    if (!slot || !m) return;
    const node = messageNode(m, popped);
    if (slot.classList.contains('msg')) node.style.animation = 'none';
    slot.replaceWith(node); bindMore(node, m); lucide.createIcons();
  }

  // ---------- Message actions ----------
  function bindMore(node, m) {
    const more = node.querySelector('[data-mt="more"]');
    if (!more) return;
    D.bind(more, {
      title: 'Aksi pesan', actions: true,
      options: () => [
        { value: 'copy', label: 'Salin', icon: 'copy', disabled: !!m.sticker },
        { value: 'reply', label: 'Balas', icon: 'reply' },
        ...(m.own && !m.sticker ? [{ value: 'edit', label: 'Edit', icon: 'pencil' }] : []),
        ...(m.own ? [{ value: 'delete', label: 'Hapus', icon: 'trash-2', tone: 'danger', detail: 'Perlu konfirmasi' }] : []),
      ],
      onSelect: (value) => act(value, find(m.id)),
    });
  }
  async function act(kind, m) {
    if (!m) return;
    if (kind === 'copy') A.copyText(m.text, 'Pesan disalin ke clipboard.');
    else if (kind === 'reply') setCtx({ kind: 'reply', id: m.id, name: m.own && user ? 'Anda' : m.by.name, text: excerpt(m.sticker || m.text) });
    else if (kind === 'edit') { setCtx({ kind: 'edit', id: m.id, name: 'Mengedit pesan', text: excerpt(m.text) }); draft.value = m.text; syncDraft(); }
    else if (kind === 'delete') {
      const ok = await D.confirm({ title: 'Hapus pesan ini?', description: 'Pesan diganti dengan keterangan "Pesan ini telah dihapus" untuk semua peserta.', confirmLabel: 'Hapus pesan', cancelLabel: 'Kembali', danger: true });
      if (!ok) return;
      update(m.id, { deleted: true, reacts: [] }); paint(m.id);
      if (state.ctx?.id === m.id) setCtx(null);
      D.notice('Pesan contoh dihapus. Tidak ada perubahan di server.');
    }
  }
  function toggleReaction(id, emoji) {
    const m = find(id); if (!m) return;
    const has = m.reacts.find((r) => r.e === emoji);
    const next = !has ? [...m.reacts, { e: emoji, n: 1, mine: true }]
      : m.reacts.map((r) => (r.e === emoji ? { ...r, n: r.n + (r.mine ? -1 : 1), mine: !r.mine } : r)).filter((r) => r.n > 0);
    update(id, { reacts: next }); paint(id, emoji);
    const chip = stream.querySelector(`[data-msg="${id}"] [data-react="${emoji}"]`);
    (chip || stream.querySelector(`[data-msg="${id}"] [data-mt="react"]`))?.focus({ preventScroll: true });
  }
  stream.addEventListener('click', (event) => {
    const msg = event.target.closest('.msg[data-msg]'); if (!msg) return;
    const id = msg.dataset.msg, chip = event.target.closest('[data-react]'), tool = event.target.closest('[data-mt]');
    if (chip) toggleReaction(id, chip.dataset.react);
    else if (tool?.dataset.mt === 'reply') act('reply', find(id));
    else if (tool?.dataset.mt === 'react') {
      const m = find(id);
      A.openPicker(tool, { title: 'Tambah reaksi', columns: 4, items: REACTIONS.map(([e, label]) => ({ value: e, glyph: e, label, on: !!m.reacts.find((r) => r.e === e && r.mine) })), onPick: (e) => toggleReaction(id, e) });
    }
  });
  // Touch: long-press a bubble to reveal its toolbar; a tap elsewhere hides it.
  let pressTimer = 0;
  stream.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    const msg = event.target.closest('.msg[data-msg]');
    if (!event.target.closest('.msg-tools')) stream.querySelectorAll('.msg.tools-open').forEach((n) => { if (n !== msg) n.classList.remove('tools-open'); });
    if (!msg || !event.target.closest('.bubble')) return;
    pressTimer = setTimeout(() => msg.classList.add('tools-open'), LONG_PRESS_MS);
  });
  ['pointerup', 'pointercancel', 'pointermove'].forEach((type) => stream.addEventListener(type, () => clearTimeout(pressTimer)));

  // ---------- Composer ----------
  function setCtx(ctx) {
    state = { ...state, ctx };
    ctxBar.hidden = !ctx;
    if (ctx) {
      ctxBar.querySelector('svg, i').outerHTML = `<i data-lucide="${ctx.kind === 'edit' ? 'pencil' : 'reply'}"></i>`;
      const t = ctxBar.querySelector('.t');
      t.replaceChildren(el('b', '', ctx.kind === 'edit' ? ctx.name : `Membalas ${ctx.name}`), document.createTextNode(` · ${ctx.text}`));
      document.getElementById('ctxClear').setAttribute('aria-label', ctx.kind === 'edit' ? 'Batalkan edit' : 'Batalkan balasan');
      lucide.createIcons(); draft.focus();
    }
    syncDraft();
  }
  function paintTray() {
    tray.hidden = state.files.length === 0;
    tray.replaceChildren(...state.files.map((name) => {
      const chip = el('span', 'file-chip'); chip.append(D.icon('paperclip'), el('span', 'v', name));
      const x = el('button', 'file-x'); x.type = 'button'; x.setAttribute('aria-label', `Hapus lampiran ${name}`); x.append(D.icon('x'));
      x.onclick = () => { state = { ...state, files: state.files.filter((f) => f !== name) }; paintTray(); draft.focus(); };
      chip.append(x); return chip;
    }));
    lucide.createIcons(); syncDraft();
  }
  function addFiles(names) {
    const room = A.MAX_FILES - state.files.length;
    const fresh = names.filter((n) => !state.files.includes(n)).slice(0, Math.max(0, room));
    if (fresh.length < names.length) D.notice(`Maksimal ${A.MAX_FILES} lampiran per pesan.`);
    state = { ...state, files: [...state.files, ...fresh] }; paintTray();
  }
  function syncDraft() {
    draft.style.height = 'auto'; draft.style.height = Math.min(draft.scrollHeight, 140) + 'px';
    sendBtn.disabled = state.sending || (!draft.value.trim() && state.files.length === 0);
    const edit = state.ctx?.kind === 'edit';
    sendBtn.dataset.hint = edit ? 'Simpan perubahan' : state.mode === 'internal' ? 'Kirim catatan internal' : 'Kirim';
    sendBtn.setAttribute('aria-label', sendBtn.dataset.hint);
  }
  function setMode(mode) {
    state = { ...state, mode };
    composer.classList.toggle('internal', mode === 'internal');
    document.querySelectorAll('#modeSeg [data-mode]').forEach((b) => { const on = b.dataset.mode === mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
    const note = document.getElementById('modeNote');
    note.innerHTML = mode === 'internal' ? '<i data-lucide="lock"></i><span>Hanya terlihat oleh staf IT</span>' : '<i data-lucide="eye"></i><span>Terlihat oleh pemohon</span>';
    draft.placeholder = mode === 'internal' ? 'Tulis catatan internal untuk staf…' : 'Balas ke pemohon…';
    draft.setAttribute('aria-label', draft.placeholder.replace('…', ''));
    lucide.createIcons(); syncDraft();
  }
  function now() { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`; }
  function append(m) {
    messages = [...messages, m];
    const slot = el('div'); slot.dataset.msg = m.id; stream.append(slot); paint(m.id);
    stream.scrollTo({ top: stream.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  function base() { return { id: `m${++seq}`, by: ME, staff: !user, own: true, internal: !user && state.mode === 'internal', time: now(), reacts: [] }; }
  function send() {
    if (sendBtn.disabled) return;
    const text = draft.value.trim(), files = state.files, ctx = state.ctx;
    state = { ...state, sending: true }; syncDraft();
    sendBtn.replaceChildren(D.icon('loader-circle')); sendBtn.firstChild.classList.add('spin'); sendBtn.setAttribute('aria-busy', 'true'); lucide.createIcons();
    setTimeout(() => {
      if (ctx?.kind === 'edit') { update(ctx.id, { text, edited: true }); paint(ctx.id); }
      else append({ ...base(), text, files, quote: ctx?.kind === 'reply' ? { name: ctx.name, text: ctx.text } : null });
      draft.value = ''; state = { ...state, sending: false, files: [] };
      sendBtn.replaceChildren(D.icon('arrow-up')); sendBtn.removeAttribute('aria-busy');
      paintTray(); setCtx(null); draft.focus();
      D.notice(ctx?.kind === 'edit' ? 'Pesan contoh diperbarui · tidak tersimpan di server.' : state.mode === 'internal' && !user ? 'Catatan internal contoh ditambahkan · hanya staf yang melihat.' : 'Pesan contoh ditambahkan · tidak terkirim ke server.');
    }, SEND_MS);
  }

  draft.addEventListener('input', syncDraft);
  draft.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(); }
    else if (event.key === 'Escape' && state.ctx) { event.preventDefault(); if (state.ctx.kind === 'edit') draft.value = ''; setCtx(null); }
  });
  sendBtn.onclick = send;
  document.getElementById('ctxClear').onclick = () => { if (state.ctx?.kind === 'edit') draft.value = ''; setCtx(null); draft.focus(); };
  document.querySelectorAll('#modeSeg [data-mode]').forEach((b) => { b.onclick = () => setMode(b.dataset.mode); });

  const plus = document.getElementById('plusBtn');
  D.bind(plus, {
    title: 'Lampirkan & sticker', actions: true,
    options: () => [
      { value: 'file', label: 'Lampirkan file', icon: 'paperclip', detail: `${state.files.length}/${A.MAX_FILES} · juga bisa seret atau tempel`, disabled: state.files.length >= A.MAX_FILES },
      { value: 'sticker', label: 'Sticker', icon: 'smile' },
    ],
    onSelect: (value) => {
      if (value === 'file') { addFiles([SAMPLE_FILES.find((f) => !state.files.includes(f))].filter(Boolean)); return; }
      setTimeout(() => A.openPicker(plus, { title: 'Sticker', columns: 7, cls: 'stickers', items: STICKERS.map((s) => ({ value: s, glyph: s, label: 'Sticker ' + s })), onPick: (s) => { append({ ...base(), sticker: s }); D.notice('Sticker contoh ditambahkan · tidak terkirim.'); } }), 0);
    },
  });
  const canned = document.getElementById('cannedBtn');
  if (canned) D.bind(canned, { title: 'Balasan cepat', actions: true, search: 'Cari balasan…', options: CANNED, onSelect: (value) => { draft.value = draft.value ? `${draft.value} ${value}` : value; syncDraft(); setTimeout(() => draft.focus(), 0); } });

  // Drag & paste: file names become sample chips; nothing is read or uploaded.
  const convo = document.querySelector('.convo'), zone = document.getElementById('dropZone');
  let depth = 0;
  const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes('Files');
  convo.addEventListener('dragenter', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth += 1; zone.hidden = false; });
  convo.addEventListener('dragover', (e) => { if (hasFiles(e)) e.preventDefault(); });
  convo.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) zone.hidden = true; });
  convo.addEventListener('drop', (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; zone.hidden = true; addFiles([...e.dataTransfer.files].map((f) => f.name)); });
  draft.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (!files.length) return;
    e.preventDefault(); addFiles(files.map((f, i) => f.name && f.name !== 'image.png' ? f.name : `tempelan-${now().replace('.', '')}-${i + 1}.png`));
  });

  messages.forEach((m) => paint(m.id));
  syncDraft();
  window.iDeskChat = { system: (text) => { const s = el('div', 'sys', text); stream.append(s); stream.scrollTo({ top: stream.scrollHeight }); } };
})();
