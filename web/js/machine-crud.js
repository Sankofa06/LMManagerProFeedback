/* machine-crud.js — machine CRUD, custom roles */

function initHttpsBanner() {
  if (location.protocol === 'https:') {
    const banner = document.getElementById('https-banner');
    if (banner) banner.style.display = 'flex';
  }
}

function showHttpsHelp() {
  const help = document.getElementById('https-help-wrap');
  if (help) help.style.display = help.style.display === 'none' ? 'block' : 'none';
}

function updateNodesSub() {
  renderMachines && renderMachines();
}

function openMachineModal() {
  renderMachineListEdit();
  const m = document.getElementById('machine-modal');
  if (m) m.classList.add('open');
}

function closeMachineModal() {
  const m = document.getElementById('machine-modal');
  if (m) m.classList.remove('open');
}

function renderMachineListEdit() {
  const list = document.getElementById('machine-list-edit');
  if (!list) return;
  list.innerHTML = MACHINES.map(m => renderMachineEditRow(m)).join('');
}

function deleteMachine(id) {
  const m = MACHINES.find(m => m.id === id);
  if (!m) return;
  if (!confirm(`Delete machine “${m.name}”? Personas assigned to it will lose their machine.`)) return;
  const idx = MACHINES.indexOf(m);
  MACHINES.splice(idx, 1);
  // Unassign from roster
  ROSTER.forEach(r => { if (r.machine === id) r.machine = ''; });
  saveMachines(); saveRoster();
  renderMachineListEdit();
  renderMachines && renderMachines();
  toast('Machine deleted.');
}

function autoFillMachineName() {
  const urlInp = document.getElementById('new-machine-url');
  const nameInp = document.getElementById('new-machine-name');
  if (!urlInp || !nameInp || nameInp.value) return;
  const url = urlInp.value.trim();
  const match = url.match(/:(\/\/)([^:/?#]+)/);
  if (match) nameInp.value = match[2].split('.')[0] || 'Machine';
}

function addMachineFromModal() {
  const name = (document.getElementById('new-machine-name') || {}).value?.trim();
  const url = (document.getElementById('new-machine-url') || {}).value?.trim();
  const vram = parseInt((document.getElementById('new-machine-vram') || {}).value) || 0;
  const backend = (document.getElementById('new-machine-backend') || {}).value || 'auto';
  if (!name) { toast('Name required.'); return; }
  if (!url) { toast('URL required.'); return; }
  const id = 'm' + Date.now();
  MACHINES.push({ id, name, url, vram, backend });
  saveMachines();
  renderMachineListEdit();
  renderMachines && renderMachines();
  // Clear fields
  ['new-machine-name','new-machine-url','new-machine-vram'].forEach(eid => {
    const el = document.getElementById(eid);
    if (el) el.value = '';
  });
  toast(`Machine “${name}” added.`);
}

function dispName(modelId) {
  if (!modelId) return '—';
  const parts = modelId.split('/');
  return parts[parts.length - 1] || modelId;
}

function deriveModelParts(modelId) {
  const parts = (modelId || '').split('/');
  return { org: parts[0] || '', name: parts[1] || parts[0] || '', rest: parts.slice(2).join('/') };
}

function deriveModelPartsFromPath(path) {
  const segments = (path || '').replace(/\.gguf$/i,'').split('/');
  return { base: segments[segments.length-1] || path, full: path };
}

function autoGenerateNames() {
  ROSTER.forEach(r => {
    if (!r.name && r.modelId) r.name = deriveNameFromModelId(r.modelId);
  });
  saveRoster(); renderRoster();
  toast('Names generated.');
}

function populateCustomRoleSelects() {
  const roles = JSON.parse(localStorage.getItem('lmmp-custom-roles') || '[]');
  const sels = document.querySelectorAll('.custom-role-select');
  sels.forEach(sel => {
    const cur = sel.value;
    // Keep existing built-in options, append custom
    const existing = Array.from(sel.options).map(o => o.value);
    roles.forEach(r => {
      if (!existing.includes(r.key)) {
        const opt = document.createElement('option');
        opt.value = r.key; opt.textContent = r.name;
        sel.appendChild(opt);
      }
    });
    sel.value = cur;
  });
}

function openCustomRoleModal() {
  renderCustomRolesList();
  const m = document.getElementById('custom-role-modal');
  if (m) m.classList.add('open');
}

function closeCustomRoleModal() {
  const m = document.getElementById('custom-role-modal');
  if (m) m.classList.remove('open');
}

function updateCrPreview() {
  const nameInp = document.getElementById('cr-name-input');
  const preview = document.getElementById('cr-key-preview');
  if (nameInp && preview) {
    const key = nameInp.value.trim().toLowerCase().replace(/\s+/g,'_');
    preview.textContent = key || '—';
  }
}

function saveCustomRole() {
  const nameInp = document.getElementById('cr-name-input');
  if (!nameInp) return;
  const name = nameInp.value.trim();
  if (!name) { toast('Name required.'); return; }
  const key = name.toLowerCase().replace(/\s+/g,'_');
  const roles = JSON.parse(localStorage.getItem('lmmp-custom-roles') || '[]');
  if (roles.find(r => r.key === key)) { toast('Role already exists.'); return; }
  roles.push({ key, name });
  localStorage.setItem('lmmp-custom-roles', JSON.stringify(roles));
  nameInp.value = '';
  renderCustomRolesList();
  populateCustomRoleSelects();
  toast('Custom role added.');
}

function deleteCustomRole(idx) {
  const roles = JSON.parse(localStorage.getItem('lmmp-custom-roles') || '[]');
  roles.splice(idx, 1);
  localStorage.setItem('lmmp-custom-roles', JSON.stringify(roles));
  renderCustomRolesList();
  populateCustomRoleSelects();
  toast('Role deleted.');
}
