// Local-only prototype. Production vocabulary: ResolveTicketModal / TicketForwardDialog.
(() => {
  'use strict';
  const $ = (selector) => document.querySelector(selector);
  const MAX_FILES = 5, MAX_BYTES = 10 * 1024 * 1024;
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
  const TEMPLATES = [
    'Masalah berhasil diperbaiki dan telah dites berjalan normal.',
    'User account berhasil di-unlock dan kredensial telah di-reset.',
    'Konfigurasi sistem & software telah disesuaikan dan berjalan optimal.',
    'Penggantian / perbaikan unit hardware telah selesai dilakukan.',
    'Panduan solusi & verifikasi telah dikonfirmasi bersama user.',
  ];
  const TEAMS = [
    ['OPS_SUPPORT', 'IT Support / Ops Support', 'Tim saat ini · tidak dapat dipilih', 'infra_issue'],
    ['ORACLE_DEV', 'Oracle / K2 Developer', 'Oracle, K2 ERP, dan database.', 'oracle_issue'],
    ['WEB_DEV', 'Web Developer Team', 'Web, portal, dan integrasi.', 'web_issue'],
    ['MOBILE_DEV', 'Mobile Developer Team', 'Aplikasi iOS dan Android.', 'mobile_issue'],
  ];
  const REASONS = [
    ['web_issue', 'Terkait aplikasi Web / Portal / Frontend'],
    ['mobile_issue', 'Terkait aplikasi Mobile (iOS / Android)'],
    ['oracle_issue', 'Terkait aplikasi Oracle / K2'],
    ['infra_issue', 'Masalah infrastruktur / perangkat / IT Support'],
    ['needs_dev', 'Butuh kode / akses developer'], ['misrouted', 'Salah routing awal'], ['other', 'Lainnya'],
  ];
  let files = [], returnTarget = null;
  const themeQuery = new URLSearchParams(location.search).get('theme');
  let dark = themeQuery ? themeQuery === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  function paintTheme() {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    $('#theme').textContent = dark ? 'Tema terang' : 'Tema gelap';
  }
  $('#theme').addEventListener('click', () => { dark = !dark; paintTheme(); });
  paintTheme();
  TEMPLATES.forEach((text) => $('#template').add(new Option(text, text)));
  REASONS.forEach(([value, text]) => $('#reason').add(new Option(text, value)));
  TEAMS.forEach(([value, name, description]) => {
    const label = document.createElement('label'); label.className = 'ta-team';
    const radio = document.createElement('input');
    radio.type = 'radio'; radio.name = 'team'; radio.value = value; radio.required = true;
    radio.disabled = value === 'OPS_SUPPORT'; radio.defaultChecked = value === 'ORACLE_DEV';
    const text = document.createElement('span'), title = document.createElement('b'), detail = document.createElement('small');
    title.textContent = name; detail.textContent = description; text.append(title, detail); label.append(radio, text);
    $('.ta-teams').append(label);
    radio.addEventListener('change', () => { $('#reason').value = TEAMS.find((team) => team[0] === value)[3]; updateReason(); });
  });
  function showError(field, target, message) {
    target.textContent = message; target.hidden = !message;
    field.setAttribute('aria-invalid', String(Boolean(message)));
    if (message) field.focus();
  }
  function updateReason() {
    const required = $('#reason').value === 'other';
    $('#notes').required = required;
    $('#notes-required').textContent = required ? '(wajib untuk Lainnya)' : '(opsional)';
    showError($('#notes'), $('#forward-error'), '');
  }
  $('#reason').addEventListener('change', updateReason);
  $('#template').addEventListener('change', (event) => {
    if (!event.target.value) return;
    $('#solution').value = event.target.value; $('#solution').focus();
    showError($('#solution'), $('#solution-error'), '');
  });
  function renderFiles() {
    $('#file-list').replaceChildren();
    files.forEach((file, index) => {
      const item = document.createElement('li'), name = document.createElement('span'), remove = document.createElement('button');
      name.textContent = file.name; remove.type = 'button'; remove.textContent = 'Hapus';
      remove.setAttribute('aria-label', `Hapus ${file.name}`);
      remove.addEventListener('click', () => {
        files = files.filter((_, position) => position !== index); renderFiles(); $('#attach').focus();
      });
      item.append(name, remove); $('#file-list').append(item);
    });
    $('#attach').disabled = files.length >= MAX_FILES;
  }
  function addFiles(incoming) {
    const errors = [], accepted = [];
    for (const file of incoming) {
      if (files.length + accepted.length >= MAX_FILES) { errors.push('Maksimal 5 file lampiran.'); break; }
      if (file.size > MAX_BYTES) { errors.push(`${file.name}: melebihi 10 MB.`); continue; }
      if (!ALLOWED.includes(file.type)) { errors.push(`${file.name}: format tidak didukung.`); continue; }
      accepted.push(file);
    }
    files = [...files, ...accepted]; renderFiles();
    $('#file-error').textContent = errors.join(' '); $('#file-error').hidden = !errors.length;
  }
  $('#attach').addEventListener('click', () => $('#files').click());
  $('#files').addEventListener('change', (event) => { addFiles([...event.target.files]); event.target.value = ''; });
  $('#solution').addEventListener('paste', (event) => {
    const images = [...event.clipboardData.items].filter((item) => item.kind === 'file' && item.type.startsWith('image/')).map((item) => item.getAsFile()).filter(Boolean);
    if (images.length) { event.preventDefault(); addFiles(images); }
  });
  function openDialog(name, trigger) {
    const dialog = document.getElementById(name);
    returnTarget = trigger; dialog.querySelector('form').reset();
    dialog.querySelectorAll('.ta-error, .ta-preview').forEach((node) => { node.hidden = true; node.textContent = ''; });
    dialog.querySelectorAll('[aria-invalid]').forEach((node) => node.removeAttribute('aria-invalid'));
    if (name === 'resolve') { files = []; renderFiles(); }
    else { $('#reason').value = 'oracle_issue'; updateReason(); }
    document.body.style.overflow = 'hidden'; dialog.showModal();
    (name === 'resolve' ? $('#solution') : $('input[value="ORACLE_DEV"]')).focus();
  }
  document.querySelectorAll('[data-open]').forEach((trigger) => {
    trigger.addEventListener('click', () => openDialog(trigger.dataset.open, trigger));
  });
  document.querySelectorAll('.ta-dialog').forEach((dialog) => {
    dialog.querySelector('[data-cancel]').addEventListener('click', () => dialog.close());
    dialog.addEventListener('close', () => { document.body.style.overflow = ''; returnTarget?.focus(); });
    dialog.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); dialog.querySelector('form').requestSubmit(); }
      if (event.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('button, input, select, textarea')].filter((control) => !control.disabled && control.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    dialog.querySelector('form').addEventListener('submit', (event) => {
      event.preventDefault();
      if (dialog.id === 'resolve') previewResolve(dialog); else previewForward(dialog);
    });
  });
  function preview(dialog, text) {
    const output = dialog.querySelector('.ta-preview');
    output.textContent = `Pratinjau lokal — bukan perubahan tiket.\n${text}\nTidak ada data dikirim atau disimpan.`;
    output.hidden = false; output.focus(); output.scrollIntoView({ block: 'nearest' });
  }
  function previewResolve(dialog) {
    const solution = $('#solution').value.trim();
    showError($('#solution'), $('#solution-error'), solution ? '' : 'Isi solusi sebelum menyelesaikan tiket.');
    if (!solution) return;
    preview(dialog, `Solusi: ${solution}\nLampiran terpilih: ${files.length} file (tidak diunggah).`);
  }
  function previewForward(dialog) {
    const destination = $('input[name="team"]:checked');
    if (!destination || destination.value === 'OPS_SUPPORT') {
      showError($('#reason'), $('#forward-error'), 'Pilih tim tujuan yang berbeda dari tim saat ini.'); return;
    }
    const notes = $('#notes').value.trim(), reason = $('#reason');
    if (!reason.value) { showError(reason, $('#forward-error'), 'Pilih alasan penerusan.'); return; }
    showError($('#notes'), $('#forward-error'), reason.value === 'other' && !notes ? 'Isi catatan untuk alasan Lainnya.' : '');
    if (reason.value === 'other' && !notes) return;
    const team = TEAMS.find((item) => item[0] === destination.value)[1];
    const explanation = reason.value === 'other' ? notes : `${reason.selectedOptions[0].text}${notes ? `: ${notes}` : ''}`;
    preview(dialog, `Tim tujuan: ${team}\nAlasan: ${explanation}`);
  }
  const initial = new URLSearchParams(location.search).get('dialog');
  if (['resolve', 'forward'].includes(initial)) openDialog(initial, $(`[data-open="${initial}"]`));
})();
