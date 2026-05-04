/* status-discovery.js — live status, model discovery, family/archetype filters */

const machineActivity = {};

function setMachineActivity(machineId, status) {
  machineActivity[machineId] = status;
  renderLiveStatusIf();
}

function showNewModelsPrompt(machineId, apiModels) {
  // Find models in API response not in roster
  const rosterModelIds = new Set(ROSTER.map(r => r.modelId).filter(Boolean));
  const newModels = (apiModels || []).filter(m => {
    const id = m.id || m.identifier || '';
    return id && !rosterModelIds.has(id);
  });
  if (newModels.length === 0) return;
  const modal = document.getElementById('new-models-modal');
  if (!modal) return;
  const list = document.getElementById('new-models-list');
  if (list) {
    list._machineId = machineId;
    list._models = newModels;
    list.innerHTML = newModels.map((m, i) => {
      const id = m.id || m.identifier || '';
      const role = cannedPromptForRole(id);
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr)">
        <input type="checkbox" id="nd-cb-${i}" checked style="flex-shrink:0">
        <span style="flex:1;font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(id)}">${esc(id.split('/').pop()||id)}</span>
        <select id="nd-role-${i}" style="font-size:.75rem;background:var(--bg2);border:1px solid var(--bdr);border-radius:4px;padding:1px 4px" onchange="onDiscoveryRoleChange(${i})">
          <option value="generalist"${role==='generalist'?' selected':''}>generalist</option>
          <option value="coder"${role==='coder'?' selected':''}>coder</option>
          <option value="analyst"${role==='analyst'?' selected':''}>analyst</option>
          <option value="creative"${role==='creative'?' selected':''}>creative</option>
          <option value="reasoner"${role==='reasoner'?' selected':''}>reasoner</option>
        </select>
      </div>`;
    }).join('');
  }
  modal.classList.add('open');
  modal._machineId = machineId;
}

function ndExpand() {
  const list = document.getElementById('new-models-list');
  if (!list || !list._models) return;
  list._models.forEach((_, i) => {
    const cb = document.getElementById(`nd-cb-${i}`);
    if (cb) cb.checked = true;
  });
}

const CANNED_PROMPTS = {
  coder: 'You are a highly skilled coding assistant. Provide clean, well-commented code.',
  analyst: 'You are a rigorous analytical AI. Break down problems systematically.',
  creative: 'You are a creative and imaginative AI assistant. Think outside the box.',
  reasoner: 'You are a logical reasoning expert. Think step by step.',
  generalist: '',
};

function normalizeModelId(id) {
  return (id || '').toLowerCase().replace(/[-_.]/g,'');
}

function scanForNewModels() {
  MACHINES.forEach(async m => {
    try {
      const resp = await fetch(`${m.url}/api/v0/models`, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) return;
      const data = await resp.json();
      postCheckPrompt(m.id, data);
    } catch {}
  });
}

function cannedPromptForRole(modelId) {
  const id = normalizeModelId(modelId);
  if (/code|coder|starcoder|deepseek.*coder|qwen.*coder/.test(id)) return 'coder';
  if (/instruct|chat|assistant|gemma|llama|mistral/.test(id)) return 'generalist';
  if (/math|reason|r1|think/.test(id)) return 'reasoner';
  if (/creative|story|write/.test(id)) return 'creative';
  return 'generalist';
}

function onDiscoveryRoleChange(idx) {
  // User changed role dropdown in discovery modal — no-op, will read at add time
}

function addDiscoveredModel(idx, machineId) {
  const list = document.getElementById('new-models-list');
  if (!list || !list._models) return;
  const m = list._models[idx];
  if (!m) return;
  const id = m.id || m.identifier || '';
  const roleSel = document.getElementById(`nd-role-${idx}`);
  const role = roleSel ? roleSel.value : 'generalist';
  const name = deriveNameFromModelId(id);
  const persona = {
    id: 'E' + Date.now() + idx,
    name, emoji: '🤖', role,
    modelId: id,
    machine: machineId || (MACHINES[0] ? MACHINES[0].id : ''),
    secondaryIds: [],
    score:0,wins:0,losses:0,draws:0,totalSessions:0,avgScore:0,
    criteriaScores:{},chatLog:[],torch:false,immune:false,
    customPrompt: CANNED_PROMPTS[role] || '',
    interviewPrompt:'',temp:0.7,topP:1,maxTokens:2048,
  };
  ROSTER.push(persona);
  saveRoster();
  toast(`Added ${name}.`);
}

function addAllDiscovered() {
  const list = document.getElementById('new-models-list');
  if (!list || !list._models) return;
  const machineId = list._machineId || (MACHINES[0] ? MACHINES[0].id : '');
  list._models.forEach((_, i) => {
    const cb = document.getElementById(`nd-cb-${i}`);
    if (!cb || !cb.checked) return;
    addDiscoveredModel(i, machineId);
  });
  closeNewModelsModal();
  renderRoster(); renderSurvivorIf(); renderMachines && renderMachines();
  toast('Models added.');
}

function closeNewModelsModal() {
  const m = document.getElementById('new-models-modal');
  if (m) m.classList.remove('open');
}

function renderLiveStatus() {
  const wrap = document.getElementById('live-status-wrap');
  if (!wrap) return;
  wrap.innerHTML = MACHINES.map(m => {
    const dot = machineActivity[m.id];
    const dotClass = dot === 'online' ? 'online' : dot === 'busy' ? 'busy' : dot === 'error' ? 'error' : '';
    return `<div style="display:flex;align-items:center;gap:6px;font-size:.78rem;padding:3px 0">
      <span class="machine-dot${dotClass?' '+dotClass:''}"></span>
      <span style="flex:1">${esc(m.name)}</span>
      <span style="color:var(--tx3);font-size:.7rem">${m.url}</span>
    </div>`;
  }).join('');
}

function renderLiveStatusIf() {
  renderLiveStatus();
}

function saveChatLog(personaId, prompt, response) {
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  if (!r.chatLog) r.chatLog = [];
  r.chatLog.push({ prompt, response, ts: Date.now() });
  // Keep last 50 entries
  if (r.chatLog.length > 50) r.chatLog = r.chatLog.slice(-50);
  saveRoster();
}

function restoreChatLog(personaId) {
  const r = ROSTER.find(r => r.id === personaId);
  if (!r || !r.chatLog) return [];
  return r.chatLog.map(e => ([
    { role:'user', content: e.prompt },
    { role:'assistant', content: e.response },
  ])).flat();
}

const FAMILY_MAP = {
  llama: /llama/i,
  mistral: /mistral|mixtral/i,
  gemma: /gemma/i,
  qwen: /qwen/i,
  phi: /phi[-\s]?\d/i,
  deepseek: /deepseek/i,
  falcon: /falcon/i,
  starcoder: /starcoder/i,
  claude: /claude/i,
  gpt: /gpt[-\s]?\d/i,
};

function modelFamily(modelId) {
  for (const [family, re] of Object.entries(FAMILY_MAP)) {
    if (re.test(modelId || '')) return family;
  }
  return 'other';
}

function getFamilyLabel(family) {
  const labels = { llama:'Llama',mistral:'Mistral',gemma:'Gemma',qwen:'Qwen',phi:'Phi',deepseek:'DeepSeek',falcon:'Falcon',starcoder:'StarCoder',claude:'Claude',gpt:'GPT',other:'Other' };
  return labels[family] || family;
}

function getFamilyColor(family) {
  const colors = { llama:'#e06c75',mistral:'#61afef',gemma:'#98c379',qwen:'#d19a66',phi:'#c678dd',deepseek:'#56b6c2',falcon:'#be5046',starcoder:'#e5c07b',claude:'#e06c75',gpt:'#abb2bf',other:'#5c6370' };
  return colors[family] || 'var(--tx3)';
}

function renderFamilyFilter() {
  const wrap = document.getElementById('family-filter-wrap');
  if (!wrap) return;
  const families = [...new Set(ROSTER.map(r => modelFamily(r.modelId||'')))];
  wrap.innerHTML = families.map(f =>
    `<button class="turn-chip${state.familyFilter===f?' active':''}" onclick="toggleFamilyFilter('${f}')" style="border-left:3px solid ${getFamilyColor(f)}">${getFamilyLabel(f)}</button>`
  ).join('');
}

function toggleFamilyFilter(family) {
  state.familyFilter = state.familyFilter === family ? null : family;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderFamilyFilter();
  renderSurvivorIf();
}

function renderArchetypeLegend() {
  const wrap = document.getElementById('archetype-legend-wrap');
  if (!wrap) return;
  const archetypes = [...new Set(ROSTER.map(r => r.role || 'generalist'))];
  wrap.innerHTML = archetypes.map(a =>
    `<button class="turn-chip${state.archetypeFilter===a?' active':''}" onclick="toggleArchetypeFilter('${a}')">${esc(a)}</button>`
  ).join('');
}

function toggleArchetypeFilter(archetype) {
  state.archetypeFilter = state.archetypeFilter === archetype ? null : archetype;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderArchetypeLegend();
  renderSurvivorIf();
}
