let _appDialogResolve=null;
let _appDialogMode='confirm';
let _appDialogValidator=null;

function openAppDialog(opts={}){
  const modal=document.getElementById('app-dialog-modal');
  const titleEl=document.getElementById('app-dialog-title');
  const msgEl=document.getElementById('app-dialog-message');
  const inputWrap=document.getElementById('app-dialog-input-wrap');
  const inputEl=document.getElementById('app-dialog-input');
  const cancelBtn=document.getElementById('app-dialog-cancel');
  const confirmBtn=document.getElementById('app-dialog-confirm');
  if(!modal||!titleEl||!msgEl||!inputWrap||!inputEl||!cancelBtn||!confirmBtn)return Promise.resolve(null);

  _appDialogMode=opts.mode||'confirm';
  _appDialogValidator=opts.validate||null;
  titleEl.textContent=opts.title||(_appDialogMode==='prompt'?'Enter value':'Confirm');
  msgEl.textContent=opts.message||'';
  cancelBtn.textContent=opts.cancelLabel||'Cancel';
  confirmBtn.textContent=opts.confirmLabel||(_appDialogMode==='prompt'?'Save':'Confirm');
  confirmBtn.className=`btn btn-sm ${opts.danger?'btn-danger':'btn-primary'}`;

  if(_appDialogMode==='prompt'){
    inputWrap.style.display='flex';
    inputEl.value=opts.initialValue||'';
    inputEl.placeholder=opts.placeholder||'';
    setTimeout(()=>inputEl.focus(),0);
  } else {
    inputWrap.style.display='none';
    inputEl.value='';
    setTimeout(()=>confirmBtn.focus(),0);
  }

  modal.style.display='flex';
  return new Promise(resolve=>{
    _appDialogResolve=resolve;
  });
}

function closeAppDialog(result){
  const modal=document.getElementById('app-dialog-modal');
  const inputEl=document.getElementById('app-dialog-input');
  if(modal)modal.style.display='none';
  if(inputEl)inputEl.value='';
  const resolve=_appDialogResolve;
  _appDialogResolve=null;
  _appDialogValidator=null;
  if(resolve)resolve(result);
}

function submitAppDialog(){
  if(_appDialogMode==='prompt'){
    const inputEl=document.getElementById('app-dialog-input');
    const value=(inputEl?.value||'').trim();
    if(_appDialogValidator){
      const err=_appDialogValidator(value);
      if(err){toast(err,true);return;}
    }
    closeAppDialog(value);
    return;
  }
  closeAppDialog(true);
}

document.addEventListener('keydown',e=>{
  const modal=document.getElementById('app-dialog-modal');
  if(!modal||modal.style.display!=='flex')return;
  if(e.key==='Escape'){e.preventDefault();closeAppDialog(false);return;}
  if(e.key==='Enter'&&_appDialogMode==='prompt'){
    const target=e.target;
    if(target&&target.id==='app-dialog-input'){e.preventDefault();submitAppDialog();}
  }
});

/* ── V6: GLOBAL STATS RESET ── */
async function resetAllStats(){
  const ok=await openAppDialog({
    title:'Reset All Stats',
    message:`Reset ALL stats for all ${ROSTER.length} engineers?\n\nRoster, teams, machines, and presets are kept. Status resets to Unhired for everyone. This cannot be undone.`,
    confirmLabel:'Reset stats',
    danger:true,
  });
  if(!ok)return;
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
async function clearRoster(){
  const ok=await openAppDialog({
    title:'Clear Roster',
    message:`Clear all ${ROSTER.length} models from the roster?\n\nMachines, teams, settings, and presets are kept.\nThis cannot be undone.`,
    confirmLabel:'Clear roster',
    danger:true,
  });
  if(!ok)return;
  ROSTER.length=0;
  TIMELINE.length=0;
  TEAMS.forEach(t=>t.members=[]);
  state.epCount=0;
  save();
  renderRoster();renderMachines();renderSurvivorIf();
  if(state.nav==='roster')document.getElementById('roster-detail').innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--tx3);font-size:12px;font-family:var(--mono)">Roster cleared</div>';
  toast(`Roster cleared. Machines and settings untouched.`);
}

async function wipeAllData(){
  const firstOk=await openAppDialog({
    title:'Wipe All Data',
    message:'This will permanently delete:\n• Every model on the roster\n• All teams, scores, and session history\n• All episodes and presets\n• All machines\n\nThe app will reload to a completely blank state.\nThis cannot be undone.',
    confirmLabel:'Continue',
    danger:true,
  });
  if(!firstOk)return;
  const finalOk=await openAppDialog({
    title:'Final Confirmation',
    message:'Last chance — are you absolutely sure?\n\nConfirm to wipe everything now.',
    confirmLabel:'Wipe everything',
    danger:true,
  });
  if(!finalOk)return;
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
async function deleteModel(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const ok=await openAppDialog({
    title:'Remove Model',
    message:`Remove ${dispName(r)} from the roster?\n\nAll their stats will be lost.`,
    confirmLabel:'Remove',
    danger:true,
  });
  if(!ok)return;
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
