/* settings-interview-builder.js — settings panel, interview builder */

function classifyPrompt(text) {
  if (!text) return 'empty';
  if (text.length < 50) return 'brief';
  if (/\bYou are\b/.test(text)) return 'persona';
  if (/\b(evaluate|assess|judge|rate)\b/i.test(text)) return 'evaluator';
  return 'custom';
}

function toggleSettingsPanel() {
  const panel = document.getElementById('settings-panel');
  if (!panel) return;
  panel.classList.toggle('open');
  if (panel.classList.contains('open')) updateSettingsPanel();
}

function updateSettingsPanel() {
  loadBrandName && loadBrandName();
  renderLmLinkSection && MACHINES.forEach(m => syncModelDataFromApi && syncModelDataFromApi(m.id));
  renderCustomRolesList && renderCustomRolesList();
  renderScoreSignals && renderScoreSignals();
}

function setSpVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function setSpChecked(id, checked) {
  const el = document.getElementById(id);
  if (el) el.checked = checked;
}

function applyBrandName() {
  const name = localStorage.getItem('lmmp-brand-name') || '';
  document.querySelectorAll('.brand-name-display').forEach(el => { el.textContent = name; });
  const inp = document.getElementById('brand-name-input');
  if (inp && !inp.value) inp.value = name;
}

function applyDirectorName() {
  const name = localStorage.getItem('lmmp-director-name') || '';
  document.querySelectorAll('.director-name-display').forEach(el => { el.textContent = name; });
  const inp = document.getElementById('director-name-input');
  if (inp && !inp.value) inp.value = name;
}

const IV_PRESET_KEYS_PRODUCT = ['saas','consumer','api','hardware'];
const IV_PRESET_KEYS_STACK = ['fullstack','ml','infra','mobile'];

function _activateChips(groupId, activeKey) {
  document.querySelectorAll(`[data-preset-group="${groupId}"]`).forEach(chip => {
    chip.classList.toggle('active', chip.dataset.presetKey === activeKey);
  });
}

function setIvProductPreset(key) {
  state.ivProductPreset = key;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  _activateChips('iv-product', key);
  onIvProductChange();
}

function setIvStackPreset(key) {
  state.ivStackPreset = key;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  _activateChips('iv-stack', key);
  onIvStackChange();
}

function onIvProductChange() {
  refreshIvTeamPreview();
}

function onIvStackChange() {
  refreshIvTeamPreview();
}

function refreshIvTeamPreview() {
  const preview = document.getElementById('iv-prompt-preview');
  if (!preview) return;
  const teamId = state.runTeam;
  const team = teamId ? TEAMS.find(t => t.id === teamId) : null;
  // Preview with first team member or generic
  const r = team && team.members && team.members.length > 0
    ? ROSTER.find(r => r.id === team.members[0])
    : null;
  if (r) {
    preview.value = buildInterviewPrompt(r, { team: teamId });
  } else {
    preview.value = DEFAULT_INTERVIEW_PROMPT;
  }
}

function rebuildAndSaveInterviewPrompt() {
  const teamId = state.runTeam;
  const team = teamId ? TEAMS.find(t => t.id === teamId) : null;
  if (!team || !team.members) return;
  team.members.forEach(mid => {
    const r = ROSTER.find(r => r.id === mid);
    if (r) {
      r.interviewPrompt = buildInterviewPrompt(r, { team: teamId });
    }
  });
  saveRoster();
  refreshIvTeamPreview();
  toast('Interview prompts rebuilt for team.');
}

function updateIvBuilderPanel() {
  refreshIvTeamPreview();
  // Sync chip states
  if (state.ivProductPreset) _activateChips('iv-product', state.ivProductPreset);
  if (state.ivStackPreset) _activateChips('iv-stack', state.ivStackPreset);
}

function copyInterviewPrompt() {
  const ta = document.getElementById('iv-prompt-preview');
  if (!ta) return;
  copyToClipboard(ta.value).then(() => toast('Copied.')).catch(() => fallbackCopy(ta.value));
}

function resetInterviewPromptToDefault() {
  const ta = document.getElementById('iv-prompt-preview');
  if (ta) ta.value = DEFAULT_INTERVIEW_PROMPT;
  const teamId = state.runTeam;
  const team = teamId ? TEAMS.find(t => t.id === teamId) : null;
  if (team && team.members) {
    team.members.forEach(mid => {
      const r = ROSTER.find(r => r.id === mid);
      if (r) { r.interviewPrompt = ''; }
    });
    saveRoster();
  }
  toast('Interview prompts reset to default.');
}

function setIvPreset(presetKey) {
  // Set both product and stack from a combined preset key if applicable
  if (IV_PRESET_KEYS_PRODUCT.includes(presetKey)) setIvProductPreset(presetKey);
  else if (IV_PRESET_KEYS_STACK.includes(presetKey)) setIvStackPreset(presetKey);
}

function onIvBodyChange() {
  // Called when user manually edits the preview textarea
  // Allow direct edits without rebuilding
}
