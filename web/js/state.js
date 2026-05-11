/* ── STATE ── */
let ROSTER=loadJson('lmmp_v5_roster', DEFAULT_ROSTER);
let TEAMS=loadJson('lmmp_v5_teams', DEFAULT_TEAMS);
let PRESETS=loadJson('lmmp_v5_presets', []);
let TIMELINE=loadJson('lmmp_v5_timeline', []);
let state={nav:'machines',selRoster:null,selTeam:null,runTeam:null,epCount:parseInt(localStorage.getItem('lmmp_v5_ep')||'0'),theme:localStorage.getItem('lmmp_v5_theme')||'dark',compareMode:false,sessionTracker:{runs:0,tokens:0,timeMs:0,peakVram:0},boardSort:'score',archetypeFilter:null,familyFilter:null,selEpisode:null,archivedChats:loadJson('lmmp_v7_archived', []),collapsedMachines:new Set(),setupBannerDismissed:false};
ROSTER.forEach(r=>{
  if(r.totalScore===undefined)r.totalScore=0;
  if(r.episodes===undefined)r.episodes=0;
  if(r.immunity===undefined)r.immunity=false;
  // migrate legacy color names → archetype hex
  if(r.color&&!r.color.startsWith('#'))r.color=archetypeColor(r.role);
  // sanitize corrupt avgTps / avgTtft (Infinity or NaN from old sessions)
  if(!isFinite(r.avgTps)||isNaN(r.avgTps))r.avgTps=0;
  if(!isFinite(r.avgTtft)||isNaN(r.avgTtft))r.avgTtft=0;
  // scrub bad tps values from stored sessions and recompute avgTps from scratch
  if(r.sessions&&r.sessions.length){
    r.sessions.forEach(s=>{
      const t=parseFloat(s.tps);
      if(!isFinite(t)||isNaN(t)||t<=0)s.tps='—';
    });
    // recompute avgTps from clean session data
    const validTps=r.sessions.map(s=>parseFloat(s.tps)).filter(t=>isFinite(t)&&t>0);
    r.avgTps=validTps.length?validTps.reduce((a,b)=>a+b,0)/validTps.length:0;
  }
});

// ── ROSTER DUPLICATE MACHINE REASSIGNMENT ──
// If two roster entries share the same model ID on the same machine (can happen from
// old scan logic that used format as part of the dedup key), reassign the second entry
// to the correct machine using live availableModels data. Safe to call at any time;
// no-ops if there are no duplicates or if machine data isn't available yet.
function deduplicateRosterMachines(){
  // Group roster entries by model ID
  const byModel={};
  ROSTER.forEach(r=>{
    if(!byModel[r.model])byModel[r.model]=[];
    byModel[r.model].push(r);
  });
  let changed=false;
  Object.values(byModel).forEach(group=>{
    if(group.length<2)return;
    // Find entries that share the same machine — these are the bad duplicates
    const seenMachines=new Set();
    group.forEach(r=>{
      if(seenMachines.has(r.machine)){
        // This entry is a duplicate on the same machine — try to find another machine
        // that actually has this model in its availableModels list
        const otherMc=MACHINES.find(mc=>
          mc.id!==r.machine &&
          mc.status==='online' &&
          mc.availableModels?.includes(r.model) &&
          !group.some(g=>g!==r&&g.machine===mc.id) // don't assign to a machine already used by another entry in this group
        );
        if(otherMc){
          console.log(`[dedup] Reassigning ${r.model} (${r.id}) from ${r.machine} → ${otherMc.id}`);
          r.machine=otherMc.id;
          changed=true;
        }
      } else {
        seenMachines.add(r.machine);
      }
    });
  });
  if(changed){save();renderRosterTable();renderRoster();}
}
// Run at load time (pre-Check All — won't reassign until availableModels is populated)
deduplicateRosterMachines();


// Get rich metadata for a roster entry — merges live API data with parsed fallbacks
function getModelMeta(r){
  const ownMc=MACHINES.find(x=>x.id===r.machine);
  let api={};
  // Check own machine first — if that machine has metadata for this model, use it.
  // Only fall back to other machines if own machine has no data yet (pre-Check All).
  if(ownMc?.modelMeta?.[r.model]){
    api=ownMc.modelMeta[r.model];
  } else {
    for(const mc of MACHINES){
      if(mc.id!==r.machine&&mc.modelMeta?.[r.model]){api=mc.modelMeta[r.model];break;}
    }
  }
  const path=(r.model||'').toLowerCase();

  // TYPE: Start with API report, then sanity-check against platform.
  // LM Studio sometimes mis-reports compatibility_type (e.g. returns "mlx" for a GGUF
  // on a CUDA machine). Platform is physical ground truth — CUDA cannot run MLX,
  // Apple silicon cannot run GGUF — so platform wins when they contradict.
  let type=api.type||api.format||null;
  if(ownMc?.platform==='cuda' && type==='MLX') type='GGUF';   // impossible on CUDA
  if(ownMc?.platform==='apple' && type==='GGUF') type='MLX';  // impossible on Apple (without special tooling)
  if(!type){
    // No API data yet (pre-Check All) — infer from platform then path
    if(ownMc?.platform==='apple')type='MLX';
    else if(ownMc?.platform==='cuda')type='GGUF';
    else if(path.includes('mlx'))type='MLX';
    else if(path.endsWith('.gguf'))type='GGUF';
  }

  // QUANT: API string > path parsing (broadened to catch custom formats)
  let quant='';
  const rawApiQ=api.quant;
  if(rawApiQ&&typeof rawApiQ==='string'&&rawApiQ.length<30&&!/object/i.test(rawApiQ)){
    quant=rawApiQ;
  }
  if(!quant){
    if(type==='GGUF'){
      // Standard GGUF quants: Q4_K_M, Q6_K, Q8_0, IQ3_M, F16 etc
      const qm=path.match(/[_.-](q[0-9][_a-z0-9]*|iq[0-9][_a-z]*|f16|f32|bf16)/i);
      if(qm)quant=qm[1].toUpperCase();
    } else if(type==='MLX'){
      // Standard: 4bit, 8bit, 4-bit, 8-bit
      const bm=path.match(/[_.-]([0-9]+)[_-]?bit/i)||path.match(/([0-9]+)bit/i);
      if(bm)quant=bm[1]+'-bit';
      // Named MLX formats
      else if(path.includes('dwq'))quant='DWQ';
      else if(path.includes('optiq'))quant='OptiQ';
      else if(path.includes('rotorquant'))quant='RotorQ';
      // Generic: anything after last hyphen that looks like a format tag
      else{
        const parts=path.split(/[-_]/);
        const last=parts[parts.length-1];
        if(last&&last!=='mlx'&&last.length<=8&&!/^\d+$/.test(last))quant=last.toUpperCase();
      }
    }
    // Catch any named format in path regardless of type (heretic, abliterated etc are fine to show)
    if(!quant){
      const custom=path.match(/[_.-](rotorquant|dwq|optiq|heretic|abliterated|uncensored)/i);
      if(custom)quant=custom[1].charAt(0).toUpperCase()+custom[1].slice(1).toLowerCase();
    }
  }

  // PARAMS: paramsStr ("26B-A4B") > paramsBillion > r.middle > path
  let paramsLabel=api.paramsStr||null;
  if(!paramsLabel&&api.paramsBillion)paramsLabel=fmtParams(api.paramsBillion);
  if(!paramsLabel&&r.middle)paramsLabel=r.middle;
  if(!paramsLabel){
    const pm=path.match(/(?<![a-z])([\d]+\.?[\d]*)b(?![a-z])/i);
    if(pm)paramsLabel=fmtParams(parseFloat(pm[1]));
  }

  // ARCHITECTURE: string only
  let arch=api.architecture||null;
  if(arch&&typeof arch!=='string')arch=null;

  // CONTEXT
  const ctx=api.contextLength||null;
  const ctxLabel=ctx
    ?(ctx>=131072?'128K':ctx>=65536?'64K':ctx>=32768?'32K':ctx>=16384?'16K':ctx>=8192?'8K':ctx.toLocaleString())
    :null;

  // FILE SIZE
  const fileSizeGB=api.sizeBytes?(api.sizeBytes/1073741824).toFixed(2):null;

  return{type,quant,paramsLabel,arch,ctxLabel,fileSizeGB,
    publisher:api.publisher||null,
    displayName:api.displayName||null,
    vision:api.vision||false,
    functionCalling:api.functionCalling||false};
}

// Format params nicely: 9.0→9B, 27.3→27B, 0.5→500M etc
