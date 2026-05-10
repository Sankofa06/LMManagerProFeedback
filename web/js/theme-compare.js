/* ── V5: THEME ── */
function applyTheme(){
  document.documentElement.setAttribute('data-theme',state.theme);
  const btn=document.getElementById('theme-toggle-btn');
  if(btn)btn.textContent=state.theme==='dark'?'🌙':'☀';
}
function toggleTheme(){
  state.theme=state.theme==='dark'?'light':'dark';
  localStorage.setItem('lmmp_v5_theme',state.theme);
  applyTheme();
}

/* ── V5: SESSION TRACKER ── */
function updateSessionTracker(){
  const t=state.sessionTracker;
  const runsText=`${t.runs} runs`;
  const tokensText=t.tokens.toLocaleString();
  const timeText=(t.timeMs/1000).toFixed(1)+'s';
  const vramText=t.peakVram>0?t.peakVram.toFixed(1)+'GB':'—';
  // row 1 (desktop)
  const r=document.getElementById('trk-runs');if(r)r.textContent=runsText;
  const tk=document.getElementById('trk-tokens');if(tk)tk.textContent=tokensText;
  const tm=document.getElementById('trk-time');if(tm)tm.textContent=timeText;
  const v=document.getElementById('trk-vram');if(v)v.textContent=vramText;
  // row 2 (mobile)
  const r2=document.getElementById('trk-runs-2');if(r2)r2.textContent=runsText;
  const tk2=document.getElementById('trk-tokens-2');if(tk2)tk2.textContent=tokensText;
  const tm2=document.getElementById('trk-time-2');if(tm2)tm2.textContent=timeText;
  const v2=document.getElementById('trk-vram-2');if(v2)v2.textContent=vramText;
}
function resetSessionTracker(){
  state.sessionTracker={runs:0,tokens:0,timeMs:0,peakVram:0};
  updateSessionTracker();toast('Session tracker reset');
}

/* ── V5: PRESETS ── */
function renderPresetChips(){
  const el=document.getElementById('preset-chips');if(!el)return;el.innerHTML='';
  PRESETS.forEach(p=>{
    const chip=document.createElement('span');chip.className='preset-chip';
    chip.innerHTML=`<span onclick="usePreset('${p.id}')">${esc(p.name)}</span><span class="cp" onclick="event.stopPropagation();copyPreset('${p.id}')" title="Copy prompt">⎘</span><span class="x" onclick="event.stopPropagation();deletePreset('${p.id}')" title="Delete">✕</span>`;
    el.appendChild(chip);
  });
}
function usePreset(id){
  const p=PRESETS.find(x=>x.id===id);if(!p)return;
  const inp=document.getElementById('run-prompt');if(!inp)return;
  inp.value=p.text;autoGrow(inp);inp.focus();
}
function deletePreset(id){
  PRESETS=PRESETS.filter(p=>p.id!==id);save();renderPresetChips();renderPresetModalList();
}
function savePresetFromInput(){
  const inp=document.getElementById('run-prompt');const text=inp?.value.trim();
  if(!text){toast('Type something first',true);return;}
  const name=prompt('Preset name:','New preset');if(!name)return;
  PRESETS.push({id:'p'+Date.now(),name:name.slice(0,80),text});save();renderPresetChips();toast('Preset saved ✓');
}
function openPresetModal(){
  document.getElementById('preset-modal').classList.add('open');
  renderPresetModalList();
}
function closePresetModal(e){if(e.target.id==='preset-modal')document.getElementById('preset-modal').classList.remove('open');}
function renderPresetModalList(){
  const el=document.getElementById('preset-modal-list');if(!el)return;el.innerHTML='';
  if(!PRESETS.length){el.innerHTML='<div style="padding:20px;text-align:center;color:var(--tx3);font-size:12px;font-family:var(--mono)">No saved presets yet</div>';return;}
  PRESETS.forEach(p=>{
    const row=document.createElement('div');row.className='preset-modal-row';
    row.innerHTML=`
      <span class="preset-name">${esc(p.name)}</span>
      <span class="preset-text">${esc(p.text)}</span>
      <button class="btn btn-sm" onclick="usePreset('${p.id}');document.getElementById('preset-modal').classList.remove('open')">Use</button>
      <button class="btn btn-sm btn-danger" onclick="deletePreset('${p.id}')">✕</button>`;
    el.appendChild(row);
  });
}
function addPresetFromModal(){
  const nameEl=document.getElementById('preset-new-name');
  const inp=document.getElementById('run-prompt');
  const name=nameEl?.value.trim();const text=inp?.value.trim();
  if(!name){toast('Name required',true);return;}
  if(!text){toast('Type something in chat first',true);return;}
  PRESETS.push({id:'p'+Date.now(),name:name.slice(0,80),text});
  nameEl.value='';save();renderPresetChips();renderPresetModalList();toast('Preset added ✓');
}

/* ── V5: COMPARE MODE ── */
function toggleCompareMode(){
  state.compareMode=!state.compareMode;
  const btn=document.getElementById('compare-toggle-btn');
  if(btn)btn.classList.toggle('active',state.compareMode);
  toast(state.compareMode?'Compare mode ON · all team members will run side-by-side on the same prompt':'Compare mode OFF');
  // hide turn-order bar in compare mode
  const tob=document.getElementById('turn-order-bar');
  if(tob&&state.runTeam)tob.style.display=state.compareMode?'none':'flex';
  // v8.1: hide crosstalk toggle in compare mode — it has no effect there (each agent only sees the user prompt)
  const ct=document.getElementById('crosstalk-toggle-btn');
  if(ct)ct.style.display=state.compareMode?'none':'';
}

async function runCompare(prompt){
  if(!state.runTeam){toast('Select a team first',true);return;}
  const queue=chat.turnQueue;
  if(!queue.length){toast('No models in queue',true);return;}
  // build compare grid
  const log=document.getElementById('run-log');
  const grid=document.createElement('div');grid.id='compare-grid-'+Date.now();grid.className='';grid.style.cssText='display:grid;gap:12px;padding:12px 16px;grid-template-columns:repeat(auto-fit,minmax(320px,1fr))';
  log.appendChild(grid);
  // user bubble first
  addChatBubble(APP.directorName||'The operator','Director','#f59e0b',prompt,true);
  // create empty columns up front
  const cols={};
  queue.forEach(r=>{
    const h=rclr(r);
    const col=document.createElement('div');col.className='cmp-col';col.id='cmp-'+r.id+'-'+Date.now();col.style.borderColor=h+'55';
    col.innerHTML=`
      <div class="cmp-col-hdr">
        <div class="b-avatar" style="width:24px;height:24px;background:${h}18;color:${h};border:1px solid ${h}33;font-size:${r.emoji?'14px':'9px'}">${avatarContent(r)}</div>
        <div>
          <div class="cmp-col-name" style="color:${h}">${dispName(r)}</div>
          <div style="font-size:9px;font-family:var(--mono);color:var(--tx3)">${r.role}</div>
        </div>
        <span class="cmp-col-meta" id="${col.id}-meta">queued</span>
      </div>
      <div class="cmp-col-body thinking" id="${col.id}-body">⟳ waiting…</div>
      <div class="cmp-col-actions" id="${col.id}-actions"></div>`;
    grid.appendChild(col);
    cols[r.id]=col.id;
  });
  // run sequentially
  chat.isRunning=true;chat.stopRequested=false;setRunControls(true);
  for(const r of queue){
    if(chat.stopRequested)break;
    await fireAgentInColumn(r,cols[r.id]);
  }
  chat.isRunning=false;setRunControls(false);
  if(!chat.stopRequested){state.epCount++;updateEpBadge();}
  document.getElementById('run-status-text').textContent=`Done · compare (${queue.length} models) · ep ${state.epCount}`;
  save();renderSurvivorIf();
}

async function fireAgentInColumn(r,colId){
  const mc=MACHINES.find(x=>x.id===r.machine);
  const metaEl=document.getElementById(colId+'-meta');
  const bodyEl=document.getElementById(colId+'-body');
  const actionsEl=document.getElementById(colId+'-actions');
  if(!mc||mc.status!=='online'){if(metaEl)metaEl.textContent='offline';if(bodyEl){bodyEl.classList.remove('thinking');bodyEl.textContent='Machine offline — skipped';}return;}
  if(metaEl)metaEl.textContent='loading…';
  if(bodyEl)bodyEl.textContent='⟳ Loading…';
  const t0=Date.now();
  const s=getSettings();
  const userPrompt=chat.history.filter(m=>m.role==='user').slice(-1)[0]?.content||'';
  const messages=[{role:'system',content:r.prompt},{role:'user',content:userPrompt}];
  let text='',reasoning='',ttft=null,realCompletionTokens=0,realPromptTokens=0,thinkTokens=0;
  let result=null; // v8.5: hoist out of try{} so post-stream code can read result.tps
  try{
    result=await streamV1Chat(mc.url, r.model, messages,
      {temperature:r.temp??APP.defaultTemp??0.5, maxTokens:s.maxTokens,
       reasoning:APP.thinkingEnabled?'on':null},
      {
        onPhase(phase,progress){
          if(phase==='loading'){if(metaEl)metaEl.textContent=`loading${progress<1?' '+Math.round(progress*100)+'%':'…'}`;}
          else if(phase==='processing'){if(metaEl)metaEl.textContent='processing…';}
          else if(phase==='generating'){if(metaEl)metaEl.textContent='generating…';}
        },
        onDelta(t,rz){
          text=t;reasoning=rz;
          const combined=rz?`<think>${rz}</think>${t}`:t;
          if(bodyEl){const _sp=splitThinking(combined);bodyEl.textContent=_sp.streaming||(_sp.thinking&&!_sp.answer)?`🧠 Thinking… (${_sp.thinking.split(/\s+/).filter(Boolean).length} words)`:_sp.answer||t;}
        }
      }
    );
    text=result.text;reasoning=result.reasoning;
    ttft=result.ttft;realCompletionTokens=result.outputTokens;realPromptTokens=result.inputTokens;thinkTokens=result.reasoningTokens;
    mc.loadedModel=r.model; // loadedInstanceId managed by checkMachine/loadModel only
    updateRowLoadedState(r.id,true,mc);
  }catch(e){if(bodyEl){bodyEl.classList.remove('thinking');bodyEl.textContent='Error: '+e.message;}return;}

  // v8.5: restore post-generation unload
  try{
    await fetch(`${mc.url}/api/v1/models/unload`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({instance_id:mc.loadedInstanceId||r.model}),signal:AbortSignal.timeout(15000)});
    mc.loadedModel=null;mc.loadedInstanceId=null;
    updateRowLoadedState(r.id,false,mc);
    const _lel=document.getElementById('mc-loaded-'+mc.id);if(_lel)_lel.textContent='No model loaded';
  }catch{}

  const fullText=reasoning?`<think>${reasoning}</think>${text}`:text;
  const elapsed=((Date.now()-t0)/1000).toFixed(1);
  const tokens=realCompletionTokens>0?realCompletionTokens:Math.round(text.length/4);
  const tokenSrc=realCompletionTokens>0?'real':'est';
  const tps=result?.tps||((parseFloat(elapsed)-(parseFloat(ttft)||0))>0&&isFinite(tokens/(parseFloat(elapsed)-(parseFloat(ttft)||0)))?(tokens/(parseFloat(elapsed)-(parseFloat(ttft)||0))).toFixed(1):'—');
  const autoQ=autoScore(fullText,tps,ttft,thinkTokens,tokens);const score=autoQ;
  if(bodyEl){bodyEl.classList.remove('thinking');const _sp=splitThinking(fullText);bodyEl.innerHTML=_sp.thinking?thinkingBubbleHTML(_sp.thinking,_sp.answer,''):'<div class="md-body">'+renderMarkdown(text)+'</div>';}
  if(metaEl)metaEl.textContent=`${tps} t/s · ${tokenSrc==='real'?tokens:'~'+tokens}t · ${elapsed}s`;
  if(fullText){
    if(!r.sessions)r.sessions=[];
    const logId='cmp-'+r.id+'-'+Date.now();
    const sess={date:new Date().toISOString(),team:state.runTeam?.name||'compare',ttft:ttft||'—',tps,tokens,promptTokens:realPromptTokens,tokenSrc,elapsed,quality:null,autoQ,thinkTokens,taskType:classifyPrompt(userPrompt),logId,prompt:userPrompt.slice(0,2000),response:fullText};
    r.sessions.push(sess);
    rebuildCatScores(r);
    const scored=r.sessions.filter(x=>x.autoQ!=null);
    r.totalScore=scored.reduce((a,x)=>a+(x.quality!=null?combinedScore(x.autoQ,x.quality):x.autoQ),0);r.episodes=scored.length;
    const _vTps=r.sessions.map(s=>parseFloat(s.tps)).filter(t=>isFinite(t)&&t>0);
    r.avgTps=_vTps.length?_vTps.reduce((a,b)=>a+b,0)/_vTps.length:0;
    const _vTtft=r.sessions.map(s=>parseFloat(s.ttft)).filter(t=>isFinite(t)&&t>0);
    r.avgTtft=_vTtft.length?_vTtft.reduce((a,b)=>a+b,0)/_vTtft.length:0;
    TIMELINE.push({id:'tl-'+Date.now()+'-'+r.id,date:sess.date,modelId:r.id,modelName:`${dispName(r)}`,empId:r.empId,color:r.color,role:r.role,machine:r.machine,prompt:sess.prompt,response:fullText,tps,ttft:ttft||'—',tokens,elapsed,quality:score,taskType:null,team:'compare',logId});
    state.sessionTracker.runs++;
    state.sessionTracker.tokens+=tokens+realPromptTokens;
    state.sessionTracker.timeMs+=Date.now()-t0;
    if(r.size>state.sessionTracker.peakVram)state.sessionTracker.peakVram=r.size;
    updateSessionTracker();
    if(actionsEl){
      const h=rclr(r);
      actionsEl.innerHTML=`
        <button class="score-btn" id="scorebtn-${sess.logId}" onclick="openScoreSheet('${r.id}','${sess.logId}')">Score</button>
        <span style="font-size:9px;color:var(--tx3);font-family:var(--mono)">${tokenSrc==='real'?'real':'auto'}:${score}/10</span>
        <button class="b-snuff" onclick="snuffTorch('${r.id}')" style="margin-left:auto">🔥</button>`;
    }
  }
}

/* ── V5: TIMELINE ── */
function renderTimeline(){
  const feed=document.getElementById('tl-feed');if(!feed)return;
  const stats=document.getElementById('tl-stats');
  // populate model filter dropdown
  const sel=document.getElementById('tl-filter-model');
  if(sel){
    const cur=sel.value;
    const seen=new Set(TIMELINE.map(t=>t.modelId));
    sel.innerHTML='<option value="">All models</option>'+
      ROSTER.filter(r=>seen.has(r.id)).map(r=>`<option value="${r.id}" ${r.id===cur?'selected':''}>${dispId(r)} ${dispName(r)}</option>`).join('');
  }
  const q=(document.getElementById('tl-search')?.value||'').toLowerCase().trim();
  const fm=document.getElementById('tl-filter-model')?.value||'';
  const ft=document.getElementById('tl-filter-tag')?.value||'';
  const sort=document.getElementById('tl-sort')?.value||'newest';
  let entries=TIMELINE.filter(t=>{
    if(fm&&t.modelId!==fm)return false;
    if(ft&&t.taskType!==ft)return false;
    if(q&&!(t.prompt.toLowerCase().includes(q)||t.response.toLowerCase().includes(q)))return false;
    return true;
  });
  if(sort==='newest')entries.sort((a,b)=>b.date.localeCompare(a.date));
  if(sort==='oldest')entries.sort((a,b)=>a.date.localeCompare(b.date));
  if(sort==='quality')entries.sort((a,b)=>{const aq=avgCriteriaScore(a.scores)??a.autoQ??0;const bq=avgCriteriaScore(b.scores)??b.autoQ??0;return bq-aq;});
  if(sort==='speed')entries.sort((a,b)=>parseFloat(b.tps||0)-parseFloat(a.tps||0));
  if(stats)stats.textContent=`${entries.length} of ${TIMELINE.length} runs`;
  feed.innerHTML='';
  if(!entries.length){feed.innerHTML='<div style="text-align:center;padding:40px;color:var(--tx3);font-size:12px;font-family:var(--mono)">No runs match the filter</div>';return;}
  entries.forEach(t=>{
    const h=hx(t.color);
    const date=new Date(t.date);
    const dateStr=date.toLocaleDateString([],{month:'short',day:'numeric'})+' '+date.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const div=document.createElement('div');div.className='tl-entry';div.style.borderLeftColor=h;
    div.innerHTML=`
      <div class="tl-entry-hdr">
        <div class="b-avatar" style="width:24px;height:24px;background:${h}18;color:${h};border:1px solid ${h}33;font-size:9px">${t.empId}</div>
        <span class="tl-entry-name" style="color:${h}">${t.modelName}</span>
        ${t.taskType?`<span class="cat-chip" style="border-color:${({Code:'#3b82f6',Reasoning:'#a855f7',Creative:'#f59e0b',General:'#22c55e'})[t.taskType]};color:${({Code:'#3b82f6',Reasoning:'#a855f7',Creative:'#f59e0b',General:'#22c55e'})[t.taskType]}">${t.taskType}</span>`:''}
        <span style="font-size:10px;color:var(--amber)">★ ${(()=>{const a=avgCriteriaScore(t.scores);return a!=null?a+'/10':t.autoQ!=null?t.autoQ+'/10':'—'})()}</span>
        <span class="tl-entry-meta">${dateStr} · ${t.tps} t/s · ${t.tokens}t · ${t.elapsed}s</span>
      </div>
      <div class="tl-entry-prompt">${esc(t.prompt||'(no prompt)')}</div>
      <div class="tl-entry-body" id="${t.id}-body">${renderMarkdown((splitThinking(t.response).answer||splitThinking(t.response).thinking).slice(0,800))}</div>
      <div class="tl-entry-actions">
        <button class="btn btn-sm" onclick="toggleTimelineEntry('${t.id}')">Expand</button>
        <button class="btn btn-sm" onclick="replayPromptFromTimeline('${t.id}')">↻ Replay</button>
        <button class="btn btn-sm" onclick="copyToClipboard('${t.id}')">⎘ Copy</button>
      </div>`;
    feed.appendChild(div);
  });
}
function toggleTimelineEntry(id){
  const el=document.getElementById(id+'-body');if(!el)return;
  el.classList.toggle('expanded');
  const t=TIMELINE.find(x=>x.id===id);
  if(t&&el.classList.contains('expanded'))el.innerHTML=renderMarkdown(splitThinking(t.response).answer||t.response);
  else if(t)el.innerHTML=renderMarkdown((splitThinking(t.response).answer||splitThinking(t.response).thinking).slice(0,800));
}
function replayPromptFromTimeline(tid){
  const t=TIMELINE.find(x=>x.id===tid);if(!t)return;
  setNav('run');
  setTimeout(()=>{
    const inp=document.getElementById('run-prompt');if(inp){inp.value=t.prompt||'';autoGrow(inp);inp.focus();}
    toast('Prompt loaded — pick a team and send');
  },50);
}
function replayPrompt(prompt,modelId){
  setNav('run');
  setTimeout(()=>{
    const inp=document.getElementById('run-prompt');if(inp){inp.value=prompt;autoGrow(inp);inp.focus();}
    toast('Prompt loaded — pick a team and send');
  },50);
}
function fallbackCopy(txt, cb){
  const ta=document.createElement('textarea');
  ta.value=txt;ta.style.cssText='position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(ta);ta.focus();ta.select();
  try{document.execCommand('copy');cb();}
  catch{toast('Copy failed',true);}
  document.body.removeChild(ta);
}
function copyToClipboard(tid){
  const t=TIMELINE.find(x=>x.id===tid);if(!t)return;
  const parts=[];
  // Include interview prompt if this was an interview session
  if(t.team==='interview'&&interviewPrompt&&interviewPrompt.trim()){
    parts.push(`INTERVIEW PROMPT:\n${interviewPrompt}`);
  }
  if(t.prompt&&t.prompt.trim())parts.push(`PROMPT:\n${t.prompt}`);
  // Strip think tags from response before copying
  const sp=splitThinking(t.response||'');
  const cleanResponse=sp.answer||sp.thinking||t.response||'';
  parts.push(`RESPONSE (${t.modelName} · ${t.date?new Date(t.date).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'—'}):\n${cleanResponse}`);
  // thinking summary omitted from copy — truncated version adds noise
  if(t.notes&&t.notes.trim())parts.push(`NOTES:\n${t.notes}`);
  const autoScoreStr=t.autoQ!=null?`auto:${t.autoQ}/10`:'';
  const criteriaAvg=avgCriteriaScore(t.scores);
  const scoreStr=[autoScoreStr,criteriaAvg!=null?`criteria:${criteriaAvg}/10`:''].filter(Boolean).join(' · ');
  if(scoreStr)parts.push(`SCORES: ${scoreStr} · ${t.tps||'—'} t/s · TTFT ${t.ttft||'—'}s`);
  const txt=parts.join('\n\n---\n\n');
  // Use textarea fallback for iOS Safari compatibility
  const doToast=()=>{
    toast(`Copied ${t.modelName} ✓`);
    const btn=document.querySelector(`[onclick="copyToClipboard('${tid}')"]`);
    if(btn){btn.textContent='✓ Copied';btn.style.color='var(--accent)';btn.style.borderColor='var(--accent)';setTimeout(()=>{btn.textContent='⎘ Copy';btn.style.color='';btn.style.borderColor='';},2000);}
  };
  if(navigator.clipboard&&window.isSecureContext){
    navigator.clipboard.writeText(txt).then(doToast).catch(()=>fallbackCopy(txt,doToast));
  } else {
    fallbackCopy(txt,doToast);
  }
}
function clearTimeline(){
  if(!confirm(`Clear all ${TIMELINE.length} timeline entries? This won't affect model stats.`))return;
  TIMELINE=[];save();renderTimeline();toast('Timeline cleared');
}
