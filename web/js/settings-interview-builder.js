/* ── AUTO-CLASSIFY PROMPT ── */
function classifyPrompt(prompt=''){
  const p=prompt.toLowerCase();
  if(/\b(func|function|class|struct|var|let|const|swift|kotlin|python|code|bug|refactor|implement|compile|syntax|error|crash|algorithm|array|loop|async|await|actor)\b/.test(p)) return 'Code';
  if(/\b(why|explain|reason|analyze|analyse|compare|evaluate|think|consider|pros|cons|difference|between|how does|what is|causes|effect)\b/.test(p)) return 'Reasoning';
  if(/\b(write|story|creative|design|describe|imagine|invent|generate|narrative|character|plot|poem|script|dialogue|fiction)\b/.test(p)) return 'Creative';
  return 'General';
}

/* ── SETTINGS PANEL ── */
function toggleSettingsPanel(){
  // Settings is now a routed tab — navigate to it (or back to machines if already there)
  if(state.nav==='settings') setNav('machines');
  else { setNav('settings'); setBnActive('bn-settings'); }
}

function updateSettingsPanel(){
  // Theme
  const btn=document.getElementById('sp-theme-btn');
  if(btn)btn.textContent=state.theme==='dark'?'🌙 Dark':'☀ Light';

  // Inference
  setSpVal('gs-max-tokens',   APP.maxTokens??8192);
  setSpVal('sp-timeout',      APP.requestTimeoutSec??180);
  setSpVal('sp-default-temp', APP.defaultTemp??0.5);
  setSpChecked('sp-thinking', APP.thinkingEnabled??false);
  setSpChecked('sp-auto-check-machines', APP.autoCheckMachines??false);

  // Director
  setSpVal('sp-director-name', APP.directorName||'The operator');
  setSpVal('sp-global-suffix', APP.globalSuffix||'');
  setSpVal('sp-brand-name',    APP.brandName||'LM Manager Pro Web');

  // Group Chat
  setSpVal('gs-max-rounds', APP.maxRounds??1);
  setSpVal('gs-history',    APP.historyDepth||'all');
  setSpVal('gs-pause',      APP.pauseBetweenAgentsSec??0);
  setSpChecked('gs-skip-fired', APP.skipVotedOff??true);
  setSpChecked('gs-crosstalk',  APP.crossTalk??true);

  // Interview builder
  setSpChecked('sp-iv-autoclear', APP.interviewAutoClear??false);
  updateIvBuilderPanel();

  // Episodes
  setSpChecked('sp-ep-autoadvance', APP.epAutoAdvance??false);
  setSpVal('sp-ep-timeout', APP.epBlockTimeout??120);

  // Scoring signals
  renderScoreSignals();

  // Leaderboard
  const bsort=document.getElementById('sp-board-sort');
  if(bsort)bsort.value=APP.boardSort||'score';
  const sview=document.getElementById('sp-survivor-view');
  if(sview)sview.value=APP.survivorView||'list';
  setSpChecked('sp-show-voted', APP.survivorShowVoted??true);

  // Roster — default machine dropdown
  const dmEl=document.getElementById('sp-default-machine');
  if(dmEl){
    dmEl.innerHTML='<option value="">— none —</option>'+
      MACHINES.map(m=>`<option value="${m.id}"${APP.defaultMachine===m.id?' selected':''}>${m.icon} ${m.name}</option>`).join('');
  }

  // Roles grid
  const rg=document.getElementById('sp-roles-grid');
  if(rg){
    rg.innerHTML=[
      ...STATUS_LEVELS.filter(s=>s.id!=='unhired').map(s=>`<span style="font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:20px;background:var(--bg3);border:1px solid var(--line2);color:var(--tx2)">${s.label}</span>`),
      '<span style="font-size:10px;color:var(--tx4);padding:2px 4px">×</span>',
      ...SPECIALIZATIONS.map(s=>`<span style="font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:20px;background:${s.baseColor}18;border:1px solid ${s.baseColor}44;color:${s.baseColor}">${s.icon} ${s.label}</span>`),
    ].join('');
  }
  const sg=document.getElementById('sp-secondary-grid');
  if(sg){
    sg.innerHTML=SECONDARY_SPECS.map(s=>`<span style="font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:20px;background:var(--bg3);border:1px solid var(--line2);color:var(--tx3)">${s.icon} ${s.label}</span>`).join('');
  }

  // Custom roles list
  renderCustomRolesList();
}

function setSpVal(id, val){const el=document.getElementById(id);if(el)el.value=val;}
function setSpChecked(id, val){const el=document.getElementById(id);if(el)el.checked=val;}

function applyBrandName(name){
  const n=(name||'').trim()||'LM Manager Pro Web';
  APP.brandName=n;saveApp();
  saveBrandName(n);
  updateIvBuilderPanel();
  rebuildAndSaveInterviewPrompt();
}

async function applyDirectorName(name){
  APP.directorName=name.trim()||'The operator';
  saveApp();
  updateIvBuilderPanel();
  const affected=ROSTER.filter(r=>!r.promptOverridden).length;
  const shouldUpdate=affected>0
    ?await openAppDialog({
      title:'Update Auto-Generated Prompts',
      message:`Update ${affected} auto-generated prompts to use "${APP.directorName}" as Director?`,
      confirmLabel:'Update prompts',
    })
    :false;
  if(shouldUpdate){
    ROSTER.filter(r=>!r.promptOverridden).forEach(r=>r.prompt=generatePrompt(r));
    save();toast(`Prompts updated to use "${APP.directorName}" ✓`);
  }
  rebuildAndSaveInterviewPrompt();
}

/* ── INTERVIEW PROMPT BUILDER JS ── */
const IV_PRESET_KEYS_PRODUCT=['sample','ios_app','custom'];
const IV_PRESET_KEYS_STACK=['swift_mvvm','react_ts','python','node','flutter','unity','custom'];

function _activateChips(keys, prefix, active){
  keys.forEach(k=>{
    const btn=document.getElementById(prefix+k);if(!btn)return;
    const on=k===active;
    btn.style.background=on?'var(--accent)':'';
    btn.style.color=on?'#000':'';
    btn.style.borderColor=on?'var(--accent)':'';
  });
}

function setIvProductPreset(preset){
  APP.ivProductPreset=preset;saveApp();
  const ta=document.getElementById('sp-iv-product');
  if(ta){
    if(preset==='custom'){ta.value=APP.ivCustomProduct||'';ta.removeAttribute('readonly');}
    else{ta.value=IV_PRODUCT_PRESETS[preset]||'';ta.setAttribute('readonly','');}
  }
  _activateChips(IV_PRESET_KEYS_PRODUCT,'sp-iv-pp-',preset);
  rebuildAndSaveInterviewPrompt();
}

function setIvStackPreset(preset){
  APP.ivStackPreset=preset;saveApp();
  const ta=document.getElementById('sp-iv-stack');
  if(ta){
    if(preset==='custom'){ta.value=APP.ivCustomStack||'';ta.removeAttribute('readonly');}
    else{ta.value=IV_STACK_PRESETS[preset]||'';ta.setAttribute('readonly','');}
  }
  _activateChips(IV_PRESET_KEYS_STACK,'sp-iv-sp-',preset);
  rebuildAndSaveInterviewPrompt();
}

function onIvProductChange(val){
  if(APP.ivProductPreset==='custom'){APP.ivCustomProduct=val;saveApp();}
  rebuildAndSaveInterviewPrompt();
}

function onIvStackChange(val){
  if(APP.ivStackPreset==='custom'){APP.ivCustomStack=val;saveApp();}
  rebuildAndSaveInterviewPrompt();
}

function refreshIvTeamPreview(){
  const el=document.getElementById('sp-iv-team-auto');
  if(el)el.textContent=buildIvTeamLine()||'(roster is empty or all models are Unhired with no specialization)';
  rebuildAndSaveInterviewPrompt();
}

function rebuildAndSaveInterviewPrompt(){
  const prompt=buildInterviewPrompt();
  saveInterviewPrompt(prompt);
  const preview=document.getElementById('sp-iv-preview');
  if(preview)preview.textContent=prompt;
  document.querySelectorAll('[id^="iv-prompt-inline-ta-"]').forEach(ta=>ta.value=prompt);
}

function updateIvBuilderPanel(){
  // §1 Opening
  const dir=APP.directorName||'The operator';
  const appName=APP.brandName||'LM Manager Pro Web';
  const opening=document.getElementById('sp-iv-opening');
  if(opening)opening.textContent=`Hello, I'm ${dir}, Director of ${appName}.`;

  // §2 Product
  const productPreset=APP.ivProductPreset||'blank';
  const productTa=document.getElementById('sp-iv-product');
  if(productTa){
    if(productPreset==='custom'){productTa.value=APP.ivCustomProduct||'';productTa.removeAttribute('readonly');}
    else{productTa.value=IV_PRODUCT_PRESETS[productPreset]||'';productTa.setAttribute('readonly','');}
  }
  _activateChips(IV_PRESET_KEYS_PRODUCT,'sp-iv-pp-',productPreset);

  // §3 Stack
  const stackPreset=APP.ivStackPreset||'blank';
  const stackTa=document.getElementById('sp-iv-stack');
  if(stackTa){
    if(stackPreset==='custom'){stackTa.value=APP.ivCustomStack||'';stackTa.removeAttribute('readonly');}
    else{stackTa.value=IV_STACK_PRESETS[stackPreset]||'';stackTa.setAttribute('readonly','');}
  }
  const stackExtraTa=document.getElementById('sp-iv-stack-extra');
  if(stackExtraTa)stackExtraTa.value=APP.ivStackExtra||'';
  _activateChips(IV_PRESET_KEYS_STACK,'sp-iv-sp-',stackPreset);

  // §4 Team
  const teamAutoEl=document.getElementById('sp-iv-team-auto');
  if(teamAutoEl)teamAutoEl.textContent=buildIvTeamLine()||'(no active models with specializations yet)';
  const teamOverrideTa=document.getElementById('sp-iv-team-override');
  if(teamOverrideTa)teamOverrideTa.value=APP.ivTeamOverride||'';

  // §5 Ask
  const postTa=document.getElementById('sp-iv-postamble');
  if(postTa)postTa.value=APP.ivPostamble||IV_DEFAULT_POSTAMBLE;

  // Preview
  const preview=document.getElementById('sp-iv-preview');
  if(preview)preview.textContent=buildInterviewPrompt();
}

function copyInterviewPrompt(){
  const txt=interviewPrompt||'';
  if(!txt){toast('No prompt to copy',true);return;}
  const cb=()=>{
    const btn=document.getElementById('sp-iv-copy-btn');
    if(btn){const orig=btn.textContent;btn.textContent='Copied ✓';btn.style.color='var(--accent)';setTimeout(()=>{btn.textContent=orig;btn.style.color='';},1800);}
    toast('Interview prompt copied ✓');
  };
  if(navigator.clipboard&&window.isSecureContext)
    navigator.clipboard.writeText(txt).then(cb).catch(()=>fallbackCopy(txt,cb));
  else fallbackCopy(txt,cb);
}

function resetInterviewPromptToDefault(){
  APP.ivProductPreset='blank';APP.ivCustomProduct='';
  APP.ivStackPreset='blank';APP.ivCustomStack='';APP.ivStackExtra='';
  APP.ivTeamOverride='';
  APP.ivPostamble=IV_DEFAULT_POSTAMBLE;
  saveApp();
  saveInterviewPrompt(buildInterviewPrompt());
  updateIvBuilderPanel();
  toast('Interview prompt reset ✓');
}

// Legacy stub — old single-textarea prompt editor
function setIvPreset(p){ setIvProductPreset(p); }
function onIvBodyChange(v){ onIvProductChange(v); }


