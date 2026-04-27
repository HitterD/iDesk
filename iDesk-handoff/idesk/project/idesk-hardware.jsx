
const {useState, useMemo} = React;

// ── Mock data ─────────────────────────────────────────────────────────────────
const HW_STATUS = {
  PENDING:    {label:'Pending',    bg:'var(--warning-bg)',  text:'var(--warning)',  dot:'#E8A830'},
  IN_REVIEW:  {label:'In Review',  bg:'var(--primary-bg)', text:'var(--primary)',  dot:'#2D4A8C'},
  APPROVED:   {label:'Approved',   bg:'var(--success-bg)', text:'var(--success)',  dot:'#3D8A5E'},
  REJECTED:   {label:'Rejected',   bg:'var(--error-bg)',   text:'var(--error)',    dot:'#D63031'},
  DELIVERED:  {label:'Delivered',  bg:'rgba(61,138,94,0.08)', text:'hsl(152,40%,35%)', dot:'#3D8A5E'},
};

const MOCK_HW = [
  {id:'HR-001',item:'Laptop Lenovo ThinkPad X1 Carbon Gen 11',    cat:'Laptop',    qty:1, status:'PENDING',   priority:'HIGH',   requester:'Ahmad Fauzi',  dept:'IT Dept',      date:'2026-04-21', price:18500000},
  {id:'HR-002',item:'Monitor 27" Dell UltraSharp U2722D',          cat:'Monitor',   qty:2, status:'APPROVED',  priority:'MEDIUM', requester:'Siti Nuraini', dept:'Finance',      date:'2026-04-19', price:5200000},
  {id:'HR-003',item:'Logitech MX Keys Wireless Keyboard',          cat:'Peripheral',qty:3, status:'DELIVERED', priority:'LOW',    requester:'Budi Santoso', dept:'Engineering',  date:'2026-04-18', price:1200000},
  {id:'HR-004',item:'Cisco IP Phone 7942G',                        cat:'Phone',     qty:5, status:'IN_REVIEW', priority:'HIGH',   requester:'Dewi Rahayu',  dept:'Customer Svc', date:'2026-04-18', price:2800000},
  {id:'HR-005',item:'Canon imageCLASS LBP6030 Printer',            cat:'Printer',   qty:1, status:'REJECTED',  priority:'MEDIUM', requester:'Eko Prasetyo', dept:'Procurement',  date:'2026-04-17', price:1450000},
  {id:'HR-006',item:'Dell WD22TB4 Thunderbolt 4 Docking Station',  cat:'Docking',   qty:2, status:'PENDING',   priority:'MEDIUM', requester:'Ahmad Fauzi',  dept:'IT Dept',      date:'2026-04-16', price:3200000},
  {id:'HR-007',item:'Samsung SSD 870 EVO 1TB',                     cat:'Storage',   qty:4, status:'APPROVED',  priority:'HIGH',   requester:'Budi Santoso', dept:'Engineering',  date:'2026-04-15', price:980000},
  {id:'HR-008',item:'Logitech C920 HD Pro Webcam',                 cat:'Peripheral',qty:6, status:'PENDING',   priority:'LOW',    requester:'Siti Nuraini', dept:'HR',           date:'2026-04-15', price:850000},
  {id:'HR-009',item:'UPS APC Back-UPS 1500VA',                     cat:'Power',     qty:2, status:'IN_REVIEW', priority:'CRITICAL',requester:'Ahmad Fauzi', dept:'IT Dept',      date:'2026-04-14', price:4200000},
  {id:'HR-010',item:'HP LaserJet Pro M428fdn',                     cat:'Printer',   qty:1, status:'APPROVED',  priority:'MEDIUM', requester:'Dewi Rahayu',  dept:'Legal',        date:'2026-04-13', price:5100000},
];

const CATALOG = [
  {id:'c1',  name:'ThinkPad X1 Carbon',  cat:'Laptop',    price:18500000, icon:'💻', color:'hsl(224,60%,42%)'},
  {id:'c2',  name:'MacBook Pro 14"',     cat:'Laptop',    price:22000000, icon:'💻', color:'hsl(224,60%,42%)'},
  {id:'c3',  name:'Dell XPS 15',         cat:'Laptop',    price:19800000, icon:'💻', color:'hsl(224,60%,42%)'},
  {id:'c4',  name:'Dell UltraSharp 27"', cat:'Monitor',   price:5200000,  icon:'🖥️', color:'hsl(220,50%,55%)'},
  {id:'c5',  name:'LG UltraWide 34"',   cat:'Monitor',   price:7800000,  icon:'🖥️', color:'hsl(220,50%,55%)'},
  {id:'c6',  name:'Logitech MX Keys',   cat:'Keyboard',  price:1200000,  icon:'⌨️', color:'hsl(170,50%,42%)'},
  {id:'c7',  name:'Logitech MX Master 3',cat:'Mouse',     price:980000,   icon:'🖱️', color:'hsl(170,50%,42%)'},
  {id:'c8',  name:'Sony WH-1000XM5',    cat:'Headset',   price:3500000,  icon:'🎧', color:'hsl(258,50%,52%)'},
  {id:'c9',  name:'Jabra Evolve2 75',   cat:'Headset',   price:4200000,  icon:'🎧', color:'hsl(258,50%,52%)'},
  {id:'c10', name:'Dell WD22TB4 Dock',  cat:'Docking',   price:3200000,  icon:'🔌', color:'hsl(36,70%,48%)'},
  {id:'c11', name:'Samsung SSD 870 1TB',cat:'Storage',   price:980000,   icon:'💾', color:'hsl(36,70%,48%)'},
  {id:'c12', name:'Logitech C920 Cam',  cat:'Webcam',    price:850000,   icon:'📷', color:'hsl(0,65%,52%)'},
];

const fmt = n => 'Rp ' + n.toLocaleString('id-ID');

// ── Create Wizard ─────────────────────────────────────────────────────────────
const CreateWizard = ({onClose}) => {
  const [step, setStep] = useState(1);
  const [selected, setSelected] = useState(null);
  const [qty, setQty] = useState(1);
  const [catFilter, setCatFilter] = useState('');
  const [form, setForm] = useState({dept:'IT Dept', reason:'', urgency:'MEDIUM', notes:'', address:'Gedung A, Lantai 3'});

  const cats = ['Laptop','Monitor','Keyboard','Mouse','Headset','Docking','Storage','Webcam'];
  const filteredCat = catFilter ? CATALOG.filter(c=>c.cat===catFilter) : CATALOG;

  const overlayStyle = {position:'fixed',inset:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'};
  const inp = (k) => ({
    width:'100%', padding:'9px 13px', borderRadius:10, border:'1px solid var(--border)',
    background:'var(--bg-muted)', color:'var(--fg)', fontSize:13, fontFamily:'var(--font-sans)', outline:'none',
    value: form[k], onChange: e=>setForm(f=>({...f,[k]:e.target.value})),
    onFocus: e=>e.target.style.borderColor='var(--primary)',
    onBlur:  e=>e.target.style.borderColor='var(--border)',
  });

  return (
    <div style={overlayStyle}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.35)',backdropFilter:'blur(4px)'}} onClick={onClose}/>
      <div style={{position:'relative',background:'var(--bg-card)',borderRadius:20,width:560,maxHeight:'85vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-xl)',border:'1px solid var(--border)',animation:'fadeInUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both'}}>
        {/* Header */}
        <div style={{padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div>
            <h3 style={{fontWeight:800,fontSize:16,color:'var(--fg)'}}>Buat Request Hardware</h3>
            <div style={{display:'flex',alignItems:'center',gap:8,marginTop:6}}>
              {[1,2,3].map(s => (
                <React.Fragment key={s}>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <div style={{width:22,height:22,borderRadius:'50%',background:step>=s?'var(--primary)':'var(--bg-muted)',border:`2px solid ${step>=s?'var(--primary)':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:step>=s?'#fff':'var(--fg-subtle)',transition:'all 0.2s'}}>{s}</div>
                    <span style={{fontSize:11,fontWeight:step===s?700:500,color:step===s?'var(--primary)':'var(--fg-subtle)'}}>{['Pilih Item','Detail','Review'][s-1]}</span>
                  </div>
                  {s<3 && <div style={{flex:1,height:1,background:step>s?'var(--primary)':'var(--border)',transition:'background 0.3s',minWidth:20}}/>}
                </React.Fragment>
              ))}
            </div>
          </div>
          <button onClick={onClose} style={{padding:6,borderRadius:8,background:'none',border:'none',cursor:'pointer',color:'var(--fg-muted)'}}><IcX size={18}/></button>
        </div>

        {/* Body */}
        <div style={{flex:1,overflowY:'auto',padding:'20px 24px'}}>
          {step === 1 && (
            <div>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:14}}>
                {['',  ...cats].map(c => (
                  <button key={c} onClick={()=>setCatFilter(c)}
                    style={{padding:'4px 12px',borderRadius:99,fontSize:12,fontWeight:600,cursor:'pointer',transition:'all 0.15s',
                      background:catFilter===c?'var(--primary)':'var(--bg-muted)',color:catFilter===c?'#fff':'var(--fg-muted)',
                      border:`1px solid ${catFilter===c?'var(--primary)':'var(--border)'}`}}>
                    {c||'Semua'}
                  </button>
                ))}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10}}>
                {filteredCat.map(item => (
                  <div key={item.id} onClick={()=>setSelected(item)}
                    style={{padding:'14px 12px',borderRadius:12,border:`2px solid ${selected?.id===item.id?'var(--primary)':'var(--border)'}`,background:selected?.id===item.id?'var(--primary-bg)':'var(--bg-card)',cursor:'pointer',transition:'all 0.15s',textAlign:'center'}}
                    onMouseEnter={e=>{if(selected?.id!==item.id){e.currentTarget.style.borderColor='var(--primary)';e.currentTarget.style.background='var(--bg-hover)';}}}
                    onMouseLeave={e=>{if(selected?.id!==item.id){e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.background='var(--bg-card)';}}}>                    <div style={{fontSize:26,marginBottom:6}}>{item.icon}</div>
                    <div style={{fontSize:12,fontWeight:700,color:'var(--fg)',lineHeight:1.3,marginBottom:3}}>{item.name}</div>
                    <div style={{fontSize:10,color:'var(--fg-muted)',marginBottom:4}}>{item.cat}</div>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--primary)'}}>{fmt(item.price)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {step === 2 && selected && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              {/* Selected item recap */}
              <div style={{background:'var(--primary-bg)',borderRadius:12,padding:'14px 16px',display:'flex',alignItems:'center',gap:14,border:'1px solid var(--primary)20'}}>
                <span style={{fontSize:28}}>{selected.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14,color:'var(--fg)'}}>{selected.name}</div>
                  <div style={{fontSize:12,color:'var(--fg-muted)'}}>{selected.cat} · {fmt(selected.price)}</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <button onClick={()=>setQty(q=>Math.max(1,q-1))} style={{width:28,height:28,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-card)',cursor:'pointer',fontWeight:700,fontSize:16,color:'var(--fg)',display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
                  <span style={{fontWeight:800,fontSize:15,color:'var(--fg)',minWidth:20,textAlign:'center'}}>{qty}</span>
                  <button onClick={()=>setQty(q=>q+1)} style={{width:28,height:28,borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-card)',cursor:'pointer',fontWeight:700,fontSize:16,color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center'}}>+</button>
                </div>
              </div>
              {[
                ['Departemen', 'dept', 'text'],
                ['Alasan Permintaan', 'reason', 'text'],
                ['Alamat Pengiriman', 'address', 'text'],
              ].map(([label, key, type]) => (
                <div key={key}>
                  <label style={{fontSize:11,fontWeight:700,color:'var(--fg-muted)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</label>
                  <input type={type} {...inp(key)} placeholder={label}/>
                </div>
              ))}
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'var(--fg-muted)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>Urgensi</label>
                <div style={{display:'flex',gap:8}}>
                  {[['LOW','Rendah'],['MEDIUM','Sedang'],['HIGH','Tinggi'],['CRITICAL','Kritis']].map(([v,l]) => (
                    <button key={v} onClick={()=>setForm(f=>({...f,urgency:v}))} style={{flex:1,padding:'8px 0',borderRadius:10,fontSize:12,fontWeight:600,border:`1px solid ${form.urgency===v?'var(--primary)':'var(--border)'}`,background:form.urgency===v?'var(--primary-bg)':'var(--bg-muted)',color:form.urgency===v?'var(--primary)':'var(--fg-muted)',cursor:'pointer',transition:'all 0.15s'}}>{l}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{fontSize:11,fontWeight:700,color:'var(--fg-muted)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>Catatan Tambahan</label>
                <textarea {...inp('notes')} placeholder="Spesifikasi tambahan atau catatan khusus…" style={{width:'100%',padding:'9px 13px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg-muted)',color:'var(--fg)',fontSize:13,fontFamily:'var(--font-sans)',outline:'none',resize:'none',height:70}}
                  onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
              </div>
            </div>
          )}
          {step === 3 && selected && (
            <div style={{display:'flex',flexDirection:'column',gap:14}}>
              <div style={{background:'var(--success-bg)',borderRadius:12,padding:'16px',border:'1px solid rgba(61,138,94,0.2)'}}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--success)',marginBottom:2}}>✓ Siap Disubmit</div>
                <div style={{fontSize:12,color:'var(--fg-muted)'}}>Review detail request Anda sebelum mengirim.</div>
              </div>
              {[
                ['Item', `${selected.name} × ${qty}`],
                ['Kategori', selected.cat],
                ['Departemen', form.dept],
                ['Alasan', form.reason||'—'],
                ['Urgensi', form.urgency],
                ['Alamat', form.address],
                ['Total Estimasi', fmt(selected.price * qty)],
              ].map(([k,v]) => (
                <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
                  <span style={{fontSize:13,color:'var(--fg-muted)',fontWeight:500}}>{k}</span>
                  <span style={{fontSize:13,fontWeight:700,color:'var(--fg)',textAlign:'right',maxWidth:'60%'}}>{v}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{padding:'14px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:10,justifyContent:'space-between',flexShrink:0,background:'var(--bg-muted)'}}>
          <button onClick={step===1?onClose:()=>setStep(s=>s-1)} style={{padding:'9px 20px',borderRadius:10,background:'var(--bg-card)',border:'1px solid var(--border)',fontWeight:600,fontSize:13,color:'var(--fg)',cursor:'pointer'}}>
            {step===1?'Batal':'← Kembali'}
          </button>
          <button
            disabled={step===1&&!selected}
            onClick={()=>{ if(step<3) setStep(s=>s+1); else onClose(); }}
            style={{padding:'9px 24px',borderRadius:10,background:step===1&&!selected?'var(--bg-muted)':'var(--primary)',color:step===1&&!selected?'var(--fg-subtle)':'#fff',border:'none',fontWeight:700,fontSize:13,cursor:step===1&&!selected?'not-allowed':'pointer',boxShadow:step===1&&!selected?'none':'0 4px 12px rgba(45,74,140,0.3)',transition:'all 0.15s'}}>
            {step===3?'Submit Request':'Lanjutkan →'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Hardware Request Page ─────────────────────────────────────────────────────
const HardwarePage = () => {
  const [view, setView] = useState('table');
  const [statusF, setStatusF] = useState('');
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(()=>MOCK_HW.filter(r=>{
    if(statusF && r.status!==statusF) return false;
    if(search && !r.item.toLowerCase().includes(search.toLowerCase()) && !r.id.includes(search)) return false;
    return true;
  }),[statusF,search]);

  const counts = useMemo(()=>({
    pending:  MOCK_HW.filter(r=>r.status==='PENDING').length,
    approved: MOCK_HW.filter(r=>r.status==='APPROVED'||r.status==='DELIVERED').length,
    rejected: MOCK_HW.filter(r=>r.status==='REJECTED').length,
    review:   MOCK_HW.filter(r=>r.status==='IN_REVIEW').length,
  }),[]);

  const card = {background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,boxShadow:'var(--shadow-sm)'};
  const selStyle = {padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--fg)',fontSize:13,fontWeight:500,cursor:'pointer',outline:'none',fontFamily:'var(--font-sans)'};

  return (
    <div style={{display:'flex',flexDirection:'column',gap:18,animation:'fadeInUp 0.4s ease both'}}>
      {/* Header */}
      <div style={{...card,padding:'16px 20px',display:'flex',justifyContent:'space-between',alignItems:'center',flexWrap:'wrap',gap:12}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{padding:10,borderRadius:12,background:'var(--primary-bg)',color:'var(--primary)'}}><IcMonitor size={20}/></div>
          <div>
            <h2 style={{fontWeight:800,fontSize:18,color:'var(--fg)',display:'flex',alignItems:'center',gap:8}}>
              Daftar Permintaan Hardware
              <span style={{width:7,height:7,borderRadius:'50%',background:'var(--success)',display:'inline-block',animation:'pulse 2s infinite'}}/>
            </h2>
            <p style={{fontSize:12,color:'var(--fg-muted)',marginTop:1}}>Kelola dan pantau status request hardware</p>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {/* View toggle */}
          <div style={{display:'flex',background:'var(--bg-muted)',borderRadius:10,padding:4,border:'1px solid var(--border)',gap:2}}>
            {[['table','☰'],['card','⊞']].map(([v,ic])=>(
              <button key={v} onClick={()=>setView(v)} style={{padding:'5px 12px',borderRadius:8,fontSize:13,border:'none',cursor:'pointer',fontWeight:700,background:view===v?'var(--bg-card)':'transparent',color:view===v?'var(--primary)':'var(--fg-muted)',boxShadow:view===v?'var(--shadow-sm)':'none',transition:'all 0.15s'}}>{ic}</button>
            ))}
          </div>
          <button onClick={()=>setShowCreate(true)} style={{padding:'9px 18px',borderRadius:10,background:'var(--primary)',color:'#fff',border:'none',fontWeight:700,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:6,boxShadow:'0 4px 12px rgba(45,74,140,0.3)'}}>
            <IcPlus size={15}/> Buat Request
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          {label:'Pending',   v:counts.pending,  c:'var(--warning)', bg:'var(--warning-bg)',  icon:<IcClock size={18}/>},
          {label:'In Review', v:counts.review,   c:'var(--primary)', bg:'var(--primary-bg)', icon:<IcEye size={18}/>},
          {label:'Approved',  v:counts.approved, c:'var(--success)', bg:'var(--success-bg)', icon:<IcCheckCircle size={18}/>},
          {label:'Rejected',  v:counts.rejected, c:'var(--error)',   bg:'var(--error-bg)',   icon:<IcX size={18}/>},
        ].map(s=>(
          <div key={s.label} style={{...card,padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--fg-muted)'}}>{s.label}</div>
              <div style={{fontSize:28,fontWeight:800,color:s.c,lineHeight:1.2}}>{s.v}</div>
            </div>
            <div style={{padding:10,borderRadius:10,background:s.bg,color:s.c}}>{s.icon}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:10,padding:'0 14px',flex:'1 1 200px'}}>
          <IcSearch size={14} style={{color:'var(--fg-subtle)',flexShrink:0}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Cari request…"
            style={{border:'none',outline:'none',background:'transparent',fontSize:13,color:'var(--fg)',padding:'9px 0',width:'100%',fontFamily:'var(--font-sans)'}}/>
          {search && <button onClick={()=>setSearch('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--fg-subtle)'}}><IcX size={13}/></button>}
        </div>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={selStyle}>
          <option value="">Semua Status</option>
          {Object.entries(HW_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        {(statusF||search) && (
          <button onClick={()=>{setStatusF('');setSearch('');}} style={{padding:'8px 14px',borderRadius:8,background:'var(--bg-muted)',border:'1px solid var(--border)',fontSize:13,fontWeight:600,color:'var(--fg-muted)',cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
            <IcX size={12}/> Reset
          </button>
        )}
      </div>

      {/* Table */}
      {view==='table' ? (
        <div style={{...card,overflow:'hidden'}}>
          <div style={{display:'grid',gridTemplateColumns:'110px 1fr 110px 120px 110px 130px 90px',padding:'10px 16px',borderBottom:'2px solid var(--border)',background:'var(--bg-muted)'}}>
            {['No. Request','Item','Kategori','Status','Prioritas','Pemohon','Tanggal'].map(h=>(
              <div key={h} style={{fontSize:11,fontWeight:700,color:'var(--fg-muted)',textTransform:'uppercase',letterSpacing:'0.05em'}}>{h}</div>
            ))}
          </div>
          {filtered.map(r=>{
            const st = HW_STATUS[r.status]||HW_STATUS.PENDING;
            const pc = PRIORITY_COLOR[r.priority]||PRIORITY_COLOR.LOW;
            return (
              <div key={r.id} style={{display:'grid',gridTemplateColumns:'110px 1fr 110px 120px 110px 130px 90px',padding:'12px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background 0.15s'}}
                onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
                onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                <div style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--fg-muted)',fontWeight:600,display:'flex',alignItems:'center'}}>{r.id}</div>
                <div style={{display:'flex',flexDirection:'column',justifyContent:'center',paddingRight:16}}>
                  <span style={{fontSize:13,fontWeight:600,color:'var(--fg)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.item}</span>
                  <span style={{fontSize:11,color:'var(--fg-subtle)',marginTop:1}}>Qty: {r.qty} · {fmt(r.price)}</span>
                </div>
                <div style={{display:'flex',alignItems:'center'}}><span style={{fontSize:12,color:'var(--fg-muted)',fontWeight:500}}>{r.cat}</span></div>
                <div style={{display:'flex',alignItems:'center'}}><span style={{padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,background:st.bg,color:st.text}}>{st.label}</span></div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:7,height:7,borderRadius:'50%',background:pc.dot}}/>
                  <span style={{fontSize:12,fontWeight:600,color:pc.text}}>{pc.label}</span>
                </div>
                <div style={{display:'flex',alignItems:'center'}}>
                  <div style={{display:'flex',flexDirection:'column'}}>
                    <span style={{fontSize:12,fontWeight:600,color:'var(--fg)'}}>{r.requester.split(' ')[0]}</span>
                    <span style={{fontSize:11,color:'var(--fg-subtle)'}}>{r.dept}</span>
                  </div>
                </div>
                <div style={{display:'flex',alignItems:'center'}}><span style={{fontSize:12,color:'var(--fg-subtle)'}}>{r.date.slice(5)}</span></div>
              </div>
            );
          })}
          {filtered.length===0 && (
            <div style={{padding:'32px',textAlign:'center',color:'var(--fg-muted)',fontSize:14}}>Tidak ada request yang sesuai.</div>
          )}
          <div style={{padding:'10px 16px',background:'var(--bg-muted)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:12,color:'var(--fg-muted)',fontWeight:500}}>Menampilkan {filtered.length} dari {MOCK_HW.length} request</span>
            <div style={{display:'flex',gap:4}}>
              {[1,2].map(p=><button key={p} style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:p===1?'var(--primary)':'var(--bg-card)',color:p===1?'#fff':'var(--fg-muted)',fontWeight:600,fontSize:13,cursor:'pointer'}}>{p}</button>)}
            </div>
          </div>
        </div>
      ) : (
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
          {filtered.map(r=>{
            const st = HW_STATUS[r.status]||HW_STATUS.PENDING;
            const pc = PRIORITY_COLOR[r.priority]||PRIORITY_COLOR.LOW;
            return (
              <div key={r.id} style={{...card,padding:'18px',cursor:'pointer',transition:'all 0.2s'}}
                onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-lg)';}}
                onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='var(--shadow-sm)';}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
                  <span style={{fontFamily:'var(--font-mono)',fontSize:11,color:'var(--fg-muted)',fontWeight:600}}>{r.id}</span>
                  <span style={{padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:700,background:st.bg,color:st.text}}>{st.label}</span>
                </div>
                <div style={{fontWeight:700,fontSize:13,color:'var(--fg)',lineHeight:1.4,marginBottom:6}}>{r.item}</div>
                <div style={{fontSize:12,color:'var(--fg-muted)',marginBottom:12}}>Qty: {r.qty} · {fmt(r.price)}</div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:5}}>
                    <span style={{width:7,height:7,borderRadius:'50%',background:pc.dot}}/>
                    <span style={{fontSize:11,fontWeight:600,color:pc.text}}>{pc.label}</span>
                  </div>
                  <div style={{fontSize:11,color:'var(--fg-subtle)'}}>{r.requester.split(' ')[0]} · {r.dept}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showCreate && <CreateWizard onClose={()=>setShowCreate(false)}/>}
    </div>
  );
};

Object.assign(window, {HardwarePage});
