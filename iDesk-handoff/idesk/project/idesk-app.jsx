
const {useState, useEffect} = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "dark": false,
  "accent": "sapphire",
  "sidebarCollapsed": false,
  "role": "ADMIN",
  "density": "comfortable"
}/*EDITMODE-END*/;

// ── Tweaks Panel ──────────────────────────────────────────────────────────────
const TweaksPanel = ({tweaks, setTweaks, dark, setDark, onClose}) => {
  const set = (k,v) => {
    setTweaks(t => {
      const next = {...t, [k]:v};
      window.parent.postMessage({type:'__edit_mode_set_keys', edits: next}, '*');
      return next;
    });
  };

  const panelStyle = {
    position:'fixed', bottom:20, right:20, width:260,
    background:'var(--bg-card)', border:'1px solid var(--border)',
    borderRadius:16, boxShadow:'var(--shadow-xl)', zIndex:200,
    animation:'fadeInUp 0.25s ease both', overflow:'hidden',
  };

  const rowStyle = {padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', gap:12};
  const labelStyle = {fontSize:12, fontWeight:600, color:'var(--fg-muted)'};
  const optStyle = (active) => ({padding:'4px 12px', borderRadius:99, fontSize:12, fontWeight:active?700:500, border:`1px solid ${active?'var(--primary)':'var(--border)'}`, background: active?'var(--primary)':'transparent', color: active?'#fff':'var(--fg-muted)', cursor:'pointer', transition:'all 0.15s'});

  return (
    <div style={panelStyle}>
      <div style={{padding:'12px 16px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-muted)'}}>
        <span style={{fontWeight:700, fontSize:13, color:'var(--fg)'}}>Tweaks</span>
        <button onClick={onClose} style={{background:'none',border:'none',cursor:'pointer',color:'var(--fg-muted)',padding:2}}><IcX size={15}/></button>
      </div>

      {/* Theme */}
      <div style={rowStyle}>
        <span style={labelStyle}>Theme</span>
        <div style={{display:'flex',gap:4}}>
          <button style={optStyle(!dark)} onClick={()=>setDark(false)}>Light</button>
          <button style={optStyle(dark)}  onClick={()=>setDark(true)}>Dark</button>
        </div>
      </div>

      {/* Accent */}
      <div style={rowStyle}>
        <span style={labelStyle}>Accent</span>
        <div style={{display:'flex',gap:6}}>
          {[
            {id:'sapphire', c:'hsl(224,60%,42%)'},
            {id:'teal',     c:'hsl(170,60%,38%)'},
            {id:'indigo',   c:'hsl(239,60%,52%)'},
            {id:'violet',   c:'hsl(258,60%,52%)'},
          ].map(a => (
            <button key={a.id} onClick={()=>set('accent',a.id)}
              style={{width:22,height:22,borderRadius:'50%',background:a.c,border:`3px solid ${tweaks.accent===a.id?'var(--fg)':'transparent'}`,cursor:'pointer',transition:'all 0.15s'}}/>
          ))}
        </div>
      </div>

      {/* Sidebar */}
      <div style={rowStyle}>
        <span style={labelStyle}>Sidebar</span>
        <div style={{display:'flex',gap:4}}>
          <button style={optStyle(!tweaks.sidebarCollapsed)} onClick={()=>set('sidebarCollapsed',false)}>Full</button>
          <button style={optStyle(tweaks.sidebarCollapsed)}  onClick={()=>set('sidebarCollapsed',true)}>Mini</button>
        </div>
      </div>

      {/* Role */}
      <div style={rowStyle}>
        <span style={labelStyle}>Role</span>
        <div style={{display:'flex',gap:4}}>
          {['ADMIN','AGENT','USER'].map(r => (
            <button key={r} style={optStyle(tweaks.role===r)} onClick={()=>set('role',r)}>{r[0]+r.slice(1).toLowerCase()}</button>
          ))}
        </div>
      </div>

      {/* Density */}
      <div style={{...rowStyle, borderBottom:'none'}}>
        <span style={labelStyle}>Density</span>
        <div style={{display:'flex',gap:4}}>
          <button style={optStyle(tweaks.density==='comfortable')} onClick={()=>set('density','comfortable')}>Cozy</button>
          <button style={optStyle(tweaks.density==='compact')}     onClick={()=>set('density','compact')}>Compact</button>
        </div>
      </div>
    </div>
  );
};

// ── Create Ticket Modal ───────────────────────────────────────────────────────
const CreateTicketModal = ({onClose}) => {
  const [form, setForm] = useState({title:'', priority:'MEDIUM', cat:'GENERAL', desc:''});
  const inp = (k) => ({...inputStyle, value:form[k], onChange:e=>setForm(f=>({...f,[k]:e.target.value}))});
  const inputStyle = {
    width:'100%', padding:'10px 14px', borderRadius:10, border:'1px solid var(--border)',
    background:'var(--bg-muted)', color:'var(--fg)', fontSize:13, fontFamily:'var(--font-sans)',
    outline:'none', transition:'border-color 0.15s',
  };
  return (
    <div style={{position:'fixed',inset:0,zIndex:150,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.3)',backdropFilter:'blur(4px)'}} onClick={onClose}/>
      <div style={{position:'relative',background:'var(--bg-card)',borderRadius:20,width:480,boxShadow:'var(--shadow-xl)',animation:'fadeInUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both',border:'1px solid var(--border)'}}>
        <div style={{padding:'20px 24px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <h3 style={{fontWeight:800,fontSize:16,color:'var(--fg)'}}>Create New Ticket</h3>
          <button onClick={onClose} style={{padding:6,borderRadius:8,background:'none',border:'none',cursor:'pointer',color:'var(--fg-muted)'}}><IcX size={18}/></button>
        </div>
        <div style={{padding:'20px 24px',display:'flex',flexDirection:'column',gap:14}}>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:'var(--fg-muted)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Title *</label>
            <input {...inp('title')} placeholder="Brief description of the issue" style={{...inputStyle,value:form.title}} onChange={e=>setForm(f=>({...f,title:e.target.value}))}
              onFocus={e=>e.target.style.borderColor='var(--primary)'}
              onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:12,fontWeight:700,color:'var(--fg-muted)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Priority</label>
              <select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={{...inputStyle,cursor:'pointer'}}>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>
            </div>
            <div>
              <label style={{fontSize:12,fontWeight:700,color:'var(--fg-muted)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Category</label>
              <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))} style={{...inputStyle,cursor:'pointer'}}>
                <option value="SERVER">Server</option>
                <option value="NETWORK">Network</option>
                <option value="SOFTWARE">Software</option>
                <option value="HARDWARE">Hardware</option>
                <option value="ACCESS">Access</option>
                <option value="EMAIL">Email</option>
                <option value="GENERAL">General</option>
              </select>
            </div>
          </div>
          <div>
            <label style={{fontSize:12,fontWeight:700,color:'var(--fg-muted)',display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.05em'}}>Description</label>
            <textarea value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} placeholder="Detailed description of the issue…"
              style={{...inputStyle,resize:'none',height:90,lineHeight:1.5}}
              onFocus={e=>e.target.style.borderColor='var(--primary)'}
              onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          </div>
        </div>
        <div style={{padding:'16px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:10,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{padding:'9px 20px',borderRadius:10,background:'var(--bg-muted)',border:'1px solid var(--border)',fontWeight:600,fontSize:13,color:'var(--fg)',cursor:'pointer'}}>Cancel</button>
          <button onClick={onClose} style={{padding:'9px 24px',borderRadius:10,background:'var(--primary)',color:'#fff',border:'none',fontWeight:700,fontSize:13,cursor:'pointer',boxShadow:'0 4px 12px rgba(45,74,140,0.3)'}}>Submit Ticket</button>
        </div>
      </div>
    </div>
  );
};

// ── App ───────────────────────────────────────────────────────────────────────
const PAGES = {
  dashboard:'DashboardPage', tickets:'TicketsPage', kb:'KBPage',
  notifications:'NotificationsPage', reports:'ReportsPage', renewal:'RenewalPage',
  agents:'AgentsPage', automation:'AutomationPage', settings:'SettingsPage',
  hardware:'HardwarePage', zoom:'ZoomPage', eform:'EFormPage', audit:'AuditPage',
};

const ACCENT_VARS = {
  sapphire: {'--primary':'hsl(224,60%,42%)','--primary-light':'hsl(224,60%,52%)','--primary-bg':'hsl(224,60%,97%)'},
  teal:     {'--primary':'hsl(170,60%,38%)','--primary-light':'hsl(170,60%,48%)','--primary-bg':'hsl(170,60%,96%)'},
  indigo:   {'--primary':'hsl(239,60%,52%)','--primary-light':'hsl(239,60%,62%)','--primary-bg':'hsl(239,60%,96%)'},
  violet:   {'--primary':'hsl(258,60%,52%)','--primary-light':'hsl(258,60%,62%)','--primary-bg':'hsl(258,60%,96%)'},
};
const ACCENT_DARK = {
  sapphire: {'--primary':'hsl(224,65%,62%)'},
  teal:     {'--primary':'hsl(170,65%,52%)'},
  indigo:   {'--primary':'hsl(239,65%,68%)'},
  violet:   {'--primary':'hsl(258,65%,68%)'},
};

const App = () => {
  const [tweaks, setTweaks] = useState(TWEAK_DEFAULTS);
  const [dark, setDark] = useState(TWEAK_DEFAULTS.dark);
  const [page, setPage] = useState('dashboard');
  const [collapsed, setCollapsed] = useState(TWEAK_DEFAULTS.sidebarCollapsed);
  const [tweaksVisible, setTweaksVisible] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', dark);
    const vars = dark ? ACCENT_DARK[tweaks.accent]||ACCENT_DARK.sapphire : ACCENT_VARS[tweaks.accent]||ACCENT_VARS.sapphire;
    Object.entries(vars).forEach(([k,v]) => root.style.setProperty(k,v));
  }, [dark, tweaks.accent]);

  // Sync sidebar from tweaks
  useEffect(() => setCollapsed(tweaks.sidebarCollapsed), [tweaks.sidebarCollapsed]);

  // Tweaks protocol
  useEffect(() => {
    const handler = (e) => {
      if(e.data?.type==='__activate_edit_mode')   setTweaksVisible(true);
      if(e.data?.type==='__deactivate_edit_mode') setTweaksVisible(false);
    };
    window.addEventListener('message', handler);
    window.parent.postMessage({type:'__edit_mode_available'}, '*');
    return () => window.removeEventListener('message', handler);
  }, []);

  const PageComp = window[PAGES[page]] || window.DashboardPage;
  const padding = tweaks.density==='compact' ? '14px 18px' : '20px 24px';

  return (
    <div style={{display:'flex',height:'100vh',overflow:'hidden',background:'var(--bg)'}}>
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} page={page} setPage={setPage} role={tweaks.role}/>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden',minWidth:0}}>
        <Topbar dark={dark} setDark={setDark} page={page} setTweaksVisible={setTweaksVisible}/>
        {/* Override Create Ticket from topbar */}
        <div style={{display:'none'}} id="create-trigger"/>
        <main style={{flex:1,overflowY:'auto',padding,background:'var(--bg)'}}>
          <PageComp navigate={setPage}/>
        </main>
      </div>
      {tweaksVisible && <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} dark={dark} setDark={setDark} onClose={()=>setTweaksVisible(false)}/>}
      {showCreate && <CreateTicketModal onClose={()=>setShowCreate(false)}/>}
    </div>
  );
};

// Wire Create Ticket button in Topbar to modal
const _origTopbar = window.Topbar;
window.Topbar = (props) => {
  const [,forceUpdate] = React.useState(0);
  return React.createElement(_origTopbar, {
    ...props,
    setTweaksVisible: (fn) => {
      // intercept Create Ticket — handled via app state
      props.setTweaksVisible(fn);
    }
  });
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
