/* ── LM LINK DEVICE MAP ── */
// APP.lmLinkMap = { "ccaac7a206cec2353e172c9ce7fcf558": "bw", "24bb5423c037f7644719847fe1873b62": "ss" }
// null deviceIdentifier = local to whichever machine was checked

function parseLmLinkJson(raw){
  const statusEl=document.getElementById('lmlink-status');
  const rowsEl=document.getElementById('lmlink-device-rows');
  if(!raw||!raw.trim()){if(rowsEl)rowsEl.innerHTML='';if(statusEl)statusEl.textContent='';return;}
  let models;
  try{models=JSON.parse(raw.trim());}
  catch(e){if(statusEl)statusEl.textContent='⚠ Invalid JSON — paste the full output of lms ls --json';if(rowsEl)rowsEl.innerHTML='';return;}
  if(!Array.isArray(models)){if(statusEl)statusEl.textContent='⚠ Expected a JSON array';return;}

  // Build modelKey → [{hash, format, architecture, sizeBytes, quantization, paramsString, vision}, ...]
  // Array because same modelKey can exist on multiple devices with different formats/sizes
  const keyMap={};
  models.forEach(m=>{
    if(!m.modelKey)return;
    const hash=m.deviceIdentifier||null;
    const entry={
      hash,
      format: m.format||null,
      architecture: m.architecture||null,
      sizeBytes: m.sizeBytes||null,
      quantization: m.quantization?.name||null,
      paramsString: m.paramsString||null,
      vision: m.vision||false,
      displayName: m.displayName||null,
    };
    if(!keyMap[m.modelKey])keyMap[m.modelKey]=[];
    // Don't duplicate same hash+format combo
    const alreadyHas=keyMap[m.modelKey].some(e=>e.hash===hash&&e.format===entry.format);
    if(!alreadyHas)keyMap[m.modelKey].push(entry);
  });
  APP.lmLinkKeyMap=keyMap;
  APP.lmLinkUpdated=new Date().toISOString();
  saveApp();

  // Collect distinct non-null device hashes and count models per device
  const counts={};
  const localCount=models.filter(m=>!m.deviceIdentifier&&m.type!=='embedding').length;
  models.forEach(m=>{
    if(m.deviceIdentifier&&m.type!=='embedding'){
      counts[m.deviceIdentifier]=(counts[m.deviceIdentifier]||0)+1;
    }
  });
  const hashes=Object.keys(counts);

  if(!hashes.length){
    if(statusEl)statusEl.textContent=`✓ ${localCount} local models, no remote devices found`;
    if(rowsEl)rowsEl.innerHTML='';
    return;
  }

  if(statusEl)statusEl.textContent=`Found ${hashes.length} remote device${hashes.length!==1?'s':''} + ${localCount} local models — assign each to a machine:`;

  const mcLabel=(m)=>{
    const ip=m.url.replace(/^https?:\/\//,'').split(':')[0];
    return`${m.icon||'🖥'} ${m.name} · ${ip}`;
  };
  const buildMcOpts=(selectedId)=>'<option value=""'+(selectedId?'':' selected')+'>— unassigned —</option>'+
    MACHINES.map(m=>`<option value="${m.id}"${m.id===selectedId?' selected':''}>${mcLabel(m)}</option>`).join('');

  rowsEl.innerHTML=hashes.map(hash=>{
    const saved=(APP.lmLinkMap||{})[hash]||'';
    const short=hash.slice(0,8)+'…';
    return`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)">
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;font-family:var(--mono);color:var(--tx2)">${short}</div>
        <div style="font-size:9px;color:var(--tx4)">${counts[hash]} model${counts[hash]!==1?'s':''}</div>
      </div>
      <select class="inp" style="font-size:11px;width:140px" onchange="saveLmLinkEntry('${hash}',this.value)">${buildMcOpts(saved)}</select>
    </div>`;
  }).join('');
}

function saveLmLinkEntry(hash, mcId){
  if(!APP.lmLinkMap)APP.lmLinkMap={};
  if(mcId)APP.lmLinkMap[hash]=mcId;
  else delete APP.lmLinkMap[hash];
  saveApp();
  const statusEl=document.getElementById('lmlink-status');
  if(statusEl){
    const mc=MACHINES.find(x=>x.id===mcId);
    statusEl.textContent=mcId?`✓ ${hash.slice(0,8)}… → ${mc?.name||mcId} saved`:'Entry cleared';
    setTimeout(()=>{if(statusEl){
      const ts=APP.lmLinkUpdated?` · updated ${new Date(APP.lmLinkUpdated).toLocaleString()}`:'';
      statusEl.textContent=Object.keys(APP.lmLinkMap).length+' device(s) mapped'+ts;
    }},1500);
  }
}

// Given a modelKey (from API), return the machine ID using lms ls --json derived maps
// Returns [{mcId, meta}] for a given modelKey using the persisted lms ls --json map
function machinesForLmLinkModel(modelKey){
  if(!modelKey||!APP.lmLinkKeyMap)return [];
  const entries=APP.lmLinkKeyMap[modelKey];
  if(!entries||!entries.length)return [];
  // Support both old format (array of hashes) and new format (array of {hash, ...meta})
  const seenMachines=new Set();
  return entries.map(e=>{
    const hash=typeof e==='object'?e.hash:e;
    const meta=typeof e==='object'?e:{};
    const mcId=hash===null
      ?(APP.lmLinkLocalMachine||null)
      :((APP.lmLinkMap&&APP.lmLinkMap[hash])||null);
    return mcId?{mcId,meta}:null;
  }).filter(Boolean).filter(({mcId})=>{
    // Deduplicate: if two keymap entries (e.g. different format variants) resolve
    // to the same machine, only keep the first — same model on same machine is one entry.
    if(seenMachines.has(mcId))return false;
    seenMachines.add(mcId);
    return true;
  });
}
// Backward compat: single result version
function machineForLmLinkModel(modelKey){
  const results=machinesForLmLinkModel(modelKey);
  return results[0]?.mcId||null;
}

async function settingsScanRoster(){
  const btn=document.getElementById('settings-scan-btn');
  if(btn){btn.disabled=true;btn.textContent='⟳ Checking machines…';}
  try{
    await checkAllMachines();
  }finally{
    if(btn){btn.disabled=false;btn.textContent='🔍 Scan Roster';}
  }
  const online=MACHINES.filter(m=>m.status==='online'&&m.availableModels?.length);
  if(!online.length){toast('No machines online — check your connections',true);return;}
  scanForNewModels();
}
function renderLmLinkSection(){
  // Populate local machine select
  const localSel=document.getElementById('lmlink-local-machine');
  if(localSel){
    const saved=APP.lmLinkLocalMachine||'';
    const mcLbl=(m)=>{const ip=m.url.replace(/^https?:\/\//,'').split(':')[0];return`${m.icon||'🖥'} ${m.name} · ${ip}`;};
    localSel.innerHTML='<option value="">— select —</option>'+
      MACHINES.map(m=>`<option value="${m.id}"${m.id===saved?' selected':''}>${mcLbl(m)}</option>`).join('');
  }
  // Show existing mappings if map already has entries
  if(APP.lmLinkMap&&Object.keys(APP.lmLinkMap).length){
    const rowsEl=document.getElementById('lmlink-device-rows');
    const statusEl=document.getElementById('lmlink-status');
    if(rowsEl&&!rowsEl.children.length){
      const mcLbl2=(m)=>{const ip=m.url.replace(/^https?:\/\//,'').split(':')[0];return`${m.icon||'🖥'} ${m.name} · ${ip}`;};
      const buildMcOpts2=(selectedId)=>'<option value=""'+(selectedId?'':' selected')+'>— unassigned —</option>'+
        MACHINES.map(m=>`<option value="${m.id}"${m.id===selectedId?' selected':''}>${mcLbl2(m)}</option>`).join('');
      rowsEl.innerHTML=Object.entries(APP.lmLinkMap).map(([hash,mcId])=>{
        const mc=MACHINES.find(x=>x.id===mcId);
        return`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--line)">
          <div style="flex:1;min-width:0">
            <div style="font-size:10px;font-family:var(--mono);color:var(--tx2)">${hash.slice(0,8)}…</div>
            <div style="font-size:9px;color:var(--accent)">→ ${mc?.icon||'🖥'} ${mc?.name||mcId}</div>
          </div>
          <select class="inp" style="font-size:11px;width:140px" onchange="saveLmLinkEntry('${hash}',this.value)">${buildMcOpts2(mcId)}</select>
        </div>`;
      }).join('');
      const modelCount=Object.keys(APP.lmLinkKeyMap||{}).length;
      const ts=APP.lmLinkUpdated?` · updated ${new Date(APP.lmLinkUpdated).toLocaleString()}`:'';
      if(statusEl)statusEl.textContent=`${Object.keys(APP.lmLinkMap).length} device${Object.keys(APP.lmLinkMap).length!==1?'s':''} mapped · ${modelCount} models indexed${ts} — paste new JSON to update`;
    }
  }
}

function renderCustomRolesList(){
  const el=document.getElementById('custom-roles-list');if(!el)return;
  if(!CUSTOM_ROLES.length){el.innerHTML='<div style="font-size:11px;color:var(--tx4);font-family:var(--mono)">No custom roles yet.</div>';return;}
  el.innerHTML=CUSTOM_ROLES.map(c=>`
    <div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;background:var(--bg2);border:1px solid var(--line);border-radius:7px">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:700;font-family:var(--mono);color:var(--tx1)">${esc(c.profId)} ${esc(c.specId)}</div>
        <div style="font-size:10px;color:var(--tx3);margin-top:3px;line-height:1.5">${esc(c.promptLine)}</div>
      </div>
      <button class="btn btn-sm btn-danger" onclick="deleteCustomRole('${c.id}')" style="flex-shrink:0">✕</button>
    </div>`).join('');
}

// Force-regenerate names for entire roster. Called from settings.
function syncModelDataFromApi(){
  let updated=0;
  ROSTER.forEach(r=>{
    const mc=MACHINES.find(x=>x.id===r.machine);
    const api=mc?.modelMeta?.[r.model];
    if(!api)return;
    if(api.sizeBytes){
      const apiGb=Math.round(api.sizeBytes/1073741824*100)/100;
      if(Math.abs(apiGb-(r.size||0))>0.1){r.size=apiGb;updated++;}
    }
    const apiParams=api.paramsStr?(api.paramsStr.match(/^([\d.]+[BbMm])/)?.[1]?.toUpperCase()||''):null;
    if(apiParams&&(!r.middle||r.middle!==apiParams)){r.middle=apiParams;updated++;}
    if(!r.promptOverridden)r.prompt=generatePrompt(r);
  });
  if(!updated){toast('All model data already up to date ✓');return;}
  save();renderRoster();renderMachines();
  if(state.selRoster){const r=ROSTER.find(x=>x.id===state.selRoster);if(r)renderRosterDetail(r);}
  toast(`Synced ${updated} field${updated!==1?'s':''} across roster ✓`);
}

function autoGenerateAllNames(){
  if(!confirm(`Regenerate First + Middle names for all ${ROSTER.length} engineers from their model IDs? Last name will be set to their current role. Nicknames are untouched. This cannot be undone.`))return;
  ROSTER.forEach(r=>autoGenerateNames(r,true));
  save();renderRoster();renderMachines();renderSurvivorIf();
  toast(`Regenerated names for ${ROSTER.length} engineers ✓`);
}

// Legacy alias — kept so any existing callsites don't break
function deriveNameFromModelId(modelId){
  const{first,middle}=deriveModelParts(modelId);
  return{first,last:middle};
}

function autoAssignMachineFromModelId(){
  const modelVal=(document.getElementById('am-model')?.value||'').trim().toLowerCase();
  const sel=document.getElementById('am-machine');
  const hint=document.getElementById('am-machine-hint');
  if(!sel||!modelVal){if(hint)hint.textContent='';return;}

  // Search availableModels (from Check All) for exact or partial match
  let bestMc=null, exactMatch=false;
  for(const m of MACHINES){
    if(!m.availableModels?.length)continue;
    const exact=m.availableModels.find(id=>id.toLowerCase()===modelVal);
    if(exact){bestMc=m;exactMatch=true;break;}
    if(!bestMc){
      const partial=m.availableModels.find(id=>id.toLowerCase().includes(modelVal)||modelVal.includes(id.toLowerCase().split('/').pop()));
      if(partial)bestMc=m;
    }
  }
  // Fallback: loaded model
  if(!bestMc)bestMc=MACHINES.find(m=>m.loadedModel&&m.loadedModel.toLowerCase().includes(modelVal));

  if(bestMc){
    sel.value=bestMc.id;
    // Pull API metadata for this model from the matched machine
    const apiMeta=bestMc.modelMeta?.[modelVal]||
      bestMc.modelMeta?.[bestMc.availableModels?.find(id=>id.toLowerCase()===modelVal||id.toLowerCase().includes(modelVal.split('/').pop()))||'']||null;
    const parts=[];
    if(apiMeta?.paramsStr)parts.push(apiMeta.paramsStr);
    if(apiMeta?.architecture)parts.push(apiMeta.architecture);
    const type=bestMc.platform==='apple'?'MLX':bestMc.platform==='cuda'?'GGUF':'';
    if(type)parts.push(type);
    if(apiMeta?.quant&&typeof apiMeta.quant==='string')parts.push(apiMeta.quant);
    if(apiMeta?.contextLength)parts.push(apiMeta.contextLength>=131072?'128K ctx':apiMeta.contextLength>=32768?'32K ctx':'');
    const hintText=`${exactMatch?'✓':'~'} ${bestMc.icon} ${bestMc.name}${parts.length?' · '+parts.filter(Boolean).join(' · '):''}`;
    if(hint)hint.textContent=hintText;
    // Auto-fill size from API if available
    if(apiMeta?.sizeBytes){
      const sizeEl=document.getElementById('am-size');
      if(sizeEl)sizeEl.value=Math.round(apiMeta.sizeBytes/1073741824*100)/100;
    }
    // Also auto-fill name using API metadata
    autoFillNameFromModelId();
  } else {
    const onlineCount=MACHINES.filter(m=>m.status==='online').length;
    if(hint)hint.textContent=onlineCount?'Not found in available models — try Check All first':'Run Check All to enable auto-assign';
  }
}

function autoFillNameFromModelId(){
  const modelVal=(document.getElementById('am-model')?.value||'').trim();
  if(!modelVal)return;
  const firstEl=document.getElementById('am-first');
  const middleEl=document.getElementById('am-middle');
  const lastEl=document.getElementById('am-last');
  // only auto-fill if fields are still empty
  if((firstEl?.value||'').trim())return;
  const{first,middle}=deriveModelParts(modelVal);
  const role=(document.getElementById('am-role')?.value||'').trim();
  if(firstEl&&first)firstEl.value=first;
  if(middleEl&&middle&&!(middleEl.value||'').trim())middleEl.value=middle;
  if(lastEl&&role&&!(lastEl.value||'').trim())lastEl.value=role;
  // seed persona from first+middle if still empty
  const personaEl=document.getElementById('am-persona');
  if(personaEl&&!(personaEl.value||'').trim()&&first)
    personaEl.value=[first,middle].filter(Boolean).join(' ');
  amAutoPrompt();
}

// live-generate system prompt — uses nickname if set, else first+last (skips middle for readability)
function amAutoPrompt(force=false){
  const ta=document.getElementById('am-prompt');if(!ta)return;
  const first=(document.getElementById('am-first')?.value||'').trim();
  const last=(document.getElementById('am-last')?.value||'').trim();
  const nick=(document.getElementById('am-nick')?.value||'').trim();
  const persona=(document.getElementById('am-persona')?.value||'').trim();
  const role=(document.getElementById('am-role')?.value||'').trim();
  const name=nick||persona||(first&&last?`${first} ${last}`:'');
  if(!name&&!role)return;
  const generated=name&&role?`You are ${name}, a ${role}. MIKE is the Director.`
    :name?`You are ${name}. MIKE is the Director.`
    :`You are a ${role}. MIKE is the Director.`;
  if(force||!(ta.value||'').trim())ta.value=generated;
}
function openAddModelModal(){
  const sel=document.getElementById('am-machine');
  if(sel){
    sel.innerHTML=MACHINES.map(m=>`<option value="${m.id}">${m.icon||'🖥'} ${m.name}</option>`).join('');
    if(APP.defaultMachine)sel.value=APP.defaultMachine;
  }
  autoAssignMachineFromModelId();
  document.getElementById('add-model-modal').style.display='flex';
}
function closeAddModelModal(){
  document.getElementById('add-model-modal').style.display='none';
}
// Sync Last name field to Role field when role changes (since last=role in this schema)
// Track selected secondary IDs in add modal (can't use DOM multiselect easily)
let _amSecondaryIds=[];

function toggleAmSecondary(specId){
  const idx=_amSecondaryIds.indexOf(specId);
  if(idx>=0)_amSecondaryIds.splice(idx,1);else _amSecondaryIds.push(specId);
  // update chip visuals
  SECONDARY_SPECS.forEach(s=>{
    const btn=document.getElementById('am-sec-'+s.id);if(!btn)return;
    const active=_amSecondaryIds.includes(s.id);
    btn.style.border=`1px solid ${active?'var(--accent)':'var(--line2)'}`;
    btn.style.background=active?'var(--accent)':'var(--bg2)';
    btn.style.color=active?'#000':'var(--tx3)';
  });
  amSyncRole();
}

function toggleReSecondary(rid, specId){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  if(!r.secondaryIds)r.secondaryIds=[];
  const idx=r.secondaryIds.indexOf(specId);
  if(idx>=0)r.secondaryIds.splice(idx,1);else r.secondaryIds.push(specId);
  // update chip visuals
  const btn=document.getElementById(`re-sec-${rid}-${specId}`);
  if(btn){
    const active=r.secondaryIds.includes(specId);
    btn.style.border=`1px solid ${active?'var(--accent)':'var(--line2)'}`;
    btn.style.background=active?'var(--accent)':'var(--bg2)';
    btn.style.color=active?'#000':'var(--tx3)';
  }
  reSyncRole(rid);
}

function amSyncRole(){
  const statusId=document.getElementById('am-prof')?.value||'';
  const specId=document.getElementById('am-spec')?.value||'';
  const roleStr=buildRoleString(statusId,specId,_amSecondaryIds);
  const roleEl=document.getElementById('am-role');
  if(roleEl)roleEl.value=roleStr;
  const lastEl=document.getElementById('am-last');
  if(lastEl)lastEl.value=roleStr;
  const preview=document.getElementById('am-role-preview');
  if(preview){
    const spec=SPECIALIZATIONS.find(s=>s.id===specId);
    const color=spec?specColor(specId,statusId||'senior'):null;
    preview.style.color=color||'var(--tx3)';
    preview.textContent=statusId||specId?`→ ${roleStr}`:'';
  }
  amAutoPrompt();
}

function reSyncRole(rid){
  const r=ROSTER.find(x=>x.id===rid);
  const statusId=document.getElementById(`re-prof-${rid}`)?.value||'';
  const specId=document.getElementById(`re-spec-${rid}`)?.value||'';
  const secondaryIds=r?.secondaryIds||[];
  const roleStr=buildRoleString(statusId,specId,secondaryIds);
  const roleEl=document.getElementById(`re-role-${rid}`);
  if(roleEl)roleEl.value=roleStr;
  const lastEl=document.getElementById(`re-last-${rid}`);
  if(lastEl)lastEl.value=roleStr;
  const preview=document.getElementById(`re-role-preview-${rid}`);
  if(preview){
    const spec=SPECIALIZATIONS.find(s=>s.id===specId);
    const color=spec?specColor(specId,statusId||'senior'):null;
    preview.style.color=color||'var(--tx3)';
    preview.textContent=statusId||specId?`→ ${roleStr}`:'';
  }
}

// Legacy stub kept for safety
function syncLastToRole(){
  const role=(document.getElementById('am-role')?.value||'').trim();
  const lastEl=document.getElementById('am-last');
  if(lastEl&&role)lastEl.value=role;
}

function addModelFromModal(){
  const g=id=>document.getElementById(id)?.value.trim();
  const first=g('am-first'),middle=g('am-middle')||'',empId=g('am-empid'),model=g('am-model');
  const statusId=document.getElementById('am-prof')?.value||'';
  const specId=document.getElementById('am-spec')?.value||'';
  const secondaryIds=[..._amSecondaryIds];
  const role=buildRoleString(statusId,specId,secondaryIds)||'Generalist';
  const last=g('am-last')||role;
  const nickname=g('am-nick')||'';
  const machine=document.getElementById('am-machine')?.value;
  const size=parseFloat(document.getElementById('am-size')?.value)||7;
  const temp=parseFloat(document.getElementById('am-temp')?.value)||0.5;
  const typedPrompt=g('am-prompt');
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  const color=specColor(specId,statusId||'senior',dark);
  if(!first||!empId||!model||!machine){toast('First name, ID, Model ID and Machine are required',true);return;}
  if(ROSTER.find(r=>r.empId===empId)){toast(`Emp ID ${empId} already exists`,true);return;}
  const newR={id:'m-'+Date.now(),empId,model,first,middle,last,nickname,
    statusId,proficiencyId:statusId, // proficiencyId kept for backwards compat
    specializationId:specId,secondaryIds,color,role,temp,machine,size,
    torches:3,immunity:false,totalScore:0,episodes:0,avgTps:0,avgTtft:0,
    sessions:[],catScores:{Code:[],Reasoning:[],Creative:[],General:[]},
    prompt:'',promptOverridden:!!typedPrompt};
  newR.prompt=typedPrompt||generatePrompt(newR);
  ROSTER.push(newR);
  save();renderRoster();closeAddModelModal();
  _amSecondaryIds=[];
  // reset secondary chips
  SECONDARY_SPECS.forEach(s=>{const btn=document.getElementById('am-sec-'+s.id);if(btn){btn.style.border='1px solid var(--line2)';btn.style.background='var(--bg2)';btn.style.color='var(--tx3)';}});
  const r=ROSTER.find(x=>x.id===newR.id);if(r){state.selRoster=r.id;renderRosterDetail(r);}
  toast(`${dispName(newR)} added ✓`);
  ['am-first','am-middle','am-last','am-empid','am-model','am-prompt','am-persona','am-nick'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  ['am-prof','am-spec'].forEach(i=>{const el=document.getElementById(i);if(el)el.value='';});
  const preview=document.getElementById('am-role-preview');if(preview)preview.textContent='';
}

