/* ── V5: HOOK INTO sendChatMessage TO SUPPORT COMPARE ── */
const _originalSendChatMessage=sendChatMessage;
sendChatMessage=async function(){
  const input=document.getElementById('run-prompt');
  const text=input?.value.trim();if(!text)return;
  if(!state.runTeam){toast('Select a team first',true);return;}
  if(chat.isRunning){toast('Already running',true);return;}
  if(!chat.turnQueue.length)buildTurnQueue(state.runTeam);
  if(state.compareMode){
    const director=APP.directorName||'The operator';
    input.value='';input.style.height='auto';
    chat.history.push({role:'user',content:text,name:director});
    await runCompare(text);
    return;
  }
  return _originalSendChatMessage();
};

/* ── V5.2: INTERVIEW ── */
const interviewHistory = {};   // rid → [{role, content, meta?}]
const interviewRunning = {};   // rid → bool

function ivKeydown(e, rid){
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); sendInterview(rid); }
}

function renderInterviewHistory(rid){
  const r=ROSTER.find(x=>x.id===rid); if(!r) return;
  const h=rclr(r);
  const msgs=document.getElementById('iv-messages-'+rid); if(!msgs) return;
  const empty=document.getElementById('iv-empty-'+rid);
  const hist=interviewHistory[rid]||[];
  if(!hist.length){ if(empty) empty.style.display='flex'; return; }
  if(empty) empty.style.display='none';
  // clear and re-render all (called on model switch; streaming updates in-place)
  msgs.innerHTML='';
  hist.forEach(m=>{ if(m.role!=='system') msgs.appendChild(buildIvBubble(m,r,h)); });
  msgs.scrollTop=msgs.scrollHeight;
}

function buildIvBubble(m, r, h){
  const wrap=document.createElement('div');
  if(m.role==='user'){
    wrap.className='iv-msg user';
    wrap.innerHTML=`
      <div class="iv-avatar" style="background:var(--blue);color:#fff">YOU</div>
      <div>
        <div class="iv-bubble">${esc(m.content)}</div>
      </div>`;
  } else {
    wrap.className='iv-msg agent';
    wrap.id=m.bubbleId||'';
    const scored=m.quality!=null;
    wrap.innerHTML=`
      <div class="iv-avatar" style="background:${h}18;color:${h};border:1px solid ${h}33">${avatarContent(r)}</div>
      <div style="min-width:0;flex:1">
        <div class="iv-bubble">${(()=>{const _sp=splitThinking(m.content||'');return _sp.thinking?thinkingBubbleHTML(_sp.thinking,_sp.answer,r.first):'<div class="md-body">'+renderMarkdown(m.content||'')+'</div>';})()}</div>
        ${m.meta?`<div class="iv-meta">${m.meta}</div>`:''}
        ${m.logId?`<div class="iv-actions">
          <button class="score-btn" id="scorebtn-${m.logId}" onclick="openScoreSheet('${r.id}','${m.logId}')">Score</button>
          <button class="btn btn-sm" style="font-size:9px;padding:2px 7px" onclick="copyIvResponse(this,'${m.logId}')">⎘ Copy</button>
          <span class="score-wrap" style="position:relative">
            <span style="font-size:9px;color:var(--tx3);font-family:var(--mono)" id="${m.logId}-sv">auto:${m.autoQ??'?'}/10</span>
            <span class="score-info-btn" title="Expand breakdown" onclick="toggleBreakdown('${m.logId}-bd')">ⓘ</span>
            <div id="${m.logId}-bd" style="display:none;position:absolute;bottom:calc(100% + 6px);left:0;background:var(--bg1);border:1px solid var(--line2);border-radius:8px;padding:8px 10px;min-width:240px;z-index:100;box-shadow:var(--shadow)">
              ${(m.breakdown||[]).map(s=>typeof s==='object'?`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px"><span style="font-size:9px;color:var(--tx3);font-family:var(--mono);flex:1">${esc(s.label)}</span><div style="width:50px;height:3px;background:var(--line2);border-radius:2px"><div style="height:100%;width:${s.max>0?Math.max(0,s.score/s.max)*100:0}%;background:${s.score>=0?'var(--accent)':'var(--red)'};border-radius:2px"></div></div><span style="font-size:10px;font-family:var(--mono);color:var(--tx1);width:28px;text-align:right">${s.score}</span></div>`:`<div style="font-size:9px;color:var(--tx3);font-family:var(--mono)">${esc(String(s))}</div>`).join('')}
              <div style="border-top:1px solid var(--line);margin-top:4px;padding-top:4px;font-size:10px;font-family:var(--mono);color:var(--tx2);font-weight:700">Total: ${m.autoQ??'?'}/10</div>
            </div>
          </span>
        </div>`:''}
      </div>`;
  }
  return wrap;
}

async function sendInterview(rid, overrideText){
  if(interviewRunning[rid]) return;
  const r=ROSTER.find(x=>x.id===rid); if(!r) return;
  const inp=document.getElementById('iv-input-'+rid);
  // v8: when called from episode runner, overrideText is the prompt; the iv-input-* element
  // may not exist (roster detail not open for this model). Fall back gracefully.
  const text=(overrideText!=null?overrideText:(inp?.value||'')).trim();
  if(!text) return;
  const mc=MACHINES.find(x=>x.id===r.machine);
  if(!mc||mc.status!=='online'){ toast(`${r.first} machine offline`,true); return; }

  // init history with system prompt on first message
  if(!interviewHistory[rid]) interviewHistory[rid]=[];
  if(!interviewHistory[rid].length){
    interviewHistory[rid].push({role:'system', content:r.prompt});
    // v8.19: interviewPrompt is silent context only — do NOT push as a user message here.
    // It was causing two user messages to fire on the first manual send (seed + typed message).
    // If the episode runner needs to fire the global prompt as a turn, it calls sendInterview(rid, promptText) directly.
  }

  // clear input (only if it exists — episode runner calls without UI)
  if(inp){ inp.value=''; inp.style.height='auto'; }

  // disable send, show live badge
  interviewRunning[rid]=true;
  const sendBtn=document.getElementById('iv-send-'+rid);
  if(sendBtn) sendBtn.disabled=true;
  const badge=document.getElementById('iv-badge-'+rid);
  if(badge){ badge.textContent='loading…'; badge.classList.add('live'); }

  // push user message
  const userMsg={role:'user', content:text};
  interviewHistory[rid].push(userMsg);
  const empty=document.getElementById('iv-empty-'+rid);
  if(empty) empty.style.display='none';
  const msgs=document.getElementById('iv-messages-'+rid);
  if(msgs){
    msgs.appendChild(buildIvBubble(userMsg,r,rclr(r)));
    msgs.scrollTop=msgs.scrollHeight;
  }

  const t0=Date.now();
  const logId='iv-'+r.id+'-'+Date.now();

  // add streaming bubble
  setMachineActivity(mc.id,'generating',r.model,dispName(r));
  if(badge) badge.textContent='loading…';
  const bubbleId='iv-bubble-'+logId;
  const streamWrap=document.createElement('div');
  streamWrap.className='iv-msg agent'; streamWrap.id=bubbleId;
  const h=rclr(r);
  streamWrap.innerHTML=`
    <div class="iv-avatar" style="background:${h}18;color:${h};border:1px solid ${h}33">${avatarContent(r)}</div>
    <div><div class="iv-bubble"><div class="iv-thinking"><span></span><span></span><span></span></div></div></div>`;
  if(msgs){ msgs.appendChild(streamWrap); msgs.scrollTop=msgs.scrollHeight; }

  // generate via v1 native endpoint
  const s=getSettings();
  const apiMessages=interviewHistory[rid].map(m=>({role:m.role,content:m.content}));
  let text2='', reasoning2='', ttft=null, realComp=0, realPrompt=0, thinkTokens=0;
  let result=null; // v8.5: hoist out of try{} so post-stream code can read result.tps
  try{
    result=await streamV1Chat(mc.url, r.model, apiMessages,
      {temperature:r.temp??APP.defaultTemp??0.5, maxTokens:s.maxTokens,
       reasoning:APP.thinkingEnabled?'on':null},
      {
        onPhase(phase){
          if(phase==='loading')badge&&(badge.textContent='loading…');
          else if(phase==='generating')badge&&(badge.textContent='generating…');
        },
        onDelta(t, rz){
          text2=t; reasoning2=rz;
          const combined=rz?`<think>${rz}</think>${t}`:t;
          const sb=document.getElementById(bubbleId);
          if(sb){ const bbl=sb.querySelector('.iv-bubble'); if(bbl){const _sp=splitThinking(combined);bbl.textContent=_sp.streaming||(_sp.thinking&&!_sp.answer)?`🧠 Thinking… (${_sp.thinking.split(/\s+/).filter(Boolean).length} words)`:_sp.answer||t;}}
        }
      }
    );
    text2=result.text; reasoning2=result.reasoning;
    ttft=result.ttft; realComp=result.outputTokens; realPrompt=result.inputTokens; thinkTokens=result.reasoningTokens;
    mc.loadedModel=r.model; // loadedInstanceId managed by checkMachine/loadModel only
  } catch(e){
    const sb=document.getElementById(bubbleId);
    if(sb){ const bbl=sb.querySelector('.iv-bubble'); if(bbl) bbl.textContent='Error: '+e.message; }
  }

  // v8.5: restore post-generation unload
  try{
    await fetch(`${mc.url}/api/v1/models/unload`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({instance_id:mc.loadedInstanceId||r.model}),signal:AbortSignal.timeout(15000)});
    mc.loadedModel=null;mc.loadedInstanceId=null;
    updateRowLoadedState(r.id,false,mc);
    const _lel=document.getElementById('mc-loaded-'+mc.id);if(_lel)_lel.textContent='No model loaded';
  }catch{}
  const fullText2=reasoning2?`<think>${reasoning2}</think>${text2}`:text2;

  // finalize
  const elapsed=((Date.now()-t0)/1000).toFixed(1);
  const tokens=realComp>0?realComp:Math.round(text2.length/4);
  const tokenSrc=realComp>0?'real':'est';
  const genSec=parseFloat(elapsed)-(parseFloat(ttft)||0);
  const tps=result?.tps||(genSec>0&&isFinite(tokens/genSec)?(tokens/genSec).toFixed(1):'—');
  const autoQ=autoScore(fullText2,tps,ttft,thinkTokens,tokens);
  const bd=autoScoreBreakdown(fullText2,tps,ttft,thinkTokens,tokens);
  const score=autoQ;
  const meta=`TTFT ${ttft||'—'}s · ${tps} t/s · ${tokenSrc==='real'?tokens:'~'+tokens}t · ${elapsed}s`;

  if(fullText2){
    const agentMsg={role:'assistant', content:fullText2, meta, quality:score, autoQ, breakdown:bd.signals, logId, bubbleId};
    interviewHistory[rid].push(agentMsg);
    const sb=document.getElementById(bubbleId);
    if(sb){
      const newBubble=buildIvBubble(agentMsg,r,h);
      sb.replaceWith(newBubble);
      if(msgs) msgs.scrollTop=msgs.scrollHeight;
    }
    if(!r.sessions) r.sessions=[];
    const sess={date:new Date().toISOString(),team:'interview',ttft:ttft||'—',tps,tokens,promptTokens:realPrompt,tokenSrc,elapsed,quality:null,autoQ,thinkTokens,taskType:classifyPrompt(text),logId,prompt:text.slice(0,2000),response:fullText2};
    r.sessions.push(sess);
    rebuildCatScores(r);
    const scored=r.sessions.filter(x=>x.autoQ!=null);
    r.totalScore=scored.reduce((a,x)=>a+(x.quality!=null?combinedScore(x.autoQ,x.quality):x.autoQ),0); r.episodes=scored.length;
    const _vTps=r.sessions.map(s=>parseFloat(s.tps)).filter(t=>isFinite(t)&&t>0);
    r.avgTps=_vTps.length?_vTps.reduce((a,b)=>a+b,0)/_vTps.length:0;
    const _vTtft=r.sessions.map(s=>parseFloat(s.ttft)).filter(t=>isFinite(t)&&t>0);
    r.avgTtft=_vTtft.length?_vTtft.reduce((a,b)=>a+b,0)/_vTtft.length:0;
    TIMELINE.push({id:'tl-'+Date.now()+'-'+r.id,date:sess.date,modelId:r.id,modelName:`${dispName(r)}`,empId:r.empId,color:r.color,role:r.role,machine:r.machine,prompt:sess.prompt,response:fullText2,tps,ttft:ttft||'—',tokens,elapsed,quality:score,taskType:null,team:'interview',logId});
    state.sessionTracker.runs++;
    state.sessionTracker.tokens+=tokens+realPrompt;
    state.sessionTracker.timeMs+=Date.now()-t0;
    if(r.size>state.sessionTracker.peakVram) state.sessionTracker.peakVram=r.size;
    updateSessionTracker();
    refreshDetailStats(r.id);
    save();
    renderSurvivorIf();
  }

  setMachineActivity(mc.id,'idle',null,null);
  if(badge){ badge.textContent=`${tps} t/s · ${tokenSrc==='real'?tokens:'~'+tokens}t`; badge.classList.remove('live'); }
  interviewRunning[rid]=false;
  if(sendBtn) sendBtn.disabled=false;
  if(inp) inp.focus();
}

function refreshDetailStats(rid){
  const r=ROSTER.find(x=>x.id===rid); if(!r) return;
  const a=rosterAggregate(r);
  // update simple kv cards
  const set=(key,val)=>{const el=document.getElementById(`kv-${rid}-${key}`);if(el)el.textContent=val;};
  set('episodes', String(r.episodes));
  set('final-score', a.finalScore!=null?a.finalScore+'/10':'—');
  set('avg-tps', r.avgTps>0?r.avgTps.toFixed(1)+' t/s':'—');
  // update breakdown panel
  const bd=document.getElementById(`kv-${rid}-breakdown`);
  if(bd){
    const auto=a.autoAvg!=null?`<span style="color:var(--tx2)">Auto: <strong style="color:var(--tx1)">${a.autoAvg.toFixed(1)}/10</strong> (${a.autoCount} runs · 20%)</span>`:`<span>Auto: pending</span>`;
    const iv=a.ivAvg!=null?`<span style="color:var(--tx2)">Interview: <strong style="color:var(--tx1)">${a.ivAvg.toFixed(1)}/10</strong> (${a.ivCount} · 30%)</span>`:`<span style="color:var(--amber)">Interview: pending</span>`;
    const tm=a.teamAvg!=null?`<span style="color:var(--tx2)">Team: <strong style="color:var(--tx1)">${a.teamAvg.toFixed(1)}/10</strong> (${a.teamCount} · 50%)</span>`:`<span style="color:var(--amber)">Team contribution pending</span>`;
    bd.innerHTML=auto+'<br>'+iv+'<br>'+tm;
  }
  // refresh roster eval card too if visible
  renderRosterEvalCard(rid);
}

function clearInterview(rid){
  delete interviewHistory[rid];
  const msgs=document.getElementById('iv-messages-'+rid);
  const empty=document.getElementById('iv-empty-'+rid);
  const r=ROSTER.find(x=>x.id===rid);
  if(msgs) msgs.innerHTML='';
  if(empty){ empty.style.display='flex'; }
  if(msgs&&empty) msgs.appendChild(empty);
  const badge=document.getElementById('iv-badge-'+rid);
  if(badge){ badge.textContent='load · respond · unload'; badge.classList.remove('live'); }
  toast('Interview cleared');
}

/* ── V8.3: 1:1 SOLO CHAT ──
 * Mirrors interview load/respond/unload but does NOT touch:
 *   - r.sessions, r.totalScore, r.episodes, r.avgTps, r.avgTtft  (no scoring)
 *   - TIMELINE  (no run-history surfacing)
 *   - state.sessionTracker  (no session counter pollution)
 * Persists per-model history under lmmp_v82_oneonone so conversations survive refresh.
 */
const ONEONONE = (function(){
  try{ return JSON.parse(localStorage.getItem('lmmp_v82_oneonone')||'{}'); }catch{ return {}; }
})();
const oneononeRunning = {}; // rid → bool (in-flight)
const soloState = {
  audience: 'group',  // 'group' | 'solo'
  scope: 'team',      // 'team' | 'global'
  modelId: null       // selected rid in solo mode
};

function saveOneonone(){ try{ localStorage.setItem('lmmp_v82_oneonone', JSON.stringify(ONEONONE)); }catch{} }

// switch between Group chat and 1:1 Solo
function setAudience(mode){
  soloState.audience = mode;
  document.getElementById('aud-group-btn').classList.toggle('active', mode==='group');
  document.getElementById('aud-solo-btn').classList.toggle('active', mode==='solo');
  const soloBar = document.getElementById('solo-bar');
  const runLog  = document.getElementById('run-log');
  const soloLog = document.getElementById('solo-log');
  const modePill= document.getElementById('mode-pill-wrap');
  const cmpBtn  = document.getElementById('compare-toggle-btn');
  const ctxBtn  = document.getElementById('crosstalk-toggle-btn');
  const tobBar  = document.getElementById('turn-order-bar');
  const utilStrip=document.getElementById('chat-util-strip');

  if(mode==='solo'){
    if(soloBar) soloBar.classList.add('active');
    if(runLog) runLog.style.display='none';
    if(soloLog) soloLog.classList.add('active');
    // Disable group-only controls
    [modePill, cmpBtn, ctxBtn].forEach(el=>{ if(el){ el.style.opacity='.4'; el.style.pointerEvents='none'; }});
    // Hide turn-order and util strip in solo mode
    if(tobBar){ tobBar.dataset.preSolo = tobBar.style.display||''; tobBar.style.display='none'; }
    if(utilStrip) utilStrip.style.display='none';
    populateSoloModelSelect();
    renderSoloLog();
  } else {
    if(soloBar) soloBar.classList.remove('active');
    if(runLog) runLog.style.display='';
    if(soloLog) soloLog.classList.remove('active');
    [modePill, cmpBtn, ctxBtn].forEach(el=>{ if(el){ el.style.opacity=''; el.style.pointerEvents=''; }});
    if(tobBar) tobBar.style.display = tobBar.dataset.preSolo||'';
    if(utilStrip) utilStrip.style.display='';
  }
}

function setSoloScope(scope){
  soloState.scope = scope;
  document.querySelectorAll('#solo-scope button').forEach(b=>b.classList.remove('active'));
  const btns = document.querySelectorAll('#solo-scope button');
  if(scope==='team' && btns[0]) btns[0].classList.add('active');
  if(scope==='global' && btns[1]) btns[1].classList.add('active');
  populateSoloModelSelect();
}

function populateSoloModelSelect(){
  const sel = document.getElementById('solo-model-select'); if(!sel) return;
  let pool = [];
  if(soloState.scope==='team' && state.runTeam){
    pool = (state.runTeam.members||[]).map(id=>ROSTER.find(r=>r.id===id)).filter(Boolean);
  } else {
    pool = ROSTER.slice();
  }
  // sort by first name
  pool.sort((a,b)=> (a.first||'').localeCompare(b.first||''));
  sel.innerHTML = '<option value="">'+(pool.length?'Select a model…':(soloState.scope==='team'?'No team selected — switch to Global':'No models in roster'))+'</option>';
  pool.forEach(r=>{
    const opt = document.createElement('option');
    opt.value = r.id;
    const machine = MACHINES.find(m=>m.id===r.machine);
    const status = machine && machine.status==='online' ? '' : ' (offline)';
    opt.textContent = `${dispName(r)} · ${r.role||'—'}${status}`;
    if(soloState.modelId===r.id) opt.selected = true;
    sel.appendChild(opt);
  });
  // If our previously-selected model isn't in this scope anymore, clear it
  if(soloState.modelId && !pool.find(r=>r.id===soloState.modelId)){
    soloState.modelId = null;
    renderSoloLog();
  }
}

function selectSoloModel(rid){
  soloState.modelId = rid || null;
  renderSoloLog();
  const inp = document.getElementById('run-prompt');
  if(inp && rid) inp.focus();
}

function renderSoloLog(){
  const log = document.getElementById('solo-log'); if(!log) return;
  log.innerHTML='';
  if(!soloState.modelId){
    log.classList.add('empty');
    return;
  }
  log.classList.remove('empty');
  const r = ROSTER.find(x=>x.id===soloState.modelId);
  if(!r){ log.classList.add('empty'); return; }
  const h = rclr(r);
  const hist = ONEONONE[soloState.modelId]||[];
  if(!hist.length){ log.classList.add('empty'); return; }
  hist.forEach(m=>{ if(m.role!=='system') log.appendChild(buildSoloBubble(m, r, h)); });
  log.scrollTop = log.scrollHeight;
}

function buildSoloBubble(m, r, h){
  const wrap=document.createElement('div');
  if(m.role==='user'){
    wrap.className='solo-msg user';
    wrap.innerHTML=`
      <div class="s-avatar" style="background:var(--blue);color:#fff">YOU</div>
      <div><div class="s-bubble">${esc(m.content)}</div></div>`;
  } else {
    wrap.className='solo-msg agent';
    if(m.bubbleId) wrap.id = m.bubbleId;
    const sp = splitThinking(m.content||'');
    const inner = sp.thinking
      ? thinkingBubbleHTML(sp.thinking, sp.answer, r.first)
      : '<div class="md-body">'+renderMarkdown(m.content||'')+'</div>';
    wrap.innerHTML=`
      <div class="s-avatar" style="background:${h}18;color:${h};border:1px solid ${h}33">${avatarContent(r)}</div>
      <div style="min-width:0;flex:1">
        <div class="s-bubble">${inner}</div>
        ${m.meta?`<div class="s-meta">${m.meta}</div>`:''}
      </div>`;
  }
  return wrap;
}

function clearSoloLog(){
  if(!soloState.modelId){ toast('No model selected',true); return; }
  delete ONEONONE[soloState.modelId];
  saveOneonone();
  renderSoloLog();
  toast('1:1 conversation cleared');
}

// Routing wrapper for the chat input Send button
function sendChatOrSolo(){
  if(soloState.audience==='solo'){ sendSoloMessage(); }
  else { sendChatMessage(); }
}

// "Clear" button in chat topbar — clears whichever log is active
function clearActiveLog(){
  if(soloState.audience==='solo'){ clearSoloLog(); }
  else { clearRunLog(); }
}

async function sendSoloMessage(){
  const rid = soloState.modelId;
  if(!rid){ toast('Pick a model first',true); return; }
  if(oneononeRunning[rid]) return;
  const r = ROSTER.find(x=>x.id===rid); if(!r) return;
  const inp = document.getElementById('run-prompt');
  const text = (inp?.value||'').trim();
  if(!text) return;
  const mc = MACHINES.find(x=>x.id===r.machine);
  if(!mc || mc.status!=='online'){ toast(`${r.first} machine offline`,true); return; }

  // Init / extend per-model history
  if(!ONEONONE[rid]) ONEONONE[rid]=[];
  if(!ONEONONE[rid].length){
    // seed with persona system prompt so 1:1 has the same character as group/interview
    ONEONONE[rid].push({role:'system', content:r.prompt||''});
  }

  // clear input, push user message
  inp.value=''; inp.style.height='auto';
  const userMsg = {role:'user', content:text};
  ONEONONE[rid].push(userMsg);
  saveOneonone();

  const log = document.getElementById('solo-log');
  log.classList.remove('empty');
  log.appendChild(buildSoloBubble(userMsg, r, rclr(r)));
  log.scrollTop = log.scrollHeight;

  oneononeRunning[rid] = true;
  const runBtn = document.getElementById('run-btn');
  if(runBtn) runBtn.disabled = true;
  const statusEl = document.getElementById('run-status-text');
  if(statusEl) statusEl.textContent = `${r.first} · loading…`;

  // streaming bubble
  const bubbleId = 'solo-bubble-'+Date.now();
  const streamWrap = document.createElement('div');
  streamWrap.className='solo-msg agent'; streamWrap.id=bubbleId;
  const h = rclr(r);
  streamWrap.innerHTML = `
    <div class="s-avatar" style="background:${h}18;color:${h};border:1px solid ${h}33">${avatarContent(r)}</div>
    <div style="min-width:0;flex:1"><div class="s-bubble"><div class="iv-thinking"><span></span><span></span><span></span></div></div></div>`;
  log.appendChild(streamWrap); log.scrollTop = log.scrollHeight;

  const t0 = Date.now();
  const s = getSettings();
  const apiMessages = ONEONONE[rid].map(m=>({role:m.role, content:m.content}));
  let text2='', reasoning2='', ttft=null, realComp=0, realPrompt=0, thinkTokens=0;
  let result=null; // v8.5: hoist out of try{} so post-stream code can read result.tps
  try{
    result=await streamV1Chat(mc.url, r.model, apiMessages,
      {temperature:r.temp??APP.defaultTemp??0.5, maxTokens:s.maxTokens,
       reasoning:APP.thinkingEnabled?'on':null},
      {
        onPhase(phase,progress){
          if(statusEl){
            if(phase==='loading')statusEl.textContent=`${r.first} · loading${progress<1?' '+Math.round(progress*100)+'%':'…'}`;
            else if(phase==='processing')statusEl.textContent=`${r.first} · processing…`;
            else if(phase==='generating')statusEl.textContent=`${r.first} · generating…`;
          }
        },
        onDelta(t,rz){
          text2=t;reasoning2=rz;
          const combined=rz?`<think>${rz}</think>${t}`:t;
          const sb=document.getElementById(bubbleId);
          if(sb){ const bbl=sb.querySelector('.s-bubble'); if(bbl){const _sp=splitThinking(combined);bbl.textContent=_sp.streaming||(_sp.thinking&&!_sp.answer)?`🧠 Thinking… (${_sp.thinking.split(/\s+/).filter(Boolean).length} words)`:_sp.answer||t;}}
        }
      }
    );
    text2=result.text;reasoning2=result.reasoning;
    ttft=result.ttft;realComp=result.outputTokens;realPrompt=result.inputTokens;thinkTokens=result.reasoningTokens;
    mc.loadedModel=r.model; // loadedInstanceId managed by checkMachine/loadModel only
  } catch(e){
    const sb=document.getElementById(bubbleId);
    if(sb){ const bbl=sb.querySelector('.s-bubble'); if(bbl) bbl.textContent='Error: '+e.message; }
  }

  // v8.6: add missing unload (solo chat was skipped in v8.5 restore)
  try{
    await fetch(`${mc.url}/api/v1/models/unload`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({instance_id:mc.loadedInstanceId||r.model}),signal:AbortSignal.timeout(15000)});
    mc.loadedModel=null;mc.loadedInstanceId=null;
    updateRowLoadedState(r.id,false,mc);
    const _lel=document.getElementById('mc-loaded-'+mc.id);if(_lel)_lel.textContent='No model loaded';
  }catch{}

  const fullText2=reasoning2?`<think>${reasoning2}</think>${text2}`:text2;
  const elapsed=((Date.now()-t0)/1000).toFixed(1);
  const tokens=realComp>0?realComp:Math.round(text2.length/4);
  const tokenSrc=realComp>0?'real':'est';
  const tps=result?.tps||((parseFloat(elapsed)-(parseFloat(ttft)||0))>0&&isFinite(tokens/(parseFloat(elapsed)-(parseFloat(ttft)||0)))?(tokens/(parseFloat(elapsed)-(parseFloat(ttft)||0))).toFixed(1):'—');
  const meta=`TTFT ${ttft||'—'}s · ${tps} t/s · ${tokenSrc==='real'?tokens:'~'+tokens}t · ${elapsed}s · off record`;

  if(fullText2){
    const agentMsg={role:'assistant', content:fullText2, meta, bubbleId};
    ONEONONE[rid].push(agentMsg);
    saveOneonone();
    const sb=document.getElementById(bubbleId);
    if(sb){ sb.replaceWith(buildSoloBubble(agentMsg, r, h)); log.scrollTop = log.scrollHeight; }
  }

  setMachineActivity(mc.id,'idle',null,null);
  if(statusEl) statusEl.textContent = text2?`${tps} t/s · ${tokens}t`:'Idle';
  oneononeRunning[rid]=false;
  if(runBtn) runBtn.disabled=false;
  if(inp) inp.focus();
}

// ── V8.3: Overflow menu (mobile chat topbar) ──
function toggleChatOverflow(ev){
  if(ev) ev.stopPropagation();
  const m = document.getElementById('chat-overflow-menu'); if(!m) return;
  m.classList.toggle('open');
  // position the menu just under the trigger
  const btn = document.getElementById('chat-overflow-btn');
  if(btn && m.classList.contains('open')){
    const rect = btn.getBoundingClientRect();
    m.style.top = (rect.bottom + 4) + 'px';
    m.style.right = (window.innerWidth - rect.right) + 'px';
    m.style.position = 'fixed';
    // sync the context label
    const cb = document.getElementById('gs-crosstalk');
    const omc = document.getElementById('om-context-btn');
    if(cb && omc) omc.textContent = '👁 Context: '+(cb.checked?'ON':'OFF');
  }
}
function closeChatOverflow(){
  const m = document.getElementById('chat-overflow-menu');
  if(m) m.classList.remove('open');
}
// v8.3: roster overflow menu
function toggleRosterOverflow(ev){
  if(ev) ev.stopPropagation();
  const m = document.getElementById('roster-overflow-menu'); if(!m) return;
  m.classList.toggle('open');
  const btn = ev?.currentTarget || document.querySelector('.roster-overflow-btn');
  if(btn && m.classList.contains('open')){
    const rect = btn.getBoundingClientRect();
    m.style.top = (rect.bottom + 4) + 'px';
    m.style.right = (window.innerWidth - rect.right) + 'px';
    m.style.position = 'fixed';
  }
}
function closeRosterOverflow(){
  const m = document.getElementById('roster-overflow-menu');
  if(m) m.classList.remove('open');
}
// click outside to close (handles both chat and roster overflow menus)
document.addEventListener('click', e=>{
  ['chat-overflow-menu','roster-overflow-menu'].forEach(menuId=>{
    const m = document.getElementById(menuId);
    if(!m || !m.classList.contains('open')) return;
    // find the corresponding trigger
    const triggerSel = menuId==='chat-overflow-menu'
      ? '#chat-overflow-btn'
      : '.roster-overflow-btn';
    const b = document.querySelector(triggerSel);
    if(m.contains(e.target) || (b && b.contains(e.target))) return;
    m.classList.remove('open');
  });
});

function editField(label, id, value, type='text'){
  return `<div>
    <div style="font-size:9px;color:var(--tx4);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px">${label}</div>
    <input class="inp" id="${id}" type="${type}" value="${esc(String(value))}"
      style="font-size:11px;padding:5px 8px;width:100%;box-sizing:border-box"
      ${type==='number'?'step="0.01" min="0"':''}>
  </div>`;
}

function saveRosterEdit(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const get=id=>document.getElementById(id);
  const first=get(`re-first-${rid}`)?.value.trim();
  const middle=get(`re-middle-${rid}`)?.value.trim()||'';
  const nickname=get(`re-nick-${rid}`)?.value.trim()||'';
  const empId=get(`re-empid-${rid}`)?.value.trim();
  const statusId=get(`re-prof-${rid}`)?.value||'';
  const specId=get(`re-spec-${rid}`)?.value||'';
  const secondaryIds=r.secondaryIds||[];
  const roleFromDropdowns=buildRoleString(statusId,specId,secondaryIds);
  const role=roleFromDropdowns||get(`re-role-${rid}`)?.value.trim()||r.role;
  const last=get(`re-last-${rid}`)?.value.trim()||role;
  const model=get(`re-model-${rid}`)?.value.trim();
  const size=parseFloat(get(`re-size-${rid}`)?.value)||r.size;
  if(!first||!empId||!model){toast('First name, ID and Model ID required',true);return;}
  r.first=first; r.middle=middle; r.last=last; r.nickname=nickname;
  r.empId=empId; r.role=role; r.model=model; r.size=size;
  r.statusId=statusId; r.proficiencyId=statusId; // keep proficiencyId for compat
  r.specializationId=specId;
  // secondaryIds already mutated in-place by toggleReSecondary
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  r.color=specColor(specId,statusId||'senior',dark);
  if(!r.promptOverridden) r.prompt=generatePrompt(r);
  save();
  renderRoster();
  renderRosterDetail(r);
  toast(`${dispName(r)} saved ✓`);
}
