/* ── INIT ── */
applyTheme();
initHttpsBanner();
updateNodesSub();
renderMachines();
updateEpBadge();
renderPresetChips();
updateSessionTracker();
renderArchetypeLegend();
// Apply persisted APP settings
(function(){
  const sort=APP.boardSort||'score';
  state.boardSort=sort;
  setTimeout(()=>setBoardSort(sort),100);
  // Apply survivor view preference
  const view=APP.survivorView||'list';
  state.survivorView=view;
})();
renderLiveStatus();
loadBrandName();
(function(){
  const btn=document.getElementById('crosstalk-toggle-btn');
  const cb=document.getElementById('gs-crosstalk');
  if(btn&&cb){btn.textContent='👁 Context '+(cb.checked?'ON':'OFF');btn.style.color=cb.checked?'var(--accent)':'var(--tx3)';}
})();

if(APP.autoCheckMachines&&MACHINES.length)checkAllMachines();
else postCheckPrompt();
