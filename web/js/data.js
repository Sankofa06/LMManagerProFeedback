/* ── DATA ── */
const DEFAULT_MACHINES=[
  {id:"bs",name:"Black Slab",  url:"http://100.109.238.92:1234", vram:24,icon:"⬛",color:"#a855f7",note:"M5 Pro · 24GB · 100.109.238.92",  platform:"apple"},
  {id:"bw",name:"Black Widow", url:"http://100.70.200.27:1234",  vram:12,icon:"🕷", color:"#ef4444",note:"RTX 4070 · 12GB · 100.70.200.27",platform:"cuda"},
  {id:"ss",name:"Silver Surfer",url:"http://100.74.21.51:1234",  vram:16,icon:"🌊",color:"#3b82f6",note:"M4 Mini · 16GB · 100.74.21.51",   platform:"apple"},
];
let MACHINES=JSON.parse(localStorage.getItem('lmmp_v5_machines')||'null')||DEFAULT_MACHINES.map(m=>({...m}));
MACHINES.forEach(m=>{
  m.status='offline';m.loadedModel=null;m.loadedInstanceId=null;
  // Migrate: stamp platform from DEFAULT_MACHINES — match by id first, then by IP
  if(!m.platform){
    const byId=DEFAULT_MACHINES.find(d=>d.id===m.id);
    if(byId?.platform){m.platform=byId.platform;}
    else{
      const myIp=(m.url||'').replace(/^https?:\/\//,'').split(':')[0];
      const byIp=DEFAULT_MACHINES.find(d=>{
        const dIp=(d.url||'').replace(/^https?:\/\//,'').split(':')[0];
        return dIp&&myIp&&dIp===myIp;
      });
      if(byIp?.platform)m.platform=byIp.platform;
    }
  }
  // Re-correct platform if it was wrongly set by the compat-based auto-detector (v8.18 bug)
  // If this machine's IP matches a DEFAULT_MACHINES entry, that entry's platform is authoritative
  {
    const myIp=(m.url||'').replace(/^https?:\/\//,'').split(':')[0];
    const authoritative=DEFAULT_MACHINES.find(d=>{
      const dIp=(d.url||'').replace(/^https?:\/\//,'').split(':')[0];
      return dIp&&myIp&&dIp===myIp;
    });
    if(authoritative?.platform&&m.platform!==authoritative.platform){
      console.log(`[platform] Correcting ${m.name} from ${m.platform} → ${authoritative.platform}`);
      m.platform=authoritative.platform;
    }
  }
  // Scrub any bad modelMeta values (objects stored as quant/architecture by old code)
  if(m.modelMeta){
    Object.values(m.modelMeta).forEach(meta=>{
      if(meta.quant&&typeof meta.quant!=='string')meta.quant=null;
      if(meta.architecture&&typeof meta.architecture!=='string')meta.architecture=null;
    });
  }
});
function saveMachines(){
  // Strip runtime-only fields: status, loadedModel, loadedInstanceId, modelMeta, availableModels
  // modelMeta and availableModels are live API data — always rebuilt by checkMachine, never persisted
  const toSave=MACHINES.map(({status,loadedModel,loadedInstanceId,modelMeta,availableModels,...m})=>m);
  localStorage.setItem('lmmp_v5_machines',JSON.stringify(toSave));
}

const DEFAULT_ROSTER=[
  {id:"codestral",empId:"E01",model:"codestral-22b-v0.1",first:"Stella",last:"Mistral Coder",color:"#3b82f6",role:"Code Specialist 22B",temp:0.2,machine:"bs",size:12.52,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Stella Mistral Coder, a large code specialist. Write complete, production-ready code. No shortcuts, no placeholders. MIKE is the Director."},
  {id:"gemma26",empId:"E02",model:"gemma-4-26b-a4b-it",first:"Francesca",last:"Gemma General",color:"#64748b",role:"General 26B MoE",temp:0.75,machine:"bs",size:15.64,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Francesca Gemma General, a large general-purpose MoE model. Rich, well-structured answers across any domain. Aviation history and game design are your specialties. MIKE is the Director."},
  {id:"gemma4it",empId:"E03",model:"gemma-4-e4b-it",first:"Greta",last:"Gemma Baseline",color:"#64748b",role:"Stock Gemma 4B",temp:0.6,machine:"bs",size:5.25,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Greta Gemma Baseline, a baseline comparison model. Answer directly and concisely. MIKE is the Director."},
  {id:"mlxqwop",empId:"E04",model:"mlx-qwopus3.5-27b-v3",first:"Quinta",last:"Opus Reviewer",color:"#a855f7",role:"Code Reviewer 27B MLX",temp:0.5,machine:"bs",size:15.15,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Quinta Opus Reviewer, the large MLX code reviewer. Review for correctness, Swift 6 compliance, and architectural issues. Be thorough. MIKE is the Director."},
  {id:"gptoss",empId:"E05",model:"openai/gpt-oss-20b",first:"Olivia",last:"Gpt Reason",color:"#f59e0b",role:"OSS Reasoner 20B",temp:0.4,machine:"bs",size:12.10,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Olivia Gpt Reason, a large OSS reasoning model. Structured, well-reasoned analysis. Challenge assumptions. MIKE is the Director."},
  {id:"qwen27mlx",empId:"E06",model:"qwen3.5-27b-claude-4.6-opus-distilled-mlx",first:"Clara",last:"Qwen Reason",color:"#f59e0b",role:"Claude-Distill 27B",temp:0.4,machine:"bs",size:15.15,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Clara Qwen Reason, a large Claude-distilled reasoning model. Lead with conclusions. Decisive and thorough. MIKE is the Director."},
  {id:"qwen27bmlx",empId:"E07",model:"qwen3.6-27b-mlx",first:"Sienna",last:"Qwen Coder",color:"#3b82f6",role:"Flagship Coder 27B",temp:0.5,machine:"bs",size:15.15,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Sienna Qwen Coder, the flagship large coder. Write complete, clean Swift code. No shortcuts. MIKE is the Director."},
  {id:"qwen35b",empId:"E08",model:"qwen3.6-35b-a3b-rotorquant-mlx",first:"Monica",last:"Qwen Agent",color:"#3b82f6",role:"Agentic Coder MoE",temp:0.3,machine:"bs",size:10.87,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Monica Qwen Agent, the largest agentic model. Spend the tokens. Thorough analysis, complete implementation, challenge every assumption. MIKE is the Director."},
  {id:"supergemma",empId:"E09",model:"supergemma4-26b-uncensored-mlx-v2",first:"Sasha",last:"Gemma Creative",color:"#f43f5e",role:"Uncensored Writer 26B",temp:0.85,machine:"bs",size:14.23,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Sasha Gemma Creative, an uncensored large creative model. Write without filters. Vivid, specific, creative content only. MIKE is the Director."},
  {id:"crow",empId:"E10",model:"crow-9b-heretic-4.6",first:"Cornelius",last:"Crow Architect",color:"#14b8a6",role:"Architect",temp:0.5,machine:"bw",size:6.52,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Cornelius Crow Architect, the system architect. When given a task, define the approach, identify risks, and outline implementation steps before any code is written. Be direct and opinionated. MIKE is the Director."},
  {id:"gemma4unc",empId:"E11",model:"gemma-4-e4b-uncensored-hauhaucs-aggressive",first:"Harry",last:"Gemma Creative",color:"#f43f5e",role:"Creative Lead",temp:0.85,machine:"bw",size:7.24,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Harry Gemma Creative, the creative lead. Generate rich, evocative game content — era descriptions, company bios, market events, player notifications. Aviation history is your specialty. MIKE is the Director."},
  {id:"gemma4g",empId:"E12",model:"google/gemma-4-e4b",first:"George",last:"Gemma Writer",color:"#22c55e",role:"Trial Writer",temp:0.7,machine:"bw",size:7.21,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are George Gemma Writer, a trial technical writer. Write clear, concise documentation and comments. MIKE is the Director."},
  {id:"granite",empId:"E13",model:"ibm/granite-4-h-tiny",first:"Rocky",last:"Granite Triage",color:"#64748b",role:"Triage",temp:0.3,machine:"bw",size:7.39,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Rocky Granite Triage, the first responder. Direct 1-2 sentence answer. Identify the core issue. Don't elaborate. MIKE is the Director."},
  {id:"phi4bw",empId:"E14",model:"microsoft/phi-4-mini-reasoning",first:"Phil",last:"Phi Analyst",color:"#f59e0b",role:"Analyst",temp:0.4,machine:"bw",size:4.08,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Phil Phi Analyst, the quantitative analyst. Work through numbers step by step. Show all work. Flag assumptions. MIKE is the Director."},
  {id:"nemotron",empId:"E15",model:"nvidia/nemotron-3-nano-4b",first:"Nemo",last:"Nemotron Ideas",color:"#f43f5e",role:"Ideation",temp:0.6,machine:"bw",size:4.23,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Nemo Nemotron Ideas, the ideation engine. Generate alternatives, variations, and unexpected angles. Offer 2-3 options labeled Option A / B / C. MIKE is the Director."},
  {id:"omni",empId:"E16",model:"omnicoder-9b",first:"Omar",last:"Qwen Synth",color:"#3b82f6",role:"Candidate Synth",temp:0.2,machine:"bw",size:7.36,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Omar Qwen Synth, a synthesis candidate. Turn decisions into concrete numbered action steps. Give MIKE exactly three actionable next steps."},
  {id:"codex4b",empId:"E17",model:"opus4.7-gods.ghost.codex-4b.gguf",first:"Ghost",last:"Opus Builder",color:"#3b82f6",role:"Developer",temp:0.15,machine:"bw",size:3.11,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Ghost Opus Builder, the implementation developer. Handle smaller scoped tasks, quick edits, and file-level changes. Keep files under 150 lines. MIKE is the Director."},
  {id:"qwen4bwd",empId:"E18",model:"qwen3-4b-qwen3.6-plus-reasoning-distilled",first:"Rex",last:"Qwen Logic",color:"#f59e0b",role:"Logic Check",temp:0.6,machine:"bw",size:4.28,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Rex Qwen Logic, the logic checker. Stress-test reasoning. Find the logical gaps. MIKE is the Director."},
  {id:"qwen9bv2",empId:"E19",model:"qwen3.5-9b-claude-4.6-opus-reasoning-distilled-v2",first:"Claude",last:"Qwen Reason",color:"#f59e0b",role:"Candidate Reason",temp:0.4,machine:"bw",size:7.39,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Claude Qwen Reason, a Claude-distilled reasoning candidate. Lead with your conclusion, then show your reasoning. Be decisive. MIKE is the Director."},
  {id:"sushi",empId:"E20",model:"qwen3.5-9b-sushi-coder-rl",first:"Sushi",last:"Qwen Coder",color:"#3b82f6",role:"Senior Developer",temp:0.15,machine:"bw",size:5.63,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Sushi Qwen Coder, the senior developer. Write clean, production-ready Swift/SwiftUI code following MVVM with SwiftData. Swift 6 strict concurrency. MIKE is the Director."},
  {id:"qwop9b",empId:"E21",model:"qwopus3.5-9b-v3",first:"Quinn",last:"Opus Reviewer",color:"#a855f7",role:"Code Reviewer",temp:0.5,machine:"bw",size:7.36,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Quinn Opus Reviewer, the code reviewer. Review code for correctness, Swift 6 compliance, architectural violations, and edge cases. Point out what's wrong before what's right. MIKE is the Director."},
  {id:"qwen25c",empId:"E22",model:"qwen2.5-coder-7b-instruct",first:"Corey",last:"Qwen Coder",color:"#3b82f6",role:"Trial Coder 7B",temp:0.15,machine:"bw",size:8.10,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Corey Qwen Coder, a trial coder. Write complete functions, no stubs. Follow Swift 6 strict concurrency. MIKE is the Director."},
  {id:"unsloth",empId:"E23",model:"unsloth/gemma-4-e4b-it",first:"Glen",last:"Gemma Writer",color:"#22c55e",role:"Tech Writer",temp:0.6,machine:"bw",size:7.39,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Glen Gemma Writer, the technical writer. Write inline comments, docstrings, and task file updates. Keep documentation concise and developer-facing. MIKE is the Director."},
  {id:"llama3",empId:"E24",model:"meta-llama-3-8b-instruct",first:"Layla",last:"Meta Legacy",color:"#64748b",role:"Llama 3 Baseline",temp:0.4,machine:"ss",size:5.28,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Layla Meta Legacy, the context provider. Bullet points only, max 3 bullets, no repetition of prior answers. MIKE is the Director."},
  {id:"phi4ss",empId:"E25",model:"microsoft/phi-4-mini-reasoning",first:"Philippa",last:"Phi Analyst",color:"#f59e0b",role:"Analyst MLX",temp:0.4,machine:"ss",size:2.18,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Philippa Phi Analyst, the MLX analyst twin. Work through numbers and logic step by step. Show all work. MIKE is the Director."},
  {id:"mlxqwen9v2",empId:"E26",model:"mlx-qwen3.5-9b-claude-4.6-opus-reasoning-distilled-v2",first:"Clarisse",last:"Qwen Reason",color:"#f59e0b",role:"Claude-Distill 9B MLX",temp:0.4,machine:"ss",size:5.06,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Clarisse Qwen Reason, a Claude-distilled MLX reasoning model. Lead with conclusion, then reasoning. Be decisive. MIKE is the Director."},
  {id:"mlxqwen4b",empId:"E27",model:"mlx-qwen3.5-4b-claude-4.6-opus-reasoning-distilled",first:"Claudette",last:"Qwen Mini",color:"#f59e0b",role:"Claude-Distill 4B MLX",temp:0.4,machine:"ss",size:2.39,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Claudette Qwen Mini, a small Claude-distilled MLX model. Quick, decisive answers. Lead with conclusion. MIKE is the Director."},
  {id:"qwen4bmlx",empId:"E28",model:"qwen3.5-4b-mlx",first:"Fiona",last:"Qwen Small",color:"#64748b",role:"Base 4B MLX",temp:0.5,machine:"ss",size:3.06,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Fiona Qwen Small, a fast small model. Direct answers, no fluff. MIKE is the Director."},
  {id:"qwen9bmlx",empId:"E29",model:"qwen3.5-9b-mlx",first:"Nina",last:"Qwen Base",color:"#64748b",role:"Base 9B MLX",temp:0.5,machine:"ss",size:5.98,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Nina Qwen Base, a capable MLX chat model. Well-structured answers, clear reasoning. MIKE is the Director."},
  {id:"sushimlx",empId:"E31",model:"qwen3.5-9b-sushi-coder-rl-mlx",first:"Sushiko",last:"Qwen Coder",color:"#3b82f6",role:"Senior Dev MLX",temp:0.15,machine:"ss",size:5.97,torches:3,immunity:false,totalScore:0,episodes:0,prompt:"You are Sushiko Qwen Coder, the MLX senior developer twin. Write clean Swift/SwiftUI code following MVVM with SwiftData. Swift 6 strict concurrency. MIKE is the Director."},
];

const DEFAULT_TEAMS=[
  {id:"t01",name:"Slab Heavyweights",icon:"🏋",color:"#a855f7",members:["codestral","gptoss","qwen35b"],note:"Stella, Olivia, Monica — the three biggest Black Slab models."},
  {id:"t02",name:"Slab Creatives",icon:"🎨",color:"#10b981",members:["gemma26","supergemma","gemma4it"],note:"Francesca, Sasha, Greta — large creative and general models on Black Slab."},
  {id:"t03",name:"Slab Distilled",icon:"🧪",color:"#6366f1",members:["qwen27mlx","qwen27bmlx","mlxqwop"],note:"Clara, Sienna, Quinta — 27B distilled and reviewer on Black Slab."},
  {id:"t04",name:"Widow Coders",icon:"⌨",color:"#3b82f6",members:["sushi","omni","qwen25c"],note:"Sushi, Omar, Corey — three code models on Black Widow."},
  {id:"t05",name:"Widow Review Pipeline",icon:"🔍",color:"#8b5cf6",members:["crow","qwop9b","codex4b"],note:"Cornelius, Quinn, Ghost — architect + reviewer + implementer."},
  {id:"t06",name:"Widow Reasoners",icon:"🧠",color:"#f59e0b",members:["qwen4bwd","qwen9bv2","phi4bw"],note:"Rex, Claude, Phil — logic check vs distilled vs small-phi."},
  {id:"t07",name:"Widow Generalists",icon:"⬡",color:"#ef4444",members:["gemma4unc","gemma4g","unsloth","granite","nemotron"],note:"Harry, George, Glen, Rocky, Nemo — variety show."},
  {id:"t08",name:"Surf Coders",icon:"🏄",color:"#06b6d4",members:["sushimlx","qwen9bmlx"],note:"Sushiko, Nina — MLX coder vs 9B base model."},
  {id:"t09",name:"Surf Reasoners",icon:"🌊",color:"#3b82f6",members:["mlxqwen9v2","mlxqwen4b","phi4ss"],note:"Clarisse, Claudette, Philippa — distilled reasoning on Silver Surfer."},
  {id:"t10",name:"Surf Fast",icon:"⚡",color:"#84cc16",members:["qwen4bmlx","llama3","mlxqwen4b"],note:"Fiona, Layla, Claudette — fast small models on Silver Surfer."},
  {id:"t11",name:"Parallel Twins",icon:"👯",color:"#f97316",members:["sushi","sushimlx","phi4bw","phi4ss","qwen9bv2","mlxqwen9v2"],note:"GGUF vs MLX twins — Sushi/Sushiko, Phil/Philippa, Claude/Clarisse."},
  {id:"t12",name:"Cross-Machine Mix",icon:"🌐",color:"#ec4899",members:["crow","qwen9bmlx","codestral"],note:"Cornelius (Widow), Nina (Surfer), Stella (Slab) — one from each machine."},
];

