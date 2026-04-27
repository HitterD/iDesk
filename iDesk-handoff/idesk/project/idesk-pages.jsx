
const {useState} = React;
const cardStyle = {background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,boxShadow:'var(--shadow-sm)'};

// ── Knowledge Base ────────────────────────────────────────────────────────────
const KBPage = () => {
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('');
  const cats = ['All','Access','Network','Hardware','Software','Email','Server'];
  const filtered = MOCK_KB_ARTICLES.filter(a => {
    if(cat && cat!=='All' && a.cat !== cat) return false;
    if(search && !a.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20,animation:'fadeInUp 0.4s ease both'}}>
      {/* Hero */}
      <div style={{borderRadius:20,padding:'36px 40px',background:'linear-gradient(135deg, var(--primary) 0%, hsl(224,60%,55%) 100%)',position:'relative',overflow:'hidden',boxShadow:'0 8px 32px rgba(45,74,140,0.3)'}}>
        <div style={{position:'absolute',top:-40,right:-40,width:200,height:200,borderRadius:'50%',background:'rgba(255,255,255,0.06)'}}/>
        <div style={{position:'absolute',bottom:-60,left:200,width:260,height:260,borderRadius:'50%',background:'rgba(255,255,255,0.04)'}}/>
        <div style={{position:'relative',zIndex:1}}>
          <h2 style={{fontWeight:800,fontSize:26,color:'#fff',marginBottom:8}}>How can we help you?</h2>
          <p style={{fontSize:14,color:'rgba(255,255,255,0.75)',marginBottom:20}}>Search our knowledge base for answers to common IT questions.</p>
          <div style={{display:'flex',alignItems:'center',gap:10,background:'rgba(255,255,255,0.95)',borderRadius:12,padding:'10px 16px',maxWidth:480}}>
            <IcSearch size={18} style={{color:'var(--fg-muted)',flexShrink:0}}/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search articles…"
              style={{border:'none',outline:'none',background:'transparent',fontSize:14,color:'var(--fg)',width:'100%',fontFamily:'var(--font-sans)'}}/>
          </div>
        </div>
      </div>

      {/* Category pills */}
      <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
        {cats.map(c => (
          <button key={c} onClick={()=>setCat(c==='All'?'':c)}
            style={{padding:'7px 16px',borderRadius:99,fontSize:13,fontWeight:600,cursor:'pointer',transition:'all 0.15s',
              background: (!cat&&c==='All')||(cat===c) ? 'var(--primary)' : 'var(--bg-card)',
              color: (!cat&&c==='All')||(cat===c) ? '#fff' : 'var(--fg-muted)',
              border: `1px solid ${(!cat&&c==='All')||(cat===c) ? 'var(--primary)' : 'var(--border)'}`,
              boxShadow: (!cat&&c==='All')||(cat===c) ? '0 2px 8px rgba(45,74,140,0.2)' : 'none'}}
            onMouseEnter={e=>{if((!cat&&c==='All')||(cat===c)) return; e.currentTarget.style.borderColor='var(--primary)'; e.currentTarget.style.color='var(--primary)';}}
            onMouseLeave={e=>{if((!cat&&c==='All')||(cat===c)) return; e.currentTarget.style.borderColor='var(--border)'; e.currentTarget.style.color='var(--fg-muted)';}}>
            {c}
          </button>
        ))}
      </div>

      {/* Articles grid */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
        {filtered.map(a => (
          <div key={a.id} style={{...cardStyle,padding:'20px',cursor:'pointer',transition:'all 0.2s'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-3px)';e.currentTarget.style.boxShadow='var(--shadow-lg)';e.currentTarget.style.borderColor='var(--primary)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='var(--shadow-sm)';e.currentTarget.style.borderColor='var(--border)';}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
              <span style={{fontSize:11,fontWeight:700,color:'var(--primary)',background:'var(--primary-bg)',padding:'3px 10px',borderRadius:99}}>{a.cat}</span>
              <span style={{fontSize:11,color:'var(--fg-subtle)',fontWeight:500}}>{a.mins} min read</span>
            </div>
            <h3 style={{fontWeight:700,fontSize:14,color:'var(--fg)',lineHeight:1.4,marginBottom:12}}>{a.title}</h3>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'var(--fg-muted)'}}>
                <IcEye size={13}/> {a.views.toLocaleString()} views
              </div>
              <div style={{display:'flex',alignItems:'center',gap:4,fontSize:12,color:'var(--success)'}}>
                <IcCheckCircle size={12}/> {a.helpful}% helpful
              </div>
            </div>
          </div>
        ))}
        {filtered.length===0 && (
          <div style={{gridColumn:'1/-1',textAlign:'center',padding:'40px',color:'var(--fg-muted)',fontSize:14}}>No articles found.</div>
        )}
      </div>

      {/* Stats footer */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:14}}>
        {[
          {label:'Total Articles',value:'48',icon:<IcBookOpen size={18}/>},
          {label:'Total Views',   value:'12,430',icon:<IcEye size={18}/>},
          {label:'Avg Helpful',   value:'91%',icon:<IcCheckCircle size={18}/>},
        ].map(s => (
          <div key={s.label} style={{...cardStyle,padding:'16px 20px',display:'flex',alignItems:'center',gap:14}}>
            <div style={{padding:10,borderRadius:10,background:'var(--primary-bg)',color:'var(--primary)'}}>{s.icon}</div>
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--fg-muted)'}}>{s.label}</div>
              <div style={{fontSize:20,fontWeight:800,color:'var(--fg)'}}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ── Notifications Page ────────────────────────────────────────────────────────
const NotificationsPage = () => {
  const [tab, setTab] = useState('all');
  const [notifs, setNotifs] = useState(MOCK_NOTIFICATIONS);

  const filtered = tab==='unread' ? notifs.filter(n=>!n.read) : notifs;

  const TYPE_ICON = {
    critical: {icon:<IcAlertTriangle size={16}/>, bg:'var(--error-bg)',   color:'var(--error)'},
    ticket:   {icon:<IcTicket size={16}/>,        bg:'var(--primary-bg)', color:'var(--primary)'},
    resolved: {icon:<IcCheckCircle size={16}/>,   bg:'var(--success-bg)', color:'var(--success)'},
    renewal:  {icon:<IcCalendar size={16}/>,      bg:'var(--warning-bg)', color:'var(--warning)'},
    system:   {icon:<IcActivity size={16}/>,      bg:'var(--bg-muted)',   color:'var(--fg-muted)'},
  };

  const markAllRead = () => setNotifs(n => n.map(x => ({...x, read:true})));

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16,animation:'fadeInUp 0.4s ease both',maxWidth:700}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2 style={{fontWeight:800,fontSize:22,color:'var(--fg)',letterSpacing:'-0.3px'}}>Notifications</h2>
          <p style={{fontSize:13,color:'var(--fg-muted)',marginTop:1}}>{notifs.filter(n=>!n.read).length} unread</p>
        </div>
        <button onClick={markAllRead} style={{padding:'8px 16px',borderRadius:10,background:'var(--bg-card)',border:'1px solid var(--border)',fontSize:13,fontWeight:600,color:'var(--fg)',cursor:'pointer'}}>
          Mark all read
        </button>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,background:'var(--bg-muted)',padding:4,borderRadius:10,width:'fit-content',border:'1px solid var(--border)'}}>
        {[['all','All'],['unread','Unread']].map(([id,lb]) => (
          <button key={id} onClick={()=>setTab(id)} style={{padding:'6px 18px',borderRadius:8,fontSize:13,fontWeight:tab===id?700:500,border:'none',cursor:'pointer',transition:'all 0.15s',background:tab===id?'var(--bg-card)':'transparent',color:tab===id?'var(--primary)':'var(--fg-muted)',boxShadow:tab===id?'var(--shadow-sm)':'none'}}>
            {lb}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{...cardStyle,overflow:'hidden'}}>
        {filtered.length===0 ? (
          <div style={{padding:'40px',textAlign:'center',color:'var(--fg-muted)',fontSize:14}}>
            <IcBell size={32} style={{display:'block',margin:'0 auto 12px',opacity:0.3}}/>
            No notifications
          </div>
        ) : filtered.map((n,i) => {
          const ti = TYPE_ICON[n.type] || TYPE_ICON.system;
          return (
            <div key={n.id} onClick={()=>setNotifs(ns=>ns.map(x=>x.id===n.id?{...x,read:true}:x))}
              style={{display:'flex',alignItems:'flex-start',gap:14,padding:'14px 18px',borderBottom: i<filtered.length-1?'1px solid var(--border)':'none',
                background:!n.read?'var(--primary-bg)':'transparent',cursor:'pointer',transition:'background 0.15s',
                animation:n.type==='critical'&&!n.read?'criticalPulse 2s ease-in-out infinite':'none'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
              onMouseLeave={e=>e.currentTarget.style.background=!n.read?'var(--primary-bg)':'transparent'}>
              <div style={{width:36,height:36,borderRadius:10,background:ti.bg,color:ti.color,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{ti.icon}</div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8,marginBottom:3}}>
                  <span style={{fontWeight:!n.read?700:500,fontSize:13,color:'var(--fg)'}}>{n.title}</span>
                  <span style={{fontSize:11,color:'var(--fg-subtle)',whiteSpace:'nowrap',flexShrink:0}}>{n.time}</span>
                </div>
                <p style={{fontSize:12,color:'var(--fg-muted)',lineHeight:1.4}}>{n.body}</p>
              </div>
              {!n.read && <span style={{width:8,height:8,borderRadius:'50%',background:'var(--primary)',flexShrink:0,marginTop:6}}/>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ── Placeholder Pages ─────────────────────────────────────────────────────────
const PlaceholderPage = ({title, icon, description}) => (
  <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',minHeight:400,gap:16,animation:'fadeInUp 0.4s ease both'}}>
    <div style={{padding:24,borderRadius:20,background:'var(--primary-bg)',color:'var(--primary)'}}>{icon}</div>
    <h2 style={{fontWeight:800,fontSize:22,color:'var(--fg)'}}>{title}</h2>
    <p style={{fontSize:14,color:'var(--fg-muted)',textAlign:'center',maxWidth:320}}>{description}</p>
    <span style={{padding:'8px 20px',borderRadius:99,background:'var(--bg-muted)',border:'1px solid var(--border)',fontSize:13,color:'var(--fg-muted)',fontWeight:600}}>Coming soon</span>
  </div>
);

const ReportsPage    = () => <PlaceholderPage title="Reports"     icon={<IcBarChart size={36}/>}  description="Comprehensive analytics, SLA tracking, and performance dashboards."/>;
const RenewalPage    = () => <PlaceholderPage title="Renewal Hub" icon={<IcCalendar size={36}/>} description="Track contract renewals, expiry alerts, and acknowledgment status."/>;
const AgentsPage     = () => <PlaceholderPage title="Agents"      icon={<IcUsers size={36}/>}    description="Manage agents, roles, workloads, and performance metrics."/>;
const AutomationPage = () => <PlaceholderPage title="Automation"  icon={<IcZap size={36}/>}      description="Build rule-based automation for ticket routing and escalation."/>;
const SettingsPage   = () => <PlaceholderPage title="Settings"    icon={<IcSettings size={36}/>} description="Configure system preferences, SLA policies, and integrations."/>;
const HardwarePage   = () => <PlaceholderPage title="Hardware Requests" icon={<IcMonitor size={36}/>} description="Manage hardware request submissions, catalog, and approvals."/>;
const ZoomPage       = () => <PlaceholderPage title="Zoom Calendar"     icon={<IcVideo size={36}/>}   description="Book and manage Zoom meeting rooms and video sessions."/>;
const EFormPage      = () => <PlaceholderPage title="E-Form Access"     icon={<IcFile size={36}/>}    description="Submit and track E-Form access requests with approval workflow."/>;
const AuditPage      = () => <PlaceholderPage title="Audit Logs"        icon={<IcShield size={36}/>}  description="Full system audit trail with filtering and export capabilities."/>;

Object.assign(window, {KBPage, NotificationsPage, ReportsPage, RenewalPage, AgentsPage, AutomationPage, SettingsPage, HardwarePage, ZoomPage, EFormPage, AuditPage});
