/* ── V7: BRAND NAME EDITOR ── */
function startBrandEdit(){ /* no-op — brand no longer in topbar */ }
function saveBrandName(val){
  const name=(val||'').trim()||'LM Manager Pro Web';
  APP.brandName=name; saveApp();
  localStorage.setItem('lmmp_v7_brand',name);
  document.title=name+' AI Manager';
}
function loadBrandName(){
  const saved=APP.brandName||localStorage.getItem('lmmp_v7_brand')||'LM Manager Pro Web';
  APP.brandName=saved;
  document.title=saved+' AI Manager';
}

/* ── V7: ROSTER LIST FILTER (Engineers panel) ── */
function filterRosterList(q){
  q=(q||'').toLowerCase().trim();
  const scroll=document.getElementById('roster-scroll');if(!scroll)return;
  scroll.querySelectorAll('.roster-group-hdr,.roster-row').forEach(el=>{
    if(!q){el.style.display='';return;}
    if(el.classList.contains('roster-group-hdr')){el.style.display='none';return;} // hide section headers when filtering
    const text=el.textContent.toLowerCase();
    el.style.display=text.includes(q)?'':'none';
  });
  // Show section headers back only if they have visible children when NOT filtering
  if(q) return;
  scroll.querySelectorAll('.roster-group-hdr').forEach(hdr=>{hdr.style.display='';});
}

/* ── V7: CROSSTALK TOGGLE ── */
function toggleCrosstalk(){
  const cb=document.getElementById('gs-crosstalk');
  if(cb){cb.checked=!cb.checked;}
  const btn=document.getElementById('crosstalk-toggle-btn');
  const on=cb?cb.checked:true;
  if(btn)btn.textContent='👁 Context '+(on?'ON':'OFF');
  if(btn)btn.style.color=on?'var(--accent)':'var(--tx3)';
  toast('Cross-talk '+(on?'ON — agents see each other\'s replies':'OFF — blind responses'));
}

/* ── V7: COMMIT TOAST (snuff/immunity commentary) ── */
const SNUFF_COMMENTS=[
  'The torch has been snuffed. The tribe has spoken.',
  'Voted off the island. git commit -m "remove underperforming agent"',
  'Another one bites the dust. Model retired to /dev/null.',
  'Session terminated. Exit code: 🔥',
  'The model has left the building. Checkpointing discontinued.',
  'Benchmark failed. Agent decommissioned with honors.',
  'Not a good fit for this sprint. Farewell.',
  'Token budget exhausted. Carrier pigeon dispatched.',
];
const IMMUNITY_COMMENTS=[
  'Immunity granted. This model is untouchable this round.',
  '👑 The crown has been placed. git tag stable-release',
  'Protected from elimination. Performance metrics: exceptional.',
  'Immunity idol played. No votes count against this agent.',
  'Shielded from the torch. Top performer status confirmed.',
];
function showCommitToast(msg){
  let el=document.getElementById('_commit_toast');
  if(!el){el=document.createElement('div');el.id='_commit_toast';el.className='commit-toast';document.body.appendChild(el);}
  el.textContent=msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t=setTimeout(()=>el.classList.remove('show'),3500);
}

/* ── OVERRIDE snuffTorch / toggleImmunity to add commentary ── */
// Store originals before redefining
const _snuffTorchOrig=(id)=>{
  const r=ROSTER.find(x=>x.id===id);if(!r)return;if(r.immunity){toast(r.first+' has immunity',true);return;}if(r.torches>0){r.torches--;save();renderRoster();renderRosterDetail(r);renderSurvivorIf();if(r.torches===0)toast(`${dispName(r)} voted off the island! 🏝`,true);}
};
const _toggleImmunityOrig=(id)=>{
  const r=ROSTER.find(x=>x.id===id);if(r){r.immunity=!r.immunity;save();renderRoster();renderRosterDetail(r);renderSurvivorIf();}
};
// Patch snuffTorch on the window so callers get the new version
window.snuffTorch=function(id){
  const r=ROSTER.find(x=>x.id===id);
  const wasAlive=r&&r.torches>0&&!r.immunity;
  _snuffTorchOrig(id);
  if(!r)return;
  if(wasAlive&&r.torches===0){
    const msg=SNUFF_COMMENTS[Math.floor(Math.random()*SNUFF_COMMENTS.length)];
    setTimeout(()=>showCommitToast(`💀 ${dispName(r)} — ${msg}`),200);
  } else if(wasAlive){
    setTimeout(()=>showCommitToast(`🔥 ${r.first} — torch snuffed (${r.torches} remaining)`),200);
  }
};
window.toggleImmunity=function(id){
  const r=ROSTER.find(x=>x.id===id);const wasImmune=r&&r.immunity;
  _toggleImmunityOrig(id);
  if(r&&!wasImmune){
    const msg=IMMUNITY_COMMENTS[Math.floor(Math.random()*IMMUNITY_COMMENTS.length)];
    setTimeout(()=>showCommitToast(`👑 ${dispName(r)} — ${msg}`),200);
  }
};

/* ── V7: NEW EPISODE RUN (archive + clear) ── */
function newEpisodeRun(){
  const log=document.getElementById('run-log');
  if(!log.innerHTML.trim()){toast('Chat is already empty');return;}
  const stamp=new Date().toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
  const archived={id:'arc-'+Date.now(), date:stamp, html:log.innerHTML, epNum:state.epCount, team:state.runTeam?.name||'—'};
  if(!state.archivedChats)state.archivedChats=[];
  state.archivedChats.push(archived);
  // clear current
  log.innerHTML='';chat.history=[];chat.round=0;chat.currentTurn=0;
  _chatLogHTML='';
  document.getElementById('run-status-text').textContent='Idle';
  renderTurnChips();
  state.epCount++;
  updateEpBadge();
  save();
  toast(`📌 Ep ${state.epCount-1} archived · starting ep ${state.epCount}`);
  if(state.nav==='episodes')renderEpisodes();
}

/* ── V7: COMPARE STATUS update ── */
// Wrap fireAgentInColumn after it's defined (runs at init time via window assignment)
setTimeout(()=>{
  const _orig=fireAgentInColumn;
  window.fireAgentInColumn=async function(r,colId){
    document.getElementById('run-status-text').textContent=`Running: ${dispName(r)}…`;
    await _orig(r,colId);
  };
},0);

/* ── V7: HYBRID ROLE support ── */
// archetypeFor already parses slash-separated roles — extend it to use first part
function archetypeForHybrid(role=''){
  const primary=role.split('/')[0].trim();
  return archetypeFor(primary);
}

/* ── V8 (was V7): MACHINE RENAME & ICON ──
   Adds a Note column and full v6+v7 feature parity. The window.openMachineModal override has
   been removed since openMachineModal now goes through renderMachineListEdit which calls
   renderMachineEditRow directly. */
function renderMachineEditRow(mc){
  return`<div style="display:grid;grid-template-columns:auto auto 1fr 1fr 70px 60px 1fr auto;gap:8px;align-items:center;padding:10px 16px;border-bottom:1px solid var(--line)">
    <span style="font-size:20px;cursor:pointer" title="Click to change icon" onclick="openModelEmojiPickerMachine('${mc.id}')">${mc.icon||'🖥'}</span>
    <button onclick="openMachineColorPicker('${mc.id}')" title="Change color" style="width:22px;height:22px;border-radius:50%;background:${mc.color||'#64748b'};border:2px solid var(--line2);cursor:pointer;flex-shrink:0"></button>
    <input class="inp" id="mc-edit-name-${mc.id}" value="${esc(mc.name)}" placeholder="Name" style="font-size:12px">
    <input class="inp" id="mc-edit-url-${mc.id}"  value="${esc(mc.url)}"  placeholder="URL" style="font-size:12px">
    <input class="inp" id="mc-edit-vram-${mc.id}" value="${mc.vram||0}" type="number" min="0" placeholder="GB" style="font-size:12px">
    <select class="inp" id="mc-edit-platform-${mc.id}" style="font-size:11px">
      <option value="apple"${mc.platform==='apple'?' selected':''}>Apple</option>
      <option value="cuda"${mc.platform==='cuda'?' selected':''}>CUDA</option>
      <option value=""${!mc.platform?' selected':''}>?</option>
    </select>
    <input class="inp" id="mc-edit-note-${mc.id}" value="${esc(mc.note||'')}" placeholder="Note" style="font-size:12px">
    <div style="display:flex;gap:5px">
      <button class="btn btn-sm btn-primary" onclick="saveMachineEdit('${mc.id}')">Save</button>
      <button class="btn btn-sm btn-danger" onclick="deleteMachine('${mc.id}')">✕</button>
    </div>
  </div>`;
}
function saveMachineEdit(id){
  const mc=MACHINES.find(x=>x.id===id);if(!mc)return;
  mc.name=(document.getElementById('mc-edit-name-'+id)?.value||mc.name).trim()||mc.name;
  mc.url=(document.getElementById('mc-edit-url-'+id)?.value||mc.url).trim()||mc.url;
  mc.vram=parseFloat(document.getElementById('mc-edit-vram-'+id)?.value)||mc.vram;
  mc.platform=document.getElementById('mc-edit-platform-'+id)?.value||mc.platform||'';
  mc.note=(document.getElementById('mc-edit-note-'+id)?.value||'').trim();
  saveMachines();renderMachines();renderMachineListEdit();renderLiveStatus();updateNodesSub();
  toast(`${mc.name} saved ✓`);
}
// MACHINE_ICONS replaced by MACHINE_EMOJIS in emoji picker above

/* ── V7: EPISODES DATA & UI ── */
let EPISODES=JSON.parse(localStorage.getItem('lmmp_v7_episodes')||'null')||[];
function saveEpisodes(){localStorage.setItem('lmmp_v7_episodes',JSON.stringify(EPISODES.slice(-100)));}

const TASK_TYPES=[
  {id:'prompt',icon:'💬',label:'Prompt',color:'var(--blue)',desc:'Send a specific prompt to the team or individual models'},
  {id:'interview',icon:'🎤',label:'Interview',color:'var(--accent)',desc:'Run interview questions against selected models'},
  {id:'compare',icon:'⚖',label:'Compare',color:'var(--purple)',desc:'Run all models on same prompt side-by-side'},
  {id:'score',icon:'★',label:'Score Review',color:'var(--amber)',desc:'Manual scoring checkpoint — pause for human review'},
  {id:'vote',icon:'🔥',label:'Vote Off',color:'var(--red)',desc:'Elimination checkpoint — snuff lowest performer'},
];

function newEpisode(){
  const name=prompt('Episode name:',`Episode ${state.epCount+1}`);
  if(!name)return;
  const ep={id:'ep-'+Date.now(),name,icon:'🎬',team:state.runTeam?.id||null,tasks:[],created:new Date().toISOString(),archived:[]};
  EPISODES.push(ep);
  saveEpisodes();
  renderEpisodes();
  state.selEpisode=ep.id;
  renderEpisodeDetail(ep);
  toast(`Episode "${name}" created ✓`);
}

function renderEpisodes(){
  const list=document.getElementById('episode-list');if(!list)return;
  // Include archived chats as read-only episodes
  const archived=(state.archivedChats||[]).map(a=>({id:a.id,name:`Ep ${a.epNum} — ${a.team}`,icon:'📼',date:a.date,archived:true,html:a.html}));
  const all=[...EPISODES.slice().reverse(),...archived.slice().reverse()];
  if(!all.length){list.innerHTML='<div style="padding:20px;text-align:center;color:var(--tx3);font-size:11px;font-family:var(--mono)">No episodes yet<br><span style="font-size:9px;opacity:.6">Create one above, or use "📌 New Ep" in Chat</span></div>';return;}
  list.innerHTML=all.map(ep=>`
    <div class="ep-row ${state.selEpisode===ep.id?'selected':''}" onclick="selectEpisode('${ep.id}')">
      <span class="ep-row-icon">${ep.icon}</span>
      <div class="ep-row-info">
        <div class="ep-row-name">${esc(ep.name)}</div>
        <div class="ep-row-sub">${ep.archived?ep.date:(ep.tasks||[]).length+' tasks'}</div>
      </div>
    </div>`).join('');
  const sub=document.getElementById('ep-panel-sub');
  if(sub)sub.textContent=`${EPISODES.length} episodes · ${(state.archivedChats||[]).length} archived`;
}

function selectEpisode(id){
  state.selEpisode=id;
  setEpisodeFocus(id);
  renderEpisodes();
  const ep=EPISODES.find(e=>e.id===id);
  if(ep){renderEpisodeDetail(ep);return;}
  const archived=(state.archivedChats||[]).find(a=>a.id===id);
  if(archived){renderArchivedEpisode(archived);}
}

// v8.3: episodes master/detail focus on mobile, mirrors roster/teams pattern
function setEpisodeFocus(epId){
  const split=document.getElementById('episodes-split');
  if(split) split.dataset.focus='1';
}
function clearEpisodeFocus(){
  const split=document.getElementById('episodes-split');
  if(split) delete split.dataset.focus;
}

function renderArchivedEpisode(a){
  const detail=document.getElementById('episode-detail');if(!detail)return;
  detail.innerHTML=`
    <div class="ep-detail-hdr" style="padding:12px 14px;border-bottom:1px solid var(--line);background:var(--bg1);display:flex;flex-shrink:0;gap:8px">
      <div class="ep-hdr-row1">
        <button class="ep-back-btn" onclick="clearEpisodeFocus()" title="Back to episodes list">← Back</button>
        <span style="font-size:22px;flex-shrink:0">📼</span>
        <div><div style="font-size:14px;font-weight:700">Ep ${a.epNum} — ${esc(a.team)}</div><div style="font-size:11px;color:var(--tx3);font-family:var(--mono)">${a.date}</div></div>
      </div>
    </div>
    <div style="padding:10px 14px;font-size:11px;color:var(--tx3);font-family:var(--mono);border-bottom:1px solid var(--line);flex-shrink:0">Archived chat log · read-only</div>
    <div class="ep-detail-body" style="flex:1;overflow-y:auto;padding:12px 16px">${a.html}</div>`;
}

function renderEpisodeDetail(ep){
  const detail=document.getElementById('episode-detail');if(!detail)return;
  const teamOpts=TEAMS.map(t=>`<option value="${t.id}"${ep.team===t.id?' selected':''}>${esc(t.icon+' '+t.name)}</option>`).join('');
  // v8.1: if ep is paused mid-run (after a Score block), show Continue + Reset instead of Run
  const paused=(typeof ep.pausedAt==='number'&&ep.pausedAt>=0&&ep.pausedAt<(ep.tasks||[]).length);
  const runButtons=paused
    ?`<button class="btn btn-sm btn-primary" onclick="runEpisode('${ep.id}')" title="Continue from task ${ep.pausedAt+1}">▶ Continue (${ep.pausedAt+1}/${ep.tasks.length})</button>
      <button class="btn btn-sm" onclick="resetEpisodeProgress('${ep.id}')" title="Clear pause and start fresh next run">↺ Reset</button>`
    :`<button class="btn btn-sm btn-primary" onclick="runEpisode('${ep.id}')">▶ Run</button>`;
  detail.innerHTML=`
    <!-- v8.4: two-row header — row1: back+icon+name, row2: team+actions -->
    <div class="ep-detail-hdr" style="padding:12px 14px;border-bottom:1px solid var(--line);background:var(--bg1);display:flex;align-items:center;gap:10px;flex-shrink:0">
      <div class="ep-hdr-row1">
        <button class="ep-back-btn" onclick="clearEpisodeFocus()" title="Back to episodes list">← Back</button>
        <span style="font-size:22px;cursor:pointer;flex-shrink:0" onclick="cycleEpIcon('${ep.id}')" title="Click to change icon">${ep.icon}</span>
        <div style="flex:1;min-width:0">
          <input class="inp" id="ep-name-${ep.id}" value="${esc(ep.name)}" style="font-size:14px;font-weight:700;width:100%;background:transparent;border:none;border-bottom:1px solid transparent;color:var(--tx1)" onchange="saveEpName('${ep.id}',this.value)" onfocus="this.style.borderBottomColor='var(--blue)'" onblur="this.style.borderBottomColor='transparent'">
          <div style="font-size:10px;color:var(--tx3);font-family:var(--mono);margin-top:2px">${new Date(ep.created).toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}${paused?' · <span style="color:var(--amber)">paused at task '+(ep.pausedAt+1)+'</span>':''}</div>
        </div>
      </div>
      <div class="ep-hdr-row2">
        <select class="inp" onchange="setEpTeam('${ep.id}',this.value)" style="font-size:12px">
          <option value="">No team</option>${teamOpts}
        </select>
        ${runButtons}
        <button class="btn btn-sm" onclick="duplicateEpisode('${ep.id}')" title="Duplicate this episode">⎘ Dupe</button>
        <button class="btn btn-sm" onclick="exportEpisode('${ep.id}')" title="Export this episode as JSON">⬇ Export</button>
        <button class="btn btn-sm btn-danger" onclick="deleteEpisode('${ep.id}')">Delete</button>
      </div>
    </div>

    <!-- v8.4: scrollable task body -->
    <div class="ep-detail-body" style="flex:1;overflow-y:auto;padding:12px 16px;display:flex;flex-direction:column;gap:8px" id="ep-tasks-${ep.id}">
      ${(ep.tasks||[]).map((task,i)=>renderTaskBlock(ep.id,task,i,paused&&i===ep.pausedAt)).join('')}
    </div>

    <!-- v8.4: sticky add-block footer with ep-add-bar class for mobile scroll -->
    <div class="ep-add-bar" style="padding:10px 14px;border-top:1px solid var(--line);background:var(--bg1);display:flex;flex-wrap:wrap;gap:6px;align-items:center;flex-shrink:0">
      <span style="font-size:10px;color:var(--tx3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em">Add block</span>
      ${TASK_TYPES.map(tt=>`<button class="btn btn-sm" onclick="addTaskBlock('${ep.id}','${tt.id}')" title="${tt.desc}" style="color:${tt.color};border-color:${tt.color}44">${tt.icon} ${tt.label}</button>`).join('')}
    </div>`;
}

function renderTaskBlock(epId,task,idx,isResumePoint){
  const tt=TASK_TYPES.find(x=>x.id===task.type)||TASK_TYPES[0];
  // v8.1: highlight the task that's queued to run next when episode is paused
  const resumeStyle=isResumePoint?`box-shadow:0 0 0 1px var(--amber);position:relative`:'';
  const resumeBadge=isResumePoint?`<span style="position:absolute;top:-8px;right:8px;background:var(--amber);color:var(--bg);font-size:9px;font-family:var(--mono);padding:2px 6px;border-radius:3px;font-weight:700">NEXT</span>`:'';
  return`<div class="task-block" id="tb-${task.id}" style="border-left-color:${tt.color};${resumeStyle}">
    ${resumeBadge}
    <div class="task-block-hdr">
      <span class="task-block-num">${idx+1}</span>
      <span>${tt.icon}</span>
      <span class="task-block-type">${tt.label}</span>
      <button class="task-block-del" onclick="removeTaskBlock('${epId}','${task.id}')">✕</button>
    </div>
    ${task.type==='prompt'||task.type==='compare'?`<textarea class="inp" style="font-size:12px;width:100%;min-height:60px;resize:vertical;box-sizing:border-box" placeholder="Prompt text…" onchange="saveTaskPrompt('${epId}','${task.id}',this.value)">${esc(task.prompt||'')}</textarea>`:''}
    ${task.type==='score'?`<div style="font-size:11px;color:var(--tx3);font-family:var(--mono)">⏸ Episode will pause here for manual scoring before continuing.</div>`:''}
    ${task.type==='vote'?`<div style="font-size:11px;color:var(--tx3);font-family:var(--mono)">🔥 Lowest-scored model will be voted off at this checkpoint.</div>`:''}
    ${task.type==='interview'?`<textarea class="inp" style="font-size:12px;width:100%;min-height:60px;resize:vertical;box-sizing:border-box" placeholder="Interview question (blank = use global)…" onchange="saveTaskPrompt('${epId}','${task.id}',this.value)">${esc(task.prompt||'')}</textarea>`:''}
  </div>`;
}

function addTaskBlock(epId,type){
  const ep=EPISODES.find(e=>e.id===epId);if(!ep)return;
  if(!ep.tasks)ep.tasks=[];
  ep.tasks.push({id:'tk-'+Date.now(),type,prompt:''});
  saveEpisodes();
  renderEpisodeDetail(ep);
}
function removeTaskBlock(epId,taskId){
  const ep=EPISODES.find(e=>e.id===epId);if(!ep)return;
  ep.tasks=(ep.tasks||[]).filter(t=>t.id!==taskId);
  saveEpisodes();renderEpisodeDetail(ep);
}
function saveTaskPrompt(epId,taskId,val){
  const ep=EPISODES.find(e=>e.id===epId);if(!ep)return;
  const task=(ep.tasks||[]).find(t=>t.id===taskId);if(!task)return;
  task.prompt=val;saveEpisodes();
}
function saveEpName(epId,val){
  const ep=EPISODES.find(e=>e.id===epId);if(!ep)return;
  ep.name=(val||'').trim()||ep.name;saveEpisodes();renderEpisodes();
}
function setEpTeam(epId,teamId){
  const ep=EPISODES.find(e=>e.id===epId);if(!ep)return;
  ep.team=teamId||null;saveEpisodes();
}
const EP_ICONS=['🎬','⚡','🧪','🏁','🔬','🎯','🚀','🏆','🔥','💡'];
function cycleEpIcon(epId){
  const ep=EPISODES.find(e=>e.id===epId);if(!ep)return;
  const idx=EP_ICONS.indexOf(ep.icon);
  ep.icon=EP_ICONS[(idx+1)%EP_ICONS.length];
  saveEpisodes();renderEpisodes();renderEpisodeDetail(ep);
}
function deleteEpisode(id){
  if(!confirm('Delete this episode?'))return;
  EPISODES=EPISODES.filter(e=>e.id!==id);
  saveEpisodes();state.selEpisode=null;renderEpisodes();
  const detail=document.getElementById('episode-detail');
  if(detail)detail.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--tx3);font-size:12px;font-family:var(--mono)">Select or create an episode</div>';
}

// v8.1: duplicate an episode (fresh IDs, "(copy)" suffix, no resume state)
function duplicateEpisode(id){
  const src=EPISODES.find(e=>e.id===id);if(!src)return;
  const copy={
    id:'ep-'+Date.now(),
    name:src.name+' (copy)',
    icon:src.icon,
    team:src.team,
    tasks:(src.tasks||[]).map((t,i)=>({id:'tk-'+Date.now()+'-'+i,type:t.type,prompt:t.prompt||''})),
    created:new Date().toISOString(),
    archived:[],
    pausedAt:null
  };
  EPISODES.push(copy);saveEpisodes();
  state.selEpisode=copy.id;renderEpisodes();renderEpisodeDetail(copy);
  toast(`Duplicated as "${copy.name}"`);
}

// v8.1: export a single episode (definition only — tasks, name, icon, team-id) as JSON.
// Does NOT include archived chat logs or run state. Pause state is reset on export so
// imports start clean.
function exportEpisode(id){
  const ep=EPISODES.find(e=>e.id===id);if(!ep)return;
  const payload={
    version:'lmmp_v8.1_episode',
    exported:new Date().toISOString(),
    episode:{
      name:ep.name,
      icon:ep.icon,
      team:ep.team||null, // team ID — may not match on import target system
      tasks:(ep.tasks||[]).map(t=>({type:t.type,prompt:t.prompt||''}))
    }
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  const slug=(ep.name||'episode').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);
  a.download=`lmmp-episode-${slug||'untitled'}.json`;
  a.click();URL.revokeObjectURL(a.href);
  toast(`Exported "${ep.name}" ✓`);
}

function triggerEpisodeImport(){document.getElementById('ep-import-file').click();}
function importEpisode(evt){
  const file=evt.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const d=JSON.parse(e.target.result);
      // Accept: full episode export (preferred) OR a bare episode object OR an array of episodes
      const eps=[];
      if(d&&d.version==='lmmp_v8.1_episode'&&d.episode){
        eps.push(d.episode);
      }else if(Array.isArray(d)){
        for(const it of d){if(it&&it.tasks)eps.push(it);}
      }else if(d&&Array.isArray(d.episodes)){
        for(const it of d.episodes){if(it&&it.tasks)eps.push(it);}
      }else if(d&&d.tasks){
        eps.push(d);
      }
      if(!eps.length)throw new Error('No episode data found');
      let imported=0;
      for(const src of eps){
        // assign fresh IDs throughout to avoid collisions; team ID kept verbatim (may need re-assignment)
        const copy={
          id:'ep-'+Date.now()+'-'+imported,
          name:(src.name||'Imported episode'),
          icon:src.icon||'🎬',
          team:src.team||null,
          tasks:(src.tasks||[]).map((t,i)=>({id:'tk-'+Date.now()+'-'+imported+'-'+i,type:t.type||'prompt',prompt:t.prompt||''})),
          created:new Date().toISOString(),
          archived:[],
          pausedAt:null
        };
        // Validate team still exists; clear it if not
        if(copy.team&&!TEAMS.find(t=>t.id===copy.team))copy.team=null;
        EPISODES.push(copy);imported++;
      }
      saveEpisodes();renderEpisodes();
      toast(`Imported ${imported} episode${imported===1?'':'s'} ✓ — ${eps[0].team&&!TEAMS.find(t=>t.id===eps[0].team)?'reassign team in detail panel':'review and run'}`);
    }catch(err){toast('Import failed: '+err.message,true);}
    evt.target.value='';
  };
  reader.readAsText(file);
}
async function runEpisode(epId){
  const ep=EPISODES.find(e=>e.id===epId);if(!ep)return;
  if(!ep.tasks||!ep.tasks.length){toast('Add at least one task block first',true);return;}
  const team=ep.team?TEAMS.find(t=>t.id===ep.team):state.runTeam;
  if(!team){toast('Assign a team to this episode first',true);return;}
  // v8: reset stopRequested so a previous Stop doesn't kill this run on its first task
  chat.stopRequested=false;
  // v8: save original compareMode and restore at the end so episodes don't leak state
  const originalCompareMode=state.compareMode;
  // v8.1: support resume — start at pausedAt if set, otherwise from 0
  const startIdx=(typeof ep.pausedAt==='number'&&ep.pausedAt>=0&&ep.pausedAt<ep.tasks.length)?ep.pausedAt:0;
  if(startIdx>0)toast(`▶ Resuming "${ep.name}" from task ${startIdx+1}`);
  // Navigate to chat and run
  state.runTeam=team;
  setNav('run');
  let pausedHere=false;
  for(let i=startIdx;i<ep.tasks.length;i++){
    const task=ep.tasks[i];
    if(chat.stopRequested)break;
    if(task.type==='score'){
      if(chat.stopRequested)break;
      if(APP.epAutoAdvance){
        // auto-advance: don't pause, just continue to next task
        toast(`⚡ Score block — auto-advancing (scoring deferred)`);
        continue;
      }
      // v8.1: persist resume point so user can come back and Continue
      ep.pausedAt=i+1; // resume on the task AFTER the score block
      saveEpisodes();
      pausedHere=true;
      const remaining=ep.tasks.length-(i+1);
      toast(`⏸ Score checkpoint — score responses, then click ▶ Continue (${remaining} task${remaining===1?'':'s'} remaining)`,false);
      break;
    }
    if(task.type==='vote'){
      // auto-snuff lowest scoring active member of team
      // v8: skip models with no scored sessions yet (finalScore===null) instead of treating them as -1.
      // Punishing untested models on Vote was unintentional.
      const members=team.members.map(id=>ROSTER.find(r=>r.id===id)).filter(r=>r&&r.torches>0&&!r.immunity);
      const scored=members
        .map(r=>({r,score:rosterAggregate(r).finalScore}))
        .filter(x=>x.score!=null);
      if(scored.length){
        scored.sort((a,b)=>a.score-b.score);
        snuffTorch(scored[0].r.id);
      } else if(members.length){
        toast('No scored members yet — Vote skipped',true);
      }
      continue;
    }
    if(task.type==='interview'){
      // v8: fire interview prompt (task-specific or global) at every team member, sequentially.
      // sendInterview(rid, overrideText) was extended to accept a programmatic prompt.
      const promptText=(task.prompt||'').trim()||interviewPrompt||'';
      if(!promptText){ toast('No interview prompt set',true); continue; }
      for(const memberId of team.members){
        if(chat.stopRequested)break;
        await sendInterview(memberId, promptText);
        await sleep(300);
      }
      continue;
    }
    if(task.type==='prompt'||task.type==='compare'){
      const inp=document.getElementById('run-prompt');
      if(inp&&task.prompt){inp.value=task.prompt;autoGrow(inp);}
      if(task.prompt){
        // v8: set compareMode per-task so a `compare` block followed by a `prompt` block doesn't run prompt in compare mode
        state.compareMode=(task.type==='compare');
        await sendChatMessage();
        await sleep(500);
      }
    }
  }
  // v8: restore original compareMode after episode finishes
  state.compareMode=originalCompareMode;
  // v8.1: clear pause state if we ran to completion (or were stopped); only keep it if we hit a Score checkpoint
  if(!pausedHere){ ep.pausedAt=null; saveEpisodes(); }
  // v8: do NOT increment state.epCount here — runAutoRound and runCompare already do it per round inside sendChatMessage
  save();
  // v8.1: re-render the episode detail so Continue/Run buttons reflect new state
  if(state.selEpisode===ep.id)renderEpisodeDetail(ep);
  if(!pausedHere)toast(`Episode "${ep.name}" complete`);
}

// v8.1: clear an episode's resume state so the next Run starts fresh
function resetEpisodeProgress(epId){
  const ep=EPISODES.find(e=>e.id===epId);if(!ep)return;
  if(ep.pausedAt==null)return;
  ep.pausedAt=null;saveEpisodes();renderEpisodeDetail(ep);
  toast(`"${ep.name}" reset to start`);
}

/* ── V8.4: INLINE INTERVIEW PROMPT EDITOR ── */
function toggleIvPromptInline(rid){
  const el=document.getElementById('iv-prompt-inline-'+rid);
  if(!el)return;
  const open=el.style.display==='flex';
  el.style.display=open?'none':'flex';
  el.style.flexDirection='column';
  // Refresh textarea with current prompt when opening
  if(!open){
    const ta=document.getElementById('iv-prompt-inline-ta-'+rid);
    if(ta)ta.value=interviewPrompt;
  }
}
function applyIvPromptInline(rid){
  const ta=document.getElementById('iv-prompt-inline-ta-'+rid);
  if(!ta)return;
  saveInterviewPrompt(ta.value.trim()||interviewPrompt);
  toast('Interview prompt saved ✓');
  // sync modal textarea if open
  const mta=document.getElementById('iv-prompt-textarea');if(mta)mta.value=interviewPrompt;
}
function resetIvPromptInline(rid){
  saveInterviewPrompt(DEFAULT_INTERVIEW_PROMPT);
  const ta=document.getElementById('iv-prompt-inline-ta-'+rid);
  if(ta)ta.value=DEFAULT_INTERVIEW_PROMPT;
  const mta=document.getElementById('iv-prompt-textarea');if(mta)mta.value=DEFAULT_INTERVIEW_PROMPT;
  toast('Interview prompt reset to default');
}

