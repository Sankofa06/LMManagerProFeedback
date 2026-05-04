/* episodes-branding.js — episodes, branding, machine edit */

function saveBrandName() {
  const inp = document.getElementById('brand-name-input');
  if (!inp) return;
  localStorage.setItem('lmmp-brand-name', inp.value.trim());
  applyBrandName && applyBrandName();
  toast('Brand name saved.');
}

function loadBrandName() {
  const inp = document.getElementById('brand-name-input');
  if (inp) inp.value = localStorage.getItem('lmmp-brand-name') || '';
}

function filterRosterList(query) {
  filterRosterTable(query);
}

function toggleCrosstalk() {
  const el = document.getElementById('crosstalk-toggle');
  state.crosstalk = el ? el.checked : !state.crosstalk;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
}

function showCommitToast(msg) {
  toast(msg || 'Saved.');
}

// Override survivor snuffTorch
window.snuffTorch = function(id) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  const had = r.torch;
  ROSTER.forEach(p => { p.torch = false; });
  if (!had) r.torch = true;
  saveRoster();
  renderRoster(); renderSurvivorIf();
  if (state.selRoster === id) renderRosterDetail(id);
  toast(had ? 'Torch snuffed.' : `${r.name} holds the torch.`);
};

window.toggleImmunity = function(id) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  r.immune = !r.immune;
  saveRoster();
  renderRoster(); renderSurvivorIf();
  if (state.selRoster === id) renderRosterDetail(id);
};

function newEpisodeRun(epId) {
  const ep = EPISODES.find(e => e.id === epId);
  if (!ep) return;
  state.selEpisode = epId;
  state.nav = 'chat';
  state.runTeam = ep.team || null;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  setNav('chat');
  toast(`Running episode: ${ep.name}`);
}

function renderMachineEditRow(m) {
  return `<div class="machine-edit-row" style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid var(--bdr)">
    <span style="flex:1;font-weight:500;font-size:.85rem">${esc(m.name)}</span>
    <input id="me-url-${m.id}" value="${esc(m.url)}" style="flex:2;background:var(--bg2);color:var(--tx1);border:1px solid var(--bdr);border-radius:6px;padding:4px 7px;font-size:.8rem">
    <button class="btn-sm" onclick="saveMachineEdit('${m.id}')">Save</button>
    <button class="btn-sm danger" onclick="deleteMachine('${m.id}')">Del</button>
  </div>`;
}

function saveMachineEdit(id) {
  const m = MACHINES.find(m => m.id === id);
  if (!m) return;
  const inp = document.getElementById(`me-url-${id}`);
  if (inp) m.url = inp.value.trim();
  saveMachines();
  toast('Machine saved.');
}

let EPISODES = JSON.parse(localStorage.getItem('lmmp-episodes') || '[]');

function saveEpisodes() {
  localStorage.setItem('lmmp-episodes', JSON.stringify(EPISODES));
  updateEpBadge();
}

const TASK_TYPES = [
  { key: 'chat', label: 'Chat Round' },
  { key: 'interview', label: 'Interview' },
  { key: 'compare', label: 'Compare' },
  { key: 'benchmark', label: 'Benchmark' },
  { key: 'custom', label: 'Custom' },
];

function newEpisode() {
  const id = 'ep' + Date.now();
  const ep = {
    id, name: 'Episode ' + (EPISODES.length + 1),
    icon: '🎬', team: null,
    tasks: [], archived: false,
    createdAt: Date.now(),
  };
  EPISODES.unshift(ep);
  saveEpisodes();
  renderEpisodes();
  selectEpisode(id);
}

function renderEpisodes() {
  const list = document.getElementById('episodes-list');
  if (!list) return;
  const active = EPISODES.filter(e => !e.archived);
  list.innerHTML = active.length === 0
    ? '<div style="color:var(--tx3);font-size:.82rem;padding:12px 0;">No episodes yet.</div>'
    : active.map(ep =>
        `<div class="ep-row${state.selEpisode===ep.id?' active':''}" onclick="selectEpisode('${ep.id}')">
          <span class="ep-icon">${ep.icon||'🎬'}</span>
          <div style="flex:1;min-width:0">
            <div class="ep-name">${esc(ep.name)}</div>
            <div class="ep-meta">${(ep.tasks||[]).length} task${(ep.tasks||[]).length!==1?'s':''}</div>
          </div>
        </div>`
      ).join('');
}

function selectEpisode(id) {
  state.selEpisode = id;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderEpisodes();
  const ep = EPISODES.find(e => e.id === id);
  if (ep) renderEpisodeDetail(ep);
  const panel = document.getElementById('episode-detail-panel');
  if (panel) {
    panel.classList.add('visible');
    const master = document.getElementById('episodes-master');
    if (master) master.classList.remove('visible');
  }
}

function setEpisodeFocus(id) { selectEpisode(id); }

function clearEpisodeFocus() {
  state.selEpisode = null;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderEpisodes();
  const panel = document.getElementById('episode-detail-panel');
  if (panel) { panel.classList.remove('visible'); panel.innerHTML = ''; }
  const master = document.getElementById('episodes-master');
  if (master) master.classList.add('visible');
}

function renderArchivedEpisode(ep) {
  return `<div class="ep-row" style="opacity:.5">
    <span class="ep-icon">${ep.icon||'🎬'}</span>
    <div style="flex:1"><div class="ep-name">${esc(ep.name)}</div></div>
    <button class="btn-sm" onclick="unarchiveEp && unarchiveEp('${ep.id}')">Restore</button>
  </div>`;
}

function renderEpisodeDetail(ep) {
  const panel = document.getElementById('episode-detail-panel');
  if (!panel) return;
  const team = ep.team ? TEAMS.find(t => t.id === ep.team) : null;
  panel.innerHTML = `
    <div id="roster-detail-header">
      <span style="font-size:1.6rem;cursor:pointer" onclick="cycleEpIcon('${ep.id}')">${ep.icon||'🎬'}</span>
      <input value="${esc(ep.name)}" style="flex:1;background:transparent;border:none;font-size:1rem;font-weight:700;color:var(--tx1)" oninput="saveEpName('${ep.id}',this.value)">
      <button class="rd-close" onclick="clearEpisodeFocus()">&times;</button>
    </div>
    <div id="roster-detail-body" style="padding:14px;display:flex;flex-direction:column;gap:12px;flex:1;overflow-y:auto">
      <div>
        <div class="sp-section-title">Team</div>
        <select onchange="setEpTeam('${ep.id}',this.value)" style="width:100%;background:var(--bg2);color:var(--tx1);border:1px solid var(--bdr);border-radius:6px;padding:5px 8px;font-size:.83rem">
          <option value="">-- None --</option>
          ${TEAMS.map(t=>`<option value="${t.id}"${ep.team===t.id?' selected':''}>${esc(t.name)}</option>`).join('')}
        </select>
      </div>
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
          <div class="sp-section-title" style="margin:0">Tasks</div>
          <button class="btn-sm" onclick="addTaskBlock('${ep.id}')">+ Task</button>
        </div>
        <div id="ep-tasks-${ep.id}">${(ep.tasks||[]).map((t,i)=>renderTaskBlock(ep.id,t,i)).join('')}</div>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-sm" onclick="runEpisode('${ep.id}')">Run</button>
        <button class="btn-sm" onclick="exportEpisode('${ep.id}')">Export</button>
        <button class="btn-sm" onclick="duplicateEpisode('${ep.id}')">Duplicate</button>
        <button class="btn-sm danger" onclick="deleteEpisode('${ep.id}')">Delete</button>
      </div>
    </div>
  `;
}

function renderTaskBlock(epId, task, idx) {
  return `<div class="task-block" style="background:var(--bg2);border:1px solid var(--bdr);border-radius:8px;padding:8px 10px;margin-bottom:6px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <select style="font-size:.8rem;background:var(--bg1);color:var(--tx1);border:1px solid var(--bdr);border-radius:4px;padding:2px 5px" onchange="saveTaskPrompt('${epId}',${idx},'type',this.value)">
        ${TASK_TYPES.map(t=>`<option value="${t.key}"${task.type===t.key?' selected':''}>${t.label}</option>`).join('')}
      </select>
      <span style="flex:1;font-size:.78rem;color:var(--tx3)">Task ${idx+1}</span>
      <button class="btn-sm danger" onclick="removeTaskBlock('${epId}',${idx})">&times;</button>
    </div>
    <textarea style="width:100%;box-sizing:border-box;min-height:60px;resize:vertical;background:var(--bg1);color:var(--tx1);border:1px solid var(--bdr);border-radius:6px;padding:6px 8px;font-size:.8rem;font-family:var(--mono)" placeholder="Task prompt…" oninput="saveTaskPrompt('${epId}',${idx},'prompt',this.value)">${esc(task.prompt||'')}</textarea>
  </div>`;
}

function addTaskBlock(epId) {
  const ep = EPISODES.find(e => e.id === epId);
  if (!ep) return;
  if (!ep.tasks) ep.tasks = [];
  ep.tasks.push({ type: 'chat', prompt: '' });
  saveEpisodes();
  const wrap = document.getElementById(`ep-tasks-${epId}`);
  if (wrap) wrap.innerHTML = ep.tasks.map((t,i)=>renderTaskBlock(epId,t,i)).join('');
}

function removeTaskBlock(epId, idx) {
  const ep = EPISODES.find(e => e.id === epId);
  if (!ep || !ep.tasks) return;
  ep.tasks.splice(idx, 1);
  saveEpisodes();
  const wrap = document.getElementById(`ep-tasks-${epId}`);
  if (wrap) wrap.innerHTML = ep.tasks.map((t,i)=>renderTaskBlock(epId,t,i)).join('');
}

function saveTaskPrompt(epId, idx, field, value) {
  const ep = EPISODES.find(e => e.id === epId);
  if (!ep || !ep.tasks || !ep.tasks[idx]) return;
  ep.tasks[idx][field] = value;
  saveEpisodes();
}

function saveEpName(epId, name) {
  const ep = EPISODES.find(e => e.id === epId);
  if (!ep) return;
  ep.name = name;
  saveEpisodes();
  renderEpisodes();
}

function setEpTeam(epId, teamId) {
  const ep = EPISODES.find(e => e.id === epId);
  if (!ep) return;
  ep.team = teamId || null;
  saveEpisodes();
}

function cycleEpIcon(epId) {
  const icons = ['🎬','💫','🧪','🎯','📊','⚡','🔬','🏖️'];
  const ep = EPISODES.find(e => e.id === epId);
  if (!ep) return;
  const idx = icons.indexOf(ep.icon);
  ep.icon = icons[(idx + 1) % icons.length];
  saveEpisodes();
  const iconEl = document.querySelector(`#episode-detail-panel [onclick*="cycleEpIcon"]`);
  if (iconEl) iconEl.textContent = ep.icon;
  renderEpisodes();
}

function deleteEpisode(epId) {
  const ep = EPISODES.find(e => e.id === epId);
  if (!ep) return;
  if (!confirm(`Delete episode “${ep.name}”?`)) return;
  EPISODES = EPISODES.filter(e => e.id !== epId);
  saveEpisodes();
  clearEpisodeFocus();
  renderEpisodes();
  toast('Episode deleted.');
}

function duplicateEpisode(epId) {
  const ep = EPISODES.find(e => e.id === epId);
  if (!ep) return;
  const newEp = JSON.parse(JSON.stringify(ep));
  newEp.id = 'ep' + Date.now();
  newEp.name = ep.name + ' (copy)';
  EPISODES.unshift(newEp);
  saveEpisodes();
  renderEpisodes();
  selectEpisode(newEp.id);
  toast('Episode duplicated.');
}

function exportEpisode(epId) {
  const ep = EPISODES.find(e => e.id === epId);
  if (!ep) return;
  const blob = new Blob([JSON.stringify(ep, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url;
  a.download = `episode-${ep.id}.json`; a.click();
  URL.revokeObjectURL(url);
}

function triggerEpisodeImport() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json';
  inp.onchange = e => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => { try { importEpisode(JSON.parse(ev.target.result)); } catch { toast('Invalid file.'); } };
    reader.readAsText(file);
  };
  inp.click();
}

function importEpisode(data) {
  if (!data || !data.id) { toast('Invalid episode file.'); return; }
  const newEp = { ...data, id: 'ep' + Date.now() };
  EPISODES.unshift(newEp);
  saveEpisodes();
  renderEpisodes();
  selectEpisode(newEp.id);
  toast('Episode imported.');
}

async function runEpisode(epId) {
  const ep = EPISODES.find(e => e.id === epId);
  if (!ep) return;
  if (!ep.tasks || ep.tasks.length === 0) { toast('No tasks in this episode.'); return; }
  if (!ep.team) { toast('No team assigned to this episode.'); return; }
  state.runTeam = ep.team;
  state.nav = 'chat';
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  setNav('chat');
  clearRunLog();
  for (const task of ep.tasks) {
    if (task.prompt) {
      const inp = document.getElementById('chat-input');
      if (inp) inp.value = task.prompt;
      await sendChatMessage();
      await new Promise(r => setTimeout(r, 500));
    }
  }
  toast(`Episode “${ep.name}” complete.`);
}

function resetEpisodeProgress() {
  toast('Episode progress reset.');
}

function toggleIvPromptInline(personaId) {
  const wrap = document.getElementById(`iv-prompt-inline-${personaId}`);
  if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

function applyIvPromptInline(personaId) {
  const ta = document.getElementById(`iv-prompt-ta-inline-${personaId}`);
  if (!ta) return;
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  r.interviewPrompt = ta.value.trim();
  saveRoster();
  toast('Interview prompt saved.');
}

function resetIvPromptInline(personaId) {
  const ta = document.getElementById(`iv-prompt-ta-inline-${personaId}`);
  const r = ROSTER.find(r => r.id === personaId);
  if (!ta || !r) return;
  ta.value = getDefaultInterviewPrompt(r);
}
