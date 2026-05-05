/* ── TEAMS ── */
function renderTeams(){
  const scroll=document.getElementById('teams-scroll');scroll.innerHTML='';
  TEAMS.forEach(t=>{
    const div=document.createElement('div');div.className='team-row'+(state.selTeam===t.id?' selected':'');
    // v8.3: compute average team score from members' aggregate scores
    const memberScores=t.members
      .map(id=>ROSTER.find(r=>r.id===id))
      .filter(Boolean)
      .map(r=>rosterAggregate(r).finalScore)
      .filter(s=>s!=null);
    const avg=memberScores.length?(memberScores.reduce((a,b)=>a+b,0)/memberScores.length):null;
    const scoreTxt=avg!=null?avg.toFixed(1):'—';
    const scoreCls=avg!=null?'':'dim';
    div.innerHTML=`<span class="team-icon">${t.icon}</span><div style="flex:1;min-width:0"><div class="team-name-t">${t.name}</div><div class="team-sub-t">${t.members.length} member${t.members.length===1?'':'s'}</div></div><div class="t-stats"><div class="t-score ${scoreCls}">${scoreTxt}</div><div class="t-mem-count">avg score</div></div>`;
    div.onclick=()=>{state.selTeam=t.id;setTeamFocus(t.id);renderTeams();renderTeamDetail(t);};
    scroll.appendChild(div);
  });
  if(state.selTeam){const t=TEAMS.find(x=>x.id===state.selTeam);if(t)renderTeamDetail(t);}
}

function renderTeamDetail(t){
  const members=t.members.map(id=>ROSTER.find(r=>r.id===id)).filter(Boolean);
  const nonMembers=ROSTER.filter(r=>!t.members.includes(r.id)&&r.torches>0);
  const byMachine={};members.forEach(r=>{if(!byMachine[r.machine])byMachine[r.machine]=[];byMachine[r.machine].push(r);});
  // VRAM analysis: each machine processes its queue sequentially, so peak = largest model on that machine
  const vramPills=MACHINES.map(mc=>{
    const onMachine=members.filter(r=>r.machine===mc.id);
    if(!onMachine.length)return'';
    const peak=Math.max(...onMachine.map(r=>r.size));
    const fits=peak<=mc.vram;
    const pct=Math.min(100,(peak/mc.vram)*100).toFixed(0);
    return`<div class="tb-vram-pill ${fits?'ok':'warn'}">
      <span>${mc.icon} ${mc.name.split(' ')[0]}</span>
      <div class="tb-vram-bar"><div class="tb-vram-bar-fill" style="width:${pct}%;background:${fits?'var(--accent)':'var(--red)'}"></div></div>
      <span>${peak.toFixed(1)}/${mc.vram}GB ${fits?'✓':'⚠'}</span>
    </div>`;
  }).filter(Boolean).join('');
  const totalSeqVram=members.reduce((a,r)=>a+r.size,0).toFixed(1);
  const machineGroups=Object.entries(byMachine).map(([mid,models])=>{
    const mc=MACHINES.find(x=>x.id===mid);
    const machineVram=Math.max(...models.map(r=>r.size));
    const overcap=machineVram>(mc?.vram||999);
    return`<div style="margin-bottom:14px">
      <div style="font-size:10px;color:${mc?.color||'var(--tx3)'};font-family:var(--mono);font-weight:600;text-transform:uppercase;letter-spacing:.1em;margin-bottom:7px;display:flex;align-items:center;gap:6px">
        <div style="width:6px;height:6px;border-radius:50%;background:${mc?.status==='online'?'var(--accent)':'var(--tx4)'}"></div>
        ${mc?.icon||'?'} ${mc?.name||mid} · ${models.length} in queue · peak ${machineVram.toFixed(1)}GB
        ${overcap?'<span style="color:var(--red);font-weight:700">⚠ OVER CAPACITY</span>':''}
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${models.map((r,i)=>{const h=rclr(r);const mc=MACHINES.find(x=>x.id===r.machine);const fits=r.size<=(mc?.vram||999);return`<div class="tm-row" style="${!fits?'border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.05)':''}"><span style="font-size:10px;color:var(--tx3);font-family:var(--mono);width:16px;text-align:center;flex-shrink:0;font-weight:700">${i+1}</span><div class="tm-avatar" style="background:${h}18;color:${h};border:1px solid ${h}33">${dispId(r)}</div><div style="flex:1;min-width:0"><div class="tm-name" style="color:${h}">${dispName(r)}</div><div class="tm-model">${r.model} · ${r.size}GB${!fits?` <span style="color:var(--red)">over capacity</span>`:''}</div></div><div class="torches">${torchHtml(r)}</div><button onclick="removeMember('${t.id}','${r.id}')" style="font-size:11px;padding:3px 8px;border-radius:4px;border:1px solid var(--line2);background:transparent;color:var(--tx3);cursor:pointer">✕</button></div>`;}).join('')}
      </div>
    </div>`;
  }).join('');
  // v8.3: which tab to show on mobile (default 'members')
  const tab=(state.teamTab||'members');
  document.getElementById('team-detail').innerHTML=`
    <!-- Header: persistent across tabs on mobile -->
    <div class="td-header" style="padding:14px 16px;border-bottom:1px solid var(--line);background:var(--bg1);display:flex;align-items:center;gap:10px">
      <span style="font-size:22px">${t.icon}</span>
      <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:700">${t.name}</div><div style="font-size:11px;color:var(--tx3);font-family:var(--mono);margin-top:2px">${t.note||''}</div></div>
      <div style="display:flex;gap:7px;flex-shrink:0">
        <button class="btn btn-sm btn-primary" onclick="runTeamDirect('${t.id}')">&#x25BA; Run</button>
        <button class="btn btn-sm btn-danger" onclick="deleteTeam('${t.id}')">Delete</button>
      </div>
    </div>

    <!-- v8.3: tab strip + back button (mobile only via CSS) -->
    <div class="td-tab-strip">
      <button class="td-back-btn" onclick="clearTeamFocus()" title="Back to teams list">← Back</button>
      <button class="td-tab ${tab==='members'?'active':''}" onclick="setTeamTab('members')">Members${members.length?` (${members.length})`:''}</button>
      <button class="td-tab ${tab==='capacity'?'active':''}" onclick="setTeamTab('capacity')">Capacity</button>
      <button class="td-tab ${tab==='add'?'active':''}" onclick="setTeamTab('add')">Add${nonMembers.length?` (${nonMembers.length})`:''}</button>
    </div>

    <!-- MEMBERS PANE -->
    <div class="td-pane td-members-pane ${tab==='members'?'active':''}" data-tab="members">
      <div style="padding:14px 16px">
        <div class="tb-section-hdr">Queue by Machine</div>
        ${machineGroups||'<div style="color:var(--tx3);font-size:12px;font-family:var(--mono);padding:8px 0">No members yet — switch to the Add tab to recruit.</div>'}
      </div>
    </div>

    <!-- CAPACITY PANE -->
    <div class="td-pane td-capacity-pane ${tab==='capacity'?'active':''}" data-tab="capacity">
      <div style="padding:14px 16px">
        ${members.length>0?`<div class="tb-section-hdr">Capacity (sequential — peak per machine)</div>
        <div class="tb-vram-summary">${vramPills}<div class="tb-vram-pill"><span>📊 Total queued:</span><span style="color:var(--tx2)">${totalSeqVram}GB across ${members.length} models</span></div></div>`:'<div style="color:var(--tx3);font-size:12px;font-family:var(--mono)">No members — capacity analysis unavailable.</div>'}
      </div>
    </div>

    <!-- ADD PANE -->
    <div class="td-pane td-add-pane ${tab==='add'?'active':''}" data-tab="add">
      <div style="padding:14px 16px">
        ${nonMembers.length>0?`<div class="tb-section-hdr">Available Models</div><div style="display:flex;flex-wrap:wrap;gap:6px">${nonMembers.map(r=>{const h=rclr(r);const mc=MACHINES.find(x=>x.id===r.machine);const wouldFit=r.size<=(mc?.vram||999);return`<button onclick="addMember('${t.id}','${r.id}')" style="font-size:11px;padding:5px 12px;border-radius:20px;border:1px solid ${h}33;background:${h}0c;color:${h};cursor:pointer;font-family:var(--mono)" title="${r.size}GB on ${mc?.name||r.machine}${!wouldFit?' (over capacity)':''}">+ ${dispName(r)} <span style="color:var(--tx4);font-size:10px">${r.size}G</span></button>`;}).join('')}</div>`:'<div style="color:var(--tx3);font-size:12px;font-family:var(--mono)">No available models — every active engineer is already on this team.</div>'}
      </div>
    </div>`;
}

// v8.3: master/detail focus state on mobile, mirrors roster pattern
function setTeamFocus(tid){
  const split=document.getElementById('teams-split');
  if(!split)return;
  split.dataset.focus='1';
  if(!state.teamTab) state.teamTab='members';
}
function clearTeamFocus(){
  const split=document.getElementById('teams-split');
  if(!split)return;
  delete split.dataset.focus;
}
function setTeamTab(tab){
  state.teamTab=tab;
  document.querySelectorAll('#team-detail .td-tab').forEach(b=>{
    // tabs may have a count suffix like "Members (3)" — match by data attribute via dataset would be cleaner,
    // but textContent.startsWith works since the labels are unique on first word
    const label=b.textContent.trim().toLowerCase();
    b.classList.toggle('active', label.startsWith(tab));
  });
  document.querySelectorAll('#team-detail .td-pane').forEach(p=>{
    p.classList.toggle('active', p.dataset.tab===tab);
  });
}

function addMember(tid,rid){const t=TEAMS.find(x=>x.id===tid);if(t&&!t.members.includes(rid)){t.members.push(rid);save();renderTeams();renderTeamDetail(t);}}
function removeMember(tid,rid){const t=TEAMS.find(x=>x.id===tid);if(t){t.members=t.members.filter(x=>x!==rid);save();renderTeams();renderTeamDetail(t);}}
function deleteTeam(id){if(!confirm('Delete team?'))return;TEAMS=TEAMS.filter(t=>t.id!==id);state.selTeam=null;clearTeamFocus();save();renderTeams();document.getElementById('team-detail').innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--tx3);font-size:12px;font-family:var(--mono)">Select a team</div>';}
function addTeam(){const name=prompt('Team name:');if(!name)return;const id='t'+Date.now();TEAMS.push({id,name,icon:'⬡',color:'#888',members:[],note:''});save();state.selTeam=id;setTeamFocus(id);renderTeams();renderTeamDetail(TEAMS.find(t=>t.id===id));}
function runTeamDirect(tid){state.runTeam=TEAMS.find(t=>t.id===tid);setNav('run');}
