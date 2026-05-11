/* ── DATA ── */
// Ship a neutral first-run experience. Existing users still load from localStorage.
const DEFAULT_MACHINES=[];
let MACHINES=loadJson('lmmp_v5_machines', DEFAULT_MACHINES.map(m=>({...m})));
MACHINES.forEach(m=>{
  m.status='offline';m.loadedModel=null;m.loadedInstanceId=null;
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
  saveJson('lmmp_v5_machines',toSave);
}

const DEFAULT_ROSTER=[];
const DEFAULT_TEAMS=[];
