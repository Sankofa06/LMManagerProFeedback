/* ── TASK TAGGING ── */
// Rebuild catScores buckets from all sessions for a roster member.
// Call whenever sessions are added, scores change, or taskType is set.
function rebuildCatScores(r){
  if(!r.catScores)r.catScores={Code:[],Reasoning:[],Creative:[],General:[]};
  ['Code','Reasoning','Creative','General'].forEach(cat=>{
    const tagged=(r.sessions||[]).filter(s=>s.taskType===cat&&(s.scores||s.autoQ!=null));
    r.catScores[cat]=tagged.map(s=>{const a=avgCriteriaScore(s.scores);return a!=null?a:s.autoQ||0;});
  });
}
function tagSession(rid,logId,taskType){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const sess=r.sessions?.find(s=>s.logId===logId);
  if(sess){sess.taskType=sess.taskType===taskType?null:taskType;}
  rebuildCatScores(r);
  // update chip UI
  const colors={Code:'#3b82f6',Reasoning:'#a855f7',Creative:'#f59e0b',General:'#22c55e'};
  ['Code','Reasoning','Creative','General'].forEach(cat=>{
    const chip=document.getElementById(`${logId}-cat-${cat}`);if(!chip)return;
    const c=colors[cat];const isActive=sess?.taskType===cat;
    chip.style.borderColor=isActive?c:c+'33';chip.style.color=isActive?'#fff':c+'88';chip.style.background=isActive?c:'transparent';
    chip.title=isActive?`Tagged: ${cat} · click to remove`:`Tag this response as ${cat}`;
  });
  save();renderSurvivorIf();
}

function openStatsModal(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const h=rclr(r),mc=MACHINES.find(x=>x.id===r.machine);
  // set header
  const av=document.getElementById('modal-avatar');if(av){av.style.background=h+'18';av.style.color=h;av.style.border='1px solid '+h+'33';av.textContent=avatarContent(r); av.style.fontSize=r.emoji?'22px':'';}
  document.getElementById('modal-name').textContent=`${dispName(r)}`;
  document.getElementById('modal-sub').textContent=`${r.role} · ${mc?.icon||''} ${mc?.name||r.machine} · ${r.model}`;
  const body=document.getElementById('modal-body');body.innerHTML='';
  // speed stats
  const _agg=rosterAggregate(r);
  const avgQ=_agg.finalScore!=null?_agg.finalScore.toFixed(1):'—';
  const avgTps=r.avgTps>0?r.avgTps.toFixed(1)+' t/s':'—';
  const avgTtft=r.avgTtft>0?r.avgTtft.toFixed(2)+'s':'—';
  const sp=document.createElement('div');sp.className='stat-row';
  sp.innerHTML=`
    <div class="stat-pill good"><span class="sp-lbl">Score</span><span class="sp-val">${avgQ}/10</span></div>
    <div class="stat-pill"><span class="sp-lbl">Avg TPS</span><span class="sp-val">${avgTps}</span></div>
    <div class="stat-pill"><span class="sp-lbl">Avg TTFT</span><span class="sp-val">${avgTtft}</span></div>
    <div class="stat-pill"><span class="sp-lbl">Episodes</span><span class="sp-val">${r.episodes}</span></div>
    <div class="stat-pill"><span class="sp-lbl">Torches</span><span class="sp-val">${r.torches<=0?'OUT':'🔥'.repeat(r.torches)}</span></div>
  `;
  body.appendChild(sp);
  // category score bars
  if(r.catScores){
    const colors={Code:'#3b82f6',Reasoning:'#a855f7',Creative:'#f59e0b',General:'#22c55e'};
    const catDiv=document.createElement('div');
    catDiv.innerHTML='<div style="font-size:10px;color:var(--tx3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Category Scores</div>';
    Object.entries(r.catScores).forEach(([cat,scores])=>{
      if(!scores.length)return;
      const avg=(scores.reduce((a,b)=>a+b,0)/scores.length);
      const c=colors[cat];
      const row=document.createElement('div');row.className='cat-bar-row';
      row.innerHTML=`<span class="cat-bar-label" style="color:${c}">${cat}</span><div class="cat-bar-track"><div class="cat-bar-fill" style="width:${Math.min(100,avg/10*100)}%;background:${c}"></div></div><span class="cat-bar-val">${avg.toFixed(1)}/10</span>`;
      catDiv.appendChild(row);
    });
    if(catDiv.children.length>1)body.appendChild(catDiv);
  }
  // session history table
  const sessions=(r.sessions||[]).slice().reverse();
  if(sessions.length){
    const tableWrap=document.createElement('div');
    tableWrap.innerHTML=`<div style="font-size:10px;color:var(--tx3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px">Session History</div>
    <div style="overflow-x:auto"><table class="session-table">
      <thead><tr><th>#</th><th>Date</th><th>Team</th><th>Type</th><th>Score</th><th>TPS</th><th>TTFT</th><th>Think</th><th>Tokens</th><th>Time</th></tr></thead>
      <tbody>${sessions.map((s,i)=>`<tr>
        <td style="color:var(--tx3)">${sessions.length-i}</td>
        <td>${new Date(s.date).toLocaleDateString([],{month:'short',day:'numeric'})}</td>
        <td>${esc(s.team)}</td>
        <td>${s.taskType?`<span style="font-size:9px;padding:2px 6px;border-radius:10px;background:rgba(99,102,241,.15);color:#a5b4fc">${s.taskType}</span>`:'<span style="color:var(--tx3)">—</span>'}</td>
        <td>${(()=>{const a=avgCriteriaScore(s.scores);return a!=null?`<span style="color:${a>=7?'var(--accent)':a>=4?'var(--amber)':'var(--red)'}">${a}/10</span>`:s.autoQ!=null?`<span style="color:var(--tx3)">${s.autoQ}/10 auto</span>`:'<span style="color:var(--tx3)">—</span>'})()}</td>
        <td>${s.tps}</td>
        <td>${s.ttft}s</td>
        <td style="color:${(s.thinkTokens||0)>500?'var(--amber)':(s.thinkTokens||0)>0?'var(--tx2)':'var(--tx4)'}">${s.thinkTokens||0}</td>
        <td>${s.tokens}</td>
        <td>${s.elapsed}s</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
    body.appendChild(tableWrap);
  } else {
    body.innerHTML+='<div style="color:var(--tx3);font-size:12px;font-family:var(--mono);text-align:center;padding:20px 0">No sessions recorded yet</div>';
  }
  document.getElementById('stats-modal').classList.add('open');
}

function closeModal(e){
  if(e.target.id==='stats-modal')document.getElementById('stats-modal').classList.remove('open');
}

/* ── SORT STATE ── */
let sortKey='quality';
const SORT_KEYS=[
  {key:'quality',label:'Quality'},
  {key:'tps',label:'Speed (TPS)'},
  {key:'ttft',label:'TTFT'},
  {key:'episodes',label:'Episodes'},
  {key:'torches',label:'Torches'},
];

function setSortKey(k){sortKey=k;renderSurvivor();}

function sortedRoster(){
  const all=[...ROSTER];
  const active=all.filter(r=>r.torches>0);
  const fired=all.filter(r=>r.torches<=0);
  const sf=r=>{
    if(sortKey==='quality'){const a=rosterAggregate(r);return a.finalScore??-1;}
    if(sortKey==='tps')return r.avgTps||0;
    if(sortKey==='ttft')return r.avgTtft>0?-r.avgTtft:0; // lower is better
    if(sortKey==='episodes')return r.episodes||0;
    if(sortKey==='torches')return r.torches||0;
    return 0;
  };
  active.sort((a,b)=>sf(b)-sf(a));
  fired.sort((a,b)=>sf(b)-sf(a));
  return [...active,...fired];
}

/* ── SURVIVOR ── */
function setSurvivorView(mode){
  state.survivorView=mode;APP.survivorView=mode;saveApp();
  document.getElementById('sv-view-card')?.classList.toggle('active', mode==='card');
  document.getElementById('sv-view-list')?.classList.toggle('active', mode==='list');
  const grid=document.getElementById('survivor-grid');
  const list=document.getElementById('survivor-list');
  if(grid)grid.style.display=mode==='card'?'':'none';
  if(list)list.style.display=mode==='list'?'':'none';
  renderSurvivor();
}

function renderSurvivor(){
  const grid=document.getElementById('survivor-grid');
  const listEl=document.getElementById('survivor-list');
  if(grid)grid.innerHTML='';
  if(listEl)listEl.innerHTML='';
  updateEpBadge();

  // compute aggregate for every model
  const showVoted=APP.survivorShowVoted??true;
  const withScores=ROSTER.filter(r=>showVoted||r.torches>0).map(r=>({r, agg:rosterAggregate(r)}));
  const sortKey=APP.boardSort||state.boardSort||'score';
  withScores.sort((a,b)=>{
    if(sortKey==='score'){
      const sa=a.agg.finalScore??-1, sb=b.agg.finalScore??-1;
      return sb-sa;
    }
    if(sortKey==='tps') return (b.r.avgTps||0)-(a.r.avgTps||0);
    if(sortKey==='ep')  return (b.r.episodes||0)-(a.r.episodes||0);
    return 0;
  });
  // active first, voted-off at the bottom
  const sorted=[
    ...withScores.filter(x=>x.r.torches>0),
    ...withScores.filter(x=>x.r.torches<=0),
  ];

  const active=sorted.filter(x=>x.r.torches>0).length;
  const fired=sorted.filter(x=>x.r.torches<=0).length;
  document.getElementById('survivor-stats').textContent=`${active} active · ${fired} voted off · ep ${state.epCount}`;

  const viewMode=state.survivorView||'list';

  if(viewMode==='card'){
    sorted.forEach(({r,agg},rank)=>{
      const h=rclr(r), mc=MACHINES.find(x=>x.id===r.machine);
      const scoreDisplay=agg.finalScore!=null?agg.finalScore+'/10':'—';
      const scoreColor=agg.finalScore==null?'var(--tx3)':agg.finalScore>=7?'var(--accent)':agg.finalScore>=4?'var(--amber)':'var(--red)';
      const rankNum=r.torches>0?rank+1:'';
      const card=document.createElement('div');
      card.className='sv-card'+(r.torches<=0?' voted-off':'')+(r.immunity?' immune':'');
      card.innerHTML=`
        ${r.immunity?'<span class="sv-crown">👑</span>':''}
        ${r.torches<=0?'<span class="sv-badge out">OUT</span>':''}
        ${rankNum?`<span style="position:absolute;top:7px;right:9px;font-size:9px;font-family:var(--mono);color:var(--tx4);font-weight:700">#${rankNum}</span>`:''}
        <div class="sv-avatar" style="background:${h}18;color:${h};border:1px solid ${h}33;font-size:${r.emoji?'20px':''}">${avatarContent(r)}</div>
        <div class="sv-name" style="color:${h}">${dispName(r)}</div>
        <div class="sv-role">${r.role}</div>
        <div class="sv-torches">${[0,1,2].map(i=>`<div class="sv-torch ${i>=r.torches?'snuffed':''}"></div>`).join('')}</div>
        <div style="display:flex;align-items:baseline;gap:3px">
          <span class="sv-score" style="color:${scoreColor}">${scoreDisplay}</span>
          <span class="sv-score-lbl">${agg.finalScore!=null?`· ${r.episodes}ep`:''}</span>
        </div>
        <div style="font-size:9px;font-family:var(--mono);color:var(--tx4);margin-top:1px">
          ${agg.ivAvg!=null?`iv:${agg.ivAvg.toFixed(0)} `:''}${agg.teamAvg!=null?`team:${agg.teamAvg.toFixed(0)} `:''}${r.avgTps>0?`${r.avgTps.toFixed(0)}t/s`:''}
        </div>
        <div class="sv-machine">${mc?.icon||'?'} ${mc?.name?.split(' ')[0]||r.machine}</div>`;
      card.onclick=()=>{state.selRoster=r.id;setNav('roster');};
      grid.appendChild(card);
    });
  } else {
    // ── COMPACT LIST VIEW ──
    const thead=document.createElement('div');thead.className='sl-thead';
    thead.innerHTML=`
      <span class="sl-th">#</span>
      <span class="sl-th"></span>
      <span class="sl-th">Name · Role</span>
      <span class="sl-th">Score</span>
      <span class="sl-th">TPS</span>
      <span class="sl-th">Ep</span>
      <span class="sl-th">🔥</span>
      <span class="sl-th">Node</span>`;
    listEl.appendChild(thead);

    sorted.forEach(({r,agg},rank)=>{
      const h=rclr(r), mc=MACHINES.find(x=>x.id===r.machine);
      const scoreDisplay=agg.finalScore!=null?agg.finalScore+'/10':'—';
      const scoreColor=agg.finalScore==null?'var(--tx3)':agg.finalScore>=7?'var(--accent)':agg.finalScore>=4?'var(--amber)':'var(--red)';
      const rankNum=r.torches>0?rank+1:'—';
      const row=document.createElement('div');
      row.className='sl-row'+(r.torches<=0?' voted-off':'');
      row.innerHTML=`
        <span class="sl-rank" style="color:var(--tx4)">${rankNum}</span>
        <div class="sl-avatar" style="background:${h}18;color:${h};border:1px solid ${h}33;font-size:${r.emoji?'13px':''}">${avatarContent(r)}</div>
        <div class="sl-name-cell">
          <div class="sl-name" style="color:${h}">${dispName(r)}${r.immunity?' 👑':''}</div>
          <div class="sl-role">${r.role}</div>
        </div>
        <span class="sl-score" style="color:${scoreColor}">${scoreDisplay}</span>
        <span class="sl-tps">${r.avgTps>0?r.avgTps.toFixed(1)+' t/s':'—'}</span>
        <span class="sl-ep">${r.episodes||0}</span>
        <div class="sl-torches">${r.torches<=0?'<span style="font-size:10px;color:var(--red);font-family:var(--mono);font-weight:700">OUT</span>':[0,1,2].map(i=>`<div class="sl-torch ${i>=r.torches?'snuffed':''}"></div>`).join('')}</div>
        <span class="sl-machine">${mc?.icon||'?'} ${mc?.name?.split(' ')[0]||r.machine}</span>`;
      row.onclick=()=>{state.selRoster=r.id;setNav('roster');};
      listEl.appendChild(row);
    });
  }
}
function renderSurvivorIf(){if(state.nav==='survivor')renderSurvivor();}

/* ── UTILS ── */
function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
let _tt;
function toast(msg,err=false){
  let t=document.getElementById('_t');
  if(!t){t=document.createElement('div');t.id='_t';t.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:9px 18px;border-radius:8px;font-size:12px;font-family:var(--mono);z-index:9999;pointer-events:none;transition:opacity .3s;white-space:nowrap;backdrop-filter:blur(10px);';document.body.appendChild(t);}
  t.textContent=msg;
  t.style.background=err?'rgba(239,68,68,.15)':'rgba(255,255,255,.07)';
  t.style.border=err?'1px solid rgba(239,68,68,.4)':'1px solid rgba(255,255,255,.1)';
  t.style.color=err?'var(--red)':'var(--tx1)';t.style.opacity='1';
  clearTimeout(_tt);_tt=setTimeout(()=>t.style.opacity='0',3000);
}

/* ── MARKDOWN RENDERER ── */
function renderMarkdown(raw){
  if(!raw)return'';
  let html=esc(raw);
  // fenced code blocks
  html=html.replace(/```(\w*)\n?([\s\S]*?)```/g,(_,lang,code)=>{
    const l=lang?`<span class="lang-tag">${esc(lang)}</span>`:'';
    return`<pre>${l}<code>${code.trimEnd()}</code></pre>`;
  });
  // inline code
  html=html.replace(/`([^`\n]+)`/g,'<code>$1</code>');
  // bold+italic
  html=html.replace(/\*\*\*(.+?)\*\*\*/g,'<strong><em>$1</em></strong>');
  html=html.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  html=html.replace(/\*(.+?)\*/g,'<em>$1</em>');
  // headings
  html=html.replace(/^### (.+)$/gm,'<h3>$1</h3>');
  html=html.replace(/^## (.+)$/gm,'<h2>$1</h2>');
  html=html.replace(/^# (.+)$/gm,'<h1>$1</h1>');
  // blockquote
  html=html.replace(/^&gt; (.+)$/gm,'<blockquote>$1</blockquote>');
  // hr
  html=html.replace(/^---$/gm,'<hr>');
  // unordered list (consecutive)
  html=html.replace(/((?:^[•\-\*] .+\n?)+)/gm,m=>{
    const items=m.trim().split('\n').map(l=>`<li>${l.replace(/^[•\-\*] /,'')}</li>`).join('');
    return`<ul>${items}</ul>`;
  });
  // ordered list
  html=html.replace(/((?:^\d+\. .+\n?)+)/gm,m=>{
    const items=m.trim().split('\n').map(l=>`<li>${l.replace(/^\d+\. /,'')}</li>`).join('');
    return`<ol>${items}</ol>`;
  });
  // paragraphs: split on double newline
  const blocks=html.split(/\n{2,}/);
  html=blocks.map(b=>{
    b=b.trim();if(!b)return'';
    if(/^<(h[123]|pre|ul|ol|hr|blockquote)/.test(b))return b;
    // single newlines within a para → <br>
    return`<p>${b.replace(/\n/g,'<br>')}</p>`;
  }).join('');
  return html;
}

/* ── FILTER ROSTER TABLE ── */
function filterRosterTable(q){
  q=(q||'').toLowerCase().trim();
  document.querySelectorAll('#roster-table .rt-row').forEach(row=>{
    if(!q){row.style.display='';return;}
    const text=row.textContent.toLowerCase();
    row.style.display=text.includes(q)?'':'none';
  });
  document.querySelectorAll('#roster-table .rt-section').forEach(hdr=>{
    if(!q){hdr.style.display='';return;}
    // show section if any sibling rows visible
    let sib=hdr.nextElementSibling,any=false;
    while(sib&&sib.classList.contains('rt-row')){if(sib.style.display!=='none')any=true;sib=sib.nextElementSibling;}
    hdr.style.display=any?'':'none';
  });
}

/* ── EXPORT / IMPORT ── */
function exportData(){
  const payload={version:'lmmp_v7',exported:new Date().toISOString(),roster:ROSTER,teams:TEAMS,epCount:state.epCount,timeline:TIMELINE.slice(-500),presets:PRESETS};
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`lmmp-roster-ep${state.epCount}-${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(a.href);
  toast('Roster exported ✓');
}

// Full app export — everything needed to fully restore the app on a new device
function exportFullApp(){
  const payload={
    version:'lmmp_full_v1',
    exported:new Date().toISOString(),
    app:APP,
    roster:ROSTER,
    teams:TEAMS,
    machines:MACHINES.map(m=>({...m,status:'offline',loadedModel:null,loadedInstanceId:null,modelMeta:{}})),
    episodes:EPISODES,
    customRoles:CUSTOM_ROLES,
    criteria:CRITERIA,
    presets:PRESETS,
    epCount:state.epCount,
    timeline:TIMELINE.slice(-500),
    interviewPrompt,
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`lmmp-full-${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(a.href);
  toast('Full app exported ✓');
}

function triggerFullImport(){document.getElementById('import-full-file').click();}
function importFullApp(evt){
  const file=evt.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const d=JSON.parse(e.target.result);
      if(d.version!=='lmmp_full_v1')throw new Error('Not a full app export file');
      const ok=await openAppDialog({
        title:'Restore Full App',
        message:`Restore full app from ${new Date(d.exported).toLocaleDateString()}?\n\nThis overwrites everything — roster, machines, settings, episodes, and custom roles. Cannot be undone.`,
        confirmLabel:'Restore full app',
        danger:true,
      });
      if(!ok)return;
      if(d.app){Object.assign(APP,d.app);saveApp();}
      if(d.roster)ROSTER=d.roster;
      if(d.teams)TEAMS=d.teams;
      if(d.machines)MACHINES=d.machines.map(m=>({...m,status:'offline',loadedModel:null,loadedInstanceId:null}));
      if(d.episodes)EPISODES=d.episodes;
      if(d.customRoles)CUSTOM_ROLES=d.customRoles;
      if(d.criteria)CRITERIA=d.criteria;
      if(d.presets)PRESETS=d.presets;
      if(d.epCount!=null)state.epCount=d.epCount;
      if(d.timeline)TIMELINE.splice(0,TIMELINE.length,...d.timeline);
      if(d.interviewPrompt)saveInterviewPrompt(d.interviewPrompt);
      ROSTER.forEach(r=>rebuildCatScores(r));
      save();saveMachines();saveEpisodes();saveCustomRoles();saveCriteria();
      renderMachines();renderRoster();renderTeams();renderSurvivor();updateEpBadge();renderLiveStatus();
      updateSettingsPanel();
      toast('Full app restored ✓');
    }catch(err){toast('Restore failed: '+err.message,true);}
    evt.target.value='';
  };
  reader.readAsText(file);
}

// v8.4: export a clean prompts-only file — no sessions, scores, or timeline noise.
// Each entry has just the fields needed to identify + edit the persona prompt.
function exportPrompts(){
  const entries=ROSTER.map(r=>{
    const mc=MACHINES.find(x=>x.id===r.machine);
    const meta=mc?.modelMeta?.[r.model]||null;
    return{
      id:r.id, empId:r.empId,
      name:`${dispName(r)}`,
      role:r.role, model:r.model,
      hf_url:hfUrl(r.model,meta)||null,
      machine:r.machine,
      prompt:r.prompt||''
    };
  });
  const payload={
    version:'lmmp_prompts_v1',
    exported:new Date().toISOString(),
    note:'Edit the "prompt" field for each entry, then import back via "Import persona prompts".',
    roster:entries
  };
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download=`lmmp-prompts-${new Date().toISOString().slice(0,10)}.json`;
  a.click();URL.revokeObjectURL(a.href);
  toast(`Exported ${entries.length} persona prompts ✓`);
}

// v8.4: import prompts-only file — updates prompt field on matched roster entries.
// Matches by id first, then empId, then model. Never wipes scores or sessions.
function triggerImportPrompts(){document.getElementById('import-prompts-file').click();}
function importPrompts(evt){
  const file=evt.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const d=JSON.parse(e.target.result);
      const entries=d.roster||d; // accept both wrapped and bare array
      if(!Array.isArray(entries))throw new Error('Expected a roster array');
      let updated=0;
      entries.forEach(entry=>{
        const r=ROSTER.find(x=>x.id===entry.id)
          ||ROSTER.find(x=>x.empId===entry.empId)
          ||ROSTER.find(x=>x.model===entry.model);
        if(r&&entry.prompt!=null){r.prompt=entry.prompt;r.promptOverridden=true;updated++;}
      });
      save();
      if(state.selRoster){const r=ROSTER.find(x=>x.id===state.selRoster);if(r)renderRosterDetail(r);}
      toast(`Updated ${updated} persona prompt${updated===1?'':'s'} ✓`);
    }catch(err){toast('Prompt import failed: '+err.message,true);}
    evt.target.value='';
  };
  reader.readAsText(file);
}
function triggerImport(){document.getElementById('import-file').click();}
function importData(evt){
  const file=evt.target.files[0];if(!file)return;
  const reader=new FileReader();
  reader.onload=async e=>{
    try{
      const d=JSON.parse(e.target.result);
      if(!d.roster||!Array.isArray(d.roster))throw new Error('Invalid format');
      const ok=await openAppDialog({
        title:'Import Roster Backup',
        message:`Import ${d.roster.length} models from ep ${d.epCount||0}?\n\nThis will overwrite current roster data.`,
        confirmLabel:'Import backup',
        danger:true,
      });
      if(!ok)return;
      ROSTER=d.roster;TEAMS=d.teams||TEAMS;state.epCount=d.epCount||0;
      ROSTER.forEach(r=>rebuildCatScores(r));
      save();renderMachines();renderRoster();renderTeams();renderRunPanel();renderSurvivor();
      toast('Imported ✓');
    }catch(err){toast('Import failed: '+err.message,true);}
    evt.target.value='';
  };
  reader.readAsText(file);
}

/* ── EPISODE BADGE ── */
function updateEpBadge(){const el=document.getElementById('ep-badge');if(el)el.textContent='Ep '+state.epCount;}
