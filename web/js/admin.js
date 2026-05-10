/* ── V6: GLOBAL STATS RESET ── */
function resetAllStats(){
  if(!confirm(`Reset ALL stats for all ${ROSTER.length} engineers? Roster, teams, machines, and presets are kept. Status resets to Unhired for everyone. This cannot be undone.`))return;
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  ROSTER.forEach(r=>{
    r.totalScore=0;r.episodes=0;r.avgTps=0;r.avgTtft=0;
    r.sessions=[];r.catScores={Code:[],Reasoning:[],Creative:[],General:[]};
    r.torches=3;r.immunity=false;
    // Set to Unhired — neutral color for new season
    r.statusId='unhired';r.proficiencyId='unhired';
    r.color=specColor(r.specializationId||'',  'unhired', dark);
    if(!r.promptOverridden)r.prompt=generatePrompt(r);
  });
  TIMELINE.length=0;
  state.epCount=0;
  state.sessionTracker={runs:0,tokens:0,timeMs:0,peakVram:0};
  save();
  renderRoster();renderSurvivor();updateEpBadge();updateSessionTracker();
  if(state.selRoster){const r=ROSTER.find(x=>x.id===state.selRoster);if(r)renderRosterDetail(r);}
  toast('All stats reset · everyone set to Unhired ✓');
}

/* ── WIPE ALL DATA ── */
function clearRoster(){
  if(!confirm(`Clear all ${ROSTER.length} models from the roster?\n\nMachines, teams, settings, and presets are kept.\nThis cannot be undone.`))return;
  ROSTER.length=0;
  TIMELINE.length=0;
  TEAMS.forEach(t=>t.members=[]);
  state.epCount=0;
  save();
  renderRoster();renderMachines();renderSurvivorIf();
  if(state.nav==='roster')document.getElementById('roster-detail').innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--tx3);font-size:12px;font-family:var(--mono)">Roster cleared</div>';
  toast(`Roster cleared. Machines and settings untouched.`);
}

function wipeAllData(){
  if(!confirm('⚠️ WIPE ALL DATA?\n\nThis will permanently delete:\n• Every model on the roster\n• All teams, scores, and session history\n• All episodes and presets\n• All machines\n\nThe app will reload to a completely blank state.\nThis cannot be undone. Continue?'))return;
  if(!confirm('Last chance — are you absolutely sure?\n\nClick OK to wipe everything now.'))return;
  // Write empty/zero values so the app reloads into the same blank state as first launch.
  localStorage.setItem('lmmp_v5_roster',   JSON.stringify([]));
  localStorage.setItem('lmmp_v5_teams',    JSON.stringify([]));
  localStorage.setItem('lmmp_v5_machines', JSON.stringify([]));
  localStorage.setItem('lmmp_v5_presets',  JSON.stringify([]));
  localStorage.setItem('lmmp_v5_timeline', JSON.stringify([]));
  // v8: criteria resets to defaults, not empty array (which left score sheet broken after wipe)
  localStorage.setItem('lmmp_v5_criteria', JSON.stringify(DEFAULT_CRITERIA));
  localStorage.setItem('lmmp_v7_archived', JSON.stringify([]));
  localStorage.setItem('lmmp_v7_episodes', JSON.stringify([]));
  localStorage.setItem('lmmp_v5_ep',       '0');
  localStorage.removeItem('lmmp_app_settings');
  localStorage.removeItem('lmmp_custom_roles');
  localStorage.removeItem('lmmp_v5_theme');
  localStorage.removeItem('lmmp_v5_iv_prompt');
  localStorage.removeItem('lmmp_v82_oneonone');
  localStorage.removeItem('lmmp_v7_brand');
  location.reload();
}

/* ── V6: DELETE MODEL ── */
function deleteModel(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  if(!confirm(`Remove ${dispName(r)} from the roster? All their stats will be lost.`))return;
  // remove from teams
  TEAMS.forEach(t=>{t.members=t.members.filter(m=>m!==rid);});
  ROSTER.splice(ROSTER.findIndex(x=>x.id===rid),1);
  state.selRoster=null;
  document.getElementById('roster-detail').innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--tx3);font-size:12px;font-family:var(--mono)">Select a model</div>';
  save();renderRoster();toast(`${r.first} removed`);
}

/* ── V6.1: GLOBAL INTERVIEW PROMPT ── */
/* ── COPY / PASTE PROMPT HELPERS ── */
let lastCopiedPrompt='';

function copyPromptText(rid){
  const ta=document.getElementById('prompt-edit-'+rid);
  if(!ta)return;
  const txt=ta.value.trim();if(!txt){toast('No prompt to copy',true);return;}
  const cb=()=>toast('Prompt copied ✓');
  if(navigator.clipboard&&window.isSecureContext)
    navigator.clipboard.writeText(txt).then(cb).catch(()=>fallbackCopy(txt,cb));
  else fallbackCopy(txt,cb);
}

function copyIvResponse(btn, logId){
  let txt='';
  for(const hist of Object.values(interviewHistory||{})){
    const msg=hist.find(m=>m.logId===logId);
    if(msg){const _sp=splitThinking(msg.content||'');txt=_sp.answer||msg.content||'';break;}
  }
  if(!txt){toast('Nothing to copy',true);return;}
  const cb=()=>{
    toast('Response copied ✓');
    if(btn){const o=btn.textContent;btn.textContent='✓';btn.style.color='var(--accent)';setTimeout(()=>{btn.textContent=o;btn.style.color='';},2000);}
  };
  if(navigator.clipboard&&window.isSecureContext)
    navigator.clipboard.writeText(txt).then(cb).catch(()=>fallbackCopy(txt,cb));
  else fallbackCopy(txt,cb);
}

function copyIvPrompt(btn){
  const ta=document.getElementById('iv-prompt-textarea');if(!ta)return;
  const txt=ta.value.trim();if(!txt){toast('No prompt to copy',true);return;}
  lastCopiedPrompt=txt;
  fallbackCopy(txt,()=>{
    toast('Interview prompt copied ✓');
    if(btn){const orig=btn.textContent;btn.textContent='✓';btn.style.color='var(--accent)';setTimeout(()=>{btn.textContent=orig;btn.style.color='';},2000);}
    // update all paste buttons to show they have something
    document.querySelectorAll('.iv-paste').forEach(b=>b.style.opacity='1');
  });
}

function copyPreset(id){
  const p=PRESETS.find(x=>x.id===id);if(!p)return;
  lastCopiedPrompt=p.text;
  fallbackCopy(p.text,()=>{
    toast(`"${p.name}" copied ✓`);
    document.querySelectorAll('.iv-paste').forEach(b=>b.style.opacity='1');
  });
}

function copyIvPromptInline(rid, btn){
  const ta=document.getElementById('iv-prompt-inline-ta-'+rid);
  const txt=(ta?ta.value:interviewPrompt)||'';
  if(!txt){toast('No prompt to copy',true);return;}
  const cb=()=>{
    toast('Prompt copied ✓');
    if(btn){const o=btn.textContent;btn.textContent='✓';btn.style.color='var(--accent)';setTimeout(()=>{btn.textContent=o;btn.style.color='';},2000);}
  };
  if(navigator.clipboard&&window.isSecureContext)
    navigator.clipboard.writeText(txt).then(cb).catch(()=>fallbackCopy(txt,cb));
  else fallbackCopy(txt,cb);
}

function pasteInterviewPrompt(rid){
  const inp=document.getElementById('iv-input-'+rid);
  if(!inp)return;
  const txt=interviewPrompt||'';
  if(!txt){toast('No interview prompt set — add one via 🎤 Prompt',true);return;}
  inp.value=txt;
  autoGrow(inp);
  inp.focus();
}

function pastePrompt(rid){
  if(!lastCopiedPrompt){toast('Copy a prompt first',true);return;}
  const inp=document.getElementById('iv-input-'+rid);if(!inp)return;
  inp.value=lastCopiedPrompt;
  autoGrow(inp);
  inp.focus();
  // move cursor to end
  inp.selectionStart=inp.selectionEnd=inp.value.length;
}

function openIvPromptModal(){
  const ta=document.getElementById('iv-prompt-textarea');
  if(ta)ta.value=interviewPrompt;
  document.getElementById('iv-prompt-modal').style.display='flex';
}
function closeIvPromptModal(){
  document.getElementById('iv-prompt-modal').style.display='none';
}
function applyIvPrompt(){
  const ta=document.getElementById('iv-prompt-textarea');
  if(!ta)return;
  saveInterviewPrompt(ta.value.trim());
  // clear all open interview threads so they pick up new prompt
  Object.keys(interviewHistory).forEach(rid=>delete interviewHistory[rid]);
  closeIvPromptModal();
  toast('Interview prompt saved · open threads cleared ✓');
}
function resetIvPrompt(){
  const ta=document.getElementById('iv-prompt-textarea');
  if(ta)ta.value=DEFAULT_INTERVIEW_PROMPT;
}


function setBoardSort(key){
  state.boardSort=key;APP.boardSort=key;saveApp();
  ['score','tps','ep'].forEach(k=>{
    const b=document.getElementById('bsort-'+k);
    if(b)b.style.background=k===key?'var(--accent)':'';
    if(b)b.style.color=k===key?'#000':'';
    if(b)b.style.borderColor=k===key?'var(--accent)':'';
  });
  renderSurvivor();
}
