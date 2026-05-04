/* admin.js — admin/utility actions */

function resetAllStats() {
  if (!confirm('Reset ALL scores and stats for every persona? This cannot be undone.')) return;
  ROSTER.forEach(r => {
    r.score = 0; r.wins = 0; r.losses = 0; r.draws = 0;
    r.totalSessions = 0; r.avgScore = 0;
    r.criteriaScores = {}; r.chatLog = [];
    r.torch = false; r.immune = false;
  });
  saveRoster(); renderRoster(); renderSurvivorIf(); renderLiveStatusIf();
  toast('All stats reset.');
}

function clearRoster() {
  if (!confirm('Remove ALL personas from the roster? This cannot be undone.')) return;
  ROSTER.length = 0;
  saveRoster(); renderRoster(); renderSurvivorIf(); renderLiveStatusIf();
  toast('Roster cleared.');
}

function wipeAllData() {
  if (!confirm('WIPE ALL DATA including roster, teams, episodes, timeline, and settings? This cannot be undone.')) return;
  localStorage.clear();
  toast('All data wiped. Reloading…');
  setTimeout(() => location.reload(), 900);
}

function deleteModel(id) {
  const idx = ROSTER.findIndex(r => r.id === id);
  if (idx === -1) return;
  const name = ROSTER[idx].name;
  if (!confirm(`Delete persona “${name}”?`)) return;
  ROSTER.splice(idx, 1);
  saveRoster();
  if (state.selRoster === id) clearRosterFocus();
  renderRoster(); renderSurvivorIf(); renderLiveStatusIf();
  toast(`Deleted ${name}.`);
}

function copyPromptText(id) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  const text = r.customPrompt || '';
  copyToClipboard(text).then(() => toast('Prompt copied.')).catch(() => fallbackCopy(text));
}

function copyIvResponse(id, idx) {
  const r = ROSTER.find(r => r.id === id);
  if (!r || !r.chatLog) return;
  const entry = r.chatLog[idx];
  if (!entry) return;
  const text = entry.response || '';
  copyToClipboard(text).then(() => toast('Response copied.')).catch(() => fallbackCopy(text));
}

function copyIvPrompt(id, idx) {
  const r = ROSTER.find(r => r.id === id);
  if (!r || !r.chatLog) return;
  const entry = r.chatLog[idx];
  if (!entry) return;
  const text = entry.prompt || '';
  copyToClipboard(text).then(() => toast('Prompt copied.')).catch(() => fallbackCopy(text));
}

function copyPreset(name) {
  const p = PRESETS.find(p => p.name === name);
  if (!p) return;
  const text = JSON.stringify(p, null, 2);
  copyToClipboard(text).then(() => toast('Preset copied.')).catch(() => fallbackCopy(text));
}

function copyIvPromptInline(id) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  const text = r.interviewPrompt || getDefaultInterviewPrompt(r);
  copyToClipboard(text).then(() => toast('Interview prompt copied.')).catch(() => fallbackCopy(text));
}

function pasteInterviewPrompt() {
  navigator.clipboard.readText().then(text => {
    const ta = document.getElementById('iv-prompt-textarea');
    if (ta) { ta.value = text; ta.dispatchEvent(new Event('input')); }
  }).catch(() => toast('Clipboard read not permitted.'));
}

function pastePrompt(id) {
  navigator.clipboard.readText().then(text => {
    const ta = document.getElementById(`prompt-ta-${id}`);
    if (ta) { ta.value = text; ta.dispatchEvent(new Event('input')); }
    else {
      const r = ROSTER.find(r => r.id === id);
      if (r) { r.customPrompt = text; saveRoster(); toast('Prompt pasted.'); }
    }
  }).catch(() => toast('Clipboard read not permitted.'));
}

let _ivPromptModalTarget = null;
function openIvPromptModal(id) {
  _ivPromptModalTarget = id;
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  const ta = document.getElementById('iv-prompt-textarea');
  if (ta) ta.value = r.interviewPrompt || getDefaultInterviewPrompt(r);
  const modal = document.getElementById('iv-prompt-modal');
  if (modal) modal.classList.add('open');
}

function closeIvPromptModal() {
  _ivPromptModalTarget = null;
  const modal = document.getElementById('iv-prompt-modal');
  if (modal) modal.classList.remove('open');
}

function applyIvPrompt() {
  const id = _ivPromptModalTarget;
  if (!id) return;
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  const ta = document.getElementById('iv-prompt-textarea');
  if (!ta) return;
  r.interviewPrompt = ta.value.trim();
  saveRoster();
  closeIvPromptModal();
  toast('Interview prompt saved.');
}

function resetIvPrompt() {
  const id = _ivPromptModalTarget;
  if (!id) return;
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  const ta = document.getElementById('iv-prompt-textarea');
  if (ta) ta.value = getDefaultInterviewPrompt(r);
}

function setBoardSort(key) {
  state.boardSort = key;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderSurvivorIf();
}
