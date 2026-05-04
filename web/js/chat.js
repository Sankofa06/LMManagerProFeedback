/* chat.js — LM Studio v1 streaming, interview presets, criteria */

function showModelInfoPopover(rosterId) {
  const r = ROSTER.find(r => r.id === rosterId);
  if (!r) return;
  const info = [
    `Name: ${r.name}`,
    `Model: ${r.modelId || '(none)'}`,
    `Machine: ${machineLabel(r)}`,
    `Temp: ${r.temp ?? 0.7}`,
    `MaxTokens: ${r.maxTokens ?? 2048}`,
  ].join('\n');
  alert(info);
}

function fmtParams(r) {
  return `temp=${r.temp??0.7} top_p=${r.topP??1} max=${r.maxTokens??2048}`;
}

async function streamV1Chat(baseUrl, persona, prompt, history, bubble, log) {
  // Primary: LM Studio /api/v1/chat SSE streaming
  const messages = [
    { role: 'system', content: persona.customPrompt || `You are ${persona.name}, a helpful AI assistant.` },
    ...(history || []),
    { role: 'user', content: prompt },
  ];
  let fullText = '';
  let thinkingText = '';

  try {
    const resp = await fetch(`${baseUrl}/api/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: persona.modelId || '',
        messages,
        temperature: persona.temp ?? 0.7,
        top_p: persona.topP ?? 1,
        max_tokens: persona.maxTokens ?? 2048,
        stream: true,
      }),
      signal: chat.abortController ? chat.abortController.signal : undefined,
    });

    if (!resp.ok) {
      // Fallback to OpenAI-compat endpoint
      return await streamChatCompletions(baseUrl, persona, prompt, history, bubble, log);
    }

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim());

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const obj = JSON.parse(data);
          // LM Studio event types
          const evType = obj.type;
          if (evType === 'model_load.progress' || evType === 'prompt_processing.progress') {
            // progress events — update bubble with status
            const pct = obj.progress ? Math.round(obj.progress * 100) : '?';
            if (bubble) updateLogEntry(bubble, `(${evType.split('.')[0]}: ${pct}%)`, persona.name);
            continue;
          }
          if (evType === 'reasoning.delta') {
            thinkingText += obj.delta || '';
            continue;
          }
          if (evType === 'message.delta') {
            fullText += obj.delta || '';
          } else if (evType === 'chat.end') {
            // done
            break;
          } else {
            // OpenAI-compat delta format
            const delta = obj.choices?.[0]?.delta?.content || '';
            fullText += delta;
          }
          const display = thinkingText
            ? `<think>${thinkingText}</think>${fullText}`
            : fullText;
          if (bubble) updateLogEntry(bubble, display, persona.name);
        } catch {}
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') {
      // Try fallback
      return await streamChatCompletions(baseUrl, persona, prompt, history, bubble, log);
    }
  }

  const finalContent = thinkingText ? `<think>${thinkingText}</think>${fullText}` : fullText;
  if (bubble) finalizeLog(bubble, finalContent, persona.name);
  return finalContent;
}

// Interview prompt presets
const IV_PRODUCT_PRESETS = [
  { key: 'saas', label: 'SaaS Product', desc: 'B2B software product evaluation' },
  { key: 'consumer', label: 'Consumer App', desc: 'Mobile/web consumer app' },
  { key: 'api', label: 'API / Platform', desc: 'Developer-facing API or platform' },
  { key: 'hardware', label: 'Hardware', desc: 'Physical product or device' },
];

const IV_STACK_PRESETS = [
  { key: 'fullstack', label: 'Full Stack', desc: 'Frontend + backend' },
  { key: 'ml', label: 'ML / AI', desc: 'Machine learning or AI systems' },
  { key: 'infra', label: 'Infrastructure', desc: 'DevOps, cloud, infra' },
  { key: 'mobile', label: 'Mobile', desc: 'iOS / Android' },
];

const IV_DEFAULT_POSTAMBLE = `
Be specific, rigorous, and honest. Evaluate based on the criteria provided.
Respond in the persona\'s voice and style.
`.trim();

function buildIvTeamLine(team) {
  if (!team || !team.members || team.members.length === 0) return '';
  const names = team.members.map(id => {
    const r = ROSTER.find(r => r.id === id);
    return r ? r.name : id;
  }).join(', ');
  return `You are evaluating alongside: ${names}.`;
}

function buildInterviewPrompt(persona, options) {
  options = options || {};
  const team = options.team ? TEAMS.find(t => t.id === options.team) : null;
  const brandName = options.brandName || localStorage.getItem('lmmp-brand-name') || 'the product';
  const directorName = options.directorName || localStorage.getItem('lmmp-director-name') || 'the director';
  const criteria = JSON.parse(localStorage.getItem('lmmp-criteria') || '[]').map(c => c.name).join(', ');
  const teamLine = team ? buildIvTeamLine(team) : '';
  const criteriaLine = criteria ? `Evaluate on these criteria: ${criteria}.` : '';
  return [
    `You are ${persona.name}, an AI persona participating in a structured evaluation of ${brandName}.`,
    `This session is directed by ${directorName}.`,
    teamLine,
    criteriaLine,
    persona.customPrompt || '',
    IV_DEFAULT_POSTAMBLE,
  ].filter(Boolean).join('\n\n');
}

function getDefaultInterviewPrompt(persona) {
  return buildInterviewPrompt(persona);
}

const DEFAULT_INTERVIEW_PROMPT = `You are a rigorous AI evaluator participating in a structured benchmark session.`;

const DEFAULT_CRITERIA = [
  { key: 'clarity', name: 'Clarity' },
  { key: 'depth', name: 'Depth' },
  { key: 'accuracy', name: 'Accuracy' },
];

let CRITERIA = JSON.parse(localStorage.getItem('lmmp-criteria') || 'null');
if (!CRITERIA) {
  CRITERIA = DEFAULT_CRITERIA.map(c => ({ ...c }));
  localStorage.setItem('lmmp-criteria', JSON.stringify(CRITERIA));
}

function saveCriteria() {
  localStorage.setItem('lmmp-criteria', JSON.stringify(CRITERIA));
}

function save() {
  // Generic save — saves roster and state
  saveRoster();
  localStorage.setItem('lmmp-state', JSON.stringify(state));
}

function saveInterviewPrompt(personaId, prompt) {
  const r = ROSTER.find(r => r.id === personaId);
  if (!r) return;
  r.interviewPrompt = prompt;
  saveRoster();
}
