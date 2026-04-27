
const AppContext = React.createContext({});
window.AppContext = AppContext;

const MOCK_AGENTS = [
  { id:'a1', name:'Ahmad Fauzi',     role:'AGENT', resolved:42, inProgress:5, status:'online',  initials:'AF' },
  { id:'a2', name:'Siti Nuraini',    role:'AGENT', resolved:38, inProgress:3, status:'online',  initials:'SN' },
  { id:'a3', name:'Budi Santoso',    role:'AGENT', resolved:31, inProgress:7, status:'busy',    initials:'BS' },
  { id:'a4', name:'Dewi Rahayu',     role:'AGENT', resolved:27, inProgress:4, status:'online',  initials:'DR' },
  { id:'a5', name:'Eko Prasetyo',    role:'AGENT', resolved:19, inProgress:2, status:'offline', initials:'EP' },
];

const MOCK_TICKETS = [
  { id:'t001', num:'TKT-0231', title:'Server database tidak bisa diakses',         priority:'CRITICAL', status:'IN_PROGRESS',    assignee:'Ahmad Fauzi',   cat:'SERVER',    created:'2026-04-21T07:12:00Z', msgs:8,  isOverdue:true  },
  { id:'t002', num:'TKT-0230', title:'Email system down untuk dept Marketing',     priority:'CRITICAL', status:'IN_PROGRESS',    assignee:'Siti Nuraini',  cat:'EMAIL',     created:'2026-04-21T07:55:00Z', msgs:5,  isOverdue:true  },
  { id:'t003', num:'TKT-0229', title:'Network outage di lantai 3',                 priority:'HIGH',     status:'TODO',           assignee:null,            cat:'NETWORK',   created:'2026-04-21T08:10:00Z', msgs:2,  isOverdue:false },
  { id:'t004', num:'TKT-0228', title:'Printer jaringan di ruang rapat tidak print',priority:'HIGH',     status:'WAITING_VENDOR', assignee:'Budi Santoso',  cat:'HARDWARE',  created:'2026-04-20T14:30:00Z', msgs:4,  isOverdue:false },
  { id:'t005', num:'TKT-0227', title:'Reset password akun user Finance',           priority:'MEDIUM',   status:'RESOLVED',       assignee:'Dewi Rahayu',   cat:'ACCESS',    created:'2026-04-20T11:00:00Z', msgs:3,  isOverdue:false },
  { id:'t006', num:'TKT-0226', title:'Instalasi software Adobe Creative Cloud',    priority:'LOW',      status:'TODO',           assignee:null,            cat:'SOFTWARE',  created:'2026-04-20T09:45:00Z', msgs:1,  isOverdue:false },
  { id:'t007', num:'TKT-0225', title:'Laptop baterai tidak bisa charge',           priority:'MEDIUM',   status:'IN_PROGRESS',    assignee:'Eko Prasetyo',  cat:'HARDWARE',  created:'2026-04-19T16:20:00Z', msgs:6,  isOverdue:false },
  { id:'t008', num:'TKT-0224', title:'VPN tidak bisa terhubung dari rumah',        priority:'HIGH',     status:'IN_PROGRESS',    assignee:'Ahmad Fauzi',   cat:'NETWORK',   created:'2026-04-19T13:10:00Z', msgs:9,  isOverdue:true  },
  { id:'t009', num:'TKT-0223', title:'Monitor kedua tidak terdeteksi',             priority:'LOW',      status:'TODO',           assignee:null,            cat:'HARDWARE',  created:'2026-04-19T10:05:00Z', msgs:0,  isOverdue:false },
  { id:'t010', num:'TKT-0222', title:'Akses SharePoint folder Procurement',        priority:'MEDIUM',   status:'RESOLVED',       assignee:'Siti Nuraini',  cat:'ACCESS',    created:'2026-04-18T15:30:00Z', msgs:4,  isOverdue:false },
  { id:'t011', num:'TKT-0221', title:'Teams meeting audio tidak berfungsi',        priority:'HIGH',     status:'TODO',           assignee:null,            cat:'SOFTWARE',  created:'2026-04-18T11:00:00Z', msgs:2,  isOverdue:true  },
  { id:'t012', num:'TKT-0220', title:'Hard disk penuh di server file sharing',     priority:'CRITICAL', status:'RESOLVED',       assignee:'Ahmad Fauzi',   cat:'SERVER',    created:'2026-04-18T08:00:00Z', msgs:11, isOverdue:false },
  { id:'t013', num:'TKT-0219', title:'Firewall memblokir akses ke cloud ERP',      priority:'HIGH',     status:'WAITING_VENDOR', assignee:'Budi Santoso',  cat:'NETWORK',   created:'2026-04-17T14:00:00Z', msgs:7,  isOverdue:false },
  { id:'t014', num:'TKT-0218', title:'Keyboard wireless tidak terdeteksi',         priority:'LOW',      status:'RESOLVED',       assignee:'Dewi Rahayu',   cat:'HARDWARE',  created:'2026-04-17T09:30:00Z', msgs:3,  isOverdue:false },
  { id:'t015', num:'TKT-0217', title:'Backup otomatis gagal seminggu terakhir',    priority:'CRITICAL', status:'IN_PROGRESS',    assignee:'Ahmad Fauzi',   cat:'SERVER',    created:'2026-04-16T17:00:00Z', msgs:14, isOverdue:true  },
  { id:'t016', num:'TKT-0216', title:'Outlook crash saat buka attachment PDF',     priority:'MEDIUM',   status:'TODO',           assignee:null,            cat:'SOFTWARE',  created:'2026-04-16T10:00:00Z', msgs:1,  isOverdue:false },
  { id:'t017', num:'TKT-0215', title:'Kontrak lisensi Microsoft 365 expiring',     priority:'HIGH',     status:'TODO',           assignee:null,            cat:'LICENSE',   created:'2026-04-15T09:00:00Z', msgs:0,  isOverdue:false },
  { id:'t018', num:'TKT-0214', title:'Printer label rusak di gudang',              priority:'LOW',      status:'RESOLVED',       assignee:'Eko Prasetyo',  cat:'HARDWARE',  created:'2026-04-15T08:00:00Z', msgs:5,  isOverdue:false },
  { id:'t019', num:'TKT-0213', title:'Request akun ERP untuk karyawan baru',       priority:'MEDIUM',   status:'RESOLVED',       assignee:'Siti Nuraini',  cat:'ACCESS',    created:'2026-04-14T13:00:00Z', msgs:3,  isOverdue:false },
  { id:'t020', num:'TKT-0212', title:'Wifi di lantai 5 sinyal sangat lemah',       priority:'MEDIUM',   status:'WAITING_VENDOR', assignee:'Budi Santoso',  cat:'NETWORK',   created:'2026-04-14T10:00:00Z', msgs:6,  isOverdue:false },
];

const MOCK_LAST7 = [
  { date:'Tue', created:9,  resolved:6  },
  { date:'Wed', created:14, resolved:11 },
  { date:'Thu', created:7,  resolved:9  },
  { date:'Fri', created:12, resolved:8  },
  { date:'Sat', created:4,  resolved:5  },
  { date:'Sun', created:3,  resolved:4  },
  { date:'Mon', created:11, resolved:7  },
];

const MOCK_KB_ARTICLES = [
  { id:'k1', title:'Panduan Reset Password Self-Service',    cat:'Access',    views:1240, helpful:96, mins:3  },
  { id:'k2', title:'Setup VPN dari Rumah (Windows & Mac)',   cat:'Network',   views:980,  helpful:92, mins:5  },
  { id:'k3', title:'Cara Instalasi Printer Jaringan',        cat:'Hardware',  views:754,  helpful:88, mins:4  },
  { id:'k4', title:'Troubleshooting Microsoft Teams Audio',  cat:'Software',  views:620,  helpful:85, mins:6  },
  { id:'k5', title:'Konfigurasi Email di Outlook 365',       cat:'Email',     views:545,  helpful:91, mins:4  },
  { id:'k6', title:'Request Akses SharePoint Baru',          cat:'Access',    views:430,  helpful:89, mins:2  },
  { id:'k7', title:'Panduan Backup Data ke Cloud Storage',   cat:'Server',    views:380,  helpful:94, mins:7  },
  { id:'k8', title:'Daftar Software Terlisensi IT Dept',     cat:'Software',  views:290,  helpful:87, mins:3  },
];

const MOCK_NOTIFICATIONS = [
  { id:'n1', type:'critical', title:'SLA Breach: TKT-0231', body:'Server database tidak bisa diakses sudah melewati SLA 4 jam', time:'5m ago', read:false },
  { id:'n2', type:'critical', title:'SLA Breach: TKT-0230', body:'Email system down belum ditangani dalam SLA', time:'12m ago', read:false },
  { id:'n3', type:'ticket',   title:'Tiket baru diterima', body:'TKT-0229: Network outage di lantai 3', time:'20m ago', read:false },
  { id:'n4', type:'resolved', title:'Tiket diselesaikan', body:'TKT-0227: Reset password akun user Finance', time:'1h ago', read:false },
  { id:'n5', type:'ticket',   title:'Tiket di-assign ke Anda', body:'TKT-0228: VPN tidak bisa terhubung dari rumah', time:'2h ago', read:true  },
  { id:'n6', type:'renewal',  title:'Kontrak mendekati expiry', body:'Lisensi Microsoft 365 E3 – 30 hari lagi', time:'3h ago', read:true  },
  { id:'n7', type:'system',   title:'Backup sukses', body:'Backup database berhasil pukul 02:00 WIB', time:'5h ago', read:true  },
  { id:'n8', type:'resolved', title:'Tiket diselesaikan', body:'TKT-0222: Hard disk penuh di server file sharing', time:'8h ago', read:true  },
  { id:'n9', type:'ticket',   title:'Tiket baru diterima', body:'TKT-0224: VPN tidak bisa terhubung dari rumah', time:'1d ago', read:true  },
  { id:'n10',type:'renewal',  title:'Kontrak mendekati expiry', body:'Lisensi Adobe CC – 14 hari lagi', time:'1d ago', read:true  },
];

// Helpers
const PRIORITY_COLOR = {
  CRITICAL: { dot:'#D63031', bg:'rgba(214,48,49,0.1)',  text:'#D63031',  label:'Critical' },
  HIGH:     { dot:'#E17055', bg:'rgba(225,112,85,0.1)', text:'#E17055',  label:'High'     },
  MEDIUM:   { dot:'#FDCB6E', bg:'rgba(253,203,110,0.1)',text:'#B7950B',  label:'Medium'   },
  LOW:      { dot:'#B2BEC3', bg:'rgba(178,190,195,0.12)',text:'#636E72', label:'Low'      },
};
const STATUS_COLOR = {
  TODO:           { bg:'rgba(99,110,114,0.1)',   text:'#636E72',  label:'Open'         },
  IN_PROGRESS:    { bg:'rgba(45,74,140,0.12)',   text:'#2D4A8C',  label:'In Progress'  },
  WAITING_VENDOR: { bg:'rgba(225,112,85,0.12)',  text:'#d16014',  label:'Waiting'      },
  RESOLVED:       { bg:'rgba(61,138,94,0.12)',   text:'#3D8A5E',  label:'Resolved'     },
  CANCELLED:      { bg:'rgba(99,110,114,0.1)',   text:'#636E72',  label:'Cancelled'    },
};

const formatTime = (iso) => {
  const d = new Date(iso), now = new Date();
  const diff = now - d;
  if(diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
  if(diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
  return d.toLocaleDateString('id-ID',{day:'2-digit',month:'short'});
};

const getInitials = (name='') => name.split(' ').slice(0,2).map(n=>n[0]).join('').toUpperCase();

Object.assign(window, {
  MOCK_AGENTS, MOCK_TICKETS, MOCK_LAST7, MOCK_KB_ARTICLES, MOCK_NOTIFICATIONS,
  PRIORITY_COLOR, STATUS_COLOR, formatTime, getInitials,
});
