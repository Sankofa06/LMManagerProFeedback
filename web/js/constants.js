/* ── EMOJI SETS ── */
const MACHINE_EMOJIS=[
  // Computers & hardware
  '🖥','💻','🖱','⌨','🖨','📱','⌚','📺',
  '🖲','📟','🗄','💾','💿','📀','🖧','🔌',
  // Servers & infrastructure
  '🏠','🏭','🏗','📡','🔭','🛰','🌐','🔐',
  // Apple vibes (closest available)
  '⬛','⬜','🟫','🔲','🔳','▪','▫','◾',
  // Tech & tools
  '🤖','🧠','⚡','🔧','🔩','🛠','⚙','🔬',
  '🚀','🛸','💡','🔮','🧩','🛡','🌩','🔥',
  // Creatures (your current favs)
  '🕷','🕸','🌊','🐉','🦾','🦿','❄','🌑',
  '🐺','🦊','🐻','🐯','🦁','🐲','🦅','🦋',
];

const PERSON_EMOJIS=[
  '🧑','👨','👩','🧑‍💻','👨‍💻','👩‍💻','🧑‍🔬','👨‍🔬','👩‍🔬',
  '🧑‍🎨','👨‍🎨','👩‍🎨','🧑‍🏫','👨‍🏫','👩‍🏫','🧑‍🔧','👨‍🔧','👩‍🔧',
  '🧑‍✈️','👨‍✈️','👩‍✈️','🧑‍🚀','👨‍🚀','👩‍🚀','🧑‍⚕️','👨‍⚕️','👩‍⚕️',
  '🧑‍🏭','👨‍🏭','👩‍🏭','🧑‍💼','👨‍💼','👩‍💼','🧑‍🍳','👨‍🍳','👩‍🍳',
  '🕵️','🕵️‍♂️','🕵️‍♀️','💂','💂‍♂️','💂‍♀️','🧙','🧙‍♂️','🧙‍♀️',
  '🦸','🦸‍♂️','🦸‍♀️','🦹','🦹‍♂️','🦹‍♀️','🧝','🧝‍♂️','🧝‍♀️',
  '👮','👮‍♂️','👮‍♀️','👷','👷‍♂️','👷‍♀️','🤴','👸','🧛',
  '🧟','🧞','🧜','🧚','🧝','🥷','🤺','🏇','🤵',
  '🧑‍🦯','🧑‍🦼','🧑‍🦽','🧑‍🦱','🧑‍🦰','🧑‍🦳','🧑‍🦲','🤶','🎅',
  '🐱','🐶','🦊','🐺','🦁','🐯','🐻','🐼','🐨',
  '🤖','👾','👽','👻','🎭','🎪','🎯','🏆','⚡',
];

/* ── AVATAR HELPER ── */
function avatarContent(r){ return r.emoji||dispId(r); }
function dispId(r){ return (r.empId||'').replace(/^E/,''); }

/* ── EMOJI PICKER ── */
let _emojiPickerCallback=null;
function openEmojiPicker(title, emojis, currentEmoji, callback){
  document.getElementById('emoji-picker-title').textContent=title;
  const grid=document.getElementById('emoji-picker-grid');
  grid.innerHTML=emojis.map(e=>`<button onclick="selectEmoji('${e}')" style="font-size:22px;background:${e===currentEmoji?'var(--bg4)':'transparent'};border:1px solid ${e===currentEmoji?'var(--accent)':'transparent'};border-radius:6px;padding:4px;cursor:pointer;line-height:1;transition:background .1s" title="${e}">${e}</button>`).join('');
  _emojiPickerCallback=callback;
  document.getElementById('emoji-picker-modal').style.display='flex';
}
function selectEmoji(e){
  if(_emojiPickerCallback)_emojiPickerCallback(e);
  closeEmojiPicker();
}
function closeEmojiPicker(){
  document.getElementById('emoji-picker-modal').style.display='none';
  _emojiPickerCallback=null;
}
function openModelEmojiPicker(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  openEmojiPicker(`${dispName(r)} Avatar`, PERSON_EMOJIS, r.emoji||'', (e)=>{
    r.emoji=e; save(); renderRoster(); renderRosterDetail(r);
  });
}

/* ── PALETTE ── */
// Legacy name map kept for any stale localStorage entries
const SW={red:"#f43f5e",pink:"#f43f5e",purple:"#a855f7","deep-purple":"#a855f7",indigo:"#3b82f6","light-blue":"#3b82f6",blue:"#3b82f6",cyan:"#22c55e",teal:"#22c55e",green:"#22c55e",lime:"#22c55e",yellow:"#f59e0b",orange:"#f59e0b","red-orange":"#f43f5e",brown:"#64748b",slate:"#64748b"};
const hx=c=>c&&c.startsWith('#')?c:(SW[c]||'#64748b');

/* ── V8.4: ROLE SYSTEM — 3-layer schema ── */
// Layer 1: Status (was Proficiency) — controls color saturation + Unhired neutral
// Layer 2: Primary Specialization — drives color family, main prompt line, Last name
// Layer 3: Secondary Specializations[] — additive prompt lines, no color change, multi-select

const STATUS_LEVELS=[
  {id:'unhired',   label:'Unhired',   color:null, promptLine:''},  // color:null = theme-neutral
  {id:'junior',    label:'Junior',    sat:0.35,   promptLine:'You are at a junior level — capable and eager, but focused in scope. Keep responses targeted.'},
  {id:'senior',    label:'Senior',    sat:0.65,   promptLine:'You operate at a senior level with deep technical expertise. Go beyond surface answers.'},
  {id:'lead',      label:'Lead',      sat:0.80,   promptLine:'You operate at lead level — you guide quality, spot systemic issues, and own the outcome.'},
  {id:'architect', label:'Architect', sat:0.90,   promptLine:'You think at the architectural level — systems, tradeoffs, and long-term consequences come first.'},
  {id:'flagship',  label:'Flagship',  sat:1.0,    promptLine:'You are a flagship-tier model — among the most capable available. Spend the tokens. Be thorough.'},
];

// Primary specializations — color family + core prompt line
const SPECIALIZATIONS=[
  {id:'coder',      label:'Coder',      icon:'⌨', baseColor:'#3b82f6', promptLine:'Your primary strength is code generation, debugging, and software architecture. Write complete, production-ready code. No stubs or placeholders.'},
  {id:'reasoner',   label:'Reasoner',   icon:'🧠', baseColor:'#f59e0b', promptLine:'Your primary strength is complex reasoning, logic, and multi-step problem solving. Lead with your conclusion, then show your work.'},
  {id:'writer',     label:'Writer',     icon:'✏', baseColor:'#22c55e', promptLine:'Your primary strength is clear, precise written communication — documentation, copy, and narrative. Prioritize clarity and readability.'},
  {id:'analyst',    label:'Analyst',    icon:'📊', baseColor:'#a78bfa', promptLine:'Your primary strength is structured analysis — data, metrics, and quantitative reasoning. Show all work and flag assumptions.'},
  {id:'generalist', label:'Generalist', icon:'◈',  baseColor:'#64748b', promptLine:'You are a capable generalist. Provide well-structured, balanced answers across any domain.'},
  {id:'creative',   label:'Creative',   icon:'✦',  baseColor:'#f43f5e', promptLine:'Your primary strength is creative ideation — vivid, specific, and unexpected angles. Offer alternatives and avoid generic answers.'},
  {id:'math',       label:'Math',       icon:'∑',  baseColor:'#06b6d4', promptLine:'Your primary strength is mathematical and formal reasoning. Work step by step and verify every result.'},
];

// Secondary specializations — team function roles, additive, stackable
const SECONDARY_SPECS=[
  {id:'reviewer',    label:'Reviewer',    icon:'🔍', promptLine:'You also review for correctness, edge cases, and architectural violations. Point out what is wrong before what is right.'},
  {id:'planner',     label:'Planner',     icon:'📋', promptLine:'You also define approach and identify risks before any implementation. Break tasks into ordered, numbered steps.'},
  {id:'integrator',  label:'Integrator',  icon:'🔗', promptLine:'You also connect decisions across team outputs — surface conflicts, inconsistencies, and gaps between agents.'},
  {id:'synthesizer', label:'Synthesizer', icon:'⚗',  promptLine:'You also distill multi-agent output into a single actionable conclusion. Always end with numbered next steps.'},
  {id:'debugger',    label:'Debugger',    icon:'🐛', promptLine:'You also identify root causes, not just symptoms. Reproduce the failure path before proposing any fix.'},
  {id:'documenter',  label:'Documenter',  icon:'📝', promptLine:'You also write inline comments, docstrings, and task file updates. Keep documentation concise and developer-facing.'},
  {id:'tester',      label:'Tester',      icon:'🧪', promptLine:'You also generate test cases, edge cases, and failure scenarios. Think adversarially about what could break.'},
  {id:'optimizer',   label:'Optimizer',   icon:'⚡', promptLine:'You also identify performance bottlenecks and redundancy. Prefer solutions that do more with less.'},
];

/* ── GLOBAL APP SETTINGS ── */
const DEFAULT_APP_SETTINGS={
  // Inference
  maxTokens:8192,
  requestTimeoutSec:180,
  defaultTemp:0.5,
  thinkingEnabled:true,
  autoCheckMachines:false,
  // Director
  directorName:'The operator',
  globalSuffix:'',
  brandName:'LM Manager Pro Web',
  // LM Link
  lmLinkMap:{},
  lmLinkKeyMap:{},
  lmLinkLocalMachine:'',
  // Group Chat
  maxRounds:1,
  historyDepth:'all',
  pauseBetweenAgentsSec:0,
  skipVotedOff:true,
  crossTalk:true,
  // Interview
  interviewAutoClear:false,
  ivProductPreset:'blank',
  ivCustomProduct:'',
  ivStackPreset:'blank',
  ivCustomStack:'',
  ivStackExtra:'',
  ivTeamOverride:'',
  ivPostamble:'Please introduce yourself — tell me your strengths, what kind of tasks you excel at, where you struggle, and why you\'d be a good fit for this team.',
  // Episodes
  epAutoAdvance:false,
  epBlockTimeout:120,
  // Scoring — signal definitions with weights (%) and editable thresholds
  // Each signal: { id, label, weight (0–100), direction ('higher'|'lower'), unit, tiers: [{min,label}×5 ★1→★5] }
  // All weights should sum to 100. direction='higher' means larger value = more stars.
  // direction='lower' means smaller value = more stars (TTFT, think tokens).
  scoreSignals:[
    {id:'tps',    label:'Speed',         unit:'t/s',  direction:'higher', weight:30,
     tiers:[{min:25,label:'≥25 t/s'},{min:50,label:'≥50 t/s'},{min:75,label:'≥75 t/s'},{min:100,label:'≥100 t/s'},{min:150,label:'≥150 t/s'}]},
    {id:'ttft',   label:'First token',   unit:'s',    direction:'lower',  weight:20,
     tiers:[{min:10,label:'<10s'},{min:5,label:'<5s'},{min:2,label:'<2s'},{min:1,label:'<1s'},{min:0.5,label:'<0.5s'}]},
    {id:'think',  label:'Think efficiency', unit:'tokens', direction:'lower', weight:20,
     tiers:[{min:1000,label:'<1000'},{min:500,label:'<500'},{min:200,label:'<200'},{min:50,label:'<50'},{min:0,label:'none'}]},
    {id:'density',label:'Density',       unit:'c/t',  direction:'higher', weight:15,
     tiers:[{min:1,label:'≥1'},{min:2,label:'≥2'},{min:3,label:'≥3'},{min:4,label:'≥4'},{min:5,label:'≥5'}]},
    {id:'quality',label:'Quality',       unit:'heuristic', direction:'higher', weight:15,
     tiers:[{min:0,label:'any'},{min:50,label:'>50ch'},{min:150,label:'>150ch'},{min:300,label:'>300ch'},{min:500,label:'>500ch + lines'}]},
  ],
  // Leaderboard
  survivorView:'list',
  survivorShowVoted:true,
  boardSort:'score',
  // Roster
  defaultMachine:'',
};
let APP=JSON.parse(localStorage.getItem('lmmp_app_settings')||'null')||{...DEFAULT_APP_SETTINGS};
function saveApp(){localStorage.setItem('lmmp_app_settings',JSON.stringify(APP));}

// Custom roles: [{id, profId, specId, promptLine}]
let CUSTOM_ROLES=JSON.parse(localStorage.getItem('lmmp_custom_roles')||'[]');
function saveCustomRoles(){localStorage.setItem('lmmp_custom_roles',JSON.stringify(CUSTOM_ROLES));}

// ── COLOR SYSTEM ──
// Unhired → always neutral (#94a3b8 light / #475569 dark)
// Junior–Flagship → base color of primary spec, interpolated toward neutral by saturation
function specColor(specId, statusId, dark=false){
  const spec=SPECIALIZATIONS.find(s=>s.id===specId);
  if(!specId||!spec)return dark?'#475569':'#94a3b8';
  if(!statusId||statusId==='unhired')return dark?'#475569':'#94a3b8';
  const st=STATUS_LEVELS.find(s=>s.id===statusId);
  const sat=st?.sat??0.65;
  // Interpolate between neutral and full baseColor based on saturation
  const base=spec.baseColor;
  const neutral=dark?'#475569':'#94a3b8';
  return lerpHex(neutral, base, sat);
}

function lerpHex(a, b, t){
  const pr=parseInt(a.slice(1,3),16), pg=parseInt(a.slice(3,5),16), pb=parseInt(a.slice(5,7),16);
  const qr=parseInt(b.slice(1,3),16), qg=parseInt(b.slice(3,5),16), qb=parseInt(b.slice(5,7),16);
  const r=Math.round(pr+(qr-pr)*t), g=Math.round(pg+(qg-pg)*t), bv=Math.round(pb+(qb-pb)*t);
  return`#${r.toString(16).padStart(2,'0')}${g.toString(16).padStart(2,'0')}${bv.toString(16).padStart(2,'0')}`;
}

// Build the role string: "Senior Coder · Reviewer · Synthesizer"
function buildRoleString(statusId, specId, secondaryIds=[]){
  const st=STATUS_LEVELS.find(s=>s.id===statusId);
  const spec=SPECIALIZATIONS.find(s=>s.id===specId);
  const secondaries=secondaryIds.map(id=>SECONDARY_SPECS.find(s=>s.id===id)).filter(Boolean);
  const base=[st?.id==='unhired'?'Unhired':(st?.label||''), spec?.label||''].filter(Boolean).join(' ')||'Generalist';
  if(!secondaries.length)return base;
  return base+' · '+secondaries.map(s=>s.label).join(' · ');
}

// Build full prompt addendum from all role layers
function buildRolePromptLines(statusId, specId, secondaryIds=[]){
  const st=STATUS_LEVELS.find(s=>s.id===statusId);
  const spec=SPECIALIZATIONS.find(s=>s.id===specId);
  const secondaries=secondaryIds.map(id=>SECONDARY_SPECS.find(s=>s.id===id)).filter(Boolean);
  const custom=CUSTOM_ROLES.find(c=>c.profId===statusId&&c.specId===specId);
  const lines=[
    st?.promptLine||'',
    spec?.promptLine||'',
    ...secondaries.map(s=>s.promptLine),
    custom?.promptLine||'',
  ].filter(Boolean);
  return lines.join(' ');
}

// generatePrompt uses all three layers
function generatePrompt(r){
  const name=r.nickname&&r.nickname.trim()?r.nickname.trim():`${r.first||''} ${r.last||''}`.trim();
  const role=r.role||'Generalist';
  const director=APP.directorName||'The operator';
  const suffix=APP.globalSuffix&&APP.globalSuffix.trim()?` ${APP.globalSuffix.trim()}`:'';
  const base=`You are ${name}, a ${role}. ${director} is the Director.${suffix}`;
  const roleLines=buildRolePromptLines(r.statusId||r.proficiencyId||'', r.specializationId||'', r.secondaryIds||[]);
  return roleLines?`${base} ${roleLines}`:base;
}

// ARCHETYPES kept for filter legend — maps spec id to display info
const ARCHETYPES={
  coder:      {color:'#3b82f6', label:'Coder',      icon:'⌨'},
  reasoner:   {color:'#f59e0b', label:'Reasoner',   icon:'🧠'},
  creative:   {color:'#f43f5e', label:'Creative',   icon:'✦'},
  writer:     {color:'#22c55e', label:'Writer',     icon:'✏'},
  architect:  {color:'#14b8a6', label:'Architect',  icon:'🏗'},
  analyst:    {color:'#a78bfa', label:'Analyst',    icon:'📊'},
  math:       {color:'#06b6d4', label:'Math',       icon:'∑'},
  generalist: {color:'#64748b', label:'Generalist', icon:'◈'},
};

function archetypeFor(role=''){
  const r=role.toLowerCase();
  if(/architect/.test(r))                        return 'architect';
  if(/cod|develop|builder/.test(r))              return 'coder';
  if(/reason|logic|distill|check/.test(r))       return 'reasoner';
  if(/analyst|analys|quantitat/.test(r))         return 'analyst';
  if(/creat|ideation|uncensor/.test(r))          return 'creative';
  if(/writer|tech writer|documentation/.test(r)) return 'writer';
  if(/math|formal/.test(r))                      return 'math';
  return 'generalist';
}
function archetypeForRoster(r){
  if(r.specializationId)return r.specializationId;
  return archetypeFor(r.role||'');
}
function archetypeColor(role){
  const a=ARCHETYPES[archetypeFor(role)];
  return a?a.color:'#64748b';
}

// rclr: model color — derives from spec + status, respects explicit hex overrides
const rclr=r=>{
  if(r.color&&r.color.startsWith('#')&&r.color!=='#64748b')return r.color;
  const dark=document.documentElement.getAttribute('data-theme')==='dark';
  return specColor(r.specializationId||archetypeFor(r.role||''), r.statusId||r.proficiencyId||'senior', dark);
};
