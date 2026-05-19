// ================================================================
// FuelFlow — Config & Supabase
// ================================================================

const SB_URL = 'https://vbywiautmwnxrghsophs.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZieXdpYXV0bXdueHJnaHNvcGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjM3NjksImV4cCI6MjA5NDIzOTc2OX0.N4AQoYETabCnDNlL6WbhB9F5shizZgs6nBhDUNGe-tE';
const SB_H   = {'Content-Type':'application/json','apikey':SB_KEY,'Authorization':'Bearer '+SB_KEY,'Prefer':'return=representation'};

const SETTINGS_PIN = '9876'; // ← change PIN here

const NOZZLES = {ms:['MS1','MS2','MS3','MS4'],hsd:['HSD1','HSD2'],pow:['POW1','POW2']};
const ALL_NZ  = ['MS1','MS2','MS3','MS4','HSD1','HSD2','POW1','POW2'];

// ── SUPABASE REST ──────────────────────────────────────────────
async function sb(table,method='GET',body=null,query=''){
  const url=`${SB_URL}/rest/v1/${table}${query}`;
  const opts={method,headers:{...SB_H}};
  if(body) opts.body=JSON.stringify(body);
  const r=await fetch(url,opts);
  if(!r.ok){const e=await r.text();throw new Error(e);}
  if(method==='DELETE'||r.status===204) return [];
  return r.json();
}

// ── LOCAL CACHE ────────────────────────────────────────────────
const C={
  get:k=>{try{return JSON.parse(localStorage.getItem('ff4_'+k))||null;}catch{return null;}},
  set:(k,v)=>localStorage.setItem('ff4_'+k,JSON.stringify(v)),
  settings:()=>C.get('settings')||{pumpName:'Mahalaxmi Petrol Pump',city:'Nagpur',msRate:0,hsdRate:0,powRate:0,msCap:20000,hsdCap:20000,powCap:5000,employees:[]},
  entries:()=>C.get('entries')||[],
  credits:()=>C.get('credits')||[],
  recoveries:()=>C.get('recoveries')||[],
  expenses:()=>C.get('expenses')||[],
  tankers:()=>C.get('tankers')||[],
  stkHist:()=>C.get('stkHist')||[],
  advances:()=>C.get('advances')||[],
  settlements:()=>C.get('settlements')||[],
};

// ── HELPERS ────────────────────────────────────────────────────
const fmt  = n=>'₹'+Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtV = n=>Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:3,maximumFractionDigits:3});
const fmtV2= n=>Number(n||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const TODAY= ()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const YEST = ()=>{const d=new Date();d.setDate(d.getDate()-1);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const ADDDAY= d=>{const x=new Date(d+'T00:00:00');x.setDate(x.getDate()+1);return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;};
const DS   = d=>new Date(d+'T00:00:00').toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});
const inR  = (d,f,t)=>(!f||d>=f)&&(!t||d<=t);

function toast(msg,ms=2500){
  const el=document.getElementById('toast');
  if(!el) return;
  el.textContent=msg; el.classList.add('show');
  setTimeout(()=>el.classList.remove('show'),ms);
}

// ── SYNC ───────────────────────────────────────────────────────
let syncing=false;

function setSyncStatus(status,label){
  document.querySelectorAll('.sync-dot').forEach(d=>d.className='sync-dot '+status);
  document.querySelectorAll('.sync-label').forEach(l=>l.textContent=label);
}

async function syncNow(){
  if(syncing){toast('Sync in progress...');return;}
  syncing=true; setSyncStatus('busy','Syncing…');
  try{
    const [settings,entries,credits,recoveries,expenses,tankers,stkHist,advances,settlements,employees]=await Promise.all([
      sb('settings','GET',null,'?select=*&limit=1'),
      sb('daily_entries','GET',null,'?select=*&order=entry_date.desc&limit=200'),
      sb('credit_sales','GET',null,'?select=*&order=entry_date.desc&limit=1000'),
      sb('credit_recoveries','GET',null,'?select=*&order=recovery_date.desc&limit=500'),
      sb('expenses','GET',null,'?select=*&order=entry_date.desc&limit=1000'),
      sb('tankers','GET',null,'?select=*&order=entry_date.desc&limit=500'),
      sb('stock_history','GET',null,'?select=*&order=meas_date.desc&limit=200'),
      sb('employee_advances','GET',null,'?select=*&order=advance_date.desc&limit=500'),
      sb('advance_settlements','GET',null,'?select=*&order=settlement_date.desc&limit=500'),
      sb('employees','GET',null,'?select=*&order=created_at.asc'),
    ]);
    if(settings&&settings[0]){
      const r=settings[0],l=C.settings();
      const m={...l,pumpName:r.pump_name||l.pumpName,owner:r.owner||l.owner,city:r.city||l.city,phone:r.phone||l.phone,msRate:parseFloat(r.ms_rate)||l.msRate,hsdRate:parseFloat(r.hsd_rate)||l.hsdRate,powRate:parseFloat(r.pow_rate)||l.powRate,msCap:parseFloat(r.ms_cap)||l.msCap,hsdCap:parseFloat(r.hsd_cap)||l.hsdCap,powCap:parseFloat(r.pow_cap)||l.powCap,settingsId:r.id};
      if(employees&&employees.length) m.employees=employees.map(e=>({name:e.name,role:e.role||'',id:e.id}));
      C.set('settings',m);
    }
    if(entries){
      C.set('entries',entries.map(e=>({
        date:e.entry_date,remarks:e.remarks||'',nozzles:e.nozzles||{},
        testingMs:parseFloat(e.testing_ms)||0,testingHsd:parseFloat(e.testing_hsd)||0,testingPow:parseFloat(e.testing_pow)||0,
        msV:parseFloat(e.ms_vol)||0,hsdV:parseFloat(e.hsd_vol)||0,powV:parseFloat(e.pow_vol)||0,
        msA:parseFloat(e.ms_amt)||0,hsdA:parseFloat(e.hsd_amt)||0,powA:parseFloat(e.pow_amt)||0,
        msRate:parseFloat(e.ms_rate)||0,hsdRate:parseFloat(e.hsd_rate)||0,powRate:parseFloat(e.pow_rate)||0,
        cash1:parseFloat(e.cash1)||0,cash2:parseFloat(e.cash2)||0,cash3:parseFloat(e.cash3)||0,
        paytm:parseFloat(e.paytm)||0,bankTransfer:parseFloat(e.bank_transfer)||0,
        hpPay:parseFloat(e.hp_pay)||0,ccms:parseFloat(e.ccms)||0,
        creditGiven:parseFloat(e.credit_given)||0,expenses:[],tankers:[],_id:e.id,
      })));
    }
    if(credits)    C.set('credits',   credits.map(r=>({id:r.id,date:r.entry_date,customer:r.customer,fuel:r.fuel,amount:parseFloat(r.amount)||0})));
    if(recoveries) C.set('recoveries',recoveries.map(r=>({id:r.id,date:r.recovery_date,customer:r.customer,amount:parseFloat(r.amount)||0,mode:r.mode||'',notes:r.notes||''})));
    if(expenses)   C.set('expenses',  expenses.map(r=>({id:r.id,date:r.entry_date,category:r.category,description:r.description||'',amount:parseFloat(r.amount)||0})));
    if(tankers)    C.set('tankers',   tankers.map(r=>({id:r.id,date:r.entry_date,fuel:r.fuel,volume:parseFloat(r.volume)||0,tankerNo:r.tanker_no||''})));
    if(stkHist)    C.set('stkHist',   stkHist.map(r=>({id:r.id,date:r.meas_date,ms:parseFloat(r.ms_vol)||0,hsd:parseFloat(r.hsd_vol)||0,pow:parseFloat(r.pow_vol)||0,notes:r.notes||''})));
    if(advances)   C.set('advances',  advances.map(r=>({id:r.id,date:r.advance_date,employee:r.employee_name,amount:parseFloat(r.amount)||0,notes:r.notes||''})));
    if(settlements)C.set('settlements',settlements.map(r=>({id:r.id,date:r.settlement_date,employee:r.employee_name,amount:parseFloat(r.amount)||0,mode:r.mode||'',notes:r.notes||''})));
    // Enrich entries
    const ae=C.entries(),ax=C.expenses(),at=C.tankers();
    ae.forEach(e=>{e.expenses=ax.filter(x=>x.date===e.date);e.tankers=at.filter(t=>t.date===e.date);});
    C.set('entries',ae);
    setSyncStatus('ok','Synced');
    toast('✓ Data synced');
    if(typeof onSyncComplete==='function') onSyncComplete();
  }catch(err){
    console.error('Sync error:',err);
    setSyncStatus('err','Offline');
    toast('⚠ Sync failed — working offline');
  }
  syncing=false;
}

// ── OPENING READINGS ──────────────────────────────────────────
function getOpenings(dateStr){
  const entries=C.entries();
  const prev=entries.filter(e=>e.date<dateStr).sort((a,b)=>b.date.localeCompare(a.date))[0];
  if(prev){const r={};ALL_NZ.forEach(id=>{r[id]=prev.nozzles[id]?.close??0;});return{readings:r,source:'prev',prevDate:prev.date};}
  const r={};ALL_NZ.forEach(id=>{r[id]=0;});return{readings:r,source:'none'};
}

// ── PIN ───────────────────────────────────────────────────────
let pinEntry='';
function openPinModal(){
  pinEntry='';updatePinDots();
  document.getElementById('pin-error').textContent='';
  document.getElementById('pin-overlay').classList.add('open');
}
function closePinModal(){
  document.getElementById('pin-overlay').classList.remove('open');
  pinEntry='';updatePinDots();
}
function pinKey(digit){
  if(pinEntry.length>=4)return;
  pinEntry+=digit;updatePinDots();
  if(pinEntry.length===4)setTimeout(checkPin,120);
}
function pinDel(){pinEntry=pinEntry.slice(0,-1);updatePinDots();document.getElementById('pin-error').textContent='';}
function updatePinDots(){for(let i=0;i<4;i++)document.getElementById('pd'+i).classList.toggle('filled',i<pinEntry.length);}
function checkPin(){
  if(pinEntry===SETTINGS_PIN){closePinModal();window.location.href='settings.html';}
  else{
    document.getElementById('pin-error').textContent='✕ Incorrect PIN';
    const dots=document.getElementById('pin-dots');
    dots.style.animation='none';dots.offsetHeight;dots.style.animation='shake .35s ease';
    pinEntry='';setTimeout(()=>{updatePinDots();dots.style.animation='';},400);
  }
}

// ── SHARED NAV HTML ───────────────────────────────────────────
function renderNav(activePage){
  const pages=[
    {id:'index',   href:'index.html',  label:'Dash',   icon:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>'},
    {id:'entry',   href:'entry.html',  label:'Entry',  icon:'<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>'},
    {id:'sales',   href:'sales.html',  label:'Sales',  icon:'<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>'},
    {id:'credit',  href:'credit.html', label:'Credit', icon:'<rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>'},
    {id:'more',    href:'#',           label:'More',   icon:'<circle cx="12" cy="5" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="19" r="1" fill="currentColor"/>'},
  ];
  const nav=document.getElementById('bottom-nav');
  if(!nav)return;
  nav.innerHTML=pages.map(p=>{
    const active=activePage===p.id?'active':'';
    const click=p.id==='more'?'onclick="toggleMore()" href="#"':'';
    return `<a class="nav-btn ${active}" href="${p.href}" ${click} id="nav-${p.id}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${p.icon}</svg>
      ${p.label}
    </a>`;
  }).join('');

  const more=document.getElementById('more-menu');
  if(more) more.innerHTML=`
    <a class="more-btn" href="expenses.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 14l2 2 4-4"/><rect x="3" y="3" width="18" height="18" rx="2"/></svg>Expenses</a>
    <a class="more-btn" href="employees.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>Employees</a>
    <a class="more-btn" href="stock.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>Stock</a>
    <a class="more-btn" href="reports.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Reports</a>
    <a class="more-btn" onclick="openPinModal();closeMore()" href="#"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/></svg>Settings 🔒</a>
  `;
}

function toggleMore(){
  document.getElementById('more-menu').classList.toggle('open');
  document.getElementById('more-overlay').classList.toggle('open');
}
function closeMore(){
  document.getElementById('more-menu')?.classList.remove('open');
  document.getElementById('more-overlay')?.classList.remove('open');
}

// ── SHARED PAGE SHELL ─────────────────────────────────────────
function buildShell(pageName,activeNav){
  document.title = `FuelFlow — ${pageName}`;
  const app=document.getElementById('app');

  // Top bar
  const topBar=document.getElementById('top-bar');
  if(topBar) topBar.innerHTML=`
    <div class="top-bar-left">
      <a class="app-logo" href="index.html">⛽ FuelFlow</a>
      <span class="page-name">${pageName}</span>
    </div>
    <div class="top-bar-right">
      <button class="sync-btn" onclick="syncNow()">
        <span class="sync-dot ok sync-dot"></span>
        <span class="sync-label">Synced</span>
      </button>
    </div>`;

  renderNav(activeNav);
}

// Auto-init on every page
document.addEventListener('DOMContentLoaded',async()=>{
  setSyncStatus('busy','Syncing…');
  try{ await syncNow(); } catch(e){ setSyncStatus('err','Offline'); }
});
