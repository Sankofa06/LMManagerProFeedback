/* survivor-utils.js — survivor view, export/import, utilities */

function rebuildCatScores() {
  ROSTER.forEach(r => {
    r.avgScore = r.totalSessions > 0 ? r.score / r.totalSessions : 0;
  });
  saveRoster();
}

function tagSession(personaId, tag) {
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  if (!r.tags) r.tags = [];
  if (!r.tags.includes(tag)) r.tags.push(tag);
  saveRoster();
  renderRosterIf && renderRosterIf();
}

function openStatsModal(personaId) {
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  const modal = document.getElementById('stats-modal');
  if (!modal) return;
  const body = document.getElementById('stats-modal-body');
  if (body) {
    body.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
        <span style="font-size:2rem">${r.emoji || '🤖'}</span>
        <div>
          <div style="font-weight:700;font-size:1rem">${esc(r.name)}</div>
          <div style="color:var(--tx3);font-size:.78rem">${r.role || ''} · ${r.modelId || 'No model'}</div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        ${[['Score',displayScore(r)],['Sessions',r.totalSessions||0],['Wins',r.wins||0],['Losses',r.losses||0]]
          .map(([l,v])=>`<div style="background:var(--bg2);border-radius:8px;padding:8px 12px">
            <div style="font-size:.7rem;color:var(--tx3);text-transform:uppercase;margin-bottom:2px">${l}</div>
            <div style="font-size:1.1rem;font-weight:700">${v}</div>
          </div>`).join('')}
      </div>
      ${Object.keys(r.criteriaScores||{}).length > 0 ? `
        <div style="margin-bottom:8px;font-size:.8rem;font-weight:600;color:var(--tx2)">Criteria Scores</div>
        ${Object.entries(r.criteriaScores).map(([k,v])=>
          `<div style="display:flex;justify-content:space-between;padding:3px 0;border-bottom:1px solid var(--bdr);font-size:.83rem">
            <span>${esc(k)}</span><span style="font-weight:700">${v}</span>
          </div>`
        ).join('')}
      ` : ''}
    `;
  }
  modal.classList.add('open');
}

function closeModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('open');
}

let sortKey = 'score';
const SORT_KEYS = ['score','wins','losses','name','avgScore'];

function setSortKey(key) {
  sortKey = key;
  state.boardSort = key;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderSurvivorIf();
}

function sortedRoster() {
  return [...ROSTER].sort((a, b) => {
    if (sortKey === 'name') return (a.name||'').localeCompare(b.name||'');
    if (sortKey === 'wins') return (b.wins||0) - (a.wins||0);
    if (sortKey === 'losses') return (b.losses||0) - (a.losses||0);
    if (sortKey === 'avgScore') return (b.avgScore||0) - (a.avgScore||0);
    return combinedScore(b) - combinedScore(a);
  });
}

function setSurvivorView(view) {
  state.survivorView = view;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderSurvivor();
}

function renderSurvivor() {
  const wrap = document.getElementById('survivor-wrap');
  if (!wrap) return;
  const view = state.survivorView || 'grid';
  const filtered = sortedRoster().filter(r => {
    if (state.archetypeFilter && r.role !== state.archetypeFilter) return false;
    if (state.familyFilter) {
      const fam = modelFamily(r.modelId || '');
      if (fam !== state.familyFilter) return false;
    }
    return true;
  });
  if (view === 'list') {
    wrap.innerHTML = `
      <div id="leaderboard-list">
        <div class="lb-header">
          <span>#</span><span></span>
          <span onclick="setSortKey('name')" style="cursor:pointer">Name</span>
          <span onclick="setSortKey('score')" style="cursor:pointer">Score</span>
          <span onclick="setSortKey('wins')" style="cursor:pointer">W</span>
          <span onclick="setSortKey('losses')" style="cursor:pointer">L</span>
          <span>🔥</span><span>🛡️</span>
        </div>
        ${filtered.map((r, i) => `
          <div class="lb-row${r.torch?' torch':r.immune?' immune':''}" onclick="setRosterFocus('${r.id}')" style="cursor:pointer">
            <span class="lb-rank">${i+1}</span>
            <span class="lb-medal">${i===0?'🥇':i===1?'🥈':i===2?'🥉':''}</span>
            <span class="lb-name">${r.emoji||'🤖'} ${esc(r.name)}</span>
            <span class="lb-score">${displayScore(r)}</span>
            <span class="lb-wins">${r.wins||0}</span>
            <span class="lb-losses">${r.losses||0}</span>
            <span class="lb-immunity">${r.torch?'🔥':''}</span>
            <span class="lb-immunity">${r.immune?'🛡️':''}</span>
          </div>`
        ).join('')}
      </div>`;
  } else {
    wrap.innerHTML = `<div id="survivor-grid">${
      filtered.map(r =>
        `<div class="survivor-card${r.torch?' torch-card':''}${r.immune?' immune-card':''}" onclick="setRosterFocus('${r.id}')">
          <div class="sc-emoji">${r.emoji||'🤖'}</div>
          <div class="sc-name">${esc(r.name)}</div>
          <div class="sc-score">${displayScore(r)}</div>
          <div class="sc-tags">
            ${r.torch?'<span class="stat-pill torch-pill">🔥 Torch</span>':''}
            ${r.immune?'<span class="stat-pill immune-pill">🛡️ Immune</span>':''}
            ${r.role?`<span class="stat-pill">${esc(r.role)}</span>`:''}
          </div>
        </div>`
      ).join('')
    }</div>`;
  }
}

function renderSurvivorIf() {
  if (state.nav === 'survivor') renderSurvivor();
}

function esc(str) {
  return String(str||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function toast(msg, duration) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:var(--bg1);border:1px solid var(--bdr);border-radius:8px;padding:8px 18px;font-size:.85rem;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:9999;pointer-events:none;opacity:0;transition:opacity .2s;';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, duration || 2200);
}

function renderMarkdown(text) {
  if (!text) return '';
  let s = String(text);
  // Code blocks
  s = s.replace(/```([\s\S]*?)```/g, (_, c) => `<pre><code>${esc(c.trim())}</code></pre>`);
  // Inline code
  s = s.replace(/`([^`]+)`/g, (_, c) => `<code>${esc(c)}</code>`);
  // Bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  // Headings
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Blockquote
  s = s.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  // Unordered list
  s = s.replace(/^[-*] (.+)$/gm, '<li>$1</li>')
       .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  // Line breaks
  s = s.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>');
  if (!s.startsWith('<')) s = `<p>${s}</p>`;
  return s;
}

function filterRosterTable(query) {
  const rows = document.querySelectorAll('.roster-table tbody tr');
  const q = (query||'').toLowerCase();
  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = q && !text.includes(q) ? 'none' : '';
  });
}

function exportData() {
  const data = { roster: ROSTER, teams: TEAMS, machines: MACHINES, version: 1 };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `lmmp-export-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}

function exportFullApp() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('lmmp-'));
  const data = {};
  keys.forEach(k => { try { data[k] = JSON.parse(localStorage.getItem(k)); } catch { data[k] = localStorage.getItem(k); } });
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `lmmp-full-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
}

function triggerFullImport() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { try { importFullApp(JSON.parse(ev.target.result)); } catch { toast('Invalid file.'); } };
    reader.readAsText(file);
  };
  inp.click();
}

function importFullApp(data) {
  if (!data || typeof data !== 'object') { toast('Invalid data.'); return; }
  Object.entries(data).forEach(([k, v]) => {
    if (k.startsWith('lmmp-')) localStorage.setItem(k, JSON.stringify(v));
  });
  toast('Data imported. Reloading…');
  setTimeout(() => location.reload(), 900);
}

function exportPrompts() {
  const prompts = ROSTER.map(r => ({ id: r.id, name: r.name, customPrompt: r.customPrompt, interviewPrompt: r.interviewPrompt }));
  const blob = new Blob([JSON.stringify(prompts, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = 'lmmp-prompts.json'; a.click(); URL.revokeObjectURL(url);
}

function triggerImportPrompts() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { try { importPrompts(JSON.parse(ev.target.result)); } catch { toast('Invalid file.'); } };
    reader.readAsText(file);
  };
  inp.click();
}

function importPrompts(data) {
  if (!Array.isArray(data)) { toast('Invalid prompts file.'); return; }
  data.forEach(p => {
    const r = ROSTER.find(r => r.id === p.id);
    if (r) {
      if (p.customPrompt !== undefined) r.customPrompt = p.customPrompt;
      if (p.interviewPrompt !== undefined) r.interviewPrompt = p.interviewPrompt;
    }
  });
  saveRoster();
  toast('Prompts imported.');
}

function triggerImport() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { try { importData(JSON.parse(ev.target.result)); } catch { toast('Invalid file.'); } };
    reader.readAsText(file);
  };
  inp.click();
}

function importData(data) {
  if (!data || !data.roster) { toast('Invalid data file.'); return; }
  if (data.roster) { ROSTER.length = 0; data.roster.forEach(r => ROSTER.push(r)); saveRoster(); }
  if (data.teams) { TEAMS.length = 0; data.teams.forEach(t => TEAMS.push(t)); saveTeams(); }
  if (data.machines) { MACHINES.length = 0; data.machines.forEach(m => MACHINES.push(m)); saveMachines(); }
  toast('Data imported. Reloading…');
  setTimeout(() => location.reload(), 900);
}

function updateEpBadge() {
  const el = document.getElementById('ep-badge');
  if (el) el.textContent = (EPISODES || []).filter(e => !e.archived).length || '';
}
