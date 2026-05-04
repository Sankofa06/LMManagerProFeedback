/* scoring.js — scoring, chat log rendering, score sheet */

function getScoreSignals() {
  return JSON.parse(localStorage.getItem('lmmp-score-signals') || 'null') || [
    { key:'clarity', label:'Clarity', weight:1, tier:'primary', thresholds:[3,7] },
    { key:'depth', label:'Depth', weight:1, tier:'primary', thresholds:[3,7] },
    { key:'accuracy', label:'Accuracy', weight:1, tier:'primary', thresholds:[3,7] },
    { key:'creativity', label:'Creativity', weight:0.5, tier:'secondary', thresholds:[3,7] },
    { key:'conciseness', label:'Conciseness', weight:0.5, tier:'secondary', thresholds:[3,7] },
  ];
}

function evalSignalStars(response, signal) {
  // Heuristic star rating 1-5 based on response characteristics
  const len = (response || '').length;
  if (signal.key === 'clarity') {
    if (len < 50) return 2;
    if (len > 800) return 4;
    return 3;
  }
  if (signal.key === 'depth') {
    if (len < 100) return 1;
    if (len > 600) return 4;
    return 3;
  }
  if (signal.key === 'accuracy') return 3;
  if (signal.key === 'creativity') {
    const hasCode = /```/.test(response);
    return hasCode ? 4 : 3;
  }
  if (signal.key === 'conciseness') {
    if (len < 200) return 5;
    if (len > 1000) return 2;
    return 3;
  }
  return 3;
}

function autoScore(r, response) {
  const signals = getScoreSignals();
  let totalWeight = 0, weightedSum = 0;
  signals.forEach(s => {
    const stars = evalSignalStars(response, s);
    weightedSum += stars * s.weight;
    totalWeight += s.weight;
  });
  const raw = totalWeight > 0 ? (weightedSum / totalWeight) : 3;
  return Math.round(raw * 10) / 10;
}

function autoScoreBreakdown(response) {
  const signals = getScoreSignals();
  return signals.map(s => ({
    ...s,
    stars: evalSignalStars(response, s)
  }));
}

function avgCriteriaScore(r) {
  const scores = Object.values(r.criteriaScores || {});
  if (scores.length === 0) return 0;
  return Math.round((scores.reduce((a,b)=>a+b,0) / scores.length) * 10) / 10;
}

function rosterAggregate(r) {
  if (r.totalSessions === 0) return 0;
  return Math.round((r.score / r.totalSessions) * 10) / 10;
}

function combinedScore(r) {
  const agg = rosterAggregate(r);
  const criteria = avgCriteriaScore(r);
  if (agg === 0 && criteria === 0) return 0;
  if (criteria === 0) return agg;
  return Math.round(((agg + criteria) / 2) * 10) / 10;
}

function displayScore(r) {
  const s = combinedScore(r);
  return s > 0 ? s.toFixed(1) : '—';
}

/* ── CHAT LOG RENDERING ────────────────────────────────── */
function clearRunLog() {
  const log = document.getElementById('chat-log');
  if (log) log.innerHTML = '';
}

function addChatBubble(msg, container) {
  const log = container || document.getElementById('chat-log');
  if (!log) return null;
  const div = document.createElement('div');
  div.className = `chat-bubble ${msg.role || 'assistant'}`;
  let html = '';
  if (msg.sender) html += `<div class="bubble-sender">${esc(msg.sender)}</div>`;
  const { thinking, reply } = splitThinking(msg.content || '');
  if (thinking) html += thinkingBubbleHTML(thinking);
  html += `<div class="bubble-md">${renderMarkdown(reply)}</div>`;
  div.innerHTML = html;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

function addSysMsg(text, container) {
  const log = container || document.getElementById('chat-log');
  if (!log) return;
  const div = document.createElement('div');
  div.className = 'chat-bubble system';
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
}

function addLogEntry(data) {
  // Alias for addChatBubble with log entry format
  return addChatBubble(data);
}

function updateLogEntry(bubble, content, sender) {
  if (!bubble) return;
  const { thinking, reply } = splitThinking(content || '');
  let html = '';
  if (sender) html += `<div class="bubble-sender">${esc(sender)}</div>`;
  if (thinking) html += thinkingBubbleHTML(thinking);
  html += `<div class="bubble-md">${renderMarkdown(reply)}</div>`;
  bubble.innerHTML = html;
  const log = bubble.parentElement;
  if (log) log.scrollTop = log.scrollHeight;
}

function finalizeLog(bubble, content, sender) {
  updateLogEntry(bubble, content, sender);
}

function toggleBreakdown(btn) {
  const wrap = btn.closest('.breakdown-wrap');
  if (!wrap) return;
  const body = wrap.querySelector('.breakdown-body');
  if (!body) return;
  const open = body.style.display !== 'none';
  body.style.display = open ? 'none' : 'block';
  btn.textContent = open ? 'Show breakdown' : 'Hide breakdown';
}

function setCriteriaScore(personaId, key, value) {
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  if (!r.criteriaScores) r.criteriaScores = {};
  r.criteriaScores[key] = parseFloat(value);
  saveRoster();
  renderRosterIf && renderRosterIf();
}

function setScore(personaId, score) {
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  const s = parseFloat(score);
  if (isNaN(s)) return;
  r.score = (r.score || 0) + s;
  r.totalSessions = (r.totalSessions || 0) + 1;
  r.avgScore = r.totalSessions > 0 ? r.score / r.totalSessions : 0;
  saveRoster();
}

function splitThinking(content) {
  if (!content) return { thinking: '', reply: content || '' };
  // Handle <think>...</think>
  const thinkMatch = content.match(/^<think>([\s\S]*?)<\/think>([\s\S]*)$/i);
  if (thinkMatch) return { thinking: thinkMatch[1].trim(), reply: thinkMatch[2].trim() };
  // Unclosed <think>
  const unclosed = content.match(/^<think>([\s\S]*)$/i);
  if (unclosed) return { thinking: unclosed[1].trim(), reply: '' };
  // Bare >>> prefix
  if (content.startsWith('>>>')) {
    const nl = content.indexOf('\n');
    if (nl > -1) return { thinking: content.slice(3, nl).trim(), reply: content.slice(nl+1).trim() };
    return { thinking: content.slice(3).trim(), reply: '' };
  }
  // Italic CoT *thinking...*
  const italicMatch = content.match(/^\*([\s\S]*?)\*\n([\s\S]*)$/);
  if (italicMatch) return { thinking: italicMatch[1].trim(), reply: italicMatch[2].trim() };
  return { thinking: '', reply: content };
}

function thinkingBubbleHTML(thinking) {
  return `<div class="thinking-bubble">
    <div class="thinking-header" onclick="this.parentElement.classList.toggle('open')">
      <span class="thinking-toggle-icon">▶</span>
      <span>Thinking…</span>
    </div>
    <div class="thinking-body">${esc(thinking)}</div>
  </div>`;
}

let scoreSheetCtx = null;

function openScoreSheet(personaId, sessionIdx) {
  scoreSheetCtx = { personaId, sessionIdx };
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  const criteria = JSON.parse(localStorage.getItem('lmmp-criteria') || '[]');
  const list = document.getElementById('score-sheet-criteria');
  if (list) {
    list.innerHTML = criteria.map(c =>
      `<div class="score-sheet-row">
        <span class="score-sheet-label">${esc(c.name)}</span>
        <input type="range" class="score-sheet-slider" min="0" max="10" step="0.5"
          value="${(r.criteriaScores||{})[c.key] || 5}"
          oninput="onCriteriaSlide(this,'${c.key}')">
        <span class="score-sheet-val" id="ssv-${c.key}">${(r.criteriaScores||{})[c.key] || 5}</span>
      </div>`
    ).join('');
  }
  updateScoreSheetAvg();
  const modal = document.getElementById('score-sheet-modal');
  if (modal) modal.classList.add('open');
}

function onCriteriaSlide(el, key) {
  const val = parseFloat(el.value);
  const label = document.getElementById(`ssv-${key}`);
  if (label) label.textContent = val;
  if (scoreSheetCtx) {
    const r = ROSTER.find(r => r.id === scoreSheetCtx.personaId);
    if (r) {
      if (!r.criteriaScores) r.criteriaScores = {};
      r.criteriaScores[key] = val;
    }
  }
  updateScoreSheetAvg();
}

function updateScoreSheetAvg() {
  if (!scoreSheetCtx) return;
  const r = ROSTER.find(r => r.id === scoreSheetCtx.personaId);
  const avg = r ? avgCriteriaScore(r) : 0;
  const el = document.getElementById('score-sheet-avg');
  if (el) el.textContent = `Avg: ${avg.toFixed(1)}`;
}

function resetScoreSheet() {
  if (!scoreSheetCtx) return;
  const r = ROSTER.find(r => r.id === scoreSheetCtx.personaId);
  if (r) { r.criteriaScores = {}; saveRoster(); }
  closeScoreSheet();
}

function closeScoreSheet() {
  if (scoreSheetCtx) {
    const r = ROSTER.find(r => r.id === scoreSheetCtx.personaId);
    if (r) saveRoster();
  }
  scoreSheetCtx = null;
  const modal = document.getElementById('score-sheet-modal');
  if (modal) modal.classList.remove('open');
}

function refreshScoreButton(personaId) {
  const btn = document.querySelector(`[data-score-btn="${personaId}"]`);
  if (!btn) return;
  const r = ROSTER.find(r => r.id === personaId);
  if (r) btn.textContent = displayScore(r);
}

function openCriteriaModal() {
  renderCriteriaList();
  const m = document.getElementById('criteria-modal');
  if (m) m.classList.add('open');
}

function renderCriteriaList() {
  const list = document.getElementById('criteria-list');
  if (!list) return;
  const criteria = JSON.parse(localStorage.getItem('lmmp-criteria') || '[]');
  list.innerHTML = criteria.length === 0
    ? '<div style="color:var(--tx3);font-size:.82rem;">No criteria yet.</div>'
    : criteria.map((c, i) =>
        `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr)">
          <span style="flex:1;font-size:.85rem">${esc(c.name)}</span>
          <button class="btn-sm" onclick="renameCriterion(${i})">Rename</button>
          <button class="btn-sm danger" onclick="removeCriterion(${i})">&times;</button>
        </div>`
      ).join('');
}

function renameCriterion(idx) {
  const criteria = JSON.parse(localStorage.getItem('lmmp-criteria') || '[]');
  const c = criteria[idx];
  if (!c) return;
  const name = prompt('New name:', c.name);
  if (!name || !name.trim()) return;
  c.name = name.trim();
  localStorage.setItem('lmmp-criteria', JSON.stringify(criteria));
  renderCriteriaList();
}

function removeCriterion(idx) {
  const criteria = JSON.parse(localStorage.getItem('lmmp-criteria') || '[]');
  criteria.splice(idx, 1);
  localStorage.setItem('lmmp-criteria', JSON.stringify(criteria));
  renderCriteriaList();
}

function addCriterion() {
  const inp = document.getElementById('new-criterion-input');
  if (!inp) return;
  const name = inp.value.trim();
  if (!name) return;
  const criteria = JSON.parse(localStorage.getItem('lmmp-criteria') || '[]');
  const key = name.toLowerCase().replace(/\s+/g,'_');
  if (criteria.find(c => c.key === key)) { toast('Criterion already exists.'); return; }
  criteria.push({ key, name });
  localStorage.setItem('lmmp-criteria', JSON.stringify(criteria));
  inp.value = '';
  renderCriteriaList();
  toast('Criterion added.');
}

function renderRosterEvalCard(r) {
  const score = displayScore(r);
  const criteria = Object.entries(r.criteriaScores || {});
  return `<div class="eval-card">
    <div class="eval-card-header">
      <span class="eval-card-emoji">${r.emoji || '🤖'}</span>
      <span class="eval-card-name">${esc(r.name)}</span>
      <span class="eval-card-score">${score}</span>
    </div>
    ${criteria.length > 0 ? `<div class="eval-card-criteria">${
      criteria.map(([k,v]) => `<span class="eval-card-criterion">${esc(k)}: ${v}</span>`).join('')
    }</div>` : ''}
  </div>`;
}
