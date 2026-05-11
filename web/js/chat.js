/* ── MODEL INFO POPOVER ── */
function showModelInfoPopover(rid, anchorEl){
  // Remove any existing
  document.getElementById('model-info-popover')?.remove();
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const mc=MACHINES.find(x=>x.id===r.machine);
  const meta=getModelMeta(r);

  const rows=[];
  const row=(label,val)=>val?`<div style="display:flex;gap:8px;padding:3px 0;border-bottom:1px solid var(--line)">
    <span style="font-size:10px;color:var(--tx4);font-family:var(--mono);width:90px;flex-shrink:0">${label}</span>
    <span style="font-size:10px;color:var(--tx1);font-family:var(--mono)">${val}</span></div>`:'';

  rows.push(row('Type', meta.type||'unknown'));
  rows.push(row('Quant', meta.quant||'—'));
  rows.push(row('Params', meta.paramsLabel||r.middle||'—'));
  rows.push(row('Architecture', meta.arch||'—'));
  rows.push(row('Context', meta.ctxLabel||'—'));
  rows.push(row('File size', meta.fileSizeGB?meta.fileSizeGB+'GB (from API)':'—'));
  rows.push(row('Listed size', r.size+'GB (user-entered)'));
  rows.push(row('Publisher', meta.publisher||'—'));
  rows.push(row('Machine', `${mc?.icon||''} ${mc?.name||r.machine} (${mc?.platform||'?'})`));
  rows.push(row('Vision', meta.vision?'Yes':'No'));
  rows.push(row('Tool calling', meta.functionCalling?'Yes':'No'));

  // Machine mismatch: check if model is found on a different machine than r.machine
  let mismatchWarning='';
  for(const m of MACHINES){
    if(m.id!==r.machine&&m.availableModels?.includes(r.model)){
      const assignedMc=MACHINES.find(x=>x.id===r.machine);
      mismatchWarning=`<div style="margin-bottom:8px;padding:6px 8px;border-radius:5px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);font-size:10px;color:#f59e0b;font-family:var(--mono)">⚠ Found on ${m.icon} ${m.name} — assigned to ${assignedMc?.icon||''} ${assignedMc?.name||r.machine}. Edit roster to fix.</div>`;
      break;
    }
  }

  const pop=document.createElement('div');
  pop.id='model-info-popover';
  pop.style.cssText='position:fixed;z-index:900;background:var(--bg1);border:1px solid var(--line2);border-radius:8px;padding:10px 12px;min-width:240px;box-shadow:0 4px 20px rgba(0,0,0,.3)';
  pop.innerHTML=`
    <div style="font-size:11px;font-weight:700;color:var(--tx1);margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid var(--line)">${dispName(r)}</div>
    ${mismatchWarning}
    ${rows.join('')}
    <div style="font-size:9px;color:var(--tx4);font-family:var(--mono);margin-top:6px">${meta.arch||meta.type?'Live data from LM Studio':'Path-parsed · run Check All for full data'}</div>`;
  document.body.appendChild(pop);

  // Position relative to anchor
  const rect=anchorEl.getBoundingClientRect();
  const pw=242, ph=300;
  let left=rect.left, top=rect.bottom+4;
  if(left+pw>window.innerWidth)left=window.innerWidth-pw-8;
  if(top+ph>window.innerHeight)top=rect.top-ph-4;
  pop.style.left=Math.max(4,left)+'px';
  pop.style.top=Math.max(4,top)+'px';

  // Close on outside click
  setTimeout(()=>document.addEventListener('click',()=>pop.remove(),{once:true}),50);
}

function fmtParams(p){
  if(!p)return null;
  if(p<1)return Math.round(p*1000)+'M';
  return(p%1===0?p:p.toFixed(1))+'B';
}

/* ── SHARED V1 CHAT STREAMING ──────────────────────────────────────────────
   Uses /api/v1/chat with native SSE events. Returns a promise resolving to:
   { text, reasoning, ttft, tps, inputTokens, outputTokens, reasoningTokens,
     loadTimeSec, responseId }
   Callbacks:
     onDelta(text, reasoning)  — called on each content/reasoning chunk
     onPhase(phase, progress)  — 'loading'|'processing'|'generating', 0-1
   ──────────────────────────────────────────────────────────────────────── */
async function streamV1Chat(mcUrl, model, messages, opts={}, callbacks={}){
  const {temperature=0.5, maxTokens=4096, reasoning=null, contextLength=null} = opts;
  const {onDelta, onPhase} = callbacks;

  // /api/v1/chat: system prompt goes in top-level system_prompt field,
  // not in the input array. Extract it and pass user/assistant messages only.
  const sysMsg=messages.find(m=>m.role==='system');
  const input=messages
    .filter(m=>m.role!=='system')
    .map(m=>({type:'message', role:m.role, content:m.content||''}));

  // Guard: v1 endpoint needs at least one user message in input
  if(!input.length)throw new Error('No user messages to send');

  const body={model, input, stream:true, temperature, max_output_tokens:maxTokens};
  if(sysMsg?.content)body.system_prompt=sysMsg.content;
  if(reasoning&&reasoning!=='auto')body.reasoning=reasoning;
  if(contextLength)body.context_length=contextLength;

  let resp=await lmStudioFetch(`${mcUrl}/api/v1/chat`,{
    method:'POST', headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)
  },{timeoutSec:APP.requestTimeoutSec||180,signal:opts.signal});

  // If v1 endpoint rejects, fall back to OpenAI-compat /v1/chat/completions
  if(!resp.ok){
    const errText=await resp.text().catch(()=>'');
    console.warn(`[LMMP Web] /api/v1/chat ${resp.status}: ${errText} — falling back to /v1/chat/completions`);
    // Track consecutive fallbacks — if it keeps happening, warn the user once
    streamV1Chat._fallbacks=(streamV1Chat._fallbacks||0)+1;
    if(streamV1Chat._fallbacks===1){
      toast(`⚠ v1 chat endpoint rejected (${resp.status}) — using fallback. Check console for details.`,true);
    }
    const result=await streamChatCompletions(mcUrl, model, messages, opts, callbacks);
    result.endpoint='completions';
    return result;
  }
  streamV1Chat._fallbacks=0; // reset on success

  const reader=resp.body.getReader(), dec=new TextDecoder();
  let buf='', text='', reasoning_text='', ttft=null, ttft0=Date.now();
  let inputTokens=0, outputTokens=0, reasoningTokens=0, loadTimeSec=null, responseId=null;
  let currentPhase=null;

  while(true){
    const{done,value}=await reader.read(); if(done)break;
    buf+=dec.decode(value,{stream:true});
    const lines=buf.split('\n'); buf=lines.pop();
    for(const line of lines){
      if(line.startsWith('event: ')){currentPhase=line.slice(7).trim();continue;}
      if(!line.startsWith('data: '))continue;
      const raw=line.slice(6).trim(); if(!raw)continue;
      let ev; try{ev=JSON.parse(raw);}catch{continue;}

      switch(ev.type||currentPhase){
        case 'model_load.progress':
          onPhase?.('loading', ev.progress??0); break;
        case 'model_load.end':
          loadTimeSec=ev.load_time_seconds??null;
          onPhase?.('loading', 1); break;
        case 'prompt_processing.progress':
          onPhase?.('processing', ev.progress??0); break;
        case 'prompt_processing.end':
          onPhase?.('processing', 1); break;
        case 'reasoning.delta':
          if(!ttft)ttft=((Date.now()-ttft0)/1000).toFixed(2);
          reasoning_text+=ev.content||'';
          onDelta?.(text, reasoning_text); break;
        case 'message.start':
          onPhase?.('generating', 0); break;
        case 'message.delta':
          if(!ttft)ttft=((Date.now()-ttft0)/1000).toFixed(2);
          text+=ev.content||'';
          onDelta?.(text, reasoning_text); break;
        case 'chat.end':
          const s=ev.result?.stats||{};
          inputTokens=s.input_tokens||0;
          outputTokens=s.total_output_tokens||0;
          reasoningTokens=s.reasoning_output_tokens||0;
          if(!loadTimeSec&&s.model_load_time_seconds)loadTimeSec=s.model_load_time_seconds;
          responseId=ev.result?.response_id||null;
          // tps from stats is more accurate than our manual calc
          if(s.tokens_per_second)opts._apiTps=s.tokens_per_second.toFixed(1);
          if(s.time_to_first_token_seconds&&!ttft)ttft=s.time_to_first_token_seconds.toFixed(2);
          break;
      }
    }
  }
  const tps=opts._apiTps||null;
  return{text, reasoning:reasoning_text, ttft, tps, inputTokens, outputTokens, reasoningTokens, loadTimeSec, responseId, endpoint:'v1'};
}
// Product presets — what you're building
const IV_PRODUCT_PRESETS={
  sample:`Sample Project is an internal multi-agent tooling platform built with TypeScript and a service-oriented architecture across web, mobile, and CLI clients.`,
  ios_app:`[App name] is an iOS and macOS app available on the App Store. [Describe what it does and who it's for in 1–2 sentences.]`,
  blank:``,
};

// Stack presets — tech environment
const IV_STACK_PRESETS={
  swift_mvvm:`Built in Swift 6 and SwiftUI using MVVM architecture, targeting iOS and macOS. The codebase follows strict concurrency rules and actor isolation.`,
  react_ts:`Built with React and TypeScript, using a component-based architecture. The stack includes [add your backend/tooling here].`,
  python:`Built in Python. [Describe your framework, e.g. FastAPI, Django, Flask, and any key libraries.]`,
  node:`Built with Node.js and Express. [Describe your frontend and database stack here.]`,
  flutter:`Built with Flutter and Dart, targeting iOS and Android from a single codebase.`,
  unity:`Built in Unity using C#. [Describe your target platform and genre.]`,
  blank:``,
};

const IV_DEFAULT_POSTAMBLE=`Please introduce yourself — tell me your strengths, what kind of tasks you excel at, where you struggle, and why you'd be a good fit for this team.`;

// Auto-generate team description from live roster
function buildIvTeamLine(){
  const active=ROSTER.filter(r=>r.torches>0);
  if(!active.length)return'';
  // Check if all are unhired with no specialization
  const allUnhiredNoSpec=active.every(r=>(!r.statusId||r.statusId==='unhired')&&!r.specializationId);
  if(allUnhiredNoSpec)return`Our team of ${active.length} is assembled and being evaluated for their roles.`;
  // Count by specialization
  const specCounts={};
  active.forEach(r=>{
    const specId=r.specializationId||archetypeFor(r.role||'');
    if(specId&&specId!=='generalist')specCounts[specId]=(specCounts[specId]||0)+1;
  });
  const specEntries=Object.entries(specCounts).sort((a,b)=>b[1]-a[1]);
  if(!specEntries.length)return`Our team of ${active.length} is a mix of generalists.`;
  if(active.length<=8){
    // Rich: list by status+spec groups
    const groups={};
    active.forEach(r=>{
      const statusId=r.statusId||r.proficiencyId||'';
      const specId=r.specializationId||archetypeFor(r.role||'')||'generalist';
      const st=STATUS_LEVELS.find(s=>s.id===statusId);
      const sp=SPECIALIZATIONS.find(s=>s.id===specId);
      const key=(st&&st.id!=='unhired'?st.label+' ':'')+( sp?sp.label:'Generalist');
      groups[key]=(groups[key]||0)+1;
    });
    const parts=Object.entries(groups).sort((a,b)=>b[1]-a[1]).map(([k,n])=>n>1?`${n} ${k}s`:`${n} ${k}`);
    const list=parts.length>1?parts.slice(0,-1).join(', ')+' and '+parts.slice(-1):parts[0];
    return`Our development team includes ${list}.`;
  } else {
    // Condensed: just specialization names
    const specNames=specEntries.map(([id])=>SPECIALIZATIONS.find(s=>s.id===id)?.label||id);
    const unique=[...new Set(specNames)];
    const listed=unique.length>2?unique.slice(0,-1).join(', ')+', and '+unique.slice(-1):unique.join(' and ');
    return`Our development team of ${active.length} includes ${listed}s, each filling a distinct role in the project.`;
  }
}

function buildInterviewPrompt(){
  const dir=APP.directorName||'The operator';
  const appName=APP.brandName||'LM Manager Pro Web';
  const parts=[];
  parts.push(`Hello, I'm ${dir}, Director of ${appName}.`);
  // Product
  const productPreset=APP.ivProductPreset||'blank';
  const product=productPreset==='custom'?(APP.ivCustomProduct||'').trim():(IV_PRODUCT_PRESETS[productPreset]||'').trim();
  if(product)parts.push(product);
  // Stack
  const stackPreset=APP.ivStackPreset||'blank';
  const stackBase=stackPreset==='custom'?(APP.ivCustomStack||'').trim():(IV_STACK_PRESETS[stackPreset]||'').trim();
  const stackExtra=(APP.ivStackExtra||'').trim();
  const stack=[stackBase,stackExtra].filter(Boolean).join(' ');
  if(stack)parts.push(stack);
  // Team (auto-generated, with manual override)
  const teamOverride=(APP.ivTeamOverride||'').trim();
  const teamAuto=buildIvTeamLine();
  const team=teamOverride||teamAuto;
  if(team)parts.push(team);
  // Ask
  const ask=(APP.ivPostamble||IV_DEFAULT_POSTAMBLE).trim();
  if(ask)parts.push(ask);
  return parts.join('\n\n');
}

function getDefaultInterviewPrompt(){ return buildInterviewPrompt(); }
const DEFAULT_INTERVIEW_PROMPT=getDefaultInterviewPrompt();
let interviewPrompt=localStorage.getItem('lmmp_v5_iv_prompt')||DEFAULT_INTERVIEW_PROMPT;

const DEFAULT_CRITERIA=[
  {id:'cr1',name:'Creativity'},
  {id:'cr2',name:'Accuracy'},
  {id:'cr3',name:'Efficiency'},
  {id:'cr4',name:'Reasoning'},
  {id:'cr5',name:'Crisp'},
];
let CRITERIA=loadJson('lmmp_v5_criteria', DEFAULT_CRITERIA);
function saveCriteria(){saveJson('lmmp_v5_criteria',CRITERIA);}

function save(){saveJson('lmmp_v5_roster',ROSTER);saveJson('lmmp_v5_teams',TEAMS);localStorage.setItem('lmmp_v5_ep',String(state.epCount));saveJson('lmmp_v5_presets',PRESETS);saveJson('lmmp_v5_timeline',TIMELINE.slice(-500));saveJson('lmmp_v7_archived',(state.archivedChats||[]).slice(-50));saveMachines();}
function saveInterviewPrompt(text){interviewPrompt=text;localStorage.setItem('lmmp_v5_iv_prompt',text);}
