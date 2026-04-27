
const {useState, useEffect, useContext, useRef} = React;

// ── Logo ──────────────────────────────────────────────────────────────────────
const Logo = ({collapsed}) => (
  <div style={{display:'flex',alignItems:'center',gap:10,userSelect:'none'}}>
    <div style={{width:34,height:34,borderRadius:10,background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 4px 12px rgba(45,74,140,0.35)'}}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="14" width="18" height="3" rx="1.5" fill="white"/>
        <rect x="5" y="7" width="14" height="7" rx="2" fill="white" opacity="0.85"/>
        <rect x="6" y="8" width="12" height="5" rx="1" fill="var(--primary)"/>
        <rect x="10" y="17" width="4" height="2" rx="1" fill="white" opacity="0.7"/>
      </svg>
    </div>
    {!collapsed && (
      <div style={{lineHeight:1}}>
        <span style={{fontWeight:800,fontSize:18,color:'var(--primary)',letterSpacing:'-0.5px'}}>i</span>
        <span style={{fontWeight:800,fontSize:18,color:'var(--fg)',letterSpacing:'-0.5px'}}>Desk</span>
      </div>
    )}
  </div>
);

// ── Nav config ────────────────────────────────────────────────────────────────
const NAV = [
  { type:'item', key:'dashboard',     icon:'IcDashboard', label:'Dashboard',      page:'dashboard' },
  { type:'group', label:'Request Center', id:'requests', items:[
    { key:'tickets',   icon:'IcTicket',  label:'Tickets',         page:'tickets',  badge:5  },
    { key:'hardware',  icon:'IcMonitor', label:'Hardware Request', page:'hardware'           },
    { key:'eform',     icon:'IcFile',    label:'E-Form Access',    page:'eform'              },
  ]},
  { type:'group', label:'Resources', id:'resources', items:[
    { key:'zoom',  icon:'IcVideo',   label:'Zoom Calendar',  page:'zoom'  },
    { key:'kb',    icon:'IcBookOpen',label:'Knowledge Base', page:'kb'    },
  ]},
  { type:'group', label:'Management', id:'management', items:[
    { key:'notifications', icon:'IcBell',     label:'Notifications', page:'notifications', badge:4 },
    { key:'reports',       icon:'IcBarChart', label:'Reports',        page:'reports'                },
    { key:'renewal',       icon:'IcCalendar', label:'Renewal Hub',    page:'renewal'                },
  ]},
  { type:'group', label:'Administration', id:'admin', adminOnly:true, items:[
    { key:'agents',    icon:'IcUsers',    label:'Agents',       page:'agents'    },
    { key:'automation',icon:'IcZap',      label:'Automation',   page:'automation'},
    { key:'audit',     icon:'IcShield',   label:'Audit Logs',   page:'audit'     },
  ]},
  { type:'item', key:'settings', icon:'IcSettings', label:'Settings', page:'settings', adminOnly:true },
];

// ── Sidebar ───────────────────────────────────────────────────────────────────
const Sidebar = ({collapsed, setCollapsed, page, setPage, role='ADMIN'}) => {
  const [expanded, setExpanded] = useState({requests:true, resources:true, management:true, admin:true});

  const toggle = id => setExpanded(p => ({...p, [id]: !p[id]}));
  const isAdmin = role === 'ADMIN';

  const navItemStyle = (active) => ({
    display:'flex', alignItems:'center', gap:collapsed?0:12,
    padding: collapsed ? '10px 0' : '9px 12px',
    borderRadius:10, cursor:'pointer', position:'relative',
    justifyContent: collapsed ? 'center' : 'flex-start',
    background: active ? 'var(--primary)' : 'transparent',
    color: active ? '#fff' : 'var(--fg-muted)',
    fontWeight: active ? 700 : 500,
    fontSize: 14,
    transition: 'all 0.15s ease',
    border: 'none', outline:'none', width:'100%', textAlign:'left',
  });

  const renderItem = (item, indent=false) => {
    if(item.adminOnly && !isAdmin) return null;
    const active = page === item.page;
    const Icon = window[item.icon];
    return (
      <button key={item.key} style={{...navItemStyle(active), paddingLeft: indent&&!collapsed?20:collapsed?0:12}}
        onClick={() => setPage(item.page)}
        onMouseEnter={e => { if(!active) e.currentTarget.style.background='var(--bg-hover)'; e.currentTarget.style.color='var(--fg)'; }}
        onMouseLeave={e => { if(!active) { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--fg-muted)'; } }}>
        {Icon && <Icon size={18} style={{flexShrink:0}} />}
        {!collapsed && <span style={{flex:1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{item.label}</span>}
        {!collapsed && item.badge && (
          <span style={{background:'var(--error)',color:'#fff',borderRadius:99,fontSize:10,fontWeight:800,padding:'1px 6px',lineHeight:'16px'}}>{item.badge}</span>
        )}
        {collapsed && item.badge && (
          <span style={{position:'absolute',top:6,right:6,width:8,height:8,borderRadius:'50%',background:'var(--error)',border:'2px solid var(--bg-card)'}} />
        )}
      </button>
    );
  };

  const sidebarW = collapsed ? 72 : 256;

  return (
    <aside style={{width:sidebarW, minWidth:sidebarW, height:'100vh', display:'flex', flexDirection:'column',
      background:'var(--sidebar-bg)', backdropFilter:'blur(20px)', WebkitBackdropFilter:'blur(20px)',
      borderRight:'1px solid var(--border)', position:'relative', transition:'width 0.2s cubic-bezier(0.23,1,0.32,1)',
      overflow:'hidden', flexShrink:0}}>

      {/* Logo */}
      <div style={{padding: collapsed?'20px 0':'20px 20px', display:'flex', alignItems:'center', justifyContent: collapsed?'center':'flex-start', borderBottom:'1px solid var(--border)', marginBottom:8}}>
        <Logo collapsed={collapsed} />
      </div>

      {/* Toggle button */}
      <button onClick={() => setCollapsed(c => !c)}
        style={{position:'absolute', top:22, right:-12, width:24, height:24, borderRadius:6, background:'var(--bg-card)',
          border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center',
          cursor:'pointer', color:'var(--fg-muted)', boxShadow:'var(--shadow-sm)', zIndex:10,
          transition:'all 0.15s ease'}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--primary)';e.currentTarget.style.color='var(--primary)';}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--fg-muted)';}}>
        {collapsed ? <IcChevronRight size={13}/> : <IcChevronLeft size={13}/>}
      </button>

      {/* Search hint */}
      {!collapsed && (
        <div style={{margin:'0 12px 12px', padding:'8px 12px', background:'var(--bg-muted)', borderRadius:8,
          display:'flex', alignItems:'center', gap:8, border:'1px dashed var(--border)'}}>
          <IcSearch size={14} style={{color:'var(--fg-subtle)',flexShrink:0}} />
          <span style={{fontSize:12, color:'var(--fg-subtle)'}}>Press </span>
          <kbd style={{background:'var(--bg-card)', border:'1px solid var(--border)', borderRadius:4, padding:'1px 5px', fontSize:11, fontFamily:'var(--font-mono)', color:'var(--fg-muted)'}}>⌘K</kbd>
        </div>
      )}

      {/* Navigation */}
      <nav style={{flex:1, overflowY:'auto', overflowX:'hidden', padding: collapsed?'0 10px':'0 12px', display:'flex', flexDirection:'column', gap:2}}>
        {NAV.map(entry => {
          if(entry.adminOnly && !isAdmin) return null;
          if(entry.type === 'item') return renderItem(entry);
          // Group
          const isExp = expanded[entry.id] ?? true;
          return (
            <div key={entry.id} style={{marginBottom:4}}>
              {!collapsed && (
                <button onClick={() => toggle(entry.id)} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 4px',background:'none',border:'none',cursor:'pointer',width:'100%',color:'var(--fg-subtle)'}}>
                  <div style={{width:3,height:12,borderRadius:2,background:isExp?'var(--primary)':'var(--border)',flexShrink:0}}/>
                  <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.07em',textTransform:'uppercase',flex:1,textAlign:'left'}}>{entry.label}</span>
                  <IcChevronDown size={12} style={{transform:isExp?'rotate(0)':'rotate(-90deg)',transition:'transform 0.2s'}}/>
                </button>
              )}
              {(isExp || collapsed) && (
                <div style={{display:'flex',flexDirection:'column',gap:1,paddingLeft:collapsed?0:4}}>
                  {entry.items.map(item => renderItem(item, !collapsed))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{borderTop:'1px solid var(--border)', padding: collapsed?'12px 10px':'12px 12px'}}>
        <div style={{display:'flex', alignItems:'center', gap: collapsed?0:10, justifyContent: collapsed?'center':'flex-start'}}>
          <div style={{width:34,height:34,borderRadius:10,background:'linear-gradient(135deg,var(--primary),var(--primary-light))',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:800,fontSize:13,flexShrink:0}}>AD</div>
          {!collapsed && (
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:13,color:'var(--fg)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>Admin User</div>
              <div style={{fontSize:11,color:'var(--fg-muted)'}}>Administrator</div>
            </div>
          )}
          {!collapsed && (
            <button style={{padding:6,borderRadius:8,background:'none',border:'none',cursor:'pointer',color:'var(--fg-subtle)'}}
              onMouseEnter={e=>{e.currentTarget.style.background='var(--error-bg)';e.currentTarget.style.color='var(--error)'}}
              onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='var(--fg-subtle)'}}>
              <IcLogOut size={16}/>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};

// ── Topbar ────────────────────────────────────────────────────────────────────
const Topbar = ({dark, setDark, page, setTweaksVisible}) => {
  const [notifOpen, setNotifOpen] = useState(false);
  const unread = MOCK_NOTIFICATIONS.filter(n => !n.read).length;

  const pageTitle = {
    dashboard:'Dashboard', tickets:'Tickets', kb:'Knowledge Base',
    notifications:'Notifications', settings:'Settings', reports:'Reports',
    renewal:'Renewal Hub', agents:'Agents', automation:'Automation',
    hardware:'Hardware Request', zoom:'Zoom Calendar', eform:'E-Form Access',
    audit:'Audit Logs'
  }[page] || 'iDesk';

  return (
    <header style={{height:64,borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',gap:16,padding:'0 24px',background:'var(--sidebar-bg)',backdropFilter:'blur(20px)',WebkitBackdropFilter:'blur(20px)',flexShrink:0,position:'relative',zIndex:20}}>
      {/* Page title */}
      <div style={{flex:1}}>
        <h1 style={{fontWeight:800,fontSize:20,color:'var(--fg)',letterSpacing:'-0.3px'}}>{pageTitle}</h1>
        <div style={{display:'flex',alignItems:'center',gap:6,marginTop:1}}>
          <span style={{width:7,height:7,borderRadius:'50%',background:'var(--success)',display:'inline-block',animation:'pulse 2s ease-in-out infinite'}}/>
          <span style={{fontSize:11,color:'var(--fg-subtle)',fontWeight:500}}>Live · Updated just now</span>
        </div>
      </div>

      {/* Search */}
      <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--bg-muted)',border:'1px solid var(--border)',borderRadius:10,padding:'7px 14px',width:220,cursor:'text'}}>
        <IcSearch size={15} style={{color:'var(--fg-subtle)',flexShrink:0}}/>
        <span style={{fontSize:13,color:'var(--fg-subtle)'}}>Search…</span>
        <kbd style={{marginLeft:'auto',background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:4,padding:'1px 5px',fontSize:10,fontFamily:'var(--font-mono)',color:'var(--fg-subtle)'}}>⌘K</kbd>
      </div>

      {/* Notifications */}
      <div style={{position:'relative'}}>
        <button onClick={()=>setNotifOpen(o=>!o)}
          style={{width:38,height:38,borderRadius:10,background: notifOpen?'var(--primary-bg)':'var(--bg-muted)',border:`1px solid ${notifOpen?'var(--primary)':'var(--border)'}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:notifOpen?'var(--primary)':'var(--fg-muted)',position:'relative',transition:'all 0.15s'}}>
          <IcBell size={17}/>
          {unread > 0 && <span style={{position:'absolute',top:4,right:4,width:8,height:8,borderRadius:'50%',background:'var(--error)',border:'2px solid var(--bg-card)'}}/>}
        </button>
        {notifOpen && (
          <div style={{position:'absolute',top:46,right:0,width:340,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:16,boxShadow:'var(--shadow-xl)',zIndex:50,overflow:'hidden'}}>
            <div style={{padding:'14px 16px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontWeight:700,fontSize:14,color:'var(--fg)'}}>Notifications</span>
              {unread>0 && <span style={{background:'var(--error)',color:'#fff',borderRadius:99,fontSize:11,fontWeight:700,padding:'1px 8px'}}>{unread} new</span>}
            </div>
            <div style={{maxHeight:320,overflowY:'auto'}}>
              {MOCK_NOTIFICATIONS.slice(0,6).map(n => (
                <div key={n.id} style={{padding:'10px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer',background:n.read?'transparent':'var(--primary-bg)',transition:'background 0.15s'}}
                  onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
                  onMouseLeave={e=>e.currentTarget.style.background=n.read?'transparent':'var(--primary-bg)'}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',gap:8}}>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:n.read?500:700,fontSize:13,color:'var(--fg)',marginBottom:2}}>{n.title}</div>
                      <div style={{fontSize:12,color:'var(--fg-muted)',lineHeight:1.4}}>{n.body}</div>
                    </div>
                    <span style={{fontSize:11,color:'var(--fg-subtle)',whiteSpace:'nowrap',flexShrink:0}}>{n.time}</span>
                  </div>
                  {!n.read && <span style={{width:6,height:6,borderRadius:'50%',background:'var(--primary)',display:'inline-block',marginTop:4}}/>}
                </div>
              ))}
            </div>
            <div style={{padding:'10px 16px',textAlign:'center'}}>
              <button style={{fontSize:13,fontWeight:600,color:'var(--primary)',background:'none',border:'none',cursor:'pointer'}}>View all notifications</button>
            </div>
          </div>
        )}
      </div>

      {/* Dark mode toggle */}
      <button onClick={()=>setDark(d=>!d)}
        style={{width:38,height:38,borderRadius:10,background:'var(--bg-muted)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:'var(--fg-muted)',transition:'all 0.15s'}}
        onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--primary)';e.currentTarget.style.color='var(--primary)';}}
        onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--fg-muted)';}}>
        {dark ? <IcSun size={17}/> : <IcMoon size={17}/>}
      </button>

      {/* Tweaks */}
      <button onClick={()=>setTweaksVisible(v=>!v)}
        style={{padding:'0 14px',height:38,borderRadius:10,background:'var(--primary)',color:'#fff',border:'none',cursor:'pointer',fontWeight:700,fontSize:13,display:'flex',alignItems:'center',gap:6,boxShadow:'0 4px 12px rgba(45,74,140,0.3)',transition:'all 0.15s'}}
        onMouseEnter={e=>e.currentTarget.style.opacity='0.9'}
        onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
        <IcPlus size={15}/> Create Ticket
      </button>
    </header>
  );
};

Object.assign(window, { Sidebar, Topbar });
