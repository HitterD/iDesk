
const {useState, useMemo, useRef, useEffect} = React;

// ── Mock Data ─────────────────────────────────────────────────────────────────
// Week: Mon Apr 21 – Fri Apr 25, 2026
const WEEK_DAYS = [
  {key:'mon', label:'Sen', date:'21', full:'Senin, 21 Apr'},
  {key:'tue', label:'Sel', date:'22', full:'Selasa, 22 Apr'},
  {key:'wed', label:'Rab', date:'23', full:'Rabu, 23 Apr'},
  {key:'thu', label:'Kam', date:'24', full:'Kamis, 24 Apr'},
  {key:'fri', label:'Jum', date:'25', full:'Jumat, 25 Apr'},
];

// Time range: 08:00 – 18:00, every 30 min = 20 slots
const START_MIN = 8 * 60; // 480
const SLOT_H    = 44;     // px per 30-min slot
const SLOTS     = Array.from({length:20},(_,i)=>{
  const m = START_MIN + i*30;
  return `${String(Math.floor(m/60)).padStart(2,'0')}:${m%60===0?'00':'30'}`;
});

const toY = (time) => {
  const [h,m] = time.split(':').map(Number);
  return ((h*60+m - START_MIN)/30) * SLOT_H;
};
const toH = (start,end) => {
  const [sh,sm] = start.split(':').map(Number);
  const [eh,em] = end.split(':').map(Number);
  return ((eh*60+em - sh*60-sm)/30) * SLOT_H;
};

const ZOOM_ACCOUNTS = [
  {id:'za1', name:'Meeting Room A', capacity:10, icon:'🏢'},
  {id:'za2', name:'Meeting Room B', capacity:8,  icon:'🏛️'},
  {id:'za3', name:'Conference Hall',capacity:30, icon:'🎪'},
];

const ZOOM_BOOKINGS = [
  {id:'z1',  day:'mon', start:'09:00', end:'10:00', title:'Sprint Planning',           host:'Ahmad Fauzi',  room:'za1', isMine:false, color:'primary'},
  {id:'z2',  day:'mon', start:'14:00', end:'15:30', title:'Infrastructure Review',     host:'Budi Santoso', room:'za2', isMine:false, color:'success'},
  {id:'z3',  day:'tue', start:'10:00', end:'11:00', title:'Vendor Meeting - Cisco',    host:'Siti Nuraini', room:'za1', isMine:false, color:'warning'},
  {id:'z4',  day:'tue', start:'15:00', end:'16:00', title:'Budget Discussion Q2',      host:'Dewi Rahayu',  room:'za3', isMine:false, color:'primary'},
  {id:'z5',  day:'wed', start:'09:00', end:'10:30', title:'All Hands Meeting',         host:'Admin User',   room:'za3', isMine:true,  color:'accent'},
  {id:'z6',  day:'wed', start:'13:00', end:'14:00', title:'IT Security Briefing',      host:'Dewi Rahayu',  room:'za2', isMine:false, color:'error'},
  {id:'z7',  day:'wed', start:'15:00', end:'16:00', title:'Training: Cybersecurity',   host:'Eko Prasetyo', room:'za1', isMine:false, color:'success'},
  {id:'z8',  day:'thu', start:'11:00', end:'12:00', title:'New Employee Onboarding',   host:'HR Team',      room:'za2', isMine:false, color:'warning'},
  {id:'z9',  day:'thu', start:'14:30', end:'15:30', title:'Performance Review 1-on-1', host:'Ahmad Fauzi',  room:'za1', isMine:false, color:'primary'},
  {id:'z10', day:'fri', start:'09:00', end:'09:30', title:'Weekly IT Sync',            host:'Admin User',   room:'za1', isMine:true,  color:'accent'},
  {id:'z11', day:'fri', start:'15:00', end:'16:00', title:'DB Maintenance Briefing',   host:'Budi Santoso', room:'za2', isMine:false, color:'success'},
];

const BOOKING_COLORS = {
  primary: {bg:'var(--primary-bg)',  border:'var(--primary)',  text:'var(--primary)'},
  success: {bg:'var(--success-bg)',  border:'var(--success)',  text:'var(--success)'},
  warning: {bg:'var(--warning-bg)',  border:'var(--warning)',  text:'var(--warning)'},
  error:   {bg:'var(--error-bg)',    border:'var(--error)',    text:'var(--error)'},
  accent:  {bg:'rgba(232,168,48,0.12)', border:'var(--accent)', text:'var(--accent)'},
};

// ── Book Slot Modal ────────────────────────────────────────────────────────────
const BookModal = ({slot, onClose}) => {
  const [form, setForm] = useState({title:'', host:'Admin User', room:'za1', duration:'60', desc:''});
  const inp = k => ({
    value: form[k], onChange: e => setForm(f=>({...f,[k]:e.target.value})),
    style:{width:'100%',padding:'9px 13px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg-muted)',color:'var(--fg)',fontSize:13,fontFamily:'var(--font-sans)',outline:'none'},
    onFocus: e=>e.target.style.borderColor='var(--primary)',
    onBlur:  e=>e.target.style.borderColor='var(--border)',
  });
  return (
    <div style={{position:'fixed',inset:0,zIndex:200,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{position:'absolute',inset:0,background:'rgba(0,0,0,0.35)',backdropFilter:'blur(4px)'}} onClick={onClose}/>
      <div style={{position:'relative',background:'var(--bg-card)',borderRadius:20,width:440,boxShadow:'var(--shadow-xl)',border:'1px solid var(--border)',animation:'fadeInUp 0.3s cubic-bezier(0.34,1.56,0.64,1) both',overflow:'hidden'}}>
        <div style={{padding:'18px 22px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',background:'var(--primary)',color:'#fff'}}>
          <div>
            <h3 style={{fontWeight:800,fontSize:15}}>📅 Book Meeting</h3>
            <p style={{fontSize:12,opacity:0.8,marginTop:2}}>{slot?.dayLabel} · {slot?.time}</p>
          </div>
          <button onClick={onClose} style={{padding:6,borderRadius:8,background:'rgba(255,255,255,0.15)',border:'none',cursor:'pointer',color:'#fff'}}><IcX size={16}/></button>
        </div>
        <div style={{padding:'18px 22px',display:'flex',flexDirection:'column',gap:13}}>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'var(--fg-muted)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>Judul Meeting *</label>
            <input {...inp('title')} placeholder="e.g. Sprint Review, 1:1 Meeting…"/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:'var(--fg-muted)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>Ruangan</label>
              <select value={form.room} onChange={e=>setForm(f=>({...f,room:e.target.value}))} style={{width:'100%',padding:'9px 13px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg-muted)',color:'var(--fg)',fontSize:13,fontFamily:'var(--font-sans)',outline:'none',cursor:'pointer'}}>
                {ZOOM_ACCOUNTS.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{fontSize:11,fontWeight:700,color:'var(--fg-muted)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>Durasi</label>
              <select value={form.duration} onChange={e=>setForm(f=>({...f,duration:e.target.value}))} style={{width:'100%',padding:'9px 13px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg-muted)',color:'var(--fg)',fontSize:13,fontFamily:'var(--font-sans)',outline:'none',cursor:'pointer'}}>
                {['30','60','90','120'].map(d=><option key={d} value={d}>{d} menit</option>)}
              </select>
            </div>
          </div>
          <div>
            <label style={{fontSize:11,fontWeight:700,color:'var(--fg-muted)',display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:'0.05em'}}>Deskripsi (opsional)</label>
            <textarea {...inp('desc')} placeholder="Agenda atau deskripsi meeting…"
              style={{width:'100%',padding:'9px 13px',borderRadius:10,border:'1px solid var(--border)',background:'var(--bg-muted)',color:'var(--fg)',fontSize:13,fontFamily:'var(--font-sans)',outline:'none',resize:'none',height:70}}
              onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'}/>
          </div>
        </div>
        <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',gap:10,justifyContent:'flex-end',background:'var(--bg-muted)'}}>
          <button onClick={onClose} style={{padding:'9px 18px',borderRadius:10,background:'var(--bg-card)',border:'1px solid var(--border)',fontWeight:600,fontSize:13,color:'var(--fg)',cursor:'pointer'}}>Batal</button>
          <button onClick={onClose} style={{padding:'9px 22px',borderRadius:10,background:'var(--primary)',color:'#fff',border:'none',fontWeight:700,fontSize:13,cursor:'pointer',boxShadow:'0 4px 12px rgba(45,74,140,0.3)'}}>
            Book Meeting
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Zoom Calendar Page ─────────────────────────────────────────────────────────
const ZoomPage = () => {
  const [calView, setCalView] = useState('week');
  const [selAccount, setSelAccount] = useState('all');
  const [bookSlot, setBookSlot] = useState(null);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const scrollRef = useRef(null);

  // Scroll to 08:00 on mount
  useEffect(()=>{
    if(scrollRef.current) scrollRef.current.scrollTop = SLOT_H * 1; // show from 08:30
  },[]);

  const visibleBookings = useMemo(()=>(
    selAccount==='all' ? ZOOM_BOOKINGS : ZOOM_BOOKINGS.filter(b=>b.room===selAccount)
  ),[selAccount]);

  const myBookings = ZOOM_BOOKINGS.filter(b=>b.isMine);
  const totalSlots = SLOTS.length * 5; // 5 days
  const bookedCount = visibleBookings.length;

  const card = {background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,boxShadow:'var(--shadow-sm)'};

  const weekLabel = weekOffset === 0 ? 'Minggu Ini (21–25 Apr)' : weekOffset === 1 ? 'Minggu Depan (28 Apr–2 Mei)' : 'Minggu Lalu (14–18 Apr)';

  // Month view mini calendar
  const MonthView = () => {
    const days = Array.from({length:30},(_,i)=>i+1);
    const hasEvent = (d) => {
      const eventDays = {21:'mon',22:'tue',23:'wed',24:'thu',25:'fri'};
      const key = eventDays[d];
      return key ? ZOOM_BOOKINGS.filter(b=>b.day===key).length : 0;
    };
    return (
      <div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:8}}>
          {['M','S','R','K','J','S','M'].map((d,i)=>(
            <div key={i} style={{textAlign:'center',fontSize:11,fontWeight:700,color:'var(--fg-muted)',padding:'6px 0'}}>{d}</div>
          ))}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
          {/* First row offset: Apr 1 = Wed = col 3 */}
          {Array.from({length:2},(_,i)=><div key={`e${i}`}/>)}
          {days.map(d=>{
            const isToday = d===21;
            const cnt = hasEvent(d);
            return (
              <div key={d} onClick={()=>{ if(cnt>0) setCalView('week'); }}
                style={{aspectRatio:'1',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',borderRadius:8,cursor:cnt>0?'pointer':'default',
                  background:isToday?'var(--primary)':'transparent',
                  color:isToday?'#fff':'var(--fg)',transition:'all 0.15s'}}
                onMouseEnter={e=>{if(!isToday&&cnt>0)e.currentTarget.style.background='var(--bg-hover)';}}
                onMouseLeave={e=>{if(!isToday)e.currentTarget.style.background='transparent';}}>
                <span style={{fontSize:12,fontWeight:isToday?800:400,lineHeight:1}}>{d}</span>
                {cnt>0 && <div style={{display:'flex',gap:1.5,marginTop:2}}>
                  {Array.from({length:Math.min(cnt,3)},(_,i)=>(
                    <span key={i} style={{width:4,height:4,borderRadius:'50%',background:isToday?'rgba(255,255,255,0.7)':'var(--primary)'}}/>
                  ))}
                </div>}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16,animation:'fadeInUp 0.4s ease both',height:'calc(100vh - 128px)',minHeight:0}}>
      {/* Header */}
      <div style={{...card,padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',gap:12,flexWrap:'wrap',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{padding:10,borderRadius:12,background:'var(--primary-bg)',color:'var(--primary)'}}><IcVideo size={20}/></div>
          <div>
            <h2 style={{fontWeight:800,fontSize:18,color:'var(--fg)'}}>Zoom Calendar</h2>
            <p style={{fontSize:12,color:'var(--fg-muted)',marginTop:1}}>{weekLabel} · {bookedCount} meeting terjadwal</p>
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          {/* Week nav */}
          <div style={{display:'flex',alignItems:'center',gap:4,background:'var(--bg-muted)',borderRadius:10,padding:4,border:'1px solid var(--border)'}}>
            <button onClick={()=>setWeekOffset(o=>o-1)} style={{width:28,height:28,borderRadius:8,border:'none',background:'transparent',cursor:'pointer',color:'var(--fg-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <IcChevronLeft size={14}/>
            </button>
            <button onClick={()=>setWeekOffset(0)} style={{padding:'4px 10px',borderRadius:8,fontSize:12,fontWeight:weekOffset===0?700:500,border:'none',cursor:'pointer',background:weekOffset===0?'var(--bg-card)':'transparent',color:weekOffset===0?'var(--primary)':'var(--fg-muted)',transition:'all 0.15s',boxShadow:weekOffset===0?'var(--shadow-sm)':'none'}}>
              Hari ini
            </button>
            <button onClick={()=>setWeekOffset(o=>o+1)} style={{width:28,height:28,borderRadius:8,border:'none',background:'transparent',cursor:'pointer',color:'var(--fg-muted)',display:'flex',alignItems:'center',justifyContent:'center'}}
              onMouseEnter={e=>e.currentTarget.style.background='var(--bg-hover)'}
              onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
              <IcChevronRight size={14}/>
            </button>
          </div>
          {/* View switcher */}
          <div style={{display:'flex',background:'var(--bg-muted)',borderRadius:10,padding:4,border:'1px solid var(--border)',gap:2}}>
            {[['month','Bulan'],['week','Minggu'],['day','Hari'],['my','My Bookings']].map(([v,l])=>(
              <button key={v} onClick={()=>setCalView(v)} style={{padding:'5px 12px',borderRadius:8,fontSize:12,fontWeight:calView===v?700:500,border:'none',cursor:'pointer',background:calView===v?'var(--bg-card)':'transparent',color:calView===v?'var(--primary)':'var(--fg-muted)',boxShadow:calView===v?'var(--shadow-sm)':'none',transition:'all 0.15s',whiteSpace:'nowrap'}}>
                {l}
              </button>
            ))}
          </div>
          {/* Room filter */}
          <select value={selAccount} onChange={e=>setSelAccount(e.target.value)}
            style={{padding:'7px 12px',borderRadius:8,border:'1px solid var(--border)',background:'var(--bg-card)',color:'var(--fg)',fontSize:13,fontFamily:'var(--font-sans)',outline:'none',cursor:'pointer'}}>
            <option value="all">Semua Ruangan</option>
            {ZOOM_ACCOUNTS.map(a=><option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </select>
          <button style={{padding:'8px 16px',borderRadius:10,background:'var(--primary)',color:'#fff',border:'none',fontWeight:700,fontSize:13,cursor:'pointer',display:'flex',alignItems:'center',gap:6,boxShadow:'0 4px 12px rgba(45,74,140,0.25)'}}>
            <IcPlus size={14}/> Book Meeting
          </button>
        </div>
      </div>

      {/* Main content */}
      <div style={{flex:1,display:'flex',gap:14,minHeight:0}}>

        {/* Calendar grid (week/day view) */}
        {(calView==='week'||calView==='day') && (
          <div style={{...card,flex:1,overflow:'hidden',display:'flex',flexDirection:'column',minHeight:0}}>
            {/* Day headers */}
            <div style={{display:'flex',borderBottom:'2px solid var(--border)',background:'var(--bg-muted)',flexShrink:0}}>
              <div style={{width:52,flexShrink:0}}/> {/* time gutter */}
              {WEEK_DAYS.map(day=>{
                const isToday = day.key==='mon' && weekOffset===0;
                const cnt = visibleBookings.filter(b=>b.day===day.key).length;
                return (
                  <div key={day.key} style={{flex:1,padding:'10px 8px',textAlign:'center',borderLeft:'1px solid var(--border)'}}>
                    <div style={{fontSize:11,fontWeight:600,color:'var(--fg-muted)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{day.label}</div>
                    <div style={{width:32,height:32,borderRadius:'50%',margin:'4px auto 0',display:'flex',alignItems:'center',justifyContent:'center',background:isToday?'var(--primary)':'transparent',color:isToday?'#fff':'var(--fg)',fontWeight:isToday?800:700,fontSize:14}}>
                      {day.date}
                    </div>
                    {cnt>0 && <div style={{fontSize:10,color:isToday?'var(--primary)':'var(--fg-subtle)',marginTop:2,fontWeight:600}}>{cnt} meeting</div>}
                  </div>
                );
              })}
            </div>

            {/* Scrollable time grid */}
            <div ref={scrollRef} style={{flex:1,overflowY:'auto',position:'relative'}}>
              {/* Time slots */}
              <div style={{display:'flex',minHeight: SLOTS.length * SLOT_H}}>
                {/* Time labels */}
                <div style={{width:52,flexShrink:0,position:'sticky',left:0,zIndex:2}}>
                  {SLOTS.map((t,i)=>(
                    <div key={t} style={{height:SLOT_H,display:'flex',alignItems:'flex-start',justifyContent:'flex-end',paddingRight:8,paddingTop:4}}>
                      {t.endsWith('00') && <span style={{fontSize:10,fontWeight:600,color:'var(--fg-subtle)',whiteSpace:'nowrap'}}>{t}</span>}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {WEEK_DAYS.map(day => {
                  const dayBkgs = visibleBookings.filter(b=>b.day===day.key);
                  const isToday = day.key==='mon' && weekOffset===0;
                  return (
                    <div key={day.key} style={{flex:1,borderLeft:'1px solid var(--border)',position:'relative'}}>
                      {/* Slot hover zones */}
                      {SLOTS.map((t,i)=>{
                        const hk = `${day.key}-${t}`;
                        const isHovered = hoveredSlot===hk;
                        return (
                          <div key={t} style={{height:SLOT_H,borderTop: t.endsWith('00')?'1px solid var(--border)':'1px dashed rgba(0,0,0,0.04)',cursor:'pointer',transition:'background 0.1s',background:isHovered?'var(--primary-bg)':'transparent',position:'relative'}}
                            onMouseEnter={()=>setHoveredSlot(hk)}
                            onMouseLeave={()=>setHoveredSlot(null)}
                            onClick={()=>setBookSlot({day:day.key,time:t,dayLabel:day.full})}>
                            {isHovered && (
                              <div style={{position:'absolute',inset:1,borderRadius:6,background:'var(--primary-bg)',border:'1px dashed var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1}}>
                                <span style={{fontSize:11,fontWeight:700,color:'var(--primary)',display:'flex',alignItems:'center',gap:4}}><IcPlus size={12}/>Book {t}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {/* Current time indicator */}
                      {isToday && (
                        <div style={{position:'absolute',left:0,right:0,top: toY('09:30'), zIndex:5,pointerEvents:'none'}}>
                          <div style={{height:2,background:'var(--error)',position:'relative'}}>
                            <div style={{position:'absolute',left:-5,top:-4,width:10,height:10,borderRadius:'50%',background:'var(--error)'}}/>
                          </div>
                        </div>
                      )}

                      {/* Bookings */}
                      {dayBkgs.map(b=>{
                        const col = BOOKING_COLORS[b.color]||BOOKING_COLORS.primary;
                        const top = toY(b.start);
                        const height = Math.max(toH(b.start,b.end)-4, 20);
                        return (
                          <div key={b.id}
                            style={{position:'absolute',left:3,right:3,top:top+2,height,
                              background:col.bg, border:`1.5px solid ${col.border}`,
                              borderRadius:8, padding:'4px 8px', zIndex:3, cursor:'pointer',
                              overflow:'hidden', transition:'all 0.15s',
                              boxShadow:b.isMine?`0 2px 8px ${col.border}40`:'none',
                              outline:b.isMine?`2px solid ${col.border}60`:'none',
                            }}
                            onMouseEnter={e=>{e.currentTarget.style.transform='scaleX(1.01)';e.currentTarget.style.zIndex='10';e.currentTarget.style.boxShadow=`0 4px 16px ${col.border}40`;}}
                            onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.zIndex='3';e.currentTarget.style.boxShadow=b.isMine?`0 2px 8px ${col.border}40`:'none';}}>
                            <div style={{fontWeight:700,fontSize:11,color:col.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',lineHeight:1.3}}>{b.title}</div>
                            {height > 34 && <div style={{fontSize:10,color:col.text,opacity:0.75,marginTop:1}}>{b.start}–{b.end}</div>}
                            {height > 50 && <div style={{fontSize:10,color:col.text,opacity:0.65,marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.host}</div>}
                            {b.isMine && <div style={{position:'absolute',top:4,right:6,width:6,height:6,borderRadius:'50%',background:col.border}}/>}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Month view */}
        {calView==='month' && (
          <div style={{...card,flex:1,padding:'20px',overflow:'auto'}}>
            <MonthView/>
          </div>
        )}

        {/* My bookings view */}
        {calView==='my' && (
          <div style={{...card,flex:1,overflow:'auto',padding:'20px'}}>
            <h3 style={{fontWeight:700,fontSize:15,color:'var(--fg)',marginBottom:16}}>My Bookings</h3>
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {myBookings.map(b=>{
                const col = BOOKING_COLORS[b.color]||BOOKING_COLORS.primary;
                const day = WEEK_DAYS.find(d=>d.key===b.day);
                return (
                  <div key={b.id} style={{padding:'14px 16px',borderRadius:12,background:col.bg,border:`1px solid ${col.border}20`,display:'flex',alignItems:'center',gap:14,cursor:'pointer',transition:'all 0.15s'}}
                    onMouseEnter={e=>{e.currentTarget.style.transform='translateX(3px)';}}
                    onMouseLeave={e=>{e.currentTarget.style.transform='';}}>
                    <div style={{width:44,height:44,borderRadius:10,background:col.border+'20',display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <span style={{fontSize:10,fontWeight:700,color:col.text,textTransform:'uppercase'}}>{day?.label}</span>
                      <span style={{fontSize:16,fontWeight:800,color:col.text}}>{day?.date}</span>
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:14,color:'var(--fg)'}}>{b.title}</div>
                      <div style={{fontSize:12,color:'var(--fg-muted)',marginTop:2}}>
                        {b.start} – {b.end} · {ZOOM_ACCOUNTS.find(a=>a.id===b.room)?.name}
                      </div>
                    </div>
                    <span style={{padding:'3px 10px',borderRadius:99,fontSize:11,fontWeight:700,background:col.border+'20',color:col.text}}>Organizer</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Right panel: upcoming + rooms */}
        <div style={{width:220,display:'flex',flexDirection:'column',gap:12,flexShrink:0}}>
          {/* Mini calendar (month) - always visible */}
          <div style={{...card,padding:'14px'}}>
            <div style={{fontWeight:700,fontSize:12,color:'var(--fg)',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
              <IcCalendar size={13} style={{color:'var(--primary)'}}/>
              April 2026
            </div>
            <MonthView/>
          </div>

          {/* Rooms */}
          <div style={{...card,padding:'14px'}}>
            <div style={{fontWeight:700,fontSize:12,color:'var(--fg)',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
              <IcVideo size={13} style={{color:'var(--primary)'}}/>
              Ruangan
            </div>
            {ZOOM_ACCOUNTS.map(a=>{
              const cnt = ZOOM_BOOKINGS.filter(b=>b.room===a.id).length;
              const pct = Math.round(cnt/ZOOM_BOOKINGS.length*100);
              return (
                <div key={a.id} style={{marginBottom:8,cursor:'pointer'}} onClick={()=>setSelAccount(selAccount===a.id?'all':a.id)}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:12,fontWeight:600,color:'var(--fg)'}}>{a.icon} {a.name}</span>
                    <span style={{fontSize:11,color:'var(--fg-subtle)'}}>{cnt}</span>
                  </div>
                  <div style={{height:5,background:'var(--bg-muted)',borderRadius:99}}>
                    <div style={{height:'100%',width:`${pct}%`,background:'var(--primary)',borderRadius:99,transition:'width 0.5s ease'}}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upcoming today */}
          <div style={{...card,padding:'14px',flex:1}}>
            <div style={{fontWeight:700,fontSize:12,color:'var(--fg)',marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
              <IcClock size={13} style={{color:'var(--primary)'}}/>
              Hari Ini
              <span style={{marginLeft:'auto',fontSize:10,color:'var(--fg-subtle)'}}>{ZOOM_BOOKINGS.filter(b=>b.day==='mon').length} meeting</span>
            </div>
            <div style={{display:'flex',flexDirection:'column',gap:7}}>
              {ZOOM_BOOKINGS.filter(b=>b.day==='mon').map(b=>{
                const col = BOOKING_COLORS[b.color]||BOOKING_COLORS.primary;
                return (
                  <div key={b.id} style={{padding:'8px 10px',borderRadius:9,background:col.bg,border:`1px solid ${col.border}25`,cursor:'pointer',transition:'all 0.15s'}}
                    onMouseEnter={e=>e.currentTarget.style.transform='translateX(2px)'}
                    onMouseLeave={e=>e.currentTarget.style.transform=''}>
                    <div style={{fontWeight:700,fontSize:11,color:col.text,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.title}</div>
                    <div style={{fontSize:10,color:col.text,opacity:0.7,marginTop:1}}>{b.start}–{b.end}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {bookSlot && <BookModal slot={bookSlot} onClose={()=>setBookSlot(null)}/>}
    </div>
  );
};

Object.assign(window, {ZoomPage});
