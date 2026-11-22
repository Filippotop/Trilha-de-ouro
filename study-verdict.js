/* TRILHA DE OURO • REGISTRO DE RESPOSTAS E VEREDITO R1
   - Livro-razão append-only: cada questão respondida (ao finalizar o conjunto) fica gravada com
     alternativa marcada, acerto, tempo, dificuldade, área e subárea.
   - Veredito: modelo de Rasch (1 parâmetro), como no Enamed/Inep. A dificuldade de cada item vem do
     método de Angoff (probabilidade de um candidato minimamente proficiente acertar), estimada pelo autor.
     b = ln((1-p)/p). θ = 0 equivale ao candidato minimamente proficiente. NÃO é calibração empírica.
   - Só a PRIMEIRA tentativa de cada questão entra na estimativa (repetir mede memória, não competência).
*/
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.TrilhaVerdict = api; if (root.document) root.document.addEventListener('DOMContentLoaded', () => api.mount && api.mount(root)); }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const LEDGER_KEY = 'trilha-ouro-respostas-v1';
  const COMPETITIVE = 0.7;      // θ para "residência concorrida" (premissa do app, ajustável)
  const MIN_AREA = 10;          // mínimo de itens (1ª tentativa) por área para emitir veredito
  const PRIOR_SD = 1.0;
  const AREAS = ['Pediatria', 'Ginecologia e Obstetrícia'];

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const sig = x => 1 / (1 + Math.exp(-x));
  const bOf = p => Math.log((1 - p) / p);

  function readLedger(storage) {
    try { const v = JSON.parse((storage || localStorage).getItem(LEDGER_KEY) || 'null'); if (v && Array.isArray(v.entries)) return v; } catch (_) {}
    return { schema: 1, entries: [] };
  }
  function appendEntries(entries, storage) {
    const st = storage || localStorage; const led = readLedger(st);
    const known = new Set(led.entries.map(e => e.uid));
    for (const e of entries) if (!known.has(e.uid)) led.entries.push(e);
    st.setItem(LEDGER_KEY, JSON.stringify(led));
    return led;
  }

  // 1ª tentativa por questão, só itens calibrados e não anulados
  function firstAttempts(entries) {
    const seen = new Map();
    for (const e of [...entries].sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
      if (e.annulled) continue;
      if (!seen.has(e.qid)) seen.set(e.qid, e);
    }
    return [...seen.values()].filter(e => typeof e.angoff === 'number' && e.angoff > 0 && e.angoff < 1);
  }

  // Estimativa MAP de θ (Newton) com prior N(0, PRIOR_SD²). Em branco conta como erro (como na prova).
  function estimate(items) {
    if (!items.length) return null;
    const bs = items.map(i => bOf(i.angoff)), ys = items.map(i => (i.correct ? 1 : 0));
    let th = 0;
    for (let it = 0; it < 50; it++) {
      let g = -th / (PRIOR_SD ** 2), h = -1 / (PRIOR_SD ** 2);
      for (let k = 0; k < bs.length; k++) { const p = sig(th - bs[k]); g += ys[k] - p; h -= p * (1 - p); }
      const step = g / h; th -= step; th = Math.max(-5, Math.min(5, th));
      if (Math.abs(step) < 1e-7) break;
    }
    let info = 1 / (PRIOR_SD ** 2);
    for (const b of bs) { const p = sig(th - b); info += p * (1 - p); }
    const se = 1 / Math.sqrt(info);
    const expected = bs.reduce((s, b) => s + sig(th - b), 0);
    const nSub = new Set(items.map(i => i.subarea || i.topicId)).size;
    return { nSub, theta: th, se, lo: th - 1.96 * se, hi: th + 1.96 * se, n: items.length, hits: ys.reduce((a, b) => a + b, 0), expectedAtZero: bs.reduce((s, b) => s + sig(-b), 0) };
  }

  function classify(est) {
    if (!est || est.n < MIN_AREA) return { code: 'insuficiente', label: 'Amostra insuficiente', tone: 'none', text: `Menos de ${MIN_AREA} questões inéditas nesta área. Não há base para veredito.`, next: `Resolver novas questões desta área até chegar a ${MIN_AREA}.` };
    if (est.hi < 0) return { code: 'abaixo', label: 'Abaixo do proficiente', tone: 'risk', text: 'Mesmo no limite superior do intervalo de confiança, o desempenho fica abaixo do candidato minimamente proficiente.', next: 'Voltar ao conteúdo da apostila nos subtemas com mais erros antes de novas questões.' };
    if (est.theta < 0) return { code: 'limiar-baixo', label: 'Abaixo do corte, resultado incerto', tone: 'attention', text: 'Estimativa abaixo do candidato minimamente proficiente, mas o intervalo ainda inclui o corte.', next: 'Revisar erros por mecanismo e refazer com casos novos.' };
    if (est.theta >= COMPETITIVE && est.nSub < 3) return { code: 'estreito', label: 'Bom desempenho, amostra estreita', tone: 'attention', text: `Estimativa alta, mas vinda de apenas ${est.nSub} subtema(s). Residência cobra amplitude; não dá para afirmar nível competitivo na área toda.`, next: 'Responder questões de pelo menos 3 subtemas diferentes desta área.' };
    if (est.theta < COMPETITIVE) return { code: 'proficiente', label: 'Proficiente, abaixo de residência concorrida', tone: 'attention', text: 'Acima do corte de proficiência, porém abaixo do patamar assumido para residência concorrida.', next: 'Atacar os itens de dificuldade 4 e 5 errados e os subtemas fracos.' };
    if (est.lo > 0) return { code: 'competitivo', label: 'Compatível com residência concorrida', tone: 'none', text: 'Estimativa acima do patamar assumido e com intervalo acima do corte de proficiência.', next: 'Manter ritmo, medir de novo com questões inéditas e simulado.' };
    return { code: 'competitivo-incerto', label: 'Perto de residência concorrida, confiança limitada', tone: 'none', text: 'Estimativa no patamar de residência concorrida, mas o intervalo de confiança ainda cruza o corte.', next: 'Mais questões inéditas para confirmar.' };
  }

  function bySubarea(items) {
    const m = new Map();
    for (const e of items) {
      const k = e.subarea || e.topicId; const r = m.get(k) || { subarea: k, area: e.area, n: 0, hits: 0, expected: 0 };
      r.n++; r.hits += e.correct ? 1 : 0; r.expected += sig(0 - bOf(e.angoff)); m.set(k, r);
    }
    // lacuna = acertou menos do que um candidato minimamente proficiente acertaria nesses mesmos itens
    return [...m.values()].map(r => ({ ...r, gap: r.hits - r.expected })).sort((a, b) => a.gap - b.gap);
  }
  function byDifficulty(items) {
    const t = { 3: { n: 0, hits: 0 }, 4: { n: 0, hits: 0 }, 5: { n: 0, hits: 0 } };
    for (const e of items) if (t[e.difficulty]) { t[e.difficulty].n++; t[e.difficulty].hits += e.correct ? 1 : 0; }
    return t;
  }

  function summarize(entries) {
    const items = firstAttempts(entries);
    const per = {};
    for (const a of AREAS) {
      const sub = items.filter(e => e.area === a);
      const est = estimate(sub);
      per[a] = { est, verdict: classify(est), subareas: bySubarea(sub), diff: byDifficulty(sub), n: sub.length };
    }
    const est = estimate(items);
    return { overall: { est, verdict: classify(est), n: items.length }, areas: per, totalAttempts: entries.length, uniqueQuestions: items.length, repeats: entries.length - new Set(entries.map(e => e.qid)).size };
  }

  const fmt = x => (x >= 0 ? '+' : '') + x.toFixed(2);
  function renderHTML(sum) {
    if (!sum.uniqueQuestions) return '<p class="tv-quiet">Nenhuma questão do banco R1 respondida ainda. Finalize um conjunto para ver o veredito.</p>';
    const card = (title, o) => {
      const e = o.est, v = o.verdict;
      const stat = e ? `<span>θ ${fmt(e.theta)} (IC95% ${fmt(e.lo)} a ${fmt(e.hi)})</span><span>${e.hits}/${e.n} acertos · esperado de um candidato no corte: ${e.expectedAtZero.toFixed(1)}</span>` : '<span>Sem dados</span>';
      return `<article class="tv-card" data-tone="${v.tone}"><h4>${esc(title)}</h4><p class="tv-label">${esc(v.label)}</p><div class="tv-stats">${stat}</div><p>${esc(v.text)}</p><p class="tv-next"><b>Próximo passo:</b> ${esc(v.next)}</p></article>`;
    };
    const diffRow = o => ['3', '4', '5'].map(k => `d${k}: ${o.diff[k].hits}/${o.diff[k].n}`).join(' · ');
    const gaps = AREAS.map(a => {
      const rows = sum.areas[a].subareas.filter(s => s.n >= 3 && s.gap < -0.5).slice(0, 4);
      return rows.length ? `<li><b>${esc(a)}:</b> ${rows.map(r => `${esc(r.subarea)} (${r.hits}/${r.n}, esperado ${r.expected.toFixed(1)})`).join('; ')}</li>` : '';
    }).join('');
    return `<div class="tv-grid">${card('Geral', sum.overall)}${AREAS.map(a => card(a, sum.areas[a])).join('')}</div>
      <p class="tv-quiet">Por dificuldade (1ª tentativa) — ${AREAS.map(a => esc(a) + ': ' + diffRow(sum.areas[a])).join(' | ')}</p>
      ${gaps ? `<p class="tv-quiet"><b>Subtemas abaixo do esperado:</b></p><ul class="tv-gaps">${gaps}</ul>` : ''}
      <p class="tv-quiet">${sum.uniqueQuestions} questões inéditas contam no veredito; ${sum.repeats} repetição(ões) ficam salvas, mas não entram. Modelo de Rasch como no Enamed; dificuldades estimadas pelo método de Angoff pelo autor (sem calibração com dados reais). Patamar de residência concorrida (θ ≥ ${COMPETITIVE}) é premissa do app, não critério oficial. É estimativa de treino, não previsão de aprovação.</p>`;
  }

  function mount(root) {
    const doc = root.document; if (!doc || doc.getElementById('trilha-verdict')) return;
    const anchor = doc.getElementById('hub-evolution-summary'); if (!anchor) return;
    const st = doc.createElement('style');
    st.textContent = '.tv-wrap{margin:1.2rem 0}.tv-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:.8rem}.tv-card{border:1px solid var(--stroke,#e9dce8);border-radius:16px;padding:.9rem 1rem;background:var(--paper,#fff)}.tv-card[data-tone=risk]{border-color:#9E1C35}.tv-card[data-tone=attention]{border-color:#c9902a}.tv-card h4{margin:0 0 .2rem}.tv-label{font-weight:700;margin:.1rem 0}.tv-stats{display:flex;flex-direction:column;font-size:.85rem;opacity:.85;margin-bottom:.4rem}.tv-quiet{font-size:.82rem;opacity:.8}.tv-next{font-size:.9rem}';
    doc.head.appendChild(st);
    const box = doc.createElement('section'); box.id = 'trilha-verdict'; box.className = 'tv-wrap';
    box.innerHTML = '<span class="hub-subhead">Veredito R1 · Dificuldade e área</span><h2>Veredito padrão residência</h2><div id="trilha-verdict-body"></div>';
    anchor.parentNode.insertBefore(box, anchor);
    const draw = () => { box.querySelector('#trilha-verdict-body').innerHTML = renderHTML(summarize(readLedger().entries)); };
    draw();
    ['trilha:gold-progress-updated', 'trilha:ledger-updated'].forEach(ev => root.addEventListener(ev, draw));
    root.addEventListener('storage', e => { if (e.key === LEDGER_KEY) draw(); });
  }

  return { LEDGER_KEY, readLedger, appendEntries, firstAttempts, estimate, classify, summarize, renderHTML, bOf, mount, COMPETITIVE, MIN_AREA };
});
