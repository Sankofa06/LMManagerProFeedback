/* roster.js — roster rendering and detail panel */

let rosterSortKey = 'name';

function setRosterSort(key) {
  rosterSortKey = key;
  renderRoster();
}

function sortRosterGroup(arr) {
  return [...arr].sort((a, b) => {
    if (rosterSortKey === 'score') return combinedScore(b) - combinedScore(a);
    if (rosterSortKey === 'wins') return (b.wins||0) - (a.wins||0);
    if (rosterSortKey === 'role') return (a.role||'').localeCompare(b.role||'');
    return (a.name||'').localeCompare(b.name||'');
  });
}

function renderRoster() {
  const tbody = document.querySelector('.roster-table tbody');
  if (!tbody) return;
  const q = (document.getElementById('roster-search') || {}).value || '';
  const filtered = sortRosterGroup(ROSTER).filter(r => {
    if (!q) return true;
    const s = q.toLowerCase();
    return (r.name||'').toLowerCase().includes(s) ||
           (r.role||'').toLowerCase().includes(s) ||
           (r.modelId||'').toLowerCase().includes(s);
  });
  tbody.innerHTML = filtered.map(r => `
    <tr class="${state.selRoster===r.id?' active':''}" onclick="setRosterFocus('${r.id}')" style="cursor:pointer">
      <td class="roster-emoji-cell">${r.emoji||'🤖'}</td>
      <td class="roster-name-cell">${esc(r.name)}</td>
      <td class="roster-model-cell hide-tablet">${esc((r.modelId||'').split('/').pop()||'—')}</td>
      <td class="roster-score-cell">${displayScore(r)}</td>
      <td class="roster-tag-cell hide-mobile">
        ${r.torch?'<span class="stat-pill torch-pill">🔥</span>':''}
        ${r.immune?'<span class="stat-pill immune-pill">🛡️</span>':''}
        ${r.role?`<span class="stat-pill">${esc(r.role)}</span>`:''}
      </td>
      <td class="roster-action-cell">${buildActionBtns(r)}</td>
    </tr>`).join('');
  // update badge counts
  const cnt = document.getElementById('roster-count');
  if (cnt) cnt.textContent = `${filtered.length} / ${ROSTER.length}`;
}

function setRosterFocus(id) {
  state.selRoster = id;
  state.rosterTab = state.rosterTab || 'info';
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderRoster();
  renderRosterDetail(id);
  const panel = document.getElementById('roster-detail-panel');
  if (panel) {
    panel.classList.add('visible');
    const master = document.getElementById('roster-master');
    if (master) master.classList.remove('visible');
  }
}

function clearRosterFocus() {
  state.selRoster = null;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderRoster();
  const panel = document.getElementById('roster-detail-panel');
  if (panel) { panel.classList.remove('visible'); panel.innerHTML = ''; }
  const master = document.getElementById('roster-master');
  if (master) master.classList.add('visible');
}

function setRosterTab(tab) {
  state.rosterTab = tab;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  if (state.selRoster) renderRosterDetail(state.selRoster);
}

function renderRosterDetail(id) {
  const panel = document.getElementById('roster-detail-panel');
  if (!panel) return;
  const r = ROSTER.find(r => r.id === id);
  if (!r) { panel.innerHTML = ''; return; }
  const tab = state.rosterTab || 'info';
  const m = MACHINES.find(m => m.id === r.machine);

  panel.innerHTML = `
    <div id="roster-detail-header">
      <span class="rd-emoji" style="cursor:pointer" onclick="openModelEmojiPicker && openModelEmojiPicker('${r.id}')">${r.emoji||'🤖'}</span>
      <div style="flex:1;min-width:0">
        <div class="rd-name">${esc(r.name)}</div>
        <div style="font-size:.72rem;color:var(--tx3)">${r.role||''}</div>
      </div>
      <button class="rd-close" onclick="clearRosterFocus()">&times;</button>
    </div>
    <div id="roster-detail-tabs">
      <button class="rd-tab${tab==='info'?' active':''}" onclick="setRosterTab('info')">Info</button>
      <button class="rd-tab${tab==='edit'?' active':''}" onclick="setRosterTab('edit')">Edit</button>
      <button class="rd-tab${tab==='interview'?' active':''}" onclick="setRosterTab('interview')">Interview</button>
    </div>
    <div id="roster-detail-body">
      ${tab === 'info' ? `
        <div style="display:flex;flex-direction:column;gap:8px">
          ${kv('Score', displayScore(r))}
          ${kv('Sessions', r.totalSessions||0)}
          ${kv('Wins / Losses', `${r.wins||0} / ${r.losses||0}`)}
          ${kv('Machine', m ? esc(m.name) : '—')}
          ${kv('Model', esc(r.modelId || '—'))}
          ${kv('Role', esc(r.role || '—'))}
          ${kv('Temp', r.temp ?? 0.7)}
          ${r.torch ? torchHtml() : ''}
          ${r.immune ? '<div class="stat-pill immune-pill" style="align-self:flex-start;margin-top:4px">🛡️ Immune</div>' : ''}
        </div>
        <div style="margin-top:12px;display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn-sm" onclick="openScoreSheet('${r.id}')">Score Sheet</button>
          <button class="btn-sm" onclick="toggleImmunity('${r.id}')">${r.immune?'Remove Immunity':'Grant Immunity'}</button>
          <button class="btn-sm${r.torch?' danger':''}" onclick="snuffTorch('${r.id}')">${r.torch?'Snuff Torch':'Give Torch'}</button>
          <button class="btn-sm" onclick="resetStats('${r.id}')">Reset Stats</button>
          <button class="btn-sm danger" onclick="deleteModel('${r.id}')">Delete</button>
        </div>
      ` : ''}
      ${tab === 'edit' ? `
        <div style="display:flex;flex-direction:column;gap:10px">
          ${editField('Name', 'name', r.name, r.id)}
          ${editField('Role', 'role', r.role||'', r.id)}
          ${editField('Model ID', 'modelId', r.modelId||'', r.id)}
          ${editField('Temp', 'temp', r.temp??0.7, r.id, 'number')}
          ${editField('Top P', 'topP', r.topP??1, r.id, 'number')}
          ${editField('Max Tokens', 'maxTokens', r.maxTokens??2048, r.id, 'number')}
          <div>
            <div class="sp-section-title">Machine</div>
            <select onchange="assignMachine('${r.id}', this.value)" style="width:100%;background:var(--bg2);color:var(--tx1);border:1px solid var(--bdr);border-radius:6px;padding:5px 8px;font-size:.83rem">
              <option value="">-- None --</option>
              ${MACHINES.map(m=>`<option value="${m.id}"${r.machine===m.id?' selected':''}>${esc(m.name)}</option>`).join('')}
            </select>
          </div>
          <div>
            <div class="sp-section-title">System Prompt</div>
            <textarea id="prompt-ta-${r.id}" style="width:100%;box-sizing:border-box;min-height:80px;resize:vertical;background:var(--bg2);color:var(--tx1);border:1px solid var(--bdr);border-radius:6px;padding:7px 9px;font-size:.82rem;font-family:var(--mono)" oninput="savePrompt('${r.id}',this.value)">${esc(r.customPrompt||'')}</textarea>
            <div style="display:flex;gap:6px;margin-top:4px">
              <button class="btn-sm" onclick="copyPromptText('${r.id}')">Copy</button>
              <button class="btn-sm" onclick="pastePrompt('${r.id}')">Paste</button>
              <button class="btn-sm" onclick="resetPromptToAuto('${r.id}')">Reset</button>
            </div>
          </div>
        </div>
      ` : ''}
      ${tab === 'interview' ? `
        <div id="interview-wrap">
          <div id="interview-log"></div>
          <div id="interview-input-row">
            <textarea id="interview-input" placeholder="Ask ${esc(r.name)} something…" onkeydown="ivKeydown(event,'${r.id}')"></textarea>
            <button class="btn-primary" onclick="sendInterview('${r.id}')">Send</button>
          </div>
          <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
            <button class="btn-sm" onclick="clearInterview('${r.id}')">Clear</button>
            <button class="btn-sm" onclick="openIvPromptModal('${r.id}')">Edit Prompt</button>
            <button class="btn-sm" onclick="refreshDetailStats('${r.id}')">Refresh Stats</button>
          </div>
        </div>
        <script>renderInterviewHistory && renderInterviewHistory('${r.id}');</scr` + `ipt>
      ` : ''}
    </div>
  `;
  if (tab === 'interview') renderInterviewHistory && renderInterviewHistory(id);
}

function kv(label, value) {
  return `<div style="display:flex;justify-content:space-between;font-size:.83rem;padding:3px 0;border-bottom:1px solid var(--bdr)">
    <span style="color:var(--tx2)">${label}</span>
    <span style="font-weight:600">${value}</span>
  </div>`;
}

function torchHtml() {
  return '<div class="stat-pill torch-pill" style="align-self:flex-start;margin-top:4px">🔥 Torch Bearer</div>';
}

function machineLabel(r) {
  const m = MACHINES.find(m => m.id === r.machine);
  return m ? esc(m.name) : '—';
}

function assignMachine(rosterId, machineId) {
  const r = ROSTER.find(r => r.id === rosterId);
  if (!r) return;
  r.machine = machineId;
  saveRoster();
}

function savePrompt(id, val) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  r.customPrompt = val;
  saveRoster();
}

function resetPromptToAuto(id) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  r.customPrompt = '';
  saveRoster();
  const ta = document.getElementById(`prompt-ta-${id}`);
  if (ta) ta.value = '';
  toast('Prompt reset.');
}

function saveTemp(id, val) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  r.temp = parseFloat(val) || 0.7;
  saveRoster();
}

function resetStats(id) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  if (!confirm(`Reset stats for ${r.name}?`)) return;
  r.score = 0; r.wins = 0; r.losses = 0; r.draws = 0;
  r.totalSessions = 0; r.avgScore = 0;
  r.criteriaScores = {}; r.chatLog = [];
  saveRoster();
  renderRoster();
  renderRosterDetail(id);
  toast('Stats reset.');
}

function toggleImmunity(id) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  r.immune = !r.immune;
  saveRoster();
  renderRoster();
  renderRosterDetail(id);
  renderSurvivorIf();
}

function snuffTorch(id) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  const hadTorch = r.torch;
  // Remove torch from everyone else first
  ROSTER.forEach(p => { p.torch = false; });
  if (!hadTorch) r.torch = true;
  saveRoster();
  renderRoster();
  renderRosterDetail(id);
  renderSurvivorIf();
  toast(hadTorch ? 'Torch snuffed.' : `${r.name} now holds the torch.`);
}

function revive(id) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  r.eliminated = false;
  saveRoster();
  renderRoster(); renderSurvivorIf();
  toast(`${r.name} revived.`);
}

function reviveAll() {
  if (!confirm('Revive all eliminated personas?')) return;
  ROSTER.forEach(r => { r.eliminated = false; });
  saveRoster();
  renderRoster(); renderSurvivorIf();
  toast('All revived.');
}

function clearImmunity() {
  ROSTER.forEach(r => { r.immune = false; });
  saveRoster();
  renderRoster(); renderSurvivorIf();
  toast('All immunity cleared.');
}
