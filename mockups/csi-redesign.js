/* =========================================================
   Icons (garis, tanpa emoji)
   ========================================================= */
const IC={
  star:'<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  chevL:'<path d="m15 18-6-6 6-6"/>', chevR:'<path d="m9 18 6-6-6-6"/>',
  arrowR:'<path d="M5 12h14M13 6l6 6-6 6"/>', arrowL:'<path d="M19 12H5M11 18l-6-6 6-6"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  cloud:'<path d="M17.5 19H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 12a4 4 0 0 1-3.5 7z"/><path d="m9.5 14 2 2 3.5-3.5"/>',
  image:'<rect x="3" y="5" width="18" height="14" rx="3"/><circle cx="9" cy="11" r="2"/><path d="m21 16-5-5-8 8"/>',
  search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>',
  matrix:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="m14 17.5 2 2 4-4"/>',
  copy:'<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  swap:'<path d="M7 7h13l-4-4M17 17H4l4 4"/>',
  bolt:'<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  eraser:'<path d="m7 21-4-4 10-10 8 8-6 6z"/><path d="M22 21H7"/>',
  chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  download:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
  file:'<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
  userCheck:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.3-5.5 6.5-5.5s5.9 2.1 6.5 5.5M16 11l2 2 4-4"/>',
  bell:'<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  layout:'<rect x="3" y="3" width="8" height="8" rx="2"/><rect x="13" y="3" width="8" height="5" rx="2"/><rect x="13" y="10" width="8" height="11" rx="2"/><rect x="3" y="13" width="8" height="8" rx="2"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/>',
  upload:'<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
  x:'<path d="M18 6 6 18M6 6l12 12"/>',
  pen:'<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  trendUp:'<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  alert:'<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
};
const ic=n=>`<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${IC[n]}</svg>`;
const hydrate=root=>root.querySelectorAll('i[data-ic]').forEach(e=>{e.outerHTML=ic(e.dataset.ic)});
const STAR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>';
const fmt=(v,d=1)=>v.toFixed(d).replace('.',',');
const ini=n=>n.replace(/[^A-Za-z ]/g,'').trim().split(/\s+/).map(w=>w[0]).join('').slice(0,2).toUpperCase();
const scoreTone=v=>v>=4.5?'t-green':v>=4?'t-amber':'t-red';
const toneVar=t=>`var(--${t.slice(2)})`;
const $=id=>document.getElementById(id);

/* =========================================================
   Data dummy
   ========================================================= */
const SITES={
  SPJ:{name:'Sepanjang',tone:'t-teal',c:'hsl(178 81% 31%)'},
  KRW:{name:'Karawang',tone:'t-brown',c:'hsl(25 48% 44%)'},
  SMG:{name:'Semarang',tone:'t-green',c:'hsl(135 58% 38%)'},
  JKT:{name:'Marketing Office',tone:'t-sky',c:'#1A8FE0'},
};
const siteTag=s=>`<span class="code-tag ${SITES[s].tone}">${s}</span>`;
const QS=[
  {s:'Kecepatan respon',t:'Seberapa cepat tim/orang ini merespon permintaan Anda?',type:'star',tone:'t-sky',req:1},
  {s:'Komunikasi',t:'Bagaimana Anda menilai kemampuan komunikasinya?',type:'star',tone:'t-teal',req:1},
  {s:'Penjelasan',t:'Jika Anda meminta penjelasan, seberapa jelas penjelasan yang diberikan?',type:'scale',tone:'t-brown',opts:['Tidak jelas','Kurang jelas','Cukup','Jelas','Sangat jelas']},
  {s:'Keseluruhan',t:'Penilaian Anda terhadap kualitas pelayanan secara keseluruhan',type:'star',tone:'t-amber',req:1},
];
const SCALE_TONE=['t-red','t-red','t-amber','t-green','t-green'];
const portrait=(bg1,bg2,skin,shirt)=>`url('data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${bg1}'/><stop offset='1' stop-color='${bg2}'/></linearGradient></defs><rect width='400' height='500' fill='url(#g)'/><circle cx='330' cy='70' r='130' fill='white' opacity='.1'/><circle cx='200' cy='200' r='78' fill='${skin}'/><path d='M120 170c0-55 40-88 80-88s80 33 80 88c-20-30-50-38-80-38s-60 8-80 38z' fill='#1d1d28'/><path d='M60 500c10-120 70-180 140-180s130 60 140 180z' fill='${shirt}'/><path d='M172 322l28 38 28-38' fill='white' opacity='.9'/></svg>`).replace(/'/g,'%27')}')`;
const PAL=[['#0f6b6a','#5cc8b9','#e5b48e','#16324f'],['#8a4b12','#f2b35b','#d9a77f','#3b2a1a'],['#2D4A8C','#7aa6e8','#e9c3a0','#1f2a44'],['#1f7a3a','#8fd19e','#c99470','#21402a'],['#6b4a2b','#c9a27a','#f0c8a8','#2d2d2d'],['#0b6bb8','#8fd0ff','#d4a07a','#0f2b45'],['#a1520f','#f6c177','#e6b896','#5a2e0b'],['#3f5f5d','#a9cfc9','#d8a785','#203533']];
let pi=0;const nextPortrait=()=>{const p=PAL[pi++%PAL.length];return portrait(...p)};
const TEAM_PH={SPJ:"url('../login%20picture/sidoarjo%20plant.png')",KRW:"url('../login%20picture/karawang%20plant.png')"};
const mk=(id,name,role,site,kind,tag)=>({id,name,role,site,kind,tag,ph:kind==='Tim'?TEAM_PH[site]:nextPortrait(),c:SITES[site].c});
const SUBJECTS=[
  mk('t_spj','ICT — Tim Sepanjang','Operational Support','SPJ','Tim','Satu tim, satu tujuan: kerja Anda tidak terhambat.'),
  mk('rm','RM BAGASTYO ANGGORO INDRASTOTO','Operational Support','SPJ','Individu','Sistem aman, data Anda tenang.'),
  mk('yudi','YUDI ARTA TRIRENSILA','Network Support','SPJ','Individu','Jaringan lancar, kerja pun tenang.'),
  mk('yoh','YOHANES OCTAVIAN RIZKY NUGROHO','Operational Support','SPJ','Individu',''),
  mk('alp','ALPHIN SANTOSO HERMANTHAN, S.T.','Infrastructure','SPJ','Individu','Server sehat, layanan tak tersendat.'),
  mk('dim','DIMAS PRAKOSO','Helpdesk','SPJ','Individu','Satu tiket, satu senyuman.'),
  mk('nur','NURUL HIDAYAH','Application Support','SPJ','Individu','Aplikasi lancar, laporan tepat waktu.'),
  mk('arf','ARIF RAHMAN HAKIM','Hardware Technician','SPJ','Individu',''),
  mk('t_krw','ICT — Tim Karawang','Operational Support','KRW','Tim','Siap membantu dari lantai produksi hingga kantor.'),
  mk('beny','BENY SAPUTRA, S.KOM','Operational Support','KRW','Individu','Masalah kecil, solusi cepat.'),
  mk('gil','GILANG RAMADHAN','Network Support','KRW','Individu',''),
];
const EXTRA=['FAJAR SETIAWAN','MELATI PUTRI ANGGRAINI','HENDRA WIJAYA KUSUMA','LUKMAN HAKIM','SITI AMINAH','ANDIKA PRATAMA','RIZKY MAULANA'].map((n,i)=>mk('x'+i,n,'Operational Support','SPJ','Individu',''));
const S=Object.fromEntries([...SUBJECTS,...EXTRA].map(s=>[s.id,s]));
const shortNm=s=>s.kind==='Tim'?'Tim '+SITES[s.site].name:s.name;
const avatar=(s,size)=>`<span class="av" style="${size?`width:${size}px;height:${size}px;`:''}background-image:${s.ph};background-color:${s.c}"></span>`;
const personAv=(name,i)=>`<span class="av" style="background:hsl(${i*47%360} 38% 46%)">${ini(name)}</span>`;

/* =========================================================
   Nav & helpers
   ========================================================= */
hydrate(document);
const nav=$('mkNav');
nav.onclick=e=>{const b=e.target.closest('button');if(!b)return;
  nav.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));
  document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('on',s.id===b.dataset.s));
  closeDrawer();closePop();scrollTo({top:0});if(b.dataset.s==='rsp')updRail()};
const segBind=(id,fn)=>{const s=$(id);s.onclick=e=>{const b=e.target.closest('button');if(!b)return;s.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));fn(b.dataset)}};
function openDrawer(html){const d=$('drawer');d.innerHTML=html;hydrate(d);d.classList.add('on');$('scrim').classList.add('on');d.querySelectorAll('[data-close]').forEach(b=>b.onclick=closeDrawer)}
function closeDrawer(){$('drawer').classList.remove('on');$('scrim').classList.remove('on')}
$('scrim').onclick=closeDrawer;
addEventListener('keydown',e=>{if(e.key==='Escape'){closeDrawer();closePop()}});

/* =========================================================
   1. Responden
   ========================================================= */
const LABELS=['','Sangat kurang','Kurang','Cukup','Puas','Luar biasa!'];
const LCOL=['','var(--red-ink)','var(--red-ink)','var(--amber-ink)','var(--green-ink)','var(--green-ink)'];
const EMO=['','😞','😕','😐','😊','🤩'];
const TINT=['','hsl(4 86% 58%/.14)','hsl(15 90% 55%/.14)','hsl(40 95% 55%/.2)','hsl(135 58% 44%/.15)','hsl(45 100% 55%/.24)'];
const SPJ_ALL=[...SUBJECTS.filter(s=>s.site==='SPJ'),...EXTRA];
let ORDER=SPJ_ALL.slice(0,8).map(s=>s.id),cur=0;const ans={};
const answered=k=>ans[k]?Object.keys(ans[k]).length:0;
const isDone=k=>answered(k)>=QS.length;

function renderRail(){
  const doneN=ORDER.filter(isDone).length;
  $('railTitle').textContent=`Subjek ${cur+1} dari ${ORDER.length}`;
  $('railSub').textContent=`· ${doneN} selesai`;
  $('progDone').style.width=doneN/ORDER.length*100+'%';
  $('progCur').style.width=(isDone(ORDER[cur])?0:answered(ORDER[cur])/QS.length/ORDER.length*100)+'%';
  $('allCnt').textContent=ORDER.length;
  $('rail').innerHTML=ORDER.map((k,i)=>{const s=S[k],got=answered(k),done=isDone(k);
    const sep=i>0&&S[ORDER[i-1]].kind==='Tim'&&s.kind!=='Tim'?'<span class="rail-sep" aria-hidden="true"></span>':'';
    return sep+`<button class="ri ${SITES[s.site].tone} ${i===cur?'on':''} ${done?'done':''}" data-i="${i}" title="${i+1}. ${shortNm(s)}" aria-label="${i+1}. ${s.name}${done?', selesai':''}">
      <span class="ri-av" style="--p:${got/QS.length}">${avatar(s)}<span class="ri-badge">${done?ic('check'):i+1}</span></span>
      <span class="ri-tx"><span class="ri-nm">${shortNm(s)}</span><span class="ri-st">${done?'Selesai':got?`${got}/${QS.length} dijawab`:s.kind}</span></span></button>`}).join('');
  $('rail').querySelectorAll('.ri').forEach(b=>b.onclick=()=>go(+b.dataset.i));
  requestAnimationFrame(()=>{const r=$('rail'),on=r.querySelector('.ri.on');if(on)r.scrollLeft=on.offsetLeft-r.clientWidth/2+on.offsetWidth/2;updRail()});
  renderPop();
}
function updRail(){const r=$('rail');$('railWrap').classList.toggle('ovf',r.scrollWidth>r.clientWidth+2);
  $('railPrev').disabled=r.scrollLeft<4;$('railNext').disabled=r.scrollLeft+r.clientWidth>=r.scrollWidth-4}
$('rail').addEventListener('scroll',updRail,{passive:true});addEventListener('resize',updRail);
$('railPrev').onclick=()=>{$('rail').scrollLeft-=$('rail').clientWidth*.7};
$('railNext').onclick=()=>{$('rail').scrollLeft+=$('rail').clientWidth*.7};
function renderPop(){const doneN=ORDER.filter(isDone).length;
  $('allPop').innerHTML=`<div class="row"><b>Semua subjek</b><span class="small muted">${doneN} dari ${ORDER.length} selesai</span><button class="btn subtle sm" style="margin-left:auto" onclick="closePop()" aria-label="Tutup">${ic('x')}</button></div>
  <div class="pop-grid">${ORDER.map((k,i)=>{const s=S[k],got=answered(k),done=isDone(k);
    return `<button class="pop-it ${SITES[s.site].tone} ${i===cur?'on':''}" onclick="go(${i});closePop()">${avatar(s)}<span style="min-width:0;flex:1"><span class="nm">${i+1}. ${shortNm(s)}</span><br><span class="small muted">${s.kind}</span></span>${done?`<span class="pill t-green">${ic('check')}Selesai</span>`:got?`<span class="pill t-amber">${got}/${QS.length}</span>`:`<span class="pill">Belum</span>`}</button>`}).join('')}</div>`}
$('allBtn').onclick=e=>{e.stopPropagation();$('allPop').classList.toggle('on')};
function closePop(){$('allPop').classList.remove('on')}
document.addEventListener('click',e=>{if(!e.target.closest('#allPop,#allBtn'))closePop()});

function questionHtml(q,qi,v){
  const body=q.type==='star'
    ?`<div class="stars" data-q="${qi}">${[1,2,3,4,5].map(n=>`<button class="star ${v>=n?'on':''}" data-n="${n}" aria-label="${n} bintang">${STAR}</button>`).join('')}<span class="react"><span class="emo ${v?'set':'empty'}" style="background:${v?TINT[v]:''}">${v?EMO[v]:''}</span><span class="rate-lbl" style="color:${LCOL[v]||'var(--muted)'}"><span>${v?LABELS[v]:'Pilih bintang'}</span></span></span></div>`
    :`<div class="scale" data-q="${qi}">${q.opts.map((o,oi)=>`<button class="${SCALE_TONE[oi]} ${v===oi+1?'on':''}" data-n="${oi+1}">${o}</button>`).join('')}</div>`;
  return `<div class="q ${q.tone}" ${v?`data-v="${v}"`:''}><div class="q-short"><span class="dot"></span>${q.s}${q.req?'<span class="q-req" title="Wajib">*</span>':''}</div><div class="q-title">${q.t}</div>${body}</div>`;
}
function renderStep(){
  const k=ORDER[cur],s=S[k];ans[k]=ans[k]||{};
  const p=$('photo');p.classList.remove('enter');void p.offsetWidth;p.classList.add('enter');p.style.backgroundImage=s.ph;
  $('photoCount').textContent=`${cur+1} / ${ORDER.length}`;
  $('caption').innerHTML=`<div class="kind ${SITES[s.site].tone}">${ic(s.kind==='Tim'?'users':'user')}${s.kind==='Tim'?'Penilaian tim':'Penilaian individu'} · ${s.site}</div><div class="name">${s.name}</div><div class="role">${s.role}</div>${s.tag?`<div class="tag">“${s.tag}”</div>`:''}`;
  const last=cur===ORDER.length-1,next=last?null:S[ORDER[cur+1]];
  $('formCol').innerHTML=QS.map((q,qi)=>questionHtml(q,qi,ans[k][qi])).join('')
    +`<div><div class="q-short t-neutral" style="margin-bottom:6px">Komentar (opsional)</div><textarea class="cm" placeholder="Apa yang paling membantu, atau bisa ditingkatkan?"></textarea></div>
    <div class="nav-btns"><button class="btn" ${cur===0?'disabled':''} onclick="go(${cur-1})">${ic('arrowL')}Sebelumnya</button><span class="hint" id="hint"></span>
    <button class="cta" onclick="${last?'submitSurvey()':`go(${cur+1})`}">${last?'Kirim penilaian':`Lanjut<span class="nx">· ${shortNm(next)}</span>`}${ic(last?'check':'arrowR')}</button></div>`;
  renderRail();bindQ(k);updHint(k);
}
function updHint(k){const miss=QS.filter((q,i)=>q.req&&!ans[k][i]).length;$('hint').textContent=miss?`${miss} pertanyaan wajib belum dijawab`:''}
function bindStars(s,k){
  const qi=+s.dataset.q,stars=[...s.querySelectorAll('.star')],lbl=s.querySelector('.rate-lbl'),emo=s.querySelector('.emo');let shown=ans[k][qi]||0;
  const paint=n=>{stars.forEach((st,i)=>st.classList.toggle('hot',i<n));const v=n||ans[k][qi]||0;
    lbl.innerHTML=`<span>${v?LABELS[v]:'Pilih bintang'}</span>`;lbl.style.color=LCOL[v]||'var(--muted)';
    const changed=v!==shown;if(changed){emo.textContent=v?EMO[v]:'';emo.style.background=v?TINT[v]:'';shown=v}
    emo.className='emo '+(v?(n&&n!==ans[k][qi]?'preview':'set'):'empty');if(changed&&v){void emo.offsetWidth;emo.classList.add('bounce')}};
  stars.forEach(st=>{st.onmouseenter=()=>paint(+st.dataset.n);
    st.onclick=()=>{const n=+st.dataset.n;ans[k][qi]=n;
      stars.forEach((x,i)=>{x.classList.toggle('on',i<n);x.classList.remove('popping');if(i<n){x.style.animationDelay=i*40+'ms';void x.offsetWidth;x.classList.add('popping')}});
      const r=document.createElement('span');r.className='rip';st.appendChild(r);setTimeout(()=>r.remove(),600);
      s.closest('.q').dataset.v=n;shown=-1;paint(n);renderRail();updHint(k)}});
  s.onmouseleave=()=>{stars.forEach(x=>x.classList.remove('hot'));paint(0)};
}
function bindQ(k){
  $('formCol').querySelectorAll('.stars').forEach(s=>bindStars(s,k));
  $('formCol').querySelectorAll('.scale').forEach(s=>{const qi=+s.dataset.q;s.onclick=e=>{const b=e.target.closest('button');if(!b)return;ans[k][qi]=+b.dataset.n;s.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x===b));s.closest('.q').dataset.v=b.dataset.n;renderRail();updHint(k)}});
}
// Pindah subjek: kalau kartu sudah tergulir lewat, kembali ke awal kartu (rail tetap terlihat).
function go(i){if(i<0||i>=ORDER.length)return;cur=i;renderStep();const top=$('rspFrame').getBoundingClientRect().top;if(top<0)scrollTo({top:scrollY+top-64,behavior:'smooth'})}
function avgOf(k){const v=Object.entries(ans[k]||{}).filter(([i])=>QS[i].type==='star').map(([,x])=>x);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0}
function setSurveyVisible(on){$('rspCard').hidden=!on;$('railWrap').hidden=!on;$('doneScreen').hidden=on}
function submitSurvey(){setSurveyVisible(false);
  $('doneScreen').innerHTML=`<div class="done-ic"><svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg></div><h2 style="margin-top:14px">Terima kasih, Hasby!</h2><p class="muted" style="margin-top:6px">Penilaian Anda untuk ${ORDER.length} subjek sudah terkirim. Masukan Anda dibaca langsung oleh tim ICT.</p>
  <div class="done-list">${ORDER.map(k=>{const s=S[k],a=avgOf(k);return `<div class="done-it">${avatar(s)}<div style="min-width:0;flex:1"><div class="small" style="font-weight:650;line-height:1.25">${shortNm(s)}</div><div class="mini-stars">${[1,2,3,4,5].map(n=>`<span class="${n<=Math.round(a)?'':'off'}">${STAR}</span>`).join('')}</div></div></div>`}).join('')}</div>
  <button class="btn" style="margin-top:20px" onclick="resetSurvey()">Ulangi demo</button>`;
  $('progDone').style.width='100%';$('progCur').style.width='0';confetti()}
function resetSurvey(){for(const k in ans)delete ans[k];cur=0;setSurveyVisible(true);renderStep()}
function confetti(){const c=document.createElement('div');c.className='confetti';const cols=['#0f8f8a','#f2930d','#2fb350','#1A8FE0','#f5b301','#b0682f'];
  for(let i=0;i<90;i++){const p=document.createElement('i');p.style.left=Math.random()*100+'vw';p.style.background=cols[i%cols.length];p.style.animationDelay=Math.random()*.4+'s';p.style.animationDuration=1.2+Math.random()+'s';c.appendChild(p)}
  document.body.appendChild(c);setTimeout(()=>c.remove(),2600)}
segBind('devSeg',d=>{$('rspFrame').classList.toggle('mobile',d.d==='mob');setTimeout(renderRail,320)});
segBind('cntSeg',d=>{ORDER=SPJ_ALL.slice(0,+d.n).map(s=>s.id);resetSurvey()});
renderStep();

/* =========================================================
   2. Subjek & foto
   ========================================================= */
function subjCard(s){return `<button class="subj ${SITES[s.site].tone}" onclick="editSubj('${s.id}')"><div class="ph" style="background-image:${s.ph};background-color:${s.c}"><span class="pill kind ${s.kind==='Tim'?'t-amber':'t-neutral'}">${ic(s.kind==='Tim'?'users':'user')}${s.kind}</span><div class="up"><span class="row" style="gap:6px">${ic('camera')}Ganti foto &amp; tagline</span></div></div>
  <div class="bd"><span class="nm">${s.name}</span><span class="small muted">${s.role}</span>${s.tag?`<span class="tagline">“${s.tag}”</span>`:`<span class="tagline empty">${ic('pen')}Tambah tagline</span>`}</div></button>`}
function renderSubj(q=''){
  $('subjSites').innerHTML=['SPJ','KRW'].map(site=>{const all=SUBJECTS.filter(s=>s.site===site),list=all.filter(s=>s.name.toLowerCase().includes(q)),noTag=all.filter(s=>!s.tag).length;
    return `<section class="site-sec ${SITES[site].tone}"><div class="site-head"><span class="site-code">${site}</span><div style="flex:1;min-width:0"><b>ICT ${SITES[site].name}</b><div class="small muted">${all.length} subjek · 1 tim · ${all.length-1} individu</div></div>${noTag?`<span class="pill t-amber">${ic('alert')}${noTag} belum ada tagline</span>`:''}<button class="btn sm">${ic('plus')}Tambah subjek</button></div>
    <div class="subj-grid">${list.map(subjCard).join('')||'<div class="empty-state">Tidak ada yang cocok.</div>'}</div></section>`}).join('');
}
function editSubj(id){const s=S[id];
  openDrawer(`<div class="row"><div style="flex:1;min-width:0"><h2>Edit subjek</h2><div class="small muted">${s.kind} · ICT ${SITES[s.site].name}</div></div><button class="btn subtle" data-close aria-label="Tutup">${ic('x')}</button></div>
  <div class="preview" style="margin-top:14px"><div class="photo" style="background-image:${s.ph};background-color:${s.c}"></div><div class="caption"><div class="kind ${SITES[s.site].tone}">${ic(s.kind==='Tim'?'users':'user')}Pratinjau</div><div class="name">${s.name}</div><div class="role">${s.role}</div><div class="tag" id="pvTag" ${s.tag?'':'hidden'}>“${s.tag}”</div></div></div>
  <div class="dropzone" style="margin:12px 0 16px"><div>${ic('upload')}<div style="margin-top:6px"><b>Tarik foto ke sini</b> atau klik untuk pilih</div><div class="small">JPG/PNG ≤ 5 MB · potret 4:5, wajah di sepertiga atas</div></div></div>
  <div class="field"><label for="tgIn">Tagline / caption (tampil persis di bawah foto)</label><textarea id="tgIn" rows="2" maxlength="90">${s.tag}</textarea><div class="cnt"><span id="tgCnt">${s.tag.length}</span>/90</div></div>
  <div class="field"><label for="roleIn">Jabatan yang ditampilkan</label><input id="roleIn" value="${s.role}"></div>
  <label class="check"><input type="checkbox"> <span>Hanya untuk periode <b>CSI ICT Q4 2026</b> (master data tidak berubah)</span></label>
  <div class="row" style="justify-content:flex-end"><button class="btn" data-close>Batal</button><button class="btn primary" data-close>Simpan</button></div>`);
  const t=$('tgIn'),pv=$('pvTag');t.oninput=()=>{$('tgCnt').textContent=t.value.length;pv.hidden=!t.value;pv.textContent=`“${t.value}”`}}
$('subjSearch').oninput=e=>renderSubj(e.target.value.toLowerCase());
renderSubj();

/* =========================================================
   3. Matriks penilai
   ========================================================= */
const RATERS=[['Hasby','Finance','SPJ'],['Dewi Lestari','HRGA','SPJ'],['Agus Salim','Produksi','SPJ'],['Rina Marlina','Purchasing','SPJ'],['Tono Wibowo','Gudang','SPJ'],['Bagastyo (ICT)','ICT','SPJ'],
  ['Sari Puspita','Finance','KRW'],['Budi Hartono','Produksi','KRW'],['Lina Kartika','QC','KRW'],['Yoga Pratama','Marketing','KRW'],['Fajar Nugroho','Engineering','KRW']];
const MX_SITES=['SPJ','KRW'];
let MX={},mxF='all',mxQ='';
const isSelf=(ri,k)=>ri===5&&k==='rm';
const key=(ri,k)=>ri+'|'+k;
function mxAuto(){MX={};RATERS.forEach((r,ri)=>SUBJECTS.forEach(s=>{if(s.site===r[2]&&!isSelf(ri,s.id))MX[key(ri,s.id)]=1}));Object.assign(MX,{'0|beny':1,'6|yudi':1,'5|t_krw':1});renderMx()}
function mxClear(){MX={};renderMx()}
const toggleAll=ids=>{const all=ids.every(i=>MX[i]);ids.forEach(i=>{all?delete MX[i]:MX[i]=1});renderMx()};
const mxT=(ri,k)=>toggleAll([key(ri,k)]);
const mxRow=ri=>toggleAll(SUBJECTS.filter(s=>!isSelf(ri,s.id)).map(s=>key(ri,s.id)));
const mxCol=k=>toggleAll(RATERS.map((r,ri)=>ri).filter(ri=>!isSelf(ri,k)).map(ri=>key(ri,k)));
const mxSite=site=>toggleAll(RATERS.flatMap((r,ri)=>r[2]!==site?[]:SUBJECTS.filter(s=>s.site===site&&!isSelf(ri,s.id)).map(s=>key(ri,s.id))));
function mxHead(cols){
  return `<thead><tr class="h1"><th class="corner" rowspan="2">Penilai</th>${MX_SITES.map(site=>{const n=SUBJECTS.filter(s=>s.site===site).length;
      return `<th class="grp gstart ${SITES[site].tone}" colspan="${n}"><div class="grp-in"><span class="code-tag ${SITES[site].tone}">${site}</span><b>ICT ${SITES[site].name}</b><span class="small muted">${n} subjek</span><button class="mini-btn" onclick="mxSite('${site}')" title="Centang semua penilai ${site} untuk semua subjek ${site}">${ic('check')}Penilai ${site}</button></div></th>`}).join('')}<th rowspan="2">Jumlah</th></tr>
    <tr class="h2">${cols.map(({s,first})=>`<th class="subj-col ${SITES[s.site].tone} ${first?'gstart':''}" onclick="mxCol('${s.id}')" title="${s.name} — klik untuk satu kolom">${avatar(s)}<span class="nm">${s.kind==='Tim'?'Tim':s.name.split(/[ ,]/)[0]}</span></th>`).join('')}</tr></thead>`}
function mxRowHtml(r,ri,cols){let n=0;
  const cells=cols.map(({s,first})=>{const self=isSelf(ri,s.id),on=MX[key(ri,s.id)],cross=s.site!==r[2];if(on)n++;
    return `<td class="${cross?'cross':''} ${first?'gstart':''} ${SITES[s.site].tone}"><div class="cell ${self?'self':''} ${on?'on':''} ${on&&cross?'x':''}" ${self?'title="Tidak bisa menilai diri sendiri"':`onclick="mxT(${ri},'${s.id}')" role="checkbox" aria-checked="${!!on}" aria-label="${r[0]} menilai ${s.name}"`}>${self?'–':on?ic('check'):''}</div></td>`}).join('');
  return `<tr><th onclick="mxRow(${ri})" title="Klik untuk satu baris"><div class="row" style="gap:8px">${personAv(r[0],ri)}<div style="min-width:0"><div>${r[0]}</div><div class="small muted">${r[1]}</div></div></div></th>${cells}<td><b>${n}</b></td></tr>`}
function renderMx(){
  const cols=MX_SITES.flatMap(site=>SUBJECTS.filter(s=>s.site===site).map((s,i)=>({s,first:i===0})));
  const rows=RATERS.map((r,ri)=>({r,ri})).filter(({r})=>(mxF==='all'||r[2]===mxF)&&(r[0]+' '+r[1]).toLowerCase().includes(mxQ));
  const body=MX_SITES.filter(rs=>rows.some(x=>x.r[2]===rs)).map(rs=>{const grp=rows.filter(x=>x.r[2]===rs);
    return `<tr class="rgrp ${SITES[rs].tone}"><td colspan="${cols.length+2}"><div>${siteTag(rs)}Penilai dari ${SITES[rs].name} · ${grp.length} orang</div></td></tr>`+grp.map(({r,ri})=>mxRowHtml(r,ri,cols)).join('')}).join('');
  $('mxTable').innerHTML=mxHead(cols)+`<tbody>${body||`<tr><td colspan="${cols.length+2}" class="empty-state">Tidak ada penilai yang cocok.</td></tr>`}</tbody>`;
  const keys=Object.keys(MX);
  $('mxRaters').textContent=new Set(keys.map(x=>x.split('|')[0])).size;$('mxPairs').textContent=keys.length;
  $('mxCross').textContent=keys.filter(x=>{const[ri,k]=x.split('|');return S[k].site!==RATERS[ri][2]}).length;
  $('mxSubj').textContent=SUBJECTS.length;$('mxSubjSub').textContent=`${SUBJECTS.filter(s=>s.kind==='Tim').length} tim · ${SUBJECTS.filter(s=>s.kind!=='Tim').length} individu`;
}
segBind('mxSite',d=>{mxF=d.f;renderMx()});$('mxSearch').oninput=e=>{mxQ=e.target.value.toLowerCase();renderMx()};
mxAuto();

/* =========================================================
   4. Laporan
   ========================================================= */
// [q1..q4, jumlah penilai, sebaran 1★..5★]
const REP={t_spj:[4.6,5,4.9,5,12,[0,0,1,3,32]],rm:[4.9,5,5,5,5,[0,0,0,1,14]],yudi:[5,5,5,5,5,[0,0,0,0,15]],yoh:[3.9,4.6,4.5,4.7,5,[0,1,1,4,9]],alp:[4.7,4.8,4.6,4.9,4,[0,0,1,2,9]],
  dim:[4.4,4.7,4.8,4.6,6,[0,0,2,4,12]],nur:[4.8,4.9,4.9,4.9,4,[0,0,0,1,11]],arf:[3.6,4.1,3.9,4.0,4,[0,2,2,4,4]],t_krw:[4.5,4.8,4.7,4.85,9,[0,0,1,5,21]],beny:[4.5,4.8,4.7,4.85,5,[0,0,1,3,11]],gil:[4.2,4.4,4.3,4.5,5,[0,0,3,5,7]]};
const repRows=f=>SUBJECTS.filter(s=>f==='all'||s.site===f).map(s=>{const r=REP[s.id],q=r.slice(0,4);return {s,q,n:r[4],dist:r[5],avg:q.reduce((a,b)=>a+b,0)/4}}).sort((a,b)=>b.avg-a.avg);
const DCOL=['#f04438','#f97a4a','#f2c40d','#7cc98a','#2fb350'];
const heatBg=v=>v>=4.5?'hsl(135 58% 44%/.18)':v>=4?'hsl(45 95% 55%/.25)':'hsl(4 86% 58%/.18)';
const RESP={all:[5,11],SPJ:[3,6],KRW:[2,5]};
let repF='all';
function repHeroHtml(rows){
  const all=rows.reduce((a,r)=>a+r.avg,0)/rows.length,[got,resp]=RESP[repF],pct=Math.round(got/resp*100);
  const qAvg=QS.map(q=>q).map((q,i)=>({q,v:rows.reduce((a,r)=>a+r.q[i],0)/rows.length})).sort((a,b)=>b.v-a.v);
  const best=qAvg[0],low=qAvg[qAvg.length-1],t=scoreTone(all);
  return `<div class="panel score-panel"><div class="ring" style="--p:${all/5*100};--c:${toneVar(t)}"><div><div><b>${fmt(all,2)}</b><span class="small muted">dari 5</span></div></div></div><div style="min-width:0"><h3>Nilai keseluruhan</h3><span class="pill ${t}" style="margin-top:6px">${all>=4.5?'Sangat puas':all>=4?'Puas':'Perlu perbaikan'}</span><div class="small muted" style="margin-top:8px">Indeks ${fmt(all/5*100)}%</div><div class="small" style="color:var(--green-ink);margin-top:2px">${ic('trendUp')} naik 0,12 dari Q3</div></div></div>
  <div class="stat ${pct>=90?'t-green':'t-amber'}"><div class="top"><div class="num">${got}<span class="small muted"> / ${resp}</span></div><span class="bub">${ic('users')}</span></div><div class="lbl">Jawaban masuk</div><div class="small" style="color:var(--hi)">${pct}% dari penilai terpilih${pct>=90?' · target tercapai':''}</div></div>
  <div class="stat ${best.q.tone}"><div class="top"><div class="num" style="font-size:18px;color:var(--hi)">${best.q.s}</div><span class="bub">${ic('trendUp')}</span></div><div class="lbl">Paling kuat</div><div class="small muted">rata-rata ${fmt(best.v,2)}</div></div>
  <div class="stat t-amber attn"><div class="top"><div class="num" style="font-size:18px">${low.q.s}</div><span class="bub">${ic('alert')}</span></div><div class="lbl">Perlu perhatian</div><div class="small muted">rata-rata ${fmt(low.v,2)}</div></div>`}
function rankCard(r,i){const s=r.s,tot=r.dist.reduce((a,b)=>a+b,0),bi=r.q.indexOf(Math.max(...r.q)),li=r.q.indexOf(Math.min(...r.q));
  return `<button class="rcard" onclick="repDetail('${s.id}')"><div class="pic" style="background-image:${s.ph};background-color:${s.c}"><span class="medal ${i===0?'gold':''}">${i+1}</span></div>
  <div style="flex:1;min-width:0"><div class="row" style="gap:6px;align-items:flex-start"><span class="nm">${s.name}</span>${siteTag(s.site)}</div>
  <div class="small muted">${s.kind} · ${s.role} · ${r.n} penilai</div>
  <div class="row" style="gap:8px;margin:8px 0 6px"><span class="score-badge ${scoreTone(r.avg)}"><b>${fmt(r.avg,2)}</b><span class="small">/5</span></span><span class="small muted">indeks ${fmt(r.avg/5*100)}%</span></div>
  <div class="dist" title="Sebaran bintang">${r.dist.map((d,j)=>`<i style="width:${d/tot*100}%;background:${DCOL[j]}"></i>`).join('')}</div>
  <div class="row" style="gap:6px;margin-top:8px;flex-wrap:wrap"><span class="pill ${QS[bi].tone}">${ic('trendUp')}${QS[bi].s}</span>${r.q[li]<4.5?`<span class="pill t-amber">${ic('alert')}${QS[li].s}</span>`:''}</div></div></button>`}
function renderRep(){
  const rows=repRows(repF);
  $('repHero').innerHTML=repHeroHtml(rows);
  $('repCount').textContent=`· ${rows.length} subjek, urut dari nilai tertinggi`;
  $('repRank').innerHTML=rows.map(rankCard).join('');
  $('heatTbl').innerHTML=`<tr><th></th>${QS.map(q=>`<th title="${q.t}"><span class="row ${q.tone}" style="gap:6px"><span class="dot"></span>${q.s}</span></th>`).join('')}<th>Rata-rata</th></tr>`
    +rows.map(r=>`<tr><th style="color:var(--text)"><span class="row" style="gap:8px">${avatar(r.s,24)}${shortNm(r.s)} ${siteTag(r.s.site)}</span></th>${r.q.map(v=>`<td style="background:${heatBg(v)}">${fmt(v)}</td>`).join('')}<td style="background:${heatBg(r.avg)}">${fmt(r.avg,2)}</td></tr>`).join('');
}
function repDetail(id){const r=repRows('all').find(x=>x.s.id===id),s=r.s,mx=Math.max(...r.dist),t=scoreTone(r.avg);
  openDrawer(`<div class="row"><div style="flex:1;min-width:0"><h2>${s.name}</h2><div class="small muted">${s.kind} · ${s.role} · ${SITES[s.site].name}</div></div><button class="btn subtle" data-close aria-label="Tutup">${ic('x')}</button></div>
  <div style="aspect-ratio:16/9;border-radius:16px;background:${s.ph} center 25%/cover;background-color:${s.c};margin:14px 0"></div>
  <div class="row"><div class="ring sm" style="--p:${r.avg/5*100};--c:${toneVar(t)}"><div><b>${fmt(r.avg)}</b></div></div><div><b>${r.n} penilai</b><div class="small muted">indeks ${fmt(r.avg/5*100)}%</div></div></div>
  <h3 style="margin:20px 0 10px">Per pertanyaan</h3><div class="qlist">${QS.map((q,j)=>`<div class="qrow ${q.tone}"><span class="lab" title="${q.t}"><span class="dot"></span><span>${q.s}</span></span><div class="track"><i style="width:${r.q[j]/5*100}%;animation-delay:${j*80}ms"></i></div><b style="text-align:right">${fmt(r.q[j])}</b></div>`).join('')}</div>
  <h3 style="margin:20px 0 10px">Sebaran bintang</h3><div class="qlist">${[5,4,3,2,1].map(n=>`<div class="qrow" style="grid-template-columns:72px 1fr 30px"><span class="mini-stars">${[1,2,3,4,5].map(x=>`<span class="${x<=n?'':'off'}">${STAR}</span>`).join('')}</span><div class="track"><i style="width:${r.dist[n-1]/mx*100}%;background:${DCOL[n-1]}"></i></div><b style="text-align:right">${r.dist[n-1]}</b></div>`).join('')}</div>
  <h3 style="margin:20px 0 4px">Komentar (3)</h3><div class="cmt">"Respon cepat, ramah, masalah selesai di hari yang sama."<div class="small muted">Finance · 30 Okt</div></div><div class="cmt">"Terima kasih sudah sabar menjelaskan."<div class="small muted">HRGA · 29 Okt</div></div><div class="cmt">"Kadang sulit dihubungi saat jam istirahat."<div class="small muted">Produksi · 29 Okt</div></div>`)}
segBind('repSite',d=>{repF=d.f;renderRep()});
segBind('repTab',d=>{$('repRank').hidden=d.t!=='rank';$('repHeat').hidden=d.t!=='heat'});
renderRep();

/* =========================================================
   5. Status responden
   ========================================================= */
const WHEN=['30 Okt, 09.54','29 Okt, 14.10','','','','28 Okt, 10.15','30 Okt, 08.02','29 Okt, 16.40','','',''];
const PEOPLE=RATERS.map((r,i)=>({n:r[0],d:r[1],s:r[2],done:!!WHEN[i],at:WHEN[i],i}));
const TARGET=.9;
let stF='all',stS='all',stQ='';
function siteProg(site){const ps=PEOPLE.filter(p=>p.s===site),d=ps.filter(p=>p.done).length,t=Math.ceil(ps.length*TARGET);
  return `<div class="sp ${SITES[site].tone}"><div class="row" style="gap:8px">${siteTag(site)}<b style="flex:1">${SITES[site].name}</b><b>${d}/${ps.length}</b></div><div class="mini"><i style="width:${d/ps.length*100}%"></i></div><div class="small" style="margin-top:6px;color:${d>=t?'var(--green-ink)':'var(--muted)'}">${d>=t?'Target tercapai':`butuh ${t-d} lagi`}</div></div>`}
function renderStHero(){const done=PEOPLE.filter(p=>p.done).length,tot=PEOPLE.length,tgt=Math.ceil(tot*TARGET),pct=done/tot*100;
  $('stHero').innerHTML=`<div class="ring" style="--p:${pct};--c:var(--${pct>=90?'green':'amber'})"><div><div><b>${done}/${tot}</b><span class="small muted">sudah mengisi</span></div></div></div>
  <div><h3>${done>=tgt?'Target tercapai':`Butuh <span style="color:var(--amber-ink)">${tgt-done} jawaban lagi</span> untuk mencapai target 90%`}</h3>
  <div class="target-line" role="img" aria-label="${Math.round(pct)}% terisi, target 90%"><i style="width:${pct}%"></i><div class="tgt" style="left:90%"><span>Target 90% · ${tgt} orang</span></div></div>
  <div class="row small muted"><span>0</span><span style="margin-left:auto">${tot} penilai terpilih</span></div>
  <div class="site-prog">${MX_SITES.map(siteProg).join('')}</div></div>`}
function personRow(p){return `<div class="prow">${personAv(p.n,p.i)}<div style="min-width:0"><b>${p.n}</b><div class="small muted">${p.d}</div></div><span class="c-site">${siteTag(p.s)}</span>
  <span>${p.done?`<span class="pill t-green">${ic('check')}Sudah mengisi</span>`:`<span class="pill t-amber">${ic('clock')}Belum</span>`}</span>
  <span class="c-when small muted" style="text-align:right">${p.done?p.at:`<button class="btn sm" onclick="this.outerHTML='<span class=&quot;pill t-sky&quot;>Pengingat terkirim</span>'">${ic('bell')}Ingatkan</button>`}</span></div>`}
function renderPl(){
  const base=PEOPLE.filter(p=>(stS==='all'||p.s===stS)&&p.n.toLowerCase().includes(stQ));
  const c={all:base.length,todo:base.filter(p=>!p.done).length,done:base.filter(p=>p.done).length};
  $('stTab').innerHTML=[['all','Semua'],['todo','Belum'],['done','Sudah']].map(([k,l])=>`<button class="${stF===k?'on':''}" data-f="${k}">${l} <b>${c[k]}</b></button>`).join('');
  const list=base.filter(p=>stF==='all'||(stF==='done')===p.done).sort((a,b)=>a.done-b.done);
  $('plist').innerHTML=list.map(personRow).join('')||'<div class="empty-state">Tidak ada yang cocok.</div>';
}
$('stTab').onclick=e=>{const b=e.target.closest('button');if(!b)return;stF=b.dataset.f;renderPl()};
segBind('stSite',d=>{stS=d.f;renderPl()});$('stSearch').oninput=e=>{stQ=e.target.value.toLowerCase();renderPl()};
$('remindAll').onclick=()=>{const b=$('remindAll');b.innerHTML=ic('check')+'Pengingat terkirim ke '+PEOPLE.filter(p=>!p.done).length+' orang';b.disabled=true};
renderStHero();renderPl();

/* =========================================================
   6. Dashboard
   ========================================================= */
const DS=[['SPJ',3,6,4.66,'sisa 1 hari'],['KRW',2,5,4.62,'sisa 1 hari'],['SMG',8,15,4.55,'sisa 2 hari'],['JKT',12,12,4.80,'selesai']];
function dashSite([c,d,t,s,end]){const pct=Math.round(d/t*100),ok=pct>=90;
  return `<div class="sp sitecard ${SITES[c].tone}"><div class="ring sm" style="--p:${pct};--c:var(--${ok?'green':'amber'})"><div><b>${pct}%</b></div></div><div style="flex:1;min-width:0"><div class="row" style="gap:6px">${siteTag(c)}<b>${SITES[c].name}</b></div><div class="small muted" style="margin-top:4px">${d}/${t} penilai · target 90%</div><div class="row small" style="margin-top:6px;gap:6px;flex-wrap:wrap"><span>Skor <b>${fmt(s,2)}</b></span><span class="pill ${ok?'t-green':'t-amber'}">${ok?'Tercapai':end}</span></div></div></div>`}
function renderDashLive(){
  const got=DS.reduce((a,x)=>a+x[1],0),tot=DS.reduce((a,x)=>a+x[2],0),behind=DS.filter(x=>x[1]/x[2]<TARGET);
  $('dashLive').innerHTML=`
  <div class="stat s3 t-navy"><div class="top"><div class="num">${DS.length}</div><span class="bub">${ic('layout')}</span></div><div class="lbl">Survei aktif</div><div class="small muted">${DS.map(x=>x[0]).join(' · ')}</div></div>
  <div class="stat s3 t-sky"><div class="top"><div class="num">${got}<span class="small muted"> / ${tot}</span></div><span class="bub">${ic('users')}</span></div><div class="lbl">Jawaban masuk</div><div class="small muted">${Math.round(got/tot*100)}% dari penilai terpilih</div></div>
  <div class="stat s3 t-green"><div class="top"><div class="num">4,66</div><span class="bub">${ic('star')}</span></div><div class="lbl">Skor rata-rata</div><div class="small" style="color:var(--green-ink)">${ic('trendUp')} 0,12 dibanding Q3</div></div>
  <div class="stat s3 t-amber attn"><div class="top"><div class="num">${behind.length} site</div><span class="bub">${ic('alert')}</span></div><div class="lbl">Belum capai target</div><div class="small muted">${behind.map(x=>SITES[x[0]].name).join(', ')}</div></div>
  <div class="panel s12"><div class="row" style="flex-wrap:wrap"><h3>Target per site</h3><span class="small muted" style="margin-left:auto">Default: penilai menilai subjek di site yang sama · <span class="pill t-amber">${ic('swap')}3 pasangan lintas site</span></span></div>
    <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(min(250px,100%),1fr));margin-top:12px">${DS.map(dashSite).join('')}</div></div>
  <div class="panel s6"><div class="row"><h3>Belum mengisi — paling mendesak</h3><button class="btn sm" style="margin-left:auto">${ic('bell')}Ingatkan semua</button></div>${PEOPLE.filter(p=>!p.done).slice(0,5).map(p=>`<div class="li">${personAv(p.n,p.i)}<div style="flex:1;min-width:0"><b>${p.n}</b><div class="small muted">${p.d}</div></div>${siteTag(p.s)}<button class="btn sm" aria-label="Ingatkan ${p.n}">${ic('bell')}</button></div>`).join('')}</div>
  <div class="panel s6"><h3>Komentar terbaru</h3>${[['yudi','Respon cepat, masalah printer langsung beres.','2 jam lalu'],['t_spj','Mohon update status tiket lebih sering.','5 jam lalu'],['beny','Penjelasannya mudah dipahami.','kemarin']].map(([k,t,w])=>`<div class="li" style="align-items:flex-start">${avatar(S[k])}<div style="flex:1;min-width:0"><div>"${t}"</div><div class="small muted">untuk ${shortNm(S[k])} · ${w}</div></div>${siteTag(S[k].site)}</div>`).join('')}</div>`}
function renderDashTrend(){
  const TR={SPJ:[4.5,4.6,4.62,4.54,4.66],KRW:[4.4,4.52,4.6,4.58,4.62],SMG:[4.2,4.31,4.4,4.5,4.55],JKT:[4.6,4.62,4.7,4.75,4.8]},per=['Q4 25','Q1 26','Q2 26','Q3 26','Q4 26'];
  const X=i=>60+i*140,Y=v=>200-(v-4)*170;
  const lines=Object.entries(TR).map(([s,v])=>`<polyline fill="none" stroke="${SITES[s].c}" stroke-width="2.5" stroke-linejoin="round" points="${v.map((y,i)=>X(i)+','+Y(y)).join(' ')}" pathLength="1" style="stroke-dasharray:1;stroke-dashoffset:1;animation:draw 1s var(--ease) forwards"/>${v.map((y,i)=>`<circle cx="${X(i)}" cy="${Y(y)}" r="3.5" fill="#fff" stroke="${SITES[s].c}" stroke-width="2"><title>${SITES[s].name} ${per[i]}: ${fmt(y,2)}</title></circle>`).join('')}`).join('');
  $('dashTrend').innerHTML=`<div class="panel s8 trend"><div class="row"><h3>Skor per site, 5 periode terakhir</h3><span class="small muted" style="margin-left:auto">skala 1–5</span></div>
    <svg viewBox="0 0 640 225" role="img" aria-label="Grafik tren skor per site">${[4,4.25,4.5,4.75,5].map(v=>`<line x1="50" x2="630" y1="${Y(v)}" y2="${Y(v)}" stroke="hsl(220 15% 90%)"/><text x="42" y="${Y(v)+4}" font-size="11" text-anchor="end" fill="#666">${fmt(v,2)}</text>`).join('')}${per.map((p,i)=>`<text x="${X(i)}" y="220" font-size="11" text-anchor="middle" fill="#666">${p}</text>`).join('')}${lines}</svg>
    <div class="row small" style="flex-wrap:wrap;gap:14px">${Object.keys(TR).map(s=>`<span class="row" style="gap:6px"><span class="dot" style="background:${SITES[s].c}"></span>${SITES[s].name}</span>`).join('')}</div></div>
  <div class="panel s4"><h3>Perubahan per orang (Q4 vs Q3)</h3>${[['yudi',.22],['nur',.15],['rm',.10],['beny',.05],['t_spj',-.04],['arf',-.12],['yoh',-.18]].map(([k,d])=>`<div class="li">${avatar(S[k])}<div style="flex:1;min-width:0" class="small"><b>${shortNm(S[k])}</b></div><span class="pill ${d>=0?'t-green':'t-red'}">${d>=0?'+':'−'}${fmt(Math.abs(d),2)}</span></div>`).join('')}</div>`}
segBind('dashTab',d=>{$('dashLive').hidden=d.t!=='live';$('dashTrend').hidden=d.t!=='trend'});
renderDashLive();renderDashTrend();
