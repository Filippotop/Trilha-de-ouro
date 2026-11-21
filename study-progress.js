/* TRILHA DE OURO • SALVAMENTO E EVOLUÇÃO 3.1
   Usa os registros existentes, preservando as chaves originais e seus cálculos.
   Backups são arquivos locais; não implica sincronização privada em nuvem.
*/
(() => {
'use strict';
const $=(sel,root=document)=>root.querySelector(sel);
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const CORE='trilha-questoes-ouro-unificada-1';
const EVOLUTION_PREF='trilha-ouro-evolution-preferences-v1';
const KEYS=[CORE,'trilha-ouro-pendencias-concluidas-v1','trilha-ouro-library-cache-v1','trilha-ouro-briefing-cache-v1','trilha-ouro-studyhub-preferences-v1','trilha-ouro-studyhub-ledger-v1','trilha-ouro-studyhub-doodle-v1','trilha-ouro-studyhub-cover-v1','trilha-ouro-gold-questoes-v4',EVOLUTION_PREF];
const BACKUP_FORMAT='trilha-ouro-portable-backup';
const DB=JSON.parse($('#app-data').textContent);
const TOPICS=DB.questions;
const HAS=DB.formalQuestions||[];
const AREAS={'p2-child':'P2 Criança II','p2-mother':'P2 Mulher II','osce-child':'OSCE Criança II','osce-mother':'OSCE Mulher II'};
const STORE_HIST=(key,def)=>{try{const x=localStorage.getItem(key);return x?JSON.parse(x):def;}catch(_){return def;}};
const validDate=at=>{const n=typeof at==='number'?at:Date.parse(at||'');return Number.isFinite(n)&&n>0?n:0;};
const dayPT=at=>{const n=validDate(at);return n?new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeZone:'America/Sao_Paulo'}).format(new Date(n)):'Data não registrada';};
let topicChoice=STORE_HIST(EVOLUTION_PREF,{topic:'all'}).topic||'all';
function allEvents(qs,source){const events=[];let attempts=0,right=0,wrong=0,blank=0;let undated=0;
 for(const q of qs){const r=source[q.id];if(!r)continue;const n=Math.max(0,Number(r.attempts)||0);const cor=Math.max(0,Number(r.correct)||0);const err=Math.max(0,Number(r.wrong)||0);const bla=Math.max(0,Number(r.blanks)||0);attempts+=n;right+=cor;wrong+=err;blank+=bla;
  const h=Array.isArray(r.history)?r.history:[];for(const t of h){const v=validDate(t.at);if(v)events.push({at:v,correct:!!t.correct,blank:!!t.blank,id:q.id});else undated++;}
  undated+=Math.max(0,n-h.length);
 }
 return {events:events.sort((a,b)=>a.at-b.at),attempts,right,wrong,blank,undated,uniqueQuestions:qs.filter(q=>Number(source[q.id]?.attempts)>0).length};
}
function getStats(topic){const source=STORE_HIST(CORE,{}).quiz||{};const qs=[topic,...(topic.id==='sc-A1'?HAS:[])];const baseline=allEvents(qs,source);
 const extra=STORE_HIST('trilha-ouro-gold-questoes-v4',{});const seen=new Set();baseline.legacyExcluded=0;
 for(const run of (Array.isArray(extra.runs)?extra.runs:[]))for(const r of (Array.isArray(run.results)?run.results:[]))if(r.topicId===topic.id&&!r.annulled){if(run.sourceVersion!=='5.0.0'){baseline.legacyExcluded++;continue;}baseline.attempts++;if(r.blank)baseline.blank++;else if(r.correct)baseline.right++;else baseline.wrong++;const at=validDate(r.at||run.submittedAt);if(at)baseline.events.push({at,correct:!!r.correct,blank:!!r.blank,id:r.id});else baseline.undated++;seen.add(r.id);}
 baseline.events.sort((a,b)=>a.at-b.at);baseline.uniqueQuestions+=seen.size;return baseline;}
function verdict(s){const n=s.attempts,pct=n?100*s.right/n:0;
 if(n===0)return {status:'none',name:'Sem evidência',text:'Nenhuma questão respondida neste navegador.',next:'Resolver a primeira questão sem consultar o gabarito.'};
 if(n<5)return {status:s.wrong||s.blank?'attention':'none',name:'Amostra insuficiente',text:`${n} tentativa(s) registradas. Isso não permite afirmar domínio ou evolução consistente.`,next:s.wrong||s.blank?'Revisar o mecanismo dos erros antes de nova questão.':'Resolver novas questões diferentes antes de concluir que consolidou.'};
 let name='Acertos instáveis',status='attention',next='Revisar fundamentos, corrigir alternativas e refazer com casos inéditos.';
 if(pct>=80){name='Bom resultado no treino registrado';status='none';next='Aumentar a dificuldade e testar novos casos, sem presumir domínio.';}
 else if(pct>=60){name='Desempenho intermediário';status='attention';next='Revisar os diferenciais e a análise dos distratores.';}
 else{ name='Revisão prioritária';status='risk'; }
 let trend='';if(s.events.length>=6){const first=s.events.slice(0,3).filter(e=>e.correct).length,last=s.events.slice(-3).filter(e=>e.correct).length;if(last>first)trend='Melhora na comparação entre as três primeiras e as três últimas tentativas.';else if(last<first)trend='Queda na comparação entre as três primeiras e as três últimas tentativas.';else trend='Desempenho semelhante nas três primeiras e últimas tentativas.';}
 if(s.uniqueQuestions===1)trend+=(trend?' ':'')+'Atenção: repetir a mesma questão reduz o valor desta tendência.';
 return {status,name,text:`${trend||'Ainda sem série temporal suficiente para avaliar tendência.'} Resultado exclusivo dos itens registrados.`,next};
}
function safeSavePref(){try{localStorage.setItem(EVOLUTION_PREF,JSON.stringify({topic:topicChoice}));}catch(_) {}}
function renderEvolution(){const root=$('#hub-evolution-grid'),total=$('#hub-evolution-summary');if(!root||!total)return;const select=$('#hub-evolution-select');if(select&&!select.dataset.ready){select.insertAdjacentHTML('beforeend',TOPICS.map(q=>`<option value="${escapeHtml(q.id)}">${escapeHtml(q.topic)} (${escapeHtml(AREAS[q.group])})</option>`).join(''));select.dataset.ready='1';select.addEventListener('change',()=>{topicChoice=select.value;safeSavePref();renderEvolution();});}
 if(!TOPICS.some(q=>q.id===topicChoice))topicChoice='all';if(select)select.value=topicChoice;
 const all=TOPICS.map(q=>({q,...getStats(q)}));const done=all.filter(s=>s.attempts>0).length,errors=all.filter(s=>s.wrong+s.blank>0).length;const tries=all.reduce((n,s)=>n+s.attempts,0),rights=all.reduce((n,s)=>n+s.right,0),legacyExcluded=all.reduce((n,s)=>n+(s.legacyExcluded||0),0);
 total.innerHTML=`<span class="hub-evo-mini">Temas com questões: <b>${done}/26</b></span><span class="hub-evo-mini">Precisão registrada: <b>${tries?Math.round(100*rights/tries)+'%':'Sem dados'}</b> (${rights}/${tries})</span><span class="hub-evo-mini">Temas com erro histórico: <b>${errors}</b></span><span class="hub-evo-mini">Tentativas do banco 4.0, retiradas da métrica: <b>${legacyExcluded}</b></span>`;
 const visible=all.filter(s=>topicChoice==='all'||s.q.id===topicChoice);
 root.innerHTML=visible.map(s=>{const v=verdict(s);const last=s.events.length?s.events.at(-1):null;return `<article class="hub-evo-card" data-status="${v.status}"><div class="hub-evo-head"><h3>${escapeHtml(s.q.topic)}</h3><span class="hub-evo-label">${escapeHtml(AREAS[s.q.group])}</span></div><div class="hub-evo-stats"><span>${s.right}/${s.attempts} acertos</span><span>${s.wrong} erros</span><span>${s.blank} branco</span></div><p><b>${escapeHtml(v.name)}.</b> ${escapeHtml(v.text)}</p><p class="hub-evo-next">Próximo passo: ${escapeHtml(v.next)}</p><p>Última resposta: ${last?dayPT(last.at):'Sem data recuperável'}.</p><button type="button" data-practice-topic="${escapeHtml(s.q.id)}">Resolver questão deste tema</button></article>`;}).join('');
 root.querySelectorAll('[data-practice-topic]').forEach(b=>b.addEventListener('click',()=>{$('[data-page="questoes"]')?.click();const choose=$('#quiz-topic-choice');if(choose){choose.value=b.dataset.practiceTopic;choose.dispatchEvent(new Event('change',{bubbles:true}));choose.scrollIntoView({behavior:'smooth',block:'center'});}}));
}
function labelStatus(text,problem=false){const x=$('#hub-backup-status');if(x){x.textContent=text;x.style.color=problem?'#9E1C35':'';}}
function exportBackup(){let items={},fail=[];for(const key of KEYS){try{const val=localStorage.getItem(key);if(val!==null)items[key]=val;}catch(_){fail.push(key);}}if(fail.length){labelStatus('Alguns dados não puderam ser lidos. Nenhum arquivo incompleto foi exportado.',true);return;}
 const data={format:BACKUP_FORMAT,schema:1,exportedAt:new Date().toISOString(),site:'Trilha de Ouro | Study Hub',items};
 const payload=JSON.stringify(data,null,2),blob=new Blob([payload],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='trilha-de-ouro-backup-'+new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()).replaceAll('/','-')+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
 labelStatus('Cópia exportada. Guarde o arquivo em um local seguro. Não é sincronização automática.');
}
async function importBackup(file){if(!file)return;if(file.size>20*1024*1024){labelStatus('Arquivo grande demais (máximo 20 MB).',true);return;}let data;try{data=JSON.parse(await file.text());}catch(_){labelStatus('Arquivo inválido. Esperado JSON da Trilha de Ouro.',true);return;}
 if(data?.format!==BACKUP_FORMAT||data.schema!==1||!data.items||typeof data.items!=='object'||Array.isArray(data.items)){labelStatus('O arquivo não é um backup compatível da Trilha de Ouro.',true);return;}
 const keys=Object.keys(data.items);if(!keys.length||keys.some(k=>!KEYS.includes(k)||typeof data.items[k]!=='string')){labelStatus('Backup contém chaves ou formatos inesperados. Importação cancelada.',true);return;}
 for(const key of keys){if(key!== 'trilha-ouro-studyhub-doodle-v1'&&key!=='trilha-ouro-studyhub-cover-v1'){try{const v=JSON.parse(data.items[key]);if(v===null||typeof v!=='object')throw Error('Invalid object');}catch(_){labelStatus('Conteúdo inválido para '+key+'. Nada foi alterado.',true);return;}}}
 if(!confirm('Importar a cópia? Os dados atuais nas '+keys.length+' categorias presentes no arquivo serão substituídos. Faça um backup atual antes de continuar.'))return;
 const snapshot={};for(const key of keys)snapshot[key]=localStorage.getItem(key);
 try{keys.forEach(k=>localStorage.setItem(k,data.items[k]));}catch(e){try{keys.forEach(k=>snapshot[k]===null?localStorage.removeItem(k):localStorage.setItem(k,snapshot[k]));}catch(_){}labelStatus('Falha ao gravar, espaço do navegador pode estar cheio. Tentativa de restauração aplicada.',true);return;}
 labelStatus('Backup importado. Recarregando para restaurar os estudos.');location.reload();
}
function init(){const file=$('#hub-import-backup');$('#hub-save-backup')?.addEventListener('click',exportBackup);$('#hub-save-backup-panel')?.addEventListener('click',exportBackup);file?.addEventListener('change',()=>{const picked=file.files?.[0];importBackup(picked).finally(()=>{file.value='';});});
 window.addEventListener('trilha:progress-saved',()=>{renderEvolution();const info=$('#save-status');if(info&&info.textContent!=='Salvo só nesta sessão')info.textContent='Salvo automaticamente';});
 window.addEventListener('trilha:topic-changed',renderEvolution);
 window.addEventListener('trilha:gold-progress-updated',renderEvolution);
 window.addEventListener('storage',e=>{if(e.key===CORE||e.key===EVOLUTION_PREF||e.key==='trilha-ouro-gold-questoes-v4')renderEvolution();});
 renderEvolution();
}
init();
})();
