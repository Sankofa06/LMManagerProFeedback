/* ── ROSTER ── */
let rosterSortKey='name';
function setRosterSort(key){
  rosterSortKey=key;
  document.querySelectorAll('.rs-sort-btn').forEach(b=>b.classList.remove('active'));
  const btn=document.getElementById('rsort-'+key);if(btn)btn.classList.add('active');
  renderRoster();
}
function sortRosterGroup(group){
  const k=rosterSortKey;
  return [...group].sort((a,b)=>{
    if(k==='name') return dispName(a).localeCompare(dispName(b));
    if(k==='role') return (a.role||'').localeCompare(b.role||'');
    if(k==='score'){ const sa=rosterAggregate(a).finalScore??-1,sb=rosterAggregate(b).finalScore??-1; return sb-sa; }
    if(k==='size') return (b.size||0)-(a.size||0);
    if(k==='type'){ const ma=getModelMeta(a),mb=getModelMeta(b); return (ma.type||'').localeCompare(mb.type||''); }
    if(k==='arch'){ const ma=getModelMeta(a),mb=getModelMeta(b); return (ma.arch||'').localeCompare(mb.arch||''); }
    if(k==='family') return modelFamily(a).localeCompare(modelFamily(b));
    if(k==='machine') return (a.machine||'').localeCompare(b.machine||'');
    return 0;
  });
}

function renderRoster(){
  const scroll=document.getElementById('roster-scroll');scroll.innerHTML='';
  const detail=document.getElementById('roster-detail');
  const af=state.archetypeFilter;
  const knownMachineIds=new Set(MACHINES.map(m=>m.id));
  const byMachine={};MACHINES.forEach(m=>byMachine[m.id]=[]);
  const orphans=[];
  ROSTER.forEach(r=>{
    if(knownMachineIds.has(r.machine)) byMachine[r.machine].push(r);
    else orphans.push(r);
  });
  const renderGroup=(group,hdrHTML)=>{
    if(af)group=group.filter(r=>archetypeForRoster(r)===af);
    if(state.familyFilter)group=group.filter(r=>modelFamily(r)===state.familyFilter);
    group=sortRosterGroup(group);
    if(!group.length)return;
    const hdr=document.createElement('div');hdr.className='roster-group-hdr';
    hdr.innerHTML=hdrHTML;
    scroll.appendChild(hdr);
    group.forEach(r=>{
      const h=rclr(r);
      const row=document.createElement('div');
      row.className='roster-row'+(state.selRoster===r.id?' selected':'');
      row.style.opacity=r.torches<=0?'0.35':'1';
      // v8.3: compute score + TPS for the list row
      const agg=rosterAggregate(r);
      const scoreTxt=agg.finalScore!=null?agg.finalScore.toFixed(1):'—';
      const scoreCls=agg.finalScore!=null?'':'dim';
      const tpsTxt=r.avgTps>0?r.avgTps.toFixed(1)+' t/s':'';
      row.innerHTML=`<div class="r-avatar" style="background:${h}18;color:${h};border:1px solid ${h}33;font-size:${r.emoji?'18px':''}">${avatarContent(r)}</div><div class="r-info"><div class="r-name" style="color:${h}">${dispName(r)}</div><div class="r-role">${r.role}</div></div><div class="r-stats"><div class="r-score ${scoreCls}">${scoreTxt}</div>${tpsTxt?`<div class="r-tps">${tpsTxt}</div>`:''}</div><div class="torches">${torchHtml(r)}</div>`;
      row.onclick=()=>{state.selRoster=r.id;setRosterFocus(r.id);renderRoster();}; // v8.19: renderRoster() already calls renderRosterDetail via line below
      scroll.appendChild(row);
    });
  };
  MACHINES.forEach(mc=>renderGroup(byMachine[mc.id]||[],`<div style="width:7px;height:7px;border-radius:50%;background:${mc.color};flex-shrink:0"></div><span style="color:${mc.color}">${mc.icon} ${mc.name}</span>`));
  if(orphans.length)renderGroup(orphans,`<div style="width:7px;height:7px;border-radius:50%;background:var(--tx3);flex-shrink:0"></div><span style="color:var(--tx3)">⚠ Unassigned</span>`);
  if(!ROSTER.length){
    scroll.innerHTML='<div style="padding:24px 18px;text-align:center;color:var(--tx3);font-size:12px;font-family:var(--mono);line-height:1.6">No models in the roster yet.<br><span style="font-size:11px;color:var(--tx4)">Check your machines, then scan or add models to start building teams.</span></div>';
    if(detail)detail.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;color:var(--tx3);font-size:12px;font-family:var(--mono);text-align:center;line-height:1.6">Select a model after you add one to the roster.</div>';
    renderArchetypeLegend();
    return;
  }
  renderArchetypeLegend();
  if(state.selRoster){const r=ROSTER.find(x=>x.id===state.selRoster);if(r)renderRosterDetail(r);}
  else if(detail){
    detail.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;padding:24px;color:var(--tx3);font-size:12px;font-family:var(--mono);text-align:center;line-height:1.6">Pick a model from the roster to inspect, edit, or interview it.</div>';
  }
}

// v8.3: master/detail focus state on mobile.
// On desktop the data-focus attribute is ignored (CSS only acts in the 600px breakpoint).
function setRosterFocus(rid){
  const split=document.getElementById('roster-split');
  if(!split)return;
  split.dataset.focus='1';
  // default to Info tab when newly focusing a model
  if(!state.rosterTab) state.rosterTab='info';
}
function clearRosterFocus(){
  const split=document.getElementById('roster-split');
  if(!split)return;
  delete split.dataset.focus;
  // keep selRoster so when user comes back the model is still highlighted
}
function setRosterTab(tab){
  state.rosterTab=tab;
  // toggle active class on tabs and panes without re-rendering everything
  // (re-render would clobber any in-flight interview UI)
  document.querySelectorAll('#roster-detail .rd-tab').forEach(b=>{
    b.classList.toggle('active', b.textContent.trim().toLowerCase()===tab);
  });
  document.querySelectorAll('#roster-detail .rd-pane').forEach(p=>{
    p.classList.toggle('active', p.dataset.tab===tab);
  });
}

function renderRosterDetail(r){
  const h=rclr(r),mc=MACHINES.find(x=>x.id===r.machine);
  // v8.3: which tab to show on mobile (default 'info')
  const tab = (state.rosterTab||'info');
  document.getElementById('roster-detail').innerHTML=`
    <!-- ── BACK BUTTON + TAB STRIP (mobile only via CSS) ── -->
    <div class="rd-tab-strip">
      <button class="rd-back-btn" onclick="clearRosterFocus()" title="Back to list">← Back</button>
      <button class="rd-tab ${tab==='info'?'active':''}" onclick="setRosterTab('info')">Info</button>
      <button class="rd-tab ${tab==='edit'?'active':''}" onclick="setRosterTab('edit')">Edit</button>
      <button class="rd-tab ${tab==='interview'?'active':''}" onclick="setRosterTab('interview')">Interview</button>
    </div>

    <!-- v8.3: desktop wraps info+edit so they share a 52% scroll region; mobile ignores wrapper -->
    <div class="rd-desktop-top">

    <!-- ── INFO TAB (Info + breakdown + roster-eval) ── -->
    <div class="rd-pane rd-info-pane detail-info-pane ${tab==='info'?'active':''}" data-tab="info">
      <div class="detail-header">
        <div class="detail-avatar" style="background:${h}18;color:${h};border:1px solid ${h}33;cursor:pointer;font-size:${r.emoji?'22px':''}" onclick="openModelEmojiPicker('${r.id}')" title="Click to change avatar">${avatarContent(r)}</div>
        <div style="flex:1">
          <div class="detail-name">${dispName(r)}</div>
          ${r.nickname?`<div style="font-size:10px;color:var(--tx4);font-family:var(--mono);margin-top:1px">${r.first}${r.middle?' '+r.middle:''} ${r.last||r.role}</div>`:''}
          <div class="detail-role" style="color:${h}">${r.role}</div>
          <div style="font-size:10px;color:var(--tx3);font-family:var(--mono);margin-top:4px">${r.model}</div>
        </div>
        ${r.immunity?'<span style="font-size:20px">👑</span>':''}
      </div>
      <div class="roster-eval-card" id="roster-eval-card-${r.id}"></div>
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:11px">
        <div class="kv-grid">
          ${kv('Machine',`${mc?.icon||'?'} ${mc?.name||r.machine}`)}
          ${kv('Size',r.size+'GB')}
          ${kv('Torches',r.torches<=0?'OUT':'🔥'.repeat(r.torches))}
          ${kv('Episodes',r.episodes,`kv-${r.id}-episodes`)}
          ${kv('Total Score',(()=>{const a=rosterAggregate(r);return a.finalScore!=null?a.finalScore+'/10':'—';})(),`kv-${r.id}-final-score`)}
          ${kv('Avg TPS',r.avgTps>0?r.avgTps.toFixed(1)+' t/s':'—',`kv-${r.id}-avg-tps`)}
        </div>
        ${(()=>{
          const meta=getModelMeta(r);
          const items=[];
          if(meta.paramsLabel)items.push(kv('Params', meta.paramsLabel));
          if(meta.type)items.push(kv('Type', meta.type));
          if(meta.quant)items.push(kv('Quant', meta.quant));
          if(meta.arch)items.push(kv('Architecture', meta.arch));
          if(meta.ctxLabel)items.push(kv('Context', meta.ctxLabel));
          if(meta.publisher)items.push(kv('Publisher', meta.publisher));
          const caps=[];
          if(meta.vision)caps.push('Vision');
          if(meta.functionCalling)caps.push('Tools');
          if(caps.length)items.push(kv('Capabilities', caps.join(' · ')));
          return items.length?`<div class="kv-grid">${items.join('')}</div>`:'';
        })()}
        <div id="kv-${r.id}-breakdown" style="font-size:10px;font-family:var(--mono);color:var(--tx3);background:var(--bg2);border:1px solid var(--line);border-radius:6px;padding:8px 10px;line-height:1.7">
          ${(()=>{const a=rosterAggregate(r);
            const auto=a.autoAvg!=null?`<span style="color:var(--tx2)">Auto: <strong style="color:var(--tx1)">${a.autoAvg.toFixed(1)}/10</strong> (${a.autoCount} runs · 20%)</span>`:`<span>Auto: pending</span>`;
            const iv=a.ivAvg!=null?`<span style="color:var(--tx2)">Interview: <strong style="color:var(--tx1)">${a.ivAvg.toFixed(1)}/10</strong> (${a.ivCount} · 30%)</span>`:`<span style="color:var(--amber)">Interview: pending</span>`;
            const tm=a.teamAvg!=null?`<span style="color:var(--tx2)">Team: <strong style="color:var(--tx1)">${a.teamAvg.toFixed(1)}/10</strong> (${a.teamCount} · 50%)</span>`:`<span style="color:var(--amber)">Team contribution pending</span>`;
            return auto+'<br>'+iv+'<br>'+tm;
          })()}
        </div>
      </div>
    </div>

    <!-- ── EDIT TAB (temp/machine/prompt/buttons/edit fields) ── -->
    <div class="rd-pane rd-edit-pane ${tab==='edit'?'active':''}" data-tab="edit" style="overflow-y:auto">
      <div style="padding:12px 16px;display:flex;flex-direction:column;gap:11px">
        <div>
          <div style="font-size:10px;color:var(--tx3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Temperature</div>
          <div class="temp-row">
            <input type="range" class="temp-slider" min="0" max="1" step="0.05" value="${r.temp}"
              id="temp-slider-${r.id}"
              oninput="document.getElementById('temp-val-${r.id}').textContent=parseFloat(this.value).toFixed(2)">
            <span class="temp-val-lbl" id="temp-val-${r.id}">${r.temp.toFixed(2)}</span>
            <button class="btn btn-sm" onclick="saveTemp('${r.id}')">Save</button>
          </div>
        </div>
        <div>
          <div style="font-size:10px;color:var(--tx3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Reassign Machine</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap">
            ${MACHINES.map(mc=>`<button onclick="assignMachine('${r.id}','${mc.id}')" style="font-size:11px;padding:5px 11px;border-radius:20px;border:1px solid ${r.machine===mc.id?mc.color+'66':'var(--line2)'};background:${r.machine===mc.id?mc.color+'15':'var(--bg3)'};color:${r.machine===mc.id?mc.color:'var(--tx2)'};cursor:pointer;font-family:var(--mono)">${mc.icon} ${mc.name}</button>`).join('')}
          </div>
        </div>
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <div style="display:flex;align-items:center;gap:7px">
              <div style="font-size:10px;color:var(--tx3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em">System Prompt</div>
              <span id="prompt-mode-lbl-${r.id}" style="font-size:9px;font-family:var(--mono);padding:1px 6px;border-radius:10px;${r.promptOverridden?'background:rgba(245,158,11,.12);border:1px solid rgba(245,158,11,.3);color:var(--amber)':'background:rgba(34,197,94,.1);border:1px solid rgba(34,197,94,.25);color:#22c55e'}">${r.promptOverridden?'custom':'auto'}</span>
            </div>
            <div style="display:flex;gap:5px">
              ${r.promptOverridden?`<button class="btn btn-sm" onclick="resetPromptToAuto('${r.id}')" title="Regenerate from name + role">↺ Auto</button>`:''}
              <button class="btn btn-sm" onclick="copyPromptText('${r.id}')">⎘ Copy</button>
              <button class="btn btn-sm" onclick="savePrompt('${r.id}')">Save</button>
            </div>
          </div>
          <textarea class="prompt-edit-area" id="prompt-edit-${r.id}">${esc(r.prompt||generatePrompt(r))}</textarea>
        </div>
        <div style="display:flex;gap:7px;flex-wrap:wrap;padding-bottom:4px">
          <button class="btn btn-sm" onclick="toggleImmunity('${r.id}')">👑 ${r.immunity?'Remove':'Grant'} Immunity</button>
          <button class="btn btn-sm" onclick="snuffTorch('${r.id}')">🔥 Snuff Torch</button>
          ${r.torches<=0?`<button class="btn btn-sm" onclick="revive('${r.id}')">↩ Revive</button>`:''}
          <button class="btn btn-sm btn-danger" onclick="resetStats('${r.id}')">↺ Reset Stats</button>
          <button class="btn btn-sm btn-danger" onclick="deleteModel('${r.id}')">🗑 Remove</button>
        </div>
        <div style="border-top:1px solid var(--line);padding-top:11px">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="font-size:10px;color:var(--tx3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em">Edit Entry</div>
            <button class="btn btn-sm btn-primary" onclick="saveRosterEdit('${r.id}')">Save changes</button>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:7px">
            ${editField('First · family', `re-first-${r.id}`, r.first||'')}
            ${editField('Middle · params', `re-middle-${r.id}`, r.middle||'')}
            ${editField('Last · role', `re-last-${r.id}`,  r.last||r.role||'')}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:4px">
            ${editField('Nickname · overrides display', `re-nick-${r.id}`, r.nickname||'')}
            ${editField('ID', `re-empid-${r.id}`, r.empId)}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-top:4px">
            ${editField('Role (legacy override)', `re-role-${r.id}`, r.role)}
            ${editField('Size (GB)',  `re-size-${r.id}`,  r.size, 'number')}
          </div>
          <div style="margin-top:6px">
            <div style="font-size:9px;color:var(--tx3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px">Role structure</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
              <div>
                <div style="font-size:9px;color:var(--tx4);font-family:var(--mono);margin-bottom:3px">Status</div>
                <select class="inp" id="re-prof-${r.id}" style="width:100%;box-sizing:border-box" onchange="reSyncRole('${r.id}')">
                  <option value="">— none —</option>
                  ${STATUS_LEVELS.map(s=>`<option value="${s.id}"${(r.statusId||r.proficiencyId)===s.id?' selected':''}>${s.label}</option>`).join('')}
                </select>
              </div>
              <div>
                <div style="font-size:9px;color:var(--tx4);font-family:var(--mono);margin-bottom:3px">Primary specialization</div>
                <select class="inp" id="re-spec-${r.id}" style="width:100%;box-sizing:border-box" onchange="reSyncRole('${r.id}')">
                  <option value="">— none —</option>
                  ${SPECIALIZATIONS.map(s=>`<option value="${s.id}"${r.specializationId===s.id?' selected':''}>${s.icon} ${s.label}</option>`).join('')}
                </select>
              </div>
            </div>
            <div style="margin-top:7px">
              <div style="font-size:9px;color:var(--tx4);font-family:var(--mono);margin-bottom:4px">Secondary specializations</div>
              <div style="display:flex;flex-wrap:wrap;gap:5px" id="re-secondary-${r.id}">
                ${SECONDARY_SPECS.map(s=>{const active=(r.secondaryIds||[]).includes(s.id);return`<button type="button" id="re-sec-${r.id}-${s.id}" onclick="toggleReSecondary('${r.id}','${s.id}')" style="font-size:10px;padding:3px 9px;border-radius:20px;border:1px solid ${active?'var(--accent)':'var(--line2)'};background:${active?'var(--accent)':'var(--bg2)'};color:${active?'#000':'var(--tx3)'};cursor:pointer;font-family:var(--mono);transition:all .15s">${s.icon} ${s.label}</button>`;}).join('')}
              </div>
            </div>
            <div id="re-role-preview-${r.id}" style="font-size:10px;color:var(--tx3);font-family:var(--mono);margin-top:5px">${(r.statusId||r.proficiencyId)||r.specializationId?`→ ${buildRoleString(r.statusId||r.proficiencyId||'',r.specializationId||'',r.secondaryIds||[])}`:''}</div>
          </div>
          <div style="margin-top:7px">
            ${editField('Model ID (LM Studio path)', `re-model-${r.id}`, r.model)}
          </div>
        </div>
      </div>
    </div>

    </div><!-- /rd-desktop-top -->

    <!-- ── INTERVIEW TAB ── -->
    <div class="rd-pane rd-interview-pane interview-pane ${tab==='interview'?'active':''}" data-tab="interview">
      <div class="interview-header">
        <span class="interview-title">Interview</span>
        <span class="interview-badge" id="iv-badge-${r.id}">load · respond · unload</span>
        <!-- v8.4: inline prompt editor toggle -->
        <button class="btn btn-sm" id="iv-prompt-toggle-${r.id}" onclick="toggleIvPromptInline('${r.id}')" style="font-size:10px;padding:2px 8px;margin-left:6px" title="Edit global interview question">🎤 Prompt</button>
        <button class="btn btn-sm" onclick="clearInterview('${r.id}')" style="margin-left:auto;font-size:10px;padding:2px 8px">Clear</button>
      </div>
      <!-- v8.4: inline prompt editor (collapsed by default) -->
      <div id="iv-prompt-inline-${r.id}" style="display:none;flex-shrink:0;border-bottom:1px solid var(--line);background:var(--bg1);padding:10px 14px;display:none;flex-direction:column;gap:7px">
        <div style="font-size:10px;color:var(--tx3);font-family:var(--mono);line-height:1.5">
          Global interview question — sent as the first message in every interview. Each model's own system prompt stays active.
        </div>
        <textarea class="prompt-edit-area" id="iv-prompt-inline-ta-${r.id}" style="min-height:80px;max-height:160px">${esc(interviewPrompt)}</textarea>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          <button class="btn btn-sm btn-primary" onclick="applyIvPromptInline('${r.id}')">💾 Save</button>
          <button class="btn btn-sm" onclick="resetIvPromptInline('${r.id}')">↺ Reset</button>
          <button class="btn btn-sm" onclick="copyIvPromptInline('${r.id}',this)">⎘ Copy</button>
          <button class="btn btn-sm" onclick="toggleIvPromptInline('${r.id}')" style="margin-left:auto">Close</button>
        </div>
      </div>
      <div class="interview-messages" id="iv-messages-${r.id}">
        <div class="iv-empty" id="iv-empty-${r.id}">Ask ${r.first} anything.<br><span style="font-size:9px;opacity:.6">Persona prompt active · stats recorded</span></div>
      </div>
      <div class="interview-input-bar">
        <textarea class="iv-input" id="iv-input-${r.id}"
          placeholder="Ask ${r.first}…"
          rows="1"
          onkeydown="ivKeydown(event,'${r.id}')"
          oninput="autoGrow(this)"></textarea>
        <button class="iv-paste" id="iv-paste-${r.id}" onclick="pasteInterviewPrompt('${r.id}')" title="Paste interview question into input">⬇</button>
        <button class="iv-send" id="iv-send-${r.id}" onclick="sendInterview('${r.id}')">Send ↑</button>
      </div>
    </div>`;

  // restore existing interview history in DOM
  renderInterviewHistory(r.id);
  renderRosterEvalCard(r.id);
}

function kv(label,value,id){return`<div class="kv-card"><div class="kv-label">${label}</div><div class="kv-value"${id?` id="${id}"`:''}>${value}</div></div>`;}
function torchHtml(r){if(r.immunity)return'<span style="font-size:12px">👑</span>';if(r.torches<=0)return'<span style="font-size:10px;color:var(--red);font-family:var(--mono);font-weight:700">OUT</span>';return[0,1,2].map(i=>`<div class="torch ${i>=r.torches?'snuffed':''}"></div>`).join('');}
function machineLabel(id){const m=MACHINES.find(x=>x.id===id);return m?m.icon+' '+m.name:id;}
function assignMachine(rid,mid){const r=ROSTER.find(x=>x.id===rid);if(r){r.machine=mid;save();renderRoster();renderRosterDetail(r);}}
function savePrompt(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const ta=document.getElementById('prompt-edit-'+rid);if(!ta)return;
  r.prompt=ta.value.trim();
  r.promptOverridden=true; // v8.4: mark as manually overridden — name changes won't auto-update
  save();
  toast(`${r.first}'s prompt saved ✓`);
  // refresh the label
  const lbl=document.getElementById('prompt-mode-lbl-'+rid);
  if(lbl)lbl.textContent='custom';
}

function resetPromptToAuto(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  r.promptOverridden=false;
  r.prompt=generatePrompt(r);
  save();
  const ta=document.getElementById('prompt-edit-'+rid);
  if(ta)ta.value=r.prompt;
  const lbl=document.getElementById('prompt-mode-lbl-'+rid);
  if(lbl)lbl.textContent='auto';
  toast('Prompt reset to auto ✓');
}

function saveTemp(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const sl=document.getElementById('temp-slider-'+rid);if(!sl)return;
  r.temp=parseFloat(sl.value);save();toast(`${r.first} temp → ${r.temp.toFixed(2)}`);
}
async function resetStats(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const ok=await openAppDialog({
    title:'Reset Model Stats',
    message:`Reset all stats for ${dispName(r)}?\n\nStatus will be set to Unhired.`,
    confirmLabel:'Reset stats',
    danger:true,
  });
  if(!ok)return;
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  r.totalScore=0;r.episodes=0;r.avgTps=0;r.avgTtft=0;r.sessions=[];r.catScores={Code:[],Reasoning:[],Creative:[],General:[]};
  r.torches=3;r.immunity=false;
  r.statusId='unhired';r.proficiencyId='unhired';
  r.color=specColor(r.specializationId||'','unhired',dark);
  if(!r.promptOverridden)r.prompt=generatePrompt(r);
  save();renderRoster();renderRosterDetail(r);toast(`${dispName(r)} reset to Unhired ✓`);
}
function toggleImmunity(id){const r=ROSTER.find(x=>x.id===id);if(r){r.immunity=!r.immunity;save();renderRoster();renderRosterDetail(r);renderSurvivorIf();}}
function snuffTorch(id){const r=ROSTER.find(x=>x.id===id);if(!r)return;if(r.immunity){toast(r.first+' has immunity',true);return;}if(r.torches>0){r.torches--;save();renderRoster();renderRosterDetail(r);renderSurvivorIf();if(r.torches===0)toast(`${dispName(r)} voted off the island! 🏝`,true);}}
function revive(id){const r=ROSTER.find(x=>x.id===id);if(r){r.torches=1;save();renderRoster();renderRosterDetail(r);renderSurvivorIf();}}
function reviveAll(){
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  ROSTER.forEach(r=>{
    r.torches=3;r.immunity=false;r.totalScore=0;r.episodes=0;
    r.statusId='unhired';r.proficiencyId='unhired';
    r.color=specColor(r.specializationId||'','unhired',dark);
    if(!r.promptOverridden)r.prompt=generatePrompt(r);
  });
  save();renderRoster();renderSurvivorIf();toast('All engineers revived · set to Unhired');
}
function clearImmunity(){ROSTER.forEach(r=>r.immunity=false);save();renderRoster();renderSurvivorIf();}
