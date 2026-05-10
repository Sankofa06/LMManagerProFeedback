/* ── V6: HTTPS BANNER ── */
function initHttpsBanner(){
  if(location.protocol!=='https:')return;
  const banner=document.getElementById('https-banner');
  if(banner){
    banner.style.display='flex';
    // v8.1: removed the dead http-link href rewrite — modern browsers block https→http navigation
    // push content down so topbar isn't hidden
    document.getElementById('app').style.paddingTop='44px';
  }
}

// v8.1: open the HTTPS-help modal with concrete workarounds
function showHttpsHelp(){
  const m=document.getElementById('https-help-modal');
  if(m)m.style.display='flex';
}

/* ── V6: NODES SUB ── */
function updateNodesSub(){
  const el=document.getElementById('nodes-sub');if(!el)return;
  const totalVram=MACHINES.reduce((a,m)=>a+m.vram,0);
  el.textContent=`${MACHINES.length} machine${MACHINES.length!==1?'s':''} · ${totalVram}GB total · v8.18`;
}

/* ── V6: MACHINE CRUD ── */
function openMachineModal(){
  renderMachineListEdit();
  document.getElementById('machine-modal').style.display='flex';
}
function closeMachineModal(e){if(e.target.id==='machine-modal')document.getElementById('machine-modal').style.display='none';}

/* renderMachineListEdit + v6 saveMachineEdit removed in v8 — see V7: MACHINE RENAME & ICON section below.
   v6 used me-* DOM IDs which the v7 saveMachineEdit (mc-edit-* IDs) silently ignored, producing
   a no-op Save after add/delete. Single source of truth is now renderMachineEditRow + v7 saveMachineEdit. */
function renderMachineListEdit(){
  const el=document.getElementById('machine-list-edit');if(!el)return;
  if(!MACHINES.length){el.innerHTML='<div style="padding:20px;text-align:center;color:var(--tx3);font-size:12px;font-family:var(--mono)">No machines configured</div>';return;}
  el.innerHTML=MACHINES.map(mc=>renderMachineEditRow(mc)).join('');
}

async function deleteMachine(mid){
  const m=MACHINES.find(x=>x.id===mid);if(!m)return;
  const affected=ROSTER.filter(r=>r.machine===mid).length;
  const msg=affected>0
    ?`Delete "${m.name}"? ${affected} engineer(s) assigned to it will lose their machine assignment.`
    :`Delete "${m.name}"?`;
  const ok=await openAppDialog({
    title:'Delete Machine',
    message:msg,
    confirmLabel:'Delete machine',
    danger:true,
  });
  if(!ok)return;
  MACHINES.splice(MACHINES.findIndex(x=>x.id===mid),1);
  saveMachines();renderMachines();renderMachineListEdit();updateNodesSub();
  toast(`${m.name} removed`);
}

function autoFillMachineName(){
  const urlEl=document.getElementById('nm-url');
  const nameEl=document.getElementById('nm-name');
  if(!urlEl||!nameEl||(nameEl.value||'').trim())return; // don't overwrite user-typed name
  const raw=(urlEl.value||'').trim();
  if(!raw)return;
  // Parse hostname from URL
  let host=raw;
  try{ host=new URL(raw.includes('://')?raw:'http://'+raw).hostname; }catch{}
  // Strip port if it crept in
  host=host.replace(/:\d+$/,'');
  // Convert to a readable name:
  //   192.168.1.101  → "Machine 101"
  //   100.109.238.92 → "Machine 92"
  //   black-slab.local → "Black Slab"
  //   my-macbook-pro → "My Macbook Pro"
  //   localhost → "Localhost"
  let name='';
  if(/^[\d.]+$/.test(host)){
    // IP address — use last octet
    const last=host.split('.').pop();
    name='Machine '+last;
  } else {
    // Hostname — strip .local / .ts.net / common suffixes, capitalize words
    name=host
      .replace(/\.(local|lan|internal|ts\.net|tailscale\.net)$/i,'')
      .replace(/[-_]/g,' ')
      .replace(/\b\w/g,c=>c.toUpperCase());
  }
  if(name)nameEl.value=name;
}

function addMachineFromModal(){
  const name=document.getElementById('nm-name')?.value.trim();
  const url=document.getElementById('nm-url')?.value.trim();
  const vram=parseFloat(document.getElementById('nm-vram')?.value)||8;
  const note=document.getElementById('nm-note')?.value.trim()||'';
  if(!name||!url){toast('Name and URL required',true);return;}
  const id='mc-'+Date.now();
  MACHINES.push({id,name,url,vram,note,icon:'🖥',color:'#64748b',status:'offline',loadedModel:null,loadedInstanceId:null});
  ['nm-name','nm-url','nm-vram','nm-note'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  saveMachines();renderMachines();renderMachineListEdit();updateNodesSub();
  toast(`${name} added ✓`);
  // auto check the new machine
  const mc=MACHINES.find(x=>x.id===id);if(mc)checkMachine(mc.id);
}

/* ── V6: ADD MODEL ── */
/* ── AUTO-NAME FROM MODEL ID ── */
// ── V8.4: NAME SCHEMA ──
// First = model family (Qwen, Gemma, Codestral)
// Middle = param count (9B, 27B, 3.5B)
// Last = role string
// Nickname = optional display override (shown everywhere in place of first+middle+last)

// Returns display name — nickname wins, otherwise First Middle Last
// In compact contexts (cards, chat) all three parts shown unless nickname set
function dispName(r){
  if(!r)return'Unknown';
  if(r.nickname&&r.nickname.trim())return r.nickname.trim();
  const parts=[r.first,r.middle,r.last].filter(Boolean);
  return parts.join(' ')||r.first||'Unknown';
}

// Parse model ID into {first, middle} — uses API metadata when available for accuracy
// first = model family name, middle = param count
function deriveModelParts(modelId, apiMeta){
  // ── API-first path: architecture + paramsStr are more reliable than parsing ──
  if(apiMeta){
    // Architecture → family name (qwen3_5 → Qwen, gemma4 → Gemma, llama → Llama)
    const arch=apiMeta.architecture;
    let firstFromArch=null;
    if(arch&&typeof arch==='string'){
      // Strip trailing digits/underscores, capitalize: "qwen3_5" → "Qwen", "gemma4" → "Gemma"
      const base=arch.replace(/[_\d]+$/,'').replace(/_/g,' ');
      firstFromArch=base.charAt(0).toUpperCase()+base.slice(1).toLowerCase();
    }
    // paramsStr → middle: "26B-A4B" → "26B", "9B" → "9B"
    let middleFromParams=null;
    if(apiMeta.paramsStr){
      const m=apiMeta.paramsStr.match(/^([\d.]+[BbMm])/);
      if(m)middleFromParams=m[1].toUpperCase();
    }
    if(firstFromArch||middleFromParams){
      // Still need path-based first if arch didn't give us one
      const fallback=deriveModelPartsFromPath(modelId);
      return{first:firstFromArch||fallback.first, middle:middleFromParams||fallback.middle, last:''};
    }
  }
  return deriveModelPartsFromPath(modelId);
}

function deriveModelPartsFromPath(modelId){
  let s=modelId.split('/').pop().replace(/\.(gguf|bin|safetensors|pt)$/i,'');
  s=s.replace(/[-_](Q[0-9][_A-Za-z0-9]*|F16|F32|GPTQ|AWQ|MLX|INT[0-9]|BF16|EXL2|BNBQ[0-9]|IQ[0-9][A-Z_]*)$/i,'');
  s=s.replace(/[-_](GGUF|instruct|chat|it|hf|base|uncensored|coder|reasoning|distilled|mlx|rl|v\d[\d.]*)$/gi,'');
  const tokens=s.split(/[-_]+/).filter(Boolean);
  if(!tokens.length)return{first:'',middle:'',last:''};
  const cap=t=>t.charAt(0).toUpperCase()+t.slice(1).toLowerCase();
  const isParam=t=>/^\d+(\.\d+)?[Bb]$/.test(t);
  const isVersion=t=>/^\d+(\.\d+)*$/.test(t)||/^v\d/i.test(t)||/^\d{4}$/.test(t);
  const first=cap(tokens.find(t=>!isVersion(t)&&!isParam(t))||tokens[0]||'');
  const paramToken=tokens.find(t=>isParam(t));
  const middle=paramToken?paramToken.toUpperCase():'';
  return{first,middle,last:''};
}

// Auto-generate first+middle for a single roster entry from its model ID.
// Uses API metadata when available for better accuracy.
// Sets last = r.role. Only overwrites blank fields unless force=true.
function autoGenerateNames(r, force=false){
  const mc=MACHINES.find(x=>x.id===r.machine);
  const apiMeta=mc?.modelMeta?.[r.model]||null;
  const{first,middle}=deriveModelParts(r.model||'',apiMeta);
  if(force||!r.first)r.first=first;
  if(force||!r.middle)r.middle=middle;
  if(force||!r.last)r.last=r.role||'';
  if(!r.promptOverridden)r.prompt=generatePrompt(r);
}

/* ── V8.4: CUSTOM ROLE MANAGEMENT ── */
function populateCustomRoleSelects(){
  const prof=document.getElementById('cr-prof');
  const spec=document.getElementById('cr-spec');
  if(prof){
    const prev=prof.value;
    prof.innerHTML=
      '<option value="">— built-in —</option>'+
      STATUS_LEVELS.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')+
      '<option value="custom">✦ Custom…</option>';
    prof.value=prev;
  }
  if(spec){
    const prev=spec.value;
    spec.innerHTML=
      '<option value="">— built-in —</option>'+
      SPECIALIZATIONS.map(s=>`<option value="${s.id}">${s.icon} ${s.label}</option>`).join('')+
      '<option value="custom">✦ Custom…</option>';
    spec.value=prev;
  }
}
function openCustomRoleModal(){
  populateCustomRoleSelects();
  document.getElementById('custom-role-modal').style.display='flex';
  updateCrPreview();
  ['cr-prof','cr-spec'].forEach(id=>{
    const el=document.getElementById(id);
    if(el)el.onchange=()=>{
      const labelEl=document.getElementById(id+'-label');
      if(labelEl)labelEl.style.display=el.value==='custom'?'block':'none';
      updateCrPreview();
    };
  });
}
function closeCustomRoleModal(){document.getElementById('custom-role-modal').style.display='none';}
function updateCrPreview(){
  const profVal=document.getElementById('cr-prof')?.value||'';
  const specVal=document.getElementById('cr-spec')?.value||'';
  const profLabel=profVal==='custom'?(document.getElementById('cr-prof-label')?.value.trim()||'')
    :(STATUS_LEVELS.find(s=>s.id===profVal)?.label||'');
  const specLabel=specVal==='custom'?(document.getElementById('cr-spec-label')?.value.trim()||'')
    :(SPECIALIZATIONS.find(s=>s.id===specVal)?.label||'');
  const preview=document.getElementById('cr-preview');
  if(preview)preview.textContent=[profLabel,specLabel].filter(Boolean).join(' ')||'—';
}
function saveCustomRole(){
  const profVal=document.getElementById('cr-prof')?.value||'';
  const specVal=document.getElementById('cr-spec')?.value||'';
  const profId=profVal==='custom'?(document.getElementById('cr-prof-label')?.value.trim()||''):profVal;
  const specId=specVal==='custom'?(document.getElementById('cr-spec-label')?.value.trim()||''):specVal;
  const promptLine=document.getElementById('cr-prompt')?.value.trim();
  if(!promptLine){toast('Prompt language is required',true);return;}
  if(!profId&&!specId){toast('Select at least one tier',true);return;}
  CUSTOM_ROLES.push({id:'cr-'+Date.now(),profId,specId,promptLine});
  saveCustomRoles();renderCustomRolesList();closeCustomRoleModal();
  toast('Custom role saved ✓');
  ['cr-prof','cr-spec'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  ['cr-prof-label','cr-spec-label','cr-prompt'].forEach(i=>{const el=document.getElementById(i);if(el){el.value='';el.style.display='none';}});
}
function deleteCustomRole(id){
  CUSTOM_ROLES=CUSTOM_ROLES.filter(c=>c.id!==id);
  saveCustomRoles();renderCustomRolesList();toast('Custom role removed');
}
