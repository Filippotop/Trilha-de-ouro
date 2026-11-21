/* STUDY HUB ATELIÊ 3.0
 * Aditivo, não invasivo: lê as chaves originais sem escrevê-las e grava somente
 * em chaves novas. Nenhum listener, identificador ou cálculo anterior é alterado.
 */
(() => {
'use strict';
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const PREF_KEY='trilha-ouro-studyhub-preferences-v1';
const LEDGER_KEY='trilha-ouro-studyhub-ledger-v1';
const DOODLE_KEY='trilha-ouro-studyhub-doodle-v1';
const COVER_KEY='trilha-ouro-studyhub-cover-v1';
const ORIGINAL_KEY='trilha-questoes-ouro-unificada-1';
const allowedStickerTypes=['sakura','cat','tea','star','bow','feito','foco','atrasado'];
const blocks=[
  {id:'briefing',selector:'#page-hoje>.briefing-preview',title:'Briefing rápido'},
  {id:'plan',selector:'#page-hoje>.hero',title:'Plano do dia'},
  {id:'consistency',selector:'#studyhub-consistency',title:'Constância em quadradinhos'},
  {id:'execution',selector:'#page-hoje>.dash-layout',title:'Execução e avaliações'},
  {id:'doodle',selector:'#studyhub-doodle',title:'Rabiscos / BuJo'}
];
const DEFAULT={version:1,mode:'atelier',cover:'gradient',coverUrl:'',paper:'plain',palette:'sakura',font:'jakarta',accent:'#E27D9E',customAccent:false,density:'comfortable',range:90,goal:5,
  washi:false,tape:'gingham',tapeTargets:['consistency'],stickers:[],stickerUnlocked:false,atmosphere:false,bujoVisible:false,
  order:blocks.map(b=>b.id),visible:{briefing:true,plan:true,consistency:true,execution:true,doodle:false}};
function readJSON(key,fb){try{const raw=localStorage.getItem(key);return raw?JSON.parse(raw):fb;}catch(_){return fb;}}
function writeJSON(key,obj){try{localStorage.setItem(key,JSON.stringify(obj));return true;}catch(_){message('Armazenamento local indisponível ou cheio. Os dados anteriores permanecem intactos.');return false;}}
const rawPref=readJSON(PREF_KEY,{});
const pref={...DEFAULT,...(rawPref&&typeof rawPref==='object'?rawPref:{}),visible:{...DEFAULT.visible,...(rawPref?.visible||{})},
  order:Array.isArray(rawPref?.order)&&new Set(rawPref.order).size===blocks.length&&blocks.every(b=>rawPref.order.includes(b.id))?rawPref.order.slice():DEFAULT.order.slice(),
  stickers:Array.isArray(rawPref?.stickers)?rawPref.stickers.filter(x=>x&&allowedStickerTypes.includes(x.type)).slice(0,24):[]};
const ledger0=readJSON(LEDGER_KEY,{});
const ledger={schema:1,tasks:{...(ledger0?.tasks||{})},steps:{...(ledger0?.steps||{})}};
const html=document.documentElement;
let drawerOpen=false,editStickers=false,activePen='#B5456B',eraser=false,penDown=false,undoStack=[];
let lastRaw=null,lastDone=new Set(),lastSteps=new Set(),historyDayMap=new Map(),legacyByPlan=new Map(),lastStats=null,lastSyncAt=0;
let sketchCanvas=null,sketchCtx=null,ambientCanvas=null,ambientFrame=0,ambientLast=0,petals=[];
const prefersReduce=window.matchMedia('(prefers-reduced-motion: reduce)');
function message(msg){const el=$('#hub-preferences-status');if(el)el.textContent=msg;}
function savePref(){writeJSON(PREF_KEY,pref);}
function nowDay(){const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const v={};p.forEach(i=>{v[i.type]=i.value;});return `${v.year}-${v.month}-${v.day}`;}
function dayOfInstant(at){const d=new Date(at);if(!Number.isFinite(d.getTime()))return null;const p=new Intl.DateTimeFormat('en-US',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const v={};p.forEach(i=>{v[i.type]=i.value;});return `${v.year}-${v.month}-${v.day}`;}
function daysBack(date,n){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function dateLabel(day){const [y,m,d]=day.split('-');return `${d}/${m}/${y}`;}
function shortDate(day){return new Intl.DateTimeFormat('pt-BR',{timeZone:'UTC',month:'short',year:'2-digit'}).format(new Date(day+'T12:00:00Z'));}
function validHex(s){return typeof s==='string'&&/^#[0-9a-fA-F]{6}$/.test(s);}
function colorHover(c){const n=parseInt(c.slice(1),16),r=(n>>16)&255,g=(n>>8)&255,b=n&255;return '#'+[r,g,b].map(v=>Math.round(v*.87).toString(16).padStart(2,'0')).join('');}
function onAccent(hex){const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));const l=.2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];return l>.179?'#2A1A21':'#FFFFFF';}
function svg(type){const base='viewBox="0 0 80 80" width="80" height="80" xmlns="http://www.w3.org/2000/svg"';
 const art={
  sakura:`<g transform="translate(40 39)"><g fill="#F6AFC4" stroke="#A34B70" stroke-width="1.6"><ellipse rx="12" ry="22" cy="-17"/><ellipse rx="12" ry="22" cy="-17" transform="rotate(72)"/><ellipse rx="12" ry="22" cy="-17" transform="rotate(144)"/><ellipse rx="12" ry="22" cy="-17" transform="rotate(216)"/><ellipse rx="12" ry="22" cy="-17" transform="rotate(288)"/></g><circle r="9" fill="#FFDF89" stroke="#A34B70" stroke-width="1.3"/><circle cx="-2.5" cy="-2" r="1.5" fill="#AF6181"/><circle cx="3" cy="-2" r="1.5" fill="#AF6181"/><path d="M-2 3Q0 5 3 3" stroke="#AF6181" fill="none" stroke-width="1.3"/></g>`,
  cat:`<path d="M16 55Q9 39 18 26L23 12L36 24Q45 21 53 25L65 13L66 34Q72 59 50 63L28 62Q18 62 16 55Z" fill="#FFE4D0" stroke="#9C6171" stroke-width="2.5"/><path d="M31 44q5 5 10 0M49 44q5 5 10 0" stroke="#705166" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M42 49l2 2 2-2" fill="none" stroke="#A86F80" stroke-width="1.5"/><path d="M12 49L25 48M12 55L24 53M61 48L73 49M61 53L73 55" stroke="#A86F80" stroke-width="1.4" stroke-linecap="round"/><ellipse cx="40" cy="61" rx="24" ry="4" fill="#DDA6BA" opacity=".45"/>`,
  tea:`<path d="M21 26h37l-4 28Q52 63 39 63T25 55Z" fill="#E0F0CE" stroke="#67877E" stroke-width="2.5"/><path d="M58 31h7Q76 39 66 47h-9" fill="none" stroke="#67877E" stroke-width="4" stroke-linecap="round"/><path d="M17 63h47" stroke="#956D7C" stroke-width="2.5" stroke-linecap="round"/><path d="M33 11q-7 7 0 13M45 10q-6 7 0 13" stroke="#A6B8AD" stroke-width="2" fill="none"/><path d="M31 42q8-8 16 0" stroke="#739779" stroke-width="2" fill="none"/>`,
  star:`<path d="M40 8l9 22 24 2-18 15 6 24-21-13-21 13 6-24L7 32l24-2Z" fill="#FFE6A4" stroke="#B48751" stroke-width="2.5" stroke-linejoin="round"/><path d="M30 42l4 3M47 45l4-3" stroke="#926774" stroke-width="2.5" stroke-linecap="round"/><path d="M38 51q4 4 7 0" stroke="#926774" stroke-width="2" fill="none"/>`,
  bow:`<path d="M41 35Q22 7 9 22Q2 42 32 45Q6 52 18 69Q29 77 41 49Q56 74 65 65Q79 49 49 44Q77 40 69 23Q55 11 41 35Z" fill="#F9B3CD" stroke="#A95F7C" stroke-width="2.5"/><path d="M35 35q-10-11-18-10M47 36q12-12 17-9M37 50q-10 8-16 16M46 49q8 11 15 14" fill="none" stroke="#DA7E9F" stroke-width="2"/><ellipse cx="41" cy="43" rx="9" ry="11" fill="#FFE5EB" stroke="#A95F7C" stroke-width="2"/>`,
  feito:`<g transform="rotate(-9 40 40)"><rect x="10" y="21" width="60" height="38" rx="6" fill="none" stroke="#9C395E" stroke-width="3.2"/><text x="40" y="45" text-anchor="middle" font-family="serif" font-weight="bold" font-size="16" fill="#9C395E">FEITO</text><path d="M25 51h30" stroke="#9C395E" stroke-width="1.5"/></g>`,
  foco:`<g transform="rotate(7 40 40)"><circle cx="40" cy="40" r="27" fill="none" stroke="#6D8B83" stroke-width="3"/><circle cx="40" cy="40" r="23" fill="none" stroke="#6D8B83" stroke-width="1.4" stroke-dasharray="2 5"/><text x="40" y="45" text-anchor="middle" font-family="serif" font-weight="bold" font-size="16" fill="#447D70">FOCO</text></g>`,
  atrasado:`<g transform="rotate(-7 40 40)"><rect x="5" y="24" width="70" height="31" rx="4" fill="none" stroke="#B34E58" stroke-width="2.7"/><text x="40" y="44" text-anchor="middle" font-family="serif" font-weight="bold" font-size="12" fill="#B34E58">ATRASADO</text></g>`
 };
 return `<svg ${base} aria-hidden="true">${art[type]||art.star}</svg>`;}
function normalizePrefs(){if(!['atelier','focus'].includes(pref.mode))pref.mode='atelier';if(!['none','gradient','image'].includes(pref.cover))pref.cover='gradient';if(!['plain','dot','grid'].includes(pref.paper))pref.paper='plain';if(!['sakura','matcha','cream','plum'].includes(pref.palette))pref.palette='sakura';if(!['jakarta','zen'].includes(pref.font))pref.font='jakarta';if(!['comfortable','compact'].includes(pref.density))pref.density='comfortable';if(!['gingham','dots','stripes','sakura'].includes(pref.tape))pref.tape='gingham';pref.goal=Math.max(1,Math.min(12,Math.round(Number(pref.goal)||5)));pref.range=pref.range===30?30:90;pref.accent=validHex(pref.accent)?pref.accent:'#E27D9E';pref.customAccent=!!pref.customAccent;pref.tapeTargets=Array.isArray(pref.tapeTargets)?pref.tapeTargets.filter(x=>['banner','consistency','briefing','execution'].includes(x)):['consistency'];}
normalizePrefs();
function applyCover(){const banner=$('#hub-workspace'),art=$('#hub-cover');if(!banner||!art)return;banner.hidden=pref.cover==='none';const img=art.querySelector('img');if(img)img.remove();if(pref.cover==='image'){
  const url=pref.coverUrl||localStorage.getItem(COVER_KEY)||'';
  const valid=url.startsWith('data:image/')||(/^https:\/\//i.test(url)&&url.length<4000);
  if(valid){const i=document.createElement('img');i.src=url;i.alt='Capa pessoal selecionada pela estudante';i.onerror=()=>{i.remove();message('Não foi possível abrir esta imagem. O cabeçalho manteve o gradiente.');};art.append(i);}
 }
}
function applyWashi(){const targets={banner:$('#hub-workspace'),consistency:$('#studyhub-consistency'),briefing:$('#page-hoje>.briefing-preview'),execution:$('#page-hoje>.dash-layout')};Object.entries(targets).forEach(([k,e])=>{if(e)e.classList.toggle('hub-washi-target',!!pref.washi&&pref.tapeTargets.includes(k)&&pref.mode==='atelier');});}
function applyBlocks(){pref.order.forEach((id,index)=>{const b=blocks.find(x=>x.id===id);const e=b?$(b.selector):null;if(!e)return;e.style.order=String(index+1);e.classList.toggle('hub-hidden',pref.visible[id]===false||(id==='doodle'&&!pref.bujoVisible)|| (id==='doodle'&&pref.mode==='focus'));});}
function applyPrefs(){normalizePrefs();html.classList.add('hub-ready');html.dataset.hubMode=pref.mode;html.dataset.hubPalette=pref.palette;html.dataset.hubFont=pref.font;html.dataset.hubPaper=pref.paper;html.dataset.hubDensity=pref.density;html.dataset.hubTape=pref.tape;
 const paletteAccents={sakura:'#E27D9E',matcha:'#CF7393',cream:'#D78B9B',plum:'#DB91AF'};
 const accent=pref.customAccent?pref.accent:paletteAccents[pref.palette];
 html.style.setProperty('--hub-accent',accent);html.style.setProperty('--hub-accent-hover',colorHover(accent));html.style.setProperty('--hub-on-accent',onAccent(accent));
 const quick=$('#hub-focus-toggle');if(quick){quick.setAttribute('aria-pressed',String(pref.mode==='focus'));quick.textContent=pref.mode==='focus'?'✿ Voltar ao Ateliê':'◌ Foco puro';}
 applyCover();applyBlocks();applyWashi();paintStickers();showEditingBar();setAmbient();syncControls();
}
function syncControls(){const c=(id,v)=>{const e=$('#'+id);if(e)e.value=v;};const ck=(id,v)=>{const e=$('#'+id);if(e)e.checked=!!v;};
 c('hub-cover-mode',pref.cover);c('hub-cover-url',pref.coverUrl||'');c('hub-paper-type',pref.paper);c('hub-palette',pref.palette);c('hub-font',pref.font);c('hub-accent',pref.customAccent?pref.accent:({sakura:'#E27D9E',matcha:'#CF7393',cream:'#D78B9B',plum:'#DB91AF'}[pref.palette]));c('hub-density',pref.density);c('hub-tape-style',pref.tape);c('hub-goal',pref.goal);c('hub-window',pref.range);ck('hub-washi-check',pref.washi);ck('hub-ambient-check',pref.atmosphere);ck('hub-bujo-check',pref.bujoVisible);ck('hub-sticker-unlock',editStickers);
 $$('.hub-tape-target').forEach(e=>e.checked=pref.tapeTargets.includes(e.value));
 $$('.hub-mode-pair button').forEach(b=>{b.classList.toggle('active',b.dataset.mode===pref.mode);b.setAttribute('aria-pressed',String(b.dataset.mode===pref.mode));});
 const manual=$('#hub-accent-state');if(manual)manual.textContent=pref.customAccent?'Cor personalizada':'Cor da sub-paleta';
 renderBlockControls();
}
function renderBlockControls(){const parent=$('#hub-block-list');if(!parent)return;parent.replaceChildren();pref.order.forEach((key,pos)=>{const b=blocks.find(x=>x.id===key);if(!b)return;const row=document.createElement('div');row.className='hub-block-row';const lab=document.createElement('label');const input=document.createElement('input');input.type='checkbox';input.checked=pref.visible[key]!==false;input.dataset.showBlock=key;const span=document.createElement('span');span.textContent=b.title;lab.append(input,span);const actions=document.createElement('div');actions.className='hub-block-buttons';['up','down'].forEach((kind)=>{const button=document.createElement('button');button.type='button';button.dataset.moveBlock=kind;button.dataset.blockKey=key;button.textContent=kind==='up'?'↑':'↓';button.title=kind==='up'?'Mover para cima':'Mover para baixo';button.disabled=kind==='up'?pos===0:pos===pref.order.length-1;actions.append(button);});row.append(lab,actions);parent.append(row);});}
function openDrawer(){if(editStickers)stopEditing();drawerOpen=true;html.classList.add('hub-drawer-open');$('#hub-drawer').setAttribute('aria-hidden','false');$('#hub-personalize').setAttribute('aria-expanded','true');editStickers=!!$('#hub-sticker-unlock')?.checked;paintStickers();setTimeout(()=>$('#hub-drawer-close')?.focus(),0);}
function closeDrawer(keepEditing=false){drawerOpen=false;if(!keepEditing)editStickers=false;html.classList.remove('hub-drawer-open');$('#hub-drawer').setAttribute('aria-hidden','true');$('#hub-personalize').setAttribute('aria-expanded','false');paintStickers();showEditingBar();$('#hub-personalize')?.focus();}
function paintStickers(){const layer=$('#hub-sticker-layer');if(!layer)return;layer.replaceChildren();if(pref.mode==='focus')return;
 pref.stickers.forEach((st,index)=>{const e=document.createElement('div');e.className='hub-sticker';e.dataset.stickerIndex=String(index);e.dataset.editable=String(editStickers);e.style.left=Math.max(0,Math.min(88,Number(st.x)||0))+'%';e.style.top=Math.max(0,Math.min(58,Number(st.y)||0))+'%';e.style.setProperty('--r',String(Number(st.r)||0)+'deg');e.innerHTML=svg(st.type);layer.append(e);});}
function showEditingBar(){const el=$('#hub-sticker-edit-bar');if(el)el.hidden=!editStickers;}
function stopEditing(){editStickers=false;paintStickers();showEditingBar();}
function addSticker(type){if(!allowedStickerTypes.includes(type))return;if(pref.stickers.length>=24){message('Limite de 24 stickers para manter o site leve.');return;}if(pref.cover==='none')pref.cover='gradient';pref.stickers.push({type,x:pref.stickers.length%2?69:82,y:8+(pref.stickers.length%3)*22,r:[-9,6,12,-4][pref.stickers.length%4]});editStickers=true;savePref();applyPrefs();closeDrawer(true);showEditingBar();message('Sticker adicionado. Arraste pela capa; depois trave a posição.');}
function stickerDrag(e){if(!editStickers||pref.mode==='focus')return;const sticker=e.target.closest('.hub-sticker');if(!sticker)return;const idx=Number(sticker.dataset.stickerIndex),stage=$('#hub-workspace');if(!pref.stickers[idx]||!stage)return;const rect=stage.getBoundingClientRect(),r=sticker.getBoundingClientRect();const shiftX=e.clientX-r.left,shiftY=e.clientY-r.top;e.preventDefault();sticker.setPointerCapture(e.pointerId);
 const move=ev=>{const x=(ev.clientX-rect.left-shiftX)/Math.max(1,rect.width)*100,y=(ev.clientY-rect.top-shiftY)/Math.max(1,rect.height)*100;pref.stickers[idx].x=Math.round(Math.max(0,Math.min(100-r.width/rect.width*100,x))*10)/10;pref.stickers[idx].y=Math.round(Math.max(0,Math.min(100-r.height/rect.height*100,y))*10)/10;sticker.style.left=pref.stickers[idx].x+'%';sticker.style.top=pref.stickers[idx].y+'%';};
 const stop=()=>{sticker.removeEventListener('pointermove',move);sticker.removeEventListener('pointerup',stop);sticker.removeEventListener('pointercancel',stop);savePref();};
 sticker.addEventListener('pointermove',move);sticker.addEventListener('pointerup',stop,{once:true});sticker.addEventListener('pointercancel',stop,{once:true});}
// Local source-of-truth bridge: never write the original storage key.
function currentSource(){return readJSON(ORIGINAL_KEY,{done:{},steps:{},quiz:{},formal:{history:[]}})||{};}
function doneSnapshot(src){return new Set(Object.entries(src.done||{}).filter(([,v])=>v===true).map(([k])=>k));}
function stepsSnapshot(src){const out=new Set();Object.entries(src.steps||{}).forEach(([key,list])=>{if(!Array.isArray(list))return;list.forEach(item=>{if(item&&item.done===true)out.add(key+'|'+String(item.id));});});return out;}
function loadQuestionHistory(src){const map=new Map();const add=(day,type)=>{if(!day)return;if(!map.has(day))map.set(day,{questions:0,formal:0});map.get(day)[type]++;};let count=0;
 Object.values(src.quiz||{}).forEach(r=>{if(!r||!Array.isArray(r.history))return;r.history.forEach(h=>{if(!h||h.blank===true||typeof h.at!=='string')return;const day=dayOfInstant(h.at);if(day){add(day,'questions');count++;}});});
 if(count===0&&Array.isArray(src.formal?.history))src.formal.history.forEach(h=>{if(h?.completedAt)add(dayOfInstant(h.completedAt),'formal');});
 return map;
}
function syncActivity(){const raw=localStorage.getItem(ORIGINAL_KEY)||'';if(raw===lastRaw&&nowDay()===lastSyncAt)return;const src=currentSource(),nextDone=doneSnapshot(src),nextSteps=stepsSnapshot(src);
 if(lastRaw!==null){
  const when=new Date().toISOString();
  nextDone.forEach(key=>{if(!lastDone.has(key))ledger.tasks[key]={at:when};});
  lastDone.forEach(key=>{if(!nextDone.has(key))delete ledger.tasks[key];});
  nextSteps.forEach(key=>{if(!lastSteps.has(key))ledger.steps[key]={at:when};});
  lastSteps.forEach(key=>{if(!nextSteps.has(key))delete ledger.steps[key];});
 }
 let dirty=false;
 Object.keys(ledger.tasks).forEach(k=>{if(!nextDone.has(k)){delete ledger.tasks[k];dirty=true;}});
 Object.keys(ledger.steps).forEach(k=>{if(!nextSteps.has(k)){delete ledger.steps[k];dirty=true;}});
 // If the original app changed on this turn, persist timestamps separately.
 if(lastRaw!==null&&(nextDone.size!==lastDone.size||[...nextDone].some(k=>!lastDone.has(k))||nextSteps.size!==lastSteps.size||[...nextSteps].some(k=>!lastSteps.has(k))))dirty=true;
 if(dirty)writeJSON(LEDGER_KEY,ledger);
 lastDone=nextDone;lastSteps=nextSteps;lastRaw=raw;lastSyncAt=nowDay();historyDayMap=loadQuestionHistory(src);legacyByPlan=new Map();
 nextDone.forEach(k=>{if(ledger.tasks[k])return;const date=k.slice(0,10);if(/^\d{4}-\d{2}-\d{2}$/.test(date))legacyByPlan.set(date,(legacyByPlan.get(date)||0)+1);});
 renderHeatmap();}
function valueForDate(date){let tasks=0,steps=0;Object.values(ledger.tasks).forEach(x=>{if(dayOfInstant(x.at)===date)tasks++;});Object.values(ledger.steps).forEach(x=>{if(dayOfInstant(x.at)===date)steps++;});const recorded=historyDayMap.get(date)||{questions:0,formal:0};const questions=recorded.questions||0,formal=recorded.formal||0;
 // Deliberately do not equate a single quiz question with a completed study block.
 const units=tasks+Math.floor(steps/3)+Math.floor(questions/10)+formal;
 const any=tasks+steps+questions+formal>0;
 let level=0;if(any){if(units>=pref.goal+2)level=4;else if(units>=pref.goal)level=3;else if(units>=Math.max(2,Math.ceil(pref.goal/2)))level=2;else level=1;}
 return {date,tasks,steps,questions,formal,units,any,level,undated:legacyByPlan.get(date)||0};}
function tooltipLine(v){const base=`${dateLabel(v.date)}\n${v.tasks} estudo(s) concluído(s)\n${v.steps} microetapa(s)\n${v.questions} questão(ões) respondida(s)${v.formal?'\n'+v.formal+' conjunto(s) formal(is)':''}`;return base+`\nMeta: ${pref.goal} unidades • nível ${v.level}`+(v.undated?`\n${v.undated} marcação(ões) antiga(s) sem data da execução, não contabilizada(s).`:'')+(!v.any?'\nSem atividade datada registrada no site.':'');}
function showTooltip(btn){const e=$('#hub-tooltip');if(!e||!btn)return;const day=btn.dataset.day;if(!day)return;const v=valueForDate(day);e.textContent=tooltipLine(v);e.classList.add('visible');const box=btn.getBoundingClientRect();e.style.top=Math.max(10,box.top-145)+'px';e.style.left=Math.max(9,Math.min(window.innerWidth-246,box.left-70))+'px';}
function hideTooltip(){const e=$('#hub-tooltip');if(e)e.classList.remove('visible');}
function renderHeatmap(){const grid=$('#hub-weeks');if(!grid)return;const today=nowDay(),range=pref.range,first=daysBack(today,1-range);const firstDate=new Date(first+'T12:00:00Z'),offset=(firstDate.getUTCDay()+6)%7,weekCount=Math.ceil((range+offset)/7);
 const days=new Map();for(let n=0;n<range;n++){const key=daysBack(first,n);days.set(key,valueForDate(key));}
 grid.replaceChildren();let label='';for(let w=0;w<weekCount;w++){const week=document.createElement('div');week.className='hub-week';const heading=document.createElement('div');heading.className='hub-week-label';const dateFirst=daysBack(first,w*7-offset);const m=dateFirst.slice(0,7);if(w===0||m!==label){heading.textContent=shortDate(dateFirst);label=m;}week.append(heading);
  for(let row=0;row<7;row++){const day=daysBack(first,w*7+row-offset),item=days.get(day);if(!item){const hole=document.createElement('span');hole.className='hub-day-empty';week.append(hole);continue;}const btn=document.createElement('button');btn.type='button';btn.className='hub-day';btn.dataset.day=day;btn.dataset.level=String(item.level);btn.dataset.today=String(day===today);btn.setAttribute('aria-label',tooltipLine(item).replaceAll('\n','. '));btn.title=tooltipLine(item);week.append(btn);}
  grid.append(week);
 }
 const arr=[...days.values()];const active=arr.filter(x=>x.any).length,empty=arr.length-active;let streak=0;for(let d=today;streak<range;d=daysBack(d,-1)){const v=days.get(d);if(!v?.any)break;streak++;}
 const put=(selector,value)=>{const e=$(selector);if(e)e.textContent=value;};put('#hub-streak',String(streak));put('#hub-days',`${active} / ${empty}`);put('#hub-rate',`${Math.round(100*active/Math.max(1,range))}%`);put('#hub-count-window',`${range} dias`);
 const todayVal=valueForDate(today);put('#hub-today-status',`Hoje: ${todayVal.tasks} concluído(s), ${todayVal.questions} questão(ões) registrada(s).`);
 $('#hub-hanko')?.classList.toggle('active',todayVal.units>=pref.goal);
 const nUndated=[...legacyByPlan.values()].reduce((a,b)=>a+b,0);put('#hub-undated',nUndated?`Há ${nUndated} conclusão(ões) anteriores sem horário da execução, excluídas da taxa.`:'Dias sem marcação não comprovam ausência de estudo fora do site.');
 lastStats={active,empty,streak,rate:Math.round(100*active/Math.max(1,range))};
}
function refreshAll(){savePref();applyPrefs();renderHeatmap();}
function bindHeatmap(){const grid=$('#hub-weeks');if(!grid)return;
 grid.addEventListener('pointerover',e=>{const b=e.target.closest('.hub-day');if(b)showTooltip(b);});grid.addEventListener('pointerout',e=>{const b=e.target.closest('.hub-day');if(b)hideTooltip();});
 grid.addEventListener('focusin',e=>{const b=e.target.closest('.hub-day');if(b)showTooltip(b);});grid.addEventListener('focusout',hideTooltip);
 grid.addEventListener('click',e=>{const b=e.target.closest('.hub-day');if(!b)return;showTooltip(b);setTimeout(hideTooltip,4000);});
 document.addEventListener('pointerdown',e=>{if(!e.target.closest('.hub-day'))hideTooltip();});
 $('#hub-window')?.addEventListener('change',e=>{pref.range=Number(e.target.value)===30?30:90;refreshAll();});
}
function attachSketch(){sketchCanvas=$('#hub-sketch');if(!sketchCanvas)return;sketchCtx=sketchCanvas.getContext('2d');sketchCtx.lineCap='round';sketchCtx.lineJoin='round';const saved=localStorage.getItem(DOODLE_KEY);if(saved&&saved.startsWith('data:image/'))restoreSketch(saved);
 const point=e=>{const r=sketchCanvas.getBoundingClientRect();return{x:(e.clientX-r.left)*sketchCanvas.width/r.width,y:(e.clientY-r.top)*sketchCanvas.height/r.height}};
 sketchCanvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();penDown=true;undoStack.push(sketchCanvas.toDataURL('image/png'));if(undoStack.length>12)undoStack.shift();sketchCanvas.setPointerCapture(e.pointerId);const p=point(e);sketchCtx.beginPath();sketchCtx.moveTo(p.x,p.y);sketchCtx.lineTo(p.x+.01,p.y+.01);sketchCtx.strokeStyle=activePen;sketchCtx.lineWidth=eraser?28:3.5;sketchCtx.globalCompositeOperation=eraser?'destination-out':'source-over';sketchCtx.stroke();});
 sketchCanvas.addEventListener('pointermove',e=>{if(!penDown)return;e.preventDefault();const p=point(e);sketchCtx.lineTo(p.x,p.y);sketchCtx.stroke();sketchCtx.beginPath();sketchCtx.moveTo(p.x,p.y);});
 const stop=()=>{if(!penDown)return;penDown=false;sketchCtx.globalCompositeOperation='source-over';try{localStorage.setItem(DOODLE_KEY,sketchCanvas.toDataURL('image/png'));}catch(_){message('Espaço local insuficiente para este rabisco.');}};
 sketchCanvas.addEventListener('pointerup',stop);sketchCanvas.addEventListener('pointercancel',stop);
 $$('.hub-pen-swatch').forEach(b=>b.addEventListener('click',()=>{eraser=false;activePen=b.dataset.color;$$('.hub-pen-swatch').forEach(i=>i.classList.toggle('active',i===b));$('#hub-eraser').classList.remove('selected');}));
 $('#hub-eraser')?.addEventListener('click',()=>{eraser=!eraser;$('#hub-eraser').classList.toggle('selected',eraser);});
 $('#hub-undo')?.addEventListener('click',()=>{const prior=undoStack.pop();if(prior)restoreSketch(prior,true);});
 $('#hub-clear-doodle')?.addEventListener('click',()=>{undoStack.push(sketchCanvas.toDataURL('image/png'));sketchCtx.clearRect(0,0,sketchCanvas.width,sketchCanvas.height);localStorage.removeItem(DOODLE_KEY);});
 $('#hub-export-doodle')?.addEventListener('click',()=>{const a=document.createElement('a');a.href=sketchCanvas.toDataURL('image/png');a.download='meus-rabiscos-bujo.png';a.click();});
}
function restoreSketch(url,save=false){const img=new Image();img.onload=()=>{sketchCtx.clearRect(0,0,sketchCanvas.width,sketchCanvas.height);sketchCtx.drawImage(img,0,0,sketchCanvas.width,sketchCanvas.height);if(save){try{localStorage.setItem(DOODLE_KEY,url);}catch(_){}}};img.src=url;}
function newPetal(w,h,i){const side=i%2;return{x:side?Math.random()*w*.17:w*(.83+Math.random()*.17),y:Math.random()*h,sz:1.3+Math.random()*2.8,speed:.15+Math.random()*.23,phase:Math.random()*6.28,side};}
function setAmbient(){const want=pref.atmosphere&&pref.mode==='atelier'&&!prefersReduce.matches&&!document.hidden; if(!ambientCanvas){ambientCanvas=$('#hub-atmosphere');if(!ambientCanvas)return;}
 if(!want){if(ambientFrame)cancelAnimationFrame(ambientFrame);ambientFrame=0;ambientCanvas.style.display='none';return;}
 ambientCanvas.style.display='block';const w=Math.min(window.innerWidth,2000),h=Math.min(window.innerHeight,1200),dpr=Math.min(2,window.devicePixelRatio||1);ambientCanvas.width=Math.round(w*dpr);ambientCanvas.height=Math.round(h*dpr);ambientCanvas.style.width=w+'px';ambientCanvas.style.height=h+'px';const ctx=ambientCanvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);petals=Array.from({length:window.innerWidth<600?12:20},(_,i)=>newPetal(w,h,i));if(ambientFrame)cancelAnimationFrame(ambientFrame);let last=0;
 const step=t=>{if(!pref.atmosphere||pref.mode==='focus'||document.hidden||prefersReduce.matches){ambientFrame=0;return;}if(t-last>45){last=t;ctx.clearRect(0,0,w,h);petals.forEach((p,i)=>{p.y+=p.speed;p.x+=(p.side?1:-1)*Math.sin(t*.0007+p.phase)*.13;if(p.y>h+8)petals[i]=newPetal(w,h,i),petals[i].y=-5;ctx.beginPath();ctx.ellipse(p.x,p.y,p.sz*1.4,p.sz,.35,0,Math.PI*2);ctx.fillStyle='rgba(226,125,158,.32)';ctx.fill();});}ambientFrame=requestAnimationFrame(step);};ambientFrame=requestAnimationFrame(step);
}
async function compressImage(file){const reader=new FileReader();const raw=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsDataURL(file);});if(file.type==='image/gif'){if(file.size>1_300_000)throw new Error('GIF acima de 1,3 MB. Use uma URL HTTPS para preservar a animação.');return raw;}
 if(raw.length<1_300_000)return raw;
 return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas');const scale=Math.min(1,1400/img.width,420/img.height);c.width=Math.round(img.width*scale);c.height=Math.round(img.height*scale);const cx=c.getContext('2d');cx.drawImage(img,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.8));};img.onerror=reject;img.src=raw;});}
function applyCoverUrl(){const input=$('#hub-cover-url');const s=input.value.trim();if(s&&!/^https:\/\//i.test(s)){message('Informe uma URL HTTPS válida. Links inseguros não são usados.');return;}if(s.length>3500){message('URL muito extensa.');return;}pref.coverUrl=s;pref.cover=s?'image':'gradient';savePref();applyPrefs();message(s?'Imagem externa aplicada. A URL só é carregada pelo seu navegador.':'Gradiente restaurado.');}
function installEvents(){
 $('#hub-personalize').addEventListener('click',openDrawer);$('#hub-drawer-close').addEventListener('click',()=>closeDrawer());$('#hub-drawer-backdrop').addEventListener('click',()=>closeDrawer());
 $('#hub-focus-toggle').addEventListener('click',()=>{pref.mode=pref.mode==='focus'?'atelier':'focus';if(pref.mode==='focus')stopEditing();refreshAll();});
 $$('.hub-mode-pair button').forEach(b=>b.addEventListener('click',()=>{pref.mode=b.dataset.mode;if(pref.mode==='focus')stopEditing();refreshAll();}));
 const changes={'hub-cover-mode':'cover','hub-paper-type':'paper','hub-palette':'palette','hub-font':'font','hub-density':'density','hub-tape-style':'tape'};
 Object.entries(changes).forEach(([id,key])=>$('#'+id).addEventListener('change',e=>{pref[key]=e.target.value;if(id==='hub-palette')pref.customAccent=false;refreshAll();}));
 $('#hub-accent').addEventListener('input',e=>{if(!validHex(e.target.value))return;pref.accent=e.target.value;pref.customAccent=true;refreshAll();});
 $('#hub-accent-reset').addEventListener('click',()=>{pref.customAccent=false;refreshAll();});
 $('#hub-washi-check').addEventListener('change',e=>{pref.washi=e.target.checked;refreshAll();});
 $$('.hub-tape-target').forEach(e=>e.addEventListener('change',()=>{pref.tapeTargets=$$('.hub-tape-target:checked').map(x=>x.value);refreshAll();}));
 $('#hub-ambient-check').addEventListener('change',e=>{pref.atmosphere=e.target.checked;refreshAll();});
 $('#hub-bujo-check').addEventListener('change',e=>{pref.bujoVisible=e.target.checked;pref.visible.doodle=e.target.checked;refreshAll();});
 $('#hub-goal').addEventListener('change',e=>{pref.goal=Math.max(1,Math.min(12,Math.round(Number(e.target.value)||5)));refreshAll();});
 $('#hub-save-cover-url').addEventListener('click',applyCoverUrl);
 $('#hub-cover-upload').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;if(!/^image\/(png|jpeg|webp|gif)$/.test(file.type)){message('Formato não suportado. Escolha PNG, JPEG, WEBP ou GIF.');return;}try{const data=await compressImage(file);if(data.length>2_000_000)throw new Error('Imagem maior que o limite local. Use URL HTTPS.');localStorage.setItem(COVER_KEY,data);pref.coverUrl='';pref.cover='image';savePref();applyPrefs();message('Imagem salva apenas neste navegador.');}catch(err){message(err?.message||'Não foi possível carregar a imagem.');}});
 $('#hub-remove-cover').addEventListener('click',()=>{localStorage.removeItem(COVER_KEY);pref.coverUrl='';pref.cover='gradient';savePref();applyPrefs();message('Imagem local retirada.');});
 $('#hub-sticker-tray').addEventListener('click',e=>{const b=e.target.closest('[data-add-sticker]');if(b)addSticker(b.dataset.addSticker);});
 $('#hub-sticker-unlock').addEventListener('change',e=>{editStickers=e.target.checked;paintStickers();if(editStickers)closeDrawer(true);showEditingBar();message(editStickers?'Arraste os adesivos na capa e toque em Travar posições.':'Stickers travados. Não bloqueiam cliques.');});
 $('#hub-sticker-done').addEventListener('click',stopEditing);
 $('#hub-clear-stickers').addEventListener('click',()=>{pref.stickers=[];savePref();paintStickers();message('Stickers removidos.');});
 $('#hub-sticker-layer').addEventListener('pointerdown',stickerDrag);
 $('#hub-block-list').addEventListener('change',e=>{const b=e.target.closest('[data-show-block]');if(!b)return;pref.visible[b.dataset.showBlock]=b.checked;if(b.dataset.showBlock==='doodle')pref.bujoVisible=b.checked;refreshAll();});
 $('#hub-block-list').addEventListener('click',e=>{const b=e.target.closest('[data-move-block]');if(!b)return;const id=b.dataset.blockKey,i=pref.order.indexOf(id),j=b.dataset.moveBlock==='up'?i-1:i+1;if(i<0||j<0||j>=pref.order.length)return;[pref.order[i],pref.order[j]]=[pref.order[j],pref.order[i]];refreshAll();});
 document.addEventListener('keydown',e=>{if(!drawerOpen)return;if(e.key==='Escape'){e.preventDefault();closeDrawer();}if(e.key==='Tab'){const list=$$('#hub-drawer button:not(:disabled),#hub-drawer input:not(:disabled),#hub-drawer select:not(:disabled),#hub-drawer summary,#hub-drawer [tabindex="0"]').filter(e=>e.offsetParent!==null);if(!list.length)return;const first=list[0],last=list.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}});
 document.addEventListener('click',e=>{if(e.target.closest('[data-done],[data-step],[data-fstep],#focus-complete,#quiz-content,#formal-submit'))setTimeout(syncActivity,0);});
 document.addEventListener('change',e=>{if(e.target.closest('[data-step],[data-fstep]'))setTimeout(syncActivity,0);});
 window.addEventListener('storage',e=>{if(e.key===ORIGINAL_KEY)syncActivity();if(e.key===PREF_KEY){message('As configurações foram alteradas em outra aba. Atualize esta página para carregá-las.');}});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)syncActivity();setAmbient();});window.addEventListener('resize',()=>{hideTooltip();if(pref.atmosphere)setAmbient();});prefersReduce.addEventListener?.('change',setAmbient);
 bindHeatmap();attachSketch();
}
function init(){if(!$('#hub-personalize')||!$('#studyhub-consistency'))return;const tray=$('#hub-sticker-tray');const labels={sakura:'Sakura',cat:'Gatinho',tea:'Chá',star:'Estrela',bow:'Laço',feito:'FEITO',foco:'FOCO',atrasado:'ATRASADO'};allowedStickerTypes.forEach(type=>{const b=document.createElement('button');b.type='button';b.dataset.addSticker=type;b.innerHTML=svg(type);const caption=document.createElement('span');caption.textContent=labels[type];b.append(caption);tray.append(b);});
 applyPrefs();installEvents();syncActivity();setInterval(syncActivity,3000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
