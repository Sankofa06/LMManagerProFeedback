/* data.js — default data & machine initialization */

const DEFAULT_MACHINES = [
  { id: 'bs', name: 'Black Slab', url: 'http://localhost:1234', backend: 'apple', vram: 24 },
  { id: 'bw', name: 'Black Widow', url: 'http://localhost:1235', backend: 'cuda', vram: 12 },
  { id: 'ss', name: 'Silver Surfer', url: 'http://localhost:1236', backend: 'apple', vram: 16 },
];

let MACHINES = JSON.parse(localStorage.getItem('lmmp-machines') || 'null');
if (!MACHINES) {
  MACHINES = DEFAULT_MACHINES.map(m => ({ ...m }));
  localStorage.setItem('lmmp-machines', JSON.stringify(MACHINES));
} else {
  // migration: ensure all fields
  MACHINES = MACHINES.map(m => ({ ...DEFAULT_MACHINES[0], ...m }));
  localStorage.setItem('lmmp-machines', JSON.stringify(MACHINES));
}

function saveMachines() {
  localStorage.setItem('lmmp-machines', JSON.stringify(MACHINES));
}

const DEFAULT_ROSTER = [
  { id:'E01', name:'Aria', emoji:'🤖', role:'generalist', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E02', name:'Blaze', emoji:'🔥', role:'coder', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E03', name:'Cipher', emoji:'🔐', role:'analyst', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E04', name:'Delphi', emoji:'🔮', role:'creative', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E05', name:'Echo', emoji:'🎤', role:'generalist', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E06', name:'Flux', emoji:'⚡', role:'coder', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E07', name:'Ghost', emoji:'👻', role:'analyst', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E08', name:'Helix', emoji:'🧬', role:'creative', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E09', name:'Iris', emoji:'🍀', role:'generalist', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E10', name:'Jolt', emoji:'🤜', role:'coder', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E11', name:'Koda', emoji:'🐻', role:'analyst', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E12', name:'Luna', emoji:'🌙', role:'creative', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E13', name:'Mako', emoji:'🦈', role:'generalist', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E14', name:'Nova', emoji:'⭐', role:'coder', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E15', name:'Orion', emoji:'🌌', role:'analyst', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E16', name:'Pyra', emoji:'🔺', role:'creative', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E17', name:'Quill', emoji:'🪶', role:'generalist', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E18', name:'Rune', emoji:'🧧', role:'coder', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E19', name:'Sage', emoji:'🌿', role:'analyst', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E20', name:'Thorn', emoji:'🌹', role:'creative', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E21', name:'Umber', emoji:'🪨', role:'generalist', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E22', name:'Vega', emoji:'💠', role:'coder', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E23', name:'Wren', emoji:'🐦', role:'analyst', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E24', name:'Xara', emoji:'💎', role:'creative', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E25', name:'Ymir', emoji:'❄️', role:'generalist', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E26', name:'Zara', emoji:'🌟', role:'coder', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E27', name:'Aeon', emoji:'⏩', role:'analyst', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E28', name:'Brio', emoji:'🎺', role:'creative', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E29', name:'Crux', emoji:'✝️', role:'generalist', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E30', name:'Dawn', emoji:'🌅', role:'coder', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
  { id:'E31', name:'Ember', emoji:'🕯️', role:'analyst', modelId:'', machine:'', score:0, wins:0, losses:0, draws:0, totalSessions:0, avgScore:0, criteriaScores:{}, chatLog:[], torch:false, immune:false, customPrompt:'', interviewPrompt:'', temp:0.7, topP:1, maxTokens:2048, secondaryIds:[] },
];

const DEFAULT_TEAMS = [
  { id:'t01', name:'Alpha Squad', icon:'🔵', members:[] },
  { id:'t02', name:'Beta Unit', icon:'🟡', members:[] },
  { id:'t03', name:'Gamma Force', icon:'🟢', members:[] },
  { id:'t04', name:'Delta Team', icon:'🔴', members:[] },
  { id:'t05', name:'Epsilon Core', icon:'🟣', members:[] },
  { id:'t06', name:'Zeta Wing', icon:'⚪', members:[] },
  { id:'t07', name:'Eta Block', icon:'🟤', members:[] },
  { id:'t08', name:'Theta Crew', icon:'⬛', members:[] },
  { id:'t09', name:'Iota Pack', icon:'🟦', members:[] },
  { id:'t10', name:'Kappa Cell', icon:'🟧', members:[] },
  { id:'t11', name:'Lambda Ring', icon:'🟨', members:[] },
  { id:'t12', name:'Mu Circuit', icon:'⬜', members:[] },
];
