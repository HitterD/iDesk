
const {useState, useMemo} = React;

// ── Ticket Detail Panel ───────────────────────────────────────────────────────
const TicketDetailPanel = ({ticket, onClose}) => {
  const [tab, setTab] = useState('details');
  if (!ticket) return null;
  const pc = PRIORITY_COLOR[ticket.priority] || PRIORITY_COLOR.LOW;
  const sc = STATUS_COLOR[ticket.status] || STATUS_COLOR.TODO;
  const panelStyle = {
    position:'fixed', top:0, right:0, bottom:0, width:460,
    background:'var(--bg-card)', borderLeft:'1px solid var(--border)',
    boxShadow:'-8px 0 40px rgba(0,0,0,0.12)', zIndex:100,
    display:'flex', flexDirection:'column',
    animation:'slideIn 0.3s cubic-bezier(0.23,1,0.32,1) both',
  };
  const MOCK_MSGS = [
    {id:1, author:'System',        initials:'SY', time:'2h ago', body:'Ticket created via web portal.', type:'system'},
    {id:2, author:ticket.assignee||'Support Team', initials:(ticket.assignee||'ST').split(' ').map(w=>w[0]).join(''), time:'1h 45m ago', body:'Sedang kami investigasi. Mohon informasi lebih lanjut mengenai error message yang muncul.', type:'agent'},
    {id:3, author:'Budi Santoso',  initials:'BS', time:'1h 20m ago', body:'Error message: "Connection refused port 5432". Database service tidak respond.', type:'user'},
    {id:4, author:ticket.assignee||'Support Team', initials:(ticket.assignee||'ST').split(' ').map(w=>w[0]).join(''), time:'45m ago', body:'Sudah escalate ke tim infrastructure. Estimasi resolve 1-2 jam.', type:'agent'},
  ];

  return (
    <div style={{position:'fixed',inset:0,zIndex:99}}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.15)',backdropFilter:'blur(2px)'}} onClick={onClose}/>
      <div style={panelStyle}>
        {/* Header */}
        <div style={{padding:'16px 20px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'flex-start',gap:12}}>
          <div style={{flex:1}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--fg-muted)',fontWeight:600}}>{ticket.num}</span>
              <span style={{padding:'2px 10px',borderRadius:99,fontSize:11,fontWeight:700,background:sc.bg,color:sc.text}}>{sc.label}</span>
              <span style={{padding:'2px 10px',borderRadius:99,fontSize:11,fontWeight:700,background:pc.bg,color:pc.text}}>{pc.label}</span>
              {ticket.isOverdue && <span style={{padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:700,background:'var(--error-bg)',color:'var(--error)'}}>OVERDUE</span>}
            </div>
            <h3 style={{fontWeight:700,fontSize:15,color:'var(--fg)',lineHeight:1.4}}>{ticket.title}</h3>
          </div>
          <button onClick={onClose} style={{padding:6,borderRadius:8,background:'none',border:'none',cursor:'pointer',color:'var(--fg-muted)',flexShrink:0}}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-hover)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='none';}}>
            <IcX size={18}/>
          </button>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',borderBottom:'1px solid var(--border)',background:'var(--bg-muted)',padding:'0 16px'}}>
          {[['details','Details'],['messages','Messages'],['activity','Activity']].map(([id,lb]) => (
            <button key={id} onClick={()=>setTab(id)} style={{padding:'10px 16px',fontWeight:tab===id?700:500,fontSize:13,color:tab===id?'var(--primary)':'var(--fg-muted)',background:'none',border:'none',cursor:'pointer',borderBottom:tab===id?'2px solid var(--primary)':'2px solid transparent',transition:'all 0.15s'}}>
              {lb}
            </button>
          ))}
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'16px 20px'}}>
          {tab==='details' && (
            <div style={{display:'flex',flexDirection:'column',gap:16}}>
              {/* Meta grid */}
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                {[
                  ['Category', ticket.cat],
                  ['Assignee', ticket.assignee||'Unassigned'],
                  ['Created', formatTime(ticket.created)],
                  ['Messages', ticket.msgs],
                ].map(([k,v]) => (
                  <div key={k} style={{background:'var(--bg-muted)',borderRadius:10,padding:'12px 14px'}}>
                    <div style={{fontSize:11,fontWeight:700,color:'var(--fg-muted)',textTransform:'uppercase',letterSpacing:'0.05em',marginBottom:4}}>{k}</div>
                    <div style={{fontSize:14,fontWeight:600,color:'var(--fg)'}}>{v||'—'}</div>
                  </div>
                ))}
              </div>
              {/* SLA */}
              <div style={{background:ticket.isOverdue?'var(--error-bg)':'var(--primary-bg)',borderRadius:12,padding:'14px 16px',border:`1px solid ${ticket.isOverdue?'var(--error)':'var(--primary)'}20`}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                  <span style={{fontWeight:700,fontSize:13,color:ticket.isOverdue?'var(--error)':'var(--primary)'}}>{ticket.isOverdue?'⚠ SLA Breached':'SLA Status'}</span>
                  <span style={{fontSize:12,fontWeight:600,color:'var(--fg-muted)'}}>{ticket.isOverdue?'Exceeded by 2h 15m':'2h 45m remaining'}</span>
                </div>
                <div style={{height:6,background:'var(--bg-muted)',borderRadius:99}}>
                  <div style={{height:'100%',width:ticket.isOverdue?'100%':'65%',background:ticket.isOverdue?'var(--error)':'var(--primary)',borderRadius:99}}/>
                </div>
              </div>
              {/* Actions */}
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <div style={{fontWeight:700,fontSize:13,color:'var(--fg)',marginBottom:2}}>Quick Actions</div>
                {[
                  ['Assign to Me', 'var(--primary-bg)', 'var(--primary)'],
                  ['Mark Resolved', 'var(--success-bg)', 'var(--success)'],
                  ['Escalate', 'var(--warning-bg)', 'var(--warning)'],
                ].map(([label, bg, color]) => (
                  <button key={label} style={{padding:'10px 16px',borderRadius:10,background:bg,border:`1px solid ${color}20`,color,fontWeight:600,fontSize:13,cursor:'pointer',textAlign:'left',transition:'all 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.opacity='0.8'}
                    onMouseLeave={e=>e.currentTarget.style.opacity='1'}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {tab==='messages' && (
            <div style={{display:'flex',flexDirection:'column',gap:12}}>
              {MOCK_MSGS.map(m => (
                <div key={m.id} style={{display:'flex',gap:10,alignItems:'flex-start'}}>
                  <div style={{width:32,height:32,borderRadius:8,background:m.type==='system'?'var(--bg-muted)':m.type==='agent'?'var(--primary-bg)':'var(--success-bg)',color:m.type==='system'?'var(--fg-muted)':m.type==='agent'?'var(--primary)':'var(--success)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:11,flexShrink:0}}>
                    {m.initials}
                  </div>
                  <div style={{flex:1}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:12,color:'var(--fg)'}}>{m.author}</span>
                      <span style={{fontSize:11,color:'var(--fg-subtle)'}}>{m.time}</span>
                    </div>
                    <div style={{fontSize:13,color:'var(--fg-muted)',lineHeight:1.5,background:'var(--bg-muted)',padding:'10px 14px',borderRadius:'0 10px 10px 10px'}}>{m.body}</div>
                  </div>
                </div>
              ))}
              {/* Reply box */}
              <div style={{marginTop:8,border:'1px solid var(--border)',borderRadius:12,overflow:'hidden'}}>
                <textarea placeholder="Type a reply…" style={{width:'100%',padding:'12px 14px',fontSize:13,color:'var(--fg)',background:'var(--bg-card)',border:'none',outline:'none',resize:'none',height:80,fontFamily:'var(--font-sans)'}}/>
                <div style={{padding:'8px 12px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'flex-end'}}>
                  <button style={{padding:'7px 18px',borderRadius:8,background:'var(--primary)',color:'#fff',border:'none',fontWeight:700,fontSize:13,cursor:'pointer'}}>Send</button>
                </div>
              </div>
            </div>
          )}

          {tab==='activity' && (
            <div style={{display:'flex',flexDirection:'column',gap:0}}>
              {[
                {time:'5m ago',  icon:'🔄', text:'Status changed to In Progress by Ahmad Fauzi'},
                {time:'45m ago', icon:'💬', text:'Comment added by Budi Santoso'},
                {time:'1h ago',  icon:'👤', text:'Assigned to Ahmad Fauzi'},
                {time:'2h ago',  icon:'🎫', text:'Ticket created via web portal'},
              ].map((a,i) => (
                <div key={i} style={{display:'flex',gap:12,paddingBottom:16,position:'relative'}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0}}>
                    <div style={{width:28,height:28,borderRadius:'50%',background:'var(--bg-muted)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,zIndex:1}}>{a.icon}</div>
                    {i<3 && <div style={{width:1,flex:1,background:'var(--border)',marginTop:4}}/>}
                  </div>
                  <div style={{paddingTop:4}}>
                    <div style={{fontSize:13,color:'var(--fg)',lineHeight:1.4}}>{a.text}</div>
                    <div style={{fontSize:11,color:'var(--fg-subtle)',marginTop:3}}>{a.time}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Tickets Page ──────────────────────────────────────────────────────────────
const TicketsPage = ({navigate}) => {
  const [search, setSearch] = useState('');
  const [statusF, setStatusF] = useState('');
  const [priorityF, setPriorityF] = useState('');
  const [selected, setSelected] = useState(null);

  const filtered = useMemo(() => MOCK_TICKETS.filter(t => {
    if(search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.num.includes(search)) return false;
    if(statusF && t.status !== statusF) return false;
    if(priorityF && t.priority !== priorityF) return false;
    return true;
  }), [search, statusF, priorityF]);

  const stats = useMemo(() => ({
    active: MOCK_TICKETS.filter(t=>t.status==='TODO'||t.status==='IN_PROGRESS').length,
    critical: MOCK_TICKETS.filter(t=>t.priority==='CRITICAL').length,
    overdue: MOCK_TICKETS.filter(t=>t.isOverdue).length,
    sla: Math.round((MOCK_TICKETS.filter(t=>!t.isOverdue).length/MOCK_TICKETS.length)*100),
  }), []);

  const cardStyle = {background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:12,padding:'14px 18px',boxShadow:'var(--shadow-sm)'};

  const selectStyle = (value) => ({padding:'8px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-card)',color: value?'var(--fg)':'var(--fg-muted)',fontSize:13,fontWeight:500,cursor:'pointer',outline:'none',fontFamily:'var(--font-sans)'});

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20,animation:'fadeInUp 0.4s ease both'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div>
          <h2 style={{fontWeight:800,fontSize:22,color:'var(--fg)',letterSpacing:'-0.3px'}}>All Tickets</h2>
          <p style={{fontSize:13,color:'var(--fg-muted)',marginTop:1}}>{filtered.length} of {MOCK_TICKETS.length} tickets shown</p>
        </div>
        <button style={{padding:'9px 18px',borderRadius:10,background:'var(--primary)',color:'#fff',border:'none',fontWeight:700,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:6,boxShadow:'0 4px 12px rgba(45,74,140,0.3)'}}>
          <IcPlus size={15}/> New Ticket
        </button>
      </div>

      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12}}>
        {[
          {label:'Active',   value:stats.active,   color:'var(--primary)',  bg:'var(--primary-bg)'},
          {label:'Critical', value:stats.critical, color:'var(--error)',    bg:'var(--error-bg)'},
          {label:'Overdue',  value:stats.overdue,  color:'var(--error)',    bg:'var(--error-bg)'},
          {label:'SLA',      value:stats.sla+'%',  color:'var(--success)',  bg:'var(--success-bg)'},
        ].map(s => (
          <div key={s.label} style={{...cardStyle,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--fg-muted)'}}>{s.label}</div>
              <div style={{fontSize:26,fontWeight:800,color:s.color,lineHeight:1.2}}>{s.value}</div>
            </div>
            <div style={{width:40,height:40,borderRadius:10,background:s.bg,display:'flex',alignItems:'center',justifyContent:'center',color:s.color}}>
              {s.label==='Active'&&<IcActivity size={18}/>}
              {s.label==='Critical'&&<IcAlertTriangle size={18}/>}
              {s.label==='Overdue'&&<IcClock size={18}/>}
              {s.label==='SLA'&&<IcCheckCircle size={18}/>}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:8,background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:10,padding:'0 14px',flex:'1 1 220px'}}>
          <IcSearch size={15} style={{color:'var(--fg-subtle)',flexShrink:0}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search tickets…"
            style={{border:'none',outline:'none',background:'transparent',fontSize:13,color:'var(--fg)',padding:'9px 0',width:'100%',fontFamily:'var(--font-sans)'}}/>
          {search && <button onClick={()=>setSearch('')} style={{background:'none',border:'none',cursor:'pointer',color:'var(--fg-subtle)'}}><IcX size={14}/></button>}
        </div>
        <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={selectStyle(statusF)}>
          <option value="">All Status</option>
          <option value="TODO">Open</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING_VENDOR">Waiting</option>
          <option value="RESOLVED">Resolved</option>
        </select>
        <select value={priorityF} onChange={e=>setPriorityF(e.target.value)} style={selectStyle(priorityF)}>
          <option value="">All Priority</option>
          <option value="CRITICAL">Critical</option>
          <option value="HIGH">High</option>
          <option value="MEDIUM">Medium</option>
          <option value="LOW">Low</option>
        </select>
        {(statusF||priorityF||search) && (
          <button onClick={()=>{setStatusF('');setPriorityF('');setSearch('');}} style={{padding:'8px 14px',borderRadius:8,background:'var(--bg-muted)',border:'1px solid var(--border)',fontSize:13,fontWeight:600,color:'var(--fg-muted)',cursor:'pointer',display:'flex',alignItems:'center',gap:5}}>
            <IcX size={13}/> Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,overflow:'hidden',boxShadow:'var(--shadow-sm)'}}>
        {/* Table header */}
        <div style={{display:'grid',gridTemplateColumns:'160px 1fr 100px 120px 140px 100px 50px',gap:0,padding:'10px 16px',borderBottom:'2px solid var(--border)',background:'var(--bg-muted)'}}>
          {['Ticket #','Title','Priority','Status','Assignee','Created',''].map((h,i) => (
            <div key={i} style={{fontSize:11,fontWeight:700,color:'var(--fg-muted)',textTransform:'uppercase',letterSpacing:'0.05em',display:'flex',alignItems:'center',gap:4,userSelect:'none',cursor:h?'pointer':'default'}}
              onMouseEnter={e=>{if(h)e.currentTarget.style.color='var(--fg)';}}
              onMouseLeave={e=>{e.currentTarget.style.color='var(--fg-muted)'}}>
              {h}
            </div>
          ))}
        </div>
        {/* Rows */}
        <div>
          {filtered.length === 0 ? (
            <div style={{padding:'40px 20px',textAlign:'center',color:'var(--fg-muted)',fontSize:14}}>No tickets match your filters.</div>
          ) : filtered.map(t => {
            const pc = PRIORITY_COLOR[t.priority]||PRIORITY_COLOR.LOW;
            const sc = STATUS_COLOR[t.status]||STATUS_COLOR.TODO;
            const isUrgent = t.isOverdue || t.priority==='CRITICAL';
            return (
              <div key={t.id} onClick={()=>setSelected(t)}
                style={{display:'grid',gridTemplateColumns:'160px 1fr 100px 120px 140px 100px 50px',gap:0,padding:'12px 16px',borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background 0.15s',background:isUrgent?`${pc.bg}40`:'transparent',
                  animation:isUrgent&&t.isOverdue?'criticalPulse 2s ease-in-out infinite':'none'}}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-hover)';}}
                onMouseLeave={e=>{e.currentTarget.style.background=isUrgent?`${pc.bg}40`:'transparent';}}>
                {/* Ticket # */}
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  {t.isOverdue && <span style={{width:6,height:6,borderRadius:'50%',background:'var(--error)',flexShrink:0,animation:'pulse 1.5s infinite'}}/>}
                  <span style={{fontFamily:'var(--font-mono)',fontSize:12,color:'var(--fg-muted)',fontWeight:600}}>{t.num}</span>
                </div>
                {/* Title */}
                <div style={{display:'flex',alignItems:'center',paddingRight:16}}>
                  <span style={{fontSize:13,fontWeight:600,color:'var(--fg)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</span>
                  {t.msgs>0 && <span style={{display:'flex',alignItems:'center',gap:3,marginLeft:8,flexShrink:0,fontSize:11,color:'var(--fg-subtle)'}}><IcMsg size={11}/>{t.msgs}</span>}
                </div>
                {/* Priority */}
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{width:8,height:8,borderRadius:'50%',background:pc.dot,flexShrink:0}}/>
                  <span style={{fontSize:12,fontWeight:600,color:pc.text}}>{pc.label}</span>
                </div>
                {/* Status */}
                <div style={{display:'flex',alignItems:'center'}}>
                  <span style={{padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,background:sc.bg,color:sc.text}}>{sc.label}</span>
                </div>
                {/* Assignee */}
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  {t.assignee ? (
                    <>
                      <div style={{width:22,height:22,borderRadius:6,background:'var(--primary-bg)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:800,flexShrink:0}}>
                        {getInitials(t.assignee)}
                      </div>
                      <span style={{fontSize:12,color:'var(--fg-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.assignee.split(' ')[0]}</span>
                    </>
                  ) : <span style={{fontSize:12,color:'var(--fg-subtle)',fontStyle:'italic'}}>Unassigned</span>}
                </div>
                {/* Created */}
                <div style={{display:'flex',alignItems:'center'}}>
                  <span style={{fontSize:12,color:'var(--fg-subtle)'}}>{formatTime(t.created)}</span>
                </div>
                {/* Actions */}
                <div style={{display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <button style={{padding:4,borderRadius:6,background:'none',border:'none',cursor:'pointer',color:'var(--fg-subtle)'}}
                    onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-hover)';e.currentTarget.style.color='var(--fg)';}}
                    onMouseLeave={e=>{e.currentTarget.style.background='none';e.currentTarget.style.color='var(--fg-subtle)';}}
                    onClick={e=>{e.stopPropagation();}}>
                    <IcMore size={16}/>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {/* Pagination */}
        <div style={{padding:'12px 16px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--bg-muted)'}}>
          <span style={{fontSize:12,color:'var(--fg-muted)',fontWeight:500}}>Showing 1–{filtered.length} of {MOCK_TICKETS.length}</span>
          <div style={{display:'flex',gap:4}}>
            {[1,2,3].map(p => (
              <button key={p} style={{width:30,height:30,borderRadius:8,border:'1px solid var(--border)',background:p===1?'var(--primary)':'var(--bg-card)',color:p===1?'#fff':'var(--fg-muted)',fontWeight:600,fontSize:13,cursor:'pointer'}}>
                {p}
              </button>
            ))}
          </div>
        </div>
      </div>
      {selected && <TicketDetailPanel ticket={selected} onClose={()=>setSelected(null)}/>}
    </div>
  );
};

Object.assign(window, {TicketsPage, TicketDetailPanel});
