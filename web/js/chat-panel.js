/* chat-panel.js — chat settings, run panel, turn chips, streaming */

function gsVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function gsChecked(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

function getSettings() {
  return {
    temp: parseFloat(gsVal('sp-temp')) || 0.7,
    topP: parseFloat(gsVal('sp-top-p')) || 1,
    maxTokens: parseInt(gsVal('sp-max-tokens')) || 2048,
    systemPrompt: gsVal('sp-system-prompt'),
    stream: gsChecked('sp-stream'),
    timeout: parseInt(gsVal('sp-timeout')) || 60,
  };
}

const SCORE_PRESETS = [
  { name: 'Balanced', signals: ['clarity','depth','accuracy','creativity','conciseness'], weights: [1,1,1,0.5,0.5] },
  { name: 'Code Review', signals: ['accuracy','depth','clarity','conciseness'], weights: [2,1,1,0.5] },
  { name: 'Creative', signals: ['creativity','clarity','depth'], weights: [2,1,0.5] },
  { name: 'Debate', signals: ['depth','accuracy','clarity'], weights: [1.5,1.5,1] },
];

function setScorePreset(name) {
  const preset = SCORE_PRESETS.find(p => p.name === name);
  if (!preset) return;
  const signals = getScoreSignals().map((s, i) => ({
    ...s,
    weight: preset.weights[preset.signals.indexOf(s.key)] ?? s.weight
  }));
  localStorage.setItem('lmmp-score-signals', JSON.stringify(signals));
  renderScoreSignals();
  toast(`Score preset “${name}” applied.`);
}

function renderScoreSignals() {
  const wrap = document.getElementById('score-signals-wrap');
  if (!wrap) return;
  const signals = getScoreSignals();
  wrap.innerHTML = signals.map(s => `
    <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--bdr);font-size:.82rem">
      <span style="flex:1">${esc(s.label)}</span>
      <select onchange="updateSignalTier('${s.key}',this.value)" style="font-size:.78rem;background:var(--bg2);border:1px solid var(--bdr);border-radius:4px;padding:2px 4px">
        <option${s.tier==='primary'?' selected':''}>primary</option>
        <option${s.tier==='secondary'?' selected':''}>secondary</option>
      </select>
      <input type="number" value="${s.weight}" min="0" max="5" step="0.5"
        style="width:48px;background:var(--bg2);border:1px solid var(--bdr);border-radius:4px;padding:2px 4px;font-size:.78rem"
        onchange="updateSignalWeight('${s.key}',this.value)">
    </div>`).join('');
}

function updateSignalWeight(key, val) {
  const signals = getScoreSignals();
  const s = signals.find(s => s.key === key);
  if (s) s.weight = parseFloat(val) || 1;
  localStorage.setItem('lmmp-score-signals', JSON.stringify(signals));
}

function updateSignalTier(key, tier) {
  const signals = getScoreSignals();
  const s = signals.find(s => s.key === key);
  if (s) s.tier = tier;
  localStorage.setItem('lmmp-score-signals', JSON.stringify(signals));
}

function toggleSignalThresholds() {
  const el = document.getElementById('signal-thresholds-wrap');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function toggleScoringRef() {
  const el = document.getElementById('scoring-ref-wrap');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function getTimeout() {
  return (parseInt(gsVal('sp-timeout')) || 60) * 1000;
}

function renderRunPanel() {
  const teamSel = document.getElementById('run-team-select');
  if (teamSel) {
    const cur = teamSel.value;
    teamSel.innerHTML = '<option value="">-- No team --</option>' +
      TEAMS.map(t => `<option value="${t.id}"${state.runTeam===t.id?' selected':''}>${esc(t.name)}</option>`).join('');
    if (cur) teamSel.value = cur;
  }
}

function selectRunTeam(id) {
  state.runTeam = id || null;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderTurnChips();
}

function setChatMode(mode) {
  state.chatMode = mode;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  document.querySelectorAll('.chat-mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  const groupSettings = document.getElementById('group-settings-wrap');
  if (groupSettings) groupSettings.style.display = mode === 'group' ? 'block' : 'none';
  const soloBar = document.getElementById('solo-bar');
  if (soloBar) soloBar.style.display = mode === 'solo' ? 'flex' : 'none';
  if (mode === 'solo') populateSoloModelSelect();
}

function toggleGroupSettings() {
  const el = document.getElementById('group-settings-wrap');
  if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

function buildTurnQueue() {
  const team = TEAMS.find(t => t.id === state.runTeam);
  if (!team || !team.members || team.members.length === 0) return [];
  return team.members.map(id => ROSTER.find(r => r.id === id)).filter(Boolean);
}

function renderTurnChips() {
  const bar = document.getElementById('turn-chips-bar');
  if (!bar) return;
  const queue = buildTurnQueue();
  if (queue.length === 0) { bar.innerHTML = ''; return; }
  bar.innerHTML = queue.map(r =>
    `<span class="turn-chip" id="chip-${r.id}" onclick="highlightChip('${r.id}')">${r.emoji||''} ${esc(r.name)}</span>`
  ).join('');
}

function highlightChip(id) {
  document.querySelectorAll('.turn-chip').forEach(c => c.classList.remove('active'));
  const chip = document.getElementById(`chip-${id}`);
  if (chip) chip.classList.add('active');
}

function handleChatKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendChatOrSolo();
  }
}

function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = (el.scrollHeight) + 'px';
}

async function streamChatCompletions(baseUrl, persona, prompt, history, bubble, log) {
  // OpenAI-compatible /v1/chat/completions fallback
  const messages = [
    { role: 'system', content: persona.customPrompt || `You are ${persona.name}.` },
    ...history,
    { role: 'user', content: prompt },
  ];
  const settings = getSettings();
  let fullText = '';
  try {
    const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: persona.modelId || '',
        messages,
        temperature: persona.temp ?? settings.temp,
        max_tokens: persona.maxTokens ?? settings.maxTokens,
        stream: true,
      }),
      signal: chat.abortController ? chat.abortController.signal : undefined,
    });
    if (!resp.ok) { addSysMsg(`Error ${resp.status}`, log); return ''; }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') break;
        try {
          const obj = JSON.parse(data);
          const delta = obj.choices?.[0]?.delta?.content || '';
          fullText += delta;
          if (bubble) updateLogEntry(bubble, fullText, persona.name);
        } catch {}
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') addSysMsg('Stream error: ' + e.message, log);
  }
  return fullText;
}

async function sendChatMessage() {
  const inp = document.getElementById('chat-input');
  if (!inp) return;
  const prompt = inp.value.trim();
  if (!prompt || chat.running) return;
  inp.value = ''; inp.style.height = 'auto';

  const mode = state.chatMode || 'group';
  if (mode === 'solo') { sendSoloMessage(); return; }

  const queue = buildTurnQueue();
  if (queue.length === 0) { addSysMsg('No team selected or team is empty.', null); return; }

  chat.running = true;
  chat.abortController = new AbortController();
  setRunControls(true);

  addChatBubble({ role:'user', content: prompt });
  TIMELINE.unshift({ type:'chat', prompt, ts: Date.now() });
  localStorage.setItem('lmmp-timeline', JSON.stringify(TIMELINE));

  const history = chat.history.slice(-20);
  for (const persona of queue) {
    if (!chat.running) break;
    const m = MACHINES.find(m => m.id === persona.machine);
    if (!m) { addSysMsg(`${persona.name} has no machine.`, null); continue; }
    highlightChip(persona.id);
    const bubble = addChatBubble({ role:'assistant', content:'…', sender: persona.name });
    const response = await streamV1Chat(m.url, persona, prompt, history, bubble, null);
    chat.history.push({ role:'user', content:prompt }, { role:'assistant', content:response });
    if (response) {
      updateSessionTracker(persona.id, prompt, response);
      saveChatLog(persona.id, prompt, response);
    }
  }
  chat.running = false;
  chat.abortController = null;
  setRunControls(false);
}

async function runAutoRound() {
  const prompt = gsVal('auto-prompt-input') || 'Continue.';
  const rounds = parseInt(gsVal('auto-rounds-input')) || 1;
  for (let i = 0; i < rounds; i++) {
    if (!chat.running) {
      const inp = document.getElementById('chat-input');
      if (inp) inp.value = prompt;
      await sendChatMessage();
      // wait for turn to complete before next round
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

function stopChat() {
  chat.running = false;
  if (chat.abortController) { chat.abortController.abort(); chat.abortController = null; }
  setRunControls(false);
  toast('Chat stopped.');
}

async function fireAgent(personaId, prompt) {
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  const m = MACHINES.find(m => m.id === r.machine);
  if (!m) { toast('No machine for ' + r.name); return; }
  const bubble = addChatBubble({ role:'assistant', content:'…', sender: r.name });
  await streamV1Chat(m.url, r, prompt, [], bubble, null);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function setRunControls(running) {
  const sendBtn = document.getElementById('chat-send-btn');
  const stopBtn = document.getElementById('chat-stop-btn');
  if (sendBtn) sendBtn.disabled = running;
  if (stopBtn) stopBtn.style.display = running ? 'inline-flex' : 'none';
}
