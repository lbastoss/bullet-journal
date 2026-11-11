import { onAuthStateChanged, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, signInAnonymously } from 'firebase/auth';
import { collection, doc as fsDoc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { auth, db, googleProvider, isEmulator } from './firebase.js';
import './style.css';

/* ================= utilidades de data ================= */
const DOW=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const DOWS=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DOW1=['D','S','T','Q','Q','S','S'];
const MES=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const pad=n=>String(n).padStart(2,'0');
const dk=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const pd=k=>{const[y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d||1)};
const addD=(k,n)=>{const d=pd(k);d.setDate(d.getDate()+n);return dk(d)};
const today=()=>dk(new Date());
const monday=k=>{const d=pd(k);d.setDate(d.getDate()-((d.getDay()+6)%7));return dk(d)};
const ymOf=k=>k.slice(0,7);
const addM=(ym,n)=>{const[y,m]=ym.split('-').map(Number);const d=new Date(y,m-1+n,1);return `${d.getFullYear()}-${pad(d.getMonth()+1)}`};
const dim=ym=>{const[y,m]=ym.split('-').map(Number);return new Date(y,m,0).getDate()};
const diffDays=(a,b)=>Math.round((pd(b)-pd(a))/864e5);
const ddmm=k=>`${k.slice(8,10)}/${k.slice(5,7)}`;
const isoWeek=k=>{const d=pd(k);d.setDate(d.getDate()+3-((d.getDay()+6)%7));const w1=new Date(d.getFullYear(),0,4);return 1+Math.round(((d-w1)/864e5-3+((w1.getDay()+6)%7))/7)};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-3);
const clone=o=>JSON.parse(JSON.stringify(o));

/* ================= conteúdo do guia ================= */
const PROMPTS=[
 ['Consciência do dia a dia',['Como estou chegando a este dia, física e mentalmente?','O que está ocupando mais espaço na minha cabeça hoje?','O que aconteceu ontem que ainda está reverberando em mim?','Em que momentos do dia costumo perder mais energia?','O que funcionou bem na minha rotina hoje?','O que hoje me cansou mais do que deveria?','Que pensamento esteve mais presente ao longo do dia?','O que eu fiz hoje que me deu uma sensação de estabilidade?','Como foi meu nível de foco hoje, de 0 a 10? Por quê?','O que eu ignoraria se não parasse para escrever agora?']],
 ['Clareza e prioridades',['O que realmente precisa da minha atenção agora?','O que estou tratando como urgente, mas talvez não seja?','O que posso simplificar na minha rotina atual?','O que estou adiando e o que isso está me custando?','Se eu pudesse resolver apenas uma coisa hoje, qual seria?','O que está fora do meu controle e merece ser solto?','O que merece foco nesta semana?','O que está me distraindo do que é importante?','Que decisão estou evitando tomar?','O que ficaria mais leve se eu tivesse mais clareza?']],
 ['Hábitos, constância e organização',['Qual hábito tem mais impacto positivo no meu dia?','O que dificulta minha constância atualmente?','Em que momento do dia é mais fácil manter o foco?','Que pequeno ajuste poderia melhorar minha rotina amanhã?','O que já é organizado na minha vida e posso valorizar mais?','Onde estou tentando fazer demais ao mesmo tempo?','Que hábito estou construindo, mesmo que lentamente?','O que me ajuda a retomar o foco quando me perco?','O que está bagunçado externamente e reflete meu estado interno?','O que posso preparar hoje para facilitar o dia de amanhã?']]
];
const ALLP=PROMPTS.flatMap(([,l])=>l);
const ICON={
 person:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4.5-6 8-6s7 2 8 6"/></svg>',
 bolt:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M13 2 5 14h6l-1 8 8-12h-6z"/></svg>',
 spark:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 2c.8 5 2 6.6 7 8-5 1.4-6.2 3-7 8-.8-5-2-6.6-7-8 5-1.4 6.2-3 7-8z"/></svg>',
 coin:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M15 9c-.5-1-1.6-1.6-3-1.6-1.7 0-3 .9-3 2.2 0 3 6 1.5 6 4.6 0 1.3-1.3 2.2-3 2.2-1.5 0-2.6-.6-3.1-1.7M12 6v1.4M12 16.6V18"/></svg>',
 heart:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>',
 star:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z"/></svg>',
 day:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h1M11 8h5M8 12h1M11 12h5M8 16h1M11 16h3"/></svg>',
 week:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 9.3h18M3 14.6h18"/></svg>',
 month:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><circle cx="8" cy="14.5" r=".6" fill="currentColor"/><circle cx="12" cy="14.5" r=".6" fill="currentColor"/><circle cx="16" cy="14.5" r=".6" fill="currentColor"/></svg>',
 year:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="5" height="5" rx="1"/><rect x="9.5" y="3" width="5" height="5" rx="1"/><rect x="16" y="3" width="5" height="5" rx="1"/><rect x="3" y="9.5" width="5" height="5" rx="1"/><rect x="9.5" y="9.5" width="5" height="5" rx="1"/><rect x="16" y="9.5" width="5" height="5" rx="1"/><rect x="3" y="16" width="5" height="5" rx="1"/><rect x="9.5" y="16" width="5" height="5" rx="1"/><rect x="16" y="16" width="5" height="5" rx="1"/></svg>',
 col:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M4 5h6l2 2h8v12H4z"/></svg>',
 idx:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M5 6h9M5 12h9M5 18h9"/><path d="M17 6h2M17 12h2M17 18h2" stroke-dasharray="1 1.6"/></svg>',
 key:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M16 7l2 2M14 9l1.5 1.5"/></svg>',
 gear:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/></svg>'
};
ICON.hab='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M4 3v18M4 21h17"/><circle cx="9" cy="8" r="1" fill="currentColor"/><circle cx="13" cy="8" r="1" fill="currentColor"/><circle cx="17" cy="8" r="1" fill="currentColor"/><circle cx="9" cy="12.5" r="1" fill="currentColor"/><circle cx="17" cy="12.5" r="1" fill="currentColor"/><circle cx="13" cy="17" r="1" fill="currentColor"/><circle cx="17" cy="17" r="1" fill="currentColor"/></svg>';
const VIEWS=[['dia','Dia','day'],['semana','Semana','week'],['mes','Mês','month'],['habitos','Hábitos','hab'],['ano','Ano','year'],['colecoes','Coleções','col'],['indice','Índice','idx'],['chave','Chave','key'],['ajustes','Ajustes','gear']];
const FONTS=[['Schoolbell','Mais parecida com o guia'],['Coming Soon','Redonda e leve'],['Mynerve','Caneta fina'],['Patrick Hand','Mais legível'],['Gochi Hand','Marcador grosso']];

/* ================= estado ================= */
const COLS=['meta','days','weeks','months','years','cols'];
const S={meta:{},days:{},weeks:{},months:{},years:{},cols:{}};
const DEF={
  days:()=>({items:[],thermo:'',intent:'',mood:null,prod:null,stress:null,sleep:'',habits:{}}),
  weeks:()=>({focus:'',goals:[],next:[],checkout:''}),
  months:()=>({checkin:'',goals:[],tasks:[],reflect:''}),
  years:()=>({goals:[],word:'',f:{}}),
  cols:()=>({title:'Nova coleção',kind:'list',items:[],created:Date.now()}),
  meta:()=>({font:'Schoolbell',
    habits:[{id:'h1',n:'Leitura'},{id:'h2',n:'Exercício'},{id:'h3',n:'Meditação'},{id:'h4',n:'Escrita'},{id:'h5',n:'Água 2L'}],
    cats:[{id:'pessoal',n:'Desenvolvimento pessoal',i:'person'},{id:'saude',n:'Saúde e Performance',i:'bolt'},{id:'criat',n:'Criatividade e Trabalho',i:'spark'},{id:'fin',n:'Financeiro e Carreira',i:'coin'},{id:'vida',n:'Vida Pessoal',i:'heart'}],
    usedPrompts:[]})
};
const peek=(col,id)=>S[col][id];
const doc=(col,id)=>S[col][id]||(S[col][id]=DEF[col](id));
const settings=()=>doc('meta','settings');
const ui={view:'dia',cur:today(),editing:null,addType:{},addImp:{},prompt:null,q:'',col:null,miniYm:ymOf(today()),migrated:0};

/* ================= armazenamento ================= */
const LSK='bujo-v1';
let mode='none',base=null,ready=false;
const timers=new Map(),inflight=new Set(),again=new Set();
function touch(col,id){
  const k=col+'|'+id; S[col][id].u=Date.now();
  clearTimeout(timers.get(k));
  timers.set(k,setTimeout(()=>{timers.delete(k);flush(col,id)},450));
}
async function flush(col,id){
  const k=col+'|'+id;
  if(inflight.has(k)){again.add(k);return}
  inflight.add(k); setSync('saving');
  try{
    if(mode==='cloud'){
      const data=S[col][id];
      const ref=fsDoc(db,'users',uidCur,'bj_'+col,id);
      if(data===undefined) await deleteDoc(ref);
      else await setDoc(ref,clone(data));
    } else saveLocal();
    setSync('ok');
  }catch(e){
    if(e&&e.code==='unavailable'){ inflight.delete(k); setTimeout(()=>flush(col,id),1200+Math.random()*800); return }
    setSync('err',e&&e.code==='quota_exceeded'?'Caderno cheio: apague coleções antigas.':'Não consegui salvar. Confira sua conexão.');
  }
  inflight.delete(k);
  if(again.has(k)){again.delete(k);flush(col,id)}
}
function busy(col,id){const k=col+'|'+id;return timers.has(k)||inflight.has(k)}
function saveLocal(){try{localStorage.setItem(LSK,JSON.stringify(S))}catch(e){}}
function loadLocal(){try{const r=JSON.parse(localStorage.getItem(LSK)||'null');if(r)for(const c of COLS)S[c]=r[c]||{}}catch(e){}}
let syncState='',syncMsg='';
function setSync(s,msg){syncState=s;syncMsg=msg||'';const el=document.getElementById('sync');if(el)el.outerHTML=syncHTML();if(s==='err')toast(msg)}
function syncHTML(){
  const t={cloud:'Sincronizado entre seus aparelhos',local:'Salvo só neste navegador',none:'Conectando…'}[mode];
  const cls=syncState==='err'||syncState==='offline'?'warn':mode==='cloud'&&ready?'ok':'warn';
  const msg=syncState==='saving'?'Salvando…':syncState==='err'?syncMsg:syncState==='offline'?'Offline: salva aqui e sincroniza depois':t;
  return `<div class="sync ${cls}" id="sync"><i></i>${esc(msg)}</div>`;
}

/* ================= login + Firestore =================
   Dados em users/{uid}/bj_<coleção>/{id}. As regras do Firestore só deixam
   cada usuário ler e escrever dentro do próprio users/{uid}. */
let uidCur=null, currentUser=null;
function init(){
  onAuthStateChanged(auth,u=>{
    if(u&&uidCur&&u.uid!==uidCur){location.reload();return}
    if(!u){ if(uidCur){location.reload();return} showLogin(); return }
    if(uidCur) return;
    uidCur=u.uid; currentUser=u; mode='cloud'; startSync();
  });
}
function startSync(){
  document.getElementById('page').innerHTML='<p class="empty">Abrindo seu caderno…</p>';
  const got=new Set(); let gotCache=new Set();
  const timer=setTimeout(()=>{if(!ready){ready=true;afterLoad();toast('Sem conexão: mostrando o que está salvo neste aparelho.')}},8000);
  for(const c of COLS){
    onSnapshot(collection(db,'users',uidCur,'bj_'+c),{includeMetadataChanges:true},snap=>{
      for(const ch of snap.docChanges()){
        const id=ch.doc.id; if(busy(c,id)) continue;
        if(ch.type==='removed') delete S[c][id]; else S[c][id]=clone(ch.doc.data());
      }
      gotCache.add(c); if(!snap.metadata.fromCache) got.add(c);
      if(!ready&&got.size===COLS.length){ready=true;clearTimeout(timer);afterLoad()}
      else if(ready) softRender();
      if(ready) setSync(snap.metadata.fromCache?'offline':'ok');
    },err=>{ if(!ready){ready=true;clearTimeout(timer);afterLoad()} setSync('err','Não consegui acessar seus dados. Saia e entre de novo.') });
  }
}
function showLogin(){
  document.body.classList.add('login');
  document.getElementById('side').innerHTML=''; document.getElementById('tabs').innerHTML='';
  document.getElementById('page').innerHTML=`<div class="login-card">
    <div class="brand" style="font-size:34px">bullet<span style="font-size:46px">journal</span></div>
    <p class="hand" style="font-size:21px;margin:18px 0 26px">Registre o passado, organize o presente, planeje o futuro.</p>
    <button class="btn primary" data-act="login" style="padding:10px 20px;font-size:15px">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.75c1.77 0 3.36.61 4.61 1.7l3.42-3.43C17.95 1.15 15.24 0 12 0 7.31 0 3.26 2.69 1.29 6.61l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z" fill="#EA4335"/><path d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.57 5.57 0 0 1-2.4 3.59l3.86 3.09c2.26-2.1 3.56-5.25 3.56-8.92Z" fill="#4285F4"/><path d="M5.27 14.3a7.1 7.1 0 0 1 0-4.6L1.29 6.61a12 12 0 0 0 0 10.78l3.98-3.09Z" fill="#FBBC05"/><path d="M12 24c3.24 0 5.97-1.06 7.94-2.81l-3.87-3.09c-1.07.71-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.95l-3.98 3.09C3.26 21.31 7.31 24 12 24Z" fill="#34A853"/></svg>
      Entrar com o Google</button>
    ${isEmulator?'<button class="btn" data-act="loginanon" style="margin-top:10px">Entrar sem conta (emulador)</button>':''}
    <p class="hint" id="loginerr" style="color:var(--red)"></p>
    <p class="hint" style="margin-top:28px">Cada pessoa só acessa o próprio caderno.</p></div>`;
  getRedirectResult(auth).catch(e=>{const el=document.getElementById('loginerr');if(el)el.textContent='Não foi possível entrar: '+(e&&e.code||e)});
}
async function doLogin(){
  try{
    const standalone=window.matchMedia('(display-mode: standalone)').matches||navigator.standalone;
    if(standalone) await signInWithRedirect(auth,googleProvider); else await signInWithPopup(auth,googleProvider);
    document.body.classList.remove('login');
  }catch(e){const el=document.getElementById('loginerr');if(el)el.textContent=e&&e.code==='auth/popup-closed-by-user'?'Login cancelado.':'Não foi possível entrar: '+(e&&e.message||e)}
}
function afterLoad(){ applyFont(); runMigration(); render(); }

/* ================= migração automática ================= */
function moveItem(ref,id,date,mark){
  const list=getList(ref); const it=list.find(x=>x.id===id); if(!it) return;
  const baseId=it.id.split('~')[0], nid=baseId+'~'+date;
  const fromRef=ref.split('|'); const fromDate=fromRef[0]==='days'?fromRef[1]:null;
  const T=doc('days',date);
  if(!T.items.some(x=>x.id===nid)) T.items.push({...clone(it),id:nid,s:'open',to:undefined,auto:false,from:it.from||fromDate||date,ack:false});
  it.s=mark; it.to=date;
  touch('days',date); touchRef(ref);
}
function runMigration(){
  const t=today(); const moved=[];
  for(const k of Object.keys(S.days).filter(k=>k<t).sort()){
    const d=S.days[k]; let ch=false;
    for(const it of d.items||[]){
      if(it.t==='task'&&it.s==='open'){
        const nid=it.id.split('~')[0]+'~'+t;
        it.s='migrated'; it.to=t; ch=true;
        moved.push({...clone(it),id:nid,s:'open',to:undefined,auto:true,from:it.from||k,ack:false});
      }
    }
    if(ch) touch('days',k);
  }
  if(moved.length){
    const T=doc('days',t); const fresh=moved.filter(m=>!T.items.some(x=>x.id===m.id));
    T.items=[...fresh,...T.items]; touch('days',t); ui.migrated=fresh.length;
  }
}
setInterval(()=>{ if(ready&&ui.lastDay&&ui.lastDay!==today()){ const was=ui.lastDay; ui.lastDay=today(); if(ui.cur===was) ui.cur=today(); runMigration(); render(); } },60000);
document.addEventListener('visibilitychange',()=>{ if(!document.hidden&&ready&&ui.lastDay!==today()){ ui.lastDay=today(); ui.cur=today(); runMigration(); render(); }});

/* ================= listas genéricas ================= */
function getList(ref){
  const [col,id,path]=ref.split('|'); const o=doc(col,id); const ps=path.split('.');
  let cur=o; for(let i=0;i<ps.length-1;i++){cur=cur[ps[i]]||(cur[ps[i]]={})}
  const last=ps[ps.length-1]; return cur[last]||(cur[last]=[]);
}
function touchRef(ref){const [col,id]=ref.split('|');touch(col,id)}
function parseEntry(raw,t,imp){
  let text=raw.trim(); let type=t||'task';
  const m=text.match(/^([*!•o○\-–~])\s+/);
  if(m){const c=m[1]; if(c==='*'||c==='!') imp=true; else if(c==='o'||c==='○') type='event'; else if(c==='-'||c==='–') type='note'; else if(c==='~') type='idea'; text=text.slice(m[0].length)}
  let time=''; const tm=text.match(/^(\d{1,2})(?:[h:](\d{2})?)\s*[:\-–]?\s+/i);
  if(tm&&+tm[1]<24&&(text.match(/^\d{1,2}[h:]/i))){time=`${pad(tm[1])}h${tm[2]||'00'}`;text=text.slice(tm[0].length); if(type==='task'&&!m) type='event'}
  return {id:uid(),t:type,text,s:'open',imp:!!imp,time,c:Date.now()};
}

/* ================= renderização de itens ================= */
const sym=it=>{
  if(it.t==='event') return it.s==='done'?'⊗':'○';
  if(it.t==='note') return '–';
  if(it.t==='idea') return '~';
  return {done:'×',migrated:'&gt;',scheduled:'&lt;'}[it.s]||'•';
};
const fmtText=s=>esc(s).replace(/(^|\s)(#[\wÀ-ÿ\-]+)/g,'$1<span class="tag">$2</span>');
function itemHTML(it,ref,opts={}){
  const ed=ui.editing&&ui.editing.ref===ref&&ui.editing.id===it.id;
  const carry=it.from&&it.s==='open'&&ref.startsWith('days|')?diffDays(it.from,ref.split('|')[1]):0;
  let badge='';
  if(carry>0) badge=`<span class="badge ${carry>=3?'hot':''}" title="Veio de ${ddmm(it.from)}">↻ ${carry===1?'de ontem':carry+' dias'}</span>`;
  else if((it.s==='migrated'||it.s==='scheduled')&&it.to) badge=`<span class="badge dest">→ ${ddmm(it.to)}</span>`;
  const tx=ed?`<input class="edit-in" id="edit-in" value="${esc(it.text)}" data-ref="${ref}" data-id="${it.id}" aria-label="Editar item">`
    :`<span class="tx">${it.time?`<b>${esc(it.time)}:</b> `:''}${fmtText(it.text)}${opts.extra||''}</span>`;
  const label={task:'tarefa',event:'evento',note:'nota',idea:'ideia'}[it.t];
  let h=`<li class="it s-${it.s} t-${it.t} ${carry>0?'carry':''}" data-ref="${ref}" data-id="${it.id}">
    <button class="sig" data-act="tog" aria-label="${label}: marcar">${it.imp?'<span class="imp">✱</span>':''}${sym(it)}</button>${tx}${badge}
    <button class="more" data-act="menu" aria-label="Opções do item">⋯</button></li>`;
  if(carry>=3&&!it.ack&&!opts.compact) h+=`<li class="ask" data-ref="${ref}" data-id="${it.id}">Isso está há ${carry} dias esperando. Ainda vale a pena?
    <button class="btn small" data-act="ack">✱ Fazer hoje</button><button class="btn small" data-act="sched">Agendar</button><button class="btn small" data-act="cancel">Riscar</button></li>`;
  return h;
}
function listHTML(ref,{empty='',compact=false}={}){
  const l=getListPeek(ref);
  if(!l.length) return empty?`<p class="empty">${empty}</p>`:'<ul class="items"></ul>';
  return `<ul class="items">${l.map(it=>itemHTML(it,ref,{compact})).join('')}</ul>`;
}
function getListPeek(ref){
  const [col,id,path]=ref.split('|'); let cur=S[col][id]; if(!cur) return [];
  for(const p of path.split('.')){cur=cur&&cur[p]} return Array.isArray(cur)?cur:[];
}
function addHTML(ref,{types=true,ph='Escreva e aperte Enter…',extra=''}={}){
  const t=ui.addType[ref]||'task', imp=!!ui.addImp[ref];
  const tb=types?`<div class="types" role="group" aria-label="Tipo">${[['task','•','Tarefa'],['event','○','Evento'],['note','–','Nota'],['idea','~','Ideia / rabisco']].map(([k,s,l])=>`<button type="button" data-act="atype" data-t="${k}" aria-pressed="${t===k}" title="${l}" aria-label="${l}">${s}</button>`).join('')}</div>
    <button type="button" class="impt" data-act="aimp" aria-pressed="${imp}" title="Importante" aria-label="Marcar como importante">✱</button>`:'';
  return `<form class="add" data-ref="${ref}">${tb}${extra}<input type="text" name="t" id="add-${ref.replace(/[|.]/g,'-')}" placeholder="${ph}" autocomplete="off" enterkeyhint="done"></form>`;
}

/* ================= navegação / casca ================= */
function go(view,cur){ if(cur) ui.cur=cur; if(location.hash!=='#'+view) location.hash=view; else render(); }
window.addEventListener('hashchange',()=>{ const v=location.hash.slice(1); if(VIEWS.some(x=>x[0]===v)){ui.view=v;closePop();render();window.scrollTo(0,0)} });
function sideHTML(){
  const ym=ui.miniYm, first=pd(ym+'-01'), off=(first.getDay()+6)%7, n=dim(ym), t=today();
  let g='<b>S</b><b>T</b><b>Q</b><b>Q</b><b>S</b><b>S</b><b>D</b>'+'<span></span>'.repeat(off);
  for(let d=1;d<=n;d++){const k=`${ym}-${pad(d)}`;const D=S.days[k];const has=D&&((D.items&&D.items.length)||D.thermo);
    g+=`<button data-act="goday" data-d="${k}" class="${has?'has':''} ${k===t?'today':''} ${k===ui.cur&&ui.view==='dia'?'sel':''}" aria-label="${d} de ${MES[+ym.slice(5)-1]}">${d}</button>`}
  return `<div class="brand">bullet<span>journal</span></div>
  <nav class="nav" aria-label="Seções">${VIEWS.map(([v,l,i])=>`<a href="#${v}" ${ui.view===v?'aria-current="page"':''}>${ICON[i]}${l}</a>`).join('')}</nav>
  <div class="mini"><div class="mini-h"><button data-act="mini" data-n="-1" aria-label="Mês anterior">‹</button><span>${MES[+ym.slice(5)-1]} ${ym.slice(0,4)}</span><button data-act="mini" data-n="1" aria-label="Próximo mês">›</button></div>
  <div class="mini-g">${g}</div></div>${syncHTML()}`;
}
function tabsHTML(){return VIEWS.slice(0,7).map(([v,l,i])=>`<a href="#${v}" ${ui.view===v?'aria-current="page"':''}>${ICON[i]}${l}</a>`).join('')}
function topbar(sub,title,nav){
  return `<div class="topbar"><div style="flex:1;min-width:0"><span class="sub">${sub}</span><h1>${title}</h1></div>
  <div class="navbtns">${nav||''}<a class="btn ghost round mobile-only" href="#chave" aria-label="Chave de símbolos">${ICON.key}</a><a class="btn ghost round mobile-only" href="#ajustes" aria-label="Ajustes">${ICON.gear}</a></div></div>`;
}
const navArrows=(act,label)=>`<button class="btn round" data-act="${act}" data-n="-1" aria-label="${label} anterior">‹</button><button class="btn" data-act="${act}" data-n="0">Hoje</button><button class="btn round" data-act="${act}" data-n="1" aria-label="Próximo ${label}">›</button>`;

/* ================= DIA ================= */
function viewDia(){
  const k=ui.cur, d=pd(k), D=peek('days',k)||DEF.days(), t=today(), st=settings();
  const sub=k===t?'Hoje':k===addD(t,-1)?'Ontem':k===addD(t,1)?'Amanhã':k<t?'Registro passado':'Registro futuro';
  const carried=(D.items||[]).filter(i=>i.from&&i.s==='open');
  const ref=`days|${k}|items`;
  let h=topbar(`${sub} · semana ${isoWeek(k)}`,`<u>${ddmm(k)} – ${DOW[d.getDay()]}</u>`,navArrows('nday','dia'));
  if(carried.length&&k===t) h+=`<div class="banner"><span class="big">↻</span><div><b>${carried.length} ${carried.length>1?'tarefas vieram':'tarefa veio'} de dias anteriores.</b> Elas estão no topo, com um lembrete de quantos dias estão esperando. Se algo não vale mais a pena, risque. Isso também é progresso.</div></div>`;
  h+=`<section><label class="lbl u" for="intent">Intenção do dia</label>
    <textarea class="line grow" rows="1" id="intent" data-bind="days|${k}|intent" placeholder="O que faria hoje valer a pena?">${esc(D.intent)}</textarea></section>
  <section class="blk"><span class="lbl">Diário</span>${(()=>{const ts=(D.items||[]).filter(i=>i.t==='task'&&i.s!=='cancelled'&&i.s!=='migrated'&&i.s!=='scheduled');const dn=ts.filter(i=>i.s==='done').length;return ts.length?`<span class="count">${dn} de ${ts.length} ${ts.length>1?'tarefas feitas':'tarefa feita'}</span>`:''})()}
    ${listHTML(ref,{empty:'Nada registrado ainda. Escreva abaixo: tarefas (•), eventos (○), notas (–) e ideias (~).'})}
    ${addHTML(ref)}
    <p class="hint">Atalhos: comece com <b>o</b> para evento, <b>-</b> para nota, <b>~</b> para ideia, <b>*</b> para importante, <b>10h30</b> para horário. Use <b>#tema</b> para entrar no índice.</p></section>
  <section class="blk"><span class="lbl">≡ Termômetro do dia</span>
    <p class="hint">Coloque pra fora sentimentos, sensações e pensamentos. Uma ou duas linhas já constroem o hábito.</p>
    ${ui.prompt!=null?`<div class="prompt">${esc(ALLP[ui.prompt])} <button class="btn small" data-act="useprompt">Usei este</button> <button class="btn small ghost" data-act="prompt">Outro</button></div>`
      :`<button class="btn small" data-act="prompt">Sem inspiração? Sortear um prompt</button>`}
    <textarea class="write" id="thermo" data-bind="days|${k}|thermo" placeholder="Hoje eu…">${esc(D.thermo)}</textarea></section>
  <section class="blk"><span class="lbl">Como foi o dia</span>
    <div class="metrics">${[['mood','Humor'],['prod','Produtividade'],['stress','Estresse']].map(([f,l])=>`<div class="metric"><label for="m-${f}">${l}<output>${D[f]??'–'}</output></label>
      <input type="range" min="0" max="10" step="1" id="m-${f}" data-bind="days|${k}|${f}" data-num value="${D[f]??5}" ${D[f]==null?'style="opacity:.45"':''}></div>`).join('')}
      <div class="metric"><label for="m-sleep">Horas de sono</label><input class="line" id="m-sleep" data-bind="days|${k}|sleep" value="${esc(D.sleep)}" placeholder="7h30"></div></div>
    <p class="sublbl">Hábitos de hoje</p>
    <div class="chips">${st.habits.map(hb=>`<button class="chip" data-act="habit" data-d="${k}" data-h="${hb.id}" aria-pressed="${!!(D.habits||{})[hb.id]}">${D.habits&&D.habits[hb.id]?'●':'○'} ${esc(hb.n)}</button>`).join('')||'<span class="hint keep">Cadastre hábitos em Ajustes.</span>'}</div></section>`;
  return h;
}

/* ================= SEMANA ================= */
function moodChart(keys,field,{w=230,h=120}={}){
  const vals=keys.map(k=>{const v=S.days[k]&&S.days[k][field];return v==null?null:+v});
  const x=i=>24+i*((w-34)/(keys.length-1)), y=v=>h-22-(v/10)*(h-34);
  let path='',pts='';
  vals.forEach((v,i)=>{if(v==null)return;path+=(path&&vals[i-1]!=null?'L':'M')+x(i).toFixed(1)+' '+y(v).toFixed(1);pts+=`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="var(--blue)"/>`});
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Gráfico de ${field}">
    <line x1="20" y1="${y(10)}" x2="20" y2="${y(0)}" stroke="var(--ink)" stroke-width="1.2"/><line x1="20" y1="${y(0)}" x2="${w-6}" y2="${y(0)}" stroke="var(--ink)" stroke-width="1.2"/>
    <text x="6" y="${y(10)+4}">10</text><text x="9" y="${y(0)+4}">0</text>
    ${keys.map((k,i)=>`<text x="${x(i)-4}" y="${h-4}">${DOW1[pd(k).getDay()]}</text>`).join('')}
    <path d="${path}" fill="none" stroke="var(--blue)" stroke-width="1.6" stroke-linejoin="round"/>${pts}</svg>`;
}
function viewSemana(){
  const m=monday(ui.cur), keys=[...Array(7)].map((_,i)=>addD(m,i)), W=peek('weeks',m)||DEF.weeks(), t=today();
  let h=topbar(`Visão semanal · semana ${isoWeek(m)}`,`<u>${ddmm(keys[0])} – ${ddmm(keys[6])}</u>`,navArrows('nweek','semana'));
  h+=`<div class="focus-row"><div class="box"><label class="hand" for="focus" style="font-size:19px">◎ Foco da semana</label>
      <textarea class="write short" id="focus" data-bind="weeks|${m}|focus" placeholder="O que é prioridade? Quais áreas da vida terão atenção?">${esc(W.focus)}</textarea></div>
    <div class="box"><span class="hand" style="font-size:17px">Humor</span>${moodChart(keys,'mood')}</div></div>
  <section class="blk"><span class="lbl">Metas da semana</span>${listHTML(`weeks|${m}|goals`,{empty:'Defina de 1 a 3 metas que fariam a semana valer.'})}${addHTML(`weeks|${m}|goals`,{types:false,ph:'Nova meta da semana…'})}</section>
  <section class="blk"><div class="week">${keys.map(k=>{const d=pd(k);return `<div class="box ${k===t?'today':''}"><h5><a href="#dia" data-act="goday" data-d="${k}">${DOW[d.getDay()].replace('-feira','')}</a><span style="color:var(--ink-2)">${ddmm(k)}</span></h5>${listHTML(`days|${k}|items`,{compact:true})}${addHTML(`days|${k}|items`,{types:false,ph:'+'})}</div>`}).join('')}
    <div class="box next"><h5>Próxima semana</h5>${listHTML(`weeks|${m}|next`,{compact:true})}${addHTML(`weeks|${m}|next`,{types:false,ph:'Não esquecer…'})}</div></div></section>
  <section class="blk"><label class="lbl u" for="checkout">Check-out</label>
    <p class="hint">Faça um balanço: conseguiu realizar o que precisava? Teve tempo de descanso e lazer?</p>
    <textarea class="write" id="checkout" data-bind="weeks|${m}|checkout" placeholder="Semana com…">${esc(W.checkout)}</textarea></section>`;
  return h;
}

/* ================= MÊS ================= */
function goalsByCat(ref){
  const st=settings(), l=getListPeek(ref);
  return st.cats.map(c=>{const ls=l.filter(g=>g.cat===c.id);const done=ls.filter(g=>g.s==='done').length;const sub=ref+'#'+c.id;
    return `<div class="cat">${ICON[c.i]||ICON.star}<div style="min-width:0"><h4>${esc(c.n)}${ls.length?` · ${done}/${ls.length}`:''}</h4>
    <ul class="items">${ls.map(it=>itemHTML(it,ref)).join('')}</ul>${addHTML(sub,{types:false,ph:'Nova meta…'})}</div></div>`}).join('');
}
function lineChart(keys,{w=640,h=150}={}){
  const x=i=>28+i*((w-38)/Math.max(1,keys.length-1)), y=v=>h-24-(v/10)*(h-36);
  const ser=(f,dash,color)=>{let p='';keys.forEach((k,i)=>{const v=S.days[k]&&S.days[k][f];if(v==null)return;p+=(p&&S.days[keys[i-1]]&&S.days[keys[i-1]][f]!=null?'L':'M')+x(i).toFixed(1)+' '+y(+v).toFixed(1)});
    return `<path d="${p}" fill="none" stroke="${color}" stroke-width="1.6" ${dash?'stroke-dasharray="4 4"':''} stroke-linejoin="round"/>`};
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Produtividade, estresse e humor no mês">
   ${[0,5,10].map(v=>`<line x1="24" x2="${w-6}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/><text x="4" y="${y(v)+4}">${v}</text>`).join('')}
   ${keys.map((k,i)=>(i%5===0||i===keys.length-1)?`<text x="${x(i)-4}" y="${h-4}">${+k.slice(8)}</text>`:'').join('')}
   ${ser('prod',false,'var(--red)')}${ser('stress',true,'var(--ink)')}${ser('mood',false,'var(--blue)')}
   <g transform="translate(${w-270},4)"><line x1="0" x2="22" y1="6" y2="6" stroke="var(--red)" stroke-width="1.8"/><text x="28" y="10">Produtividade</text><line x1="112" x2="134" y1="6" y2="6" stroke="var(--ink)" stroke-width="1.8" stroke-dasharray="4 4"/><text x="140" y="10">Estresse</text><line x1="200" x2="222" y1="6" y2="6" stroke="var(--blue)" stroke-width="1.8"/><text x="228" y="10">Humor</text></g></svg>`;
}
function viewMes(){
  const ym=ymOf(ui.cur), [y,mm]=ym.split('-').map(Number), M=peek('months',ym)||DEF.months(), n=dim(ym), t=today(), st=settings();
  const keys=[...Array(n)].map((_,i)=>`${ym}-${pad(i+1)}`);
  const Y=peek('years',String(y)); const fut=(Y&&Y.f&&Y.f[pad(mm)])||[];
  let h=topbar(`Registro mensal · ${y}`,`<u>${MES[mm-1]}</u>`,navArrows('nmonth','mês'));
  h+=`<section><label class="lbl u" for="checkin">Check-in</label>
    <p class="hint">Como você está no começo do mês e onde quer chegar no final dele.</p>
    <textarea class="write" id="checkin" data-bind="months|${ym}|checkin" placeholder="Tudo que eu quero pra esse mês é…">${esc(M.checkin)}</textarea></section>
  <section class="blk"><span class="lbl">Metas do mês</span>${goalsByCat(`months|${ym}|goals`)}</section>
  <section class="blk"><span class="lbl">Tarefas do mês</span>${listHTML(`months|${ym}|tasks`,{empty:'Tarefas sem dia certo para este mês.'})}${addHTML(`months|${ym}|tasks`)}
   ${fut.length?`<p class="sublbl">Do registro futuro (Ano)</p>${listHTML(`years|${y}|f.${pad(mm)}`)}`:''}</section>
  <section class="blk"><span class="lbl">Hábitos do mês</span>
   <p class="hint">Resumo do mês. Para marcar, use a página completa do acompanhador.</p>
   <a class="btn" href="#habitos" style="text-decoration:none;margin-bottom:12px">${ICON.hab} Abrir acompanhador de hábitos</a>
   ${lineChart(keys)}
   <div class="scroll-x" hidden><table class="hab"><thead><tr><th></th><th class="v"><span>Sono</span></th><th class="v"><span>Produt.</span></th><th class="v"><span>Estresse</span></th>${st.habits.map(hb=>`<th class="v"><span>${esc(hb.n)}</span></th>`).join('')}</tr></thead>
   <tbody>${keys.map(k=>{const D=S.days[k]||{};const d=pd(k);return `<tr class="${k===t?'today':''}"><td class="d">${+k.slice(8)} ${DOW1[d.getDay()]}</td><td class="sl">${esc(D.sleep||'')}</td><td class="mt">${D.prod??''}</td><td class="mt">${D.stress??''}</td>
     ${st.habits.map(hb=>`<td><button data-act="habit" data-d="${k}" data-h="${hb.id}" aria-label="${esc(hb.n)} dia ${+k.slice(8)}" aria-pressed="${!!(D.habits||{})[hb.id]}">${(D.habits||{})[hb.id]?'●':''}</button></td>`).join('')}</tr>`}).join('')}</tbody>
   <tfoot><tr><td class="d">total</td><td></td><td></td><td></td>${st.habits.map(hb=>`<td class="mt">${keys.filter(k=>S.days[k]&&S.days[k].habits&&S.days[k].habits[hb.id]).length}</td>`).join('')}</tr></tfoot></table></div></section>
  <section class="blk"><label class="lbl u" for="reflect">Reflexão do mês</label><p class="hint">No fim do mês: o que funcionou, o que vale migrar para o próximo, o que deixar ir.</p>
   <textarea class="write" id="reflect" data-bind="months|${ym}|reflect">${esc(M.reflect)}</textarea></section>`;
  return h;
}

/* ================= ACOMPANHADOR DE HÁBITOS (modelo do guia) ================= */
const RH=26, GW=170, gx=v=>10+v*((GW-20)/10);
const SER=[['prod','Produtividade','','var(--red)'],['stress','Estresse','4 3','var(--ink)'],['mood','Humor','','var(--blue)']];
const sleepMin=s=>{const m=String(s||'').match(/(\d{1,2})\s*[h:]\s*(\d{0,2})/i);return m?(+m[1])*60+(+(m[2]||0)):null};
function viewHabitos(){
  const ym=ymOf(ui.cur),[y,mm]=ym.split('-').map(Number),n=dim(ym),t=today(),st=settings(),H=st.habits;
  const keys=[...Array(n)].map((_,i)=>`${ym}-${pad(i+1)}`), mk=ui.hm||'prod';
  const cols=`56px ${GW}px 64px repeat(${H.length},30px)`;
  const yy=i=>RH/2+i*RH;
  const lines=SER.map(([f,,dash,col])=>{let p='',dots='';keys.forEach((k,i)=>{const v=S.days[k]&&S.days[k][f];if(v==null)return;
      const prev=i>0&&S.days[keys[i-1]]&&S.days[keys[i-1]][f]!=null;p+=(prev&&p?'L':'M')+gx(+v).toFixed(1)+' '+yy(i);
      dots+=`<circle cx="${gx(+v).toFixed(1)}" cy="${yy(i)}" r="2.8" fill="${col}"/>`});
    return p?`<g><path d="${p}" fill="none" stroke="${col}" stroke-width="1.6" stroke-dasharray="${dash}" stroke-linejoin="round"/>${dots}</g>`:''}).join('');
  const ticks=[...Array(11)].map((_,v)=>`<line x1="${gx(v)}" x2="${gx(v)}" y1="${v%5?14:10}" y2="20" stroke="var(--ink)" stroke-width="1"/>`).join('');
  const sw=(dash,c)=>`<svg viewBox="0 0 30 10" aria-hidden="true"><line x1="2" x2="28" y1="5" y2="5" stroke="${c}" stroke-width="1.8" stroke-dasharray="${dash}"/><circle cx="2" cy="5" r="2.6" fill="${c}"/><circle cx="28" cy="5" r="2.6" fill="${c}"/></svg>`;
  const elapsed=keys.filter(k=>k<=t).length||n;
  const sl=keys.map(k=>sleepMin(S.days[k]&&S.days[k].sleep)).filter(v=>v!=null);
  const avg=sl.length?Math.round(sl.reduce((a,b)=>a+b,0)/sl.length):null;
  let body='';
  keys.forEach((k,i)=>{const d=pd(k),D=S.days[k]||{},r=i+1;
    if(k===t) body+=`<div class="todayrow" style="grid-row:${r};grid-column:1/-1"></div>`;
    body+=`<div class="dl ${d.getDay()%6===0?'we':''}" style="grid-row:${r};grid-column:1"><span style="width:18px;text-align:right">${i+1}</span><i>${DOW1[d.getDay()]}</i></div>`;
    body+=`<input class="sl" style="grid-row:${r};grid-column:3" id="sl-${k}" data-bind="days|${k}|sleep" value="${esc(D.sleep||'')}" aria-label="Sono dia ${i+1}" placeholder="·">`;
    H.forEach((hb,j)=>{const on=!!(D.habits||{})[hb.id];body+=`<button class="hb" style="grid-row:${r};grid-column:${4+j}" data-act="habit" data-d="${k}" data-h="${hb.id}" aria-pressed="${on}" aria-label="${esc(hb.n)} dia ${i+1}">${on?'•':''}</button>`});
  });
  const label=SER.find(s=>s[0]===mk)[1];
  body+=`<div class="gcell" style="grid-row:1/${n+1};grid-column:2"><svg width="${GW}" height="${n*RH}" aria-hidden="true">${lines}</svg>
    ${keys.map((k,i)=>`<button class="gr" style="top:${i*RH}px" data-act="setm" data-d="${k}" aria-label="${label} do dia ${i+1}: toque na posição de 0 a 10"></button>`).join('')}</div>`;
  let h=topbar(`Acompanhador de hábitos · ${y}`,`<u>${MES[mm-1]}</u>`,navArrows('nmonth','mês'));
  h+=`<p class="hint">Preencha todo dia: leva menos de 5 minutos. Escolha o que marcar no gráfico e toque na linha do dia, na altura de 0 a 10. Tocar no mesmo ponto apaga. As bolinhas da direita marcam os hábitos.</p>
  <div class="ht-legend" role="group" aria-label="O que marcar no gráfico">${SER.map(([f,l,d,c])=>`<button data-act="hmetric" data-m="${f}" aria-pressed="${mk===f}" style="color:${c}">${sw(d,c)}${l}</button>`).join('')}</div>
  <div class="scroll-x"><div class="ht">
   <div class="ht-head" style="grid-template-columns:${cols}">
     <div class="hd" style="font-size:17px;padding:0 4px 4px"><span class="lbl" style="font-size:15px;margin:0;padding:1px 6px">Hábitos</span></div>
     <div class="sc"><svg width="${GW}" height="22"><text x="${gx(0)-3}" y="9">0</text><text x="${gx(10)-7}" y="9">10</text>${ticks}</svg></div>
     <div class="sono">Sono</div>
     ${H.map(hb=>`<div class="vh hd"><span>${esc(hb.n)}</span></div>`).join('')}
   </div>
   <div class="ht-grid ht-body" style="grid-template-columns:${cols};grid-template-rows:repeat(${n},${RH}px)">${body}</div>
   <div class="ht-foot" style="grid-template-columns:${cols}"><div style="text-align:left;padding-left:6px">total</div><div></div>
     <div title="Média de sono">${avg!=null?`${Math.floor(avg/60)}h${pad(avg%60)}`:''}</div>
     ${H.map(hb=>{const c=keys.filter(k=>S.days[k]&&S.days[k].habits&&S.days[k].habits[hb.id]).length;return `<div title="${Math.round(c/elapsed*100)}% dos dias">${c}</div>`}).join('')}</div>
  </div></div>
  <section class="blk"><span class="lbl">Constância no mês</span>
   ${H.length?`<div class="metrics">${H.map(hb=>{const c=keys.filter(k=>k<=t&&S.days[k]&&S.days[k].habits&&S.days[k].habits[hb.id]).length;const pc=Math.round(c/elapsed*100);
     return `<div class="metric"><label>${esc(hb.n)}<output>${pc}%</output></label><div class="progress"><i style="width:${pc}%"></i></div></div>`}).join('')}</div>`:''}
   <form class="add" data-newhab style="margin-top:16px"><input type="text" name="t" id="newhab" placeholder="Novo hábito para acompanhar (ex.: Corrida)" autocomplete="off"><button class="btn small">Adicionar</button></form>
   <p class="hint">Renomeie ou remova hábitos em <a href="#ajustes">Ajustes</a>.</p></section>`;
  return h;
}

/* ================= ANO / REGISTRO FUTURO ================= */
function viewAno(){
  const y=+ui.cur.slice(0,4), Y=peek('years',String(y))||DEF.years(), t=today(), nowYm=ymOf(t);
  let h=topbar('Registro anual e futuro',`<u>${y}</u>`,navArrows('nyear','ano'));
  h+=`<section><label class="lbl u" for="word">Palavra do ano</label><input class="line" id="word" data-bind="years|${y}|word" value="${esc(Y.word)}" placeholder="Uma palavra que guia o ano"></section>
  <section class="blk"><span class="lbl">Metas do ano</span>${goalsByCat(`years|${y}|goals`)}</section>
  <section class="blk"><span class="lbl">Registro futuro</span><p class="hint">Anote o que vai acontecer nos próximos meses. Com dia definido, o item aparece direto naquele dia. Sem dia, fica na página do mês.</p>
  <div class="months">${MES.map((mn,i)=>{const ym=`${y}-${pad(i+1)}`;const ref=`years|${y}|f.${pad(i+1)}`;
    const dated=Object.keys(S.days).filter(k=>k.startsWith(ym)&&k>=t).sort().flatMap(k=>(S.days[k].items||[]).filter(it=>it.s==='open'&&(it.t==='event'||it.t==='task')&&k>t).map(it=>({it,k})));
    return `<div class="box ${ym===nowYm?'now':''}"><h5><a href="#mes" data-act="gomonth" data-ym="${ym}">${mn}</a></h5>
      ${dated.length?`<ul class="items">${dated.map(({it,k})=>itemHTML(it,`days|${k}|items`,{compact:true,extra:` <span style="color:var(--ink-2)">(${+k.slice(8)})</span>`})).join('')}</ul>`:''}
      ${listHTML(ref,{compact:true})}<div style="margin-top:auto">${addHTML(ref,{types:false,ph:'Item',extra:`<input class="dd" name="dd" inputmode="numeric" placeholder="dia" aria-label="Dia (opcional)">`})}</div></div>`}).join('')}</div></section>`;
  return h;
}

/* ================= COLEÇÕES ================= */
function ensureBuiltins(){ if(!S.cols.conteudo){S.cols.conteudo={title:'Registro de conteúdo',kind:'content',items:[],created:0}} }
function viewColecoes(){
  ensureBuiltins();
  if(ui.col) return viewColecao(ui.col);
  const st=settings();
  const list=Object.entries(S.cols).sort((a,b)=>(a[1].created||0)-(b[1].created||0));
  let h=topbar('Coleções','<u>Coleções</u>','');
  h+=`<p class="hint">Listas temáticas que não pertencem a um dia: livros, filmes, ideias de projeto, viagens. Cada coleção entra no índice automaticamente.</p>
  <div class="collist"><button class="colcard" data-act="opencol" data-c="__prompts"><b>Banco de prompts</b><small>${ALLP.length-st.usedPrompts.length} de ${ALLP.length} disponíveis</small></button>
  ${list.map(([id,c])=>`<button class="colcard" data-act="opencol" data-c="${id}"><b>${esc(c.title)}</b><small>${c.items.length} ${c.items.length===1?'item':'itens'}${c.kind==='content'?' · resenhas':''}</small></button>`).join('')}</div>
  <form class="add" data-newcol style="margin-top:18px"><input type="text" name="t" id="newcol" placeholder="Nome da nova coleção (ex.: Livros para ler)" autocomplete="off"><button class="btn">Criar coleção</button></form>`;
  return h;
}
function viewColecao(id){
  const back=`<button class="btn" data-act="opencol" data-c="">‹ Coleções</button>`;
  if(id==='__prompts'){
    const used=new Set(settings().usedPrompts); let n=0;
    return topbar('Coleção','<u>Banco de prompts</u>',back)+`<p class="hint">Perguntas que você responde escrevendo, para os dias sem inspiração. Usou um? Toque para riscar da lista.</p>`+
      PROMPTS.map(([g,l])=>`<section class="blk"><span class="lbl u">${g}</span><ul class="plist">${l.map(p=>{const i=n++;return `<li class="${used.has(i)?'used':''}"><span class="num">${i+1}</span><button data-act="ptoggle" data-i="${i}">${esc(p)}</button></li>`}).join('')}</ul></section>`).join('');
  }
  const C=S.cols[id]; if(!C){ui.col=null;return viewColecoes()}
  let h=topbar('Coleção',`<u>${esc(C.title)}</u>`,back+(id!=='conteudo'?`<button class="btn ghost" data-act="delcol" data-c="${id}">Apagar</button>`:''));
  if(C.kind==='content'){
    h+=`<p class="hint">Guarde o conteúdo bom que você viu por aí e escreva o que aprendeu. Funciona para vídeos, livros, filmes e podcasts.</p>
    ${(()=>{const E=(ui.editReg&&C.items.find(x=>x.id===ui.editReg))||{};const sel=(v,o)=>v===o?'selected':'';return `
    <form class="form" id="regform" data-content="${id}" ${E.id?`data-edit="${E.id}"`:''}>
      ${E.id?'<p class="full hand" style="margin:0;font-size:19px;color:var(--red)">Editando registro</p>':''}
      <label class="full">Conteúdo<input class="line" name="c" required placeholder="Título" value="${esc(E.c)}"></label>
      <label>Criador<input class="line" name="a" value="${esc(E.a)}"></label><label>Plataforma<input class="line" name="p" value="${esc(E.p)}"></label>
      <label>Tipo<select name="k">${['Vídeo','Texto','Podcast','Livro','Filme','Outro'].map(o=>`<option ${sel(E.k,o)}>${o}</option>`).join('')}</select></label>
      <label>Data<input class="line" type="date" name="d" value="${esc(E.d||today())}"></label>
      <label>Avaliação<select name="r">${[5,4,3,2,1].map(v=>`<option value="${v}" ${sel(+E.r,v)}>${'★'.repeat(v)}${'☆'.repeat(5-v)}</option>`).join('')}</select></label>
      <label class="full">Resenha<textarea class="write short" name="b" placeholder="O que aprendi, gostei ou refleti…">${esc(E.b)}</textarea></label>
      <label class="full">Obs.<input class="line" name="o" value="${esc(E.o)}"></label>
      <div class="full" style="display:flex;gap:8px"><button class="btn primary">${E.id?'Salvar alterações':'Salvar registro'}</button>${E.id?'<button type="button" class="btn ghost" data-act="cancelreg">Cancelar</button>':''}</div></form>`})()}
    ${C.items.slice().reverse().map(r=>`<article class="reg"><header>Registro de conteúdo<span style="position:absolute;right:4px;top:3px;display:flex;gap:2px"><button class="btn small ghost" data-act="editreg" data-id="${r.id}" style="position:static">Editar</button><button class="btn small ghost" data-act="delreg" data-c="${id}" data-id="${r.id}" aria-label="Apagar registro" style="position:static">×</button></span></header>
      <div class="row"><div><small>Conteúdo</small><span class="v">${esc(r.c)}</span></div><div><small>Criador</small><span class="v">${esc(r.a)}</span></div><div><small>Plataforma</small><span class="v">${esc(r.p)}</span></div></div>
      <div class="row"><div><small>Tipo</small><span class="v">${esc(r.k)}</span></div><div><small>Avaliação</small><span class="stars">${'★'.repeat(r.r)}${'☆'.repeat(5-r.r)}</span></div><div><small>Data</small><span class="v">${r.d?ddmm(r.d)+'/'+r.d.slice(0,4):''}</span></div></div>
      ${r.b?`<div class="body">${esc(r.b)}</div>`:''}${r.o?`<div class="body" style="border-top:1px solid var(--line)"><small style="display:inline">Obs.: </small>${esc(r.o)}</div>`:''}</article>`).join('')||'<p class="empty">Nenhum registro ainda.</p>'}`;
  } else {
    h+=`<label class="sublbl" for="ctitle">Nome</label><input class="line" id="ctitle" data-bind="cols|${id}|title" value="${esc(C.title)}">
    <section class="blk">${listHTML(`cols|${id}|items`,{empty:'Lista vazia. Adicione o primeiro item abaixo.'})}${addHTML(`cols|${id}|items`)}</section>`;
  }
  return h;
}

/* ================= ÍNDICE ================= */
function allEntries(){
  const out=[];
  for(const [k,D] of Object.entries(S.days)){(D.items||[]).forEach(it=>out.push({where:ddmm(k)+'/'+k.slice(2,4),text:it.text,go:['dia',k]}));if(D.thermo)out.push({where:ddmm(k)+' ≡',text:D.thermo,go:['dia',k]});if(D.intent)out.push({where:ddmm(k),text:D.intent,go:['dia',k]})}
  for(const [k,W] of Object.entries(S.weeks)){[...(W.goals||[]),...(W.next||[])].forEach(it=>out.push({where:'Sem. '+isoWeek(k),text:it.text,go:['semana',k]}));['focus','checkout'].forEach(f=>W[f]&&out.push({where:'Sem. '+isoWeek(k),text:W[f],go:['semana',k]}))}
  for(const [k,M] of Object.entries(S.months)){[...(M.goals||[]),...(M.tasks||[])].forEach(it=>out.push({where:MES[+k.slice(5)-1].slice(0,3)+' '+k.slice(2,4),text:it.text,go:['mes',k+'-01']}));['checkin','reflect'].forEach(f=>M[f]&&out.push({where:MES[+k.slice(5)-1].slice(0,3)+' '+k.slice(2,4),text:M[f],go:['mes',k+'-01']}))}
  for(const [k,Y] of Object.entries(S.years)){(Y.goals||[]).forEach(it=>out.push({where:'Ano '+k,text:it.text,go:['ano',k+'-01-01']}));Object.values(Y.f||{}).flat().forEach(it=>out.push({where:'Futuro '+k,text:it.text,go:['ano',k+'-01-01']}))}
  for(const [id,C] of Object.entries(S.cols)){C.items.forEach(it=>out.push({where:C.title.slice(0,14),text:it.text||[it.c,it.a,it.b,it.o].filter(Boolean).join(' · '),go:['colecoes',null,id]}))}
  return out;
}
function viewIndice(){
  const tags={}; for(const e of allEntries()){(e.text.match(/#[\wÀ-ÿ\-]+/g)||[]).forEach(t=>{t=t.toLowerCase();tags[t]=(tags[t]||0)+1})}
  const years=[...new Set([...Object.keys(S.days).map(k=>k.slice(0,4)),...Object.keys(S.months).map(k=>k.slice(0,4)),today().slice(0,4)])].sort().reverse();
  let h=topbar('Para consultas futuras','<u>Índice</u>','');
  h+=`<input class="idx-search" id="idxq" type="search" placeholder="Buscar em todo o caderno…" value="${esc(ui.q)}" aria-label="Buscar"><div id="idxres">${idxResults()}</div>
  <div class="idx" style="margin-top:26px"><section><span class="lbl">Páginas</span>
   ${years.map(y=>{const months=[...Array(12)].map((_,i)=>`${y}-${pad(i+1)}`).filter(ym=>Object.keys(S.days).some(k=>k.startsWith(ym)&&hasContent(S.days[k]))||S.months[ym]);
     return `<ul class="toc"><li><a href="#ano" data-act="goyear" data-y="${y}"><span>Ano ${y} e registro futuro</span><span class="dots"></span><span class="pg">${y}</span></a></li>
     ${months.map(ym=>{const ds=Object.keys(S.days).filter(k=>k.startsWith(ym)&&hasContent(S.days[k])).sort();
       return `<li><a href="#mes" data-act="gomonth" data-ym="${ym}"><span>${MES[+ym.slice(5)-1]}</span><span class="dots"></span><span class="pg">${ds.length} dias</span></a></li>${ds.length?`<li><div class="daychips">${ds.map(k=>`<a href="#dia" data-act="goday" data-d="${k}">${+k.slice(8)}</a>`).join('')}</div></li>`:''}`}).join('')}</ul>`}).join('')}
   </section><section><span class="lbl">Coleções</span><ul class="toc"><li><a href="#colecoes" data-act="opencol" data-c="__prompts"><span>Banco de prompts</span><span class="dots"></span><span class="pg">${ALLP.length}</span></a></li>
   ${Object.entries(S.cols).map(([id,c])=>`<li><a href="#colecoes" data-act="opencol" data-c="${id}"><span>${esc(c.title)}</span><span class="dots"></span><span class="pg">${c.items.length}</span></a></li>`).join('')}</ul>
   <span class="lbl" style="margin-top:22px">Temas (#)</span>${Object.keys(tags).length?`<ul class="toc">${Object.entries(tags).sort().map(([t,n])=>`<li><a href="#indice" data-act="tagq" data-t="${esc(t)}"><span class="tag">${esc(t)}</span><span class="dots"></span><span class="pg">${n}</span></a></li>`).join('')}</ul>`:'<p class="hint">Escreva <b>#tema</b> em qualquer item (ex.: #viagem, #trabalho) e ele aparece aqui, reunindo tudo daquele assunto.</p>'}</section></div>`;
  return h;
}
const hasContent=D=>D&&((D.items&&D.items.length)||D.thermo||D.intent);
function idxResults(){
  const q=ui.q.trim().toLowerCase(); if(!q) return '';
  const r=allEntries().filter(e=>e.text.toLowerCase().includes(q)).slice(0,80);
  if(!r.length) return `<p class="empty">Nada encontrado para “${esc(ui.q)}”.</p>`;
  const hl=s=>{const t=esc(s.length>140?s.slice(0,140)+'…':s);return t.replace(new RegExp(esc(q).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'),m=>`<mark>${m}</mark>`)};
  return `<ul class="res">${r.map(e=>`<li><a href="#${e.go[0]}" data-act="goentry" data-v="${e.go[0]}" data-d="${e.go[1]||''}" data-c="${e.go[2]||''}"><small>${esc(e.where)}</small><span>${hl(e.text)}</span></a></li>`).join('')}</ul>`;
}

/* ================= CHAVE ================= */
function viewChave(){
  return topbar('Legenda do método','<u>Chave</u>','')+`<div class="key">
  <section><span class="lbl">Registro rápido</span><dl><dt>•</dt><dd>Tarefa</dd><dt>○</dt><dd>Evento / hora marcada</dd><dt>–</dt><dd>Nota, lembrete rápido</dd><dt>~</dt><dd>Ideias soltas, rabiscos</dd><dt>≡</dt><dd>Termômetro do dia</dd></dl></section>
  <section><span class="lbl">Status e modificadores</span><dl><dt>×</dt><dd>Tarefa cumprida</dd><dt>⊗</dt><dd>Evento realizado</dd><dt>&gt;</dt><dd>Migrada (adiada)</dd><dt>&lt;</dt><dd>Agendada para outra data</dd><dt style="text-decoration:line-through">•</dt><dd style="text-decoration:line-through">Cancelada</dd><dt style="color:var(--red)">✱</dt><dd>Importante</dd><dt><span class="badge">↻</span></dt><dd>Veio de outro dia</dd></dl></section></div>
  <div class="prose"><h3>Como usar no dia a dia</h3>
  <p><b>Toque no símbolo</b> de uma tarefa para marcá-la como feita (×). Toque de novo para desfazer. No <b>⋯</b> você marca como importante, adia, agenda, risca, edita ou apaga.</p>
  <h3>Migração automática</h3><p>Toda tarefa (•) que ficar aberta passa sozinha para o dia seguinte. Ela vai para o topo da lista, destacada, com um selo dizendo há quantos dias espera. No dia original ela fica marcada com &gt;. Depois de 3 dias o caderno pergunta se ainda vale a pena. No método, migrar é um filtro: o que não merece ser reescrito pode ser riscado.</p>
  <h3>Ritmo do método</h3><p><b>Diário:</b> registre ao longo do dia e feche com o termômetro. <b>Semanal:</b> no domingo ou segunda, escreva o foco e as metas da semana; no fim, faça o check-out. <b>Mensal:</b> abra o mês com o check-in e as metas por área da vida; feche com a reflexão. <b>Anual:</b> metas do ano e registro futuro para o que vem pela frente.</p>
  <h3>Atalhos</h3><p><b>No celular:</b> deslize para o lado na página para ir ao dia, semana, mês ou ano anterior ou seguinte. <b>No computador:</b> setas ← → navegam, <b>H</b> volta para hoje, <b>N</b> começa a escrever um item novo e <b>1</b> a <b>7</b> abrem Dia, Semana, Mês, Hábitos, Ano, Coleções e Índice.</p>
  <h3>Índice</h3><p>O índice se monta sozinho com anos, meses, dias preenchidos e coleções. Use <b>#tema</b> nos itens para agrupar assuntos e a busca para achar qualquer coisa.</p></div>`;
}

/* ================= AJUSTES ================= */
function viewAjustes(){
  const st=settings();
  return topbar('Seu caderno do seu jeito','<u>Ajustes</u>','')+`
  <section><span class="lbl">Letra</span><p class="hint">A letra do guia é feita à mão. A primeira opção é a mais parecida com ela.</p>
   <div class="fontopt">${FONTS.map(([f,d])=>`<button data-act="font" data-f="${f}" aria-pressed="${st.font===f}"><span style="font-family:'${f}',cursive">Quarta-feira, 10/12</span><small>${f} · ${d}</small></button>`).join('')}</div></section>
  <section class="blk"><span class="lbl">Dicas</span><p class="hint">As explicações em cinza ficam escondidas para a página ficar limpa, como um caderno.</p>
   <button class="btn small" data-act="hints" aria-pressed="${!!st.hints}">${st.hints?'Esconder dicas':'Mostrar dicas'}</button></section>
  <section class="blk"><span class="lbl">Hábitos</span><p class="hint">Aparecem no dia e no acompanhador do mês.</p>
   ${st.habits.map((hb,i)=>`<div class="set-row"><input class="line" data-hab="${i}" value="${esc(hb.n)}" aria-label="Hábito ${i+1}"><button class="btn small ghost" data-act="delhab" data-i="${i}">Remover</button></div>`).join('')}
   <form class="add" data-newhab><input type="text" name="t" id="newhab" placeholder="Novo hábito (ex.: Corrida)" autocomplete="off"><button class="btn small">Adicionar</button></form></section>
  <section class="blk"><span class="lbl">Áreas das metas</span><p class="hint">As 5 categorias usadas nas metas do mês e do ano. Personalize com as áreas mais importantes da sua vida.</p>
   ${st.cats.map((c,i)=>`<div class="set-row"><span style="width:22px;display:inline-flex">${ICON[c.i]}</span><input class="line" data-cat="${i}" value="${esc(c.n)}" aria-label="Área ${i+1}"></div>`).join('')}</section>
  <section class="blk"><span class="lbl">Conta</span><p class="hint">Conectado como <b>${esc(currentUser&&(currentUser.email||currentUser.displayName)||'convidado')}</b>.</p>
   <button class="btn" data-act="logout">Sair</button></section>
  <section class="blk"><span class="lbl">Backup</span><p class="hint">${mode==='cloud'?'Seu caderno fica salvo na sua conta e aparece igual no computador e no celular. Só você vê os seus dados.':'Neste modo o caderno fica salvo só neste navegador.'} Exporte de vez em quando para guardar uma cópia.</p>
   <div class="set-row"><button class="btn" data-act="export">Exportar backup (.json)</button><label class="btn" for="imp">Importar backup</label><input type="file" id="imp" accept=".json,application/json" hidden></div></section>`;
}

/* ================= render ================= */
let renderQueued=false;
function render(){
  if(!ready) return;
  ui.lastDay=ui.lastDay||today();
  const v=ui.view; const f={dia:viewDia,semana:viewSemana,mes:viewMes,habitos:viewHabitos,ano:viewAno,colecoes:viewColecoes,indice:viewIndice,chave:viewChave,ajustes:viewAjustes}[v]||viewDia;
  const y=window.scrollY;
  const pg=document.getElementById('page'); pg.dataset.v=v; document.body.classList.toggle('hints',!!settings().hints);
  pg.innerHTML=f(); pg.querySelectorAll('textarea.grow').forEach(grow);
  document.getElementById('side').innerHTML=sideHTML();
  document.getElementById('tabs').innerHTML=tabsHTML();
  window.scrollTo(0,y);
  const e=document.getElementById('edit-in'); if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}
  if(ui.refocus){const el=document.getElementById(ui.refocus);if(el)el.focus({preventScroll:true});ui.refocus=null}
}
function grow(t){t.style.height='auto';t.style.height=t.scrollHeight+'px'}
const regrow=()=>document.querySelectorAll('textarea.grow').forEach(grow);
if(document.fonts&&document.fonts.ready) document.fonts.ready.then(regrow);
window.addEventListener('resize',regrow);
function softRender(){
  const a=document.activeElement;
  if(a&&(a.tagName==='TEXTAREA'||(a.tagName==='INPUT'&&a.type!=='range'&&a.type!=='file'))&&a.value){renderQueued=true;return}
  if(a&&a.id) ui.refocus=a.id;
  render();
}
document.addEventListener('focusout',()=>{if(renderQueued){setTimeout(()=>{const a=document.activeElement;if(!(a&&(a.tagName==='TEXTAREA'||a.tagName==='INPUT'))){renderQueued=false;render()}},50)}});
const squig=()=>`<svg class="squig" style="right:-14px;top:-10px;width:150px" viewBox="0 0 150 60" aria-hidden="true"><path d="M2 40c20-30 40 10 60-8s30-30 50-10 18 24 36 10" fill="none" stroke="var(--yellow)" stroke-width="3" stroke-linecap="round"/></svg>`;
function applyFont(){const f=settings().font||'Schoolbell';document.documentElement.style.setProperty('--hand',`'${f}','Schoolbell','Coming Soon',cursive`)}
let toastT; function toast(m){let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');document.body.appendChild(el)}el.textContent=m;clearTimeout(toastT);toastT=setTimeout(()=>el.remove(),3200)}

/* ================= menu de item ================= */
function closePop(){document.getElementById('popwrap').innerHTML=''}
function openMenu(btn,ref,id){
  const it=getList(ref).find(x=>x.id===id); if(!it) return;
  const isDay=ref.startsWith('days|'); const k=isDay?ref.split('|')[1]:null;
  const r=btn.getBoundingClientRect();
  const opts=[
    ['imp','✱',it.imp?'Tirar importância':'Marcar como importante'],
    isDay?['tomorrow','&gt;','Adiar para amanhã']:['today','&gt;','Trazer para hoje'],
    ['schedask','&lt;','Agendar para uma data…'],
    ['cancel','<s>•</s>',it.s==='cancelled'?'Desfazer risco':'Riscar (não vale mais a pena)'],
    ['sep'],
    ['type','~','Mudar tipo ('+({task:'tarefa',event:'evento',note:'nota',idea:'ideia'}[it.t])+')'],
    ['edit','✎','Editar texto'],['del','×','Apagar']];
  const html=`<div class="pop" role="menu" data-ref="${ref}" data-id="${id}">${opts.map(o=>o[0]==='sep'?'<div class="sep"></div>':`<button role="menuitem" data-act="m-${o[0]}"><span class="k">${o[1]}</span>${o[2]}</button>`).join('')}
   <div class="dt" id="schedrow" hidden><input type="date" id="scheddate" value="${addD(k||today(),1)}" aria-label="Data"><button class="btn small primary" data-act="m-sched">Agendar</button></div></div>`;
  const w=document.getElementById('popwrap'); w.innerHTML=html; const p=w.firstChild;
  const pw=p.offsetWidth,ph=p.offsetHeight; let left=Math.min(r.right-pw,window.innerWidth-pw-12); left=Math.max(12,left);
  let top=r.bottom+4; if(top+ph>window.innerHeight-12) top=Math.max(12,r.top-ph-4);
  p.style.left=left+'px'; p.style.top=top+'px'; p.querySelector('button').focus();
}

/* ================= eventos ================= */
document.addEventListener('click',e=>{
  const pop=document.querySelector('.pop');
  if(pop&&!pop.contains(e.target)&&!e.target.closest('[data-act="menu"]')) closePop();
  const b=e.target.closest('[data-act]'); if(!b) return;
  const act=b.dataset.act; const li=b.closest('[data-ref][data-id]'); const ref=li&&li.dataset.ref, id=li&&li.dataset.id;
  const find=()=>getList(ref).find(x=>x.id===id);
  switch(act){
    case 'tog':{const it=find();if(!it)break;
      if(it.t==='task'||it.t==='event'){ if(it.s==='open') it.s='done'; else if(it.s==='done'||it.s==='cancelled') it.s='open'; else {toast(it.s==='migrated'?'Este item foi migrado. Marque-o no dia para onde foi.':'Este item foi agendado para '+ddmm(it.to)+'.');break} }
      else {ui.editing={ref,id}}
      touchRef(ref);render();break}
    case 'menu': openMenu(b,ref,id);break;
    case 'ack':{const it=find();it.ack=true;it.imp=true;touchRef(ref);render();break}
    case 'sched':{const btn=document.querySelector(`.it[data-ref="${CSS.escape(ref)}"][data-id="${CSS.escape(id)}"] .more`);openMenu(btn,ref,id);document.getElementById('schedrow').hidden=false;document.getElementById('scheddate').focus();break}
    case 'cancel':{const it=find();it.s='cancelled';touchRef(ref);render();break}
    case 'm-imp':{const it=find();it.imp=!it.imp;touchRef(ref);closePop();render();break}
    case 'm-tomorrow':{const k=ref.split('|')[1];moveItem(ref,id,addD(k,1),'migrated');closePop();toast('Adiado para amanhã');render();break}
    case 'm-today':{moveItem(ref,id,today(),'migrated');closePop();toast('Levado para hoje');render();break}
    case 'm-schedask':{document.getElementById('schedrow').hidden=false;document.getElementById('scheddate').focus();break}
    case 'm-sched':{const d=document.getElementById('scheddate').value;if(!d)break;moveItem(ref,id,d,'scheduled');closePop();toast('Agendado para '+ddmm(d));render();break}
    case 'm-cancel':{const it=find();it.s=it.s==='cancelled'?'open':'cancelled';touchRef(ref);closePop();render();break}
    case 'm-type':{const it=find();const o=['task','event','note','idea'];it.t=o[(o.indexOf(it.t)+1)%4];touchRef(ref);closePop();render();break}
    case 'm-edit':{ui.editing={ref,id};closePop();render();break}
    case 'm-del':{const l=getList(ref);const i=l.findIndex(x=>x.id===id);const [gone]=l.splice(i,1);touchRef(ref);closePop();render();
      undo(()=>{getList(ref).splice(i,0,gone);touchRef(ref);render()},'Item apagado');break}
    case 'atype':{const f=b.closest('form');ui.addType[f.dataset.ref]=b.dataset.t;f.querySelectorAll('[data-act="atype"]').forEach(x=>x.setAttribute('aria-pressed',x===b));f.querySelector('input[type=text]').focus();break}
    case 'aimp':{const f=b.closest('form');const v=!ui.addImp[f.dataset.ref];ui.addImp[f.dataset.ref]=v;b.setAttribute('aria-pressed',v);f.querySelector('input[type=text]').focus();break}
    case 'habit':{const D=doc('days',b.dataset.d);D.habits=D.habits||{};D.habits[b.dataset.h]=!D.habits[b.dataset.h];touch('days',b.dataset.d);render();break}
    case 'editreg':{ui.editReg=b.dataset.id;render();document.getElementById('regform')?.scrollIntoView({behavior:'smooth',block:'start'});break}
    case 'cancelreg':{ui.editReg=null;render();break}
    case 'hmetric':{ui.hm=b.dataset.m;render();break}
    case 'setm':{const r=b.getBoundingClientRect();const f=ui.hm||'prod';let v=Math.round((e.clientX-r.left-10)/((GW-20)/10));v=Math.max(0,Math.min(10,v));
      const D=doc('days',b.dataset.d);D[f]=D[f]===v?null:v;touch('days',b.dataset.d);render();break}
    case 'prompt':{const used=new Set(settings().usedPrompts);const pool=ALLP.map((_,i)=>i).filter(i=>!used.has(i)&&i!==ui.prompt);ui.prompt=(pool.length?pool:ALLP.map((_,i)=>i))[Math.floor(Math.random()*(pool.length||ALLP.length))];render();break}
    case 'useprompt':{const st=settings();if(!st.usedPrompts.includes(ui.prompt))st.usedPrompts.push(ui.prompt);touch('meta','settings');
      const D=doc('days',ui.cur);D.thermo=(D.thermo?D.thermo+'\n\n':'')+ALLP[ui.prompt]+'\n';touch('days',ui.cur);ui.prompt=null;ui.refocus='thermo';render();break}
    case 'ptoggle':{const st=settings();const i=+b.dataset.i;const j=st.usedPrompts.indexOf(i);j>=0?st.usedPrompts.splice(j,1):st.usedPrompts.push(i);touch('meta','settings');render();break}
    case 'nday':{const n=+b.dataset.n;ui.cur=n?addD(ui.cur,n):today();ui.prompt=null;render();break}
    case 'nweek':{const n=+b.dataset.n;ui.cur=n?addD(ui.cur,7*n):today();render();break}
    case 'nmonth':{const n=+b.dataset.n;ui.cur=n?addM(ymOf(ui.cur),n)+'-01':today();render();break}
    case 'nyear':{const n=+b.dataset.n;ui.cur=n?`${+ui.cur.slice(0,4)+n}-01-01`:today();render();break}
    case 'mini':{ui.miniYm=addM(ui.miniYm,+b.dataset.n);render();break}
    case 'goday':e.preventDefault();ui.miniYm=ymOf(b.dataset.d);go('dia',b.dataset.d);break;
    case 'gomonth':e.preventDefault();go('mes',b.dataset.ym+'-01');break;
    case 'goyear':e.preventDefault();go('ano',b.dataset.y+'-01-01');break;
    case 'goentry':e.preventDefault();if(b.dataset.c){ui.col=b.dataset.c}go(b.dataset.v,b.dataset.d||null);break;
    case 'tagq':e.preventDefault();ui.q=b.dataset.t;render();window.scrollTo(0,0);break;
    case 'opencol':e.preventDefault();ui.col=b.dataset.c||null;go('colecoes');break;
    case 'delcol':{const c=b.dataset.c;const gone=S.cols[c];delete S.cols[c];flush('cols',c);ui.col=null;render();undo(()=>{S.cols[c]=gone;touch('cols',c);render()},'Coleção apagada');break}
    case 'delreg':{const C=S.cols[b.dataset.c];const i=C.items.findIndex(x=>x.id===b.dataset.id);const [gone]=C.items.splice(i,1);touch('cols',b.dataset.c);render();undo(()=>{C.items.splice(i,0,gone);touch('cols',b.dataset.c);render()},'Registro apagado');break}
    case 'hints':{settings().hints=!settings().hints;touch('meta','settings');render();break}
    case 'font':{settings().font=b.dataset.f;touch('meta','settings');applyFont();render();break}
    case 'delhab':{const st=settings();const [gone]=st.habits.splice(+b.dataset.i,1);touch('meta','settings');render();undo(()=>{st.habits.splice(+b.dataset.i,0,gone);touch('meta','settings');render()},'Hábito removido');break}
    case 'export':exportData();break;
    case 'login':doLogin();break;
    case 'loginanon':signInAnonymously(auth);break;
    case 'logout':signOut(auth);break;
    case 'undo':if(undoFn){const f=undoFn;undoFn=null;f();document.querySelector('.toast')?.remove()}break;
  }
});
let undoFn=null;
function undo(fn,msg){undoFn=fn;let el=document.querySelector('.toast');if(!el){el=document.createElement('div');el.className='toast';el.setAttribute('role','status');document.body.appendChild(el)}
  el.innerHTML=`${esc(msg)} <button class="btn small" data-act="undo" style="margin-left:8px;background:var(--paper);color:var(--ink)">Desfazer</button>`;clearTimeout(toastT);toastT=setTimeout(()=>{el.remove();undoFn=null},6000)}

document.addEventListener('submit',e=>{
  e.preventDefault(); const f=e.target;
  if(f.dataset.ref){
    const inp=f.querySelector('input[type=text]'); const v=inp.value.trim(); if(!v) return;
    let ref=f.dataset.ref, cat=null; if(ref.includes('#')){[ref,cat]=ref.split('#')}
    const it=parseEntry(v,ui.addType[f.dataset.ref],ui.addImp[f.dataset.ref]); if(cat) it.cat=cat;
    const dd=f.querySelector('[name=dd]');
    if(dd&&dd.value.trim()){ // registro futuro com dia
      const [,y,path]=ref.split('|'); const m=path.split('.')[1]; const day=Math.min(Math.max(1,parseInt(dd.value,10)||1),dim(`${y}-${m}`));
      const k=`${y}-${m}-${pad(day)}`; doc('days',k).items.push(it); touch('days',k); toast(`Anotado em ${ddmm(k)}`);
    } else { getList(ref).push(it); touchRef(ref); }
    ui.addImp[f.dataset.ref]=false; ui.refocus=inp.id; render();
  } else if(f.hasAttribute('data-newcol')){
    const v=f.t.value.trim(); if(!v) return; const id='c'+uid(); S.cols[id]={title:v,kind:'list',items:[],created:Date.now()}; touch('cols',id); ui.col=id; render();
  } else if(f.hasAttribute('data-newhab')){
    const v=f.t.value.trim(); if(!v) return; settings().habits.push({id:'h'+uid(),n:v}); touch('meta','settings'); ui.refocus='newhab'; render();
  } else if(f.dataset.content){
    const fd=new FormData(f); const id=f.dataset.content; const r={id:uid()}; for(const k of ['c','a','p','k','d','r','b','o']) r[k]=fd.get(k)||''; r.r=+r.r||5;
    const items=S.cols[id].items, ei=f.dataset.edit?items.findIndex(x=>x.id===f.dataset.edit):-1;
    if(ei>=0){r.id=items[ei].id;items[ei]=r;ui.editReg=null;touch('cols',id);render();toast('Registro atualizado')}
    else{items.push(r); touch('cols',id); render(); toast('Registro salvo')}
  }
});
document.addEventListener('input',e=>{
  const t=e.target;
  if(t.classList.contains('grow')) grow(t);
  if(t.dataset.bind){const [col,id,field]=t.dataset.bind.split('|');const o=doc(col,id);
    if(t.hasAttribute('data-num')){o[field]=+t.value;t.style.opacity=1;const out=t.parentElement.querySelector('output');if(out)out.textContent=t.value}else o[field]=t.value;
    touch(col,id); if(col==='cols'&&field==='title'){}
  } else if(t.dataset.hab!=null){settings().habits[+t.dataset.hab].n=t.value;touch('meta','settings')}
  else if(t.dataset.cat!=null){settings().cats[+t.dataset.cat].n=t.value;touch('meta','settings')}
  else if(t.id==='idxq'){ui.q=t.value;document.getElementById('idxres').innerHTML=idxResults()}
});
document.addEventListener('change',e=>{
  if(e.target.id==='imp'&&e.target.files[0]) importData(e.target.files[0]);
  if(e.target.type==='range'&&ui.view==='dia') {/* valor já salvo */}
});
document.addEventListener('keydown',e=>{
  const t=e.target;
  if(t.id==='edit-in'){
    if(e.key==='Enter'){const it=getList(t.dataset.ref).find(x=>x.id===t.dataset.id);if(it&&t.value.trim()){it.text=t.value.trim();touchRef(t.dataset.ref)}ui.editing=null;render()}
    if(e.key==='Escape'){ui.editing=null;render()}
  }
  if(e.key==='Escape') closePop();
});
document.addEventListener('focusout',e=>{
  if(e.target.id==='edit-in'){const t=e.target;setTimeout(()=>{if(ui.editing&&document.activeElement!==t){const it=getList(t.dataset.ref).find(x=>x.id===t.dataset.id);if(it&&t.value.trim()&&it.text!==t.value.trim()){it.text=t.value.trim();touchRef(t.dataset.ref)}ui.editing=null;render()}},120)}
});
window.addEventListener('scroll',()=>{if(document.querySelector('.pop'))closePop()},{passive:true});

/* ================= atalhos e gesto de deslizar ================= */
const STEP={dia:'nday',semana:'nweek',mes:'nmonth',habitos:'nmonth',ano:'nyear'};
function step(n){const a=STEP[ui.view];if(!a)return;const b=document.createElement('button');b.dataset.act=a;b.dataset.n=n;b.hidden=true;document.getElementById('page').appendChild(b);b.click();}
document.addEventListener('keydown',e=>{
  if(e.metaKey||e.ctrlKey||e.altKey||!ready||!uidCur) return;
  const t=e.target; if(t.closest&&t.closest('input,textarea,select,[contenteditable]')) return;
  if(document.querySelector('.pop')) return;
  if(e.key==='ArrowLeft'){e.preventDefault();step(-1)}
  else if(e.key==='ArrowRight'){e.preventDefault();step(1)}
  else if(e.key==='h'||e.key==='H'){step(0)}
  else if(e.key==='n'||e.key==='N'){const i=document.querySelector('#page form.add input[type=text]');if(i){e.preventDefault();i.focus();i.scrollIntoView({block:'center',behavior:'smooth'})}}
  else {const map={'1':'dia','2':'semana','3':'mes','4':'habitos','5':'ano','6':'colecoes','7':'indice'};if(map[e.key])go(map[e.key])}
});
let tx0=null,ty0=null,tt0=0;
document.addEventListener('touchstart',e=>{const t=e.target;if(e.touches.length!==1||t.closest('.scroll-x,input,textarea,select,.pop,.gcell,input[type=range]')){tx0=null;return}tx0=e.touches[0].clientX;ty0=e.touches[0].clientY;tt0=Date.now()},{passive:true});
document.addEventListener('touchend',e=>{if(tx0==null)return;const dx=e.changedTouches[0].clientX-tx0,dy=e.changedTouches[0].clientY-ty0;tx0=null;
  if(Date.now()-tt0<600&&Math.abs(dx)>70&&Math.abs(dy)<45){step(dx<0?1:-1)}},{passive:true});

/* ================= backup ================= */
async function exportData(){
  const json=JSON.stringify({app:'bullet-journal',v:1,exported:new Date().toISOString(),data:S},null,1);
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([json],{type:'application/json'}));
  a.download=`bullet-journal-${today()}.json`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),2000); toast('Backup exportado');
}
function importData(file){
  const r=new FileReader();
  r.onload=()=>{try{const j=JSON.parse(r.result);const d=j.data||j;let n=0;
    for(const c of COLS){for(const [id,v] of Object.entries(d[c]||{})){S[c][id]=v;touch(c,id);n++}}
    applyFont();render();toast(`Backup importado: ${n} páginas`)}catch(e){toast('Arquivo inválido. Escolha um backup .json exportado daqui.')}};
  r.readAsText(file);
}

/* ================= start ================= */
const h0=location.hash.slice(1); if(VIEWS.some(v=>v[0]===h0)) ui.view=h0;
init();
