/* lmlink.js — LM Studio model sync and discovery */

function parseLmLinkJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function saveLmLinkEntry(modelId, machineId, data) {
  const key = `lmmp-lmlink-${machineId}-${modelId}`;
  localStorage.setItem(key, JSON.stringify({ ...data, ts: Date.now() }));
}

function machinesForLmLinkModel(modelId) {
  return MACHINES.filter(m => {
    const r = ROSTER.find(r => r.modelId === modelId && r.machine === m.id);
    return !!r;
  });
}

function machineForLmLinkModel(modelId) {
  const r = ROSTER.find(r => r.modelId === modelId);
  if (!r) return null;
  return MACHINES.find(m => m.id === r.machine) || null;
}

async function settingsScanRoster() {
  for (const m of MACHINES) {
    try {
      const resp = await fetch(`${m.url}/api/v0/models`, { signal: AbortSignal.timeout(5000) });
      if (!resp.ok) continue;
      const data = await resp.json();
      renderLmLinkSection(m.id, data.data || []);
    } catch {}
  }
}

function renderLmLinkSection(machineId, models) {
  const wrap = document.getElementById(`lmlink-${machineId}`);
  if (!wrap) return;
  if (models.length === 0) {
    wrap.innerHTML = '<div style="color:var(--tx3);font-size:.78rem;">No models loaded.</div>';
    return;
  }
  wrap.innerHTML = models.map(m =>
    `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid var(--bdr);font-size:.8rem">
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.id||m.identifier||'')}</span>
      <button class="btn-sm" onclick="autoFillNameFromModelId('${esc(m.id||m.identifier||'')}','${machineId}')">Add</button>
    </div>`
  ).join('');
}

function renderCustomRolesList() {
  const list = document.getElementById('custom-roles-list');
  if (!list) return;
  const roles = JSON.parse(localStorage.getItem('lmmp-custom-roles') || '[]');
  list.innerHTML = roles.length === 0
    ? '<div style="color:var(--tx3);font-size:.78rem;">No custom roles.</div>'
    : roles.map((r, i) =>
        `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--bdr);font-size:.82rem">
          <span style="flex:1">${esc(r.name)}</span>
          <button class="btn-sm danger" onclick="deleteCustomRole(${i})">&times;</button>
        </div>`
      ).join('');
}

async function syncModelDataFromApi(machineId) {
  const m = MACHINES.find(m => m.id === machineId);
  if (!m) return;
  try {
    const resp = await fetch(`${m.url}/api/v0/models`, { signal: AbortSignal.timeout(5000) });
    if (!resp.ok) { toast('Sync failed: HTTP ' + resp.status); return; }
    const data = await resp.json();
    renderLmLinkSection(machineId, data.data || []);
    toast('Synced ' + (data.data||[]).length + ' model(s).');
  } catch (e) { toast('Sync error: ' + e.message); }
}

function autoGenerateAllNames() {
  ROSTER.forEach(r => {
    if (!r.name && r.modelId) r.name = deriveNameFromModelId(r.modelId);
  });
  saveRoster(); renderRoster();
  toast('Names auto-generated.');
}

function deriveNameFromModelId(modelId) {
  if (!modelId) return 'Unknown';
  const parts = modelId.split('/');
  const base = parts[parts.length - 1] || parts[0];
  return base.replace(/[-_]/g,' ').replace(/\b\w/g, c=>c.toUpperCase()).slice(0,24);
}

function autoAssignMachineFromModelId(modelId) {
  // Find which machine has this modelId loaded
  // Heuristic: check if any roster entry with this modelId has a machine
  const existing = ROSTER.find(r => r.modelId === modelId && r.machine);
  return existing ? existing.machine : (MACHINES[0] ? MACHINES[0].id : null);
}

function autoFillNameFromModelId(modelId, machineId) {
  const name = deriveNameFromModelId(modelId);
  const inp = document.getElementById('am-name-input');
  const midInp = document.getElementById('am-model-id-input');
  const machSel = document.getElementById('am-machine-select');
  if (inp) inp.value = name;
  if (midInp) midInp.value = modelId;
  if (machSel) machSel.value = machineId || '';
  openAddModelModal();
}

async function amAutoPrompt(personaId) {
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  const m = MACHINES.find(m => m.id === r.machine);
  if (!m) { toast('No machine.'); return; }
  const systemPrompt = `Generate a short, unique system prompt for an AI persona named ${r.name} with role ${r.role || 'generalist'}. Be creative and concise (2-3 sentences).`;
  try {
    const resp = await fetch(`${m.url}/api/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: r.modelId || '',
        messages: [{ role:'user', content: systemPrompt }],
        temperature: 0.9,
        max_tokens: 120,
        stream: false,
      }),
    });
    if (!resp.ok) { toast('Auto-prompt failed.'); return; }
    const data = await resp.json();
    const prompt = data.choices?.[0]?.message?.content || '';
    if (prompt) {
      r.customPrompt = prompt.trim();
      saveRoster();
      const ta = document.getElementById(`prompt-ta-${personaId}`);
      if (ta) ta.value = r.customPrompt;
      toast('Auto-prompt applied.');
    }
  } catch (e) { toast('Error: ' + e.message); }
}

let _amOpen = false;
function openAddModelModal() {
  _amOpen = true;
  const m = document.getElementById('add-model-modal');
  if (m) m.classList.add('open');
}

function closeAddModelModal() {
  _amOpen = false;
  const m = document.getElementById('add-model-modal');
  if (m) m.classList.remove('open');
}

let _amSecondaryIds = [];
function toggleAmSecondary(machineId) {
  const idx = _amSecondaryIds.indexOf(machineId);
  if (idx > -1) _amSecondaryIds.splice(idx, 1);
  else _amSecondaryIds.push(machineId);
}

function toggleReSecondary(machineId, personaId) {
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  if (!r.secondaryIds) r.secondaryIds = [];
  const idx = r.secondaryIds.indexOf(machineId);
  if (idx > -1) r.secondaryIds.splice(idx, 1);
  else r.secondaryIds.push(machineId);
  saveRoster();
}

function amSyncRole() {
  const sel = document.getElementById('am-role-select');
  const custom = document.getElementById('am-custom-role-wrap');
  if (sel && custom) custom.style.display = sel.value === 'custom' ? 'block' : 'none';
}

function reSyncRole(personaId) {
  const sel = document.getElementById(`re-role-select-${personaId}`);
  const custom = document.getElementById(`re-custom-role-${personaId}`);
  if (sel && custom) custom.style.display = sel.value === 'custom' ? 'block' : 'none';
}

function syncLastToRole(personaId) {
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  const sel = document.getElementById(`re-role-select-${personaId}`);
  if (sel) { r.role = sel.value; saveRoster(); toast('Role updated.'); }
}

function addModelFromModal() {
  const name = (document.getElementById('am-name-input') || {}).value?.trim();
  const modelId = (document.getElementById('am-model-id-input') || {}).value?.trim();
  const machineId = (document.getElementById('am-machine-select') || {}).value;
  const role = (document.getElementById('am-role-select') || {}).value || 'generalist';
  const emoji = (document.getElementById('am-emoji-input') || {}).value?.trim() || '🤖';

  if (!name) { toast('Name required.'); return; }

  const id = 'E' + Date.now();
  const persona = {
    id, name, emoji, role, modelId: modelId || '',
    machine: machineId || '',
    secondaryIds: [..._amSecondaryIds],
    score: 0, wins: 0, losses: 0, draws: 0,
    totalSessions: 0, avgScore: 0,
    criteriaScores: {}, chatLog: [],
    torch: false, immune: false,
    customPrompt: '', interviewPrompt: '',
    temp: 0.7, topP: 1, maxTokens: 2048,
  };
  ROSTER.push(persona);
  saveRoster();
  _amSecondaryIds = [];
  closeAddModelModal();
  renderRoster(); renderSurvivorIf(); renderMachines && renderMachines();
  toast(`${name} added.`);
}
