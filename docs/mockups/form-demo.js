// Form adapter: local fields and validation, never creates a server ticket.
(function () {
  'use strict';
  const D = iDeskDropdown, M = iDeskMock;
  const title = document.getElementById('s'), body = document.getElementById('d');
  const TITLE_LIMIT = 200, BODY_LIMIT = 5000;
  let state = { category: '', device: 'Tidak ada', app: 'Tidak ada', requester: 'Saya sendiri', urgency: document.querySelectorAll('.seg.full')[1].querySelector('.on').textContent.trim() };
  title.maxLength = TITLE_LIMIT; body.maxLength = BODY_LIMIT; title.required = body.required = true;
  function count() {
    document.querySelector('label[for="s"] small').textContent = `${title.value.length} / ${TITLE_LIMIT}`;
    document.querySelector('label[for="d"] small').textContent = `${body.value.length} / ${BODY_LIMIT}`;
    document.querySelector('.saved').textContent = 'Draf lokal · tidak disimpan';
  }
  title.addEventListener('input', count); body.addEventListener('input', count);
  const pickers = [
    ['category', 'Pilih kategori', M.categories], ['device', 'Pilih perangkat', M.devices, 'Cari perangkat…'],
    ['app', 'Pilih aplikasi', M.apps, 'Cari aplikasi…'],
  ];
  document.querySelectorAll('.cols3 .pop').forEach((button, index) => {
    const [key, label, options, search] = pickers[index]; button.id = 'form-' + key;
    D.bind(button, { title: label, options, value: () => state[key], search, onSelect: (value) => {
      state = { ...state, [key]: value }; button.querySelector('.v').textContent = value;
      button.querySelector('.v').classList.remove('muted'); count();
    } });
  });
  const requesterInput = D.node('div', 'requester-demo'); requesterInput.hidden = true;
  const requesterLabel = D.node('label', '', 'Nama pemohon contoh'), name = D.node('input', 'input');
  name.id = 'requester-name'; name.maxLength = 120; name.placeholder = 'Nama orang yang dibantu'; requesterLabel.htmlFor = name.id;
  requesterInput.append(requesterLabel, name); document.querySelector('.seg.full').after(requesterInput);
  document.querySelectorAll('.seg.full').forEach((seg, index) => {
    seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', index === 0 ? 'Pemohon' : 'Urgensi');
    seg.querySelectorAll('button').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.classList.contains('on')));
      button.onclick = () => {
        seg.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b === button); b.setAttribute('aria-pressed', String(b === button)); });
        state = { ...state, [index === 0 ? 'requester' : 'urgency']: button.textContent.trim() };
        if (index === 0) { requesterInput.hidden = state.requester !== 'Orang lain'; if (!requesterInput.hidden) name.focus(); }
        count();
      };
    });
  });
  document.querySelectorAll('.templates button').forEach((button) => {
    button.onclick = () => {
      title.value = button.textContent.trim(); body.value = `${title.value}\nLokasi/perangkat: \nSejak kapan: \nPesan error: \nLangkah yang sudah dicoba: `;
      document.querySelectorAll('.templates button').forEach((b) => { b.classList.toggle('on', b === button); b.setAttribute('aria-pressed', String(b === button)); });
      count(); body.focus();
    };
  });
  async function submit() {
    if (!title.value.trim()) { title.setCustomValidity('Isi judul masalah.'); title.reportValidity(); return; }
    title.setCustomValidity('');
    if (!body.value.trim()) { body.setCustomValidity('Isi detail masalah.'); body.reportValidity(); return; }
    body.setCustomValidity('');
    if (state.requester === 'Orang lain' && !name.value.trim()) { name.required = true; name.reportValidity(); return; }
    const requester = state.requester === 'Orang lain' ? name.value.trim() : 'Anda';
    await D.confirm({
      title: 'Pratinjau pengiriman · prototype',
      description: `“${title.value.trim()}” untuk ${requester}. Urgensi: ${state.urgency}. Kategori: ${state.category || 'Belum dipilih'}. Perangkat: ${state.device}. Aplikasi: ${state.app}. Ini hanya konfirmasi demo; tidak ada tiket dibuat atau data dikirim.`,
      confirmLabel: 'Mengerti · tidak dikirim',
    });
  }
  title.addEventListener('input', () => title.setCustomValidity(''));
  body.addEventListener('input', () => body.setCustomValidity(''));
  document.querySelector('.submit-bar .primary').onclick = submit;
  document.querySelector('.submit-bar .plain').onclick = async () => {
    const ok = await D.confirm({ title: 'Kosongkan draf lokal?', description: 'Hanya judul, detail, dan nama pemohon di halaman ini yang dikosongkan.', confirmLabel: 'Kosongkan' });
    if (ok) { title.value = ''; body.value = ''; name.value = ''; count(); }
  };
  document.querySelector('.tbar button').onclick = () => D.notice('Lampiran hanya tampilan contoh; tidak ada file yang diunggah.');
  document.querySelector('.tbar > span:first-of-type').textContent = 'Lampiran belum dihubungkan pada prototype';
  addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter' && !document.querySelector('dialog[open]')) { event.preventDefault(); submit(); }
  });
  M.sessionNote(document.querySelector('.form-wrap')); count();
})();
