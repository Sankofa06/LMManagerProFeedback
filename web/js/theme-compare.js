/* theme-compare.js — theme, presets, compare mode, timeline */

function applyTheme(theme) {
  state.theme = theme;
  const root = document.documentElement;
  root.removeAttribute('data-theme');
  if (theme === 'dark') root.setAttribute('data-theme','dark');
  else if (theme === 'light') root.setAttribute('data-theme','light');
  // 'auto' = no attribute, CSS handles via prefers-color-scheme
  localStorage.setItem('lmmp-state', JSON.stringify(state));
}

function toggleTheme() {
  const themes = ['auto','light','dark'];
  const idx = themes.indexOf(state.theme || 'auto');
  applyTheme(themes[(idx + 1) % themes.length]);
}

function updateSessionTracker(personaId, prompt, response) {
  if (!state.sessionTracker) state.sessionTracker = {};
  if (!state.sessionTracker[personaId]) state.sessionTracker[personaId] = [];
  state.sessionTracker[personaId].push({ prompt, response, ts: Date.now() });
  localStorage.setItem('lmmp-state', JSON.stringify(state));
}

function resetSessionTracker() {
  state.sessionTracker = {};
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  toast('Session tracker cleared.');
}

/* ── PRESETS ──────────────────────────────────────────────── */
function renderPresetChips() {
  const wrap = document.getElementById('preset-chips');
  if (!wrap) return;
  wrap.innerHTML = PRESETS.map(p =>
    `<button class="preset-chip" onclick="usePreset('${esc(p.name)}')" title="${esc(p.name)}">${esc(p.name)}</button>`
  ).join('');
}

function usePreset(name) {
  const p = PRESETS.find(p => p.name === name);
  if (!p) return;
  const inp = document.getElementById('chat-input');
  if (inp) { inp.value = p.prompt; autoGrow(inp); inp.focus(); }
}

function deletePreset(name) {
  PRESETS = PRESETS.filter(p => p.name !== name);
  localStorage.setItem('lmmp-presets', JSON.stringify(PRESETS));
  renderPresetChips();
  renderPresetModalList();
}

function savePresetFromInput() {
  const nameEl = document.getElementById('preset-name-input');
  const promptEl = document.getElementById('preset-prompt-input');
  if (!nameEl || !promptEl) return;
  const name = nameEl.value.trim();
  const prompt = promptEl.value.trim();
  if (!name || !prompt) { toast('Name and prompt required.'); return; }
  if (PRESETS.find(p => p.name === name)) { toast('Preset name already exists.'); return; }
  PRESETS.push({ name, prompt });
  localStorage.setItem('lmmp-presets', JSON.stringify(PRESETS));
  nameEl.value = ''; promptEl.value = '';
  renderPresetChips();
  renderPresetModalList();
  toast('Preset saved.');
}

function openPresetModal() {
  renderPresetModalList();
  const m = document.getElementById('preset-modal');
  if (m) m.classList.add('open');
}

function closePresetModal() {
  const m = document.getElementById('preset-modal');
  if (m) m.classList.remove('open');
}

function renderPresetModalList() {
  const list = document.getElementById('preset-modal-list');
  if (!list) return;
  list.innerHTML = PRESETS.length === 0
    ? '<div style="color:var(--tx3);font-size:.82rem;">No presets yet.</div>'
    : PRESETS.map(p =>
        `<div class="preset-modal-row">
          <span class="preset-modal-name">${esc(p.name)}</span>
          <button class="btn-sm" onclick="usePreset('${esc(p.name)}');closePresetModal()">Use</button>
          <button class="btn-sm" onclick="copyPreset('${esc(p.name)}')" title="Copy">&#128203;</button>
          <button class="btn-sm danger" onclick="deletePreset('${esc(p.name)}')" title="Delete">&times;</button>
        </div>`
      ).join('');
}

function addPresetFromModal() {
  savePresetFromInput();
}

/* ── COMPARE MODE ──────────────────────────────────────────── */
function toggleCompareMode() {
  state.compareMode = !state.compareMode;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  setNav(state.nav); // re-render
}

function runCompare() {
  const inp = document.getElementById('chat-input');
  if (!inp) return;
  const prompt = inp.value.trim();
  if (!prompt) return;
  inp.value = '';
  const grid = document.getElementById('compare-grid');
  if (!grid) return;
  const cols = grid.querySelectorAll('.compare-col');
  cols.forEach(col => {
    const id = col.dataset.personaId;
    if (id) fireAgentInColumn(id, prompt, col);
  });
  TIMELINE.unshift({ type:'compare', prompt, ts:Date.now() });
  localStorage.setItem('lmmp-timeline', JSON.stringify(TIMELINE));
  renderTimeline();
}

function fireAgentInColumn(personaId, prompt, col) {
  const log = col.querySelector('.compare-col-log');
  if (!log) return;
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  const m = MACHINES.find(m => m.id === r.machine);
  if (!m) { addSysMsg(`No machine assigned for ${r.name}.`, log); return; }
  addChatBubble({ role:'user', content:prompt }, log);
  const bubble = addChatBubble({ role:'assistant', content:'…', sender:r.name }, log);
  streamV1Chat(m.url, r, prompt, [], bubble, log);
}

/* ── TIMELINE ──────────────────────────────────────────────── */
function renderTimeline() {
  const list = document.getElementById('timeline-list');
  if (!list) return;
  if (TIMELINE.length === 0) {
    list.innerHTML = '<div style="color:var(--tx3);font-size:.82rem;padding:12px;">No timeline entries yet.</div>';
    return;
  }
  list.innerHTML = TIMELINE.map((entry, i) => {
    const d = new Date(entry.ts);
    const time = d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'});
    const preview = (entry.prompt || '').slice(0, 80);
    return `<div class="timeline-entry" data-idx="${i}">
      <div class="tl-header" onclick="toggleTimelineEntry(${i})">
        <span class="tl-type">${entry.type || 'chat'}</span>
        <span class="tl-preview">${esc(preview)}</span>
        <span class="tl-time">${time}</span>
      </div>
      <div class="tl-body" id="tl-body-${i}" style="display:none">
        <div class="tl-prompt">${esc(entry.prompt || '')}</div>
        <button class="btn-sm" onclick="replayPromptFromTimeline(${i})">Replay</button>
      </div>
    </div>`;
  }).join('');
}

function toggleTimelineEntry(i) {
  const body = document.getElementById(`tl-body-${i}`);
  if (!body) return;
  body.style.display = body.style.display === 'none' ? 'block' : 'none';
}

function replayPromptFromTimeline(i) {
  const entry = TIMELINE[i];
  if (!entry) return;
  replayPrompt(entry.prompt || '');
}

function replayPrompt(prompt) {
  const inp = document.getElementById('chat-input');
  if (!inp) return;
  inp.value = prompt;
  autoGrow(inp);
  inp.focus();
  setNav('chat');
}

function fallbackCopy(text) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed'; ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); toast('Copied.'); }
  catch { toast('Copy failed.'); }
  document.body.removeChild(ta);
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  return Promise.reject(new Error('Clipboard API not available'));
}

function clearTimeline() {
  if (!confirm('Clear the entire timeline?')) return;
  TIMELINE.length = 0;
  localStorage.setItem('lmmp-timeline', JSON.stringify(TIMELINE));
  renderTimeline();
  toast('Timeline cleared.');
}
