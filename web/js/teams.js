/* teams.js — team rendering and management */

function renderTeams() {
  const list = document.getElementById('teams-list-wrap');
  if (!list) return;
  if (TEAMS.length === 0) {
    list.innerHTML = '<div style="color:var(--tx3);font-size:.82rem;padding:12px 0;">No teams yet.</div>';
    return;
  }
  list.innerHTML = TEAMS.map(t =>
    `<div class="team-row${state.selTeam === t.id ? ' active' : ''}" onclick="setTeamFocus('${t.id}')">
      <span class="team-icon">${t.icon || '📌'}</span>
      <span class="team-name">${esc(t.name)}</span>
      <span class="team-count">${(t.members || []).length} member${(t.members||[]).length !== 1?'s':''}</span>
    </div>`
  ).join('');
}

function renderTeamDetail(id) {
  const panel = document.getElementById('team-detail-panel');
  if (!panel) return;
  const t = TEAMS.find(t => t.id === id);
  if (!t) { panel.innerHTML = ''; return; }

  const members = (t.members || []).map(mid => ROSTER.find(r => r.id === mid)).filter(Boolean);
  const totalVram = members.reduce((sum, r) => {
    const m = MACHINES.find(m => m.id === r.machine);
    return sum + (m ? (m.vram || 0) : 0);
  }, 0);

  // Non-members for add pane
  const memberIds = new Set(t.members || []);
  const available = ROSTER.filter(r => !memberIds.has(r.id));

  const activeTab = state.teamTab || 'members';
  panel.innerHTML = `
    <div id="team-detail-header">
      <span class="team-icon" style="font-size:1.8rem">${t.icon || '📌'}</span>
      <div style="flex:1">
        <div class="rd-name">${esc(t.name)}</div>
        <div style="font-size:.75rem;color:var(--tx3)">${members.length} member${members.length!==1?'s':''} · ${totalVram}GB VRAM</div>
      </div>
      <button class="rd-close" onclick="clearTeamFocus()">&times;</button>
    </div>
    <div id="roster-detail-tabs">
      <button class="rd-tab${activeTab==='members'?' active':''}" onclick="setTeamTab('members')">Members</button>
      <button class="rd-tab${activeTab==='capacity'?' active':''}" onclick="setTeamTab('capacity')">Capacity</button>
      <button class="rd-tab${activeTab==='add'?' active':''}" onclick="setTeamTab('add')">Add</button>
    </div>
    <div id="roster-detail-body">
      ${activeTab === 'members' ? `
        ${members.length === 0
          ? '<div style="color:var(--tx3);font-size:.82rem;">No members yet. Use the Add tab.</div>'
          : members.map(r =>
              `<div class="team-member-row" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr)">
                <span style="font-size:1.2rem">${r.emoji || '🤖'}</span>
                <span style="flex:1;font-size:.87rem;font-weight:500">${esc(r.name)}</span>
                <span style="font-size:.75rem;color:var(--tx3)">${r.role || ''}</span>
                <button class="btn-sm danger" onclick="removeMember('${t.id}','${r.id}')">&times;</button>
              </div>`
            ).join('')
        }
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn-sm" onclick="runTeamDirect('${t.id}')">Run Team</button>
          <button class="btn-sm danger" onclick="deleteTeam('${t.id}')">Delete Team</button>
        </div>
      ` : ''}
      ${activeTab === 'capacity' ? `
        <div style="margin-bottom:8px;font-size:.82rem;color:var(--tx2)">Total VRAM: <strong>${totalVram}GB</strong></div>
        ${members.map(r => {
          const m = MACHINES.find(m => m.id === r.machine);
          return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--bdr);font-size:.82rem">
            <span>${r.emoji || '🤖'}</span>
            <span style="flex:1">${esc(r.name)}</span>
            <span style="color:var(--tx3)">${m ? esc(m.name) : 'No machine'}</span>
            <span>${m ? (m.vram||0)+'GB' : '—'}</span>
          </div>`;
        }).join('')}
      ` : ''}
      ${activeTab === 'add' ? `
        ${available.length === 0
          ? '<div style="color:var(--tx3);font-size:.82rem;">All personas are already on this team.</div>'
          : available.map(r =>
              `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--bdr)">
                <span style="font-size:1.1rem">${r.emoji || '🤖'}</span>
                <span style="flex:1;font-size:.87rem">${esc(r.name)}</span>
                <button class="btn-sm" onclick="addMember('${t.id}','${r.id}')">Add</button>
              </div>`
            ).join('')
        }
      ` : ''}
    </div>
  `;
}

function setTeamFocus(id) {
  state.selTeam = id;
  state.teamTab = 'members';
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderTeams();
  const panel = document.getElementById('team-detail-panel');
  if (panel) {
    renderTeamDetail(id);
    panel.classList.add('visible');
    const master = document.getElementById('teams-master');
    if (master) master.classList.remove('visible');
  }
}

function clearTeamFocus() {
  state.selTeam = null;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  renderTeams();
  const panel = document.getElementById('team-detail-panel');
  if (panel) { panel.classList.remove('visible'); panel.innerHTML = ''; }
  const master = document.getElementById('teams-master');
  if (master) master.classList.add('visible');
}

function setTeamTab(tab) {
  state.teamTab = tab;
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  if (state.selTeam) renderTeamDetail(state.selTeam);
}

function addMember(teamId, rosterId) {
  const t = TEAMS.find(t => t.id === teamId);
  if (!t) return;
  if (!t.members) t.members = [];
  if (!t.members.includes(rosterId)) t.members.push(rosterId);
  saveTeams();
  renderTeamDetail(teamId);
  renderTeams();
}

function removeMember(teamId, rosterId) {
  const t = TEAMS.find(t => t.id === teamId);
  if (!t) return;
  t.members = (t.members || []).filter(id => id !== rosterId);
  saveTeams();
  renderTeamDetail(teamId);
  renderTeams();
}

function deleteTeam(id) {
  const t = TEAMS.find(t => t.id === id);
  if (!t) return;
  if (!confirm(`Delete team “${t.name}”?`)) return;
  const idx = TEAMS.indexOf(t);
  TEAMS.splice(idx, 1);
  saveTeams();
  clearTeamFocus();
  renderTeams();
  toast(`Team “${t.name}” deleted.`);
}

function addTeam() {
  const name = prompt('Team name:');
  if (!name || !name.trim()) return;
  const id = 't' + Date.now();
  TEAMS.push({ id, name: name.trim(), icon: '📌', members: [] });
  saveTeams();
  renderTeams();
  setTeamFocus(id);
}

function runTeamDirect(teamId) {
  state.runTeam = teamId;
  state.nav = 'chat';
  localStorage.setItem('lmmp-state', JSON.stringify(state));
  setNav('chat');
}
