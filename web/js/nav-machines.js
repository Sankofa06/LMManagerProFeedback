/* nav-machines.js — navigation, machine nodes sidebar */

const chat = {
  history: [],
  running: false,
  abortController: null,
};

function setNav(nav) {
  state.nav = nav;
  localStorage.setItem('lmmp-state', JSON.stringify(state));

  const panels = ['survivor','roster','teams','chat','episodes','settings-panel-wrap'];
  panels.forEach(id => {
    const el = document.getElementById(id + '-view') || document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  const view = document.getElementById(nav + '-view');
  if (view) view.style.display = 'flex';

  setBnActive(nav);

  if (nav === 'survivor') { renderSurvivor(); renderFamilyFilter(); renderArchetypeLegend(); updateEpBadge(); }
  if (nav === 'roster') { renderRoster(); }
  if (nav === 'teams') { renderTeams(); }
  if (nav === 'chat') { renderRunPanel(); renderTurnChips(); renderPresetChips(); }
  if (nav === 'episodes') { renderEpisodes && renderEpisodes(); }
}

function setBnActive(nav) {
  document.querySelectorAll('.bn-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.nav === nav);
  });
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.nav === nav);
  });
}

function renderMachines() {
  const bar = document.getElementById('machines-bar');
  if (!bar) return;
  const body = document.getElementById('machines-bar-body') || bar.querySelector('.machines-bar-body');
  if (!body) return;
  body.innerHTML = MACHINES.map(m => {
    const models = ROSTER.filter(r => r.machine === m.id);
    const collapsed = state.collapsedMachines && state.collapsedMachines[m.id];
    return `
      <div class="machine-node-section${collapsed?' collapsed':''}" data-machine="${m.id}">
        <div class="machine-node-header" onclick="toggleMachineCollapse('${m.id}')">
          <span class="machine-dot" id="dot-${m.id}"></span>
          <span class="machine-node-name">${esc(m.name)}</span>
          <span class="machine-node-badge" id="badge-${m.id}">${models.length}</span>
          <span class="machine-collapse-icon">▼</span>
        </div>
        <div class="machine-node-models" id="models-${m.id}">
          ${models.map(r => `
            <div class="machine-model-row${r.loaded?' loaded':''}" onclick="setRosterFocus('${r.id}')">
              <span class="machine-model-emoji">${r.emoji||'🤖'}</span>
              <span class="machine-model-name">${esc(r.name)}</span>
              <span class="machine-model-vram">${r.vram||''}${r.vram?'GB':''}</span>
            </div>`).join('')}
          ${models.length === 0 ? '<div style="padding:4px 24px;font-size:.75rem;color:var(--tx3);">No models assigned</div>' : ''}
        </div>
      </div>`;
  }).join('');
  checkAllMachines();
}

function toggleMachineCollapse(id) {
  if (!state.collapsedMachines) state.collapsedMachines = {};
  state.collapsedMachines[id] = !state.collapsedMachines[id];
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderMachines();
}

function openModelEmojiPickerMachine(machineId) {
  // placeholder — open machine color/emoji picker
  openMachineColorPicker(machineId);
}

function openMachineColorPicker(machineId) {
  const m = MACHINES.find(m => m.id === machineId);
  if (!m) return;
  const color = prompt('Machine accent color (hex):', m.color || '#0A84FF');
  if (!color) return;
  m.color = color;
  saveMachines();
  renderMachines();
}

function setMachineColor(machineId, color) {
  const m = MACHINES.find(m => m.id === machineId);
  if (!m) return;
  m.color = color;
  saveMachines();
}

function hfUrl(modelId) {
  if (!modelId) return null;
  // Try to construct HuggingFace URL from model ID
  const parts = modelId.split('/');
  if (parts.length >= 2) return `https://huggingface.co/${parts[0]}/${parts[1]}`;
  return null;
}

function renderRosterTable() {
  renderRoster();
}

function buildActionBtns(r) {
  return `<button class="btn-sm" onclick="event.stopPropagation();loadModel('${r.id}')" title="Load">Load</button>`;
}

async function loadModel(rosterId) {
  const r = ROSTER.find(r => r.id === rosterId);
  if (!r) return;
  const m = MACHINES.find(m => m.id === r.machine);
  if (!m) { toast('No machine assigned.'); return; }
  setRowLoading(rosterId, true);
  try {
    const resp = await fetch(`${m.url}/api/v0/models/load`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: r.modelId }),
    });
    if (resp.ok) { toast(`${r.name} loading…`); updateRowLoadedState(rosterId, true); }
    else { toast('Load failed: ' + resp.status); }
  } catch (e) { toast('Load error: ' + e.message); }
  finally { setRowLoading(rosterId, false); }
}

async function unloadModel(rosterId) {
  const r = ROSTER.find(r => r.id === rosterId);
  if (!r) return;
  const m = MACHINES.find(m => m.id === r.machine);
  if (!m) return;
  try {
    await fetch(`${m.url}/api/v0/models/unload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: r.modelId }),
    });
    updateRowLoadedState(rosterId, false);
    toast(`${r.name} unloaded.`);
  } catch (e) { toast('Unload error: ' + e.message); }
}

function setRowLoading(id, loading) {
  const rows = document.querySelectorAll(`tr[onclick*="'${id}'"]`);
  rows.forEach(row => row.classList.toggle('loading', loading));
}

function updateRowLoadedState(id, loaded) {
  const r = ROSTER.find(r => r.id === id);
  if (r) { r.loaded = loaded; saveRoster(); }
  renderRoster();
}

function renderMachineBadges() {
  MACHINES.forEach(m => {
    const badge = document.getElementById(`badge-${m.id}`);
    const count = ROSTER.filter(r => r.machine === m.id).length;
    if (badge) badge.textContent = count;
  });
}

async function checkMachine(m) {
  const dot = document.getElementById(`dot-${m.id}`);
  if (!dot) return;
  dot.className = 'machine-dot';
  try {
    const resp = await fetch(`${m.url}/api/v0/models`, { signal: AbortSignal.timeout(4000) });
    if (resp.ok) {
      dot.classList.add('online');
      const data = await resp.json().catch(() => ({}));
      showBanner(m.id, null);
      return data;
    } else {
      dot.classList.add('error');
      showBanner(m.id, `HTTP ${resp.status}`);
    }
  } catch {
    dot.classList.add('error');
    showBanner(m.id, 'Offline');
  }
  return null;
}

function mc_saveUrl(machineId, url) {
  const m = MACHINES.find(m => m.id === machineId);
  if (!m) return;
  m.url = url.trim();
  saveMachines();
  toast('URL saved.');
}

function rtUrlEdit(machineId) {
  const span = document.getElementById(`rt-url-${machineId}`);
  const inp = document.getElementById(`rt-url-inp-${machineId}`);
  if (span) span.style.display = 'none';
  if (inp) { inp.style.display = 'inline-block'; inp.focus(); }
}

function rtUrlDone(machineId) {
  const span = document.getElementById(`rt-url-${machineId}`);
  const inp = document.getElementById(`rt-url-inp-${machineId}`);
  const val = inp ? inp.value : '';
  mc_saveUrl(machineId, val);
  if (span) { span.textContent = val; span.style.display = 'inline'; }
  if (inp) inp.style.display = 'none';
}

function updateDots() { checkAllMachines(); }

function checkAllMachines() {
  MACHINES.forEach(m => checkMachine(m));
}

function showBanner(machineId, message) {
  // Could show error banners in nodes sidebar; placeholder for now
}

function postCheckPrompt(machineId, data) {
  // After checking a machine, optionally show new model discovery prompt
  if (data && data.data) showNewModelsPrompt(machineId, data.data);
}

function setupBannerAction(machineId, fn) {
  // Attach action handler to banner element
}
