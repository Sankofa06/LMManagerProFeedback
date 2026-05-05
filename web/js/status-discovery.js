/* ── LIVE STATUS BAR ── */
// machineActivity tracks per-machine current activity
// {mid: {state:'idle'|'loading'|'generating'|'error', model:str, agent:str}}
const machineActivity={};

function setMachineActivity(mid, state, model='', agent='', progress=null){
  machineActivity[mid]={state, model:model||'', agent:agent||'', progress};
  renderLiveStatus();
}

/* ── NEW MODEL DISCOVERY ── */
const _ndData={};  // safeKey → {mid, guessedRole, guessedSize, machineOpts}

function showNewModelsPrompt(pairs){
  const modal=document.getElementById('new-models-modal');if(!modal)return;
  document.getElementById('nm-modal-title').textContent='🆕 New Models Detected';
  document.getElementById('nm-modal-sub').textContent=`${pairs.length} model${pairs.length!==1?'s':''} found in LM Studio not yet in your roster · assign a machine and add`;
  const list=document.getElementById('nm-modal-list');
  const onlineMachines=MACHINES.filter(x=>x.status==='online');

  const machineOptsFor=(mid, suggestedMcId)=>{
    // Use the machine from the pair (already per-machine), fall back to LM Link map
    const mcId=suggestedMcId||machineForLmLinkModel(mid)||(onlineMachines[0]?.id||'');
    return '<option value="">— none —</option>'+
      MACHINES.map(m=>`<option value="${m.id}"${m.id===mcId?' selected':''}>${m.icon||'🖥'} ${m.name}</option>`).join('');
  };

  list.innerHTML=pairs.map(({mid,mcId,meta},idx)=>{
    const safeKey='m'+idx;
    const shortName=mid.split('/').pop();
    // Merge: pair.meta (from lms ls --json) takes priority, live apiMeta fills gaps
    const apiMeta=(()=>{
      for(const m of onlineMachines){if(m.modelMeta?.[mid])return m.modelMeta[mid];}
      return null;
    })();
    const pMeta=meta||{};
    let guessedSize=7;
    const rawSize=pMeta.sizeBytes||apiMeta?.sizeBytes;
    if(rawSize)guessedSize=Math.round(rawSize/1073741824*100)/100;
    else{const m=shortName.match(/(\d+)b/i);if(m)guessedSize=parseFloat(m[1]);}
    const paramsHint=pMeta.paramsString||apiMeta?.paramsStr||(()=>{const m=shortName.match(/(\d+\.?\d*)[bB]/);return m?m[1]+'B':null;})();
    const archHint=pMeta.architecture||apiMeta?.architecture;
    const formatHint=pMeta.format||apiMeta?.type;
    const quantHint=pMeta.quantization||apiMeta?.quant;
    const visionHint=(pMeta.vision||apiMeta?.vision)?' · 👁':'';
    const metaHint=[paramsHint,archHint,formatHint?(formatHint+(quantHint?' '+quantHint:'')):null].filter(Boolean).join(' · ')+(visionHint);
    const guessedRole=
      /reason|think|r1|distill/i.test(shortName)?'Reasoning Model':
      /cod|coder|dev/i.test(shortName)?'Developer':
      /review/i.test(shortName)?'Code Reviewer':
      /creat|uncensor|write/i.test(shortName)?'Creative Writer':
      /arch/i.test(shortName)?'Architect':
      /analyst|phi|math/i.test(shortName)?'Analyst':'General Assistant';

    _ndData[safeKey]={mid, mcId, guessedRole, guessedSize, machineOpts:machineOptsFor(mid, mcId)};

    // Show machine name in subtitle if this is a duplicate on a second machine
    const mc=MACHINES.find(m=>m.id===mcId);
    const machineHint=mc?` · ${mc.icon||'🖥'} ${mc.name}`:'';

    return`<div id="nd-card-${safeKey}" style="border:1px solid var(--line);border-radius:8px;margin-bottom:4px">
      <button style="width:100%;text-align:left;background:var(--bg2);border:none;padding:10px 12px;cursor:pointer;display:block;border-radius:8px" onclick="ndExpand('${safeKey}')">
        <div style="font-size:12px;font-weight:600;color:var(--tx1)">${esc(shortName)}</div>
        <div style="font-size:10px;color:var(--tx3);font-family:monospace">${metaHint||esc(mid)}${machineHint} · ${guessedRole}</div>
      </button>
      <div id="nd-form-${safeKey}" style="display:none"></div>
    </div>`;
  }).join('');
  modal.style.display='flex';
}

function ndExpand(safeKey){
  const formEl=document.getElementById('nd-form-'+safeKey);if(!formEl)return;
  const arrow=document.getElementById('nd-arrow-'+safeKey);
  if(formEl.style.display!=='none'){
    formEl.style.display='none';
    if(arrow)arrow.textContent='▶';
    return;
  }
  const d=_ndData[safeKey];if(!d)return;
  const guessedPrompt=cannedPromptForRole(d.guessedRole,'NAME','MODEL');
  formEl.innerHTML=`
    <div style="padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:var(--bg);border-top:1px solid var(--line)">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px">
        <div>
          <div style="font-size:9px;color:var(--tx4);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Machine</div>
          <select class="inp" id="nd-machine-${safeKey}" style="font-size:11px;width:100%;box-sizing:border-box"><option value="">— none —</option>${d.machineOpts}</select>
        </div>
        <div>
          <div style="font-size:9px;color:var(--tx4);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Role</div>
          <select class="inp" id="nd-role-${safeKey}" onchange="onDiscoveryRoleChange('${safeKey}')" style="font-size:11px;width:100%;box-sizing:border-box">
            ${['Code Specialist','Developer','Senior Developer','Code Reviewer','Architect',
               'Reasoning Model','Analyst','Creative Writer','Tech Writer',
               'General Assistant','Baseline Model'].map(r=>
              `<option value="${r}"${r===d.guessedRole?' selected':''}>${r}</option>`
            ).join('')}
            <option value="__custom__">Custom…</option>
          </select>
        </div>
        <div>
          <div style="font-size:9px;color:var(--tx4);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em;margin-bottom:2px">Size (GB)</div>
          <input class="inp" id="nd-size-${safeKey}" type="number" value="${d.guessedSize}" min="0.1" step="0.1" style="font-size:11px;width:100%;box-sizing:border-box">
        </div>
      </div>
      <div id="nd-custom-role-wrap-${safeKey}" style="display:none">
        <input class="inp" id="nd-custom-role-${safeKey}" placeholder="e.g. Multimodal Specialist" style="font-size:11px;width:100%;box-sizing:border-box">
      </div>
      <div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <div style="font-size:9px;color:var(--tx4);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em">System Prompt</div>
          <button class="btn btn-sm" style="padding:1px 7px;font-size:9px" onclick="onDiscoveryRoleChange('${safeKey}')">↺ Reset</button>
        </div>
        <textarea class="prompt-edit-area" id="nd-prompt-${safeKey}" style="min-height:60px;max-height:120px;font-size:11px">${esc(guessedPrompt)}</textarea>
      </div>
      <button class="btn btn-primary btn-sm" onclick="addDiscoveredModel('${safeKey}')" style="align-self:flex-end">+ Add to Roster</button>
    </div>`;
  formEl.style.display='';
  if(arrow)arrow.textContent='▼';
}

/* ── CANNED PROMPTS BY ROLE ── */
const CANNED_PROMPTS={
  'Code Specialist':      (n,m)=>`You are ${n}, a large code specialist. Write complete, production-ready code. No shortcuts, no placeholders. Follow Swift 6 strict concurrency. MIKE is the Director.`,
  'Developer':            (n,m)=>`You are ${n}, a developer. Write clean, complete code — no stubs or placeholders. Handle edge cases. MIKE is the Director.`,
  'Senior Developer':     (n,m)=>`You are ${n}, a senior developer. Write clean, production-ready Swift/SwiftUI code following MVVM. Swift 6 strict concurrency. No shortcuts. MIKE is the Director.`,
  'Code Reviewer':        (n,m)=>`You are ${n}, a code reviewer. Review for correctness, Swift 6 compliance, architectural violations, and edge cases. Point out what's wrong before what's right. MIKE is the Director.`,
  'Architect':            (n,m)=>`You are ${n}, the system architect. When given a task, define the approach, identify risks, and outline implementation steps before any code is written. Be direct and opinionated. MIKE is the Director.`,
  'Reasoning Model':      (n,m)=>`You are ${n}, a reasoning model. Lead with your conclusion, then show your reasoning. Be decisive. Challenge assumptions. MIKE is the Director.`,
  'Analyst':              (n,m)=>`You are ${n}, a quantitative analyst. Work through numbers and logic step by step. Show all work. Flag assumptions. MIKE is the Director.`,
  'Creative Writer':      (n,m)=>`You are ${n}, a creative writer. Generate rich, evocative game content — era descriptions, company bios, market events, player notifications. Aviation history is your specialty. MIKE is the Director.`,
  'Tech Writer':          (n,m)=>`You are ${n}, a technical writer. Write clear, concise documentation, inline comments, and docstrings. Keep documentation developer-facing. MIKE is the Director.`,
  'General Assistant':    (n,m)=>`You are ${n}, a general-purpose assistant. Rich, well-structured answers across any domain. MIKE is the Director.`,
  'Baseline Model':       (n,m)=>`You are ${n}, a baseline comparison model. Answer directly and concisely. MIKE is the Director.`,
};

/* ── SCAN FOR NEW MODELS ── */
function normalizeModelId(id){
  // lowercase, strip common suffixes/separators for fuzzy matching
  return (id||'').toLowerCase().replace(/[-_.\s]/g,'').replace(/(gguf|mlx|q[0-9]+[a-z]?|[0-9]+bit)$/,'');
}

function scanForNewModels(){
  const onlineMachines=MACHINES.filter(m=>m.status==='online'&&m.availableModels?.length);
  if(!onlineMachines.length){toast('Check all machines first',true);return;}

  // Build {mid, mcId} pairs — one per unique model+machine combo
  // If lmLinkKeyMap is populated, use it to resolve the correct machine per model
  const hasKeyMap=APP.lmLinkKeyMap&&Object.keys(APP.lmLinkKeyMap).length>0;
  const pairs=[];
  const seen=new Set();

  if(hasKeyMap){
    // Key map path: use lms ls --json map to get all machines per model (handles duplicates)
    const allMids=new Set();
    onlineMachines.forEach(mc=>(mc.availableModels||[]).forEach(mid=>{
      if(!mid.toLowerCase().includes('embed'))allMids.add(mid);
    }));
    allMids.forEach(mid=>{
      const resolved=machinesForLmLinkModel(mid);
      if(!resolved.length){
        pairs.push({mid,mcId:onlineMachines[0]?.id||'',meta:{}});
        return;
      }
      resolved.forEach(({mcId,meta})=>{
        // Dedup on mid+machine only — format is display metadata, not identity.
        // A model appearing twice in lmLinkKeyMap with different format strings
        // (e.g. "mlx" vs "safetensors") is still the same model on the same machine.
        const key=mid+'__'+mcId;
        if(!seen.has(key)){seen.add(key);pairs.push({mid,mcId,meta});}
      });
    });
  } else {
    // No key map — assign each model to the specific machine it was found on.
    // Using a Set of all mids loses per-machine provenance, so iterate per machine instead.
    onlineMachines.forEach(mc=>{
      (mc.availableModels||[]).forEach(mid=>{
        if(mid.toLowerCase().includes('embed'))return;
        const key=mid+'__'+mc.id;
        if(!seen.has(key)){seen.add(key);pairs.push({mid,mcId:mc.id,meta:{}});}
      });
    });
  }

  // A pair is new only if no roster entry has the same model on the same machine
  const rosterPairs=new Set(ROSTER.map(r=>r.model+'__'+r.machine));
  // Also exclude if same modelKey already on a different machine AND normalised match
  // (user can opt in to duplicates — only skip exact model+machine combos)
  const genuinelyNew=pairs.filter(p=>!rosterPairs.has(p.mid+'__'+p.mcId));

  if(!genuinelyNew.length){toast('Roster is up to date — no new models found ✓');return;}
  showNewModelsPrompt(genuinelyNew);
  toast(`${genuinelyNew.length} new model${genuinelyNew.length!==1?'s':''} found — assign each to a machine before adding`);
}

function cannedPromptForRole(role, name, model){
  const fn=CANNED_PROMPTS[role];
  return fn?fn(name,model):`You are ${name}, a ${role}. MIKE is the Director.`;
}

function onDiscoveryRoleChange(b64){
  const sel=document.getElementById('nd-role-'+b64);if(!sel)return;
  const role=sel.value;
  const customWrap=document.getElementById('nd-custom-role-wrap-'+b64);
  if(customWrap)customWrap.style.display=role==='__custom__'?'block':'none';
  const ta=document.getElementById('nd-prompt-'+b64);if(!ta)return;
  const effectiveRole=role==='__custom__'?
    (document.getElementById('nd-custom-role-'+b64)?.value.trim()||'General Assistant'):role;
  ta.value=cannedPromptForRole(effectiveRole,'NAME','MODEL');
}

function addDiscoveredModel(safeKey, silent=false){
  const d=_ndData[safeKey];if(!d){toast('Card data missing',true);return;}
  const mid=d.mid;
  // Machine: DOM dropdown (if card was expanded) → per-pair mcId stored at scan time → lmLinkMap → first online
  // d.mcId is the correct per-pair machine resolved during scanForNewModels — use it, not machineForLmLinkModel()
  // which always returns results[0] and would assign the same machine to every card for the same model.
  const mcId=document.getElementById('nd-machine-'+safeKey)?.value||d.mcId||machineForLmLinkModel(d.mid)||(MACHINES.find(m=>m.status==='online')?.id||'');
  const mc=MACHINES.find(x=>x.id===mcId)||null;
  const selRole=document.getElementById('nd-role-'+safeKey)?.value||d.guessedRole;
  const role=selRole==='__custom__'?
    (document.getElementById('nd-custom-role-'+safeKey)?.value.trim()||'General Assistant'):selRole;
  const size=parseFloat(document.getElementById('nd-size-'+safeKey)?.value)||d.guessedSize;
  const apiMeta=mc?.modelMeta?.[mid]||null;
  const{first,middle}=deriveModelParts(mid,apiMeta);
  const last=role;
  const betterMiddle=apiMeta?.paramsStr?apiMeta.paramsStr.match(/^([\d.]+[BbMm])/)?.[1]?.toUpperCase()||middle:middle;
  const maxEmp=ROSTER.reduce((max,r)=>{const n=parseInt(r.empId.slice(1)||0);return n>max?n:max;},0);
  const empId='E'+(maxEmp+1).toString().padStart(2,'0');
  const color=archetypeColor(role);
  const rawPrompt=document.getElementById('nd-prompt-'+safeKey)?.value.trim()||cannedPromptForRole(role,first+(betterMiddle?' '+betterMiddle:'')+' '+last,mid);
  const finalPrompt=rawPrompt.replace(/\bNAME\b/g,first+(betterMiddle?' '+betterMiddle:'')+' '+last);
  const newModel={
    id:'m-'+Date.now()+'-'+safeKey,
    empId,model:mid,first,middle:betterMiddle||middle,last,color,role,
    temp:0.5,machine:mcId,size,torches:3,immunity:false,
    totalScore:0,episodes:0,avgTps:0,avgTtft:0,
    sessions:[],catScores:{Code:[],Reasoning:[],Creative:[],General:[]},
    prompt:finalPrompt
  };
  ROSTER.push(newModel);
  delete _ndData[safeKey];
  save();
  const card=document.getElementById('nd-card-'+safeKey);
  if(card)card.remove();
  if(!silent){
    const listEl=document.getElementById('nm-modal-list');
    if(listEl&&!listEl.children.length)closeNewModelsModal();
    toast(`${first}${betterMiddle?' '+betterMiddle:''} ${last} added as ${empId} ✓`);
    renderRoster();
    renderRosterTable();
  }
}

function addAllDiscovered(){
  const keys=Object.keys(_ndData);
  if(!keys.length){closeNewModelsModal();return;}
  const total=keys.length;
  keys.forEach(safeKey=>addDiscoveredModel(safeKey, true));
  closeNewModelsModal();
  save();
  renderRoster();
  renderRosterTable();
  postCheckPrompt();
  toast(`${total} engineer${total!==1?'s':''} added to roster ✓`);
}

function closeNewModelsModal(){
  document.getElementById('new-models-modal').style.display='none';
}

function renderLiveStatus(){
  const el=document.getElementById('live-status');if(!el)return;
  el.innerHTML=MACHINES.map(m=>{
    const act=machineActivity[m.id]||{state:'idle'};
    const dotClass=m.status==='error'?'error':m.status==='checking'?'checking':
      act.state==='generating'?'generating':act.state==='loading'?'loading':
      act.state==='processing'?'processing':m.status==='online'?'online':'';
    const pillClass=act.state==='loading'?'loading':act.state==='generating'?'generating':act.state==='processing'?'processing':'';
    const modelName=act.model||m.loadedModel||'';
    const shortModel=modelName?modelName.split('/').pop().replace(/[-_]/g,' ').slice(0,26):'no model';
    const stateLabel=act.state==='generating'?'gen':act.state==='loading'?'load':act.state==='processing'?'proc':'';
    // Progress bar width — use act.progress (0-1) when available
    const prog=act.progress!=null?Math.round(act.progress*100):null;
    const barWidth=act.state==='generating'?'60%':prog!=null?prog+'%':
      act.state==='loading'||act.state==='processing'?'100%':'0%';
    const barStyle=pillClass&&barWidth!=='0%'?`<div class="ls-bar" style="width:${barWidth}"></div>`:'';
    const stateText=prog!=null&&act.state!=='generating'?`${stateLabel} ${prog}%`:stateLabel;
    return`<div class="ls-pill ${pillClass}" onclick="setNav('machines')" title="${m.name}${modelName?' · '+modelName:''}${act.agent?' · '+act.agent:''}">
      ${barStyle}
      <div class="ls-dot ${dotClass}"></div>
      <span class="ls-icon">${m.icon}</span>
      <span class="ls-model">${esc(shortModel)}</span>
      ${stateText?`<span class="ls-state ${act.state}">${stateText}</span>`:''}
    </div>`;
  }).join('');
}

function renderLiveStatusIf(){renderLiveStatus();}

/* ── CHAT LOG PERSISTENCE ── */
// Preserve the run-log DOM across tab switches
let _chatLogHTML='';
function saveChatLog(){
  const el=document.getElementById('run-log');
  if(el)_chatLogHTML=el.innerHTML;
}
function restoreChatLog(){
  const el=document.getElementById('run-log');
  if(el&&_chatLogHTML)el.innerHTML=_chatLogHTML;
}


// ── MODEL FAMILY (architecture family, path-parsed fallback) ──
const FAMILY_MAP=[
  {key:'qwen',    label:'Qwen',    color:'#3b82f6', patterns:[/qwen/i]},
  {key:'llama',   label:'Llama',   color:'#f59e0b', patterns:[/llama/i,/meta[-_]?llama/i]},
  {key:'gemma',   label:'Gemma',   color:'#22c55e', patterns:[/gemma/i]},
  {key:'mistral', label:'Mistral', color:'#a855f7', patterns:[/mistral/i,/codestral/i,/mixtral/i]},
  {key:'phi',     label:'Phi',     color:'#06b6d4', patterns:[/\bphi[-_]?[0-9]/i]},
  {key:'deepseek',label:'DeepSeek',color:'#f43f5e', patterns:[/deepseek/i]},
  {key:'granite', label:'Granite', color:'#64748b', patterns:[/granite/i]},
  {key:'nemotron',label:'Nvidia',  color:'#76b900', patterns:[/nemotron/i,/nvidia/i]},
  {key:'google',  label:'Google',  color:'#ea4335', patterns:[/google\//i]},
  {key:'openai',  label:'OpenAI',  color:'#10a37f', patterns:[/openai\//i,/gpt[-_]/i]},
];
function modelFamily(r){
  const meta=getModelMeta(r);
  // API arch takes priority — strip trailing digits/underscores, normalize
  if(meta.arch&&typeof meta.arch==='string'){
    const base=meta.arch.replace(/[_\d]+$/,'').toLowerCase();
    const found=FAMILY_MAP.find(f=>f.patterns.some(p=>p.test(base)));
    if(found)return found.key;
    // Unknown arch string — return normalized version as its own key
    return base;
  }
  // Path fallback
  const path=(r.model||'').toLowerCase();
  for(const f of FAMILY_MAP){
    if(f.patterns.some(p=>p.test(path)))return f.key;
  }
  return 'other';
}
function getFamilyLabel(key){
  const f=FAMILY_MAP.find(x=>x.key===key);
  if(f)return f.label;
  return key.charAt(0).toUpperCase()+key.slice(1);
}
function getFamilyColor(key){
  return FAMILY_MAP.find(x=>x.key===key)?.color||'#64748b';
}

function renderFamilyFilter(){
  const el=document.getElementById('roster-family-filter');if(!el)return;
  // Collect families present in roster
  const counts={};
  ROSTER.forEach(r=>{ const k=modelFamily(r); counts[k]=(counts[k]||0)+1; });
  const keys=Object.keys(counts).sort((a,b)=>counts[b]-counts[a]);
  if(!keys.length){el.innerHTML='';return;}
  el.innerHTML=keys.map(k=>{
    const active=state.familyFilter===k;
    const color=getFamilyColor(k);
    const label=getFamilyLabel(k);
    return`<span
      onclick="toggleFamilyFilter('${k}')"
      title="${active?'Clear':'Filter by'} ${label} (${counts[k]})"
      style="font-size:9px;font-family:var(--mono);padding:2px 8px;border-radius:10px;cursor:pointer;transition:all .15s;user-select:none;white-space:nowrap;
        border:1px solid ${active?color:color+'44'};
        background:${active?color:color+'10'};
        color:${active?'#fff':color};
        ${active?'box-shadow:0 0 8px '+color+'44':''}"
    >${label}${active?' ✕':''}</span>`;
  }).join('');
}
function toggleFamilyFilter(key){
  state.familyFilter=state.familyFilter===key?null:key;
  renderFamilyFilter();
  renderRoster();
  renderRosterTable();
}

function renderArchetypeLegend(){
  const el=document.getElementById('archetype-legend');if(!el)return;
  el.innerHTML=Object.entries(ARCHETYPES).map(([k,a])=>{
    const active=state.archetypeFilter===k;
    const count=ROSTER.filter(r=>archetypeForRoster(r)===k).length;
    return`<span
      onclick="toggleArchetypeFilter('${k}')"
      title="${active?'Clear filter':'Filter by '+a.label} (${count} models)"
      style="font-size:9px;font-family:var(--mono);padding:2px 8px;border-radius:10px;cursor:pointer;transition:all .15s;user-select:none;white-space:nowrap;
        border:1px solid ${active?a.color:a.color+'44'};
        background:${active?a.color:''+a.color+'10'};
        color:${active?'#fff':a.color};
        ${active?'box-shadow:0 0 8px '+a.color+'44':''}"
    >${a.icon} ${a.label}${active?' ✕':''}</span>`;
  }).join('');
  // update roster count in section bar
  const af=state.archetypeFilter;
  const visible=af?ROSTER.filter(r=>archetypeForRoster(r)===af).length:ROSTER.filter(r=>r.torches>0).length;
  const countEl=document.getElementById('roster-count');
  if(countEl)countEl.textContent=af?`${visible} ${ARCHETYPES[af].label} models`:`${visible} active`;
  renderFamilyFilter();
}

function toggleArchetypeFilter(key){
  state.archetypeFilter=state.archetypeFilter===key?null:key;
  renderArchetypeLegend();
  renderRoster();
  renderRosterTable();
  // clear detail panel if selected model no longer visible
  if(state.selRoster){
    const r=ROSTER.find(x=>x.id===state.selRoster);
    if(r&&state.archetypeFilter&&archetypeForRoster(r)!==state.archetypeFilter){
      state.selRoster=null;
      const detail=document.getElementById('roster-detail');
      if(detail)detail.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--tx3);font-size:12px;font-family:var(--mono)">Select a model</div>';
    }
  }
}


