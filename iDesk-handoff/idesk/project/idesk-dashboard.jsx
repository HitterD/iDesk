
const {useState, useMemo} = React;

// ── Sparkline ────────────────────────────────────────────────────────────────
const Sparkline = ({data, color='var(--primary)', w=90, h=32}) => {
  if(!data || data.length < 2) return null;
  const mn = Math.min(...data), mx = Math.max(...data), rng = mx-mn||1;
  const pts = data.map((v,i) => [
    (i/(data.length-1))*(w-4)+2,
    h-2-((v-mn)/rng)*(h-6)
  ]);
  const linePath = pts.map((p,i) => `${i===0?'M':'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const areaPath = linePath + ` L${pts[pts.length-1][0].toFixed(1)},${h} L${pts[0][0].toFixed(1)},${h} Z`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{overflow:'visible'}}>
      <defs>
        <linearGradient id={`sg${color.replace(/[^a-z]/gi,'')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#sg${color.replace(/[^a-z]/gi,'')})`}/>
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={pts[pts.length-1][0]} cy={pts[pts.length-1][1]} r="2.5" fill={color}/>
    </svg>
  );
};

// ── Donut Chart ───────────────────────────────────────────────────────────────
const DonutChart = ({data}) => {
  const total = data.reduce((s,d)=>s+d.v,0);
  if(total===0) return <svg width="110" height="110" viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="none" stroke="var(--border)" strokeWidth="18"/></svg>;
  let cur=0;
  const segs = data.map((d,i) => {
    if(!d.v) return null;
    const angle = (d.v/total)*360;
    if(angle>=360) return <circle key={i} cx="50" cy="50" r="38" fill={d.c}/>;
    const startR = (cur-90)*Math.PI/180, endR = (cur+angle-90)*Math.PI/180;
    const lArc = angle>180?1:0;
    const x1=50+38*Math.cos(startR), y1=50+38*Math.sin(startR);
    const x2=50+38*Math.cos(endR), y2=50+38*Math.sin(endR);
    cur += angle;
    return <path key={i} d={`M50,50 L${x1},${y1} A38,38 0 ${lArc},1 ${x2},${y2} Z`} fill={d.c} style={{transition:'all 0.3s'}}/>;
  });
  return (
    <div style={{position:'relative',flexShrink:0}}>
      <svg width="110" height="110" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="38" fill="var(--bg-muted)"/>
        {segs}
        <circle cx="50" cy="50" r="24" fill="var(--bg-card)"/>
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column'}}>
        <span style={{fontWeight:800,fontSize:18,color:'var(--fg)',lineHeight:1}}>{total}</span>
        <span style={{fontSize:10,color:'var(--fg-subtle)',fontWeight:600}}>total</span>
      </div>
    </div>
  );
};

// ── Bar Chart ─────────────────────────────────────────────────────────────────
const BarChart = ({data}) => {
  const mx = Math.max(...data.flatMap(d=>[d.created,d.resolved]),1);
  return (
    <div style={{display:'flex',alignItems:'flex-end',gap:6,height:140,paddingTop:8}}>
      {data.map((d,i) => (
        <div key={i} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:4,height:'100%'}}>
          <div style={{flex:1,display:'flex',alignItems:'flex-end',gap:2,width:'100%'}}>
            <div style={{flex:1,background:'var(--primary)',borderRadius:'3px 3px 0 0',height:`${(d.created/mx)*100}%`,minHeight:d.created?3:0,opacity:0.8,transition:'height 0.5s cubic-bezier(0.34,1.56,0.64,1)',transitionDelay:`${i*0.05}s`}}/>
            <div style={{flex:1,background:'var(--success)',borderRadius:'3px 3px 0 0',height:`${(d.resolved/mx)*100}%`,minHeight:d.resolved?3:0,opacity:0.85,transition:'height 0.5s cubic-bezier(0.34,1.56,0.64,1)',transitionDelay:`${i*0.05+0.03}s`}}/>
          </div>
          <span style={{fontSize:10,color:'var(--fg-subtle)',fontWeight:600}}>{d.date}</span>
        </div>
      ))}
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────
const StatCard = ({title, value, subtitle, trend, highlight, sparkData, onClick}) => (
  <div onClick={onClick} style={{background:'var(--bg-card)',border:`1px solid ${highlight?'var(--error)':'var(--border)'}`,borderRadius:16,padding:'18px 20px',display:'flex',flexDirection:'column',gap:8,cursor:onClick?'pointer':'default',position:'relative',overflow:'hidden',transition:'all 0.2s',boxShadow:'var(--shadow-sm)',background:highlight?'var(--error-bg)':'var(--bg-card)'}}
    onMouseEnter={e=>{if(onClick){e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='var(--shadow-lg)';}}}
    onMouseLeave={e=>{if(onClick){e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='var(--shadow-sm)';}}}>
    {/* Left accent bar */}
    <div style={{position:'absolute',left:0,top:'50%',transform:'translateY(-50%)',width:3,height:40,borderRadius:'0 2px 2px 0',background:highlight?'var(--error)':'var(--border)',transition:'height 0.2s'}}/>
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
      <span style={{fontSize:11,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',color:highlight?'var(--error)':'var(--fg-muted)'}}>{title}</span>
      {trend && (
        <span style={{display:'flex',alignItems:'center',gap:3,fontSize:11,fontWeight:700,padding:'2px 7px',borderRadius:99,background:trend==='up'?'rgba(61,138,94,0.12)':'rgba(214,48,49,0.1)',color:trend==='up'?'var(--success)':'var(--error)'}}>
          {trend==='up'?<IcTrendUp size={11}/>:<IcTrendDown size={11}/>}
        </span>
      )}
    </div>
    <div>
      <div style={{fontSize:34,fontWeight:800,letterSpacing:'-1px',color:'var(--fg)',lineHeight:1}}>{value}</div>
      {subtitle && <div style={{fontSize:12,color:'var(--fg-muted)',marginTop:3,fontWeight:500}}>{subtitle}</div>}
    </div>
    {sparkData && (
      <div style={{marginTop:4}}>
        <Sparkline data={sparkData} color={highlight?'var(--error)':'var(--primary)'} w={100} h={28}/>
      </div>
    )}
  </div>
);

// ── Dashboard Page ────────────────────────────────────────────────────────────
const DashboardPage = ({navigate}) => {
  const [chartRange] = useState(7);
  const [breakTab, setBreakTab] = useState('status');
  const [feedTab, setFeedTab] = useState('live');

  const tickets = MOCK_TICKETS;
  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter(t=>t.status==='TODO').length;
    const inProg = tickets.filter(t=>t.status==='IN_PROGRESS').length;
    const waiting = tickets.filter(t=>t.status==='WAITING_VENDOR').length;
    const resolved = tickets.filter(t=>t.status==='RESOLVED').length;
    const overdue = tickets.filter(t=>t.isOverdue).length;
    const critical = tickets.filter(t=>t.priority==='CRITICAL').length;
    const high = tickets.filter(t=>t.priority==='HIGH').length;
    const med = tickets.filter(t=>t.priority==='MEDIUM').length;
    const low = tickets.filter(t=>t.priority==='LOW').length;
    const sla = total ? Math.round(((total-overdue)/total)*100) : 100;
    return {total,open,inProg,waiting,resolved,overdue,critical,high,med,low,sla};
  }, [tickets]);

  const statusData = [
    {label:'Open',       v:stats.open,    c:'hsl(220,10%,65%)'},
    {label:'In Progress',v:stats.inProg,  c:'var(--primary)'},
    {label:'Waiting',    v:stats.waiting, c:'var(--warning)'},
    {label:'Resolved',   v:stats.resolved,c:'var(--success)'},
  ];
  const priorityData = [
    {label:'Critical',v:stats.critical,c:'var(--error)'},
    {label:'High',    v:stats.high,    c:'#E17055'},
    {label:'Medium',  v:stats.med,     c:'#FDCB6E'},
    {label:'Low',     v:stats.low,     c:'#B2BEC3'},
  ];

  const tabBtn = (id,label,active) => (
    <button key={id} onClick={()=>setBreakTab(id)}
      style={{flex:1,padding:'6px 8px',fontSize:12,fontWeight:active?700:600,borderRadius:8,border:'none',cursor:'pointer',transition:'all 0.2s',
        background:active?'var(--bg-card)':'transparent',color:active?'var(--primary)':'var(--fg-muted)',
        boxShadow:active?'var(--shadow-sm)':'none'}}>
      {label}
    </button>
  );
  const feedTabBtn = (id,label,active) => (
    <button key={id} onClick={()=>setFeedTab(id)}
      style={{flex:1,padding:'6px 12px',fontSize:12,fontWeight:active?700:600,borderRadius:8,border:'none',cursor:'pointer',transition:'all 0.2s',
        background:active?'var(--bg-card)':'transparent',color:active?'var(--primary)':'var(--fg-muted)',
        boxShadow:active?'var(--shadow-sm)':'none'}}>
      {label}
    </button>
  );

  const cardStyle = {background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:16,boxShadow:'var(--shadow-sm)'};
  const spark = MOCK_LAST7.map(d=>d.created);
  const sparkRes = MOCK_LAST7.map(d=>d.resolved);

  return (
    <div style={{display:'flex',flexDirection:'column',gap:20,animation:'fadeInUp 0.4s ease both'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',gap:12}}>
        <div>
          <h2 style={{fontWeight:800,fontSize:24,color:'var(--fg)',letterSpacing:'-0.5px'}}>Good morning, Admin 👋</h2>
          <p style={{fontSize:13,color:'var(--fg-muted)',marginTop:2}}>Here's your IT helpdesk overview for today.</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>navigate('tickets')}
            style={{padding:'9px 18px',borderRadius:10,background:'var(--bg-muted)',border:'1px solid var(--border)',fontWeight:600,fontSize:13,color:'var(--fg)',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            <IcInbox size={15}/> My Tasks
          </button>
          <button style={{padding:'9px 18px',borderRadius:10,background:'var(--bg-muted)',border:'1px solid var(--border)',fontWeight:600,fontSize:13,color:'var(--fg)',cursor:'pointer',display:'flex',alignItems:'center',gap:6}}>
            <IcRefresh size={15}/>
          </button>
        </div>
      </div>

      {/* Row 1: Stat cards + compact metrics */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr auto',gap:16,alignItems:'stretch'}}>
        <StatCard title="Total Tickets" value={stats.total} subtitle={`${MOCK_LAST7[MOCK_LAST7.length-1].created} new today`} trend="up" sparkData={spark} onClick={()=>navigate('tickets')}/>
        <StatCard title="Open & Active" value={stats.open+stats.inProg} subtitle={`${stats.inProg} in progress`} trend="up" sparkData={spark.map((v,i)=>Math.max(0,v-sparkRes[i]))} onClick={()=>navigate('tickets')} highlight={stats.open+stats.inProg>12}/>
        <StatCard title="Resolved" value={stats.resolved} subtitle={`${MOCK_LAST7[MOCK_LAST7.length-1].resolved} resolved today`} trend="up" sparkData={sparkRes} onClick={()=>navigate('tickets')}/>
        <div style={{display:'flex',flexDirection:'column',gap:10,minWidth:170}}>
          {/* Overdue */}
          <div onClick={()=>navigate('tickets')} style={{...cardStyle,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,cursor:'pointer',flex:1,transition:'all 0.2s'}}
            onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-1px)';e.currentTarget.style.boxShadow='var(--shadow-md)';}}
            onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow='var(--shadow-sm)';}}>
            <div style={{padding:8,borderRadius:10,background:stats.overdue>0?'var(--error-bg)':'var(--bg-muted)',color:stats.overdue>0?'var(--error)':'var(--fg-muted)',flexShrink:0}}>
              <IcAlertTriangle size={16}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--fg-muted)'}}>Overdue</div>
              <div style={{fontSize:20,fontWeight:800,color:stats.overdue>0?'var(--error)':'var(--fg)',lineHeight:1.2}}>{stats.overdue}</div>
            </div>
            {stats.overdue>0 && <span style={{marginLeft:'auto',fontSize:10,fontWeight:700,color:'var(--error)',background:'var(--error-bg)',padding:'2px 8px',borderRadius:6}}>Action!</span>}
          </div>
          {/* SLA */}
          <div style={{...cardStyle,padding:'14px 16px',flex:1}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
              <div style={{display:'flex',alignItems:'center',gap:6}}>
                <IcCheckCircle size={14} style={{color:'var(--success)'}}/>
                <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--fg-muted)'}}>SLA</span>
              </div>
              <span style={{fontSize:14,fontWeight:800,color:'var(--fg)'}}>{stats.sla}%</span>
            </div>
            <div style={{height:6,background:'var(--bg-muted)',borderRadius:99,overflow:'hidden'}}>
              <div style={{height:'100%',width:`${stats.sla}%`,background:stats.sla>=90?'var(--success)':stats.sla>=70?'var(--warning)':'var(--error)',borderRadius:99,transition:'width 1s ease'}}/>
            </div>
          </div>
          {/* Avg resolution */}
          <div style={{...cardStyle,padding:'14px 16px',display:'flex',alignItems:'center',gap:12,flex:1}}>
            <div style={{padding:8,borderRadius:10,background:'var(--primary-bg)',color:'var(--primary)',flexShrink:0}}>
              <IcClock size={16}/>
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em',color:'var(--fg-muted)'}}>Avg Resolve</div>
              <div style={{fontSize:16,fontWeight:800,color:'var(--fg)',lineHeight:1.3}}>3.2h</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Activity chart + Breakdown */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16}}>
        {/* Bar chart */}
        <div style={{...cardStyle,padding:'20px 24px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <IcBarChart size={16} style={{color:'var(--primary)'}}/>
                <span style={{fontWeight:700,fontSize:15,color:'var(--fg)'}}>Activity Overview</span>
                <span style={{width:7,height:7,borderRadius:'50%',background:'var(--success)',display:'inline-block',animation:'pulse 2s infinite'}}/>
              </div>
              <p style={{fontSize:12,color:'var(--fg-muted)',marginTop:2}}>Tickets created vs resolved — last 7 days</p>
            </div>
            <div style={{display:'flex',gap:14,alignItems:'center'}}>
              <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--fg-muted)',fontWeight:600}}>
                <span style={{width:10,height:10,borderRadius:2,background:'var(--primary)',display:'inline-block'}}/>Created
              </div>
              <div style={{display:'flex',alignItems:'center',gap:5,fontSize:12,color:'var(--fg-muted)',fontWeight:600}}>
                <span style={{width:10,height:10,borderRadius:2,background:'var(--success)',display:'inline-block'}}/>Resolved
              </div>
            </div>
          </div>
          <BarChart data={MOCK_LAST7}/>
        </div>
        {/* Breakdown donut */}
        <div style={{...cardStyle,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',background:'var(--bg-muted)',padding:6,gap:2,borderBottom:'1px solid var(--border)'}}>
            {[['status','Status'],['priority','Priority']].map(([id,lb]) => tabBtn(id,lb,breakTab===id))}
          </div>
          <div style={{padding:'20px',flex:1,display:'flex',alignItems:'center',gap:16}}>
            <DonutChart data={breakTab==='status'?statusData:priorityData}/>
            <div style={{flex:1,display:'flex',flexDirection:'column',gap:8}}>
              {(breakTab==='status'?statusData:priorityData).map((d,i) => (
                <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <span style={{width:10,height:10,borderRadius:2,background:d.c,flexShrink:0,display:'inline-block'}}/>
                    <span style={{fontSize:12,color:'var(--fg-muted)',fontWeight:500}}>{d.label}</span>
                  </div>
                  <span style={{fontSize:13,fontWeight:700,color:'var(--fg)'}}>{d.v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Feed + Top Agents */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 280px',gap:16}}>
        {/* Feed */}
        <div style={{...cardStyle,overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div style={{display:'flex',background:'var(--bg-muted)',padding:6,gap:2,borderBottom:'1px solid var(--border)'}}>
            {[['live','Live Activity'],['recent','Recent Tickets']].map(([id,lb]) => feedTabBtn(id,lb,feedTab===id))}
          </div>
          <div style={{overflowY:'auto',flex:1}}>
            {feedTab==='live' ? (
              <div style={{padding:'8px 0'}}>
                {tickets.slice(0,8).map((t,i) => {
                  const sc = STATUS_COLOR[t.status]||STATUS_COLOR.TODO;
                  const pc = PRIORITY_COLOR[t.priority]||PRIORITY_COLOR.LOW;
                  return (
                    <div key={t.id} style={{display:'flex',alignItems:'center',gap:14,padding:'10px 20px',borderBottom:'1px solid var(--border)',cursor:'pointer',transition:'background 0.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <span style={{width:8,height:8,borderRadius:'50%',background:pc.dot,flexShrink:0}}/>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:13,color:'var(--fg)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                        <div style={{fontSize:11,color:'var(--fg-muted)',marginTop:1}}>{t.assignee||'Unassigned'} · {formatTime(t.created)}</div>
                      </div>
                      <span style={{padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,background:sc.bg,color:sc.text,whiteSpace:'nowrap'}}>{sc.label}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{padding:'8px 8px'}}>
                {tickets.slice(0,6).map(t => {
                  const sc = STATUS_COLOR[t.status]||STATUS_COLOR.TODO;
                  const pc = PRIORITY_COLOR[t.priority]||PRIORITY_COLOR.LOW;
                  return (
                    <div key={t.id} style={{padding:'10px 12px',borderRadius:10,marginBottom:4,cursor:'pointer',transition:'background 0.15s'}}
                      onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                        <span style={{width:6,height:6,borderRadius:'50%',background:pc.dot,flexShrink:0}}/>
                        <span style={{fontSize:11,fontFamily:'var(--font-mono)',color:'var(--fg-muted)',fontWeight:500}}>{t.num}</span>
                        <span style={{marginLeft:'auto',padding:'2px 8px',borderRadius:99,fontSize:10,fontWeight:700,background:sc.bg,color:sc.text}}>{sc.label}</span>
                      </div>
                      <div style={{fontWeight:600,fontSize:13,color:'var(--fg)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.title}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{padding:'10px 16px',borderTop:'1px solid var(--border)',textAlign:'center'}}>
            <button onClick={()=>navigate('tickets')} style={{fontSize:13,fontWeight:600,color:'var(--primary)',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:4,margin:'0 auto'}}>
              View all tickets <IcArrowRight size={13}/>
            </button>
          </div>
        </div>

        {/* Top Agents */}
        <div style={{...cardStyle,padding:'20px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8}}>
              <IcUsers size={16} style={{color:'var(--primary)'}}/>
              <span style={{fontWeight:700,fontSize:14,color:'var(--fg)'}}>Top Agents</span>
            </div>
            <button onClick={()=>navigate('agents')} style={{fontSize:12,fontWeight:600,color:'var(--primary)',background:'none',border:'none',cursor:'pointer',display:'flex',alignItems:'center',gap:3}}>
              All <IcArrowRight size={12}/>
            </button>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {MOCK_AGENTS.map((a,i) => (
              <div key={a.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 10px',borderRadius:10,border:'1px solid transparent',cursor:'pointer',transition:'all 0.15s'}}
                onMouseEnter={e=>{e.currentTarget.style.background='var(--bg-hover)';e.currentTarget.style.borderColor='var(--border)';}}
                onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.borderColor='transparent';}}>
                <div style={{position:'relative',flexShrink:0}}>
                  <div style={{width:34,height:34,borderRadius:10,background:'var(--primary-bg)',color:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:12,border:`2px solid ${a.status==='online'?'var(--success)':a.status==='busy'?'var(--warning)':'var(--border)'}`}}>
                    {a.initials}
                  </div>
                  <span style={{position:'absolute',bottom:-2,right:-2,width:9,height:9,borderRadius:'50%',background:a.status==='online'?'var(--success)':a.status==='busy'?'var(--warning)':'var(--border-strong)',border:'2px solid var(--bg-card)'}}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:700,fontSize:13,color:'var(--fg)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.name}</div>
                  <div style={{fontSize:11,color:'var(--fg-muted)'}}>
                    <span style={{color:'var(--success)',fontWeight:600}}>{a.resolved}</span> res · <span style={{color:'var(--primary)',fontWeight:600}}>{a.inProgress}</span> active
                  </div>
                </div>
                {i===0 && <div style={{width:26,height:26,borderRadius:'50%',background:'rgba(253,203,110,0.15)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><IcTrophy size={13} style={{color:'#d4ac0d'}}/></div>}
                {i===1 && <div style={{width:26,height:26,borderRadius:'50%',background:'rgba(178,190,195,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><IcMedal size={13} style={{color:'#95A5A6'}}/></div>}
                {i===2 && <div style={{width:26,height:26,borderRadius:'50%',background:'rgba(225,112,85,0.12)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><IcMedal size={13} style={{color:'#E17055'}}/></div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

Object.assign(window, {DashboardPage});
