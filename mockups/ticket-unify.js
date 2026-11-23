/* Mockup Tiket Terpadu — data dummy, tanpa backend. Semua alur bisa diklik. */
(() => {
'use strict';

/* ============================ ICONS (lucide) ============================ */
const P = {
  ticket:'<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  hw:'<path d="M18 8V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h8"/><path d="M10 19v-3.96M7 19h5"/><rect x="16" y="12" width="6" height="10" rx="2"/>',
  ef:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M10 9H8M16 13H8M16 17H8"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  chev:'<path d="m6 9 6 6 6-6"/>', chevL:'<path d="m15 18-6-6 6-6"/>', chevR:'<path d="m9 18 6-6-6-6"/>',
  plus:'<path d="M5 12h14M12 5v14"/>', plusC:'<circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8"/>',
  moon:'<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  listCheck:'<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
  trend:'<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  inbox:'<path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>',
  circleDot:'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="1"/>',
  hourglass:'<path d="M5 22h14M5 2h14M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2"/>',
  checkC:'<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  flame:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  more:'<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  kanban:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18"/>',
  table:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 9v12"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>', xC:'<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
  back:'<path d="m12 19-7-7 7-7M19 12H5"/>', copy:'<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  fwd:'<path d="M5 12h14M12 5l7 7-7 7"/>', lock:'<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  panel:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>',
  msg:'<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>', history:'<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
  pin:'<path d="M12 17v5M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  wifi:'<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0"/>',
  up:'<path d="m5 12 7-7 7 7M12 19V5"/>', zap:'<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  check:'<path d="M20 6 9 17l-5-5"/>', clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  monitor:'<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  network:'<rect x="16" y="16" width="6" height="6" rx="1"/><rect x="2" y="16" width="6" height="6" rx="1"/><rect x="9" y="2" width="6" height="6" rx="1"/><path d="M5 16v-3a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3M12 12V8"/>',
  laptop:'<path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16"/>',
  keyboard:'<path d="M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10M8 12h.01"/><rect x="2" y="4" width="20" height="16" rx="2"/>',
  package:'<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12M3.29 7 12 12l8.71-5M7.5 4.27l9 5.15"/>',
  truck:'<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2M15 18H9M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  key:'<path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4M21 2l-9.6 9.6"/><circle cx="7.5" cy="15.5" r="5.5"/>',
  pen:'<path d="M12 20h9M16.38 3.62a1 1 0 0 1 3 3L7.37 18.64a2 2 0 0 1-.86.5l-2.87.84a.5.5 0 0 1-.62-.62l.84-2.87a2 2 0 0 1 .5-.86z"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  fileCheck:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4M9 15l2 2 4-4"/>',
  globe:'<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
  usb:'<circle cx="10" cy="7" r="1"/><circle cx="4" cy="20" r="1"/><path d="M4.7 19.3 19 5M21 3l-3 1 2 2ZM9.26 7.68 5 12l2 5M10 14l5 2 3.5-3.5M18 12l1-1 1 1-1 1Z"/>',
  mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  nas:'<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><path d="M6 6h.01M6 18h.01"/>',
  paperclip:'<path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>',
  cal:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  barcode:'<path d="M3 5v14M8 5v14M12 5v14M17 5v14M21 5v14"/>',
  user:'<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  info:'<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  pause:'<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
  printer:'<path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect x="6" y="14" width="12" height="8" rx="1"/>',
  eye:'<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
  dash:'<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
  book:'<path d="M12 7v14M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>',
  video:'<path d="m16 13 5.22 3.48a.5.5 0 0 0 .78-.42V7.87a.5.5 0 0 0-.75-.43L16 10.5"/><rect x="2" y="6" width="14" height="12" rx="2"/>',
  chart:'<path d="M3 3v16a2 2 0 0 0 2 2h16M18 17V9M13 17V5M8 17v-3"/>',
  settings:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  sig:'<path d="m21 17-2.16-1.68a2 2 0 0 0-2.6.12L15 16.6a2 2 0 0 1-2.82 0L11 15.4a2 2 0 0 0-2.83 0L3 20.5"/><path d="M15 3a2.83 2.83 0 1 1 4 4L7.5 18.5 3 20l1.5-4.5z"/>',
  stamp:'<path d="M5 22h14M19.27 13.73A2.5 2.5 0 0 0 17.5 13h-11A2.5 2.5 0 0 0 4 15.5V17a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-1.5c0-.66-.26-1.3-.73-1.77M14 13V8.5C14 7 15 7 15 5a3 3 0 0 0-6 0c0 2 1 2 1 3.5V13"/>',
};
const I = (n, cls = '') => `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || ''}</svg>`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
const $ = (sel, root = document) => root.querySelector(sel);

/* ============================ CONSTANTS ============================ */
const TYPES = {
  it: { label:'IT Support', short:'IT Support', icon:'ticket', cls:'it' },
  hw: { label:'Hardware Request', short:'Hardware', icon:'hw', cls:'hw' },
  ef: { label:'E-Form Request', short:'E-Form', icon:'ef', cls:'ef' },
};
const STATUS = {
  TODO:{ label:'Open', cls:'p-sky', icon:'inbox' },
  IN_PROGRESS:{ label:'In Progress', cls:'p-navy', icon:'circleDot' },
  WAITING_VENDOR:{ label:'Waiting Vendor', cls:'p-amber', icon:'hourglass' },
  RESOLVED:{ label:'Resolved', cls:'p-green', icon:'checkC' },
  CLOSED:{ label:'Closed', cls:'p-neutral', icon:'lock' },
  CANCELLED:{ label:'Cancelled', cls:'p-red', icon:'xC' },
};
const PRIO = {
  LOW:{ label:'Low', cls:'p-neutral', dot:true }, MEDIUM:{ label:'Normal', cls:'p-navy', dot:true },
  HIGH:{ label:'Urgent', cls:'p-amber', icon:'alert' }, CRITICAL:{ label:'Blocker', cls:'p-red', icon:'flame' },
};
const ROUTES = {
  none:{ label:'Tanpa persetujuan', desc:'Langsung diproses IT (mis. stok tersedia, akses folder standar)' },
  mgr:{ label:'Atasan saja', desc:'Atasan pemohon menandatangani, lalu IT memproses' },
  mgr_gm:{ label:'Atasan + GM', desc:'Atasan lalu GM menandatangani berurutan' },
};
const EF_KINDS = {
  VPN:{ label:'VPN', icon:'shield', code:'F/ICT/04' }, WEBSITE:{ label:'Website', icon:'globe', code:'F/ICT/04-W' },
  NETWORK:{ label:'Network', icon:'network', code:'F/ICT/04-N' }, FLASHDISK:{ label:'Flashdisk', icon:'usb', code:'F/ICT/04-FD' },
  EMAIL:{ label:'Email', icon:'mail', code:'F/ICT/04-E' }, SYNOLOGY_NAS:{ label:'Synology NAS', icon:'nas', code:'F/ICT/04-NAS' },
};
const HW_CATS = [
  { k:'LAPTOP', label:'Laptop', icon:'laptop', ex:'Laptop Standar i5/16GB' },
  { k:'DESKTOP', label:'Desktop', icon:'monitor', ex:'PC Office i5' },
  { k:'MONITOR', label:'Monitor', icon:'monitor', ex:'Monitor 24" FHD' },
  { k:'ACCESSORY', label:'Aksesoris', icon:'keyboard', ex:'Keyboard + Mouse' },
  { k:'NETWORK', label:'Jaringan', icon:'network', ex:'Access point / switch' },
  { k:'SOFTWARE', label:'Software', icon:'grid', ex:'Lisensi aplikasi' },
  { k:'SCANNER', label:'Scanner', icon:'barcode', ex:'Scanner barcode' },
  { k:'OTHER', label:'Lainnya', icon:'package', ex:'Barang lain' },
];
const PHASE_SUB = {
  review:'Review IT', appr_mgr:'Menunggu Atasan', appr_gm:'Menunggu GM', procure:'Pengadaan',
  delivery:'Menunggu barang tiba', schedule:'Penjadwalan instalasi', install:'Instalasi',
  fulfill:'Pemenuhan akses', confirm:'Menunggu konfirmasi pemohon', done:'Selesai', rejected:'Ditolak',
};
const PAUSED_PHASES = ['appr_mgr', 'appr_gm', 'procure', 'delivery'];
const PERSONA = {
  agent:{ name:'RM Bagastyo Anggoro W', ini:'RB', sub:'Agent Operational Supp…', color:'#c2410c' },
  req:{ name:'Leony Rustandy', ini:'LR', sub:'QC AB Reguler', color:'#1A8FE0' },
  mgr:{ name:'Hendra Wijaya', ini:'HW', sub:'Manager QC', color:'#7c3aed' },
  gm:{ name:'Bambang Sutrisno', ini:'BS', sub:'GM Operasional', color:'#0f766e' },
};
const MANAGERS = ['Hendra Wijaya — Manager QC', 'Sri Lestari — Manager Accounting', 'Agus Salim — Manager Produksi', 'Dewi Anggraini — Manager HSE'];
const GMS = ['Bambang Sutrisno — GM Operasional', 'Lukas Hartono — GM Finance'];
const AGENTS = ['YOHANES OCTAVIAN R.', 'RM BAGASTYO A.W.', 'YUDI ARTA TRIRENSILA', 'BENY SAPUTRA, S.KOM'];
const STORE_KEY = 'mk-ticket-unify-v5';

/* ============================ SEED ============================ */
const R = (name, dept, ini, color) => ({ name, dept, ini, color });
const LEONY = R('Leony Rustandy', 'QC AB REGULER', 'LR', '#1A8FE0');
function seed() {
  const sys = (k, title, body, at, actor) => ({ k:'sys', tone:k, title, body, at, actor });
  const msg = (from, text, at, me = false, att) => ({ k:'msg', from, text, at, me, att });
  const rev = (v, kind, label, by, at) => ({ v, kind, label, by, at });
  return [
    { id:'t30', num:'201126-QC-0030', type:'it', reqMe:true, title:'SQL di komputer stopper QC A hilang', desc:'Mohon di instalkan ulang SQL untuk komputer di stopper QC A ID :QC32 Password : Robusta1234',
      prio:'HIGH', status:'IN_PROGRESS', req:LEONY, pic:'YOHANES OCTAVIAN R.', created:'20 Nov', sla:{ due:'Kam, 26 Nov · 17.00', left:'sisa 4 hari kerja', pct:22 }, category:'Software',
      msgs:[ { k:'day', t:'Kemarin' }, sys('nv','Yohanes Octavian Rizky Nugroho memperbarui tiket','Status: Open → In Progress · PIC: Yudi Arta Trirensila → Yohanes','16.30'),
        msg('Yohanes Octavian Rizky Nugroho','sore','16.31',true), msg('Yohanes Octavian Rizky Nugroho','bisa di remote jam berapa ?','16.32',true) ], acts:[] },

    { id:'t34', num:'221126-QC-0034', type:'hw', title:'Laptop untuk staf QC baru (2 unit)', desc:'Dua staf QC baru mulai 1 Des, belum ada perangkat kerja.',
      prio:'HIGH', phase:'appr_mgr', route:'mgr', picked:true, req:LEONY, reqMe:true, mgr:'Hendra Wijaya — Manager QC', gm:null, pic:'RM BAGASTYO A.W.', created:'22 Nov',
      sla:{ due:'Rab, 2 Des · 17.00', left:'sisa 6 hari kerja', pct:9 }, docNo:'HR-2026-0042',
      hw:{ kind:'Budget Tahunan', recipient:'Orang lain · Andi & Rina (QC)', fromStock:false,
        items:[ { cat:'LAPTOP', name:'Laptop Standar i5/16GB/512GB', qty:2, spec:'Windows 11 Pro, Office', state:'pending' },
                { cat:'ACCESSORY', name:'Mouse wireless', qty:2, spec:'-', state:'pending' } ] },
      sigs:{ req:{ how:'digital', at:'22 Nov 09.12' }, mgr:null, gm:null, ict:null },
      revs:[ rev(1,'gen','Dibuat dari pengajuan · TTD pemohon','Leony Rustandy','22 Nov 09.12'), rev(2,'gen','Alur ditetapkan: Atasan saja','RM Bagastyo','22 Nov 10.05') ],
      msgs:[ { k:'day', t:'Hari ini' },
        sys('hw','Leony Rustandy mengajukan Hardware Request','<div class="kv"><span>Item</span><b>2× Laptop Standar · 2× Mouse wireless</b><span>Jenis</span><b>Budget Tahunan</b></div>','09.12'),
        sys('nv','RM Bagastyo mengambil tiket','Status: Open → In Progress','09.40'),
        msg('RM Bagastyo','Halo Bu Leony, untuk 2 laptop ini user-nya sudah ada akun AD? Biar sekalian kami siapkan.','09.42',true),
        msg('Leony Rustandy','Sudah Pak, akun andi.p dan rina.s','09.50'),
        sys('hw','RM Bagastyo menetapkan alur persetujuan','<div class="kv"><span>Rute</span><b>Atasan saja</b><span>Atasan</span><b>Hendra Wijaya — Manager QC</b></div><div class="docref">'+I('ef')+' Form Permintaan Hardware HR-2026-0042 <span class="vtag">v2</span></div>','10.05') ], acts:[] },

    { id:'t33', num:'221126-QC-0033', type:'ef', title:'Akses VPN untuk kerja dari rumah', desc:'Butuh akses VPN ke Oracle & folder QC selama cuti melahirkan rekan.',
      prio:'MEDIUM', phase:'review', route:null, picked:false, req:LEONY, reqMe:true, mgr:'Hendra Wijaya — Manager QC', gm:null, pic:null, created:'22 Nov',
      sla:{ due:'Sen, 23 Nov · 10.00', left:'respon pertama sisa 2 jam', pct:40 }, docNo:'F/ICT/04/0118',
      ef:{ kind:'VPN', fields:{ 'Masa akses':'1 Des 2026 – 28 Feb 2027', 'Sistem dituju':'Oracle EBS, \\\\nas01\\QC', 'Alasan':'WFH sementara selama cuti rekan', 'Perangkat':'Laptop pribadi (Windows 11)' }, cred:null },
      sigs:{ req:{ how:'digital', at:'22 Nov 08.03' }, mgr:null, gm:null, ict:null },
      revs:[ rev(1,'gen','Dibuat dari pengajuan · TTD pemohon','Leony Rustandy','22 Nov 08.03') ],
      msgs:[ { k:'day', t:'Hari ini' }, sys('ef','Leony Rustandy mengajukan E-Form VPN','<div class="kv"><span>Masa akses</span><b>1 Des 2026 – 28 Feb 2027</b><span>Atasan usulan</span><b>Hendra Wijaya</b></div><div class="docref">'+I('ef')+' F/ICT/04 Permintaan Akses VPN <span class="vtag">v1</span></div>','08.03') ], acts:[] },

    { id:'t32', num:'211126-ACC-0032', type:'ef', title:'Akses website djponline.pajak.go.id', desc:'Untuk pelaporan PPh bulanan.', prio:'MEDIUM', phase:'appr_gm', route:'mgr_gm', picked:true,
      req:R('Ursula Philomena','ACCOUNTING','UP','#64748b'), mgr:'Sri Lestari — Manager Accounting', gm:'Bambang Sutrisno — GM Operasional', pic:'YUDI ARTA TRIRENSILA', created:'21 Nov',
      sla:{ due:'Jum, 27 Nov · 17.00', left:'sisa 5 hari kerja', pct:30 }, docNo:'F/ICT/04-W/0057',
      ef:{ kind:'WEBSITE', fields:{ 'Website':'djponline.pajak.go.id, coretax.pajak.go.id', 'Alasan':'Pelaporan pajak bulanan' }, cred:null },
      sigs:{ req:{ how:'digital', at:'21 Nov 13.00' }, mgr:{ how:'paper', at:'21 Nov 16.20' }, gm:null, ict:null },
      revs:[ rev(1,'gen','Dibuat dari pengajuan · TTD pemohon','Ursula Philomena','21 Nov 13.00'), rev(2,'gen','Alur ditetapkan: Atasan + GM','Yudi Arta','21 Nov 14.10'), rev(3,'imp','Impor scan TTD basah — Atasan (Sri Lestari)','Yudi Arta','21 Nov 16.20') ],
      msgs:[ { k:'day', t:'Kemarin' }, sys('ef','Ursula Philomena mengajukan E-Form Website','<div class="kv"><span>Website</span><b>djponline.pajak.go.id, coretax.pajak.go.id</b></div>','13.00'),
        sys('ef','Yudi Arta menetapkan alur: Atasan + GM','','14.10'), sys('ef','Sri Lestari menyetujui (dokumen kertas diimpor)','<div class="docref">'+I('upload')+' scan_ttd_sri.pdf → Dokumen <span class="vtag">v3</span></div>','16.20') ], acts:[] },

    { id:'t31', num:'211126-PRO-0031', type:'hw', title:'Monitor 24" tambahan line produksi', desc:'Monitoring PLC line 3.', prio:'MEDIUM', phase:'delivery', route:'none', picked:true,
      req:R('Tri Kartika S.','PRODUCTION 1','TS','#1A8FE0'), mgr:'Agus Salim — Manager Produksi', gm:null, pic:'YUDI ARTA TRIRENSILA', created:'21 Nov',
      sla:{ due:'Sel, 1 Des · 14.54', left:'sisa 6 hari kerja', pct:18 }, docNo:'HR-2026-0041',
      hw:{ kind:'Non-Budget', recipient:'Diri sendiri', fromStock:false, items:[ { cat:'MONITOR', name:'Monitor 24" FHD', qty:1, spec:'HDMI', state:'approved', vendor:'CV Sinar Komputer', cost:'Rp 1.850.000' } ] },
      sigs:{ req:{ how:'digital', at:'21 Nov' }, mgr:null, gm:null, ict:null }, revs:[ rev(1,'gen','Dibuat dari pengajuan · TTD pemohon','Tri Kartika','21 Nov 10.00'), rev(2,'gen','Alur ditetapkan: Tanpa persetujuan','Yudi Arta','21 Nov 10.30') ],
      msgs:[ { k:'day', t:'Kemarin' }, sys('hw','Pengadaan disetujui','<div class="kv"><span>Vendor</span><b>CV Sinar Komputer</b><span>Biaya</span><b>Rp 1.850.000</b></div>','11.00') ], acts:[] },

    { id:'t29', num:'201126-TRA-0029', type:'it', title:'Komputer tiba tiba restart sendiri', prio:'MEDIUM', status:'IN_PROGRESS', req:R('Avrillia Pha…','TRANSPORT OPE…','AP','#16a34a'),
      pic:'RM BAGASTYO A.W.', created:'20 Nov', sla:{ due:'Sel, 1 Des · 14.56', left:'sisa 6 hari 6 jam kerja', pct:12 }, category:'Hardware', msgs:[], acts:[] },

    { id:'t27', num:'201126-PAC-0027', type:'it', title:'wifi tablet oddo line D5 tidak ada koneksi', prio:'HIGH', status:'TODO', req:R('M. Fadilah','PACKING CD','MF','#475569'),
      pic:'BENY SAPUTRA, S.KOM', created:'20 Nov', sla:{ due:'Kam, 26 Nov · 13.39', left:'sisa 3 hari 5 jam kerja', pct:30 }, category:'Network', msgs:[], acts:[] },

    { id:'t26', num:'191126-PAC-0026', type:'hw', title:'Scanner barcode gudang packing', desc:'Scanner lama rusak.', prio:'HIGH', phase:'schedule', route:'none', picked:true,
      req:R('Dana Yohan…','PACKING CD','DY','#1A8FE0'), mgr:'Agus Salim — Manager Produksi', gm:null, pic:'YUDI ARTA TRIRENSILA', created:'19 Nov',
      sla:{ due:'Rab, 25 Nov · 15.00', left:'sisa 2 hari kerja', pct:55 }, docNo:'HR-2026-0039',
      hw:{ kind:'Non-Budget', recipient:'Diri sendiri', fromStock:true, items:[ { cat:'SCANNER', name:'Scanner barcode Zebra DS2208', qty:1, spec:'USB', state:'approved', vendor:'Stok gudang IT' } ], schedule:null },
      sigs:{ req:{ how:'digital', at:'19 Nov' }, mgr:null, gm:null, ict:null }, revs:[ rev(1,'gen','Dibuat dari pengajuan · TTD pemohon','Dana Yohan','19 Nov 08.00'), rev(2,'gen','Alur: Tanpa persetujuan · dari stok','Yudi Arta','19 Nov 08.20') ],
      msgs:[], acts:[] },

    { id:'t25', num:'191126-HSE-0025', type:'ef', title:'Akses folder Synology NAS — HSE Audit', prio:'LOW', phase:'fulfill', route:'none', picked:true,
      req:R('Desy Aviliani','HSE - PUSAT','DA','#db2777'), mgr:'Dewi Anggraini — Manager HSE', gm:null, pic:'BENY SAPUTRA, S.KOM', created:'19 Nov',
      sla:{ due:'Sen, 23 Nov · 17.00', left:'sisa 1 hari kerja', pct:70 }, docNo:'F/ICT/04-NAS/0031',
      ef:{ kind:'SYNOLOGY_NAS', fields:{ 'Folder':'\\\\nas01\\HSE\\Audit 2026', 'Hak akses':'Read & Write' }, cred:null },
      sigs:{ req:{ how:'digital', at:'19 Nov' }, mgr:null, gm:null, ict:null }, revs:[ rev(1,'gen','Dibuat dari pengajuan · TTD pemohon','Desy Aviliani','19 Nov 09.00') ], msgs:[], acts:[] },

    { id:'t20', num:'181126-SEP-0020', type:'hw', title:'Keyboard & mouse pengganti', prio:'LOW', phase:'confirm', route:'none', picked:true,
      req:LEONY, reqMe:true, mgr:'Hendra Wijaya — Manager QC', gm:null, pic:'RM BAGASTYO A.W.', created:'18 Nov', sla:{ due:'—', left:'Menunggu konfirmasi', pct:100 }, docNo:'HR-2026-0036',
      hw:{ kind:'Non-Budget', recipient:'Diri sendiri', fromStock:true, items:[ { cat:'ACCESSORY', name:'Keyboard + Mouse Logitech MK270', qty:1, spec:'-', state:'approved', vendor:'Stok gudang IT' } ],
        schedule:{ tech:'RM BAGASTYO A.W.', slots:['Sel, 24 Nov · 09.00–10.00','Sel, 24 Nov · 13.00–14.00'], chosen:0 }, asset:'SJA-ACC-2026-0912' },
      sigs:{ req:{ how:'digital', at:'18 Nov' }, mgr:null, gm:null, ict:{ how:'digital', at:'21 Nov' } },
      revs:[ rev(1,'gen','Dibuat dari pengajuan · TTD pemohon','Leony Rustandy','18 Nov'), rev(2,'gen','Alur: Tanpa persetujuan · dari stok','RM Bagastyo','18 Nov'), rev(3,'dig','TTD ICT — instalasi selesai, aset SJA-ACC-2026-0912','RM Bagastyo','21 Nov') ],
      msgs:[ { k:'day', t:'Kemarin' }, sys('hw','Instalasi selesai','<div class="kv"><span>Aset</span><b>SJA-ACC-2026-0912</b><span>Teknisi</span><b>RM Bagastyo</b></div>','15.10') ], acts:[] },

    { id:'t18', num:'171126-MKT-0018', type:'ef', title:'Email untuk karyawan baru marketing', prio:'MEDIUM', phase:'done', route:'mgr', picked:true,
      req:R('Kevin Austin','MARKETING','KA','#ea580c'), mgr:'—', gm:null, pic:'YOHANES OCTAVIAN R.', created:'17 Nov', sla:{ due:'—', left:'Selesai', pct:100 }, docNo:'F/ICT/04-E/0102',
      ef:{ kind:'EMAIL', from:'2026-11-18', to:null, fields:{ 'Alamat':'kevin.a@sja.com', 'Kuota':'15 GB' }, cred:{ user:'kevin.a@sja.com', pass:'Sj@2026!kA', server:'mail.sja.com' } },
      sigs:{ req:{ how:'digital', at:'17 Nov' }, mgr:{ how:'digital', at:'17 Nov' }, gm:null, ict:{ how:'digital', at:'18 Nov' } },
      revs:[ rev(1,'gen','Dibuat','Kevin Austin','17 Nov'), rev(2,'dig','TTD Atasan (digital)','—','17 Nov'), rev(3,'dig','TTD ICT — akses diberikan','Yohanes','18 Nov'), rev(4,'fin','Final · terkunci','Sistem','18 Nov') ], msgs:[], acts:[] },

    { id:'t10', num:'281125-QC-0010', type:'ef', title:'Akses VPN untuk lembur', prio:'MEDIUM', phase:'done', route:'mgr', picked:true, req:LEONY, reqMe:true, mgr:'Hendra Wijaya — Manager QC', gm:null, pic:'YOHANES OCTAVIAN R.', created:'28 Nov 2025',
      sla:{ due:'—', left:'Selesai', pct:100 }, docNo:'F/ICT/04/0071', ef:{ kind:'VPN', from:'2025-11-28', to:'2026-11-28', fields:{ 'Kebutuhan':'Remote PC kantor', 'Masa berlaku':'28 Nov 2025 – 28 Nov 2026', 'Alasan':'Lembur akhir tahun' }, cred:{ user:'leony.r', pass:'Vpn#2025-Qc!', server:'vpn.kapalapi.co.id', note:'' } },
      sigs:{ req:{ how:'digital', at:'28 Nov 2025' }, mgr:{ how:'digital', at:'28 Nov 2025' }, gm:null, ict:{ how:'digital', at:'29 Nov 2025' } }, revs:[ rev(1,'gen','Dibuat','Leony Rustandy','28 Nov 2025'), rev(2,'fin','Final · terkunci','Sistem','29 Nov 2025') ], msgs:[], acts:[] },

    { id:'t24', num:'201126-HSE-0024', type:'it', title:'NAS tidak bisa dibuka', prio:'MEDIUM', status:'CLOSED', req:R('Desy Aviliani','HSE - PUSAT','DA','#db2777'),
      pic:'YOHANES OCTAVIAN R.', created:'20 Nov', sla:{ done:true }, category:'Network', msgs:[], acts:[] },
  ];
}

/* ============================ STATE ============================ */
let S = load() || fresh();
function fresh() {
  return { role:'agent', screen:'list', tickets:seed(), sel:'t34', type:'', status:'', prio:'', scope:'all', q:'', tab:'chat', openMenu:null, createType:null, clock:51, insp:true };
}
function load() { try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch { return null; } }
function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch { /* storage unavailable: mockup still works in-memory */ } }
const T = (id) => S.tickets.find((t) => t.id === id);
const now = () => { S.clock += 3; const m = S.clock % 60, h = 18 + Math.floor(S.clock / 60); return `${String(h).padStart(2,'0')}.${String(m).padStart(2,'0')}`; };
const me = () => PERSONA[S.role];

/* ============================ DERIVED ============================ */
function statusOf(t) {
  if (t.type === 'it') return t.status;
  switch (t.phase) {
    case 'review': return t.picked ? 'IN_PROGRESS' : 'TODO';
    case 'appr_mgr': case 'appr_gm': case 'procure': case 'delivery': return 'WAITING_VENDOR';
    case 'schedule': case 'install': case 'fulfill': return 'IN_PROGRESS';
    case 'confirm': return 'RESOLVED';
    case 'done': return 'CLOSED';
    case 'rejected': return 'CANCELLED';
    default: return 'TODO';
  }
}
const isPaused = (t) => t.type !== 'it' && PAUSED_PHASES.includes(t.phase);
function phaseSub(t) {
  if (t.type === 'it') return '';
  if (t.phase === 'schedule' && t.hw?.schedule && t.hw.schedule.chosen == null) return 'Menunggu pemohon pilih jadwal';
  if (t.phase === 'install' && t.started) return 'Instalasi berlangsung';
  return PHASE_SUB[t.phase];
}
function stepsOf(t) {
  const decided = t.route != null;
  const ap = [
    { k:'appr_mgr', label:'Atasan', who:t.mgr?.split(' — ')[0], skip: decided && t.route === 'none' },
    { k:'appr_gm', label:'GM', who:t.gm?.split(' — ')[0], skip: decided && t.route !== 'mgr_gm' },
  ];
  if (!decided) { ap[0].label = 'Atasan?'; ap[1].label = 'GM?'; }
  const head = [{ k:'review', label:'Review IT', who:t.pic ? t.pic.split(' ')[0] : 'belum ada PIC' }, ...ap];
  if (t.type === 'hw') {
    const stock = t.hw.fromStock;
    return [...head,
      { k:'procure', label:'Pengadaan', skip:stock }, { k:'delivery', label:'Barang tiba', skip:stock },
      { k:'schedule', label:'Jadwal' }, { k:'install', label:'Instalasi' }, { k:'confirm', label:'Konfirmasi', who:'Pemohon' }, { k:'done', label:'Selesai' }];
  }
  return [...head, { k:'fulfill', label:'Pemenuhan IT' }, { k:'confirm', label:'Konfirmasi', who:'Pemohon' }, { k:'done', label:'Selesai' }];
}
function visibleTickets() {
  return S.tickets.filter((t) => {
    if (S.role === 'req' && !t.reqMe) return false;
    if (S.role === 'mgr' && !(t.mgr || '').startsWith('Hendra')) return false;
    if (S.role === 'gm' && !(t.gm || '').startsWith('Bambang')) return false;
    return true;
  });
}
function filteredTickets() {
  const q = S.q.trim().toLowerCase();
  return visibleTickets().filter((t) => {
    if (S.type && t.type !== S.type) return false;
    const st = statusOf(t);
    if (S.status === 'DONE' ? !['RESOLVED','CLOSED'].includes(st) : S.status && st !== S.status) return false;
    if (S.prio && t.prio !== S.prio) return false;
    if (S.scope === 'mine' && t.pic !== 'RM BAGASTYO A.W.') return false;
    if (S.scope === 'approve' && !needsMe(t)) return false;
    if (q && !(`${t.num} ${t.title} ${t.req.name}`.toLowerCase().includes(q))) return false;
    return true;
  });
}
function needsMe(t) {
  if (S.role === 'mgr') return t.phase === 'appr_mgr';
  if (S.role === 'gm') return t.phase === 'appr_gm';
  if (S.role === 'req') return (t.phase === 'confirm') || (t.phase === 'schedule' && t.hw?.schedule && t.hw.schedule.chosen == null);
  return false;
}

/* ============================ SMALL RENDERERS ============================ */
const tag = (type, lg = false) => type === 'it' ? '' : `<span class="tag ${TYPES[type].cls} ${lg ? 'lg' : ''}">${I(TYPES[type].icon)}${TYPES[type].short}</span>`;
const statusPill = (st, sm = false, chev = true) => { const s = STATUS[st]; return `<span class="pill ${s.cls} ${sm ? 'sm' : ''}">${I(s.icon)}${s.label}${chev ? I('chev','cv') : ''}</span>`; };
const prioPill = (p, chev = true) => { const c = PRIO[p]; return `<span class="pill ${c.cls}">${c.dot ? '<span class="dot"></span>' : I(c.icon)}${c.label}${chev ? I('chev','cv') : ''}</span>`; };
const av = (ini, color, cls = '') => `<span class="av ${cls}" style="background:${color}">${esc(ini)}</span>`;
function slaCell(t) {
  const st = statusOf(t);
  if (['RESOLVED','CLOSED'].includes(st)) return `<span class="pill p-green">${I('checkC')}Selesai</span>`;
  if (st === 'CANCELLED') return `<span class="sla na"><b>—</b><span>Ditolak</span></span>`;
  if (isPaused(t)) return `<span class="sla paused ${t.id === 't34' ? 'ann' : ''}" ${t.id === 't34' ? 'data-ann="SLA dijeda saat bukan giliran IT"' : ''}><b>${I('pause')}Dijeda</b><span>${esc(phaseSub(t))}</span></span>`;
  return `<span class="sla"><b>${I('hourglass')}${esc(t.sla.due)}</b><span>${esc(t.sla.left)}</span></span>`;
}

/* ============================ SIDEBAR & TOPBAR ============================ */
/* ============================ LIST ============================ */
function renderList() {
  const all = visibleTickets().filter((t) => !S.type || t.type === S.type);
  const cnt = (fn) => all.filter(fn).length;
  const kpi = (tone, icon, label, v, statusKey) => `<div class="kpi k-${tone} ${S.status === statusKey ? 'on' : ''}" data-act="kpi" data-v="${statusKey}"><div class="r"><span class="ico">${I(icon)}</span><span class="v">${v}</span></div><span class="l">${label}</span></div>`;
  const rows = filteredTickets();
  const typeCount = (ty) => visibleTickets().filter((t) => !ty || t.type === ty).length;
  const typeOpt = (v, label, icon, bg, fg) => `<button class="${S.type === v ? 'on' : ''}" data-act="setType" data-v="${v}"><span class="mi" style="background:${bg};color:${fg}">${I(icon)}</span>${label}<span class="cnt">${typeCount(v)}</span></button>`;
  const typeLabel = S.type ? `${I(TYPES[S.type].icon)}${TYPES[S.type].short}` : 'Semua';
  const menu = (key, inner) => S.openMenu === key ? `<div class="menu">${inner}</div>` : '';
  const stOpts = [['','Semua'],['TODO','Open'],['IN_PROGRESS','In Progress'],['WAITING_VENDOR','Waiting Vendor'],['RESOLVED','Resolved'],['CLOSED','Closed'],['DONE','Selesai (Resolved + Closed)']];
  const prOpts = [['','Semua'],['LOW','Low'],['MEDIUM','Normal'],['HIGH','Urgent'],['CRITICAL','Blocker']];
  const isAgent = S.role === 'agent';
  const scopeOpts = isAgent ? [['all','Semua'],['mine','Tugas Saya'],['created','Saya Buat']] : S.role === 'req' ? [['all','Semua']] : [['all','Semua'],['approve','Perlu Persetujuan']];
  const need = visibleTickets().filter(needsMe);

  let html = '';
  if (!isAgent && need.length) {
    const t0 = need[0];
    html += `<div class="banner ${S.role === 'req' ? 'navy' : 'ef'}">${I(S.role === 'req' ? 'info' : 'pen')}<div style="flex:1"><b>${need.length} tiket menunggu tindakan Anda.</b> ${S.role === 'req' ? 'Pilih jadwal atau konfirmasi penerimaan.' : 'Tanda tangani langsung di iDesk, bisa sambil tanya lewat chat tiket.'}</div><button class="btn sm" data-act="open" data-v="${t0.id}">Buka ${esc(t0.num)}</button></div>`;
  }
  if (isAgent) {
    html += `<div class="kpis">${kpi('neutral','trend','Total',all.length,'')}${kpi('sky','inbox','Open',cnt((t)=>statusOf(t)==='TODO'),'TODO')}${kpi('navy','circleDot','In Progress',cnt((t)=>statusOf(t)==='IN_PROGRESS'),'IN_PROGRESS')}${kpi('amber','hourglass','Waiting Vendor',cnt((t)=>statusOf(t)==='WAITING_VENDOR'),'WAITING_VENDOR')}${kpi('green','checkC','Resolved',cnt((t)=>['RESOLVED','CLOSED'].includes(statusOf(t))),'DONE')}${kpi('red','alert','Overdue',0,'OVERDUE')}${kpi('red','flame','Critical',cnt((t)=>t.prio==='CRITICAL'),'CRIT')}</div>`;
  }
  html += `<div class="filters">
    <label class="field">${I('search')}<input id="q" value="${esc(S.q)}" placeholder="Cari judul, nomor tiket, atau pemohon"></label>
    <div class="pop ann" data-ann="BARU · filter Tipe"><button class="${S.type ? 'act' : ''}" data-act="menu" data-v="type">Tipe <b>${typeLabel}</b>${I('chev','cv')}</button>${menu('type',
      typeOpt('', 'Semua tipe', 'grid', 'var(--neutral-bg)', 'var(--muted)') + '<div class="sep"></div>' +
      typeOpt('it', 'IT Support', 'ticket', 'var(--it-bg)', 'var(--it)') + typeOpt('hw', 'Hardware Request', 'hw', 'var(--hw-bg)', 'var(--hw-ink)') + typeOpt('ef', 'E-Form Request', 'ef', 'var(--ef-bg)', 'var(--ef-ink)'))}</div>
    <div class="pop"><button data-act="menu" data-v="status">Status <b>${stOpts.find((o)=>o[0]===S.status)?.[1] ?? 'Semua'}</b>${I('chev','cv')}</button>${menu('status', stOpts.map(([v,l]) => `<button class="${S.status===v?'on':''}" data-act="setStatus" data-v="${v}">${l}</button>`).join(''))}</div>
    <div class="pop"><button data-act="menu" data-v="prio">Prioritas <b>${prOpts.find((o)=>o[0]===S.prio)?.[1] ?? 'Semua'}</b>${I('chev','cv')}</button>${menu('prio', prOpts.map(([v,l]) => `<button class="${S.prio===v?'on':''}" data-act="setPrio" data-v="${v}">${l}</button>`).join(''))}</div>
    <button class="sq">${I('refresh')}</button><button class="sq">${I('more')}</button>
    <div class="segbar">${scopeOpts.map(([v,l]) => `<button class="${S.scope===v?'on':''}" data-act="scope" data-v="${v}">${l}</button>`).join('')}</div>
    <div class="segbar"><button>${I('kanban')}Kanban</button><button class="on">${I('table')}Tabel</button></div>
  </div>`;
  const chips = [];
  if (S.type) chips.push(`<span class="chip-x">Tipe: ${TYPES[S.type].short}<button data-act="setType" data-v="">${I('x')}</button></span>`);
  if (chips.length) html += `<div class="chips-active">${chips.join('')}</div>`;

  html += `<div class="table"><div class="trow thead"><div><span class="cbx"></span></div><div>Tiket</div><div>Prioritas</div><div>Status</div><div>Pemohon</div><div>PIC</div><div>SLA</div><div class="tdate">Dibuat ↓</div></div>`;
  if (!rows.length) html += `<div class="empty">${I('inbox')}<p>Tidak ada tiket untuk filter ini</p></div>`;
  rows.forEach((t, i) => {
    const st = statusOf(t);
    const sub = phaseSub(t);
    html += `<div class="trow ${t.fresh ? 'new' : ''}" data-act="open" data-v="${t.id}">
      <div><span class="cbx"></span></div>
      <div><div class="tnum"><span class="mono">#${t.num}</span>${i === 1 && t.type !== 'it' ? `<span class="ann l" data-ann="Tag tipe: warna + icon khas">${tag(t.type)}</span>` : tag(t.type)}${t.num === '201126-ACC-0023' ? '<span class="src">dari Oracle / K2</span>' : ''}</div>
        <div class="ttitle">${esc(t.title)}</div></div>
      <div>${prioPill(t.prio)}</div>
      <div class="st-wrap">${statusPill(st)}${sub && !['CLOSED'].includes(st) ? `<span class="phase-sub ${t.type}">${I(TYPES[t.type].icon)}${esc(sub)}</span>` : ''}</div>
      <div class="who">${av(t.req.ini, t.req.color)}<div style="min-width:0"><b>${esc(t.req.name)}</b><span>${esc(t.req.dept)}</span></div></div>
      <div>${t.pic ? `<span class="pic">${av(t.pic.split(' ').map((w)=>w[0]).slice(0,2).join(''), '#334155', 'sm')}<span class="nm">${esc(t.pic)}</span>${I('chev','cv')}</span>` : `<span class="pic faint"><span class="nm">Belum ada PIC</span>${I('chev','cv')}</span>`}</div>
      <div>${slaCell(t)}</div>
      <div class="tdate">${esc(t.created)}</div></div>`;
  });
  html += `</div>`;
  $('#sheet').className = 'sheet';
  $('#sheet').innerHTML = html;
  const q = $('#q');
  q.oninput = () => { S.q = q.value; const pos = q.selectionStart; render(); const nq = $('#q'); nq.focus(); nq.setSelectionRange(pos, pos); };
  S.tickets.forEach((t) => { delete t.fresh; });
}

/* ============================ DETAIL ============================ */
function activityOf(t) {
  const base = t.msgs.filter((m) => m.k === 'sys').map((m) => ({ text:esc(stripTags(m.title)), at:`22 Nov ${m.at}` }));
  return [...base, ...(t.acts || [])].reverse();
}
const stripTags = (s) => String(s).replace(/<[^>]+>/g, '');
function turnOf(t) {
  const it = { ini:'IT', color:'#2D4A8C' };
  switch (t.phase) {
    case 'review': return { ...it, who:t.pic || 'Tim IT', what:'Tinjau & tetapkan alur' };
    case 'appr_mgr': return { ini:'AT', color:'#7c3aed', who:t.mgr.split(' — ')[0], what:'Tanda tangan atasan' };
    case 'appr_gm': return { ini:'GM', color:'#0f766e', who:t.gm.split(' — ')[0], what:'Tanda tangan GM' };
    case 'procure': return { ...it, who:'Tim IT', what:'Keputusan pengadaan' };
    case 'delivery': return { ...it, who:'Vendor', what:'Menunggu barang tiba' };
    case 'schedule': return t.hw.schedule && t.hw.schedule.chosen == null ? { ini:t.req.ini, color:t.req.color, who:t.req.name, what:'Pilih jadwal instalasi' } : { ...it, who:t.pic, what:'Usulkan jadwal' };
    case 'install': return { ...it, who:t.hw.schedule?.tech || t.pic, what:t.started ? 'Instalasi berlangsung' : `Jadwal ${t.hw.schedule?.slots[t.hw.schedule.chosen] || ''}` };
    case 'fulfill': return { ...it, who:t.pic, what:'Berikan akses' };
    case 'confirm': return { ini:t.req.ini, color:t.req.color, who:t.req.name, what:'Konfirmasi hasil' };
    default: return null;
  }
}
function renderMsg(m) {
  if (m.k === 'day') return `<div class="day">${esc(m.t)}</div>`;
  if (m.k === 'sys') return `<div class="sys ${m.tone}"><div class="sh"><span class="sic">${I(m.tone === 'hw' ? 'hw' : m.tone === 'ef' ? 'ef' : m.tone === 'rd' ? 'xC' : 'circleDot')}</span><span>${m.title}</span><span class="tm">${esc(m.at)}</span></div>${m.body ? `<div class="sb">${m.body}</div>` : ''}</div>`;
  return `<div class="msg ${m.me ? 'me' : ''}"><div class="bub"><div class="nm">${esc(m.from)}</div>${esc(m.text)}${m.att ? `<div class="att">${I('paperclip')}${esc(m.att)}</div>` : ''}<span class="tm">${esc(m.at)} ${m.me ? '✓' : ''}</span></div></div>`;
}

/* ---- Action dock (what can *this* viewer do now) ---- */
function inspectorIT(t) {
  const st = statusOf(t);
  const isAgent = S.role === 'agent';
  let h = `<div class="ic-card"><h3>Pemohon</h3><div class="who" style="margin-bottom:10px">${av(t.req.ini, t.req.color)}<div style="min-width:0"><b style="text-transform:none">${esc(t.req.name)}</b><span style="text-transform:none">${t.reqMe ? 'leonyrustandy@gmail.com · ' : ''}${esc(t.req.dept)}</span></div></div>
    <div class="kvr"><span>${I('monitor')}Komputer</span><span class="val mono">${t.reqMe ? 'QC03.sja.com' : '—'}</span></div>
    <div class="kvr"><span>${I('network')}IP</span><span class="val mono">${t.reqMe ? '10.10.12.36' : '—'}</span></div></div>`;
  h += `<div class="ic-card"><h3>Properti</h3>
    <div class="kvr"><span>Tipe</span><span class="val">${t.type === 'it' ? `<span class="tag it">${I('ticket')}IT Support</span>` : tag(t.type)}</span></div>
    <div class="kvr"><span>PIC</span><span class="sel">${esc(t.pic || 'Belum ada')}${isAgent ? I('chev') : ''}</span></div>
    <div class="kvr"><span>Status</span>${t.type === 'it' ? statusPill(st) : `<span class="ann" data-ann="Status ikut fase (read-only)">${statusPill(st, false, false)}</span>`}</div>
    <div class="kvr"><span>Prioritas</span>${prioPill(t.prio, isAgent)}</div>
    ${t.type === 'it' ? `<div class="kvr"><span>Kategori</span><span class="sel">${esc(t.category)}${I('chev')}</span></div><div class="kvr"><span>Perangkat</span><span class="sel">Tidak ada${I('chev')}</span></div>` : `<div class="kvr"><span>No. dokumen</span><span class="val mono">${esc(t.docNo)}</span></div>`}
  </div>`;
  if (t.type === 'hw') {
    h += `<div class="ic-card"><h3>${I('hw')}Permintaan Hardware <span class="r muted">${esc(t.hw.kind)}</span></h3>
      <div class="kvr" style="border:0;padding-top:0"><span>Untuk</span><span class="val">${esc(t.hw.recipient)}</span></div>
      ${t.hw.items.map((it) => { const c = HW_CATS.find((x) => x.k === it.cat) || HW_CATS[7]; return `<div class="item"><span class="iic">${I(c.icon)}</span><div style="min-width:0"><b>${esc(it.name)}</b><span>${esc(it.vendor || it.spec)}</span></div><div class="q"><b>×${it.qty}</b>${itemState(it)}</div></div>`; }).join('')}
      ${t.hw.asset ? `<div class="kvr"><span>${I('barcode')}Aset</span><span class="val mono">${esc(t.hw.asset)}</span></div>` : ''}
      ${t.hw.schedule && t.hw.schedule.chosen != null ? `<div class="kvr"><span>${I('cal')}Instalasi</span><span class="val">${esc(t.hw.schedule.slots[t.hw.schedule.chosen])}</span></div>` : ''}</div>`;
  } else if (t.type === 'ef') {
    const k = EF_KINDS[t.ef.kind];
    const canCred = t.ef.cred && (isAgent || S.role === 'req');
    h += `<div class="ic-card"><h3>${I(k.icon)}Permintaan Akses <span class="r muted">${k.label}</span></h3>
      ${Object.entries(t.ef.fields).map(([a,b]) => `<div class="kvr"><span>${esc(a)}</span><span class="val">${esc(b)}</span></div>`).join('')}
      ${t.ef.cred ? `<div class="kvr"><span>${I('key')}Kredensial</span>${canCred ? `<button class="btn sm" data-act="showCred">${I('eye')}Lihat</button>` : '<span class="val faint">Terbatas</span>'}</div>` : ''}</div>`;
  }
  if (t.type !== 'it') {
    const editable = isAgent && t.phase === 'review';
    h += `<div class="ic-card ann" data-ann="Dikontrol penuh IT"><h3>${I('shield')}Persetujuan</h3>
      <div class="route">${Object.entries(ROUTES).map(([k,v]) => `<div class="ropt ${t.route===k?'on':''} ${editable?'':'lock'}" ${editable ? `data-act="review"` : ''}><span class="rd"></span><div><b>${v.label}</b><small>${v.desc}</small></div></div>`).join('')}</div>
      ${t.route == null ? `<div class="note">${I('info')}<span>Belum ditetapkan. ${isAgent ? 'Tetapkan saat meninjau.' : 'Menunggu review IT.'}</span></div>` : ''}
      <div class="chain">${chainOf(t).map((c) => `<div class="cn ${c.state}"><span class="cd">${I(c.state==='ok'?'check':c.state==='wait'?'hourglass':c.state==='no'?'x':'clock')}</span><div><b>${esc(c.role)}</b><span>${esc(c.name)}${c.how ? ` · ${c.how}` : ''}</span>${c.state==='ok' ? `<div class="sigm">${esc(c.name.split(' — ')[0])}</div>` : ''}</div></div>`).join('')}</div></div>`;
    h += `<div class="ic-card"><h3>${I('fileCheck')}Dokumen <span class="r"><a class="muted" data-act="tabDoc" style="cursor:pointer">Lihat semua</a></span></h3>
      <div class="docmini"><span class="fi">${I('ef')}<em>v${t.revs.length}</em></span><div style="min-width:0"><b>${esc(docTitle(t))}</b><span>${esc(t.revs.at(-1).label)}</span></div></div>
      <div class="btnrow"><button class="btn sm" data-act="export">${I('download')}Ekspor PDF</button>${isAgent && ['appr_mgr','appr_gm'].includes(t.phase) ? `<button class="btn sm" data-act="import">${I('upload')}Impor bertanda tangan</button>` : ''}</div></div>`;
  }
  // SLA
  if (t.type === 'it' || !['done'].includes(t.phase)) {
    const paused = isPaused(t);
    h += `<div class="ic-card"><h3>SLA</h3>${['RESOLVED','CLOSED','CANCELLED'].includes(st) ? `<div class="slabig" style="color:var(--green-ink)">Selesai</div>` :
      `<div class="slabig ${paused?'paused':''}">${paused ? 'Dijeda — ' + esc(phaseSub(t)) : esc(t.sla.left)}</div><div class="prog ${paused?'paused':''}"><i style="width:${t.sla.pct}%"></i></div>
       <div class="kvr"><span>Target SLA</span><span class="val">${esc(t.sla.due)}</span></div><div class="kvr"><span>Dibuat</span><span class="val">${esc(t.created)} 2026</span></div>
       ${t.type !== 'it' ? `<div class="kvr"><span>Dijeda saat</span><span class="val small">Approval, pengadaan, pengiriman</span></div>` : ''}`}</div>`;
  }
  return h;
}
function chainOf(t) {
  const sig = (s) => s ? (s.how === 'paper' ? 'TTD basah (diimpor)' : 'TTD digital') : '';
  const out = [{ role:'Pemohon', name:t.req.name, state:'ok', how:sig(t.sigs.req) }];
  const r = t.route;
  if (r === 'mgr' || r === 'mgr_gm' || r == null) out.push({ role:'Atasan', name:t.mgr || '—', state: t.sigs.mgr ? 'ok' : t.phase === 'appr_mgr' ? 'wait' : t.phase === 'rejected' && t.rejBy === 'mgr' ? 'no' : '', how:sig(t.sigs.mgr) });
  if (r === 'mgr_gm' || (r == null)) out.push({ role:'GM', name:t.gm || (r == null ? 'opsional' : '—'), state: t.sigs.gm ? 'ok' : t.phase === 'appr_gm' ? 'wait' : '', how:sig(t.sigs.gm) });
  out.push({ role:'ICT', name:t.pic || 'Tim IT', state: t.sigs.ict ? 'ok' : '', how:sig(t.sigs.ict) });
  return out;
}
const docTitle = (t) => t.type === 'hw' ? `Form Permintaan Hardware ${t.docNo}` : `${EF_KINDS[t.ef.kind].code} Permintaan Akses ${EF_KINDS[t.ef.kind].label}`;

/* ---- Rincian pane ---- */
function renderInfo(t) {
  if (t.type === 'hw') {
    return `<div class="sec"><h2>${I('hw')}Rincian Hardware Request</h2><div class="grid2">
      <div class="fv"><span>Jenis</span><b>${esc(t.hw.kind)}</b></div><div class="fv"><span>Untuk</span><b>${esc(t.hw.recipient)}</b></div>
      <div class="fv"><span>Justifikasi</span><b>${esc(t.desc || '-')}</b></div><div class="fv"><span>Sumber barang</span><b>${t.hw.fromStock ? 'Stok gudang IT' : 'Pengadaan vendor'}</b></div></div></div>
      <div class="sec"><h2>${I('package')}Item</h2><table class="tbl"><thead><tr><th>Item</th><th>Spesifikasi</th><th>Qty</th><th>Vendor</th><th>Biaya</th><th>Status</th></tr></thead><tbody>
      ${t.hw.items.map((it) => `<tr><td><b>${esc(it.name)}</b></td><td>${esc(it.spec)}</td><td>${it.qty}</td><td>${esc(it.vendor || '—')}</td><td>${esc(it.cost || '—')}</td><td>${itemState(it)}</td></tr>`).join('')}</tbody></table></div>
      ${t.hw.schedule ? `<div class="sec"><h2>${I('cal')}Instalasi</h2><div class="grid2"><div class="fv"><span>Teknisi</span><b>${esc(t.hw.schedule.tech)}</b></div><div class="fv"><span>Jadwal</span><b>${t.hw.schedule.chosen != null ? esc(t.hw.schedule.slots[t.hw.schedule.chosen]) : 'Menunggu pemohon memilih: ' + esc(t.hw.schedule.slots.join(' / '))}</b></div>${t.hw.asset ? `<div class="fv"><span>Barcode aset</span><b class="mono">${esc(t.hw.asset)}</b></div>` : ''}</div></div>` : ''}`;
  }
  const k = EF_KINDS[t.ef.kind];
  return `<div class="sec"><h2>${I(k.icon)}Rincian E-Form ${k.label}</h2><div class="grid2">${Object.entries(t.ef.fields).map(([a,b]) => `<div class="fv"><span>${esc(a)}</span><b>${esc(b)}</b></div>`).join('')}</div></div>
    <div class="sec"><h2>${I('user')}Data pemohon (snapshot)</h2><div class="grid2"><div class="fv"><span>Nama</span><b>${esc(t.req.name)}</b></div><div class="fv"><span>Departemen</span><b>${esc(t.req.dept)}</b></div><div class="fv"><span>Atasan</span><b>${esc(t.mgr)}</b></div><div class="fv"><span>Syarat & ketentuan</span><b>Disetujui</b></div></div></div>
    ${t.ef.cred ? `<div class="sec"><h2>${I('key')}Kredensial</h2><p class="muted small" style="margin-bottom:10px">Disimpan terenkripsi. Hanya pemohon dan IT yang dapat melihat.</p><button class="btn sm" data-act="showCred">${I('eye')}Lihat kredensial</button></div>` : ''}`;
}

/* ---- Dokumen (1 truth file) ---- */
function renderDocPane(t) {
  const isAgent = S.role === 'agent';
  const kindLbl = { gen:['k-gen','file','Dibuat'], dig:['k-dig','pen','TTD digital'], imp:['k-imp','upload','Impor kertas'], fin:['k-fin','lock','Final'] };
  return `<div style="display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:16px;align-items:start">
    <div class="sec ann" data-ann="Satu dokumen per tiket · semua TTD di sini">${paper(t)}</div>
    <div><div class="sec"><h2>${I('fileCheck')}Satu dokumen, satu sumber</h2>
      <p class="muted small">Setiap tanda tangan, digital maupun kertas, masuk ke dokumen yang sama. Ekspor selalu mencetak versi terbaru dengan kode QR versi; impor hanya diterima jika QR cocok dengan versi terakhir.</p>
      <div class="btnrow"><button class="btn sm" data-act="export">${I('download')}Ekspor PDF v${t.revs.length}</button>${isAgent && ['appr_mgr','appr_gm'].includes(t.phase) ? `<button class="btn sm navy" data-act="import">${I('upload')}Impor bertanda tangan</button>` : ''}<button class="btn sm" data-act="print">${I('printer')}Cetak</button></div></div>
      <div class="sec"><h2>${I('history')}Riwayat versi</h2><div class="revs">${[...t.revs].reverse().map((r, i) => { const k = kindLbl[r.kind]; return `<div class="rev ${i===0?'cur':''}"><span class="vt">v${r.v}</span><div><b>${esc(r.label)}</b><span>${esc(r.by)} · ${esc(r.at)}</span></div><span class="kind ${k[0]}">${k[2]}</span></div>`; }).join('')}</div></div></div></div>`;
}
function paper(t) {
  const s = t.sigs;
  const slot = (role, sig, name, need) => `<div class="${need ? '' : 'grey'}"><span class="xs muted">${role}</span>${sig ? `<span class="s">${esc(name.split(' — ')[0])}</span><span class="xs faint">${sig.how === 'paper' ? 'TTD basah · diimpor' : 'Digital'} · ${esc(sig.at)}</span>` : `<span class="s none">${need ? 'Belum' : 'Tidak diperlukan'}</span><span class="xs">${esc(name.split(' — ')[0])}</span>`}</div>`;
  const needM = t.route === 'mgr' || t.route === 'mgr_gm' || t.route == null;
  const needG = t.route === 'mgr_gm';
  const body = t.type === 'hw'
    ? `<div class="secth">Item diminta</div><table class="tbl" style="font-size:12px"><tr><th>Item</th><th>Qty</th><th>Status</th></tr>${t.hw.items.map((it) => `<tr><td>${esc(it.name)}</td><td>${it.qty}</td><td>${esc(it.state)}</td></tr>`).join('')}</table>`
    : `<div class="secth">Detail akses</div><div class="pr">${Object.entries(t.ef.fields).map(([a,b]) => `<span class="muted">${esc(a)}</span><span>${esc(b)}</span>`).join('')}</div>`;
  return `<div class="paper">${t.phase === 'done' ? '<span class="stamp">FINAL</span>' : ''}
    <div class="ph"><div><b>PT SJA · Divisi ICT</b><div class="xs muted">${esc(t.type === 'hw' ? 'Form Permintaan Hardware' : EF_KINDS[t.ef.kind].code)}</div></div><div style="text-align:right"><div class="mono">${esc(t.docNo)}</div><div class="xs muted">Tiket #${t.num} · v${t.revs.length}</div></div></div>
    <h4>${esc(t.type === 'hw' ? 'Permintaan Perangkat Keras' : 'Permintaan Akses ' + EF_KINDS[t.ef.kind].label)}</h4>
    <div class="pr"><span class="muted">Nama</span><span>${esc(t.req.name)}</span><span class="muted">Departemen</span><span>${esc(t.req.dept)}</span><span class="muted">Alur persetujuan</span><span>${esc(t.route ? ROUTES[t.route].label : 'Belum ditetapkan IT')}</span></div>
    ${body}
    <div class="sigs" style="grid-template-columns:repeat(4,1fr)">${slot('Pemohon', s.req, t.req.name, true)}${slot('Atasan', s.mgr, t.mgr || '—', needM)}${slot('GM', s.gm, t.gm || '—', needG)}${slot('ICT', s.ict, t.pic || 'ICT', true)}</div>
    <div class="xs faint" style="margin-top:10px;display:flex;justify-content:space-between"><span>QR: ${t.num}/v${t.revs.length}</span><span>Dicetak dari iDesk</span></div></div>`;
}

/* ============================ CREATE ============================ */
const sigPad = () => `<div class="sigpad"><canvas></canvas><span class="ph">Tanda tangan di sini</span><button class="btn sm clr" data-act="clearSig">Hapus</button></div>`;
function bindSigPads() {
  document.querySelectorAll('.sigpad canvas').forEach((cv) => {
    if (cv.dataset.bound) return; cv.dataset.bound = '1';
    const r = cv.getBoundingClientRect(); cv.width = r.width * 2; cv.height = r.height * 2;
    const ctx = cv.getContext('2d'); ctx.scale(2, 2); ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#2D4A8C';
    let drawing = false;
    const pos = (e) => { const b = cv.getBoundingClientRect(); return [e.clientX - b.left, e.clientY - b.top]; };
    cv.onpointerdown = (e) => { drawing = true; cv.setPointerCapture(e.pointerId); const [x,y] = pos(e); ctx.beginPath(); ctx.moveTo(x,y); cv.dataset.signed = '1'; cv.parentElement.querySelector('.ph').hidden = true; };
    cv.onpointermove = (e) => { if (!drawing) return; const [x,y] = pos(e); ctx.lineTo(x,y); ctx.stroke(); };
    cv.onpointerup = () => { drawing = false; };
  });
}
const signed = (root) => Boolean(root.querySelector('.sigpad canvas')?.dataset.signed);

/* ============================ REVISI 2 ============================ */
const MASCOT = '../apps/frontend/public/characters/';
const isPortal = () => S.role !== 'agent';
const PH_ORDER = ['review', 'appr_mgr', 'appr_gm', 'procure', 'delivery', 'schedule', 'install', 'fulfill', 'confirm', 'done'];
const sigTxt = (s) => s ? `${s.how === 'paper' ? 'TTD basah diimpor' : 'TTD digital'} · ${s.at}` : '';
const btn = (act, label, cls = '', icon = '') => `<button class="btn ${cls}" data-act="${act}">${icon ? I(icon) : ''}${label}</button>`;

/* ---- Progres bertahap: tahap besar bernomor, sub-langkah hanya tampil di tahap aktif ---- */
function stagesOf(t) {
  const decided = t.route != null;
  const mgrN = (t.mgr || '—').split(' — ')[0];
  const gmN = (t.gm || 'GM').split(' — ')[0];
  const approval = [
    { k:'review', label:'Review IT', who: t.picked ? `${t.pic} · alur: ${decided ? ROUTES[t.route].label : '-'}` : 'IT meninjau & memilih alur persetujuan' },
    { k:'appr_mgr', label:'Tanda tangan atasan', who: t.sigs.mgr ? `${mgrN} · ${sigTxt(t.sigs.mgr)}` : decided ? mgrN : `${mgrN} · jika diminta IT`, skip: decided && t.route === 'none' },
    { k:'appr_gm', label:'Tanda tangan GM', who: t.sigs.gm ? `${gmN} · ${sigTxt(t.sigs.gm)}` : decided ? gmN : 'Opsional · ditentukan IT', skip: decided && t.route !== 'mgr_gm' },
  ];
  const head = [
    { name:'Pengajuan', subs:[{ k:'_', label:'Diajukan & ditandatangani', who:`${t.req.name} · ${sigTxt(t.sigs.req)}`, forceDone:true }] },
    { name:'Review & persetujuan', subs:approval },
  ];
  const tail = [{ name:'Selesai', subs:[{ k:'confirm', label:'Konfirmasi pemohon', who:'Tiket ditutup setelah pemohon mengonfirmasi' }] }];
  if (t.type === 'hw') {
    const stock = t.hw.fromStock;
    const sch = t.hw.schedule;
    return [...head,
      { name: stock ? 'Barang (dari stok IT)' : 'Pengadaan barang', subs:[
        { k:'procure', label:'Keputusan pengadaan', who:'Vendor, biaya & item disetujui', skip:stock },
        { k:'delivery', label:'Barang tiba', who:'Diterima gudang IT', skip:stock }] },
      { name:'Pemasangan', subs:[
        { k:'schedule', label:'Jadwal disepakati', who: sch?.chosen != null ? sch.slots[sch.chosen] : sch ? 'Pemohon memilih dari usulan IT' : 'IT mengusulkan jadwal' },
        { k:'install', label:'Instalasi', who: t.hw.asset ? `Aset ${t.hw.asset}` : sch?.tech || 'Teknisi IT' }] },
      ...tail];
  }
  return [...head, { name:'Pemberian akses', subs:[{ k:'fulfill', label: t.ef.cred ? 'Kredensial diberikan' : 'Akses diaktifkan IT', who: t.pic || 'Tim IT' }] }, ...tail];
}
function subState(t, s) {
  if (s.forceDone) return 'done';
  if (s.skip) return 'skip';
  if (t.phase === 'done') return 'done';
  const cur = t.phase === 'rejected' ? t.rejAt : t.phase;
  const a = PH_ORDER.indexOf(s.k);
  const b = PH_ORDER.indexOf(cur);
  if (a < b) return 'done';
  if (a === b) return t.phase === 'rejected' ? 'no' : 'cur';
  return 'future';
}
function stageInfo(t) {
  const stages = stagesOf(t).map((g) => {
    const subs = g.subs.map((s) => ({ ...s, state: subState(t, s) }));
    const live = subs.filter((s) => s.state !== 'skip');
    let state = 'future';
    if (live.some((s) => s.state === 'no')) state = 'no';
    else if (live.some((s) => s.state === 'cur')) state = 'cur';
    else if (live.every((s) => s.state === 'done')) state = 'done';
    return { ...g, subs, state, skipped: live.length === 0 };
  });
  const i = stages.findIndex((g) => g.state === 'cur' || g.state === 'no');
  return { stages, curIdx: i < 0 ? stages.length - 1 : i };
}
function progressCard(t) {
  const { stages, curIdx } = stageInfo(t);
  const label = t.phase === 'done' ? 'Selesai' : `Tahap ${curIdx + 1} dari ${stages.length}`;
  const subList = (g) => `<ul class="subs">${g.subs.map((s) => `<li class="sub ${s.state}"><i>${s.state === 'done' ? I('check') : s.state === 'no' ? I('x') : ''}</i><div><b>${esc(s.label)}</b><span>${esc(s.state === 'skip' ? 'Tidak diperlukan' : s.who || '')}</span></div></li>`).join('')}</ul>`;
  const body = (g) => {
    if (g.skipped) return '<small>Dilewati</small>';
    if (g.state === 'cur' || g.state === 'no') return subList(g);
    if (g.state === 'done') return `<small>${esc(g.subs.filter((s) => s.state === 'done').map((s) => s.who || s.label).slice(-1)[0] || '')}</small>`;
    return `<small>${esc(g.subs.filter((s) => s.state !== 'skip').map((s) => s.label).join(' · '))}</small>`;
  };
  return `<div class="ic-card pcard ${t.type} ann" data-ann="Progres bertahap (ganti tracker)"><h3>${I('listCheck')}Progres <span class="r muted">${label}</span></h3>
    <ol class="stages">${stages.map((g, i) => `<li class="stg s-${g.skipped ? 'done' : g.state}"><span class="sn">${g.state === 'done' || g.skipped ? I('check') : g.state === 'no' ? I('x') : i + 1}</span><div class="sbd"><div class="shh"><b>${esc(g.name)}</b>${g.state === 'cur' ? '<span class="nowb">Sekarang</span>' : ''}</div>${body(g)}</div></li>`).join('')}</ol></div>`;
}

/* ---- Satu bar "langkah berikutnya" di bawah header (pengganti tracker + dock) ---- */
/* ---- Detail ---- */
/* ---- Panel kanan Hardware/E-Form: progres dulu, lalu isi permintaan, dokumen, detail ---- */
/* ---- Portal pemohon/approver: meniru ClientLayout + BentoMyTicketsPage asli ---- */
function renderPortalTop() {
  const p = me();
  const appr = ['mgr', 'gm'].includes(S.role);
  const need = visibleTickets().filter(needsMe).length;
  const onList = S.screen !== 'create';
  const tab = (act, v, tone, icon, label, on, badge) => `<span class="ptab ${tone} ${on ? 'on' : ''}" data-act="${act}" data-v="${v}"><span class="ptile">${I(icon)}</span>${label}${badge ? `<em>${badge}</em>` : ''}</span>`;
  $('#top').innerHTML = `<div class="pbrand"><span class="logo">${I('monitor')}</span><b>iDesk</b></div>
    <nav class="ptabs ann" data-ann="Tab Hardware & E-Form dihapus → masuk Tiket Saya">${tab('navScope', 'all', 't-blue', 'ticket', 'Tiket Saya', onList && S.scope !== 'approve')}${appr ? tab('navScope', 'approve', 't-mint', 'pen', 'Persetujuan', onList && S.scope === 'approve', need) : ''}${tab('noop', '', 't-sky', 'video', 'Zoom', false)}${tab('noop', '', 't-brown', 'book', 'Bantuan', false)}</nav>
    <button class="btn-cta" data-act="goCreate">${I('plus')}Buat Tiket Baru</button><button class="ib">${I('moon')}</button><button class="ib">${I('bell')}</button>
    <span class="pacct">${av(p.ini, p.color, 'sm')}<span><b>${esc(p.name)}</b><small>${esc(p.sub)}</small></span>${I('chev')}</span>`;
}
const STATUS_GROUP = { '':() => true, TODO:(s) => s === 'TODO', HANDLING:(s) => ['IN_PROGRESS', 'WAITING_VENDOR'].includes(s), DONE:(s) => ['RESOLVED', 'CLOSED'].includes(s), CANCELLED:(s) => s === 'CANCELLED' };
function renderPortalList() {
  const appr = S.scope === 'approve';
  const base = appr ? visibleTickets() : S.role === 'req' ? visibleTickets() : [];
  const q = S.q.trim().toLowerCase();
  const rows = base.filter((t) => (!S.type || t.type === S.type) && STATUS_GROUP[S.pst || '']?.(statusOf(t)) !== false && (!q || `${t.num} ${t.title}`.toLowerCase().includes(q)));
  const stat = (k, tone, icon, label, v) => `<button class="pstat k-${tone} ${(S.pst || '') === k ? 'on' : ''}" data-act="pStatus" data-v="${k}"><span class="pst"><span class="psi">${I(icon)}</span><b>${v}</b></span><span class="psl">${label}</span></button>`;
  const cnt = (k) => base.filter((t) => STATUS_GROUP[k](statusOf(t))).length;
  const typeSeg = [['', 'Semua', 'grid'], ['it', 'IT Support', 'ticket'], ['hw', 'Hardware', 'hw'], ['ef', 'E-Form', 'ef']];
  let html = `<div class="pwrap"><div class="phead"><div><h1>${appr ? 'Persetujuan' : 'Tiket Saya'} <span class="plive"><i></i>Live</span></h1><p class="muted small">${appr ? 'Permintaan yang membutuhkan tanda tangan Anda' : 'Pantau tiket bantuan dan pengajuan yang Anda buat'}</p></div><button class="btn">${I('refresh')}Muat ulang</button></div>`;
  if (!appr) html += `<div class="phelp" data-act="goCreate"><img src="${MASCOT}mascot-service.png" alt=""><div class="pc"><b>Ada kendala IT atau butuh perangkat/akses?</b><span>Laporkan masalah, minta hardware, atau ajukan akses dari satu tempat.</span></div><span class="plink">Buat tiket ${I('fwd')}</span></div>` + activeAccessCard();
  html += appr
    ? `<div class="pstats c2">${stat('', 'ef', 'pen', 'Menunggu tanda tangan Anda', base.filter(needsMe).length)}${stat('DONE', 'green', 'checkC', 'Sudah selesai', cnt('DONE'))}</div>`
    : `<div class="pstats">${stat('', 'neutral', 'grid', 'Total', base.length)}${stat('TODO', 'sky', 'inbox', 'Open', cnt('TODO'))}${stat('HANDLING', 'navy', 'circleDot', 'Dalam penanganan', cnt('HANDLING'))}${stat('DONE', 'green', 'checkC', 'Selesai', cnt('DONE'))}</div>`;
  html += `<div class="pfilters"><label class="field" style="max-width:520px">${I('search')}<input id="q" value="${esc(S.q)}" placeholder="Cari judul atau nomor tiket"></label>
    <div class="pseg ann" data-ann="BARU · filter tipe">${typeSeg.map(([v, l, ic]) => `<button class="${S.type === v ? 'on' : ''}" data-act="setType" data-v="${v}">${v ? I(ic) : ''}${l}</button>`).join('')}</div></div>
    <p class="phint">${I('info')}Klik tiket untuk melihat percakapan, status terbaru, dan membalas petugas IT.</p>
    <div class="ptable"><div class="prow phd"><div>Tiket</div><div>Prioritas</div><div>Status</div><div>Ditangani oleh</div><div>Diperbarui</div><div></div></div>`;
  if (!rows.length) html += `<div class="empty">${I('inbox')}<p>${appr ? 'Tidak ada permintaan persetujuan' : 'Belum ada tiket'}</p></div>`;
  rows.forEach((t) => {
    const st = statusOf(t);
    const sub = phaseSub(t);
    const need = needsMe(t);
    html += `<div class="prow ${need ? 'need' : ''}" data-act="open" data-v="${t.id}">
      <div style="min-width:0"><div class="tnum"><span class="mono">#${t.num}</span>${tag(t.type)}${need ? `<span class="needchip">${I('pen')}Perlu tindakan Anda</span>` : ''}</div><div class="ttitle">${esc(t.title)}</div>${appr ? `<span class="xs muted">Pemohon: ${esc(t.req.name)} · ${esc(t.req.dept)}</span>` : ''}</div>
      <div>${prioPill(t.prio, false)}</div>
      <div class="st-wrap">${statusPill(st, true, false)}${sub && !['CLOSED', 'CANCELLED'].includes(st) ? `<span class="phase-sub ${t.type}">${I(TYPES[t.type].icon)}${esc(sub)}</span>` : ''}</div>
      <div>${t.pic ? `<span class="pic">${av(t.pic.split(' ').map((w) => w[0]).slice(0, 2).join(''), '#334155', 'xs')}<span class="nm">${esc(t.pic)}</span></span>` : '<span class="faint small"><i>Belum ditangani</i></span>'}</div>
      <div class="small muted">${esc(t.created)}</div><div><span class="popen">Buka ${I('chevR')}</span></div></div>`;
  });
  html += `</div></div>`;
  $('#sheet').className = 'sheet';
  $('#sheet').innerHTML = html;
  const qi = $('#q');
  qi.oninput = () => { S.q = qi.value; const pos = qi.selectionStart; render(); const nq = $('#q'); nq.focus(); nq.setSelectionRange(pos, pos); };
}

/* ---- Buat Tiket: katalog asli (2 seksi + maskot), Hardware & E-Form sekarang membuat tiket ---- */
const CT_CARDS = [
  { k:'service', sec:1, title:'Service Ticket', desc:'Laporkan masalah hardware, software, jaringan, atau kebutuhan IT support umum lainnya.', img:'mascot-service.png', cta:'Buat Service Ticket', tone:'t-blue', icon:'ticket' },
  { k:'oracle', sec:1, title:'Oracle / K2 Request', desc:'Bantuan sistem Oracle, update role K2, transaksi modul, atau kendala ERP.', img:'mascot-oracle.png', cta:'Buat Tiket Oracle', tone:'t-red', icon:'nas' },
  { k:'web', sec:1, title:'Web Developer Request', desc:'Permintaan bug fix, fitur baru, integrasi web portal, atau kendala performa web.', img:'mascot-webdev.png', cta:'Buat Tiket Web Dev', tone:'t-teal', icon:'globe' },
  { k:'mobile', sec:1, title:'Mobile Developer Request', desc:'Permintaan perbaikan crash aplikasi, update APK, notifikasi, atau fitur app mobile.', img:'mascot-mobiledev.png', cta:'Buat Tiket Mobile Dev', tone:'t-tealdeep', icon:'monitor' },
  { k:'hw', sec:2, title:'Hardware Request', desc:'Ajukan perangkat baru, upgrade, penggantian aset, atau penjadwalan pemasangan.', img:'mascot-hardware.png', cta:'Buat Hardware Request', tone:'t-orange', icon:'hw' },
  { k:'ef', sec:2, title:'E-Form Request', desc:'Minta akses VPN, website, network, email, flashdisk, atau folder NAS dengan form bertanda tangan.', img:'mascot-access.png', cta:'Buat E-Form Request', tone:'t-mint', icon:'ef' },
];
function renderCreate() {
  const c = CT_CARDS.find((x) => x.k === S.createType);
  let html;
  if (!c) {
    const card = (x) => `<article class="ctc" data-act="pickType" data-v="${x.k}"><div class="ctx"><h3>${esc(x.title)}${['hw', 'ef'].includes(x.k) ? tag(x.k) : ''}</h3><p>${esc(x.desc)}</p><span class="ctl">${esc(x.cta)} ${I('fwd')}</span></div><img src="${MASCOT}${x.img}" alt=""></article>`;
    html = `<div class="ctp"><div class="ct-top"><div class="ct-head"><button class="back" data-act="back">${I('chevL')}</button><div><h1>Buat Tiket Baru</h1><p class="muted small">Pilih jenis bantuan atau pengajuan yang Anda butuhkan</p></div></div>
        <label class="field ct-search">${I('search')}<input placeholder="Cari jenis bantuan, misal: printer, VPN, Oracle"></label></div>
      <section class="cts"><h2>Bantuan & kendala teknis</h2><p class="muted">Masalah harian, bug aplikasi, atau kendala perangkat kerja</p><div class="ctg g4">${CT_CARDS.filter((x) => x.sec === 1).map(card).join('')}</div></section>
      <section class="cts ann" data-ann="Sekarang membuat tiket (dulu pindah ke modul lain)"><h2>Pengajuan layanan & akses</h2><p class="muted">Pengadaan perangkat atau hak akses — diproses sebagai tiket IT Support dengan alur persetujuan</p><div class="ctg g2">${CT_CARDS.filter((x) => x.sec === 2).map(card).join('')}</div></section></div>`;
  } else {
    const form = c.k === 'hw' ? formHW() : c.k === 'ef' ? formEF() : formTicket(c);
    html = `<div class="ctp form"><button class="ct-backlink" data-act="pickType" data-v="">${I('back')}Ganti jenis tiket</button>
      <div class="ct-fhead"><span class="ptile big ${c.tone}">${I(c.icon)}</span><div><h1>${esc(c.title)}${['hw', 'ef'].includes(c.k) ? tag(c.k, true) : ''}</h1><p class="muted small">${esc(c.desc)}</p></div></div>
      <div class="form">${form}</div></div>`;
  }
  $('#sheet').className = 'sheet';
  $('#sheet').innerHTML = html;
  bindSigPads(); bindPicker();
}
function formTicket(c) {
  return `<div class="note" style="margin:0 0 6px">${I('info')}<span>Form ${esc(c.title)} <b>tidak berubah</b> dari yang sekarang (template, prioritas, lampiran). Disederhanakan di mockup.</span></div>
    <label class="fl">Judul <em>*</em></label><input class="fi-in" id="fTitle" placeholder="Ringkasan masalah">
    ${c.k === 'service' ? `<label class="fl">Kategori</label><div class="radios" data-group="cat">${['General', 'Hardware', 'Software', 'Network'].map((x, i) => `<span class="radio ${i === 0 ? 'on' : ''}" data-act="radio" data-v="${x}">${x}</span>`).join('')}</div>` : ''}
    <label class="fl">Deskripsi</label><textarea class="fi-in" id="fDesc" placeholder="Jelaskan detailnya"></textarea>
    <div class="ffoot"><button class="btn" data-act="pickType" data-v="">Batal</button><button class="btn navy" data-act="submitCreate">${I('up')}Kirim tiket</button></div>`;
}

/* ============================ REVISI 3: satu tombol utama + editor barang ============================ */
const ITEM_EDIT_PHASES = ['review', 'appr_mgr', 'appr_gm', 'procure', 'delivery', 'schedule'];
const canEditItems = (t) => S.role === 'agent' && t.type === 'hw' && ITEM_EDIT_PHASES.includes(t.phase);
const firstName = (s) => esc((s || '').split(' — ')[0]);
const CATALOG = [
  { code:'LAPTOP_STD', cat:'LAPTOP', name:'Laptop Standar i5/16GB/512GB', spec:'Windows 11 Pro, Office' },
  { code:'LAPTOP_DESIGN', cat:'LAPTOP', name:'Laptop Design i7/32GB/1TB', spec:'GPU dedicated' },
  { code:'LAPTOP_I7', cat:'LAPTOP', name:'Laptop Standar i7/16GB/1TB', spec:'Windows 11 Pro, Office' },
  { code:'PC_OFFICE', cat:'DESKTOP', name:'PC Office i5', spec:'Windows 11 Pro' },
  { code:'MONITOR_24', cat:'MONITOR', name:'Monitor 24" FHD', spec:'1920x1080 IPS' },
  { code:'MONITOR_27', cat:'MONITOR', name:'Monitor 27" QHD', spec:'2560x1440 IPS' },
  { code:'MOUSE_STD', cat:'ACCESSORY', name:'Mouse wireless', spec:'-' },
  { code:'KEYBOARD_STD', cat:'ACCESSORY', name:'Keyboard Standar', spec:'USB' },
  { code:'KBM_MK270', cat:'ACCESSORY', name:'Keyboard + Mouse Logitech MK270', spec:'Wireless' },
  { code:'HEADSET_STD', cat:'ACCESSORY', name:'Headset', spec:'USB' },
  { code:'CABLE_LAN', cat:'NETWORK', name:'Kabel LAN', spec:'Cat6' },
  { code:'AP_STD', cat:'NETWORK', name:'Access Point', spec:'Wi-Fi 6' },
  { code:'LICENSE_GENERIC', cat:'SOFTWARE', name:'Lisensi Software', spec:'Isi nama software & jumlah seat' },
  { code:'SCAN_ZEBRA', cat:'SCANNER', name:'Scanner barcode Zebra DS2208', spec:'USB' },
];
const catIcon = (k) => (HW_CATS.find((c) => c.k === k) || HW_CATS[7]).icon;

/* ---- Katalog + keranjang: dipakai form pengajuan (pemohon) dan editor barang (IT) ---- */
function refreshPicker() {
  const host = $('#pickerHost'); if (!host) return;
  const focused = document.activeElement?.id === 'pkQ'; const pos = focused ? document.activeElement.selectionStart : 0;
  host.innerHTML = pickerHtml(); bindPicker();
  if (focused) { const q = $('#pkQ'); q.focus(); q.setSelectionRange(pos, pos); }
}
function nextOf(t) {
  const r = S.role;
  const p = t.phase;
  const X = (o) => ({ tone:t.type, ...o });
  const P1 = (act, label, icon, cls) => ({ act, label, icon, cls:cls ?? (t.type === 'hw' ? 'hwb' : 'efb') });
  const reqN = esc(t.req.name);
  if (p === 'done' && t.type === 'ef' && r === 'req') return X({ tone:'nv', icon:'key', title:t.ef.to ? `Akses aktif sampai ${fmtD(new Date(t.ef.to))}` : 'Akses aktif (permanen)', sub:'Kami ingatkan H-7, H-3 dan di hari terakhir.', primary:t.ef.to ? P1('renew', 'Perpanjang akses', 'refresh') : null, second:t.ef.cred ? P1('showCred', 'Lihat kredensial', 'key', '') : null, more:[{ act:'tabDoc', label:'Dokumen final', icon:'fileCheck' }] });
  if (p === 'done') return X({ tone:'nv', icon:'checkC', title:'Tiket selesai', sub:'Semua tanda tangan tersimpan di dokumen final.', second:P1('tabDoc', 'Lihat dokumen final', 'fileCheck', '') });
  if (p === 'rejected') return X({ tone:'nv', icon:'xC', title:'Permintaan ditolak', sub:'Alasannya ada di percakapan. Silakan buat tiket baru bila masih dibutuhkan.' });
  if (r === 'agent') {
    const editMore = canEditItems(t) ? [{ act:'editItems', label:'Ubah / ganti barang', icon:'pen' }] : [];
    switch (p) {
      case 'review': return X({ mine:true, icon:'shield', title:'Tinjau permintaan ini', sub:'Periksa barang, ubah bila perlu, lalu pilih siapa yang harus menyetujui.', primary:P1('review', 'Tinjau sekarang', 'shield'), more:[{ act:'rejectIT', label:'Tolak permintaan', icon:'xC', danger:true }] });
      case 'appr_mgr': case 'appr_gm': return X({ tone:'nv', icon:'pen', title:`Menunggu tanda tangan ${firstName(p === 'appr_mgr' ? t.mgr : t.gm)}`, sub:'Tidak ada yang perlu Anda lakukan. Bila beliau tanda tangan di kertas, pakai "TTD kertas".', second:P1('remind', 'Ingatkan', 'bell', ''), more:[{ act:'paper', label:'TTD kertas (unduh & unggah)', icon:'upload' }, ...editMore] });
      case 'procure': return X({ mine:true, icon:'package', title:'Catat pembelian barang', sub:'Isi vendor & biaya. Barang tidak tersedia? Ganti dulu lewat "Ubah barang".', primary:P1('procure', 'Catat pembelian', 'package'), second:P1('editItems', 'Ubah barang', 'pen', '') });
      case 'delivery': return X({ mine:true, icon:'truck', title:'Barang sudah sampai di IT?', sub:'Tekan setelah barang diterima gudang IT.', primary:P1('arrived', 'Ya, barang sudah tiba', 'truck'), more:editMore });
      case 'schedule': return t.hw.schedule && t.hw.schedule.chosen == null
        ? X({ tone:'nv', icon:'cal', title:`Menunggu ${reqN} memilih jadwal`, sub:`Usulan: ${esc(t.hw.schedule.slots.join(' / '))}`, more:[{ act:'pickSlot', label:'Pilih atas nama pemohon', icon:'cal' }, ...editMore] })
        : X({ mine:true, icon:'cal', title:t.hw.resched ? `Pemohon minta waktu lain (${t.hw.resched}/${RESCHEDULE_LIMIT})` : 'Usulkan jadwal pemasangan', sub:t.hw.resched ? `Permintaan: “${esc(t.hw.lastAsk || '')}”. Kirim pilihan waktu baru.` : 'Pilih teknisi dan 1–3 pilihan waktu; pemohon tinggal memilih.', primary:P1('schedule', 'Usulkan jadwal', 'cal'), more:editMore });
      case 'install': return t.started
        ? X({ mine:true, icon:'wrench', title:'Pemasangan sedang berjalan', sub:'Selesai? Catat barcode aset dan foto serah terima.', primary:P1('installDone', 'Selesaikan pemasangan', 'barcode') })
        : X({ mine:true, icon:'wrench', title:`Pemasangan ${esc(t.hw.schedule.slots[t.hw.schedule.chosen])}`, sub:`Teknisi ${esc(t.hw.schedule.tech)}. Tekan saat mulai bekerja di lokasi.`, primary:P1('startInstall', 'Mulai pemasangan', 'wrench'), more:[{ act:'reschedule', label:'Ubah jadwal', icon:'cal' }] });
      case 'fulfill': return X({ mine:true, icon:'key', title:'Berikan akses', sub:'Aktifkan akses di sistem, lalu simpan kredensialnya di sini (terenkripsi).', primary:P1('fulfill', ['SYNOLOGY_NAS', 'WEBSITE'].includes(t.ef.kind) ? 'Akses sudah aktif' : 'Isi kredensial', 'key') });
      case 'confirm': return X({ tone:'nv', icon:'hourglass', title:`Menunggu konfirmasi ${reqN}`, sub:'Tiket tertutup otomatis setelah 1 hari kerja tanpa respons.', more:[{ act:'confirmOnBehalf', label:'Konfirmasi atas nama pemohon', icon:'check' }] });
      default: return null;
    }
  }
  if (r === 'req') {
    if (p === 'schedule' && t.hw?.schedule && t.hw.schedule.chosen == null) return X({ mine:true, icon:'cal', title:'Pilih waktu pemasangan', sub:'IT mengusulkan 2 waktu. Pilih yang Anda bisa, atau minta waktu lain.', primary:P1('pickSlot', 'Pilih waktu', 'cal', 'navy') });
    if (p === 'confirm') return t.type === 'hw'
      ? X({ mine:true, icon:'checkC', title:'Apakah perangkat sudah terpasang dan berfungsi?', sub:'Tekan "Ya" untuk menutup tiket. Ada masalah? Pilih "Ada kendala".', primary:P1('confirm', 'Ya, sudah berfungsi', 'check', 'green'), second:P1('reportIssue', 'Ada kendala', 'alert', '') })
      : X({ mine:true, icon:'key', title:'Akses Anda sudah aktif — silakan dicoba', sub:'Berhasil login? Tekan "Ya". Gagal? Pilih "Ada kendala".', primary:P1('confirm', 'Ya, berhasil', 'check', 'green'), second:P1('reportIssue', 'Ada kendala', 'alert', ''), more:t.ef.cred ? [{ act:'showCred', label:'Lihat kredensial', icon:'eye' }] : [] });
  }
  if ((r === 'mgr' && p === 'appr_mgr') || (r === 'gm' && p === 'appr_gm')) {
    return X({ mine:true, icon:'pen', title:`${reqN} meminta persetujuan Anda`, sub:'Tekan tombol hijau untuk melihat ringkasan, lalu setujui atau tolak di sana. Ada pertanyaan? Tulis di chat.', primary:P1('approve', 'Periksa & setujui', 'pen', 'green') });
  }
  const turn = turnOf(t);
  return turn ? X({ tone:'nv', icon:'hourglass', title:`Sedang diproses: menunggu ${esc(turn.who)}`, sub:'Tidak ada yang perlu Anda lakukan sekarang. Anda akan diberi notifikasi.' }) : null;
}
function nextBar(t) {
  if (t.type === 'it') return '';
  const x = nextOf(t);
  if (!x) return '';
  const { stages, curIdx } = stageInfo(t);
  const stage = ['done', 'rejected'].includes(t.phase) ? (t.phase === 'done' ? 'Selesai' : 'Ditolak') : `Tahap ${curIdx + 1}/${stages.length} · ${stages[curIdx].name}`;
  const b = (o, extra = '') => `<button class="btn ${o.cls} ${extra}" data-act="${o.act}">${o.icon ? I(o.icon) : ''}${o.label}</button>`;
  const more = (x.more || []).filter(Boolean);
  const menu = S.openMenu === 'next' ? `<div class="menu right">${more.map((m) => `<button class="${m.danger ? 'danger' : ''}" data-act="${m.act}">${I(m.icon)}${m.label}</button>`).join('')}</div>` : '';
  const who = x.mine ? `<span class="yourturn">${I('user')}Giliran Anda</span>` : `<span class="waiting">${I('hourglass')}Bukan giliran Anda</span>`;
  return `<div class="next ${x.mine ? 'mine' : x.tone}"><span class="dic">${I(x.icon)}</span>
    <div class="dt"><span class="dstage">${who}<span>${esc(stage)}</span></span><b>${x.title}</b><span class="ds">${x.sub}</span></div>
    <div class="dbtns">${more.length ? `<div class="pop"><button class="btn ghost" data-act="menu" data-v="next" title="Aksi lain">${I('more')}Lainnya</button>${menu}</div>` : ''}${x.second ? b(x.second) : ''}${x.primary ? b(x.primary, 'primary ann" data-ann="Satu tombol utama') : ''}</div></div>`;
}

/* ---- Header: aksi jarang dipakai masuk ke menu "⋯" ---- */
function headerActions(t, open) {
  const isAgent = S.role === 'agent';
  if (t.type === 'it') return isAgent && open ? `<button class="btn redsoft">${I('xC')}Batalkan</button><button class="btn navy">${I('fwd')}Teruskan</button><button class="btn green">${I('checkC')}Selesaikan</button><button class="btn">${I('lock')}Catatan Internal (0)</button>` : '';
  const items = [];
  if (open && (isAgent || (S.role === 'req' && ['review', 'appr_mgr', 'appr_gm'].includes(t.phase)))) items.push(`<button class="danger" data-act="cancelReq">${I('xC')}Batalkan tiket</button>`);
  items.push(`<button data-act="export">${I('download')}Unduh dokumen PDF</button>`);
  const menu = S.openMenu === 'head' ? `<div class="menu right">${items.join('')}</div>` : '';
  return (isAgent ? `<button class="btn">${I('lock')}Catatan Internal (0)</button>` : '') + `<div class="pop"><button class="back" data-act="menu" data-v="head" title="Aksi lain">${I('more')}</button>${menu}</div>`;
}

function renderDetail() {
  const t = T(S.sel);
  if (!t) { S.screen = 'list'; return render(); }
  const st = statusOf(t);
  const isIT = t.type === 'it';
  const nMsg = t.msgs.filter((m) => m.k === 'msg').length;
  const tabs = isIT ? [['chat', 'msg', 'Percakapan', nMsg], ['act', 'history', 'Aktivitas']]
    : [['chat', 'msg', 'Percakapan', nMsg], ['info', t.type === 'hw' ? 'package' : 'ef', 'Rincian'], ['doc', 'fileCheck', 'Dokumen', `v${t.revs.length}`], ['act', 'history', 'Aktivitas']];
  if (!tabs.find((x) => x[0] === S.tab)) S.tab = 'chat';
  const open = !['CLOSED', 'CANCELLED'].includes(st);
  const slaChip = ['RESOLVED', 'CLOSED', 'CANCELLED'].includes(st) ? '' : isPaused(t) ? `<span class="pill p-paused" title="Waktu SLA IT tidak berjalan saat menunggu pihak lain">${I('pause')}SLA dijeda</span>` : `<span class="pill p-amber">${I('hourglass')}${esc(t.sla.due)} · ${esc(t.sla.left)}</span>`;
  const stateChip = isIT ? statusPill(st, false, false) : `<span class="phase ${t.type}"><span class="dot"></span>${esc(t.phase === 'done' ? 'Selesai' : t.phase === 'rejected' ? 'Ditolak' : phaseSub(t))}</span>`;
  const head = `<div class="dhead">
    <div class="dh1"><button class="back" data-act="back">${I('chevL')}</button><span class="numchip">#${t.num}${I('copy')}</span>${tag(t.type, true)}${stateChip}${slaChip}${prioPill(t.prio, false)}</div>
    <div class="dh2"><h1>${esc(t.title)}</h1>${headerActions(t, open)}<button class="back" data-act="toggleInsp" title="Panel info">${I('panel')}</button></div>
    <div class="tabs">${tabs.map(([k, ic, l, n]) => `<button class="${S.tab === k ? 'on' : ''}" data-act="tab" data-v="${k}">${I(ic)}${l}${n != null ? `<span class="n ${k === 'doc' ? 'warn' : ''}">${n}</span>` : ''}</button>`).join('')}</div></div>`;
  let body = nextBar(t);
  if (S.tab === 'chat') {
    if (isIT) body += `<div class="pinbar">${I('pin')}<div style="min-width:0"><b>${esc(t.title)}</b><span>${esc(t.desc || 'Tidak ada deskripsi')}</span></div><span class="live">${I('wifi')}Live</span></div>`;
    body += `<div class="chat" id="chat">${t.msgs.map(renderMsg).join('')}</div>`;
    const ph = !open ? 'Tiket ditutup — chat terkunci' : S.role === 'agent' ? 'Balas ke pemohon…' : S.role === 'req' ? 'Tulis pesan ke IT…' : 'Tanya ke pemohon / IT sebelum menyetujui…';
    body += `<div class="compose" style="margin-top:10px"><div class="in">${I('plus')}<input id="msgIn" ${!open ? 'disabled' : ''} placeholder="${ph}">${I('zap')}</div><button class="send" data-act="send" title="Kirim">${I('up')}</button></div>
      <div class="hint"><b>Enter</b> kirim · <b>Shift+Enter</b> baris baru · <b>Ctrl+V</b> tempel gambar</div>`;
  } else if (S.tab === 'info') body += `<div class="pane">${renderInfo(t)}</div>`;
  else if (S.tab === 'doc') body += `<div class="pane">${renderDocPane(t)}</div>`;
  else body += `<div class="pane"><div class="sec"><h2>${I('history')}Aktivitas</h2><div class="act-l">${activityOf(t).map((a) => `<div class="ae">${a.text}<span>${esc(a.at)}</span></div>`).join('')}</div></div></div>`;
  $('#sheet').className = 'sheet full';
  $('#sheet').innerHTML = `<div class="detail"><section class="dsurf">${head}${body}</section>${S.insp ? `<aside class="insp">${renderInspector(t)}</aside>` : ''}</div>`;
  const chat = $('#chat'); if (chat) chat.scrollTop = chat.scrollHeight;
  const mi = $('#msgIn'); if (mi) mi.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); } };
  bindSigPads();
}

/* ---- Barang: tampilkan riwayat ganti, tombol "Ubah" untuk IT ---- */
function renderInspector(t) {
  if (t.type === 'it') return inspectorIT(t);
  const isAgent = S.role === 'agent';
  const st = statusOf(t);
  let h = progressCard(t);
  if (t.type === 'hw') {
    h += `<div class="ic-card ${canEditItems(t) ? 'ann' : ''}" ${canEditItems(t) ? 'data-ann="IT bisa ubah/ganti barang"' : ''}><h3>${I('hw')}Barang diminta <span class="r">${canEditItems(t) ? `<button class="btn sm" data-act="editItems">${I('pen')}Ubah barang</button>` : `<span class="muted">${esc(t.hw.kind)}</span>`}</span></h3>${hwItemsHtml(t)}
      <div class="kvr"><span>Untuk</span><span class="val">${esc(t.hw.recipient)}</span></div>${t.hw.asset ? `<div class="kvr"><span>${I('barcode')}Aset</span><span class="val mono">${esc(t.hw.asset)}</span></div>` : ''}</div>`;
  } else {
    const k = EF_KINDS[t.ef.kind];
    h += `<div class="ic-card"><h3>${I(k.icon)}Akses diminta <span class="r muted">${k.label}</span></h3>${Object.entries(t.ef.fields).filter(([a]) => a !== 'Masa berlaku').map(([a, b]) => `<div class="kvr"><span>${esc(a)}</span><span class="val">${esc(b)}</span></div>`).join('')}
      <div class="kvr"><span>${I('cal')}Masa berlaku</span><span class="val">${t.ef.to ? fmtD(new Date(t.ef.to)) : 'Permanen'} ${t.phase === 'done' ? expiryBadge(t.ef.to) : ''}</span></div>
      ${t.ef.cred && (isAgent || S.role === 'req') ? `<div class="kvr"><span>${I('key')}Kredensial</span><button class="btn sm" data-act="showCred">${I('eye')}Lihat</button></div>` : ''}</div>`;
  }
  h += `<div class="ic-card"><h3>${I('fileCheck')}Dokumen</h3>
    <button class="docmini" data-act="tabDoc" style="width:100%;text-align:left;cursor:pointer"><span class="fi">${I('ef')}<em>v${t.revs.length}</em></span><div style="min-width:0;flex:1"><b>${esc(docTitle(t))}</b><span>${esc(t.revs.at(-1).label)}</span></div>${I('chevR')}</button></div>`;
  h += `<div class="ic-card"><h3>Detail tiket</h3>
    <div class="who" style="margin-bottom:8px">${av(t.req.ini, t.req.color)}<div style="min-width:0"><b style="text-transform:none">${esc(t.req.name)}</b><span style="text-transform:none">Pemohon · ${esc(t.req.dept)}</span></div></div>
    <div class="kvr"><span>PIC</span><span class="sel">${esc(t.pic || 'Belum ada')}${isAgent ? I('chev') : ''}</span></div>
    <div class="kvr"><span>Status tiket</span>${statusPill(st, false, false)}</div>
    <div class="kvr"><span>Prioritas</span>${prioPill(t.prio, isAgent)}</div>
    <div class="kvr"><span>Alur persetujuan</span><span class="val">${t.route ? ROUTES[t.route].label : 'Belum ditetapkan'}</span></div>
    <div class="kvr"><span>No. dokumen</span><span class="val mono">${esc(t.docNo)} ${isAgent && !['done', 'rejected'].includes(t.phase) ? `<button class="btn sm ghost" data-act="editDocNo" title="Ubah nomor">${I('pen')}</button>` : ''}</span></div>
    ${t.hw ? `<div class="kvr"><span>Sumber barang</span><span class="val">${esc(t.hw.kind || 'Ditentukan IT saat review')}</span></div><div class="kvr"><span>Divisi</span><span class="val">${esc(t.hw.division || t.req.dept)}</span></div>` : ''}</div>`;
  return h;
}

/* ---- Editor barang (IT) ---- */
function itemRow() { return ''; }
function mEditItems(t) {
  S.pickerMode = 'edit'; S.basket = basketFromItems(t.hw.items); S.pq = ''; S.pcat = ''; S.swapIdx = null;
  modal(`${I('pen')} Ubah / ganti barang`, `<p class="muted small" style="margin-bottom:10px">Tambah barang dari katalog, ubah jumlah, hapus, atau tekan <b>Ganti</b> untuk menukar dengan barang lain. Pemohon melihat perubahan ini di chat.</p>
    <div id="pickerHost">${pickerHtml()}</div>
    <label class="fl">Alasan perubahan <em>*</em></label><input class="fi-in" id="edWhy" placeholder="Contoh: stok i5/16GB kosong, diganti i7 dengan harga sama">
    ${t.sigs.mgr || t.sigs.gm ? `<div class="note warn">${I('alert')}<span>Sudah ada tanda tangan atasan/GM. Perubahan dicatat sebagai versi dokumen baru dan atasan diberi tahu.</span></div>` : ''}`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn hwb" data-act="doEditItems">${I('check')}Simpan perubahan</button>`, true);
  bindPicker();
}

/* ---- Persetujuan atasan/GM: ringkasan dulu, satu keputusan ---- */
function mSign(t) {
  const who = S.role === 'mgr' ? 'Atasan' : 'GM';
  const what = t.type === 'hw'
    ? `<ul class="sumlist">${t.hw.items.map((it) => `<li><b>${it.qty}× ${esc(it.name)}</b>${it.was ? ` <span class="muted">(pengganti ${esc(it.was)})</span>` : ''}</li>`).join('')}</ul>`
    : `<ul class="sumlist">${Object.entries(t.ef.fields).map(([a, b]) => `<li><span class="muted">${esc(a)}:</span> <b>${esc(b)}</b></li>`).join('')}</ul>`;
  modal(`${I('pen')} Persetujuan ${who}`, `<div class="sumcard"><div class="sumh">${av(t.req.ini, t.req.color)}<div><b>${esc(t.req.name)}</b><span>${esc(t.req.dept)} · meminta ${t.type === 'hw' ? 'perangkat' : 'akses ' + EF_KINDS[t.ef.kind].label}</span></div></div>
      <div class="sumrow"><span>Yang diminta</span>${what}</div>
      <div class="sumrow"><span>Alasan</span><b>${esc(t.desc || '-')}</b></div>
      <a class="small" data-act="tabDoc" style="cursor:pointer;color:var(--sapphire);font-weight:600">${I('eye')} Lihat dokumen lengkap</a></div>
    <div class="decide" id="decide"><label class="dopt on" data-act="decide" data-v="ok"><span class="rd"></span><div><b>Setuju</b><small>Tanda tangani dan lanjutkan ke tahap berikutnya</small></div></label>
      <label class="dopt" data-act="decide" data-v="back"><span class="rd"></span><div><b>Kembalikan ke IT</b><small>Perlu diubah dulu (mis. spesifikasi/jumlah) — tidak ditolak</small></div></label>
      <label class="dopt" data-act="decide" data-v="no"><span class="rd"></span><div><b>Tolak</b><small>Permintaan dihentikan</small></div></label></div>
    <div id="decideBody">${decideBody('ok')}</div>`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn green" id="decideGo" data-act="doDecide">${I('check')}Setujui & tanda tangan</button>`);
}
function decideBody(v) {
  return v === 'ok' ? `<label class="fl">Tanda tangan Anda <em>*</em></label>${sigPad()}<label class="fl">Catatan (opsional)</label><input class="fi-in" id="sgNote">`
    : `<label class="fl">${v === 'back' ? 'Apa yang perlu diubah?' : 'Alasan penolakan'} <em>*</em></label><textarea class="fi-in" id="dWhy" placeholder="Terlihat oleh pemohon & IT"></textarea>`;
}

/* ---- TTD kertas: unduh lalu unggah, dalam satu jendela ---- */
function mPaper(t) {
  const step = t.phase === 'appr_gm' ? 'GM' : 'Atasan';
  const name = (t.phase === 'appr_gm' ? t.gm : t.mgr).split(' — ')[0];
  modal(`${I('upload')} Tanda tangan di kertas — ${esc(name)}`, `<ol class="psteps">
      <li><b>Unduh & cetak dokumen</b><span>Dokumen versi terbaru (v${t.revs.length}) dengan kode QR.</span><button class="btn sm" data-act="doExport">${I('download')}Unduh PDF v${t.revs.length}</button></li>
      <li><b>Minta ${esc(step.toLowerCase())} tanda tangan</b><span>Di kolom "${step}".</span></li>
      <li><b>Unggah hasil scan</b><span>Sistem mengecek QR agar tidak ada dokumen ganda.</span>
        <div class="drop" id="drop" data-act="pickFile" data-v="ok">${I('upload')}<p><b>Klik untuk simulasi unggah</b> scan_ttd_${esc(name.split(' ')[0].toLowerCase())}.pdf</p></div>
        <p class="small" style="margin-top:6px">Simulasi berkas salah: <a style="cursor:pointer;color:var(--red-ink);text-decoration:underline" data-act="pickFile" data-v="old">scan_lama.pdf (QR v1)</a></p><div id="impCheck"></div></li></ol>`,
    `<button class="btn" data-act="closeModal">Tutup</button><button class="btn navy" id="impGo" data-act="doImport" disabled>${I('check')}Simpan sebagai disetujui</button>`);
}

/* ---- Pemohon pilih jadwal, atau minta waktu lain ---- */
/* ============================ MODALS ============================ */
function modal(title, body, foot, wide = false) {
  $('#modalRoot').innerHTML = `<div class="scrim" data-act="closeModalBg"><div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-label="${esc(stripTags(title))}"><div class="mh"><h2>${title}</h2><button class="x" data-act="closeModal">${I('x')}</button></div><div class="mb">${body}</div><div class="mf">${foot}</div></div></div>`;
  bindSigPads();
}
const closeModal = () => { $('#modalRoot').innerHTML = ''; };
function toast(text) {
  $('#toastRoot').innerHTML = `<div class="toast">${I('checkC')}${esc(text)}</div>`;
  clearTimeout(toast.t); toast.t = setTimeout(() => { $('#toastRoot').innerHTML = ''; }, 2600);
}

function mExport(t) {
  modal(`${I('download')} Ekspor dokumen · v${t.revs.length}`, `<div style="background:var(--raised);padding:18px;border-radius:14px">${paper(t)}</div>
    <div class="note">${I('info')}<span>PDF ini memuat QR <b>${t.num}/v${t.revs.length}</b>. Setelah ditandatangani basah, unggah lewat <b>Impor bertanda tangan</b>; sistem mencocokkan QR agar tidak ada dokumen ganda.</span></div>`,
    `<button class="btn" data-act="closeModal">Tutup</button><button class="btn" data-act="print">${I('printer')}Cetak</button><button class="btn navy" data-act="doExport">${I('download')}Unduh PDF</button>`, true);
}
function mImport(t) {
  const step = t.phase === 'appr_gm' ? 'GM' : 'Atasan';
  const name = (t.phase === 'appr_gm' ? t.gm : t.mgr).split(' — ')[0];
  modal(`${I('upload')} Impor dokumen bertanda tangan`, `<label class="fl">Tanda tangan untuk tahap</label><select class="fi-in"><option>${step} — ${esc(name)}</option></select>
    <label class="fl">Berkas scan (PDF/JPG)</label>
    <div class="drop" id="drop" data-act="pickFile" data-v="ok">${I('upload')}<p><b>Klik untuk simulasi unggah</b> scan_ttd_${esc(name.split(' ')[0].toLowerCase())}.pdf</p></div>
    <p class="small" style="margin-top:8px">Simulasi berkas salah: <a style="cursor:pointer;color:var(--red-ink);text-decoration:underline" data-act="pickFile" data-v="old">scan_lama.pdf (QR v1)</a></p>
    <div id="impCheck"></div>`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn navy" id="impGo" data-act="doImport" disabled>${I('check')}Impor & tandai disetujui</button>`);
}
function mIssue() {
  modal(`${I('alert')} Laporkan kendala`, `<label class="fl">Apa kendalanya? <em>*</em></label><textarea class="fi-in" id="issue" placeholder="Contoh: mouse tidak terdeteksi"></textarea>`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn navy" data-act="doIssue">Kirim ke IT</button>`);
}
function mRejectIT() {
  modal(`${I('xC')} Tolak permintaan`, `<label class="fl">Alasan <em>*</em></label><textarea class="fi-in" id="rejWhy" placeholder="Terlihat oleh pemohon"></textarea>`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn redsoft" data-act="doReject">Tolak & tutup tiket</button>`);
}

/* ============================ TRANSITIONS ============================ */
const pushSys = (t, tone, title, body = '') => t.msgs.push({ k:'sys', tone, title, body, at:now() });
const pushRev = (t, kind, label, by) => { t.revs.push({ v:t.revs.length + 1, kind, label, by, at:`22 Nov ${now()}` }); return t.revs.length; };
const docRef = (t, icon = 'ef') => `<div class="docref">${I(icon)}${esc(docTitle(t))}<span class="vtag">v${t.revs.length}</span></div>`;
function afterApproval(t) { t.phase = t.type === 'hw' ? (t.hw.fromStock ? 'schedule' : 'procure') : 'fulfill'; }
function advanceFromApproval(t) {
  if (t.phase === 'appr_mgr' && t.route === 'mgr_gm') t.phase = 'appr_gm';
  else afterApproval(t);
}
function actorName() { return S.role === 'agent' ? 'RM Bagastyo' : me().name; }

const A = {
  noop() {},
  pStatus(v) { S.pst = v; },
  ctSearch() { return 'keep'; }, navType(v) { S.screen = 'list'; S.type = v; S.scope = S.role === 'agent' ? S.scope : 'all'; },
  navScope(v) { S.screen = 'list'; S.scope = v; },
  goCreate() { S.screen = 'create'; S.createType = null; },
  menu(v) { S.openMenu = S.openMenu === v ? null : v; },
  setType(v) { S.type = v; S.openMenu = null; }, setStatus(v) { S.status = v; S.openMenu = null; }, setPrio(v) { S.prio = v; S.openMenu = null; },
  kpi(v) { if (v === 'OVERDUE' || v === 'CRIT') return; S.status = S.status === v ? '' : v; },
  scope(v) { S.scope = v === 'created' ? 'all' : v; },
  open(v) { S.sel = v; S.screen = 'detail'; S.tab = 'chat'; },
  back() { S.screen = 'list'; }, tab(v) { S.tab = v; }, tabDoc() { S.tab = 'doc'; closeModal(); }, toggleInsp() { S.insp = !S.insp; },
  send: () => sendMsg(),
  pickType(v) { S.createType = v || null; S.pickerMode = 'create'; S.basket = []; S.pq = ''; S.pcat = ''; S.swapIdx = null; },
  efKind(v) { S.efKind = v; },
  radio(v, el) { const g = el.closest('[data-group]'); g?.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); el.classList.add('on'); return 'keep'; },
  routePick(v, el) { el.parentElement.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); el.classList.add('on'); el.parentElement.dataset.val = v; return 'keep'; },
  qty(v) { const q = $('#qtyV'); q.textContent = Math.max(1, Number(q.textContent) + Number(v)); return 'keep'; },
  clearSig(v, el) { const cv = el.parentElement.querySelector('canvas'); cv.getContext('2d').clearRect(0,0,cv.width,cv.height); delete cv.dataset.signed; el.parentElement.querySelector('.ph').hidden = false; return 'keep'; },
  closeModal() { closeModal(); S.swapIdx = null; return 'keep'; },
  closeModalBg(v, el, e) { if (e.target === el) closeModal(); return 'keep'; },
  print() { toast('Dialog cetak dibuka (simulasi)'); return 'keep'; },

  submitCreate() {
    const root = $('#sheet');
    const title = ($('#fTitle')?.value || '').trim();
    if (!title) return toast('Judul wajib diisi'), 'keep';
    const ty = ['hw', 'ef'].includes(S.createType) ? S.createType : 'it';
    if (ty === 'hw' && !(S.basket || []).length) return toast('Pilih minimal satu barang'), 'keep';
    if (ty !== 'it' && !signed(root)) return toast('Tanda tangan pemohon wajib'), 'keep';
    const seq = String(35 + S.tickets.length).padStart(4, '0');
    const base = { id:'n' + Date.now(), num:`221126-QC-${seq}`, type:ty, title, desc:($('#fDesc')?.value || '').trim(), prio:'MEDIUM', req:LEONY, reqMe:true, pic:null, created:'22 Nov',
      sla:{ due:'Sen, 23 Nov · 10.00', left:'respon pertama sisa 4 jam', pct:2 }, msgs:[{ k:'day', t:'Hari ini' }], acts:[], fresh:true };
    let t;
    if (ty === 'it') t = { ...base, status:'TODO', category:'Hardware' };
    else {
      const common = { phase:'review', route:null, picked:false, mgr:MANAGERS[0], gm:null, sigs:{ req:{ how:'digital', at:`22 Nov ${now()}` }, mgr:null, gm:null, ict:null }, revs:[] };
      if (ty === 'hw') {
        const cat = root.querySelector('[data-group="hwcat"] .on')?.dataset.v || 'LAPTOP';
        t = { ...base, ...common, docNo:`HR-2026-00${43 + S.tickets.length}`, hw:{ kind:root.querySelector('[data-group="kind"] .on')?.dataset.v, recipient:root.querySelector('[data-group="for"] .on')?.dataset.v, fromStock:false, items:S.basket.map((x) => ({ cat:x.cat, name:x.name, qty:x.qty, spec:x.note || '-', state:'pending' })) } }; void cat; S.basket = [];
      } else {
        const k = S.efKind || 'VPN';
        t = { ...base, ...common, docNo:`${EF_KINDS[k].code}/0${120 + S.tickets.length}`, ef:{ kind:k, fields:{ 'Alasan':base.desc || '-' }, cred:null } };
      }
      t.revs.push({ v:1, kind:'gen', label:'Dibuat dari pengajuan · TTD pemohon', by:LEONY.name, at:`22 Nov ${now()}` });
    }
    pushSys(t, ty === 'it' ? 'nv' : ty, `${LEONY.name} membuat ${TYPES[ty].label}`, ty === 'it' ? '' : docRef(t));
    S.tickets.unshift(t);
    S.sel = t.id; S.screen = 'detail'; S.tab = 'chat'; S.createType = null;
    toast(`Tiket #${t.num} dibuat`);
  },

  review() { mReview(T(S.sel)); return 'keep'; },
  editItems() { S.openMenu = null; render(); mEditItems(T(S.sel)); return 'keep'; },
  edQty(v, el) { const q = el.parentElement.querySelector('.ied-qty'); q.textContent = Math.max(1, Number(q.textContent) + Number(v)); return 'keep'; },
  edDel(v, el) { const rows = document.querySelectorAll('#iedList .ied'); if (rows.length <= 1) { toast('Minimal satu barang'); return 'keep'; } el.closest('.ied').remove(); return 'keep'; },
  pkCat(v) { S.pcat = v; refreshPicker(); return 'keep'; },
  pkAdd(code) {
    const c = CATALOG.find((x) => x.code === code); const b = S.basket || (S.basket = []);
    if (S.swapIdx != null) { const old = b[S.swapIdx]; b[S.swapIdx] = { ...old, code:c.code, cat:c.cat, name:c.name, note:'', custom:false, was:old.orig && old.orig !== c.name ? old.orig : null }; S.swapIdx = null; toast(`Diganti dengan ${c.name}`); }
    else { const ex = b.find((x) => x.code === code); if (ex) ex.qty += 1; else b.push({ code:c.code, cat:c.cat, name:c.name, qty:1, note:'', orig:null }); }
    refreshPicker(); return 'keep';
  },
  pkOther() { const name = prompt('Nama barang yang dibutuhkan:'); if (!name) return 'keep'; (S.basket || (S.basket = [])).push({ code:null, cat:'OTHER', name, qty:1, note:'', orig:null, custom:true }); refreshPicker(); return 'keep'; },
  pkQty(v) { const [i, d] = v.split(':').map(Number); const x = S.basket[i]; x.qty = Math.max(1, Math.min(50, x.qty + d)); refreshPicker(); return 'keep'; },
  pkDel(v) { S.basket.splice(Number(v), 1); if (S.swapIdx != null) S.swapIdx = null; refreshPicker(); return 'keep'; },
  pkSwap(v) { S.swapIdx = Number(v); S.pcat = S.basket[S.swapIdx].cat; refreshPicker(); return 'keep'; },
  pkSwapCancel() { S.swapIdx = null; refreshPicker(); return 'keep'; },
  edAdd() { const list = $('#iedList'); const i = list.children.length; list.insertAdjacentHTML('beforeend', itemRow({ cat:'ACCESSORY', name:CATALOG[6].name, spec:'-', qty:1, added:true }, i)); list.lastElementChild.dataset.orig = ''; return 'keep'; },
  doEditItems() {
    const t = T(S.sel); const why = $('#edWhy').value.trim();
    if (!why) { toast('Isi alasan perubahan'); return 'keep'; }
    const changed = applyItemEditor(t, null);
    if (!changed) { closeModal(); toast('Tidak ada perubahan'); return 'keep'; }
    pushRev(t, 'gen', 'Barang diubah oleh IT', 'RM Bagastyo');
    pushSys(t, 'hw', 'RM Bagastyo mengubah barang', `${changed}<div>Alasan: “${esc(why)}”</div>${docRef(t)}`);
    closeModal(); toast('Barang diperbarui — pemohon diberi tahu');
  },
  paper() { S.openMenu = null; render(); mPaper(T(S.sel)); return 'keep'; },
  decide(v, el) { el.parentElement.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); el.classList.add('on'); $('#decideBody').innerHTML = decideBody(v); bindSigPads();
    const go = $('#decideGo'); go.className = 'btn ' + (v === 'ok' ? 'green' : v === 'back' ? 'navy' : 'redsoft'); go.innerHTML = v === 'ok' ? I('check') + 'Setujui & tanda tangan' : v === 'back' ? I('back') + 'Kembalikan ke IT' : I('xC') + 'Tolak permintaan'; go.dataset.v = v; return 'keep'; },
  doDecide(v) {
    const t = T(S.sel); v = v || 'ok';
    if (v === 'ok') return A.doApprove();
    const why = ($('#dWhy')?.value || '').trim();
    if (!why) { toast('Isi alasannya dulu'); return 'keep'; }
    if (v === 'no') { $('#dWhy').id = 'rejWhy'; return A.doReject(); }
    pushSys(t, 'nv', `${me().name} mengembalikan ke IT untuk diubah`, `<div>“${esc(why)}”</div>`);
    t.phase = 'review'; closeModal(); toast('Dikembalikan ke IT');
  },
  doReview() {
    const t = T(S.sel);
    const route = $('#routeSel .on')?.dataset.v || 'mgr';
    t.route = route; t.mgr = $('#selMgr').value; t.gm = route === 'mgr_gm' ? $('#selGm').value : null; t.picked = true; t.pic = t.pic || 'RM BAGASTYO A.W.';
    if (t.type === 'hw') {
      t.hw.fromStock = $('#fromStock').checked;
      const changed = applyItemEditor(t, route === 'none' ? 'approved' : 'pending');
      if (changed) pushSys(t, 'hw', 'RM Bagastyo mengubah barang saat review', changed);
    }
    const note = $('#rvNote').value.trim();
    pushRev(t, 'gen', `Alur ditetapkan: ${ROUTES[route].label}`, 'RM Bagastyo');
    pushSys(t, t.type, `RM Bagastyo menetapkan alur: <b>${ROUTES[route].label}</b>`, `<div class="kv">${route !== 'none' ? `<span>Atasan</span><b>${esc(t.mgr)}</b>` : ''}${t.gm ? `<span>GM</span><b>${esc(t.gm)}</b>` : ''}${t.type === 'hw' && t.hw.fromStock ? '<span>Sumber</span><b>Stok gudang IT</b>' : ''}</div>${docRef(t)}`);
    if (note) t.msgs.push({ k:'msg', from:'RM Bagastyo', text:note, at:now(), me:true });
    if (route === 'none') afterApproval(t); else t.phase = 'appr_mgr';
    closeModal(); toast(route === 'none' ? 'Lanjut diproses IT' : `Dikirim ke ${t.mgr.split(' — ')[0]} untuk tanda tangan`);
  },
  approve() { mSign(T(S.sel), true); return 'keep'; },
  approverReject() { mSign(T(S.sel), false); return 'keep'; },
  rejectIT() { mRejectIT(); return 'keep'; },
  doApprove() {
    const t = T(S.sel); const m = $('.modal');
    if (!signed(m)) return toast('Tanda tangan dulu'), 'keep';
    const key = t.phase === 'appr_gm' ? 'gm' : 'mgr';
    t.sigs[key] = { how:'digital', at:`22 Nov ${now()}` };
    pushRev(t, 'dig', `TTD ${key === 'gm' ? 'GM' : 'Atasan'} (digital) — ${me().name}`, me().name);
    const note = $('#sgNote').value.trim();
    pushSys(t, 'ef', `${me().name} menyetujui & menandatangani`, `${note ? `<div>“${esc(note)}”</div>` : ''}<span class="sig">${esc(me().name)}</span>${docRef(t)}`);
    if (t.type === 'hw' && t.route !== 'mgr_gm' || key === 'gm') t.hw?.items.forEach((it) => { if (it.state === 'pending') it.state = 'approved'; });
    advanceFromApproval(t);
    closeModal(); toast('Disetujui — dokumen diperbarui');
  },
  doReject() {
    const t = T(S.sel); const why = $('#rejWhy').value.trim();
    if (!why) return toast('Alasan wajib diisi'), 'keep';
    t.rejBy = S.role === 'agent' ? 'ict' : S.role; t.rejAt = t.phase; t.phase = 'rejected';
    pushSys(t, 'rd', `${actorName()} menolak permintaan`, `<div>“${esc(why)}”</div>`);
    pushRev(t, 'fin', `Ditolak oleh ${actorName()} · terkunci`, actorName());
    closeModal(); toast('Permintaan ditolak, tiket ditutup');
  },
  cancelReq() { const t = T(S.sel); t.rejAt = t.phase; t.phase = 'rejected'; t.rejBy = 'ict'; pushSys(t, 'rd', 'RM Bagastyo membatalkan tiket', ''); toast('Tiket dibatalkan'); },
  remind() { const t = T(S.sel); pushSys(t, 'nv', `Pengingat dikirim ke ${(t.phase === 'appr_gm' ? t.gm : t.mgr).split(' — ')[0]}`, ''); toast('Pengingat terkirim (notifikasi + email)'); },
  export() { mExport(T(S.sel)); return 'keep'; },
  doExport() { const t = T(S.sel); if ($('.psteps')) { t.acts.push({ text:`${actorName()} mengunduh dokumen v${t.revs.length}`, at:`22 Nov ${now()}` }); toast(`${t.docNo}_v${t.revs.length}.pdf diunduh`); return 'keep'; } t.acts.push({ text:`${actorName()} mengekspor dokumen v${t.revs.length}`, at:`22 Nov ${now()}` }); closeModal(); toast(`${t.docNo}_v${t.revs.length}.pdf diunduh`); },
  import() { mImport(T(S.sel)); return 'keep'; },
  pickFile(v) {
    const t = T(S.sel); const ok = v === 'ok';
    $('#drop').className = 'drop' + (ok ? ' ok' : '');
    $('#impCheck').innerHTML = ok
      ? `<div class="note" style="background:var(--green-bg);color:var(--green-ink)">${I('checkC')}<span>QR cocok: <b>${t.num}/v${t.revs.length}</b> (versi terbaru). Tanda tangan terdeteksi di slot ${t.phase === 'appr_gm' ? 'GM' : 'Atasan'}.</span></div>`
      : `<div class="note" style="background:var(--red-bg);color:var(--red-ink)">${I('alert')}<span>QR <b>${t.num}/v1</b> bukan versi terbaru (v${t.revs.length}). Ekspor ulang lalu minta tanda tangan pada dokumen terbaru.</span></div>`;
    $('#impGo').disabled = !ok;
    return 'keep';
  },
  doImport() {
    const t = T(S.sel); const key = t.phase === 'appr_gm' ? 'gm' : 'mgr'; const nm = (key === 'gm' ? t.gm : t.mgr).split(' — ')[0];
    t.sigs[key] = { how:'paper', at:`22 Nov ${now()}` };
    pushRev(t, 'imp', `Impor scan TTD basah — ${key === 'gm' ? 'GM' : 'Atasan'} (${nm})`, 'RM Bagastyo');
    pushSys(t, t.type, `${nm} menyetujui (dokumen kertas diimpor oleh RM Bagastyo)`, `<div class="docref">${I('upload')}scan_ttd_${esc(nm.split(' ')[0].toLowerCase())}.pdf → Dokumen<span class="vtag">v${t.revs.length}</span></div>`);
    if (t.type === 'hw' && (key === 'gm' || t.route !== 'mgr_gm')) t.hw.items.forEach((it) => { if (it.state === 'pending') it.state = 'approved'; });
    advanceFromApproval(t);
    closeModal(); toast('Impor berhasil — tahap persetujuan selesai');
  },
  procure() { mProcure(T(S.sel)); return 'keep'; },
  doProcure() {
    const t = T(S.sel);
    document.querySelectorAll('[data-dec]').forEach((s) => { const it = t.hw.items[s.dataset.dec]; it.state = s.value; if (s.value === 'approved') { it.vendor = 'CV Sinar Komputer'; it.cost = 'Rp 12.400.000'; } });
    const ok = t.hw.items.filter((i) => i.state === 'approved').length;
    pushSys(t, 'hw', `Pengadaan dicatat: ${ok} item disetujui`, `<div class="kv"><span>Vendor</span><b>CV Sinar Komputer</b></div>`);
    t.rejAt = 'procure'; t.phase = ok ? 'delivery' : 'rejected';
    closeModal(); toast(ok ? 'Menunggu barang dari vendor' : 'Semua item ditolak');
  },
  arrived() { const t = T(S.sel); t.hw.items.forEach((i) => { if (i.state === 'approved') i.state = 'arrived'; }); pushSys(t, 'hw', 'Barang tiba di gudang IT', ''); t.phase = 'schedule'; toast('Barang tiba — usulkan jadwal'); },
  schedule() { mSchedule(T(S.sel)); return 'keep'; },
  doSchedule() { const t = T(S.sel); t.hw.schedule = { tech:t.pic, slots:[$('#sl1').value, $('#sl2').value], chosen:null }; pushSys(t, 'hw', 'Usulan jadwal instalasi dikirim ke pemohon', `<div class="kv"><span>Slot</span><b>${esc(t.hw.schedule.slots.join(' / '))}</b></div>`); closeModal(); toast('Usulan terkirim ke pemohon'); },
  pickSlot() { mPickSlot(T(S.sel)); return 'keep'; },
  doPickSlot() { const t = T(S.sel); const pick = $('#slotSel .on')?.dataset.v || '0';
    if (pick === 'other') { const w = $('#otherTime').value.trim(); if (!w) { toast('Tulis waktu yang Anda bisa'); return 'keep'; } t.msgs.push({ k:'msg', from:me().name, text:`Saya tidak bisa di waktu yang diusulkan. Bisa ${w}?`, at:now() }); t.hw.schedule = null; pushSys(t, 'hw', `${actorName()} meminta waktu lain`, ''); closeModal(); toast('Permintaan waktu lain terkirim ke IT'); return; }
    const i = Number(pick); t.hw.schedule.chosen = i; t.phase = 'install'; pushSys(t, 'hw', `${actorName()} memilih jadwal ${esc(t.hw.schedule.slots[i])}`, ''); closeModal(); toast('Jadwal dikonfirmasi'); },
  reschedule() { const t = T(S.sel); t.hw.schedule.chosen = null; t.phase = 'schedule'; pushSys(t, 'hw', 'Jadwal dibuka ulang', ''); },
  startInstall() { const t = T(S.sel); t.started = true; pushSys(t, 'hw', 'Instalasi dimulai', ''); },
  installDone() { mInstallDone(); return 'keep'; },
  doInstallDone() {
    const t = T(S.sel); t.hw.asset = $('#asset').value; t.sigs.ict = { how:'digital', at:`22 Nov ${now()}` };
    pushRev(t, 'dig', `TTD ICT — instalasi selesai, aset ${t.hw.asset}`, 'RM Bagastyo');
    pushSys(t, 'hw', 'Instalasi selesai — menunggu konfirmasi pemohon', `<div class="kv"><span>Aset</span><b>${esc(t.hw.asset)}</b></div>${docRef(t)}`);
    t.phase = 'confirm'; closeModal(); toast('Menunggu konfirmasi pemohon');
  },
  fulfill() { S.fulMode = null; mFulfill(T(S.sel)); return 'keep'; },
  doFulfill() {
    const t = T(S.sel);
    if ($('#cu')) t.ef.cred = { user:$('#cu').value, pass:$('#cp').value, server:$('#cs').value };
    t.sigs.ict = { how:'digital', at:`22 Nov ${now()}` };
    pushRev(t, 'dig', 'TTD ICT — akses diberikan', 'RM Bagastyo');
    pushSys(t, 'ef', 'Akses diberikan — menunggu konfirmasi pemohon', `${t.ef.cred ? '<div>Kredensial tersimpan terenkripsi · lihat di panel kanan</div>' : ''}${docRef(t)}`);
    t.phase = 'confirm'; closeModal(); toast('Pemohon diberi notifikasi');
  },
  showCred() { const t = T(S.sel); t.acts.push({ text:`${actorName()} melihat kredensial`, at:`22 Nov ${now()}` }); mCred(t); return 'keep'; },
  confirm() { finish(T(S.sel), me().name); toast('Terima kasih! Tiket ditutup'); },
  confirmOnBehalf() { finish(T(S.sel), 'RM Bagastyo (atas nama pemohon)'); toast('Tiket ditutup'); },
  reportIssue() { mIssue(); return 'keep'; },
  doIssue() { const t = T(S.sel); const txt = $('#issue').value.trim() || 'Ada kendala'; t.msgs.push({ k:'msg', from:me().name, text:txt, at:now() }); pushSys(t, t.type, 'Pemohon melaporkan kendala — kembali ke IT', ''); t.phase = t.type === 'hw' ? 'install' : 'fulfill'; t.started = true; closeModal(); toast('Dikembalikan ke IT'); },
};
function finish(t, by) {
  pushRev(t, 'fin', `Final · terkunci · ${t.docNo}`, 'Sistem');
  pushSys(t, t.type, `${esc(by)} mengonfirmasi — tiket ditutup`, docRef(t, 'lock'));
  t.phase = 'done';
}
function sendMsg() {
  const inp = $('#msgIn'); if (!inp) return;
  const text = inp.value.trim(); if (!text) return;
  const t = T(S.sel);
  t.msgs.push({ k:'msg', from:me().name, text, at:now(), me:true });
  save(); render();
}

/* ============================ RENDER & EVENTS ============================ */
/* ============================ REVISI 5: hasil audit penuh Hardware & E-Form ============================ */
const DEPTS = ['QC AB Reguler', 'Information Technology', 'Human Resources', 'Finance & Accounting', 'Produksi 1', 'Packing CD', 'HSE - Pusat', 'Marketing', 'Transport Operasional', 'Purchasing'];
const PEOPLE = ['Leony Rustandy', 'Andi Pratama', 'Rina Susanti', 'Budi Santoso', 'Dewi Lestari', 'Fajar Nugroho', 'Sari Wulandari', 'Kevin Austin'];
const TECHS = [{ n:'YUDI ARTA TRIRENSILA', load:3 }, { n:'RM BAGASTYO A.W.', load:1 }, { n:'BENY SAPUTRA, S.KOM', load:2 }, { n:'YOHANES OCTAVIAN R.', load:0 }];
const NAS_SERVERS = [{ id:'SPJ', ip:'192.168.2.16' }, { id:'JKT', ip:'10.11.2.6' }, { id:'KRW', ip:'10.12.2.6' }, { id:'SMG', ip:'10.14.2.16' }];
const PERMANENT_KINDS = ['WEBSITE', 'EMAIL', 'SYNOLOGY_NAS'];
const MAX12_KINDS = ['VPN', 'NETWORK', 'FLASHDISK'];
const TODAY = new Date('2026-11-23T00:00:00');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const DAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const RESCHEDULE_LIMIT = 3;
const fmtD = (d) => `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
const iso = (d) => d.toISOString().slice(0, 10);
const addM = (d, m) => { const x = new Date(d); x.setMonth(x.getMonth() + m); return x; };
const addD = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const daysLeft = (s) => Math.round((new Date(s + 'T00:00:00') - TODAY) / 86400000);
const EF_TERMS = ['Akses hanya dipakai untuk keperluan pekerjaan.', 'Kredensial tidak boleh dibagikan kepada siapa pun.', 'Pemohon bertanggung jawab atas seluruh aktivitas menggunakan akses ini.', 'IT berhak mencabut akses bila terjadi penyalahgunaan.', 'Akses berakhir sesuai masa berlaku dan harus diperpanjang bila masih diperlukan.'];
const REASONS = {
  VPN:['Bekerja dari rumah (WFH)', 'Dinas luar kota', 'Remote PC kantor di luar jam kerja'], WEBSITE:['Pelaporan pajak', 'Portal vendor/supplier', 'Riset & referensi kerja'],
  NETWORK:['Perangkat baru di jaringan', 'Akses server/segmen tertentu'], FLASHDISK:['Pindah data hasil produksi', 'Serah terima dokumen ke vendor'],
  EMAIL:['Karyawan baru', 'Email bersama departemen'], SYNOLOGY_NAS:['Simpan dokumen departemen', 'Berbagi file antar tim'],
};

function catalogList() {
  if (!S.catalog) S.catalog = CATALOG.map((c, i) => ({ ...c, order:(i + 1) * 10, active:true, fields:c.code === 'LICENSE_GENERIC' ? [{ label:'Nama software', type:'text', req:true }, { label:'Jumlah seat', type:'number', req:true }] : [] }));
  return S.catalog;
}
const catFind = (code) => catalogList().find((c) => c.code === code);

/* ---------------- Picker (katalog + keranjang) dengan field tambahan & penerima per barang ---------------- */
function pickerHtml() {
  const q = (S.pq || '').toLowerCase();
  const cat = S.pcat || '';
  const basket = S.basket || [];
  const active = catalogList().filter((c) => c.active);
  const rows = active.filter((c) => (!cat || c.cat === cat) && (!q || `${c.name} ${c.code}`.toLowerCase().includes(q)));
  const inB = (code) => basket.filter((b) => b.code === code).reduce((a, b) => a + b.qty, 0);
  const chips = [['', 'Semua', 'grid'], ...HW_CATS.filter((c) => active.some((x) => x.cat === c.k)).map((c) => [c.k, c.label, c.icon])];
  const recips = S.pickerMode === 'create' ? (S.recips || []) : [];
  const fieldInputs = (b, i) => (catFind(b.code)?.fields || []).map((f, j) => {
    const v = (b.f || {})[f.label] || '';
    const ctl = f.type === 'select' ? `<select class="fi-in pk-f" data-i="${i}" data-k="${esc(f.label)}"><option value="">Pilih ${esc(f.label)}…</option>${(f.options || []).map((o) => `<option ${o === v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`
      : `<input class="fi-in pk-f" data-i="${i}" data-k="${esc(f.label)}" type="${f.type === 'number' ? 'number' : 'text'}" value="${esc(v)}" placeholder="${f.type === 'number' ? 'Angka' : 'Isi ' + esc(f.label.toLowerCase())}">`;
    return `<label class="pk-fl" data-j="${j}"><span>${esc(f.label)}${f.req ? ' <em>*</em>' : ''}</span>${ctl}</label>`;
  }).join('');
  return `<div class="picker ${S.swapIdx != null ? 'swap' : ''}">
    <div class="pk-left"><div class="pk-search">${I('search')}<input id="pkQ" value="${esc(S.pq || '')}" placeholder="Cari barang, misal: laptop, monitor, mouse"></div>
      <div class="pk-chips">${chips.map(([k, l, ic]) => `<button class="${cat === k ? 'on' : ''}" data-act="pkCat" data-v="${k}">${I(ic)}${l}</button>`).join('')}</div>
      <div class="pk-grid">${rows.map((c) => { const n = inB(c.code); return `<button class="pk-item ${n ? 'in' : ''}" data-act="pkAdd" data-v="${c.code}"><span class="pk-top"><span class="pk-cat">${I(catIcon(c.cat))}${esc((HW_CATS.find((h) => h.k === c.cat) || {}).label || c.cat)}</span>${n ? `<span class="pk-n">${I('check')}${n}×</span>` : ''}</span><b>${esc(c.name)}</b><span class="pk-code">${esc(c.spec)}</span><span class="pk-add">${S.swapIdx != null ? I('refresh') + 'Pilih sebagai pengganti' : I('plus') + (n ? 'Tambah lagi' : 'Tambah')}</span></button>`; }).join('')}
        <button class="pk-item pk-other" data-act="pkOther"><span class="pk-top"><span class="pk-cat">${I('package')}Lainnya</span></span><b>Barang tidak ada di katalog?</b><span class="pk-code">Tulis sendiri namanya</span><span class="pk-add">${I('pen')}Tulis manual</span></button></div></div>
    <div class="pk-right"><div class="pk-bh">${I('package')}<b>Barang dipilih</b><span class="pk-total">${basket.reduce((a, b) => a + b.qty, 0)} unit</span></div>
      ${S.otherOpen ? `<div class="pk-manual"><input class="fi-in" id="pkOtherName" placeholder="Nama barang, misal: Printer label Zebra"><button class="btn sm hwb" data-act="pkOtherAdd">${I('plus')}Tambah</button><button class="btn sm ghost" data-act="pkOtherCancel">Batal</button></div>` : ''}
      ${basket.length ? basket.map((b, i) => `<div class="pk-row ${b.was ? 'swapped' : ''} ${S.swapIdx === i ? 'swapping' : ''}"><span class="iic">${I(catIcon(b.cat))}</span><div class="pk-rm"><b>${esc(b.name)}</b>${b.was ? `<span class="ied-tag">Pengganti dari <s>${esc(b.was)}</s></span>` : ''}${b.custom ? '<span class="ied-tag">Di luar katalog</span>' : ''}
          ${fieldInputs(b, i)}
          ${recips.length > 1 ? `<label class="pk-fl"><span>Untuk</span><select class="fi-in pk-to" data-i="${i}"><option value="">Semua / dipakai bersama</option>${recips.map((r) => `<option ${b.to === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>` : ''}
          <input class="fi-in pk-note" data-i="${i}" value="${esc(b.note || '')}" placeholder="${b.custom ? 'Spesifikasi / merek yang diinginkan' : 'Catatan (opsional)'}"></div>
        <div class="pk-ctl"><div class="qty"><button data-act="pkQty" data-v="${i}:-1">−</button><span>${b.qty}</span><button data-act="pkQty" data-v="${i}:1">+</button></div>
        ${S.pickerMode === 'edit' && b.orig ? `<button class="btn sm ghost" data-act="pkSwap" data-v="${i}">${I('refresh')}Ganti</button>` : ''}
        <button class="x" data-act="pkDel" data-v="${i}" title="Hapus">${I('x')}</button></div></div>`).join('')
        : `<div class="pk-empty">${I('package')}<b>Belum ada barang</b><span>Klik barang di katalog untuk menambahkannya.</span></div>`}
      ${S.swapIdx != null ? `<div class="note warn" style="margin:10px">${I('refresh')}<span>Pilih pengganti untuk <b>${esc(basket[S.swapIdx]?.name || '')}</b> dari katalog. <a data-act="pkSwapCancel" style="cursor:pointer;text-decoration:underline">Batal</a></span></div>` : ''}</div></div>`;
}
function bindPicker() {
  const q = $('#pkQ'); if (q) q.oninput = () => { S.pq = q.value; refreshPicker(); };
  document.querySelectorAll('.pk-note').forEach((n) => { n.oninput = () => { S.basket[n.dataset.i].note = n.value; }; });
  document.querySelectorAll('.pk-f').forEach((n) => { n.oninput = n.onchange = () => { const b = S.basket[n.dataset.i]; b.f = { ...(b.f || {}), [n.dataset.k]: n.value }; }; });
  document.querySelectorAll('.pk-to').forEach((n) => { n.onchange = () => { S.basket[n.dataset.i].to = n.value; }; });
  const o = $('#pkOtherName'); if (o) { o.focus(); o.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); A.pkOtherAdd(); } }; }
}
const basketFromItems = (items) => items.map((it) => { const c = catalogList().find((x) => x.name === it.name); return { code:c?.code || null, cat:it.cat, name:it.name, qty:it.qty, note:it.note || '', f:it.f || {}, to:it.to || '', orig:it.was || it.name, was:it.was || null, custom:!c }; });
const specOf = (b) => [b.note, ...Object.entries(b.f || {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)].filter(Boolean).join(' · ') || '-';
function missingFields(basket) {
  for (const b of basket) for (const f of catFind(b.code)?.fields || []) if (f.req && !(b.f || {})[f.label]) return `${b.name}: ${f.label}`;
  return '';
}
function applyItemEditor(t, newState) {
  const b = S.basket || [];
  if (!b.length) return '';
  const before = t.hw.items.map((it) => `${it.qty}× ${it.name}`).join(', ');
  t.hw.items = b.map((x) => {
    const prev = t.hw.items.find((it) => (it.was || it.name) === x.orig);
    return { ...(prev || {}), cat:x.cat, name:x.name, spec:specOf(x), note:x.note, f:x.f, to:x.to, qty:x.qty, was:x.orig && x.orig !== x.name ? x.orig : null, added:!x.orig, state:newState || prev?.state || 'pending' };
  });
  const after = t.hw.items.map((it) => `${it.qty}× ${it.name}`).join(', ');
  return before === after ? '' : `<div class="kv"><span>Sebelum</span><b><s>${esc(before)}</s></b><span>Sesudah</span><b>${esc(after)}</b></div>`;
}

/* ---------------- Penerima (banyak orang) ---------------- */
function recipHtml() {
  const r = S.recips || [];
  const q = (S.rq || '').toLowerCase();
  const sugg = q ? PEOPLE.filter((p) => p.toLowerCase().includes(q) && !r.includes(p)).slice(0, 5) : [];
  return `<div class="rc-box">${r.map((p, i) => `<span class="rc-chip">${av(p.split(' ').map((w) => w[0]).slice(0, 2).join(''), '#64748b', 'xs')}${esc(p)}<button data-act="rcDel" data-v="${i}" title="Hapus">${I('x')}</button></span>`).join('')}
      <input id="rcIn" value="${esc(S.rq || '')}" placeholder="${r.length ? 'Tambah orang lain…' : 'Ketik nama karyawan…'}"></div>
    ${sugg.length || q ? `<div class="rc-sugg">${sugg.map((p) => `<button data-act="rcAdd" data-v="${esc(p)}">${I('user')}${esc(p)}</button>`).join('')}${q && !PEOPLE.some((p) => p.toLowerCase() === q) ? `<button data-act="rcAdd" data-v="${esc(S.rq)}">${I('plus')}Tambah “${esc(S.rq)}” (nama manual)</button>` : ''}</div>` : ''}
    ${r.includes(LEONY.name) ? '' : `<button class="btn sm ghost" data-act="rcAdd" data-v="${LEONY.name}" style="margin-top:6px">${I('user')}Untuk saya sendiri</button>`}`;
}
function refreshRecip() {
  const h = $('#recipHost'); if (!h) return;
  h.innerHTML = recipHtml();
  const i = $('#rcIn'); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
  i.oninput = () => { S.rq = i.value; refreshRecip(); };
  i.onkeydown = (e) => { if (e.key === 'Enter' && i.value.trim()) { e.preventDefault(); A.rcAdd(i.value.trim()); } if (e.key === 'Backspace' && !i.value && S.recips.length) A.rcDel(S.recips.length - 1); };
  refreshPicker();
}

/* ---------------- Form Hardware (pemohon) ---------------- */
function formHW() {
  if (!S.recips) S.recips = [LEONY.name];
  const sec = (n, title, sub, body) => `<div class="fsec"><div class="fsec-h"><span class="fn">${n}</span><div><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div></div>${body}</div>`;
  return sec(1, 'Barang apa yang dibutuhkan?', 'Pilih dari katalog, bisa lebih dari satu. Tidak ada di katalog? Pakai “Tulis manual”.', `<div id="pickerHost">${pickerHtml()}</div>`)
    + sec(2, 'Untuk siapa?', 'Bisa untuk Anda sendiri atau orang lain, lebih dari satu orang.', `<div id="recipHost">${recipHtml()}</div>
      <div class="grid2"><div><label class="fl">Divisi / departemen penerima <em>*</em></label><input class="fi-in" id="fDiv" list="deptList" value="QC AB Reguler"><datalist id="deptList">${DEPTS.map((d) => `<option>${d}</option>`).join('')}</datalist></div>
      <div><label class="fl">Atasan Anda</label><select class="fi-in" id="fMgr">${MANAGERS.map((m) => `<option>${m}</option>`).join('')}</select><small class="hint2">Hanya diminta tanda tangan bila IT memerlukannya.</small></div></div>`)
    + sec(3, 'Kenapa dibutuhkan?', '', `<label class="fl">Judul singkat <em>*</em></label><input class="fi-in" id="fTitle" placeholder="Contoh: Laptop untuk 2 staf baru QC">
      <label class="fl">Alasan <em>*</em></label><textarea class="fi-in" id="fDesc" placeholder="Contoh: dua staf baru mulai 1 Des, belum punya perangkat kerja"></textarea>`)
    + sec(4, 'Tanda tangan', 'Masuk ke dokumen permintaan resmi.', sigPad())
    + `<div class="note">${I('info')}<span>Setelah dikirim, IT meninjau barang (bisa mengganti bila stok tidak ada), menentukan anggaran (budget tahunan / non-budget / stok IT) dan siapa yang perlu menyetujui. Semua kabar muncul di tiket ini.</span></div>
    <div class="ffoot"><span class="muted small" style="margin-right:auto">${I('checkC')} Isian tersimpan otomatis</span><button class="btn" data-act="pickType" data-v="">Batal</button><button class="btn hwb" data-act="submitCreate">${I('up')}Kirim permintaan</button></div>`;
}

/* ---------------- Form E-Form (6 jenis, lengkap) ---------------- */
function efState() {
  if (!S.ef) S.ef = { kind:S.efKind || 'VPN', from:iso(TODAY), to:iso(addM(TODAY, 12)), need:'', websites:'', net:'', host:'', usb:'RO', fdInfo:'', email:'', emailType:'PERSONAL', acct:'NEW', acctName:'', servers:['SPJ'], folders:[], shots:0, reason:'', dept:'QC AB Reguler', terms:false, read:false };
  return S.ef;
}
function presetsFor(kind) {
  const p = [];
  if (kind === 'FLASHDISK') p.push(['+1 hari', 'd1'], ['+1 minggu', 'd7']);
  p.push(['+1 bln', 'm1'], ['+3 bln', 'm3'], ['+6 bln', 'm6']);
  p.push(PERMANENT_KINDS.includes(kind) ? ['Permanen', 'perm'] : ['+12 bln', 'm12']);
  return p;
}
function efTypeFields(e) {
  const k = e.kind;
  const inp = (key, ph, extra = '') => `<input class="fi-in" data-ef="${key}" value="${esc(e[key] || '')}" placeholder="${ph}" ${extra}>`;
  const seg = (key, opts) => `<div class="radios">${opts.map(([v, l, d]) => `<span class="radio ${e[key] === v ? 'on' : ''}" data-act="efSet" data-v="${key}:${v}"><span><b>${l}</b>${d ? `<small class="muted" style="display:block">${d}</small>` : ''}</span></span>`).join('')}</div>`;
  if (k === 'VPN') return `<label class="fl">Kebutuhan akses VPN <em>*</em></label>${seg('need', [['REMOTE', 'Remote PC kantor', 'Mengendalikan PC kantor dari luar'], ['NETWORK', 'Akses jaringan kantor', 'Membuka server / aplikasi internal']])}`;
  if (k === 'WEBSITE') return `<label class="fl">Website yang diminta <em>*</em></label><textarea class="fi-in" data-ef="websites" placeholder="Satu alamat per baris, misal: djponline.pajak.go.id">${esc(e.websites)}</textarea>`;
  if (k === 'NETWORK') return `<label class="fl">Tujuan / target jaringan <em>*</em></label>${inp('net', 'Misal: server ERP 10.10.5.20 port 1521')}`;
  if (k === 'FLASHDISK') return `<div class="grid2"><div><label class="fl">Hostname PC <em>*</em></label>${inp('host', 'Misal: QC03', 'style="font-family:var(--mono)"')}<small class="hint2">Lihat di stiker PC atau tanya IT lewat chat.</small></div>
      <div><label class="fl">Jenis akses USB <em>*</em></label>${seg('usb', [['RO', 'Baca saja'], ['RW', 'Baca & tulis']])}</div></div>
      <label class="fl">Keterangan flashdisk</label>${inp('fdInfo', 'Merek, kapasitas, nomor seri (opsional)')}`;
  if (k === 'EMAIL') return `<label class="fl">Usulan alamat email <em>*</em></label><div class="email-in"><input class="fi-in" data-ef="email" value="${esc(e.email)}" placeholder="nama.belakang"><span>@kapalapi.co.id</span></div>
      <small class="hint2" id="emailPrev">${e.email ? `Akan menjadi <b>${esc(e.email)}@kapalapi.co.id</b>` : 'Huruf kecil, angka, titik, strip. Contoh: budi.santoso'}</small>
      <label class="fl">Jenis akun <em>*</em></label>${seg('emailType', [['PERSONAL', 'Pribadi', 'Untuk satu karyawan'], ['SHARING', 'Bersama', 'Untuk departemen / tim']])}`;
  // NAS
  const srv = NAS_SERVERS.map((s) => `<span class="radio ${e.servers.includes(s.id) ? 'on' : ''}" data-act="efSrv" data-v="${s.id}"><b>${s.id}</b><small class="muted">&nbsp;${s.ip}</small></span>`).join('');
  return `<label class="fl">Akun Synology <em>*</em></label>${seg('acct', [['NEW', 'Belum punya akun'], ['EXISTING', 'Sudah punya akun']])}
    ${e.acct === 'EXISTING' ? `<label class="fl">Nama akun Synology Anda <em>*</em></label>${inp('acctName', 'Misal: leony.r')}` : ''}
    <label class="fl">Lokasi server <em>*</em></label><div class="radios">${srv}</div>
    <label class="fl">Folder yang diminta <em>*</em></label>
    <div class="nas-add"><select class="fi-in" id="nasSrv">${e.servers.map((s) => `<option>${s}</option>`).join('')}</select><input class="fi-in" id="nasPath" placeholder="\\\\nas01\\QC\\Laporan atau /QC/Laporan" style="font-family:var(--mono)"><select class="fi-in" id="nasRw"><option value="RO">Baca saja</option><option value="RW">Baca & tulis</option></select><button class="btn sm efb" data-act="nasAdd">${I('plus')}Tambah</button></div>
    ${e.folders.length ? `<table class="tbl" style="margin-top:8px"><thead><tr><th>Server</th><th>Folder</th><th>Hak akses</th><th></th></tr></thead><tbody>${e.folders.map((f, i) => `<tr><td><span class="pill sm p-neutral">${f.srv}</span></td><td class="mono">${esc(f.path)}</td><td><span class="radio sm ${f.rw === 'RO' ? 'on' : ''}" data-act="nasRwSet" data-v="${i}:RO">Baca</span> <span class="radio sm ${f.rw === 'RW' ? 'on' : ''}" data-act="nasRwSet" data-v="${i}:RW">Baca & tulis</span></td><td><button class="x" data-act="nasDel" data-v="${i}">${I('x')}</button></td></tr>`).join('')}</tbody></table>` : '<p class="muted small" style="margin-top:6px">Belum ada folder.</p>'}
    <label class="fl">Screenshot folder (opsional, maks 5)</label><div class="drop" data-act="nasShot">${I('upload')}<p>${e.shots ? `<b>${e.shots} screenshot</b> terlampir — klik untuk tambah` : 'Klik, seret, atau Ctrl+V untuk menempel screenshot'}</p></div>`;
}
function formEF() {
  const e = efState();
  const k = e.kind;
  const groups = [['Konektivitas & perangkat', ['VPN', 'WEBSITE', 'NETWORK', 'FLASHDISK']], ['Akun & penyimpanan', ['EMAIL', 'SYNOLOGY_NAS']]];
  const perm = !e.to;
  const sec = (n, title, sub, body) => `<div class="fsec"><div class="fsec-h"><span class="fn">${n}</span><div><b>${title}</b>${sub ? `<span>${sub}</span>` : ''}</div></div>${body}</div>`;
  const reasons = REASONS[k] || [];
  return (S.renewFrom ? `<div class="banner ef">${I('refresh')}<div style="flex:1"><b>Mode perpanjangan</b> — isian disalin dari tiket #${esc(T(S.renewFrom)?.num || '')}. Periksa tanggal lalu kirim.</div></div>` : '')
    + sec(1, 'Akses apa yang dibutuhkan?', '', `<div class="efgroups">${groups.map(([g, ks]) => `<div><span class="efg-h">${g}</span><div class="kindgrid">${ks.map((kk) => `<button class="kindb ${k === kk ? 'on' : ''}" data-act="efKind" data-v="${kk}">${I(EF_KINDS[kk].icon)}${EF_KINDS[kk].label}</button>`).join('')}</div></div>`).join('')}</div>`)
    + sec(2, `Detail akses ${EF_KINDS[k].label}`, '', efTypeFields(e))
    + sec(3, 'Berapa lama?', MAX12_KINDS.includes(k) ? 'Maksimal 12 bulan. Bisa diperpanjang nanti.' : 'Boleh permanen.', `<div class="pk-chips">${presetsFor(k).map(([l, v]) => `<button data-act="efPreset" data-v="${v}" class="${(v === 'perm' && perm) ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="grid2"><div><label class="fl">Mulai <em>*</em></label><input class="fi-in" type="date" data-ef="from" value="${e.from}"></div><div><label class="fl">Sampai ${PERMANENT_KINDS.includes(k) ? '<span class="muted">(kosongkan bila permanen)</span>' : '<em>*</em>'}</label><input class="fi-in" type="date" data-ef="to" value="${e.to || ''}" min="${e.from}"></div></div><p class="small" id="efDur" style="margin-top:6px"></p>`)
    + sec(4, 'Untuk keperluan apa?', '', `<div class="pk-chips" style="margin-bottom:8px">${reasons.map((r) => `<button data-act="efReason" data-v="${esc(r)}">${I('plus')}${esc(r)}</button>`).join('')}</div>
      <textarea class="fi-in" data-ef="reason" placeholder="Jelaskan singkat">${esc(e.reason)}</textarea>
      <div class="grid2"><div><label class="fl">Departemen <em>*</em></label><input class="fi-in" data-ef="dept" list="deptList2" value="${esc(e.dept)}"><datalist id="deptList2">${DEPTS.map((d) => `<option>${d}</option>`).join('')}</datalist></div>
      <div><label class="fl">Atasan Anda</label><select class="fi-in">${MANAGERS.map((m) => `<option>${m}</option>`).join('')}</select><small class="hint2">Hanya diminta tanda tangan bila IT memerlukannya.</small></div></div>`)
    + sec(5, 'Syarat & tanda tangan', 'Baca sampai bawah untuk bisa menyetujui.', `<div class="terms" id="terms"><b>Syarat penggunaan akses ${EF_KINDS[k].label}</b><ol>${EF_TERMS.map((x) => `<li>${x}</li>`).join('')}</ol><p class="muted small">Pelanggaran dapat dikenai sanksi sesuai peraturan perusahaan.</p></div>
      <label class="ckline ${e.read ? '' : 'dis'}"><input type="checkbox" id="termsCk" ${e.read ? '' : 'disabled'} ${e.terms ? 'checked' : ''}> Saya sudah membaca dan menyetujui syarat di atas <span class="muted small" id="termsHint">${e.read ? '' : '— scroll sampai bawah dulu'}</span></label>
      <label class="fl">Tanda tangan <em>*</em></label>${sigPad()}`)
    + `<div class="note">${I('info')}<span>IT meninjau lalu menentukan perlu tanda tangan atasan / GM atau tidak. Dokumen ${EF_KINDS[k].code} dibuat otomatis dari isian ini.</span></div>
    <div class="ffoot"><span class="muted small" style="margin-right:auto">${I('checkC')} Isian tersimpan otomatis</span><button class="btn" data-act="pickType" data-v="">Batal</button><button class="btn efb" data-act="submitCreate">${I('up')}Kirim permintaan</button></div>`;
}
function bindEF() {
  const e = S.ef; if (!e || !$('#terms')) return;
  const dur = () => { const el = $('#efDur'); if (!el) return; if (!e.to) { el.innerHTML = `<span class="pill sm p-green">Permanen</span>`; return; } const d = Math.round((new Date(e.to) - new Date(e.from)) / 86400000); const over = MAX12_KINDS.includes(e.kind) && d > 366; el.innerHTML = d < 0 ? '<span style="color:var(--red-ink)">Tanggal selesai sebelum mulai</span>' : `Masa berlaku <b>${d} hari</b> · ${fmtD(new Date(e.from))} – ${fmtD(new Date(e.to))}${over ? ' <span style="color:var(--red-ink)">— melebihi 12 bulan</span>' : ''}`; };
  dur();
  document.querySelectorAll('[data-ef]').forEach((n) => { n.oninput = n.onchange = () => {
    let v = n.value;
    if (n.dataset.ef === 'email') { v = v.toLowerCase().replace(/[^a-z0-9._-]/g, ''); n.value = v; $('#emailPrev').innerHTML = v ? `Akan menjadi <b>${esc(v)}@kapalapi.co.id</b>` : 'Huruf kecil, angka, titik, strip.'; }
    e[n.dataset.ef] = v; if (['from', 'to'].includes(n.dataset.ef)) dur();
  }; });
  const box = $('#terms'); box.onscroll = () => { if (!e.read && box.scrollTop + box.clientHeight >= box.scrollHeight - 4) { e.read = true; $('#termsCk').disabled = false; $('#termsHint').textContent = ''; box.parentElement.querySelector('.ckline').classList.remove('dis'); } };
  $('#termsCk').onchange = (ev) => { e.terms = ev.target.checked; };
}
function efFieldsMap(e) {
  const m = {};
  if (e.kind === 'VPN') m['Kebutuhan'] = e.need === 'REMOTE' ? 'Remote PC kantor' : 'Akses jaringan kantor';
  if (e.kind === 'WEBSITE') m['Website'] = e.websites.split(/\n|,/).map((x) => x.trim()).filter(Boolean).join(', ');
  if (e.kind === 'NETWORK') m['Tujuan'] = e.net;
  if (e.kind === 'FLASHDISK') Object.assign(m, { 'Hostname PC':e.host, 'Akses USB':e.usb === 'RW' ? 'Baca & tulis' : 'Baca saja' }, e.fdInfo ? { 'Flashdisk':e.fdInfo } : {});
  if (e.kind === 'EMAIL') Object.assign(m, { 'Alamat':`${e.email}@kapalapi.co.id`, 'Jenis akun':e.emailType === 'SHARING' ? 'Bersama' : 'Pribadi' });
  if (e.kind === 'SYNOLOGY_NAS') Object.assign(m, { 'Akun':e.acct === 'EXISTING' ? `Sudah ada · ${e.acctName}` : 'Akun baru', 'Folder':e.folders.map((f) => `${f.srv} ${f.path} (${f.rw === 'RW' ? 'baca & tulis' : 'baca'})`).join('; ') }, e.shots ? { 'Screenshot':`${e.shots} lampiran` } : {});
  m['Masa berlaku'] = e.to ? `${fmtD(new Date(e.from))} – ${fmtD(new Date(e.to))}` : `Mulai ${fmtD(new Date(e.from))} · permanen`;
  m['Alasan'] = e.reason;
  return m;
}
function efMissing(e) {
  if (e.kind === 'VPN' && !e.need) return 'Pilih kebutuhan VPN';
  if (e.kind === 'WEBSITE' && !e.websites.trim()) return 'Isi website yang diminta';
  if (e.kind === 'NETWORK' && !e.net.trim()) return 'Isi tujuan jaringan';
  if (e.kind === 'FLASHDISK' && !e.host.trim()) return 'Isi hostname PC';
  if (e.kind === 'EMAIL' && !e.email) return 'Isi usulan alamat email';
  if (e.kind === 'SYNOLOGY_NAS' && !e.folders.length && !e.shots) return 'Tambahkan minimal satu folder atau screenshot';
  if (e.kind === 'SYNOLOGY_NAS' && e.acct === 'EXISTING' && !e.acctName) return 'Isi nama akun Synology';
  if (!e.to && !PERMANENT_KINDS.includes(e.kind)) return 'Isi tanggal selesai';
  if (e.to && e.to < e.from) return 'Tanggal selesai sebelum mulai';
  if (e.to && MAX12_KINDS.includes(e.kind) && (new Date(e.to) - new Date(e.from)) / 86400000 > 366) return 'Maksimal 12 bulan';
  if (!e.reason.trim()) return 'Isi keperluan';
  if (!e.terms) return 'Setujui syarat penggunaan';
  return '';
}

/* ---------------- Review IT: jenis anggaran dipilih IT ---------------- */
function mReview(t) {
  if (t.type === 'hw') { S.pickerMode = 'edit'; S.basket = basketFromItems(t.hw.items); S.pq = ''; S.pcat = ''; S.swapIdx = null; S.otherOpen = false; }
  const kinds = [['Budget Tahunan', 'Budget tahunan', 'Masuk anggaran ICT tahun ini'], ['Non-Budget', 'Non-budget', 'Di luar anggaran tahunan'], ['Stok IT', 'Ambil dari stok IT', 'Barang ada di gudang — lewati pembelian']];
  const cur = t.hw?.fromStock ? 'Stok IT' : (t.hw?.kind || 'Budget Tahunan');
  const hwPart = t.type === 'hw' ? `<div class="step-h">1. Periksa barang <span class="muted" style="font-weight:500">— ganti bila stok/spesifikasi tidak tersedia</span></div><div id="pickerHost">${pickerHtml()}</div>
     <div class="step-h">2. Sumber barang</div><div class="route" id="kindSel">${kinds.map(([v, l, d]) => `<div class="ropt ${cur === v ? 'on' : ''}" data-act="routePick" data-v="${v}"><span class="rd"></span><div><b>${l}</b><small>${d}</small></div></div>`).join('')}</div>` : '';
  const n = t.type === 'hw' ? 3 : 1;
  modal(`${I('shield')} Tinjau ${esc(TYPES[t.type].label)}`,
    `${hwPart}<div class="step-h">${n}. Siapa yang harus menyetujui?</div><div class="route" id="routeSel">${Object.entries(ROUTES).map(([k, v]) => `<div class="ropt ${(t.route || (t.type === 'ef' && t.ef.kind === 'VPN' ? 'mgr_gm' : t.type === 'ef' && t.ef.kind === 'SYNOLOGY_NAS' ? 'none' : 'mgr')) === k ? 'on' : ''}" data-act="routePick" data-v="${k}"><span class="rd"></span><div><b>${v.label}</b><small>${v.desc}</small></div></div>`).join('')}</div>
     <div class="grid2"><div><label class="fl">Atasan</label><select class="fi-in" id="selMgr">${MANAGERS.map((m) => `<option ${m === t.mgr ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
     <div><label class="fl">GM</label><select class="fi-in" id="selGm">${GMS.map((m) => `<option>${m}</option>`).join('')}</select></div></div>
     <label class="fl">Pesan ke pemohon (muncul di chat)</label><textarea class="fi-in" id="rvNote" placeholder="Opsional"></textarea>`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn navy" data-act="doReview">${I('fwd')}Simpan & lanjutkan</button>`, t.type === 'hw');
  bindPicker();
}

/* ---------------- Pembelian: per barang, vendor/harga/invoice ---------------- */
function mProcure(t) {
  modal(`${I('package')} Catat pembelian`, `<p class="muted small" style="margin-bottom:10px">Setujui atau batalkan per barang. No. invoice boleh diisi nanti.</p>
    <div class="proc">${t.hw.items.map((it, i) => `<div class="proc-row" data-i="${i}"><div class="proc-h"><span class="iic">${I(catIcon(it.cat))}</span><div><b>${esc(it.name)}</b><span class="muted small">${it.qty} unit${it.to ? ' · untuk ' + esc(it.to) : ''}</span></div>
        <div class="pseg sm"><button class="on" data-act="procDec" data-v="${i}:approved">Beli</button><button data-act="procDec" data-v="${i}:rejected">Batal beli</button></div></div>
      <div class="proc-f"><label>Vendor<input class="fi-in" data-p="vendor" value="CV Sinar Komputer"></label><label>Harga / unit<input class="fi-in" data-p="cost" value="Rp 12.400.000"></label><label>No. invoice<input class="fi-in" data-p="inv" placeholder="Boleh nanti"></label><label>Tgl invoice<input class="fi-in" type="date" data-p="invDate"></label></div></div>`).join('')}</div>`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn hwb" data-act="doProcure">${I('check')}Simpan pembelian</button>`, true);
}

/* ---------------- Barang tiba: per barang ---------------- */
function mArrive(t) {
  const items = t.hw.items.filter((it) => ['approved', 'arrived'].includes(it.state));
  modal(`${I('truck')} Barang yang sudah tiba`, `<p class="muted small" style="margin-bottom:10px">Centang yang sudah diterima gudang IT. Pemasangan bisa dijadwalkan untuk barang yang sudah tiba.</p>
    ${items.map((it) => `<label class="ckrow"><input type="checkbox" data-arr="${t.hw.items.indexOf(it)}" ${it.state === 'arrived' ? 'checked' : 'checked'}><span class="iic">${I(catIcon(it.cat))}</span><div><b>${esc(it.name)}</b><span class="muted small">${it.qty} unit · ${esc(it.vendor || '')}</span></div></label>`).join('')}`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn hwb" data-act="doArrive">${I('check')}Simpan</button>`);
}

/* ---------------- Jadwal pemasangan: teknisi + 1–3 slot ---------------- */
function slotRow(i) {
  return `<div class="slot" data-s="${i}"><b class="slot-n">Pilihan ${i + 1}</b>
    <div class="pk-chips">${['Hari ini', 'Besok', 'Lusa'].map((l, j) => `<button data-act="slotDay" data-v="${i}:${j}" class="${j === 1 ? 'on' : ''}">${l}</button>`).join('')}<input class="fi-in sl-date" type="date" value="${iso(addD(TODAY, 1 + i))}" style="height:30px;width:150px"></div>
    <div class="pk-chips">${['08.00', '09.00', '10.00', '11.00', '13.00', '14.00', '15.00', '16.00'].map((h, j) => `<button data-act="slotHour" data-v="${i}:${h}" class="${j === (i === 0 ? 1 : 5) ? 'on' : ''}">${h}</button>`).join('')}
      <select class="fi-in sl-dur" style="height:30px;width:110px"><option value="1">1 jam</option><option value="2" selected>2 jam</option><option value="3">3 jam</option><option value="4">4 jam</option></select></div>
    ${i ? `<button class="x" data-act="slotDel" data-v="${i}" title="Hapus pilihan">${I('x')}</button>` : ''}</div>`;
}
function mSchedule(t) {
  const ready = t.hw.items.filter((it) => it.state === 'arrived' || t.hw.fromStock);
  const resch = t.hw.resched || 0;
  modal(`${I('cal')} Usulkan jadwal pemasangan`, `${resch ? `<div class="note warn">${I('refresh')}<span>Jadwal ulang ke-${resch} dari maksimal ${RESCHEDULE_LIMIT}.${t.hw.lastAsk ? ` Pemohon meminta: <b>${esc(t.hw.lastAsk)}</b>` : ''}</span></div>` : ''}
    <label class="fl">Barang yang dipasang</label>${ready.map((it) => `<label class="ckrow"><input type="checkbox" checked><span class="iic">${I(catIcon(it.cat))}</span><div><b>${esc(it.name)}</b><span class="muted small">${it.qty} unit</span></div></label>`).join('')}
    <label class="fl">Teknisi</label><div class="techs">${TECHS.map((x, i) => `<span class="tech ${x.n === (t.pic || TECHS[1].n) ? 'on' : ''}" data-act="techPick" data-v="${i}"><b>${esc(x.n)}</b><small>${x.load} pemasangan minggu ini${x.load >= 3 ? ' · <span style="color:var(--red-ink)">padat</span>' : ''}</small></span>`).join('')}</div>
    <div id="clash"></div>
    <label class="fl">Pilihan waktu untuk pemohon <span class="muted" style="font-weight:500">(1–3)</span></label><div id="slots">${slotRow(0)}${slotRow(1)}</div>
    <button class="btn sm" data-act="slotAdd" style="margin-top:6px">${I('plus')}Tambah pilihan</button>`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn hwb" data-act="doSchedule">${I('fwd')}Kirim ke pemohon</button>`, true);
}
function readSlots() {
  return [...document.querySelectorAll('#slots .slot')].map((s) => {
    const d = new Date(s.querySelector('.sl-date').value + 'T00:00:00');
    const h = s.querySelector('[data-act=slotHour].on')?.dataset.v.split(':')[1] || '09.00';
    const dur = Number(s.querySelector('.sl-dur').value);
    const end = `${String(Number(h.slice(0, 2)) + dur).padStart(2, '0')}.00`;
    return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} · ${h}–${end}`;
  });
}

/* ---------------- Pilih waktu (pemohon) dengan batas jadwal ulang ---------------- */
function mPickSlot(t) {
  const left = RESCHEDULE_LIMIT - (t.hw.resched || 0);
  modal(`${I('cal')} Pilih waktu pemasangan`, `<div class="route" id="slotSel">${t.hw.schedule.slots.map((s, i) => `<div class="ropt ${i === 0 ? 'on' : ''}" data-act="routePick" data-v="${i}"><span class="rd"></span><div><b>${esc(s)}</b><small>Teknisi ${esc(t.hw.schedule.tech)}</small></div></div>`).join('')}
      ${left > 0 ? `<div class="ropt" data-act="routePick" data-v="other"><span class="rd"></span><div><b>Tidak bisa semua — minta waktu lain</b><small>Sisa ${left}× permintaan jadwal ulang</small></div></div>` : `<div class="note warn">${I('alert')}<span>Batas jadwal ulang (${RESCHEDULE_LIMIT}×) sudah tercapai. Hubungi IT lewat chat bila tetap tidak bisa.</span></div>`}</div>
    ${left > 0 ? '<input class="fi-in" id="otherTime" placeholder="Waktu yang Anda bisa, misal: Rabu pagi setelah jam 10" style="margin-top:8px">' : ''}`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn navy" data-act="doPickSlot">${I('check')}Kirim</button>`);
}

/* ---------------- Selesai pasang: barcode per unit ---------------- */
function mInstallDone(t) {
  t = t || T(S.sel);
  const units = t.hw.items.filter((it) => it.state === 'arrived' || t.hw.fromStock).flatMap((it) => Array.from({ length:it.qty }, (_, u) => ({ it, u })));
  modal(`${I('barcode')} Selesaikan pemasangan`, `<p class="muted small" style="margin-bottom:10px">Tempel label aset lalu scan barcode tiap unit. Aset otomatis tercatat atas nama penerima.</p>
    <div class="units">${units.map(({ it, u }, i) => `<div class="unit"><span class="iic">${I(catIcon(it.cat))}</span><div class="unit-n"><b>${esc(it.name)}</b><span class="muted small">Unit ${u + 1}${it.to ? ' · ' + esc(it.to) : ''}</span></div><input class="fi-in mono bc" data-u="${i}" placeholder="Kode aset"><button class="btn sm" data-act="scan" data-v="${i}">${I('barcode')}Scan</button></div>`).join('')}</div>
    <label class="fl">Foto serah terima (opsional)</label><div class="drop">${I('upload')}<p>Klik atau seret foto</p></div>
    <label class="fl">Tanda tangan teknisi</label>${sigPad()}`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn hwb" data-act="doInstallDone">${I('check')}Selesai — minta pemohon cek</button>`, true);
}

/* ---------------- E-Form: beri akses (dengan / tanpa kredensial) ---------------- */
function mFulfill(t) {
  const k = t.ef.kind;
  const def = ['SYNOLOGY_NAS', 'WEBSITE', 'FLASHDISK'].includes(k) ? 'nocred' : 'cred';
  S.fulMode = S.fulMode || def;
  const cred = `<div class="grid2"><div><label class="fl">${k === 'EMAIL' ? 'Alamat email resmi' : 'Username'} <em>*</em></label><input class="fi-in mono" id="cu" value="${k === 'EMAIL' ? (t.ef.fields['Alamat'] || 'leony.r@kapalapi.co.id') : 'leony.r'}"></div><div><label class="fl">Password awal <em>*</em></label><input class="fi-in mono" id="cp" value="Vpn#2026-Qc!"></div>
      ${k !== 'EMAIL' ? `<div><label class="fl">${k === 'SYNOLOGY_NAS' ? 'Host / folder NAS' : 'Server / host'}</label><input class="fi-in mono" id="cs" value="${k === 'VPN' ? 'vpn.kapalapi.co.id' : ''}"></div>` : ''}<div><label class="fl">Catatan untuk pemohon</label><input class="fi-in" id="cn" placeholder="Opsional"></div></div>`;
  const nocred = `<div class="grid2"><div><label class="fl">Nama akun ${k === 'SYNOLOGY_NAS' ? 'Synology' : ''}</label><input class="fi-in" id="fa" value="${esc((t.ef.fields['Akun'] || '').replace('Sudah ada · ', ''))}"></div><div><label class="fl">Catatan realisasi <em>*</em></label><input class="fi-in" id="fn" value="${k === 'SYNOLOGY_NAS' ? 'Folder ditambahkan ke grup akses' : 'Akses sudah dibuka'}"></div></div>`;
  modal(`${I('key')} Beri akses ${EF_KINDS[k].label}`, `<div class="route" id="fulSel"><div class="ropt ${S.fulMode === 'cred' ? 'on' : ''}" data-act="fulMode" data-v="cred"><span class="rd"></span><div><b>Kirim username & password</b><small>Disimpan terenkripsi, hanya pemohon & IT yang bisa melihat</small></div></div>
      <div class="ropt ${S.fulMode === 'nocred' ? 'on' : ''}" data-act="fulMode" data-v="nocred"><span class="rd"></span><div><b>Akses dibuka tanpa kredensial baru</b><small>Misal folder NAS, website, USB</small></div></div></div>
    <div id="fulBody">${S.fulMode === 'cred' ? cred : nocred}</div><label class="fl">Tanda tangan IT</label>${sigPad()}`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn efb" data-act="doFulfill">${I('check')}Simpan — minta pemohon coba</button>`);
}
function mCred(t) {
  const c = t.ef.cred;
  const row = (l, v, secret) => `<div class="credrow"><span>${l}</span><code class="${secret ? 'masked' : ''}" data-v="${esc(v)}">${secret ? '••••••••••' : esc(v)}</code>${secret ? `<button class="btn sm ghost" data-act="credEye">${I('eye')}</button>` : ''}<button class="btn sm ghost" data-act="copy" data-v="${esc(v)}">${I('copy')}Salin</button></div>`;
  modal(`${I('key')} Kredensial ${EF_KINDS[t.ef.kind].label}`, `${row(t.ef.kind === 'EMAIL' ? 'Email' : 'Username', c.user)}${row('Password', c.pass, true)}${c.server ? row('Server', c.server) : ''}${c.note ? `<p class="small" style="margin-top:8px">Catatan IT: ${esc(c.note)}</p>` : ''}
    <div class="note warn">${I('alert')}<span>Segera ganti password setelah login pertama. Setiap kali dibuka tercatat di Aktivitas.</span></div>`, `<button class="btn navy" data-act="closeModal">Tutup</button>`);
}
function mDocNo(t) {
  modal(`${I('pen')} Ubah nomor dokumen`, `<label class="fl">Nomor dokumen</label><input class="fi-in mono" id="docNo" value="${esc(t.docNo)}"><small class="hint2">Huruf, angka, / . _ - · maks 50 karakter · harus unik</small>`,
    `<button class="btn" data-act="closeModal">Batal</button><button class="btn navy" data-act="doDocNo">${I('check')}Simpan</button>`);
}

/* ---------------- Panel kanan: barang lengkap + masa berlaku ---------------- */
function hwItemsHtml(t) {
  return t.hw.items.map((it) => `<div class="item"><span class="iic">${I(catIcon(it.cat))}</span><div style="min-width:0"><b>${esc(it.name)}</b>${it.was ? `<span class="was">Pengganti dari <s>${esc(it.was)}</s></span>` : ''}${it.added ? '<span class="was">Ditambahkan IT</span>' : ''}
    <span>${esc([it.to ? 'Untuk ' + it.to : '', it.spec !== '-' ? it.spec : ''].filter(Boolean).join(' · ') || '')}</span>
    ${it.vendor ? `<span class="muted small">${esc(it.vendor)}${it.cost ? ' · ' + esc(it.cost) : ''}${it.inv ? ' · Inv ' + esc(it.inv) : ''}</span>` : ''}
    ${(t.hw.assets || []).filter((a) => a.name === it.name).map((a) => `<span class="assetchip">${I('barcode')}${esc(a.code)}</span>`).join('')}</div><div class="q"><b>×${it.qty}</b>${itemState(it)}</div></div>`).join('');
}
function itemState(it) {
  const m = { pending:['p-neutral', 'Menunggu'], approved:['p-sky', 'Dibeli'], rejected:['p-red', 'Batal beli'], arrived:['p-green', 'Tiba'] }[it.state] || ['p-neutral', it.state];
  return `<div><span class="pill sm ${m[0]}" style="margin-top:3px">${m[1]}</span></div>`;
}
function expiryBadge(to) {
  if (!to) return '<span class="pill sm p-green">Permanen</span>';
  const d = daysLeft(to);
  if (d < 0) return '<span class="pill sm p-red">Kedaluwarsa</span>';
  if (d === 0) return '<span class="pill sm p-red">Berakhir hari ini</span>';
  if (d <= 7) return `<span class="pill sm p-amber">Sisa ${d} hari</span>`;
  return `<span class="pill sm p-neutral">Sisa ${d} hari</span>`;
}

/* ---------------- Portal: kartu "Akses aktif Anda" ---------------- */
function activeAccessCard() {
  const mine = S.tickets.filter((t) => t.type === 'ef' && t.reqMe && t.phase === 'done');
  if (!mine.length) return '';
  return `<div class="accard ann" data-ann="Akses aktif + perpanjang dari sini"><div class="accard-h">${I('key')}<b>Akses aktif Anda</b><span class="muted small">Kami ingatkan H-7, H-3 dan di hari terakhir</span></div>
    ${mine.map((t) => `<div class="acrow"><span class="ptile t-mint">${I(EF_KINDS[t.ef.kind].icon)}</span><div style="flex:1;min-width:0"><b>${EF_KINDS[t.ef.kind].label}</b><span class="muted small">${esc(t.ef.to ? 'sampai ' + fmtD(new Date(t.ef.to)) : 'permanen')}</span></div>${expiryBadge(t.ef.to)}
      ${t.ef.cred ? `<button class="btn sm ghost" data-act="openCred" data-v="${t.id}">${I('key')}Kredensial</button>` : ''}${t.ef.to && daysLeft(t.ef.to) <= 30 ? `<button class="btn sm efb" data-act="renew" data-v="${t.id}">${I('refresh')}Perpanjang</button>` : ''}</div>`).join('')}</div>`;
}

/* ============================ PERANGKAT & AKSES (halaman pendukung IT) ============================ */
function centerData() {
  const fromTickets = S.tickets.filter((t) => t.type === 'hw' && t.hw.schedule && t.hw.schedule.chosen != null).map((t) => {
    const s = t.hw.schedule.slots[t.hw.schedule.chosen]; const dn = Number((s.match(/, (\d+) /) || [])[1]); const day = dn ? addD(TODAY, dn - TODAY.getDate()).getDay() : DAYS.indexOf(s.split(',')[0]);
    return { day, time:s.split('· ')[1], tech:t.hw.schedule.tech, num:t.num, title:t.title, site:'SPJ', st:t.phase === 'install' ? (t.started ? 'Berjalan' : 'Terjadwal') : 'Selesai', id:t.id };
  });
  const base = [
    { day:1, time:'09.00–11.00', tech:'YUDI ARTA TRIRENSILA', num:'181126-PRO-0019', title:'PC Office i5 line 2', site:'SPJ', st:'Terjadwal' },
    { day:2, time:'13.00–15.00', tech:'BENY SAPUTRA, S.KOM', num:'171126-ACC-0016', title:'Monitor 27" Accounting', site:'SMG', st:'Terjadwal' },
    { day:3, time:'10.00–12.00', tech:'YUDI ARTA TRIRENSILA', num:'161126-HSE-0014', title:'Access Point gudang', site:'SPJ', st:'Menunggu pilih' },
    { day:4, time:'14.00–16.00', tech:'RM BAGASTYO A.W.', num:'151126-MKT-0011', title:'Laptop Design marketing', site:'KRW', st:'Terjadwal' },
  ];
  return [...base, ...fromTickets];
}
const ACCESS_ROWS = [
  { who:'Andi Pratama', dept:'QC AB Reguler', kind:'VPN', from:'2025-12-01', to:'2026-11-27' },
  { who:'Sari Wulandari', dept:'Finance & Accounting', kind:'NETWORK', from:'2026-06-01', to:'2026-11-30' },
  { who:'Budi Santoso', dept:'Produksi 1', kind:'FLASHDISK', from:'2026-11-01', to:'2026-11-20' },
  { who:'Ursula Philomena', dept:'Accounting', kind:'WEBSITE', from:'2026-01-10', to:null },
  { who:'Fajar Nugroho', dept:'Purchasing', kind:'VPN', from:'2026-03-01', to:'2027-02-28' },
  { who:'Dewi Lestari', dept:'HSE - Pusat', kind:'SYNOLOGY_NAS', from:'2026-02-14', to:null },
  { who:'Kevin Austin', dept:'Marketing', kind:'EMAIL', from:'2026-11-18', to:null },
  { who:'Rina Susanti', dept:'QC AB Reguler', kind:'VPN', from:'2026-05-01', to:'2026-12-31' },
];
function renderCenter() {
  const tabs = [['sched', 'cal', 'Jadwal Pemasangan'], ['access', 'key', 'Masa Berlaku Akses'], ['catalog', 'package', 'Katalog Hardware'], ['summary', 'chart', 'Ringkasan']];
  const tab = S.ctab || 'sched';
  let body = '';
  if (tab === 'sched') body = centerSched(); else if (tab === 'access') body = centerAccess(); else if (tab === 'catalog') body = centerCatalog(); else body = centerSummary();
  $('#sheet').className = 'sheet';
  $('#sheet').innerHTML = `<div class="cwrap"><div class="tabs ann" data-ann="1 menu untuk semua halaman pendukung IT" style="margin-bottom:16px">${tabs.map(([k, ic, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="ctab" data-v="${k}">${I(ic)}${l}</button>`).join('')}</div>${body}</div>`;
  const q = $('#catQ'); if (q) q.oninput = () => { S.catQ = q.value; const p = q.selectionStart; render(); const n = $('#catQ'); n.focus(); n.setSelectionRange(p, p); };
}
function centerSched() {
  const ev = centerData().filter((e) => !S.techF || e.tech === S.techF);
  const queue = S.tickets.filter((t) => t.type === 'hw' && t.phase === 'schedule' && !(t.hw.schedule && t.hw.schedule.chosen == null));
  const waiting = S.tickets.filter((t) => t.type === 'hw' && t.phase === 'schedule' && t.hw.schedule && t.hw.schedule.chosen == null);
  const week = Array.from({ length:7 }, (_, i) => addD(TODAY, i));
  return `<div class="kpis k4">${[['Minggu ini', ev.length, 'cal', 'navy'], ['Belum dijadwalkan', queue.length, 'inbox', 'amber'], ['Menunggu pemohon pilih', waiting.length + ev.filter((e) => e.st === 'Menunggu pilih').length, 'hourglass', 'sky'], ['Jadwal ulang', 1, 'refresh', 'red']].map(([l, v, ic, t]) => `<div class="kpi k-${t}"><div class="r"><span class="ico">${I(ic)}</span><span class="v">${v}</span></div><span class="l">${l}</span></div>`).join('')}</div>
    <div class="cgrid"><div class="card cpad"><div class="chead"><b>23 – 29 November 2026</b><div class="pk-chips"><button class="${!S.techF ? 'on' : ''}" data-act="techF" data-v="">Semua teknisi</button>${TECHS.map((x) => `<button class="${S.techF === x.n ? 'on' : ''}" data-act="techF" data-v="${esc(x.n)}">${esc(x.n.split(' ')[0])}</button>`).join('')}</div></div>
      <div class="week">${week.map((d) => `<div class="wday ${d.getDay() === 0 ? 'off' : ''}"><div class="wd-h"><b>${DAYS[d.getDay()]}</b><span>${d.getDate()}</span></div>${ev.filter((e) => e.day === d.getDay()).map((e) => `<button class="wev ${e.st === 'Menunggu pilih' ? 'wait' : ''}" data-act="${e.id ? 'open' : 'noop'}" data-v="${e.id || ''}"><b>${esc(e.time)}</b><span>${esc(e.title)}</span><small>${esc(e.tech.split(' ')[0])} · ${e.site} · ${e.st}</small></button>`).join('')}</div>`).join('')}</div></div>
      <div class="cside"><div class="card cpad"><b class="cs-h">${I('inbox')}Perlu dijadwalkan</b>${queue.length ? queue.map((t) => `<button class="qrow" data-act="open" data-v="${t.id}"><span class="mono">#${t.num}</span><b>${esc(t.title)}</b><span class="muted small">${esc(t.req.name)} · barang siap</span></button>`).join('') : '<p class="muted small">Tidak ada antrean.</p>'}</div>
        <div class="card cpad"><b class="cs-h">${I('user')}Jadwal saya hari ini</b><p class="muted small">Tidak ada pemasangan hari ini.</p></div>
        <div class="card cpad"><b class="cs-h">${I('users')}Beban teknisi minggu ini</b>${TECHS.map((x) => `<div class="barrow"><span>${esc(x.n.split(' ')[0])}</span><i style="--w:${x.load * 25}%" class="${x.load >= 3 ? 'hot' : ''}"></i><b>${x.load}</b></div>`).join('')}</div></div></div>`;
}
function centerAccess() {
  const rows = [...ACCESS_ROWS, ...S.tickets.filter((t) => t.type === 'ef' && t.phase === 'done').map((t) => ({ who:t.req.name, dept:t.req.dept, kind:t.ef.kind, from:t.ef.from || '2026-11-17', to:t.ef.to || null, id:t.id }))];
  const grp = (r) => !r.to ? 'perm' : daysLeft(r.to) < 0 ? 'exp' : daysLeft(r.to) <= 7 ? 'soon' : 'ok';
  const f = S.accF || 'soon';
  const shown = rows.filter((r) => grp(r) === f).sort((a, b) => (a.to || '9') < (b.to || '9') ? -1 : 1);
  const start = new Date('2026-09-01'); const span = 270;
  const pos = (s) => Math.max(0, Math.min(100, ((new Date(s) - start) / 86400000) / span * 100));
  const today = pos(iso(TODAY));
  const cnt = (g) => rows.filter((r) => grp(r) === g).length;
  return `<div class="kpis k4">${[['soon', 'Segera berakhir (≤7 hari)', 'hourglass', 'amber'], ['exp', 'Kedaluwarsa — cabut akses', 'alert', 'red'], ['ok', 'Aktif', 'checkC', 'green'], ['perm', 'Permanen', 'key', 'neutral']].map(([k, l, ic, t]) => `<div class="kpi k-${t} ${f === k ? 'on' : ''}" data-act="accF" data-v="${k}"><div class="r"><span class="ico">${I(ic)}</span><span class="v">${cnt(k)}</span></div><span class="l">${l}</span></div>`).join('')}</div>
    <div class="card"><div class="tl-head"><span>Pemohon</span><span>Akses</span><span class="tl-scale">${['Sep', 'Okt', 'Nov', 'Des', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei'].map((m) => `<i>${m}</i>`).join('')}</span><span>Status</span><span></span></div>
      ${shown.length ? shown.map((r) => `<div class="tl-row"><div><b>${esc(r.who)}</b><span class="muted small">${esc(r.dept)}</span></div><div><span class="tag ef">${I(EF_KINDS[r.kind].icon)}${EF_KINDS[r.kind].label}</span></div>
        <div class="tl-bar"><span class="tl-today" style="left:${today}%"></span><span class="tl-fill ${grp(r)}" style="left:${pos(r.from)}%;width:${(r.to ? pos(r.to) : 100) - pos(r.from)}%"></span></div>
        <div>${expiryBadge(r.to)}<span class="muted small" style="display:block">${r.to ? 's/d ' + fmtD(new Date(r.to)) : 'tanpa batas'}</span></div>
        <div class="tl-act">${grp(r) === 'exp' ? `<button class="btn sm redsoft" data-act="toastMsg" data-v="Tiket pencabutan akses dibuat untuk IT">${I('xC')}Cabut akses</button>` : grp(r) === 'soon' ? `<button class="btn sm" data-act="toastMsg" data-v="Pengingat dikirim ke ${esc(r.who)}">${I('bell')}Ingatkan</button>` : ''}${r.id ? `<button class="btn sm ghost" data-act="open" data-v="${r.id}">Tiket</button>` : ''}</div></div>`).join('') : '<div class="empty">Tidak ada akses di kelompok ini.</div>'}</div>`;
}
function centerCatalog() {
  const all = catalogList();
  const q = (S.catQ || '').toLowerCase();
  const rows = all.filter((c) => (!S.catC || c.cat === S.catC) && (S.catS == null || S.catS === '' || String(c.active) === S.catS) && (!q || `${c.code} ${c.name}`.toLowerCase().includes(q))).sort((a, b) => a.order - b.order);
  return `<div class="kpis k4">${[['Total barang', all.length, 'package', 'neutral'], ['Tampil di form', all.filter((c) => c.active).length, 'checkC', 'green'], ['Disembunyikan', all.filter((c) => !c.active).length, 'eye', 'neutral'], ['Kategori terisi', new Set(all.map((c) => c.cat)).size, 'grid', 'navy']].map(([l, v, ic, t]) => `<div class="kpi k-${t}"><div class="r"><span class="ico">${I(ic)}</span><span class="v">${v}</span></div><span class="l">${l}</span></div>`).join('')}</div>
    <div class="filters"><label class="field">${I('search')}<input id="catQ" value="${esc(S.catQ || '')}" placeholder="Cari kode atau nama barang"></label>
      <select class="fi-in" style="width:200px;height:44px" data-act="noop" id="catC" onchange="void 0">${[['', 'Semua kategori'], ...HW_CATS.map((c) => [c.k, c.label])].map(([v, l]) => `<option value="${v}" ${S.catC === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select class="fi-in" style="width:180px;height:44px" id="catS">${[['', 'Semua status'], ['true', 'Tampil di form'], ['false', 'Disembunyikan']].map(([v, l]) => `<option value="${v}" ${(S.catS || '') === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <button class="btn navy" data-act="catEdit" data-v="">${I('plus')}Tambah barang</button></div>
    <div class="table"><div class="crow chd"><span>Urutan</span><span>Kode</span><span>Nama barang</span><span>Kategori</span><span>Isian tambahan</span><span>Tampil di form</span><span></span></div>
      ${rows.map((c) => `<div class="crow"><span class="mono">${c.order}</span><span class="mono">${esc(c.code)}</span><div><b>${esc(c.name)}</b><span class="muted small" style="display:block">${esc(c.spec)}</span></div><span class="pk-cat">${I(catIcon(c.cat))}${esc((HW_CATS.find((h) => h.k === c.cat) || {}).label || c.cat)}</span>
        <span class="small">${c.fields.length ? c.fields.map((f) => esc(f.label)).join(', ') : '<span class="faint">—</span>'}</span>
        <span class="sw ${c.active ? 'on' : ''}" data-act="catToggle" data-v="${c.code}"><i></i></span>
        <span class="cact"><button class="btn sm ghost" data-act="catEdit" data-v="${c.code}">${I('pen')}Ubah</button><button class="x" data-act="catDel" data-v="${c.code}" title="Hapus">${I('x')}</button></span></div>`).join('') || '<div class="empty">Tidak ada barang.</div>'}</div>`;
}
function centerSummary() {
  const hw = S.tickets.filter((t) => t.type === 'hw');
  const act = hw.filter((t) => !['done', 'rejected'].includes(t.phase)).length + 9;
  const cats = [['Laptop', 14], ['Monitor', 9], ['Aksesoris', 7], ['Desktop', 4], ['Jaringan', 3], ['Scanner', 2]];
  const st = [['Review / persetujuan', 5, 'navy'], ['Pembelian', 3, 'amber'], ['Menunggu barang', 2, 'amber'], ['Pemasangan', 4, 'sky'], ['Konfirmasi pemohon', 1, 'green']];
  const max = (a) => Math.max(...a.map((x) => x[1]));
  return `<div class="kpis k4">${[['Request hardware aktif', act, 'hw', 'navy'], ['Dalam pembelian', 3, 'package', 'amber'], ['Menunggu pemasangan', 4, 'wrench', 'sky'], ['Selesai bulan ini', 12, 'checkC', 'green']].map(([l, v, ic, t]) => `<div class="kpi k-${t}"><div class="r"><span class="ico">${I(ic)}</span><span class="v">${v}</span></div><span class="l">${l}</span></div>`).join('')}</div>
    <div class="sgrid"><div class="card cpad"><b class="cs-h">Posisi request saat ini</b>${st.map(([l, v, c]) => `<div class="barrow"><span>${l}</span><i style="--w:${v / max(st) * 100}%" class="c-${c}"></i><b>${v}</b></div>`).join('')}</div>
      <div class="card cpad"><b class="cs-h">Barang paling banyak diminta (30 hari)</b>${cats.map(([l, v]) => `<div class="barrow"><span>${l}</span><i style="--w:${v / max(cats) * 100}%"></i><b>${v}</b></div>`).join('')}</div>
      <div class="card cpad"><b class="cs-h">Beban teknisi</b>${TECHS.map((x) => `<div class="barrow"><span>${esc(x.n.split(' ')[0])}</span><i style="--w:${x.load * 25}%" class="${x.load >= 3 ? 'hot' : ''}"></i><b>${x.load}</b></div>`).join('')}<p class="muted small">Teknisi tersibuk sebaiknya tidak diberi tugas baru dulu.</p></div>
      <div class="card cpad"><b class="cs-h">Umur request belum selesai</b>${[['0–3 hari', 8, ''], ['3–7 hari', 4, 'warn'], ['> 7 hari', 2, 'hot']].map(([l, v, c]) => `<div class="barrow"><span>${l}</span><i style="--w:${v / 8 * 100}%" class="${c}"></i><b>${v}</b></div>`).join('')}
        ${hw.filter((t) => !['done', 'rejected'].includes(t.phase)).slice(0, 3).map((t) => `<button class="qrow" data-act="open" data-v="${t.id}"><span class="mono">#${t.num}</span><b>${esc(t.title)}</b><span class="muted small">${esc(phaseSub(t))}</span></button>`).join('')}</div></div>`;
}
function mCatEdit(code) {
  const c = code ? catFind(code) : { code:'', name:'', cat:'LAPTOP', spec:'', active:true, fields:[], order:(catalogList().length + 1) * 10 };
  S.catDraft = JSON.parse(JSON.stringify(c)); S.catDraft.origCode = code || null;
  modal(`${I('package')} ${code ? 'Ubah barang' : 'Tambah barang ke katalog'}`, catForm(), `<button class="btn" data-act="closeModal">Batal</button><button class="btn navy" data-act="catSave">${I('check')}Simpan</button>`, true);
}
function catForm() {
  const d = S.catDraft;
  return `<div id="catForm"><div class="grid2"><div><label class="fl">Nama barang <em>*</em></label><input class="fi-in" data-cf="name" value="${esc(d.name)}" placeholder="Misal: Laptop Standar i5/16GB/512GB"></div>
      <div><label class="fl">Kode <em>*</em></label><input class="fi-in mono" data-cf="code" value="${esc(d.code)}" placeholder="LAPTOP_STD"><small class="hint2">Otomatis huruf besar · harus unik</small></div></div>
    <label class="fl">Kategori</label><div class="catgrid">${HW_CATS.map((c) => `<button class="catb ${d.cat === c.k ? 'on' : ''}" data-act="cfCat" data-v="${c.k}"><span class="ci">${I(c.icon)}</span><div><b>${c.label}</b></div></button>`).join('')}</div>
    <div class="grid2"><div><label class="fl">Spesifikasi singkat</label><input class="fi-in" data-cf="spec" value="${esc(d.spec)}" placeholder="Tampil di bawah nama barang"></div><div><label class="fl">Urutan tampil</label><input class="fi-in" type="number" data-cf="order" value="${d.order}"></div></div>
    <label class="ckline" style="margin-top:12px"><span class="sw ${d.active ? 'on' : ''}" data-act="cfActive"><i></i></span> Tampilkan di form permintaan</label>
    <label class="fl">Isian tambahan saat barang ini dipilih <span class="muted" style="font-weight:500">— misal nama software & jumlah seat</span></label>
    ${d.fields.map((f, i) => `<div class="cf-row"><input class="fi-in" data-ff="${i}:label" value="${esc(f.label)}" placeholder="Nama isian"><select class="fi-in" data-ff="${i}:type">${[['text', 'Teks'], ['number', 'Angka'], ['select', 'Pilihan']].map(([v, l]) => `<option value="${v}" ${f.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select>${f.type === 'select' ? `<input class="fi-in" data-ff="${i}:options" value="${esc((f.options || []).join(', '))}" placeholder="Opsi, pisahkan koma">` : '<span></span>'}<label class="small"><input type="checkbox" data-ff="${i}:req" ${f.req ? 'checked' : ''}> Wajib</label><button class="x" data-act="cfDel" data-v="${i}">${I('x')}</button></div>`).join('')}
    <button class="btn sm" data-act="cfAdd">${I('plus')}Tambah isian</button></div>`;
}
function bindCat() {
  document.querySelectorAll('[data-cf]').forEach((n) => { n.oninput = () => { let v = n.value; if (n.dataset.cf === 'code') { v = v.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''); n.value = v; } S.catDraft[n.dataset.cf] = n.dataset.cf === 'order' ? Number(v) : v; }; });
  document.querySelectorAll('[data-ff]').forEach((n) => { n.oninput = n.onchange = () => { const [i, k] = n.dataset.ff.split(':'); const f = S.catDraft.fields[i]; if (k === 'req') f.req = n.checked; else if (k === 'options') f.options = n.value.split(',').map((x) => x.trim()).filter(Boolean); else { f[k] = n.value; if (k === 'type') { $('#catForm').outerHTML = catForm(); bindCat(); } } }; });
}

/* ---------------- Sidebar: menu disederhanakan ---------------- */
function renderSide() {
  const p = me();
  const onList = S.screen === 'list' || S.screen === 'detail';
  const navItem = (icon, label, opts = {}) => `<a class="${opts.on ? 'on' : ''} ${opts.ann ? 'ann' : ''}" ${opts.ann ? `data-ann="${opts.ann}"` : ''} data-act="${opts.act || 'noop'}" data-v="${opts.v ?? ''}"><span class="ic ${opts.c || ''}">${I(icon)}</span><span class="t">${label}</span>${opts.sub ? `<span class="sub">${opts.sub}</span>` : ''}</a>`;
  const centerBadge = S.tickets.filter((t) => t.type === 'hw' && t.phase === 'schedule').length + ACCESS_ROWS.filter((r) => r.to && daysLeft(r.to) <= 7).length;
  let html = `<div class="brand"><span class="logo">${I('monitor')}</span><span class="txt"><b>iDesk</b><span>IT Helpdesk</span></span></div><nav class="nav">`;
  html += navItem('user', 'Dashboard Saya') + navItem('grid', 'Dashboard Tim');
  html += `<div class="nav-h">Request Center ${I('chev')}</div>`;
  html += navItem('ticket', 'IT Support Tickets', { on:onList, act:'navType', v:'', ann:'Semua tiket di sini (filter Tipe)' });
  html += navItem('package', 'Perangkat & Akses', { on:S.screen === 'center', act:'goCenter', c:'c-or', sub:centerBadge, ann:'Ganti menu Hardware Requests + E-Form Access' });
  html += `<div class="nav-h">Resources ${I('chev')}</div>` + navItem('video', 'Zoom Calendar') + navItem('book', 'Knowledge Base');
  html += `<div class="nav-h">Management ${I('chev')}</div>` + navItem('trend', 'Workloads') + navItem('chart', 'Reports') + navItem('bell', 'Notifications', { sub:56 });
  html += `</nav><nav class="nav foot">${navItem('settings', 'Settings')}</nav><div class="me">${av(p.ini, p.color)}<div class="txt"><b>${esc(p.name.toUpperCase())}</b><span>${esc(p.sub)}</span></div></div>`;
  $('#side').innerHTML = html;
}
function renderTop() {
  let title = 'IT Support Tickets', sub = 'Semua tiket: IT Support, Hardware, E-Form', icon = 'ticket';
  if (S.screen === 'create') { title = 'Buat Tiket Baru'; sub = 'Pilih jenis permintaan'; icon = 'plusC'; }
  else if (S.screen === 'center') { title = 'Perangkat & Akses'; sub = 'Jadwal pemasangan, masa berlaku akses, katalog, ringkasan'; icon = 'package'; }
  else if (S.type === 'hw') sub = 'Filter: Hardware Request';
  else if (S.type === 'ef') sub = 'Filter: E-Form Request';
  if (S.screen === 'detail') { title = 'Selamat malam, ' + me().name.split(' ')[0]; sub = 'Minggu, 22 Nov · 18.50 WIB'; icon = null; }
  $('#top').innerHTML = `<div class="pt">${icon ? `<span class="tile">${I(icon)}</span>` : ''}<div style="min-width:0"><b>${esc(title)}</b><span>${esc(sub)}</span></div></div>
    <div class="gsearch">${I('search')}<span>Cari tiket, artikel, atau menu</span><kbd>Ctrl+K</kbd></div>
    <button class="btn-cta" data-act="goCreate">${I('plusC')}Buat Tiket Baru</button>
    <button class="ib">${I('moon')}</button><button class="ib">${I('listCheck')}<em>2</em></button><button class="ib">${I('bell')}</button>`;
}
function render() {
  document.querySelectorAll('#roleSeg button').forEach((b) => b.classList.toggle('on', b.dataset.r === S.role));
  document.querySelectorAll('#scrSeg button').forEach((b) => b.classList.toggle('on', b.dataset.s === S.screen));
  if (S.screen === 'center' && S.role !== 'agent') S.screen = 'list';
  document.body.classList.toggle('portal', isPortal());
  if (isPortal()) renderPortalTop(); else { renderSide(); renderTop(); }
  if (S.screen === 'detail') renderDetail(); else if (S.screen === 'create') renderCreate(); else if (S.screen === 'center') renderCenter(); else if (isPortal()) renderPortalList(); else renderList();
  bindEF(); bindPicker();
  const rc = $('#rcIn'); if (rc) { rc.oninput = () => { S.rq = rc.value; refreshRecip(); }; rc.onkeydown = (e) => { if (e.key === 'Enter' && rc.value.trim()) { e.preventDefault(); A.rcAdd(rc.value.trim()); } }; }
  ['catC', 'catS'].forEach((id) => { const el = $('#' + id); if (el) el.onchange = () => { S[id] = el.value; render(); }; });
  save();
}

/* ============================ AKSI ============================ */
Object.assign(A, {
  goCenter() { S.screen = 'center'; },
  ctab(v) { S.ctab = v; }, techF(v) { S.techF = v; }, accF(v) { S.accF = v; },
  toastMsg(v) { toast(v); return 'keep'; },
  pickType(v) { S.createType = v || null; S.pickerMode = 'create'; S.basket = []; S.pq = ''; S.pcat = ''; S.swapIdx = null; S.otherOpen = false; S.recips = null; S.rq = ''; S.ef = null; if (v !== 'ef') S.renewFrom = null; },
  efKind(v) { const e = efState(); e.kind = v; S.efKind = v; e.read = false; e.terms = false; if (PERMANENT_KINDS.includes(v)) e.to = ''; else if (!e.to) e.to = iso(addM(new Date(e.from), 12)); },
  efSet(v) { const [k, val] = v.split(':'); S.ef[k] = val; },
  efSrv(v) { const s = S.ef.servers; if (s.includes(v)) { if (s.length > 1) s.splice(s.indexOf(v), 1); } else s.push(v); },
  efPreset(v) { const e = S.ef; const f = new Date(e.from); if (v === 'perm') e.to = ''; else e.to = iso(v[0] === 'd' ? addD(f, Number(v.slice(1))) : addM(f, Number(v.slice(1)))); },
  efReason(v) { S.ef.reason = S.ef.reason ? `${S.ef.reason}. ${v}` : v; },
  nasAdd() { const p = $('#nasPath').value.trim(); if (!p) { toast('Isi path folder'); return 'keep'; } if (S.ef.folders.some((f) => f.path === p && f.srv === $('#nasSrv').value)) { toast('Folder sudah ada'); return 'keep'; } S.ef.folders.push({ srv:$('#nasSrv').value, path:p, rw:$('#nasRw').value }); },
  nasDel(v) { S.ef.folders.splice(Number(v), 1); },
  nasRwSet(v) { const [i, rw] = v.split(':'); S.ef.folders[i].rw = rw; },
  nasShot() { if (S.ef.shots >= 5) { toast('Maksimal 5 screenshot'); return 'keep'; } S.ef.shots += 1; },
  rcAdd(v) { if (!S.recips.includes(v)) S.recips.push(v); S.rq = ''; refreshRecip(); return 'keep'; },
  rcDel(v) { S.recips.splice(Number(v), 1); refreshRecip(); return 'keep'; },
  pkAdd(code) {
    const c = catFind(code); const b = S.basket || (S.basket = []);
    if (S.swapIdx != null) { const old = b[S.swapIdx]; b[S.swapIdx] = { ...old, code:c.code, cat:c.cat, name:c.name, note:'', f:{}, custom:false, was:old.orig && old.orig !== c.name ? old.orig : null }; S.swapIdx = null; toast(`Diganti dengan ${c.name}`); }
    else { const ex = b.find((x) => x.code === code && !(c.fields || []).length); if (ex) ex.qty += 1; else b.push({ code:c.code, cat:c.cat, name:c.name, qty:1, note:'', f:{}, orig:null }); }
    refreshPicker(); return 'keep';
  },
  pkOther() { S.otherOpen = true; refreshPicker(); return 'keep'; },
  pkOtherCancel() { S.otherOpen = false; refreshPicker(); return 'keep'; },
  pkOtherAdd() { const n = ($('#pkOtherName')?.value || '').trim(); if (!n) { toast('Tulis nama barang'); return 'keep'; } (S.basket || (S.basket = [])).push({ code:null, cat:'OTHER', name:n, qty:1, note:'', f:{}, orig:null, custom:true }); S.otherOpen = false; refreshPicker(); return 'keep'; },
  submitCreate() {
    const root = $('#sheet');
    const ty = ['hw', 'ef'].includes(S.createType) ? S.createType : 'it';
    let title = ($('#fTitle')?.value || '').trim();
    if (ty === 'hw') {
      if (!(S.basket || []).length) return toast('Pilih minimal satu barang'), 'keep';
      const miss = missingFields(S.basket); if (miss) return toast(`Lengkapi ${miss}`), 'keep';
      if (!S.recips.length) return toast('Isi untuk siapa barang ini'), 'keep';
      if (!title) return toast('Isi judul singkat'), 'keep';
      if (!($('#fDesc')?.value || '').trim()) return toast('Isi alasan'), 'keep';
    }
    if (ty === 'ef') { const m = efMissing(S.ef); if (m) return toast(m), 'keep'; title = `Akses ${EF_KINDS[S.ef.kind].label}${S.renewFrom ? ' (perpanjangan)' : ''}`; }
    if (ty === 'it' && !title) return toast('Judul wajib diisi'), 'keep';
    if (ty !== 'it' && !signed(root)) return toast('Tanda tangan dulu'), 'keep';
    const seq = String(35 + S.tickets.length).padStart(4, '0');
    const base = { id:'n' + Date.now(), num:`221126-QC-${seq}`, type:ty, title, desc:ty === 'ef' ? S.ef.reason : ($('#fDesc')?.value || '').trim(), prio:'MEDIUM', req:LEONY, reqMe:true, pic:null, created:'22 Nov',
      sla:{ due:'Sen, 23 Nov · 10.00', left:'respon pertama sisa 4 jam', pct:2 }, msgs:[{ k:'day', t:'Hari ini' }], acts:[], fresh:true };
    let t;
    if (ty === 'it') t = { ...base, status:'TODO', category:'Hardware' };
    else {
      const common = { phase:'review', route:null, picked:false, mgr:($('#fMgr')?.value) || MANAGERS[0], gm:null, sigs:{ req:{ how:'digital', at:`22 Nov ${now()}` }, mgr:null, gm:null, ict:null }, revs:[] };
      if (ty === 'hw') t = { ...base, ...common, docNo:`HR-2026-00${43 + S.tickets.length}`, hw:{ kind:null, recipient:S.recips.join(', '), division:$('#fDiv').value, fromStock:false, resched:0, items:S.basket.map((x) => ({ cat:x.cat, name:x.name, qty:x.qty, spec:specOf(x), note:x.note, f:x.f, to:x.to, state:'pending' })) } };
      else { const e = S.ef; t = { ...base, ...common, docNo:`${EF_KINDS[e.kind].code}/0${120 + S.tickets.length}`, ef:{ kind:e.kind, from:e.from, to:e.to || null, fields:efFieldsMap(e), cred:null, renewOf:S.renewFrom || null } }; }
      t.revs.push({ v:1, kind:'gen', label:'Dibuat dari pengajuan · TTD pemohon', by:LEONY.name, at:`22 Nov ${now()}` });
    }
    pushSys(t, ty === 'it' ? 'nv' : ty, `${LEONY.name} membuat ${TYPES[ty].label}${t.ef?.renewOf ? ' (perpanjangan)' : ''}`, ty === 'it' ? '' : docRef(t));
    S.tickets.unshift(t);
    S.sel = t.id; S.screen = 'detail'; S.tab = 'chat'; S.createType = null; S.basket = []; S.ef = null; S.renewFrom = null; S.recips = null;
    toast(`Tiket #${t.num} dibuat`);
  },
  doReview() {
    const t = T(S.sel);
    const route = $('#routeSel .on')?.dataset.v || 'mgr';
    t.route = route; t.mgr = $('#selMgr').value; t.gm = route === 'mgr_gm' ? $('#selGm').value : null; t.picked = true; t.pic = t.pic || 'RM BAGASTYO A.W.';
    if (t.type === 'hw') {
      const kind = $('#kindSel .on')?.dataset.v || 'Budget Tahunan';
      t.hw.fromStock = kind === 'Stok IT'; t.hw.kind = t.hw.fromStock ? 'Stok IT' : kind;
      const changed = applyItemEditor(t, route === 'none' ? 'approved' : 'pending');
      if (t.hw.fromStock) t.hw.items.forEach((it) => { it.state = 'arrived'; it.vendor = 'Stok gudang IT'; });
      if (changed) pushSys(t, 'hw', 'RM Bagastyo mengubah barang saat review', changed);
    }
    const note = $('#rvNote').value.trim();
    pushRev(t, 'gen', `Ditinjau IT: ${ROUTES[route].label}${t.hw ? ' · ' + t.hw.kind : ''}`, 'RM Bagastyo');
    pushSys(t, t.type, `RM Bagastyo meninjau permintaan`, `<div class="kv">${t.hw ? `<span>Sumber</span><b>${esc(t.hw.kind)}</b>` : ''}<span>Persetujuan</span><b>${ROUTES[route].label}</b>${route !== 'none' ? `<span>Atasan</span><b>${esc(t.mgr)}</b>` : ''}${t.gm ? `<span>GM</span><b>${esc(t.gm)}</b>` : ''}</div>${docRef(t)}`);
    if (note) t.msgs.push({ k:'msg', from:'RM Bagastyo', text:note, at:now(), me:true });
    if (route === 'none') afterApproval(t); else t.phase = 'appr_mgr';
    closeModal(); toast(route === 'none' ? 'Lanjut diproses IT' : `Dikirim ke ${t.mgr.split(' — ')[0]} untuk tanda tangan`);
  },
  procDec(v, el) { const [i, d] = v.split(':'); const row = el.closest('.proc-row'); row.querySelectorAll('[data-act=procDec]').forEach((b) => b.classList.toggle('on', b === el)); row.classList.toggle('off', d === 'rejected'); row.dataset.dec = d; return 'keep'; },
  doProcure() {
    const t = T(S.sel);
    document.querySelectorAll('.proc-row').forEach((r) => { const it = t.hw.items[r.dataset.i]; it.state = r.dataset.dec || 'approved'; if (it.state === 'approved') { it.vendor = r.querySelector('[data-p=vendor]').value; it.cost = r.querySelector('[data-p=cost]').value; it.inv = r.querySelector('[data-p=inv]').value; } });
    const ok = t.hw.items.filter((i) => i.state === 'approved');
    if (!ok.length) { closeModal(); mRejectIT(); toast('Semua dibatalkan — isi alasan penolakan'); return 'keep'; }
    pushSys(t, 'hw', `Pembelian dicatat: ${ok.length} dari ${t.hw.items.length} barang`, `<div class="kv">${ok.map((i) => `<span>${esc(i.name)}</span><b>${esc(i.vendor)} · ${esc(i.cost)}</b>`).join('')}</div>`);
    t.phase = 'delivery'; closeModal(); toast('Menunggu barang dari vendor');
  },
  arrived() { mArrive(T(S.sel)); return 'keep'; },
  doArrive() {
    const t = T(S.sel); let n = 0;
    document.querySelectorAll('[data-arr]').forEach((c) => { const it = t.hw.items[c.dataset.arr]; it.state = c.checked ? 'arrived' : 'approved'; if (c.checked) n += 1; });
    if (!n) { toast('Centang minimal satu barang'); return 'keep'; }
    pushSys(t, 'hw', `${n} barang tiba di gudang IT`, ''); t.phase = 'schedule'; closeModal(); toast('Barang tiba — usulkan jadwal');
  },
  techPick(v, el) { el.parentElement.querySelectorAll('.on').forEach((x) => x.classList.remove('on')); el.classList.add('on'); $('#clash').innerHTML = TECHS[v].load >= 3 ? `<div class="note warn">${I('alert')}<span>${esc(TECHS[v].n)} sudah punya jadwal Sel 24 Nov 09.00–11.00. Pilihan waktu yang bentrok akan ditolak.</span></div>` : ''; return 'keep'; },
  slotDay(v, el) { const [i, j] = v.split(':').map(Number); const s = el.closest('.slot'); s.querySelectorAll('[data-act=slotDay]').forEach((b) => b.classList.toggle('on', b === el)); s.querySelector('.sl-date').value = iso(addD(TODAY, j)); return 'keep'; },
  slotHour(v, el) { el.parentElement.querySelectorAll('[data-act=slotHour]').forEach((b) => b.classList.toggle('on', b === el)); return 'keep'; },
  slotAdd() { const n = document.querySelectorAll('#slots .slot').length; if (n >= 3) { toast('Maksimal 3 pilihan'); return 'keep'; } $('#slots').insertAdjacentHTML('beforeend', slotRow(n)); return 'keep'; },
  slotDel(v, el) { el.closest('.slot').remove(); return 'keep'; },
  doSchedule() {
    const t = T(S.sel); const tech = $('.techs .on b')?.textContent || t.pic;
    t.hw.schedule = { tech, slots:readSlots(), chosen:null };
    pushSys(t, 'hw', 'Pilihan waktu pemasangan dikirim ke pemohon', `<div class="kv"><span>Teknisi</span><b>${esc(tech)}</b><span>Pilihan</span><b>${esc(t.hw.schedule.slots.join(' / '))}</b></div>`);
    closeModal(); toast('Terkirim — pemohon tinggal memilih');
  },
  doPickSlot() {
    const t = T(S.sel); const pick = $('#slotSel .on')?.dataset.v || '0';
    if (pick === 'other') { const w = $('#otherTime').value.trim(); if (!w) { toast('Tulis waktu yang Anda bisa'); return 'keep'; } t.hw.resched = (t.hw.resched || 0) + 1; t.hw.lastAsk = w; t.msgs.push({ k:'msg', from:me().name, text:`Saya tidak bisa di waktu yang diusulkan. Bisa ${w}?`, at:now() }); t.hw.schedule = null; pushSys(t, 'hw', `${actorName()} meminta waktu lain (${t.hw.resched}/${RESCHEDULE_LIMIT})`, ''); closeModal(); toast('Permintaan waktu lain terkirim ke IT'); return; }
    const i = Number(pick); t.hw.schedule.chosen = i; t.phase = 'install'; pushSys(t, 'hw', `${actorName()} memilih ${esc(t.hw.schedule.slots[i])}`, ''); closeModal(); toast('Jadwal dikonfirmasi');
  },
  installDone() { mInstallDone(T(S.sel)); return 'keep'; },
  scan(v) { const el = document.querySelector(`.bc[data-u="${v}"]`); el.value = `SJA-${['LAP', 'MON', 'ACC'][v % 3]}-2026-${1000 + Math.floor(Math.random() * 8999)}`; toast('Barcode terbaca (simulasi kamera)'); return 'keep'; },
  doInstallDone() {
    const t = T(S.sel);
    const codes = [...document.querySelectorAll('.bc')].map((x) => x.value.trim());
    if (codes.some((c) => !c)) { toast('Scan / isi kode aset semua unit'); return 'keep'; }
    if (new Set(codes).size !== codes.length) { toast('Kode aset tidak boleh sama'); return 'keep'; }
    if (!signed($('.modal'))) { toast('Tanda tangan dulu'); return 'keep'; }
    const names = [...document.querySelectorAll('.unit-n b')].map((b) => b.textContent);
    t.hw.assets = codes.map((code, i) => ({ code, name:names[i] })); t.hw.asset = codes.join(', ');
    t.sigs.ict = { how:'digital', at:`22 Nov ${now()}` };
    pushRev(t, 'dig', `TTD teknisi — ${codes.length} aset tercatat`, 'RM Bagastyo');
    pushSys(t, 'hw', 'Pemasangan selesai — pemohon diminta mengecek', `<div class="kv"><span>Aset</span><b>${esc(codes.join(', '))}</b></div>${docRef(t)}`);
    t.phase = 'confirm'; closeModal(); toast('Menunggu pemohon mengecek');
  },
  fulMode(v) { S.fulMode = v; mFulfill(T(S.sel)); return 'keep'; },
  doFulfill() {
    const t = T(S.sel);
    if (!signed($('.modal'))) { toast('Tanda tangan dulu'); return 'keep'; }
    if (S.fulMode === 'cred') { if (!$('#cu').value || !$('#cp').value) { toast('Isi username & password'); return 'keep'; } t.ef.cred = { user:$('#cu').value, pass:$('#cp').value, server:$('#cs')?.value || '', note:$('#cn').value }; }
    else { if (!$('#fn').value.trim()) { toast('Isi catatan realisasi'); return 'keep'; } t.ef.fields['Realisasi'] = $('#fn').value; }
    t.sigs.ict = { how:'digital', at:`22 Nov ${now()}` };
    pushRev(t, 'dig', 'TTD IT — akses diberikan', 'RM Bagastyo');
    pushSys(t, 'ef', 'Akses diberikan — pemohon diminta mencoba', `${t.ef.cred ? '<div>Kredensial tersimpan terenkripsi</div>' : `<div>${esc(t.ef.fields['Realisasi'])}</div>`}${docRef(t)}`);
    t.phase = 'confirm'; S.fulMode = null; closeModal(); toast('Pemohon diberi notifikasi');
  },
  credEye(v, el) { const c = el.parentElement.querySelector('code'); c.textContent = c.classList.toggle('masked') ? '••••••••••' : c.dataset.v; return 'keep'; },
  copy(v) { navigator.clipboard?.writeText(v).catch(() => {}); toast('Disalin'); return 'keep'; },
  openCred(v) { S.sel = v; const t = T(v); t.acts.push({ text:`${actorName()} melihat kredensial`, at:`22 Nov ${now()}` }); mCred(t); return 'keep'; },
  renew(v) { v = v || S.sel; const src = T(v); S.screen = 'create'; S.createType = 'ef'; S.pickerMode = 'create'; S.renewFrom = v; S.efKind = src.ef.kind;
    const from = src.ef.to && daysLeft(src.ef.to) > 0 ? src.ef.to : iso(TODAY);
    S.ef = { ...efState(), kind:src.ef.kind, from, to:PERMANENT_KINDS.includes(src.ef.kind) ? '' : iso(addM(new Date(from), 12)), reason:`Perpanjangan akses ${EF_KINDS[src.ef.kind].label} dari tiket #${src.num}`, need:'REMOTE', email:'', host:'', websites:'', net:'', read:false, terms:false };
    toast('Isian disalin dari tiket sebelumnya'); },
  editDocNo() { mDocNo(T(S.sel)); return 'keep'; },
  doDocNo() { const t = T(S.sel); const v = $('#docNo').value.trim(); if (!/^[A-Za-z0-9/._-]{1,50}$/.test(v)) { toast('Format nomor tidak valid'); return 'keep'; } if (S.tickets.some((x) => x !== t && x.docNo === v)) { toast('Nomor sudah dipakai'); return 'keep'; } t.acts.push({ text:`Nomor dokumen diubah ${t.docNo} → ${v}`, at:`22 Nov ${now()}` }); t.docNo = v; closeModal(); toast('Nomor dokumen diperbarui'); },
  catEdit(v) { mCatEdit(v); bindCat(); return 'keep'; },
  cfCat(v) { S.catDraft.cat = v; $('#catForm').outerHTML = catForm(); bindCat(); return 'keep'; },
  cfActive() { S.catDraft.active = !S.catDraft.active; $('#catForm').outerHTML = catForm(); bindCat(); return 'keep'; },
  cfAdd() { S.catDraft.fields.push({ label:'', type:'text', req:false }); $('#catForm').outerHTML = catForm(); bindCat(); return 'keep'; },
  cfDel(v) { S.catDraft.fields.splice(Number(v), 1); $('#catForm').outerHTML = catForm(); bindCat(); return 'keep'; },
  catSave() {
    const d = S.catDraft; if ((d.name || '').trim().length < 2) { toast('Nama minimal 2 huruf'); return 'keep'; } if ((d.code || '').length < 2) { toast('Kode minimal 2 karakter'); return 'keep'; }
    const list = catalogList(); if (list.some((c) => c.code === d.code && c.code !== d.origCode)) { toast('Kode sudah dipakai'); return 'keep'; }
    d.fields = d.fields.filter((f) => f.label.trim());
    const { origCode, ...item } = d; const i = list.findIndex((c) => c.code === origCode);
    if (i >= 0) list[i] = item; else list.push(item);
    closeModal(); toast(origCode ? 'Barang diperbarui' : 'Barang ditambahkan ke katalog'); render(); return 'keep';
  },
  catToggle(v) { const c = catFind(v); c.active = !c.active; toast(c.active ? 'Tampil di form' : 'Disembunyikan dari form'); },
  catDel(v) { if (!confirm('Hapus barang ini dari katalog? Tiket lama tetap aman (data barang tersimpan di tiket).')) return 'keep'; S.catalog = catalogList().filter((c) => c.code !== v); toast('Dihapus'); },
});
A.navType = (v) => { S.screen = 'list'; S.type = v; };

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) { if (S.openMenu && !e.target.closest('.menu')) { S.openMenu = null; render(); } return; }
  const fn = A[el.dataset.act]; if (!fn) return;
  if (S.openMenu && el.dataset.act !== 'menu' && !el.closest('.menu')) S.openMenu = null;
  const r = fn(el.dataset.v, el, e);
  if (r !== 'keep') render(); else save();
});
document.addEventListener('change', (e) => {
  const sel = e.target.closest('.ied-name'); if (!sel) return;
  const row = sel.closest('.ied'); const c = CATALOG.find((x) => x.name === sel.value);
  if (c) { row.querySelector('.ied-spec').value = c.spec; row.dataset.cat = c.cat; }
  const changed = row.dataset.orig && row.dataset.orig !== sel.value;
  row.classList.toggle('swapped', Boolean(changed));
  row.querySelector('.ied-tag')?.remove();
  if (changed) row.querySelector('.ied-main').insertAdjacentHTML('afterbegin', `<span class="ied-tag">Diganti dari <s>${esc(row.dataset.orig)}</s></span>`);
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeModal(); if (S.openMenu) { S.openMenu = null; render(); } } });
$('#roleSeg').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  S.role = b.dataset.r; S.type = ''; S.status = ''; S.prio = ''; S.pst = ''; S.scope = ['mgr', 'gm'].includes(S.role) ? 'approve' : 'all';
  const t = T(S.sel);
  if (S.screen === 'detail' && t && !visibleTickets().includes(t)) S.screen = 'list';
  if (S.role !== 'agent' && S.screen === 'detail' && t) { /* keep */ }
  render();
};
$('#scrSeg').onclick = (e) => {
  const b = e.target.closest('button'); if (!b) return;
  S.screen = b.dataset.s;
  if (S.screen === 'detail' && !visibleTickets().find((t) => t.id === S.sel)) S.sel = visibleTickets()[0]?.id;
  render();
};
$('#resetBtn').onclick = () => { S = fresh(); render(); toast('Data direset'); };
$('#annT').onchange = (e) => document.body.classList.toggle('no-ann', !e.target.checked);
render();
})();
