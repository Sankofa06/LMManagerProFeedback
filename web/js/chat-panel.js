/* ── CHAT PANEL ── */
function gsVal(id,fallback){const el=document.getElementById(id);return el?el.value:fallback;}
function gsChecked(id,fallback){const el=document.getElementById(id);return el?el.checked:fallback;}
// All settings read from APP (persisted), DOM inputs are just the UI surface
function getSettings(){
  return{
    maxRounds:  parseInt(gsVal('gs-max-rounds', APP.maxRounds))||APP.maxRounds||1,
    maxTokens:  parseInt(gsVal('gs-max-tokens', APP.maxTokens))||APP.maxTokens||8192,
    historyDepth: gsVal('gs-history', APP.historyDepth)||APP.historyDepth||'all',
    pauseSec:   parseFloat(gsVal('gs-pause', APP.pauseBetweenAgentsSec))||APP.pauseBetweenAgentsSec||0,
    skipFired:  gsChecked('gs-skip-fired', APP.skipVotedOff??true),
    crossTalk:  gsChecked('gs-crosstalk', APP.crossTalk??true),
  };
}
/* ── SCORING SETTINGS UI ── */
const SCORE_PRESETS={
  balanced: [
    {id:'tps',weight:30},{id:'ttft',weight:20},{id:'think',weight:20},{id:'density',weight:15},{id:'quality',weight:15}
  ],
  speed: [
    {id:'tps',weight:50},{id:'ttft',weight:30},{id:'think',weight:10},{id:'density',weight:5},{id:'quality',weight:5}
  ],
  quality: [
    {id:'tps',weight:10},{id:'ttft',weight:10},{id:'think',weight:10},{id:'density',weight:30},{id:'quality',weight:40}
  ],
  reasoning: [
    {id:'tps',weight:15},{id:'ttft',weight:10},{id:'think',weight:5},{id:'density',weight:30},{id:'quality',weight:40}
    // think weight 5% = almost ignored (reasoning tasks should think)
  ],
};

function setScorePreset(name){
  const preset=SCORE_PRESETS[name];if(!preset)return;
  const sigs=getScoreSignals();
  preset.forEach(({id,weight})=>{
    const s=sigs.find(x=>x.id===id);if(s)s.weight=weight;
  });
  APP.scoreSignals=sigs;saveApp();
  renderScoreSignals();
  toast(`Preset "${name}" applied ✓`);
}

function renderScoreSignals(){
  const el=document.getElementById('score-signals-list');if(!el)return;
  const sigs=getScoreSignals();
  const total=sigs.reduce((a,s)=>a+s.weight,0);
  const totalEl=document.getElementById('score-weight-total');
  if(totalEl){
    totalEl.textContent=total+'%';
    totalEl.style.color=total===100?'var(--accent)':total>100?'var(--red)':'var(--amber)';
  }

  el.innerHTML=sigs.map((sig,si)=>{
    const stars='★'.repeat(5).split('').map((s,i)=>`<span style="color:${i<3?'var(--amber)':'var(--line2)'};font-size:10px">${s}</span>`).join('');
    const thresholdRows=sig.tiers.map((t,ti)=>`
      <div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid var(--line)">
        <span style="font-size:11px;color:var(--amber);width:40px;flex-shrink:0">${'★'.repeat(ti+1)}</span>
        <span style="font-size:9px;color:var(--tx3);font-family:var(--mono);flex:1;min-width:0">${t.label}</span>
        <input type="number" value="${t.min}" step="${sig.id==='tps'?5:sig.id==='ttft'?0.5:sig.id==='think'?50:0.5}"
          style="width:64px;font-size:11px;padding:3px 5px;background:var(--bg);border:1px solid var(--line2);border-radius:4px;color:var(--tx1);font-family:var(--mono)"
          onchange="updateSignalTier(${si},${ti},parseFloat(this.value)||0)">
      </div>`).join('');

    return`<div style="border:1px solid var(--line);border-radius:7px;overflow:hidden;margin-bottom:8px">
      <div style="padding:9px 12px;background:var(--bg2);display:flex;align-items:center;gap:10px">
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;color:var(--tx1)">${sig.label}</div>
          <div style="font-size:9px;color:var(--tx4);font-family:var(--mono)">${sig.direction==='lower'?'lower = better':'higher = better'} · ${sig.unit}</div>
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:10px;color:var(--tx3);font-family:var(--mono)">weight</span>
          <input type="number" value="${sig.weight}" min="0" max="100" step="5"
            style="width:52px;font-size:12px;padding:4px 6px;background:var(--bg);border:1px solid var(--line2);border-radius:4px;color:var(--tx1);font-family:var(--mono);font-weight:700;text-align:right"
            onchange="updateSignalWeight(${si},parseInt(this.value)||0)">
          <span style="font-size:11px;color:var(--tx3);font-family:var(--mono)">%</span>
        </div>
        <button class="btn btn-sm" style="font-size:9px;padding:2px 6px;flex-shrink:0"
          onclick="toggleSignalThresholds('thresh-${sig.id}',this)">Thresholds</button>
      </div>
      <div id="thresh-${sig.id}" style="display:none;padding:8px 12px">
        <div style="font-size:9px;color:var(--tx4);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">
          ★ thresholds — minimum value to earn each star rating
        </div>
        ${thresholdRows}
      </div>
    </div>`;
  }).join('');
}

function updateSignalWeight(sigIdx, newWeight){
  const sigs=getScoreSignals();
  if(sigIdx<0||sigIdx>=sigs.length)return;
  sigs[sigIdx].weight=Math.max(0,Math.min(100,newWeight));
  APP.scoreSignals=sigs;saveApp();
  // Update total indicator only — don't re-render the whole list (would lose focus)
  const total=sigs.reduce((a,s)=>a+s.weight,0);
  const totalEl=document.getElementById('score-weight-total');
  if(totalEl){
    totalEl.textContent=total+'%';
    totalEl.style.color=total===100?'var(--accent)':total>100?'var(--red)':'var(--amber)';
  }
}

function updateSignalTier(sigIdx, tierIdx, value){
  const sigs=getScoreSignals();
  if(!sigs[sigIdx]?.tiers[tierIdx])return;
  sigs[sigIdx].tiers[tierIdx].min=value;
  // Auto-update label to match new value
  const sig=sigs[sigIdx];
  const t=sig.tiers[tierIdx];
  if(sig.direction==='higher')t.label=`≥${value}${sig.unit!=='heuristic'?' '+sig.unit:''}`;
  else t.label=`<${value}${sig.unit!=='heuristic'?' '+sig.unit:''}`;
  APP.scoreSignals=sigs;saveApp();
}

function toggleSignalThresholds(id, btn){
  const el=document.getElementById(id);if(!el)return;
  const open=el.style.display!=='none';
  el.style.display=open?'none':'block';
  if(btn)btn.textContent=open?'Thresholds':'✕ Close';
}

function toggleScoringRef(){
  const el=document.getElementById('scoring-ref');if(!el)return;
  const open=el.style.display!=='none';
  el.style.display=open?'none':'block';
  const btn=el.previousElementSibling;
  if(btn)btn.textContent=open?'ℹ How scoring works':'✕ Close reference';
}

function getTimeout(){
  const v=parseInt(document.getElementById('sp-timeout')?.value)||APP.requestTimeoutSec||180;
  return v*1000;
}
function getSpWeight(id, appKey){
  const el=document.getElementById(id);
  if(el&&el.value)return parseFloat(el.value)||0;
  return APP[appKey]??0;
}

function renderRunPanel(){
  const sel=document.getElementById('run-team-select');if(!sel)return;
  sel.innerHTML=`<option value="">${TEAMS.length?'Select team…':'No teams yet — build roster first'}</option>`;
  TEAMS.forEach(t=>{const o=document.createElement('option');o.value=t.id;o.textContent=`${t.icon} ${t.name}`;if(state.runTeam?.id===t.id)o.selected=true;sel.appendChild(o);});
  if(state.runTeam)buildTurnQueue(state.runTeam);
  setChatMode(chat.mode);
  // v8.1: sync crosstalk button visibility with compareMode (matters after episode runs that toggle it)
  const ct=document.getElementById('crosstalk-toggle-btn');
  if(ct)ct.style.display=state.compareMode?'none':'';
  const cb=document.getElementById('compare-toggle-btn');
  if(cb)cb.classList.toggle('active',state.compareMode);
  // v8.3: keep solo picker in sync when navigating to chat tab
  if(soloState.audience==='solo'){ populateSoloModelSelect(); renderSoloLog(); }
}

function selectRunTeam(id){
  state.runTeam=TEAMS.find(t=>t.id===id)||null;
  if(state.runTeam)buildTurnQueue(state.runTeam);
  else{const bar=document.getElementById('turn-order-bar');if(bar)bar.style.display='none';}
  // v8.3: refresh solo model picker if it's open and scoped to team
  if(soloState.audience==='solo' && soloState.scope==='team') populateSoloModelSelect();
}

function setChatMode(mode){
  chat.mode=mode;
  const ab=document.getElementById('mode-auto-btn'),mb=document.getElementById('mode-manual-btn');
  if(ab){ab.className=mode==='auto'?'active-auto':'';} 
  if(mb){mb.className=mode==='manual'?'active-manual':'';}
  const p=document.getElementById('run-prompt');
  if(p)p.placeholder=mode==='auto'?'Message — all agents respond in turn order…':'Message — then click an agent to fire them…';
}

function toggleGroupSettings(){
  const el=document.getElementById('group-settings');if(!el)return;
  el.style.display=el.style.display==='none'||!el.style.display?'flex':'none';
}

function buildTurnQueue(team){
  chat.turnQueue=team.members.map(id=>ROSTER.find(r=>r.id===id)).filter(r=>r&&(!gsChecked('gs-skip-fired',true)||r.torches>0));
  chat.currentTurn=0;renderTurnChips();
  const bar=document.getElementById('turn-order-bar');if(bar)bar.style.display='flex';
}

function renderTurnChips(){
  const chips=document.getElementById('turn-chips');if(!chips)return;chips.innerHTML='';
  chat.turnQueue.forEach((r,i)=>{
    const h=rclr(r),isCur=i===chat.currentTurn&&chat.mode==='manual';
    const chip=document.createElement('span');
    chip.id=`chip-${r.id}`;chip.className='chip';
    chip.style.cssText=`border-color:${isCur?h:h+'44'};color:${h};background:${isCur?h+'22':'transparent'}`;
    chip.textContent=`${dispId(r)} ${r.first}`;
    chip.title=`${dispName(r)} · ${r.role} · ${machineLabel(r.machine)}`;
    chip.onclick=()=>{if(chat.mode==='manual'&&!chat.isRunning){chat.currentTurn=i;renderTurnChips();fireAgent(r);}};
    chips.appendChild(chip);
  });
  const rc=document.getElementById('round-counter');if(rc&&chat.round>0)rc.textContent=`Round ${chat.round}`;
}

function highlightChip(rid,active){
  const chip=document.getElementById(`chip-${rid}`);if(!chip)return;
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const h=rclr(r);
  chip.style.borderColor=active?h:h+'44';chip.style.background=active?h+'22':'transparent';
  chip.style.boxShadow=active?`0 0 8px ${h}55`:'none';
}

function handleChatKey(e){if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChatOrSolo();}}
function autoGrow(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,120)+'px';}

/* ── FALLBACK: OpenAI-compat /v1/chat/completions ──────────────────────────
   Used when /api/v1/chat returns 400. Same interface as streamV1Chat.
   ──────────────────────────────────────────────────────────────────────── */
async function streamChatCompletions(mcUrl, model, messages, opts={}, callbacks={}){
  const {temperature=0.5, maxTokens=4096} = opts;
  const {onDelta, onPhase} = callbacks;

  // OpenAI compat: system goes in messages array as-is, no type field needed
  const apiMessages=messages.map(m=>({role:m.role, content:m.content||''}));

  const resp=await lmStudioFetch(`${mcUrl}/v1/chat/completions`,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify({model, messages:apiMessages, temperature, max_tokens:maxTokens,
      stream:true, stream_options:{include_usage:true}})
  },{timeoutMs:getTimeout(),signal:opts.signal});
  if(!resp.ok){const e=await resp.text().catch(()=>'');throw new Error(`HTTP ${resp.status}: ${e.slice(0,200)}`);}

  onPhase?.('generating', 0);
  const reader=resp.body.getReader(), dec=new TextDecoder();
  let buf='', text='', reasoning_text='', ttft=null, ttft0=Date.now();
  let inputTokens=0, outputTokens=0, reasoningTokens=0;
  let thinkOpen=false;

  while(true){
    const{done,value}=await reader.read(); if(done)break;
    buf+=dec.decode(value,{stream:true});
    const lines=buf.split('\n'); buf=lines.pop();
    for(const line of lines){
      if(!line.startsWith('data: '))continue;
      const d=line.slice(6).trim(); if(d==='[DONE]')break;
      try{
        const j=JSON.parse(d);
        const delta=j.choices?.[0]?.delta?.content||'';
        const thinkDelta=j.choices?.[0]?.delta?.reasoning_content||'';
        if((delta||thinkDelta)&&!ttft)ttft=((Date.now()-ttft0)/1000).toFixed(2);
        if(thinkDelta){if(!thinkOpen){reasoning_text+='';thinkOpen=true;}reasoning_text+=thinkDelta;}
        if(delta){thinkOpen=false;text+=delta;}
        onDelta?.(text, reasoning_text);
        if(j.usage){inputTokens=j.usage.prompt_tokens||0;outputTokens=j.usage.completion_tokens||0;
          reasoningTokens=j.usage.completion_tokens_details?.reasoning_tokens||0;}
      }catch{}
    }
  }
  return{text, reasoning:reasoning_text, ttft, tps:null, inputTokens, outputTokens, reasoningTokens, loadTimeSec:null, responseId:null, endpoint:'completions'};
}

async function sendChatMessage(){
  const input=document.getElementById('run-prompt');
  const text=input?.value.trim();if(!text)return;
  if(!state.runTeam){toast('Select a team first',true);return;}
  if(chat.isRunning){toast('Already running',true);return;}
  if(!chat.turnQueue.length)buildTurnQueue(state.runTeam);
  const director=APP.directorName||'The operator';
  input.value='';input.style.height='auto';
  chat.history.push({role:'user',content:text,name:director});
  addChatBubble(director,'Director','#f59e0b',text,true);
  if(chat.mode==='auto')await runAutoRound();
}

async function runAutoRound(){
  const s=getSettings();chat.isRunning=true;chat.stopRequested=false;chat.round=0;setRunControls(true);
  for(let round=0;round<s.maxRounds;round++){
    if(chat.stopRequested)break;chat.round=round+1;renderTurnChips();
    for(let i=0;i<chat.turnQueue.length;i++){
      if(chat.stopRequested)break;chat.currentTurn=i;renderTurnChips();
      await fireAgent(chat.turnQueue[i]);
      if(s.pauseSec>0)await sleep(s.pauseSec*1000);
    }
    if(!chat.stopRequested){state.epCount++;updateEpBadge();}
  }
  chat.isRunning=false;setRunControls(false);
  document.getElementById('run-status-text').textContent=`Done · ${chat.round} round(s) · ep ${state.epCount}`;
  save();renderSurvivorIf();
}

function stopChat(){chat.stopRequested=true;if(chat.currentAbort)chat.currentAbort.abort();document.getElementById('run-status-text').textContent='Stopping…';}

async function fireAgent(r){
  const mc=MACHINES.find(x=>x.id===r.machine);
  if(!mc||mc.status!=='online'){addSysMsg(`${dispId(r)} ${r.first}: offline — skipped`);return;}
  const s=getSettings(),logId=`log-${r.id}-${Date.now()}`,t0=Date.now();
  highlightChip(r.id,true);
  document.getElementById('run-status-text').textContent=`${dispId(r)} ${r.first}…`;
  setMachineActivity(mc.id,'loading',r.model,dispName(r));
  addLogEntry(r,'loading','⟳ Loading…',logId);

  const depth=s.historyDepth;
  let histSlice=chat.history;
  if(depth!=='all'&&parseInt(depth)>0)histSlice=chat.history.slice(-parseInt(depth));
  else if(depth==='0')histSlice=chat.history.filter(m=>m.role==='user').slice(-1);
  const filteredHist=s.crossTalk?histSlice:histSlice.filter(m=>m.role==='user');
  // /api/v1/chat uses {role, content} objects in input array
  const sysMsg={type:'message',role:'system',content:r.prompt};
  const histMsgs=filteredHist.map(m=>({type:'message',role:m.role==='user'?'user':'assistant',content:m.name?`${m.name}: ${m.content}`:m.content}));
  const messages=[sysMsg,...histMsgs];
  const userPrompt=filteredHist.filter(m=>m.role==='user').slice(-1)[0]?.content||'';

  let text='', reasoning='', ttft=null, inputTokens=0, outputTokens=0, reasoningTokens=0;
  let result=null; // v8.5: hoist out of try{} so post-stream code can read result.tps/endpoint
  try{
    chat.currentAbort=new AbortController();
    result=await streamV1Chat(mc.url, r.model, messages,
      {temperature:r.temp??APP.defaultTemp??0.5, maxTokens:s.maxTokens,
       reasoning:APP.thinkingEnabled?'on':null, signal:chat.currentAbort.signal},
      {
        onPhase(phase, progress){
          if(phase==='loading'){
            setMachineActivity(mc.id,'loading',r.model,dispName(r),progress);
            const pct=Math.round(progress*100);
            updateLogEntry(logId,'loading',pct<100?`⟳ Loading… ${pct}%`:'⟳ Processing…');
          } else if(phase==='processing'){
            setMachineActivity(mc.id,'processing',r.model,dispName(r),progress);
            const pct=Math.round(progress*100);
            updateLogEntry(logId,'loading',`⟳ Processing… ${pct}%`);
          } else if(phase==='generating'){
            setMachineActivity(mc.id,'generating',r.model,dispName(r),null);
            document.getElementById('run-status-text').textContent=`${dispId(r)} ${r.first} generating…`;
          }
        },
        onDelta(t, rz){
          text=t; reasoning=rz;
          const _sp=splitThinking(reasoning?`<think>${reasoning}</think>${t}`:t);
          const _disp=_sp.streaming?`🧠 Thinking… (${_sp.thinking.split(/\s+/).filter(Boolean).length} words)`:_sp.thinking&&!_sp.answer?`🧠 Thinking… (${_sp.thinking.split(/\s+/).filter(Boolean).length} words)`:_sp.answer||t;
          updateLogEntry(logId,'loading',_disp);
        }
      }
    );
    text=result.text; reasoning=result.reasoning;
    ttft=result.ttft;
    inputTokens=result.inputTokens; outputTokens=result.outputTokens; reasoningTokens=result.reasoningTokens;
    mc.loadedModel=r.model; // loadedInstanceId managed by checkMachine/loadModel only
    updateRowLoadedState(r.id,true,mc);
    const lel=document.getElementById('mc-loaded-'+mc.id);if(lel)lel.textContent='⬤ '+r.model;
  }catch(e){updateLogEntry(logId,'error','Error: '+e.message);highlightChip(r.id,false);setMachineActivity(mc.id,'idle');chat.currentAbort=null;return;}
  chat.currentAbort=null;

  // v8.5: restore post-generation unload (was in v8_3, removed in v8_4)
  try{
    await lmStudioFetch(`${mc.url}/api/v1/models/unload`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({instance_id:mc.loadedInstanceId||r.model})},{timeoutSec:15});
    mc.loadedModel=null;mc.loadedInstanceId=null;
    updateRowLoadedState(r.id,false,mc);
    const _lel=document.getElementById('mc-loaded-'+mc.id);if(_lel)_lel.textContent='No model loaded';
  }catch{}
  setMachineActivity(mc.id,'idle',null,null);
  const elapsed=((Date.now()-t0)/1000).toFixed(1);
  const tokens=outputTokens>0?outputTokens:Math.round(text.length/4);
  const tokenSrc=outputTokens>0?'real':'est';
  const genSec=parseFloat(elapsed)-(parseFloat(ttft)||0);
  const tps=result?.tps||(genSec>0&&isFinite(tokens/genSec)?(tokens/genSec).toFixed(1):'—');
  // Combine reasoning into text using <think> tags for downstream processing
  const fullText=reasoning?`<think>${reasoning}</think>${text}`:text;
  const autoQ=autoScore(fullText,tps,ttft,reasoningTokens,tokens);
  if(fullText){
    if(!r.sessions)r.sessions=[];
    const sess={date:new Date().toISOString(),team:state.runTeam?.name||'—',ttft:ttft||'—',tps,tokens,promptTokens:inputTokens,tokenSrc,elapsed,quality:null,autoQ,thinkTokens:reasoningTokens,taskType:classifyPrompt(userPrompt),logId,prompt:userPrompt.slice(0,2000),response:fullText};
    r.sessions.push(sess);
    rebuildCatScores(r);
    const scored=r.sessions.filter(x=>x.autoQ!=null);
    r.totalScore=scored.reduce((a,x)=>a+(x.quality!=null?combinedScore(x.autoQ,x.quality):x.autoQ),0);r.episodes=scored.length;
    const _vTps=r.sessions.map(s=>parseFloat(s.tps)).filter(t=>isFinite(t)&&t>0);
    r.avgTps=_vTps.length?_vTps.reduce((a,b)=>a+b,0)/_vTps.length:0;
    const _vTtft=r.sessions.map(s=>parseFloat(s.ttft)).filter(t=>isFinite(t)&&t>0);
    r.avgTtft=_vTtft.length?_vTtft.reduce((a,b)=>a+b,0)/_vTtft.length:0;
    chat.history.push({role:'assistant',content:fullText,name:`${dispName(r)}`});
    TIMELINE.push({id:'tl-'+Date.now()+'-'+r.id,date:sess.date,modelId:r.id,modelName:`${dispName(r)}`,empId:r.empId,color:r.color,role:r.role,machine:r.machine,prompt:sess.prompt,response:fullText,tps,ttft:ttft||'—',tokens,elapsed,quality:autoQ,taskType:null,team:sess.team,logId});
    state.sessionTracker.runs++;
    state.sessionTracker.tokens+=tokens+inputTokens;
    state.sessionTracker.timeMs+=Date.now()-t0;
    if(r.size>state.sessionTracker.peakVram)state.sessionTracker.peakVram=r.size;
    updateSessionTracker();
  }
  finalizeLog(logId,r,fullText,autoQ,ttft||'—',elapsed,tps,tokens,tokenSrc,result?.endpoint||'');
  highlightChip(r.id,false);
  if(chat.mode==='manual'){chat.currentTurn=(chat.currentTurn+1)%chat.turnQueue.length;renderTurnChips();}
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
function setRunControls(running){const rb=document.getElementById('run-btn'),sb=document.getElementById('stop-btn');if(rb)rb.disabled=running;if(sb)sb.style.display=running?'block':'none';}
