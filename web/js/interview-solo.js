/* interview-solo.js — interview history, solo chat, compare hook */

// Compare mode hook: override sendChatMessage when compareMode is on
const _origSendChatMessage = typeof sendChatMessage !== 'undefined' ? sendChatMessage : null;

let interviewHistory = {};
let interviewRunning = {};

function ivKeydown(e, personaId) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendInterview(personaId);
  }
}

function renderInterviewHistory(personaId) {
  const log = document.getElementById('interview-log');
  if (!log) return;
  const history = interviewHistory[personaId] || [];
  log.innerHTML = history.map(entry => buildIvBubble(entry)).join('');
  log.scrollTop = log.scrollHeight;
}

function buildIvBubble(entry) {
  const cls = entry.role === 'user' ? 'user' : 'assistant';
  const sender = entry.sender ? `<div class="bubble-sender">${esc(entry.sender)}</div>` : '';
  return `<div class="iv-bubble ${cls}">${sender}<div class="bubble-md">${renderMarkdown(entry.content || '')}</div></div>`;
}

async function sendInterview(personaId) {
  const inp = document.getElementById('interview-input');
  if (!inp) return;
  const prompt = inp.value.trim();
  if (!prompt || interviewRunning[personaId]) return;
  inp.value = '';

  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  const m = MACHINES.find(m => m.id === r.machine);
  if (!m) { addSysMsg('No machine assigned to ' + r.name, document.getElementById('interview-log')); return; }

  if (!interviewHistory[personaId]) interviewHistory[personaId] = [];
  interviewHistory[personaId].push({ role: 'user', content: prompt });
  renderInterviewHistory(personaId);

  interviewRunning[personaId] = true;
  const log = document.getElementById('interview-log');
  const bubble = document.createElement('div');
  bubble.className = 'iv-bubble assistant';
  bubble.innerHTML = `<div class="bubble-sender">${esc(r.name)}</div><div class="bubble-md">…</div>`;
  if (log) { log.appendChild(bubble); log.scrollTop = log.scrollHeight; }

  const ivPrompt = r.interviewPrompt || getDefaultInterviewPrompt(r);
  const history = (interviewHistory[personaId] || []).slice(-20);

  // Temporarily set customPrompt to interview prompt
  const origPrompt = r.customPrompt;
  r.customPrompt = ivPrompt;

  const response = await streamV1Chat(m.url, r, prompt, history.slice(0,-1), bubble.querySelector('.bubble-md'), log);
  r.customPrompt = origPrompt;

  interviewHistory[personaId].push({ role: 'assistant', content: response, sender: r.name });
  interviewRunning[personaId] = false;

  // Save to roster log
  if (!r.chatLog) r.chatLog = [];
  r.chatLog.push({ prompt, response, ts: Date.now() });
  saveRoster();
  refreshDetailStats(personaId);
}

function refreshDetailStats(personaId) {
  // Re-render detail header score if visible
  const scoreEl = document.querySelector(`[data-score-btn="${personaId}"]`);
  const r = ROSTER.find(r => r.id === personaId);
  if (scoreEl && r) scoreEl.textContent = displayScore(r);
}

function clearInterview(personaId) {
  interviewHistory[personaId] = [];
  interviewRunning[personaId] = false;
  renderInterviewHistory(personaId);
  toast('Interview cleared.');
}

// Solo chat state
const ONEONONE = 'solo';
let oneononeRunning = false;

const soloState = {
  history: [],
  personaId: null,
  scope: 'focused',
};

function saveOneonone() {
  localStorage.setItem('lmmp-solo-state', JSON.stringify(soloState));
}

function setAudience(mode) {
  // audience picker: all / team / solo
  state.chatMode = mode;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  document.querySelectorAll('.audience-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.audience === mode);
  });
}

function setSoloScope(scope) {
  soloState.scope = scope;
  saveOneonone();
}

function populateSoloModelSelect() {
  const sel = document.getElementById('solo-model-select');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">-- Select persona --</option>' +
    ROSTER.map(r => `<option value="${r.id}"${soloState.personaId===r.id?' selected':''}>${r.emoji||''} ${esc(r.name)}</option>`).join('');
  if (cur) sel.value = cur;
}

function selectSoloModel(id) {
  soloState.personaId = id;
  soloState.history = [];
  saveOneonone();
  renderSoloLog();
}

function renderSoloLog() {
  const log = document.getElementById('solo-log');
  if (!log) return;
  log.innerHTML = soloState.history.map(e => buildSoloBubble(e)).join('');
  log.scrollTop = log.scrollHeight;
}

function buildSoloBubble(entry) {
  const cls = entry.role === 'user' ? 'user' : 'assistant';
  const sender = entry.sender ? `<div class="bubble-sender">${esc(entry.sender)}</div>` : '';
  return `<div class="chat-bubble ${cls}">${sender}<div class="bubble-md">${renderMarkdown(entry.content||'')}</div></div>`;
}

function clearSoloLog() {
  soloState.history = [];
  saveOneonone();
  renderSoloLog();
  toast('Solo log cleared.');
}

function sendChatOrSolo() {
  const mode = state.chatMode || 'group';
  if (mode === 'solo') sendSoloMessage();
  else sendChatMessage();
}

function clearActiveLog() {
  const mode = state.chatMode || 'group';
  if (mode === 'solo') clearSoloLog();
  else clearRunLog();
}

async function sendSoloMessage() {
  if (oneononeRunning) return;
  const inp = document.getElementById('chat-input');
  if (!inp) return;
  const prompt = inp.value.trim();
  if (!prompt) return;
  inp.value = ''; inp.style.height = 'auto';

  const personaId = soloState.personaId ||
    (document.getElementById('solo-model-select') || {}).value;
  if (!personaId) { toast('Select a persona first.'); return; }

  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  const m = MACHINES.find(m => m.id === r.machine);
  if (!m) { addSysMsg('No machine assigned to ' + r.name, null); return; }

  soloState.history.push({ role: 'user', content: prompt });
  oneononeRunning = true;
  chat.abortController = new AbortController();
  setRunControls(true);

  const log = document.getElementById('solo-log') || document.getElementById('chat-log');
  addChatBubble({ role: 'user', content: prompt }, log);

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble assistant';
  bubble.innerHTML = `<div class="bubble-sender">${esc(r.name)}</div><div class="bubble-md">…</div>`;
  if (log) { log.appendChild(bubble); log.scrollTop = log.scrollHeight; }

  const history = soloState.history.slice(-20, -1);
  const response = await streamV1Chat(m.url, r, prompt, history, bubble.querySelector('.bubble-md'), log);

  soloState.history.push({ role: 'assistant', content: response, sender: r.name });
  saveOneonone();
  oneononeRunning = false;
  chat.abortController = null;
  setRunControls(false);
}

function toggleChatOverflow() {
  const menu = document.getElementById('chat-overflow-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

function closeChatOverflow() {
  const menu = document.getElementById('chat-overflow-menu');
  if (menu) menu.style.display = 'none';
}

function toggleRosterOverflow() {
  const menu = document.getElementById('roster-overflow-menu');
  if (!menu) return;
  menu.style.display = menu.style.display === 'none' ? 'flex' : 'none';
}

function closeRosterOverflow() {
  const menu = document.getElementById('roster-overflow-menu');
  if (menu) menu.style.display = 'none';
}

function editField(label, field, value, rosterId, type) {
  const inputType = type || 'text';
  return `<div>
    <div class="sp-section-title">${esc(label)}</div>
    <input type="${inputType}" value="${esc(String(value))}" 
      style="width:100%;box-sizing:border-box;background:var(--bg2);color:var(--tx1);border:1px solid var(--bdr);border-radius:6px;padding:5px 8px;font-size:.83rem"
      onchange="saveRosterEdit('${rosterId}','${field}',this.value)">
  </div>`;
}

function saveRosterEdit(id, field, value) {
  const r = ROSTER.find(r => r.id === id);
  if (!r) return;
  if (['temp','topP','maxTokens'].includes(field)) r[field] = parseFloat(value);
  else r[field] = value;
  saveRoster();
}
