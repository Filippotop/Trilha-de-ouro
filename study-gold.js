/* Questões da Apostila de Ouro | Banco autoral ampliado v4.
 * Camada adicional. Não substitui dados, IDs ou handlers anteriores.
 * Respostas e Caderno persistem em chave exclusiva e são incluídos no backup do Study Hub.
 */
(() => {
'use strict';
const root=document.getElementById('gold-workspace');if(!root)return;
const $=(sel,container=document)=>container.querySelector(sel),$$=(sel,container=document)=>Array.from(container.querySelectorAll(sel));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const KEY='trilha-ouro-gold-questoes-v4'; // Chave histórica preservada integralmente
const APPROVED=new Set(["sc-A5","sc-A4","sc-A7","sc-A8","sm-A2"]);
const UNREVIEWED='Este conjunto foi retirado da aplicação porque as questões antigas eram repetitivas e não atendiam ao nível exigido. O histórico permanece salvo. Banco em reescrita e auditoria.';
const PACK=JSON.parse(document.getElementById('gold-manifest').textContent);
const META=PACK.topics;
const GROUPS={'P2 • Saúde da Criança II':'P2 Criança II','P2 • Saúde da Mulher II':'P2 Mulher II','OSCE • Saúde da Criança II':'OSCE Criança II','OSCE • Saúde da Mulher II':'OSCE Mulher II'};
let state={schema:1,version:'5.1.0',selected:'sc-A5',drafts:{},runs:[]};
try{const raw=localStorage.getItem(KEY);if(raw){let saved=JSON.parse(raw);if(saved&&typeof saved==='object'){state={...state,...saved,drafts:saved.drafts&&typeof saved.drafts==='object'?saved.drafts:{},runs:Array.isArray(saved.runs)?saved.runs:[]};}}}catch(e){/* Browser may restrict storage; keep live session */}
let currentMode='topic',currentTopic=META.some(t=>t.id===state.selected)&&APPROVED.has(state.selected)?state.selected:'sc-A5';
let displayedQuestion=0;
let showCorrections=false;
let loaded={};
let pending=null;
const topicKey=t=>'t5:'+t; // Nova aplicação tem ID isolado; t: antigos são mantidos
const modeKey=()=>currentMode==='sim'?'s5:global':topicKey(currentTopic);
const now=()=>new Date().toISOString();
const fmtDate=timestamp=>new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(timestamp));
function save(){state.selected=currentTopic;try{localStorage.setItem(KEY,JSON.stringify(state));window.dispatchEvent(new Event('trilha:gold-progress-updated'));window.dispatchEvent(new Event('trilha:progress-saved'));}catch(e){status('Não foi possível salvar no navegador. Exporte os dados existentes e libere espaço.',true);}}
function status(message,isError=false){const el=$('#gold-status');if(el){el.textContent=message;el.dataset.error=isError?'true':'false';}}
function safeFilename(id){return /^([a-z]{2}-[AE][0-9]{1,2})$/.test(id);}
function dataMeta(id){return META.find(x=>x.id===id)||null;}
function scriptFor(mode,topic){return mode==='sim'?'questoes/v5-simulado.js':'questoes/v5-'+topic+'.js';}
async function load(mode,topic){
 if(mode==='sim')throw new Error('Simulado de 50 questões retirado para reescrita. O modelo anterior não atende ao protocolo. Nenhuma nota antiga será alterada.');
 if(!APPROVED.has(topic))throw new Error(UNREVIEWED);
 const id='v5-'+topic;
 if(loaded[id])return loaded[id];
 if(!safeFilename(topic)&&mode!=='sim')throw new Error('Tema inválido');
 const cached=window.TRILHA_GOLD_BANKS?.[id];if(cached){loaded[id]=cached;return cached;}
 if(pending?.id===id)return pending.promise;
 status('Carregando banco de questões…');
 const task=new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=scriptFor(mode,topic);script.async=true;
   script.onload=()=>{const v=window.TRILHA_GOLD_BANKS?.[id];if(v){loaded[id]=v;resolve(v);}else reject(new Error('Banco carregado sem dados.'));};
   script.onerror=()=>reject(new Error('Não foi possível carregar o banco. Verifique a conexão.'));
   document.head.append(script);
 });
 pending={id,promise:task};try{return await task;}finally{pending=null;}
}
function pool(mode=currentMode,topic=currentTopic){const x=loaded[mode==='sim'?'simulation-v5':'v5-'+topic];return mode==='sim'?x:(x?.questions||[]);}
function getDraft(){return state.drafts[modeKey()]||null;}
function getLatestRun(){const key=modeKey();return state.runs.filter(r=>r.key===key).at(-1)||null;}
function ensureDraft(items){const key=modeKey();let draft=state.drafts[key];if(!draft||!Array.isArray(draft.order)||draft.order.length!==items.length){draft={key,mode:currentMode,topicId:currentMode==='sim'?null:currentTopic,startedAt:now(),answers:{},index:0,order:items.map(x=>x.id)};state.drafts[key]=draft;save();}return draft;}
function runScore(results){const valid=results.filter(r=>!r.annulled);let correct=valid.filter(r=>r.correct).length;let blanks=valid.filter(r=>r.blank).length;return {correct,wrong:valid.length-correct-blanks,blanks,annulled:results.length-valid.length,valid:valid.length,pct:valid.length?Math.round(correct/valid.length*100):0};}
function renderModeSelectors(){const topic=$('#gold-topic');if(!topic.dataset.ready){topic.innerHTML=META.map(t=>`<option value="${esc(t.id)}">${esc(t.title)} · ${esc(GROUPS[t.group]||t.group)}${APPROVED.has(t.id)?' · NOVO BANCO CLÍNICO':' · REVISÃO PENDENTE'}</option>`).join('');topic.dataset.ready='1';topic.addEventListener('change',()=>{currentTopic=topic.value;currentMode='topic';displayedQuestion=0;showCorrections=false;save();render().catch(e=>status(e.message,true));});}
 topic.value=currentTopic;
 $('#gold-mode-topic').classList.toggle('active',currentMode==='topic');$('#gold-mode-sim').classList.toggle('active',currentMode==='sim');
 topic.disabled=currentMode==='sim';
 $('#gold-mode-sim').disabled=true;$('#gold-mode-sim').title='Em reescrita. Simulado anterior mantido somente para revisão do histórico.';
 $('#gold-headline').textContent=currentMode==='sim'?'SIMULADO EM AUDITORIA':APPROVED.has(currentTopic)?dataMeta(currentTopic).title + ' · 30 casos clínicos':'BANCO EM AUDITORIA';
 $('#gold-subheading').textContent=currentMode==='sim'?'Banco de 50 não liberado até correção de itens repetitivos.':APPROVED.has(currentTopic)?'O gabarito fica oculto até finalizar o conjunto.':'Em revisão para substituir questões superficiais. Seu histórico está seguro.';
}
function renderSummary(items,draft,submitted){const answered=items.filter(q=>Number.isInteger(draft.answers[q.id])).length;
 const count=items.length;
 const marker=$('#gold-count');if(marker)marker.textContent=`${answered}/${count} respondidas`;
 const nav=$('#gold-navgrid');nav.innerHTML=items.map((q,i)=>`<button type="button" class="gold-nav-square ${i===displayedQuestion?'active':''} ${Number.isInteger(draft.answers[q.id])?'answered':''}" data-index="${i}" aria-label="Questão ${i+1}${Number.isInteger(draft.answers[q.id])?', respondida':''}">${i+1}</button>`).join('');
 nav.querySelectorAll('[data-index]').forEach(b=>b.addEventListener('click',()=>{displayedQuestion=+b.dataset.index;draft.index=displayedQuestion;save();renderQuestion(items,draft,submitted);renderSummary(items,draft,submitted);}));
 const submit=$('#gold-submit');submit.disabled=!!submitted;submit.textContent=answered===count?'Finalizar e corrigir':`Finalizar com ${count-answered} em branco`;
 $('#gold-draft-status').textContent=submitted?'Conjunto encerrado. Histórico preservado.':`Rascunho salvo automaticamente · ${fmtDate(draft.startedAt)}`;
 $('#gold-start-new').hidden=!submitted;
}
function renderQuestion(items,draft,submitted){const q=items[displayedQuestion];if(!q){$('#gold-question').innerHTML='<div class="gold-empty">Não há questão nesta posição.</div>';return;}
 const selected=draft.answers[q.id];
 const labels='ABCDE';
 let optionMarkup=q.options.map((option,i)=>{
    const chosen=selected===i;
    const disclose=submitted&&showCorrections;
    const states=(disclose&&i===q.answer?' is-correct':'')+(disclose&&chosen&&i!==q.answer?' is-wrong':'');
    return `<label class="gold-choice${chosen?' is-chosen':''}${states}"><input type="radio" name="gold-answer" value="${i}" ${chosen?'checked':''} ${submitted?'disabled':''}><span class="gold-letter">${labels[i]}</span><span class="gold-choice-text">${esc(option)}</span></label>`;
 }).join('');
 const note=(!submitted||!showCorrections)?'A correção das alternativas só será exibida após finalizar todo o conjunto.':'Correção individual com as cinco alternativas.';
 const after=submitted&&showCorrections?renderCorrection(q,selected):'';
 const title=`QUESTÃO ${String(displayedQuestion+1).padStart(2,'0')} / ${items.length}`;
 $('#gold-question').innerHTML=`<div class="gold-question-index">${title}</div><div class="gold-question-stem">${esc(q.stem).replace(/\n/g,'<br>')}</div><div class="gold-answers">${optionMarkup}</div><p class="gold-quiet">${note}</p>${after}`;
 if(!submitted){$$('input[name="gold-answer"]',$('#gold-question')).forEach(input=>input.addEventListener('change',()=>{draft.answers[q.id]=Number(input.value);save();renderSummary(items,draft,null);renderQuestion(items,draft,null);}));}
 $('#gold-previous').disabled=displayedQuestion===0;
 $('#gold-next').disabled=displayedQuestion===items.length-1;
 $('#gold-previous').onclick=()=>{displayedQuestion=Math.max(0,displayedQuestion-1);draft.index=displayedQuestion;save();renderSummary(items,draft,submitted);renderQuestion(items,draft,submitted);};
 $('#gold-next').onclick=()=>{displayedQuestion=Math.min(items.length-1,displayedQuestion+1);draft.index=displayedQuestion;save();renderSummary(items,draft,submitted);renderQuestion(items,draft,submitted);};
 $$('[data-gold-theory]',$('#gold-question')).forEach(b=>b.onclick=()=>openTheory(b.dataset.goldTheory));
}
function renderCorrection(q,selected){const blank=!Number.isInteger(selected),correct=!blank&&selected===q.answer;
 const heading=`<div class="gold-result-label ${correct?'ok':'bad'}">${blank?'EM BRANCO':correct?'ACERTO':'ERRO'} · Sua resposta: ${blank?'Em branco':'ABCDE'[selected]} · Gabarito: ${'ABCDE'[q.answer]}</div>`;
 const alternatives=q.options.map((o,i)=>`<div class="gold-reason ${i===q.answer?'right':''}"><strong>${'ABCDE'[i]}) ${esc(o)}</strong><p>${esc(q.analysis?.[i]||'Consultar a fonte do conjunto.')}</p></div>`).join('');
 const linked=esc(q.topicId);const label=`${currentMode==='sim'?'<span class="gold-reveal-topic">Tema avaliado: '+esc(q.topic||dataMeta(q.topicId)?.title)+'</span>':''}`;
 return `<div class="gold-correction">${heading}${label}<p><b>Raciocínio clínico:</b> ${esc(q.explanation)}</p><div class="gold-reasons"><h4>Análise alternativa por alternativa</h4>${alternatives}</div><p><b>MEMORIZAR:</b> ${esc(q.memorizar)}</p><button class="gold-theory" type="button" data-gold-theory="${linked}">Revisar conteúdo e Pente-Fino</button></div>`;
}
function openTheory(id){document.querySelector('[data-page="conteudo"]')?.click();const b=document.querySelector(`[data-library-select="${id}"]`)||document.querySelector(`[data-open-topic="${id}"]`);if(b)b.click();else document.getElementById('page-conteudo')?.scrollIntoView({behavior:'smooth'});}
function finalize(items,draft){const answered=items.filter(q=>Number.isInteger(draft.answers[q.id])).length;const blanks=items.length-answered;
 if(!window.confirm(`Finalizar ${items.length} questões? ${blanks} ficarão em branco, serão contabilizadas e o gabarito será liberado. O conjunto ficará salvo no histórico.`))return;
 const submittedAt=now();
 const results=items.map(q=>{const selected=Number.isInteger(draft.answers[q.id])?draft.answers[q.id]:null;return {id:q.id,topicId:q.topicId,selected,answer:q.answer,correct:selected===q.answer,blank:selected===null,at:submittedAt,annulled:false};});
 const run={id:`goldrun-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,key:modeKey(),mode:currentMode,topicId:currentMode==='sim'?null:currentTopic,startedAt:draft.startedAt,submittedAt,sourceVersion:PACK.version,results};
 state.runs.push(run);delete state.drafts[modeKey()];save();displayedQuestion=0;showCorrections=true;status('Conjunto corrigido. O Caderno mantém erros e questões em branco.');render().catch(e=>status(e.message,true));renderErrors();
}
function renderFinished(items,run){const score=runScore(run.results);const draft={startedAt:run.startedAt,answers:Object.fromEntries(run.results.map(r=>[r.id,r.selected]))};
 $('#gold-stats').innerHTML=`<div><b>${score.correct}/${score.valid}</b><small>Acertos válidos</small></div><div><b>${score.pct}%</b><small>Precisão</small></div><div><b>${score.wrong}</b><small>Erros</small></div><div><b>${score.blanks}</b><small>Em branco</small></div>`;
 $('#gold-score').hidden=false;
 const advice=score.pct<60?'Prioridade: reconstruir fundamentos e refazer os mecanismos errados.':score.pct<80?'Prioridade: reforçar diferenciais e análise dos distratores.':'Prioridade: aprofundar casos clínicos e conferir retenção em novo conjunto.';
 $('#gold-outcome').textContent=advice+' Resultado de uma aplicação; não demonstra domínio definitivo.';
 const body={...draft,index:displayedQuestion};
 renderSummary(items,body,true);renderQuestion(items,body,true);
 $('#gold-submit').disabled=true;
 $('#gold-start-new').hidden=false;
 $('#gold-show-all').hidden=false;
}
function renderProgress(items){const latest=getLatestRun();const draft=getDraft();
 $('#gold-score').hidden=!latest;
 $('#gold-show-all').hidden=!latest;
 if(draft){showCorrections=false;displayedQuestion=Math.max(0,Math.min(items.length-1,Number(draft.index)||0));renderSummary(items,draft,null);renderQuestion(items,draft,null);$('#gold-submit').onclick=()=>finalize(items,draft);$('#gold-score').hidden=true;$('#gold-show-all').hidden=true;}
 else if(latest){displayedQuestion=Math.max(0,Math.min(displayedQuestion,items.length-1));showCorrections=true;renderFinished(items,latest);}else{
   const d=ensureDraft(items);showCorrections=false;displayedQuestion=0;renderSummary(items,d,null);renderQuestion(items,d,null);$('#gold-score').hidden=true;$('#gold-submit').onclick=()=>finalize(items,d);
 }
}
async function render(){renderModeSelectors();const b=$('#gold-question');b.innerHTML='<div class="gold-loading">Carregando questões do tema selecionado…</div>';
 try{const bank=await load(currentMode,currentTopic);const items=currentMode==='sim'?bank:bank.questions;
  if(currentMode==='topic'&&items.length!==30)throw new Error('O banco não contém 30 questões.');
  if(currentMode==='sim'&&items.length!==50)throw new Error('Simulado incompleto.');
  renderProgress(items);renderShortEvolution();status('Respostas armazenadas apenas neste navegador. Exporte backup em Personalizar.');
 }catch(e){b.innerHTML=`<div class="gold-error">${esc(e.message)} Não alteramos os registros anteriores.</div>`;status(e.message,true);} }
function renderShortEvolution(){const key=modeKey();const runs=state.runs.filter(r=>r.key===key);const el=$('#gold-history');
 if(!runs.length){el.innerHTML='<p class="gold-quiet">Nenhum conjunto finalizado neste banco.</p>';return;}
 const last=runs.slice(-4).reverse().map(r=>{const a=runScore(r.results);return `<div class="gold-history-row"><strong>${a.pct}%</strong><span>${a.correct}/${a.valid} · ${a.wrong} erros · ${a.blanks} em branco</span><small>${fmtDate(r.submittedAt)}</small></div>`}).join('');
 const recent=runs.slice(-3);let summary='Amostra insuficiente para estimar evolução entre aplicações.';
 if(recent.length>=2){const a=runScore(recent[recent.length-2].results).pct,b=runScore(recent.at(-1).results).pct;summary=b>a?'Aumento de '+(b-a)+' pontos percentuais desde a aplicação anterior.':b<a?'Redução de '+(a-b)+' pontos percentuais desde a aplicação anterior.':'Mesmo percentual da aplicação anterior.';summary+=' A comparação não controla dificuldade ou repetição das questões.';}
 el.innerHTML=`${last}<p class="gold-quiet">${esc(summary)}</p>`;
}
function renderErrors(){const container=$('#gold-error-list');if(!container)return;const bad=state.runs.flatMap(r=>r.results.filter(q=>!q.correct||q.blank).map(q=>({...q,runId:r.id,mode:r.mode}))).reverse();
 $('#gold-error-count').textContent=bad.length?`${bad.length} ocorrência(s) históricas (erros e brancos)`:'Sem erros deste banco registrados';
 if(!bad.length){container.innerHTML='<p class="gold-quiet">Nenhum erro ou branco finalizado no novo banco. O Caderno antigo permanece abaixo.</p>';return;}
 container.innerHTML=bad.slice(0,150).map((x,i)=>`<article class="gold-error-item"><div><span class="gold-mini-pill">${x.blank?'EM BRANCO':'ERRO'} · ${fmtDate(x.at)}</span><h3>${esc(dataMeta(x.topicId)?.title||'Tema do programa')}</h3><p><b>Questão:</b> ${esc(x.id)}. Resposta: ${x.blank?'Em branco':'ABCDE'[x.selected]}. Correta: ${'ABCDE'[x.answer]}.</p></div><button type="button" data-gold-review="${esc(x.id)}" data-gold-run="${esc(x.runId)}">Ver correção</button></article>`).join('')+(bad.length>150?`<p class="gold-quiet">Mostrando as 150 ocorrências mais recentes de ${bad.length}. O histórico integral permanece salvo no backup.</p>`:'');
 $$('[data-gold-review]',container).forEach(b=>b.onclick=()=>reviewPast(b.dataset.goldReview,b.dataset.goldRun));
}
async function loadLegacy(mode,topic){
 const id=mode==='sim'?'simulation':topic;
 const cached=window.TRILHA_GOLD_BANKS?.[id];if(cached)return cached;
 const url=mode==='sim'?'questoes/simulado.js':'questoes/'+topic+'.js';
 return new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=url;script.async=true;script.onload=()=>{const data=window.TRILHA_GOLD_BANKS?.[id];data?resolve(data):reject(Error('Questão antiga indisponível. O registro da resposta permanece no backup.'));};script.onerror=()=>reject(Error('Arquivo histórico indisponível. A resposta continua salva.'));document.head.appendChild(script);});
}
async function reviewPast(qId,runId){const run=state.runs.find(r=>r.id===runId);const result=run?.results.find(r=>r.id===qId);if(!run||!result)return;
 const mode=run.mode==='sim'?'sim':'topic', topic=result.topicId;
 try{const legacy=!/^5\.(?:0|1)\.0$/.test(run.sourceVersion || '');const bank=legacy?await loadLegacy(mode,topic):await load(mode,topic);const items=mode==='sim'?bank:bank.questions;const q=items.find(x=>x.id===qId);if(!q)throw new Error('A questão da aplicação anterior não está disponível nesta versão.');
 const box=$('#gold-error-detail');box.innerHTML=`<div class="gold-review-top"><h3>${esc(dataMeta(result.topicId)?.title||'Questão revisada')}</h3><button type="button" id="gold-close-detail" aria-label="Fechar revisão">Fechar</button></div><p class="gold-question-stem">${esc(q.stem).replace(/\n/g,'<br>')}</p>${renderCorrection(q,result.selected)}`;
 box.hidden=false;box.scrollIntoView({behavior:'smooth',block:'start'});
 $('#gold-close-detail').onclick=()=>{box.hidden=true;};$$('[data-gold-theory]',box).forEach(b=>b.onclick=()=>openTheory(b.dataset.goldTheory));
 }catch(e){status(e.message,true);}
}
function init(){renderModeSelectors();$('#gold-mode-topic').onclick=()=>{currentMode='topic';showCorrections=false;displayedQuestion=0;render().catch(e=>status(e.message,true));};
 $('#gold-mode-sim').onclick=()=>{currentMode='sim';showCorrections=false;displayedQuestion=0;render().catch(e=>status(e.message,true));};
 $('#gold-start-new').onclick=async()=>{const items=pool();if(!items?.length)return;if(!window.confirm('Iniciar nova aplicação? O histórico finalizado será preservado.'))return;delete state.drafts[modeKey()];const d=ensureDraft(items);displayedQuestion=0;showCorrections=false;render().catch(e=>status(e.message,true));};
 $('#gold-show-all').onclick=()=>{showCorrections=true;const r=getLatestRun();const items=pool();if(r)renderFinished(items,r);};
 $('#gold-legacy-toggle').onclick=()=>{document.body.classList.toggle('gold-legacy-open');const old=document.body.classList.contains('gold-legacy-open');$('#gold-legacy-toggle').setAttribute('aria-expanded',String(old));$('#gold-legacy-toggle').textContent=old?'Ocultar banco anterior':'Abrir banco anterior (26 + 20)';};
 window.addEventListener('trilha:gold-progress-updated',renderErrors);
 window.addEventListener('storage',e=>{if(e.key===KEY){try{const d=JSON.parse(e.newValue||'{}');if(d&&typeof d==='object'){state={...state,...d};renderErrors();renderShortEvolution();}}catch(_){}}});
 render().catch(e=>status(e.message,true));renderErrors();
}
init();
})();
