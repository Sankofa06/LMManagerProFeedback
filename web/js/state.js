/* state.js — global state & roster initialization */

let ROSTER = JSON.parse(localStorage.getItem('lmmp-roster') || 'null');
if (!ROSTER) {
  ROSTER = DEFAULT_ROSTER.map(r => ({ ...r }));
  localStorage.setItem('lmmp-roster', JSON.stringify(ROSTER));
}

let TEAMS = JSON.parse(localStorage.getItem('lmmp-teams') || 'null');
if (!TEAMS) {
  TEAMS = DEFAULT_TEAMS.map(t => ({ ...t }));
  localStorage.setItem('lmmp-teams', JSON.stringify(TEAMS));
}

let PRESETS = JSON.parse(localStorage.getItem('lmmp-presets') || '[]');
let TIMELINE = JSON.parse(localStorage.getItem('lmmp-timeline') || '[]');

const state = JSON.parse(localStorage.getItem('lmmp-state') || 'null') || {
  nav: 'survivor',
  selRoster: null,
  selTeam: null,
  runTeam: null,
  epCount: 0,
  theme: 'auto',
  compareMode: false,
  sessionTracker: {},
  boardSort: 'score',
  archetypeFilter: null,
  familyFilter: null,
  selEpisode: null,
  archivedChats: {},
  collapsedMachines: {},
};

// ensure new state keys
if (state.boardSort === undefined) state.boardSort = 'score';
if (state.archetypeFilter === undefined) state.archetypeFilter = null;
if (state.familyFilter === undefined) state.familyFilter = null;
if (state.selEpisode === undefined) state.selEpisode = null;
if (state.archivedChats === undefined) state.archivedChats = {};
if (state.collapsedMachines === undefined) state.collapsedMachines = {};
if (state.sessionTracker === undefined) state.sessionTracker = {};

// Roster migrations
ROSTER.forEach(r => {
  if (r.secondaryIds === undefined) r.secondaryIds = [];
  if (r.interviewPrompt === undefined) r.interviewPrompt = '';
  if (r.temp === undefined) r.temp = 0.7;
  if (r.topP === undefined) r.topP = 1;
  if (r.maxTokens === undefined) r.maxTokens = 2048;
  if (r.criteriaScores === undefined) r.criteriaScores = {};
  if (r.chatLog === undefined) r.chatLog = [];
  if (r.torch === undefined) r.torch = false;
  if (r.immune === undefined) r.immune = false;
});

function deduplicateRosterMachines() {
  ROSTER.forEach(r => {
    if (!Array.isArray(r.secondaryIds)) r.secondaryIds = [];
    const seen = new Set();
    if (r.machine) seen.add(r.machine);
    r.secondaryIds = r.secondaryIds.filter(id => {
      if (seen.has(id)) return false;
      seen.add(id); return true;
    });
  });
}
deduplicateRosterMachines();

function saveRoster() {
  localStorage.setItem('lmmp-roster', JSON.stringify(ROSTER));
}

function saveTeams() {
  localStorage.setItem('lmmp-teams', JSON.stringify(TEAMS));
}

function getModelMeta(modelId) {
  // Returns family, archetype hints from modelId string
  const id = (modelId || '').toLowerCase();
  return { id, raw: modelId };
}
