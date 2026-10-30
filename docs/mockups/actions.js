// Shared action system for the ticket list, Kanban and detail mockups: hint tooltips with keyboard
// hints, a grid picker (reactions, stickers), dialog field helpers, the resolve dialog and copy.
// No network, upload or persistence. User text is always written with textContent/value.
(function () {
  'use strict';
  const D = iDeskDropdown;
  const HINT_DELAY_MS = 380, HINT_GAP = 8, EDGE = 8;
  const MIN_NOTE = 3, MAX_FILES = 5;
  const SAMPLE_FILES = ['foto-printer-marketing.jpg', 'hasil-tes-cetak.pdf', 'nota-vendor.png'];

  // ---------- Hint tooltip: [data-hint] (+ optional [data-kbd]); pointer after a short delay, keyboard focus at once ----------
  let tip = null, timer = 0, owner = null;
  function tipNode() {
    if (tip) return tip;
    tip = D.node('div', 'act-tip'); tip.setAttribute('role', 'tooltip'); tip.id = 'act-tip'; tip.hidden = true;
    document.body.append(tip); return tip;
  }
  function showHint(el) {
    const node = tipNode(), text = el.dataset.hint;
    if (!text || !el.isConnected) return;
    node.replaceChildren(D.node('span', '', text));
    if (el.dataset.kbd) node.append(D.node('kbd', '', el.dataset.kbd));
    node.hidden = false; owner = el; el.setAttribute('aria-describedby', node.id);
    const r = el.getBoundingClientRect(), w = node.offsetWidth, h = node.offsetHeight;
    const above = r.top - h - HINT_GAP >= EDGE;
    node.style.left = `${Math.max(EDGE, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - EDGE))}px`;
    node.style.top = `${above ? r.top - h - HINT_GAP : r.bottom + HINT_GAP}px`;
  }
  function hideHint() {
    clearTimeout(timer);
    if (owner) owner.removeAttribute('aria-describedby');
    owner = null; if (tip) tip.hidden = true;
  }
  function wireHints() {
    document.addEventListener('pointerover', (e) => {
      const el = e.target.closest?.('[data-hint]');
      if (el === owner) return;
      hideHint();
      if (el && e.pointerType !== 'touch') timer = setTimeout(() => showHint(el), HINT_DELAY_MS);
    });
    document.addEventListener('focusin', (e) => {
      const el = e.target.closest?.('[data-hint]');
      hideHint(); if (el && el.matches(':focus-visible')) showHint(el);
    });
    ['pointerdown', 'focusout'].forEach((type) => document.addEventListener(type, hideHint));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideHint(); });
    addEventListener('scroll', hideHint, true);
  }
  // Icon-only controls get their accessible name from the hint unless they already have one.
  function nameIcons(root = document) {
    root.querySelectorAll('[data-hint]').forEach((el) => { if (!el.hasAttribute('aria-label') && !el.textContent.trim()) el.setAttribute('aria-label', el.dataset.hint); });
  }

  // ---------- Grid picker: emoji reactions and stickers, body-mounted, arrow keys, Escape, outside click ----------
  let picker = null;
  function closePicker(focus = true) {
    if (!picker) return;
    const { pop, trigger } = picker; picker = null; pop.remove();
    trigger.setAttribute('aria-expanded', 'false');
    if (focus && trigger.isConnected) trigger.focus({ preventScroll: true });
  }
  function placePicker(pop, trigger) {
    const r = trigger.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    const above = r.top - h - HINT_GAP >= EDGE;
    pop.style.left = `${Math.max(EDGE, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - EDGE))}px`;
    pop.style.top = `${above ? r.top - h - HINT_GAP : Math.min(r.bottom + HINT_GAP, innerHeight - h - EDGE)}px`;
    pop.style.transformOrigin = `${Math.round(r.left + r.width / 2 - parseFloat(pop.style.left))}px ${above ? '100%' : '0'}`;
  }
  function pickerKeys(event, items, columns) {
    const i = items.indexOf(document.activeElement);
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: columns, ArrowUp: -columns }[event.key];
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closePicker(); }
    else if (event.key === 'Tab') closePicker(false);
    else if (step && i >= 0) { event.preventDefault(); items[Math.max(0, Math.min(items.length - 1, i + step))].focus(); }
  }
  // items: [{ value, glyph, label, on? }]
  function openPicker(trigger, { title, items, columns = 4, onPick, cls = '' }) {
    if (picker?.trigger === trigger) { closePicker(); return; }
    closePicker(false); D.close(false);
    const pop = D.node('div', `dd-popover grid-pop ${cls}`.trim());
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', title);
    pop.style.setProperty('--cols', columns);
    pop.append(D.node('div', 'dd-heading', title));
    const grid = D.node('div', 'grid-pop-items');
    const buttons = items.map((item) => {
      const b = D.node('button', item.on ? 'on' : '', item.glyph);
      b.type = 'button'; b.setAttribute('aria-label', item.label); b.title = item.label;
      if (item.on !== undefined) b.setAttribute('aria-pressed', String(!!item.on));
      b.onclick = () => { closePicker(); onPick(item.value); };
      return b;
    });
    grid.append(...buttons); pop.append(grid);
    pop.addEventListener('keydown', (e) => pickerKeys(e, buttons, columns));
    document.body.append(pop); placePicker(pop, trigger);
    trigger.setAttribute('aria-expanded', 'true');
    picker = { pop, trigger }; buttons[0].focus();
  }
  document.addEventListener('pointerdown', (e) => { if (picker && !picker.pop.contains(e.target) && !picker.trigger.contains(e.target)) closePicker(false); });
  addEventListener('resize', () => closePicker(false));

  // ---------- Dialog field helpers (used with iDeskDropdown.confirm({ body })) ----------
  function textField(form, { label, placeholder, required = true, rows = 3 }) {
    const wrap = D.node('label', 'demo-reason', label), input = D.node('textarea');
    input.rows = rows; input.maxLength = 1000; input.placeholder = placeholder; input.required = required;
    input.oninput = () => input.setCustomValidity('');
    wrap.append(input); form.append(wrap);
    return () => {
      const value = input.value.trim();
      if (required && value.length < MIN_NOTE) { input.setCustomValidity(`Tulis minimal ${MIN_NOTE} karakter.`); input.reportValidity(); return null; }
      return value;
    };
  }
  // options: [{ value, label, detail? }]; returns () => selected value
  function choiceField(form, { legend, name, options, value }) {
    const set = D.node('fieldset', 'dlg-choices'); set.append(D.node('legend', '', legend));
    options.forEach((opt, i) => {
      const label = D.node('label', 'dlg-choice'), input = D.node('input');
      input.type = 'radio'; input.name = name; input.value = opt.value;
      input.checked = value ? opt.value === value : i === 0;
      if (input.checked) input.dataset.autofocus = '';
      const copy = D.node('span', 'dlg-choice-copy'); copy.append(D.node('b', '', opt.label));
      if (opt.detail) copy.append(D.node('small', '', opt.detail));
      label.append(input, copy); set.append(label);
    });
    form.append(set);
    return () => set.querySelector('input:checked').value;
  }
  // Sample evidence chips; names are fixed sample strings, nothing is uploaded.
  function evidenceField(form) {
    const wrap = D.node('div', 'dlg-files'), list = D.node('div', 'file-chips'), add = D.node('button', 'btn ghost');
    let files = [];
    add.type = 'button';
    const paint = () => {
      list.replaceChildren(...files.map((name) => {
        const chip = D.node('span', 'file-chip'); chip.append(D.icon('paperclip'), D.node('span', 'v', name));
        const x = D.node('button', 'file-x'); x.type = 'button'; x.setAttribute('aria-label', `Hapus lampiran ${name}`); x.append(D.icon('x'));
        x.onclick = () => { files = files.filter((f) => f !== name); paint(); add.focus(); };
        chip.append(x); return chip;
      }));
      add.replaceChildren(D.icon('paperclip'), D.node('span', '', `Lampirkan bukti (${files.length}/${MAX_FILES})`));
      add.disabled = files.length >= MAX_FILES || files.length >= SAMPLE_FILES.length;
      window.lucide?.createIcons();
    };
    add.onclick = () => { const next = SAMPLE_FILES.find((f) => !files.includes(f)); if (next) { files = [...files, next]; paint(); } };
    wrap.append(add, list); form.append(wrap); paint();
    return () => files;
  }

  // ---------- Resolve: note (required) + sample evidence; resolves to { note, files } or null ----------
  function resolveDialog(record) {
    let readNote = null, readFiles = null;
    return D.confirm({
      title: 'Selesaikan tiket',
      description: `#${record.id} · ${record.t || 'Tiket contoh'}. Pemohon menerima ringkasan solusi ini.`,
      confirmLabel: 'Resolve tiket', cancelLabel: 'Kembali', busyLabel: 'Menyelesaikan…',
      body: (form) => {
        readNote = textField(form, { label: 'Tindakan & penjelasan solusi', placeholder: 'Jelaskan tindakan teknis atau solusi yang dilakukan…', rows: 4 });
        readFiles = evidenceField(form);
        return () => { const note = readNote(); return note === null ? null : { note, files: readFiles() }; };
      },
    });
  }

  async function copyText(text, done) {
    try {
      await navigator.clipboard.writeText(text);
      D.notice(done);
    } catch (error) {
      D.notice(`Tidak bisa menyalin otomatis (${error.name}). Salin manual: ${text}`);
    }
  }

  function init() { wireHints(); nameIcons(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  window.iDeskActions = { showHint, hideHint, nameIcons, openPicker, closePicker, textField, choiceField, resolveDialog, copyText, MAX_FILES };
})();
