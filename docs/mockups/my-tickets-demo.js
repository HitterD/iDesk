// Requester list filters combine with search and local page-size selection.
(function () {
  'use strict';
  const D = iDeskDropdown;
  const rows = [...document.querySelectorAll('.row.u')];
  const records = rows.map((row, index) => ({ row, record: T[index] }));
  const groups = {
    all: () => true, TODO: (r) => r.s === 'TODO',
    IN_PROGRESS: (r) => ['IN_PROGRESS', 'WAITING_VENDOR'].includes(r.s),
    DONE: (r) => ['RESOLVED', 'CLOSED'].includes(r.s), CANCELLED: (r) => r.s === 'CANCELLED',
  };
  const keys = Object.keys(groups), search = document.querySelector('.filters input');
  const segments = [...document.querySelectorAll('.filters .seg button')], stats = [...document.querySelectorAll('.stat')];
  let filter = 'all', pageSize = 10;
  const empty = D.node('div', 'prototype-empty', 'Tidak ada tiket yang cocok. Coba reset filter atau pencarian.');
  document.querySelector('.table .foot').before(empty);
  const reset = D.node('button', 'chip', 'Reset filter'); document.querySelector('.filters').append(reset);
  reset.onclick = () => { filter = 'all'; search.value = ''; paint(); };
  function paint() {
    const query = search.value.trim().toLocaleLowerCase('id');
    const matches = records.filter(({ record }) => groups[filter](record) && `${record.t} ${record.id}`.toLocaleLowerCase('id').includes(query));
    const visible = matches.slice(0, pageSize);
    records.forEach(({ row }) => { row.hidden = !visible.some((item) => item.row === row); });
    empty.hidden = matches.length > 0;
    reset.hidden = filter === 'all' && !query;
    document.querySelector('.table .foot > span').textContent = `Menampilkan ${visible.length} dari ${matches.length} hasil · ${T.length} tiket contoh`;
    segments.forEach((button, index) => { button.classList.toggle('on', keys[index] === filter); button.setAttribute('aria-pressed', String(keys[index] === filter)); });
    stats.forEach((button, index) => {
      button.classList.toggle('on', keys[index] === filter); button.setAttribute('aria-pressed', String(keys[index] === filter));
      button.querySelector('.n').textContent = T.filter(groups[keys[index]]).length;
    });
  }
  segments.forEach((button, index) => { button.onclick = () => { filter = keys[index]; paint(); }; });
  stats.forEach((button, index) => { button.onclick = () => { filter = keys[index]; paint(); }; });
  stats[2].querySelector('.name').textContent = 'Dalam penanganan';
  segments[2].textContent = 'Dalam penanganan';
  search.addEventListener('input', paint);
  const size = document.querySelector('.foot .pop'); size.id = 'page-size';
  D.bind(size, { title: 'Tiket per halaman', options: [5, 10, 25, 50].map((value) => ({ value, label: String(value) })), value: () => pageSize, onSelect: (value) => {
    pageSize = value; size.querySelector('.v').textContent = String(value); paint();
  } });
  document.querySelector('.head > button').onclick = () => { paint(); D.notice('Tampilan contoh diperbarui; tidak ada panggilan server.'); };
  iDeskMock.sessionNote(document.querySelector('main')); paint();
})();
