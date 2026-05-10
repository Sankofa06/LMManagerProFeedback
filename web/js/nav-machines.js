/* ── GROUP CHAT STATE ── */
const chat={mode:'auto',history:[],turnQueue:[],currentTurn:0,round:0,isRunning:false,stopRequested:false};

/* ── NAV ── */
function setNav(id){
  // Save chat log before leaving chat tab
  if(state.nav==='run')saveChatLog();
  state.nav=id;
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  const nb=document.getElementById('nav-'+id);if(nb)nb.classList.add('active');
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.getElementById('panel-'+id).classList.add('active');
  if(id==='machines')renderMachines();
  if(id==='roster')renderRoster();
  if(id==='teams')renderTeams();
  if(id==='episodes')renderEpisodes();
  if(id==='run'){renderRunPanel();restoreChatLog();}
  if(id==='survivor')renderSurvivor();
  if(id==='timeline')renderTimeline();
  if(id==='settings'){updateSettingsPanel();renderCustomRolesList();renderLmLinkSection();}
}
function setBnActive(id){
  document.querySelectorAll('.bn-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

/* ── MACHINES ── */
function renderMachines(){renderRosterTable();renderMachineBadges();}

function toggleMachineCollapse(id){
  if(state.collapsedMachines.has(id))state.collapsedMachines.delete(id);
  else state.collapsedMachines.add(id);
  renderMachines();
}

// v8.5: renderMachineNodes() removed — mc-nodes-bar element no longer exists in HTML.
// Machine section headers are now rendered by renderRosterTable() directly.

function openModelEmojiPickerMachine(mcId){
  const mc=MACHINES.find(x=>x.id===mcId);if(!mc)return;
  openEmojiPicker(`${mc.name} Icon`, MACHINE_EMOJIS, mc.icon, (e)=>{
    mc.icon=e; saveMachines(); renderMachines(); renderLiveStatus(); openMachineModal();
  });
}

function openMachineColorPicker(mcId){
  const mc=MACHINES.find(x=>x.id===mcId);if(!mc)return;
  const colors=['#a855f7','#3b82f6','#ef4444','#f59e0b','#22c55e','#14b8a6','#f43f5e','#06b6d4','#64748b','#8b5cf6','#ec4899','#84cc16','#f97316','#6366f1'];
  // Simple inline color picker via a quick modal
  const existing=document.getElementById('mc-color-picker-modal');
  if(existing)existing.remove();
  const modal=document.createElement('div');
  modal.id='mc-color-picker-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:1100;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px)';
  modal.innerHTML=`<div style="background:var(--bg1);border:1px solid var(--line2);border-radius:10px;padding:16px;min-width:240px" onclick="event.stopPropagation()">
    <div style="font-size:12px;font-weight:700;color:var(--tx1);margin-bottom:12px">${mc.icon} ${mc.name} color</div>
    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px">
      ${colors.map(c=>`<button onclick="setMachineColor('${mcId}','${c}')" style="width:28px;height:28px;border-radius:50%;background:${c};border:2px solid ${mc.color===c?'var(--tx1)':'transparent'};cursor:pointer;transition:transform .1s" title="${c}"></button>`).join('')}
    </div>
    <div style="display:flex;align-items:center;gap:8px">
      <input type="color" value="${mc.color||'#64748b'}" style="width:36px;height:28px;border:none;background:none;cursor:pointer" onchange="setMachineColor('${mcId}',this.value)">
      <span style="font-size:10px;color:var(--tx3);font-family:var(--mono)">custom color</span>
      <button class="btn btn-sm" style="margin-left:auto" onclick="document.getElementById('mc-color-picker-modal').remove()">Done</button>
    </div>
  </div>`;
  modal.onclick=()=>modal.remove();
  document.body.appendChild(modal);
}

function setMachineColor(mcId, color){
  const mc=MACHINES.find(x=>x.id===mcId);if(!mc)return;
  mc.color=color; saveMachines(); renderMachines(); renderLiveStatus();
  // Refresh the color picker swatches
  const modal=document.getElementById('mc-color-picker-modal');
  if(modal)modal.remove();
  openMachineColorPicker(mcId);
}

// v8.4: derive a HuggingFace URL from an LM Studio model ID.
// vendor/repo → direct card. Bare slug → search. Strips common LM Studio
// prefixes (mlx-, openai/) and suffixes (-mlx, .gguf, quantization tags)
// before falling back to search so custom fine-tunes get a useful link.
// v8.4: derive a model card URL using LM Studio publisher metadata when available.
// meta = { publisher, repo } from m.modelMeta[modelId] — populated on checkMachine.
// Falls back to string-parsing heuristics when metadata isn't cached yet.
function hfUrl(modelId, meta){
  if(!modelId)return null;
  const id=modelId.trim();

  // Best case: LM Studio key is already "publisher/repo" — use directly
  if(id.includes('/')&&!id.startsWith('openai/')){
    return`https://huggingface.co/${id}`;
  }

  // publisher + repo from metadata
  if(meta?.publisher&&meta?.repo){
    const path=meta.repo.includes('/')?meta.repo:`${meta.publisher}/${meta.repo}`;
    return`https://huggingface.co/${path}`;
  }
  if(meta?.publisher){
    const slug=id.split('/').slice(-1)[0]||id;
    return`https://huggingface.co/${meta.publisher}/${slug}`;
  }

  // Fallback: strip noise and search HF
  let q=id
    .replace(/^mlx-/i,'')
    .replace(/\.gguf$/i,'')
    .replace(/-(mlx|gguf|q[0-9_km]+|awq|exl2)(-.*)?$/i,'')
    .replace(/^openai\//i,'');
  return`https://huggingface.co/models?search=${encodeURIComponent(q)}`;
}

function renderRosterTable(){
  const el=document.getElementById('roster-table');if(!el)return;el.innerHTML='';
  if(!MACHINES.length){
    el.innerHTML=`<div style="padding:28px 18px;text-align:center;color:var(--tx3);font-size:12px;font-family:var(--mono)">
      <div style="font-size:15px;color:var(--tx1);margin-bottom:8px">No machines configured</div>
      <div style="max-width:420px;margin:0 auto 12px;line-height:1.6">Use <strong>Machines</strong> to add your first LM Studio endpoint, then run <strong>Check all</strong> to discover live models.</div>
      <button class="btn btn-sm btn-primary" onclick="openMachineModal()">+ Add Machine</button>
    </div>`;
    return;
  }
  const af=state.archetypeFilter;
  let visibleTotal=0;
  MACHINES.forEach(mc=>{
    let models=ROSTER.filter(r=>r.machine===mc.id);
    if(af)models=models.filter(r=>archetypeForRoster(r)===af);
    if(state.familyFilter)models=models.filter(r=>modelFamily(r)===state.familyFilter);
    if(!models.length)return;
    visibleTotal+=models.length;
    const collapsed=state.collapsedMachines&&state.collapsedMachines.has(mc.id);

    // Section header — status dot · name · URL input · VRAM · collapse
    const hdr=document.createElement('div');hdr.className='rt-section';
    hdr.style.cursor='default';
    const loadedShort=mc.loadedModel?mc.loadedModel.split('/').pop().replace(/[-_]/g,' ').slice(0,30):null;
    const act=machineActivity[mc.id]||{state:'idle'};
    const actLabel=act.state==='loading'?'⟳ loading…':act.state==='generating'?'⬤ generating':act.state==='processing'?'⟳ processing…':null;
    const loadedLine=actLabel
      ?`<span style="font-size:9px;font-family:var(--mono);color:var(--amber)">${actLabel}</span>`
      :loadedShort
        ?`<span class="rt-loaded-model" title="${esc(mc.loadedModel||'')}">⬤ ${esc(loadedShort)}</span>`
        :`<span style="font-size:9px;font-family:var(--mono);color:var(--tx4)">no model loaded</span>`;
    hdr.innerHTML=`
      <div class="mc-dot ${mc.status}" id="mcdot-rt-${mc.id}" style="flex-shrink:0"></div>
      <div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0">
        <span class="rt-section-label" style="color:${mc.color}">${mc.icon} ${mc.name}</span>
        ${loadedLine}
      </div>
      <span class="rt-url-label" id="rt-urllabel-${mc.id}" title="Click to edit URL"
        onclick="rtUrlEdit('${mc.id}')">${esc(mc.url.replace(/^https?:\/\//,''))}</span>
      <input class="inp rt-machine-url" id="rt-url-${mc.id}" type="text" value="${mc.url}"
        style="display:none;font-size:10px;padding:3px 7px;flex:1;min-width:80px;max-width:220px;font-family:var(--mono)"
        onchange="mc_saveUrl('${mc.id}',this.value)"
        onblur="rtUrlDone('${mc.id}')">
      <span style="font-size:10px;color:var(--tx4);font-family:var(--mono);flex-shrink:0">${mc.vram}GB</span>
      <button class="rt-collapse-btn" onclick="toggleMachineCollapse('${mc.id}')" title="${collapsed?'Expand':'Collapse'}">${collapsed?`▶ ${models.length} hidden`:'▼'}</button>`;
    el.appendChild(hdr);

    // Row group — hidden when collapsed
    const group=document.createElement('div');
    group.className='rt-section-rows'+(collapsed?' collapsed':'');
    group.id=`rt-group-${mc.id}`;

    models.forEach(r=>{
      const h=rclr(r),isLoaded=mc.loadedModel===r.model;
      const meta=getModelMeta(r);
      const url=hfUrl(r.model,mc.modelMeta?.[r.model]||null);
      const isDirect=url&&!url.includes('?search=');
      const linkTitle=isDirect?'Open model card on HuggingFace':'Search HuggingFace for this model';
      const modelLink=url
        ?`<a href="${url}" target="_blank" rel="noopener" title="${linkTitle}" class="rt-model-id rt-hf-link" onclick="event.stopPropagation()">${esc(r.model)} <span class="rt-hf-badge">LINK ↗</span></a>`
        :`<div class="rt-model-id">${esc(r.model)}</div>`;

      // Info chip — type + quant, click for full popover
      // Coerce both to string defensively in case stale data slipped through
      const safeType=meta.type&&typeof meta.type==='string'?meta.type:null;
      const safeQuant=meta.quant&&typeof meta.quant==='string'?meta.quant:null;
      const typeColor=safeType==='MLX'?'#818cf8':safeType==='GGUF'?'#f59e0b':'#64748b';
      const typeBg=safeType==='MLX'?'rgba(99,102,241,.12)':safeType==='GGUF'?'rgba(245,158,11,.10)':'rgba(100,116,139,.1)';
      const chipLabel=(safeType||'?')+(safeQuant?' · '+safeQuant:'');
      const infoChip=`<button onclick="event.stopPropagation();showModelInfoPopover('${r.id}',this)"
        style="font-size:9px;padding:2px 6px;border-radius:4px;background:${typeBg};border:1px solid ${typeColor}44;color:${typeColor};font-family:var(--mono);cursor:pointer;white-space:nowrap;line-height:1.4"
        title="Click for model details">${chipLabel}</button>`;

      // Size display: user-entered GB + API file size if different
      const sizeDisplay=meta.fileSizeGB&&Math.abs(parseFloat(meta.fileSizeGB)-r.size)>0.5
        ?`${r.size}GB <span style="font-size:9px;color:var(--tx4)">(${meta.fileSizeGB})</span>`
        :`${r.size}GB`;

      const row=document.createElement('div');
      row.className='rt-row'+(isLoaded?' is-loaded':'')+(r.torches<=0?' voted-off':'');
      row.id='rt-'+r.id;
      row.innerHTML=`
        <div class="rt-dot ${isLoaded?'loaded':''}" id="rtdot-${r.id}"></div>
        <div class="rt-name-cell">
          <div class="rt-name" style="color:${h}">${dispName(r)}</div>
          ${modelLink}
        </div>
        <span class="rt-role-cell">${r.role}</span>
        <span class="rt-size-cell">${sizeDisplay}</span>
        <div class="rt-machine-cell">${infoChip}</div>
        <div class="rt-actions-cell" id="rtact-${r.id}">${buildActionBtns(r,mc,isLoaded)}</div>`;
      group.appendChild(row);
    });
    el.appendChild(group);
  });
  if(visibleTotal===0&&af){
    const empty=document.createElement('div');
    empty.style.cssText='padding:24px;text-align:center;color:var(--tx4);font-size:12px;font-family:var(--mono)';
    empty.textContent=`No ${ARCHETYPES[af]?.label||af} models on any machine`;
    el.appendChild(empty);
  } else if(visibleTotal===0){
    const empty=document.createElement('div');
    empty.style.cssText='padding:24px;text-align:center;color:var(--tx4);font-size:12px;font-family:var(--mono);line-height:1.6';
    empty.innerHTML='No models in the roster yet.<br><span style="font-size:11px;color:var(--tx3)">Bring a machine online, update the device map if prompted, then scan the roster.</span>';
    el.appendChild(empty);
  }
}

function buildActionBtns(r,mc,isLoaded){
  if(mc.status!=='online')return`<span style="font-size:10px;color:var(--tx3);font-family:var(--mono)">offline</span>`;
  if(isLoaded)return`<button class="unload-btn" onclick="unloadModel('${r.id}')">Unload</button>`;
  return`<button class="load-btn" onclick="loadModel('${r.id}')">Load</button>`;
}

async function loadModel(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const mc=MACHINES.find(x=>x.id===r.machine);
  if(!mc||mc.status!=='online'){toast('Machine offline',true);return;}
  setRowLoading(rid,true);toast(`Loading ${dispId(r)} ${r.first}…`);
  if(mc.loadedInstanceId){
    try{await fetch(`${mc.url}/api/v1/models/unload`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instance_id:mc.loadedInstanceId}),signal:AbortSignal.timeout(15000)});}catch{}
    const prev=ROSTER.find(x=>x.model===mc.loadedModel&&x.machine===r.machine);
    mc.loadedModel=null;mc.loadedInstanceId=null;
    if(prev)updateRowLoadedState(prev.id,false,mc);
  }
  try{
    const resp=await fetch(`${mc.url}/api/v1/models/load`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:r.model}),signal:AbortSignal.timeout(120000)});
    if(!resp.ok){const e=await resp.text();throw new Error(e.slice(0,150));}
    const data=await resp.json();
    mc.loadedModel=r.model;mc.loadedInstanceId=data.instance_id||r.model;
    updateRowLoadedState(rid,true,mc);
    const lel=document.getElementById('mc-loaded-'+mc.id);if(lel)lel.textContent='⬤ '+r.model;
    toast(`${dispId(r)} ${r.first} loaded ✓`);
  }catch(e){setRowLoading(rid,false);toast(`Load failed: ${e.message}`,true);}
}

async function unloadModel(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const mc=MACHINES.find(x=>x.id===r.machine);if(!mc)return;
  setRowLoading(rid,true);
  try{
    const resp=await fetch(`${mc.url}/api/v1/models/unload`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({instance_id:mc.loadedInstanceId||r.model}),signal:AbortSignal.timeout(15000)});
    if(!resp.ok){const e=await resp.text();throw new Error(e.slice(0,150));}
    mc.loadedModel=null;mc.loadedInstanceId=null;
    updateRowLoadedState(rid,false,mc);
    const lel=document.getElementById('mc-loaded-'+mc.id);if(lel)lel.textContent='No model loaded';
    toast(`${dispId(r)} ${r.first} unloaded`);
  }catch(e){setRowLoading(rid,false);toast(`Unload failed: ${e.message}`,true);}
}

function setRowLoading(rid,loading){
  const dot=document.getElementById('rtdot-'+rid),act=document.getElementById('rtact-'+rid);
  if(dot)dot.className='rt-dot'+(loading?' loading':'');
  if(act&&loading)act.innerHTML=`<span style="font-size:10px;color:var(--amber);font-family:var(--mono)">…</span>`;
}

function updateRowLoadedState(rid,loaded,mc){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const row=document.getElementById('rt-'+rid),dot=document.getElementById('rtdot-'+rid),act=document.getElementById('rtact-'+rid);
  if(row)row.className='rt-row'+(loaded?' is-loaded':'')+(r.torches<=0?' voted-off':'');
  if(dot)dot.className='rt-dot'+(loaded?' loaded':'');
  if(act)act.innerHTML=buildActionBtns(r,mc,loaded);
}

function renderMachineBadges(){
  const el=document.getElementById('machine-badges');if(!el)return;el.innerHTML='';
  MACHINES.forEach(m=>{
    const b=document.createElement('div');b.className='mbadge';
    b.innerHTML=`<div class="mdot ${m.status}" id="topmdot-${m.id}"></div>${m.icon} ${m.name.split(' ')[0]}`;
    b.onclick=()=>setNav('machines');el.appendChild(b);
  });
}

async function checkMachine(id, silent=false){
  const m=MACHINES.find(x=>x.id===id);
  const inp=document.getElementById('url-'+id);if(inp&&inp.value.trim())m.url=inp.value.trim();
  m.url=m.url.replace(/\/+$/,'');
  m.status='checking';updateDots(id,'checking');setMachineActivity(id,'idle');
  try{
    const r=await fetch(`${m.url}/api/v1/models`,{signal:AbortSignal.timeout(4000)});
    if(!r.ok)throw new Error('HTTP '+r.status);
    const data=await r.json();m.status='online';updateDots(id,'online');renderLiveStatus();
    const models=data.models||data.data||[];
    const loaded=models.find(x=>x.loaded_instances&&x.loaded_instances.length>0);
    m.loadedModel=loaded?loaded.key||loaded.id:null;
    m.loadedInstanceId=loaded&&loaded.loaded_instances[0]?loaded.loaded_instances[0].id||m.loadedModel:null;
    const lel=document.getElementById('mc-loaded-'+id);if(lel)lel.textContent=m.loadedModel?`⬤ ${m.loadedModel}`:'No model loaded';
    ROSTER.filter(r=>r.machine===id).forEach(r=>updateRowLoadedState(r.id,m.loadedModel===r.model,m));
    const llmModels=models.filter(x=>x.type==='llm'||!x.type).filter(x=>{const id=(x.key||x.id||'').toLowerCase();return!id.includes('embed');});
    const loadedName=m.loadedModel?` · ⬤ ${m.loadedModel.split('/').pop().slice(0,28)}`:'';
    if(!silent)toast(`${m.name}: online · ${llmModels.length} available${loadedName}`);
    // ── STORE AVAILABLE MODELS + PUBLISHER METADATA FOR LINKS ──
    m.availableModels=llmModels.map(x=>x.key||x.id).filter(Boolean);
    // Build a lookup: modelId → { publisher, repo } for HF model card links
    m.modelMeta={};
    // ── AUTO-DETECT PLATFORM if not set ──
    // The LM Studio API mis-reports compatibility_type on some machines (e.g. returns "mlx"
    // for GGUF files). Do NOT use API compat values for platform detection.
    // Instead match this machine's URL against DEFAULT_MACHINES by IP — those have correct
    // platform fields and don't change. This heals machines added via the modal without a platform.
    if(!m.platform){
      const myIp=(m.url||'').replace(/^https?:\/\//,'').split(':')[0];
      const matched=DEFAULT_MACHINES.find(d=>{
        const dIp=(d.url||'').replace(/^https?:\/\//,'').split(':')[0];
        return dIp&&myIp&&dIp===myIp;
      });
      if(matched?.platform){
        m.platform=matched.platform;
        saveMachines();
        console.log(`[platform] Auto-detected ${m.name} → ${m.platform} via IP match (${myIp})`);
      }
    }

    llmModels.forEach(x=>{
      const key=x.key||x.id;if(!key)return;

      // ── TYPE: compatibility_type > format > platform inference ──
      // Platform is physical ground truth — correct impossible API values at the source.
      const compat=(x.compatibility_type||x.format||'').toLowerCase();
      let type=null;
      if(compat==='mlx')type='MLX';
      else if(compat==='gguf')type='GGUF';
      else if(m.platform==='apple')type='MLX';
      else if(m.platform==='cuda')type='GGUF';
      // Sanity-check: CUDA cannot run MLX, Apple cannot run GGUF
      if(m.platform==='cuda'  && type==='MLX')  type='GGUF';
      if(m.platform==='apple' && type==='GGUF') type='MLX';

      // ── QUANT: quantization.name (v1 object) > quantization string (v0) > path ──
      let quant='';
      const rawQ=x.quantization;
      if(rawQ){
        if(typeof rawQ==='string')quant=rawQ;
        else if(rawQ&&typeof rawQ==='object'&&typeof rawQ.name==='string')quant=rawQ.name;
      }
      if(!quant){
        const path=(key||'').toLowerCase();
        if(type==='GGUF'){
          const qm=path.match(/[_.-](q[0-9][_a-z0-9]*|iq[0-9][_a-z]*|f16|f32|bf16)/i);
          if(qm)quant=qm[1].toUpperCase();
        } else if(type==='MLX'){
          const bm=path.match(/[_.-]([0-9]+)[_-]?bit/i)||path.match(/([0-9]+)bit/i);
          if(bm)quant=bm[1]+'-bit';
          else if(path.includes('dwq'))quant='DWQ';
          else if(path.includes('optiq'))quant='OptiQ';
        }
      }

      // ── CAPABILITIES: object { vision: bool, trained_for_t...: bool } ──
      const caps=x.capabilities||{};
      const vision=!!(caps.vision||caps.image_input||false);
      const functionCalling=!!(caps.tool_use||caps.function_calling||caps.trained_for_tool_use||false);

      // ── PARAMS: params_string ("26B-A4B", "9B") > params_billion ──
      const paramsStr=x.params_string||null;
      const paramsBillion=x.params_billion||x.num_params_billion||null;

      m.modelMeta[key]={
        publisher:  x.publisher||x.author||null,
        repo:       x.repo||x.model_key||null,
        displayName: x.display_name||null,
        architecture: typeof x.architecture==='string'?x.architecture:(x.arch||null),
        quant:      quant||null,
        type:       type||null,
        format:     compat||null,
        contextLength: x.max_context_length||x.context_length||null,
        paramsBillion,
        paramsStr,
        sizeBytes:  x.size_bytes||x.file_size||null,
        vision, functionCalling,
      };
    });
  }catch(e){m.status='error';updateDots(id,'error');renderLiveStatus();if(!silent)toast(`${m.name}: unreachable`,true);}
}

function mc_saveUrl(id, url){
  const m=MACHINES.find(x=>x.id===id);if(!m)return;
  m.url=url.trim().replace(/\/+$/,'');saveMachines();
}
function rtUrlEdit(id){
  const lbl=document.getElementById('rt-urllabel-'+id);
  const inp=document.getElementById('rt-url-'+id);
  if(!lbl||!inp)return;
  lbl.style.display='none';
  inp.style.display='';
  inp.style.flex='1';
  inp.focus();inp.select();
}
function rtUrlDone(id){
  const lbl=document.getElementById('rt-urllabel-'+id);
  const inp=document.getElementById('rt-url-'+id);
  if(!lbl||!inp)return;
  const val=inp.value.trim();
  if(val){mc_saveUrl(id,val);}
  lbl.textContent=(inp.value||'').replace(/^https?:\/\//,'');
  inp.style.display='none';
  lbl.style.display='';
}

function updateDots(id,status){
  const cls=status==='online'?'online':status==='error'?'error':status==='checking'?'checking':'';
  ['mcdot-','topmdot-','mcdot-rt-'].forEach(p=>{
    const el=document.getElementById(p+id);
    if(el)el.className='mc-dot '+cls;
  });
  renderMachineBadges();
}
async function checkAllMachines(){
  for(const m of MACHINES)await checkMachine(m.id);
  deduplicateRosterMachines(); // reassign any duplicate model+machine roster entries now that availableModels is populated
  renderRosterTable();         // re-render badges — modelMeta is now populated with correct type/quant per machine
  postCheckPrompt();
}

function dismissSetupBanner(){
  state.setupBannerDismissed=true;
  const banner=document.getElementById('setup-banner');
  if(banner)banner.style.display='none';
}

function showBanner(icon, color, headline, sub, btnLabel, action, autoScan=false){
  if(state.setupBannerDismissed)return;
  const banner=document.getElementById('setup-banner');
  const msg=document.getElementById('setup-banner-msg');
  const subEl=document.getElementById('setup-banner-sub');
  const iconEl=document.getElementById('setup-banner-icon');
  const btn=document.getElementById('setup-banner-btn');
  if(!banner||!msg||!btn)return;
  // Color: 'blue' | 'amber'
  const bg=color==='amber'?'rgba(245,158,11,.10)':'rgba(59,130,246,.08)';
  const border=color==='amber'?'rgba(245,158,11,.35)':'rgba(59,130,246,.2)';
  banner.style.background=bg;
  banner.style.borderBottom=`1px solid ${border}`;
  if(iconEl)iconEl.textContent=icon;
  msg.textContent=headline;
  if(subEl){
    if(sub){subEl.textContent=sub;subEl.style.display='';}
    else subEl.style.display='none';
  }
  btn.textContent=btnLabel;
  btn.dataset.action=action;
  banner.style.display='flex';
  if(autoScan)setTimeout(()=>scanForNewModels(),600);
}

function postCheckPrompt(){
  if(!MACHINES.length){
    showBanner('🖥️','blue',
      'Add your first machine to get started',
      'Open Machines and enter the LM Studio URL, VRAM, and an optional note for the box you want to query.',
      '⚙ Add Machine','machines');
    return;
  }

  const online=MACHINES.filter(m=>m.status==='online'&&m.availableModels?.length);
  if(!online.length){
    showBanner('↺','blue',
      'Check your machines to verify connectivity',
      'Once at least one machine is online, the app can discover live models and guide the next setup step.',
      '↺ Check Machines','check');
    return;
  }

  const hasKeyMap=APP.lmLinkKeyMap&&Object.keys(APP.lmLinkKeyMap).length>0;
  const rosterPairs=new Set(ROSTER.map(r=>r.model+'__'+r.machine));

  // Build pairs the same way scanForNewModels does so counts match
  const seen=new Set();
  const pairs=[];
  if(hasKeyMap){
    const allMids=new Set();
    online.forEach(mc=>(mc.availableModels||[]).forEach(mid=>{
      if(!mid.toLowerCase().includes('embed'))allMids.add(mid);
    }));
    allMids.forEach(mid=>{
      const resolved=machinesForLmLinkModel(mid);
      if(!resolved.length){pairs.push(mid+'__'+(online[0]?.id||''));return;}
      resolved.forEach(({mcId})=>{
        const key=mid+'__'+mcId;
        if(!seen.has(key)){seen.add(key);pairs.push(key);}
      });
    });
  } else {
    online.forEach(mc=>{
      (mc.availableModels||[]).forEach(mid=>{
        if(mid.toLowerCase().includes('embed'))return;
        const key=mid+'__'+mc.id;
        if(!seen.has(key)){seen.add(key);pairs.push(key);}
      });
    });
  }
  const newCount=pairs.filter(p=>!rosterPairs.has(p)).length;

  // Stale map detection: live model count vs what was indexed in last lms ls --json paste
  const allMidsCount=new Set([...online.flatMap(mc=>(mc.availableModels||[]).filter(m=>!m.toLowerCase().includes('embed')))]).size;
  const indexedCount=Object.keys(APP.lmLinkKeyMap||{}).length;
  const mapStale=hasKeyMap&&Math.abs(allMidsCount-indexedCount)>2;

  const banner=document.getElementById('setup-banner');
  if(!banner)return;

  // ── CASE 1: No device map at all ──
  if(!hasKeyMap){
    showBanner('⚙️','amber',
      'Device map missing — machines are online but models can\'t be assigned',
      `Go to Settings and paste the output of 'lms ls --json' to map each device, then scan roster`,
      '⚙ Go to Settings','settings');
    return;
  }

  // ── CASE 2: Device map is stale (model count mismatch > 2) ──
  if(mapStale){
    showBanner('⚠️','amber',
      `Device map is out of sync — ${indexedCount} models indexed, ${allMidsCount} live`,
      `Re-paste 'lms ls --json' in Settings › LM Link to update, then scan roster. This happens when you add/remove models or a new machine comes online.`,
      '⚙ Update Map','settings');
    return;
  }

  // ── CASE 3: Map good, new models found ──
  if(newCount>0){
    if(ROSTER.length===0){
      showBanner('🆕','blue',
        `${newCount} model${newCount!==1?'s':''} ready to add to your roster`,
        `Device map looks good (${indexedCount} models indexed across ${online.length} machine${online.length!==1?'s':''}). Tap Scan Roster to assign roles and add all.`,
        '🔍 Scan Roster','scan', true);
    } else {
      showBanner('🆕','blue',
        `${newCount} new model${newCount!==1?'s':''} detected on your machines`,
        `Your device map is current. Tap Scan Roster to add them.`,
        '🔍 Scan Roster','scan');
    }
    return;
  }

  // ── CASE 4: All good, nothing to do ──
  banner.style.display='none';
}

function setupBannerAction(){
  const btn=document.getElementById('setup-banner-btn');
  if(!btn)return;
  if(btn.dataset.action==='settings'){
    setNav('settings');
    setBnActive('bn-settings');
    // Scroll to LM Link section after a tick
    setTimeout(()=>{
      const el=document.getElementById('lmlink-paste');
      if(el)el.scrollIntoView({behavior:'smooth',block:'center'});
    },150);
  } else if(btn.dataset.action==='scan'){
    scanForNewModels();
  } else if(btn.dataset.action==='machines'){
    setNav('machines');
    openMachineModal();
  } else if(btn.dataset.action==='check'){
    checkAllMachines();
  }
}
