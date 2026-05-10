/* ── AUTO-SCORE (0–10 scale) ── */
// Returns the active signal config, merging APP.scoreSignals with defaults
function getScoreSignals(){
  return APP.scoreSignals||DEFAULT_APP_SETTINGS.scoreSignals;
}

// Evaluate a single signal value against its tier list → returns stars 1–5 (or 0 if no data)
function evalSignalStars(sig, value){
  if(value===null||value===undefined||value==='—'||!isFinite(parseFloat(value)))return 0;
  const v=parseFloat(value);
  const tiers=sig.tiers; // tiers[0]=★1 ... tiers[4]=★5
  if(sig.direction==='higher'){
    // higher value = more stars. tiers[i].min is the threshold to earn ★(i+1)
    let stars=0;
    for(let i=0;i<5;i++)if(v>=tiers[i].min)stars=i+1;
    return stars;
  } else {
    // lower value = more stars. tiers[i].min is the upper bound to earn ★(i+1)
    // tiers are listed from worst to best (highest threshold first)
    let stars=0;
    for(let i=0;i<5;i++)if(v<tiers[i].min||(tiers[i].min===0&&v===0))stars=i+1;
    return stars;
  }
}

function autoScore(text, tps='—', ttft='—', thinkTokens=0, totalTokens=0){
  return autoScoreBreakdown(text, tps, ttft, thinkTokens, totalTokens).score;
}

function autoScoreBreakdown(text='', tps='—', ttft='—', thinkTokens=0, totalTokens=0){
  const signals=getScoreSignals();
  const totalWeight=signals.reduce((a,s)=>a+s.weight,0)||100;
  const result=[];
  let total=0;

  // Compute raw values for each signal
  const rawValues={
    tps:     parseFloat(tps),
    ttft:    parseFloat(ttft),
    think:   parseInt(thinkTokens)||0,
    density: (()=>{ const chars=text.length; const tok=totalTokens>0?totalTokens:Math.round(chars/4); return tok>0?chars/tok:0; })(),
    quality: (()=>{
      // v8.5 fix: return character count to match the char-based tier thresholds
      // ({min:0},{min:50},{min:150},{min:300},{min:500}). Previously returned 1–5
      // score which only ever cleared the first tier (≥0), capping quality at ★1.
      // Bonus for multi-line responses is added as effective character credit.
      if(!text||text.length<15)return 0;
      const lines=text.split('\n').length;
      const lineBonus=lines>6?100:lines>3?50:0;
      return text.length+lineBonus;
    })(),
  };

  signals.forEach(sig=>{
    const raw=rawValues[sig.id];
    const stars=isNaN(raw)?0:evalSignalStars(sig,sig.id==='quality'?raw:raw);
    const contribution=(stars/5)*(sig.weight/totalWeight)*10;
    const tierLabel=stars>0?(sig.tiers[stars-1]?.label||`★${stars}`):'no data';
    result.push({
      key:sig.id, label:sig.label,
      stars, maxStars:5,
      weight:sig.weight, totalWeight,
      score:Math.round(contribution*100)/100,
      detail:`${stars}/5 stars (${tierLabel}) × ${sig.weight}% weight`,
    });
    total+=contribution;
  });

  // ── REFUSAL PENALTY ──
  const l=(text||'').toLowerCase();
  const refused=l.includes("i'm sorry")||l.includes("i can't")||l.includes("as an ai")||l.includes("i cannot");
  if(refused){total=Math.max(0,total-0.5);result.push({key:'refusal',label:'Refusal penalty',stars:0,score:-0.5,detail:'Refusal pattern detected → −0.5'});}

  const score=Math.max(0,Math.min(10,Math.round(total*10)/10));
  return{score,signals:result,summary:`${score}/10`};
}
// Average of the 5 criteria sliders for one session (returns 0-10 or null if not scored)
function avgCriteriaScore(scores){
  if(!scores)return null;
  const vals=CRITERIA.map(c=>scores[c.id]).filter(v=>typeof v==='number');
  if(!vals.length)return null;
  return Math.round((vals.reduce((a,v)=>a+v,0)/vals.length)*10)/10;
}
// Source-aware aggregate: 20% auto + 30% interview + 50% team
// all sources 0-10. Final returned 0-10.
function rosterAggregate(r){
  const sess=r.sessions||[];
  const autoVals=sess.filter(s=>s.autoQ!=null).map(s=>s.autoQ);
  const ivVals=sess.filter(s=>s.team==='interview').map(s=>avgCriteriaScore(s.scores)).filter(v=>v!=null);
  const teamVals=sess.filter(s=>s.team!=='interview'&&s.team!=='eval').map(s=>avgCriteriaScore(s.scores)).filter(v=>v!=null);
  const autoAvg=autoVals.length?(autoVals.reduce((a,v)=>a+v,0)/autoVals.length) : null; // already 0-10
  const ivAvg=ivVals.length?(ivVals.reduce((a,v)=>a+v,0)/ivVals.length) : null;
  const teamAvg=teamVals.length?(teamVals.reduce((a,v)=>a+v,0)/teamVals.length) : null;
  // Build score from whatever sources exist
  let totalWeight=0, totalScore=0;
  if(autoAvg!=null){totalWeight+=0.2;totalScore+=0.2*autoAvg;}
  if(ivAvg!=null){totalWeight+=0.3;totalScore+=0.3*ivAvg;}
  if(teamAvg!=null){totalWeight+=0.5;totalScore+=0.5*teamAvg;}
  const finalScore=totalWeight>0?Math.round((totalScore/totalWeight)*10)/10:null;
  return{
    autoAvg, ivAvg, teamAvg, finalScore,
    autoCount:autoVals.length, ivCount:ivVals.length, teamCount:teamVals.length,
    teamPending:teamVals.length===0,
  };
}
// Legacy combined score for old session records that used 1-10 quality directly
// Legacy: both autoQ and manualQ are 0-10. 40/60 weighted average.
function combinedScore(autoQ, manualQ){
  if(manualQ==null) return autoQ;
  return Math.round((autoQ*0.4 + manualQ*0.6)*10)/10;
}
function displayScore(sess){
  if(sess.scores){const a=avgCriteriaScore(sess.scores);return a!=null?a:(sess.autoQ||0);}
  // legacy path
  return combinedScore(sess.autoQ??sess.quality??0, sess.quality!=null&&sess.autoQ!=null?sess.quality:null);
}

function clearRunLog(){
  document.getElementById('run-log').innerHTML='';chat.history=[];chat.round=0;chat.currentTurn=0;
  document.getElementById('run-status-text').textContent='Idle';renderTurnChips();
}

function addChatBubble(name,role,color,text,isUser=false){
  const log=document.getElementById('run-log'),time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  const div=document.createElement('div');div.className='bubble-row'+(isUser?' user':'');
  div.innerHTML=`
    <div class="b-avatar" style="background:${color}18;color:${color};border:1px solid ${color}33">${name.slice(0,2).toUpperCase()}</div>
    <div class="b-body">
      <div class="b-meta"><span class="b-name" style="color:${color}">${name}</span><span class="b-info">${role} · ${time}</span></div>
      <div class="b-bubble ${isUser?'user':'agent'}" ${!isUser?`style="border-left-color:${color}55"`:''}>${esc(text)}</div>
    </div>`;
  log.appendChild(div);log.scrollTop=99999;
}

function addSysMsg(text,isErr=false){
  const log=document.getElementById('run-log');const div=document.createElement('div');div.className='sys-msg';
  div.style.color=isErr?'var(--red)':'var(--tx3)';div.textContent=text;log.appendChild(div);log.scrollTop=99999;
}

function addLogEntry(r,status,body,logId){
  const h=rclr(r),log=document.getElementById('run-log');
  const div=document.createElement('div');div.className='log-entry';if(logId)div.id=logId;
  div.innerHTML=`<div class="log-header"><div class="log-dot ${status}" id="${logId}-dot"></div><span class="log-name" style="color:${h}">${dispId(r)} ${dispName(r)}</span><span style="font-size:10px;color:var(--tx3);font-family:var(--mono)">${r.role} · ${machineLabel(r.machine)}</span><span class="log-meta-bar" id="${logId}-meta"></span></div><div class="log-body thinking" id="${logId}-body">${esc(body)}</div>`;
  log.appendChild(div);log.scrollTop=99999;
}

function updateLogEntry(logId,status,body){
  const dot=document.getElementById(logId+'-dot'),bodyEl=document.getElementById(logId+'-body');
  if(dot)dot.className='log-dot '+status;
  if(bodyEl){bodyEl.className='log-body'+(status==='loading'?' thinking':'');bodyEl.textContent=body;}
  document.getElementById('run-log').scrollTop=99999;
}

function finalizeLog(logId,r,body,score,ttft,elapsed,tps='—',tokens=0,tokenSrc='est',endpoint=''){
  const h=rclr(r),entry=document.getElementById(logId);
  if(entry&&body){
    const bubble=document.createElement('div');bubble.className='bubble-row';
    const time=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const tokLbl=tokenSrc==='real'?`${tokens}t`:`~${tokens}t`;
    const endpointTag=endpoint==='completions'
      ?`<span style="font-size:8px;padding:1px 5px;border-radius:4px;background:rgba(245,158,11,.12);color:var(--amber);font-family:var(--mono);flex-shrink:0" title="Used /v1/chat/completions fallback">compat</span>`
      :endpoint==='v1'
        ?`<span style="font-size:8px;padding:1px 5px;border-radius:4px;background:rgba(34,197,94,.1);color:var(--accent);font-family:var(--mono);flex-shrink:0" title="Used /api/v1/chat">v1</span>`
        :'';
    const bd=autoScoreBreakdown(body,tps,ttft);
    bubble.innerHTML=`
      <div class="b-avatar" style="background:${h}18;color:${h};border:1px solid ${h}33;font-size:${r.emoji?'16px':''}">${avatarContent(r)}</div>
      <div class="b-body" style="max-width:85%">
        <div class="b-meta">
          <span class="b-name" style="color:${h}">${dispName(r)}</span>
          <span class="b-info">${r.role} · ${machineLabel(r.machine)} · TTFT ${ttft}s · ${tps} t/s · ${tokLbl} · ${elapsed}s · ${time}</span>
          ${endpointTag}
        </div>
        <div class="b-bubble agent" style="border-left-color:${h}55">${(()=>{const _sp=splitThinking(body);return _sp.thinking?thinkingBubbleHTML(_sp.thinking,_sp.answer,r.first):'<div class="md-body">'+renderMarkdown(body)+'</div>';})()}</div>
        <div class="b-actions">
          <button class="score-btn" id="scorebtn-${logId}" onclick="openScoreSheet('${r.id}','${logId}')">Score</button>
          <span class="score-wrap">
            <span style="font-size:10px;color:var(--tx3);font-family:var(--mono)" id="${logId}-sv">auto:${score}/10</span>
            <span class="score-info-btn" title="Expand scoring breakdown" onclick="toggleBreakdown('${logId}-bd')">ⓘ</span>
            <div class="score-breakdown" id="${logId}-bd" style="display:none;position:absolute;bottom:calc(100% + 6px);left:0;background:var(--bg1);border:1px solid var(--line2);border-radius:8px;padding:8px 10px;min-width:260px;z-index:100;box-shadow:var(--shadow)">
              ${bd.signals.map(s=>`<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <span style="font-size:9px;color:var(--tx3);font-family:var(--mono);flex:1">${s.label}</span>
                <div style="width:60px;height:3px;background:var(--line2);border-radius:2px;flex-shrink:0"><div style="height:100%;width:${s.max>0?Math.max(0,s.score/s.max)*100:0}%;background:${s.score>0?'var(--accent)':'var(--red)'};border-radius:2px"></div></div>
                <span style="font-size:10px;font-family:var(--mono);color:${s.score>0?'var(--tx1)':'var(--red)'};width:28px;text-align:right">${s.score>0?'+'+s.score:s.score}</span>
              </div>`).join('')}
              <div style="border-top:1px solid var(--line);margin-top:4px;padding-top:4px;font-size:10px;font-family:var(--mono);color:var(--tx2);font-weight:700">Total: ${score}/10 · max 10</div>
            </div>
          </span>
          ${(()=>{const cat=classifyPrompt(r.prompt);const cc={Code:'#3b82f6',Reasoning:'#a855f7',Creative:'#f59e0b',General:'#22c55e'}[cat];return`<span style="font-size:9px;padding:2px 7px;border-radius:10px;border:1px solid ${cc}44;color:${cc};background:${cc}12;font-family:var(--mono)" title="Auto-classified">${cat}</span>`;})()}
          <button class="b-immune" onclick="toggleImmunity('${r.id}')">👑</button>
          <button class="b-snuff" onclick="snuffTorch('${r.id}')">🔥 Snuff</button>
        </div>
      </div>`;
    entry.replaceWith(bubble);
  } else if(entry){
    const dot=document.getElementById(logId+'-dot');if(dot)dot.className='log-dot error';
  }
}

function toggleBreakdown(id){
  const el=document.getElementById(id);if(!el)return;
  el.style.display=el.style.display==='none'?'block':'none';
}

function setCriteriaScore(rid, logId, criterionId, value){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const sess=r.sessions?.find(s=>s.logId===logId);
  if(!sess)return;
  if(!sess.scores)sess.scores={};
  sess.scores[criterionId]=value;
  rebuildCatScores(r);
  // recompute aggregate stats
  const agg=rosterAggregate(r);
  r.totalScore=agg.finalScore!=null?agg.finalScore*(r.episodes||1):0;
  // Update visible label for this session if rendered
  const lbl=document.getElementById(logId+'-avg-lbl');
  if(lbl){
    const avg=avgCriteriaScore(sess.scores);
    lbl.textContent=avg!=null?`avg ${avg}/10`:'unscored';
  }
  save();renderSurvivorIf();
  // refresh model detail stats panel if it's the currently selected model
  if(state.selRoster===rid)refreshDetailStats(rid);
}
// Legacy alias kept so old callers don't break
function setScore(rid, logId, score){
  // map to a single combined "Manual" criterion under cr5 — but better: ignore, since old UI is gone
  setCriteriaScore(rid, logId, 'cr1', score);
}

/* ── V6.4: THINKING MODEL SUPPORT ── */
function splitThinking(text){
  if(!text)return{thinking:'',answer:''};
  const trimmed=text.trim();

  // ── Pattern 1: one or more <think>...</think> blocks anywhere in text (v8) ──
  // Handles: properly-closed single block, multiple blocks (reasoning↔content ping-pong),
  // and content-then-think ordering. All <think> blocks are concatenated into thinking;
  // everything outside <think> tags is concatenated into answer.
  if(trimmed.includes('<think>')&&trimmed.includes('</think>')){
    const thinkParts=[]; let answer=''; let i=0;
    while(i<trimmed.length){
      const open=trimmed.indexOf('<think>',i);
      if(open<0){ answer+=trimmed.slice(i); break; }
      // Everything before <think> is answer content
      answer+=trimmed.slice(i,open);
      const close=trimmed.indexOf('</think>',open+7);
      if(close<0){
        // Unclosed final <think> — treat the rest as thinking
        thinkParts.push(trimmed.slice(open+7).replace(/^[>\s]+/,'').trim());
        i=trimmed.length;
      }else{
        thinkParts.push(trimmed.slice(open+7,close).replace(/^[>\s]+/,'').trim());
        i=close+8;
      }
    }
    const thinking=thinkParts.filter(Boolean).join('\n\n').trim();
    answer=answer.trim();
    // If we found at least one closed think block, return — even if answer is empty (still streaming)
    if(thinking||answer)return{thinking,answer};
  }

  // ── Pattern 1.5: streaming case — content started, then <think> opened mid-stream but not yet closed (v8) ──
  // Skipped if text starts with <think> (Pattern 2 has better heuristics for that). Without this,
  // a half-open <think> mid-text would leak into the answer literally.
  if(!trimmed.startsWith('<think>')&&trimmed.includes('<think>')&&!trimmed.includes('</think>')){
    const open=trimmed.indexOf('<think>');
    const beforeThink=trimmed.slice(0,open).trim();
    const insideThink=trimmed.slice(open+7).replace(/^[>\s]+/,'').trim();
    return{thinking:insideThink,answer:beforeThink,streaming:true};
  }

  // ── Pattern 2: unclosed <think> tag at start (phi-4 style, may never close) ──
  if(trimmed.startsWith('<think>')){
    const raw=trimmed.slice(7).replace(/^[>\s]+/,'').trim();
    // Try to find where monologue ends and structured answer begins
    const answerMarker=raw.search(/\n{2,}(?=\*\*|#{1,3}\s|[-•]\s|\d+\.\s)/);
    if(answerMarker>-1){
      const thinking=raw.slice(0,answerMarker).trim();
      const answer=raw.slice(answerMarker).trim();
      if(answer.length>50)return{thinking,answer};
    }
    // No clear split — surface as answer if it looks like a real response
    if(raw.length>200&&(/\*\*/.test(raw)||/^#{1,3}\s/m.test(raw)||/^[-•]\s/m.test(raw))){
      return{thinking:'',answer:raw};
    }
    return{thinking:raw,answer:'',streaming:true};
  }

  // ── Pattern 3: bare >>>...>>> delimiter (some phi variants) ──
  if(/^>{5,}/.test(trimmed)){
    const lines=trimmed.split('\n');
    let answerStart=-1;
    for(let i=0;i<lines.length;i++){
      if(!/^[>\s]*$/.test(lines[i])){answerStart=i;break;}
    }
    if(answerStart>0){
      const answer=lines.slice(answerStart).join('\n').trim();
      if(answer)return{thinking:lines.slice(0,answerStart).join('\n'),answer};
    }
    return{thinking:trimmed,answer:'',streaming:true};
  }

  // ── Pattern 4: inline italic CoT (Qwen/Nina style — *(...)*: monologue then answer) ──
  // Detects responses where thinking is expressed as italic parenthetical lines
  // and the actual answer starts with a non-italic substantial line
  if(/^\*[\s\S]*\*/.test(trimmed)){
    const lines=trimmed.split('\n');
    let answerStart=-1;
    for(let i=0;i<lines.length;i++){
      const s=lines[i].trim();
      if(!s)continue;
      const isThinkLine=
        /^\*[^*].*[*:)]\s*$/.test(s)||   // *...*  or *(...)* lines
        /^\*\(/.test(s)||                  // *( opening
        /^\([^)]+\)\s*[:.]\s*/.test(s);   // (Refining...): ...
      if(!isThinkLine&&s.length>20){answerStart=i;break;}
    }
    if(answerStart>0){
      const thinking=lines.slice(0,answerStart).join('\n').trim();
      const answer=lines.slice(answerStart).join('\n').trim();
      if(thinking&&answer)return{thinking,answer};
    }
  }

  return{thinking:'',answer:text};
}

function thinkingBubbleHTML(thinking, answer, modelName){
  if(!thinking) return answer;
  const short=thinking.slice(0,120).replace(/\n/g,' ');
  const id='th-'+Math.random().toString(36).slice(2);
  return `<div style="margin-bottom:8px">
    <div onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'block':'none';this.querySelector('.th-arrow').textContent=this.nextElementSibling.style.display==='none'?'▶':'▼'"
      style="display:flex;align-items:center;gap:6px;padding:5px 8px;border-radius:6px;background:var(--bg);border:1px solid var(--line);cursor:pointer;font-size:10px;font-family:var(--mono);color:var(--tx3)">
      <span class="th-arrow">▶</span>
      <span style="color:var(--purple)">🧠 Thinking</span>
      <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(short)}${thinking.length>120?'…':''}</span>
      <span style="color:var(--tx4)">${thinking.split(/\s+/).length} words</span>
    </div>
    <div style="display:none;background:var(--bg);border:1px solid var(--line);border-top:none;border-radius:0 0 6px 6px;padding:8px 10px;font-size:10px;font-family:var(--mono);color:var(--tx3);max-height:200px;overflow-y:auto;white-space:pre-wrap;line-height:1.6">${esc(thinking)}</div>
  </div>
  ${answer?`<div class="md-body">${renderMarkdown(answer)}</div>`:''}`;
}
let scoreSheetCtx={rid:null, logId:null};

function openScoreSheet(rid, logId){
  const r=ROSTER.find(x=>x.id===rid);if(!r){toast('Model not found',true);return;}
  const sess=r.sessions?.find(s=>s.logId===logId);if(!sess){toast('Session not found',true);return;}
  scoreSheetCtx={rid, logId};
  // header
  document.getElementById('ss-title').textContent=`Score · ${dispName(r)}`;
  document.getElementById('ss-sub').textContent=`${sess.team||'—'} · ${sess.tps||'—'} t/s · ${sess.elapsed||'—'}s · ${new Date(sess.date).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}`;
  // auto display
  const autoEl=document.getElementById('ss-auto');
  if(autoEl)autoEl.textContent=(sess.autoQ!=null?sess.autoQ:'—')+'/10';
  // build sliders
  if(!sess.scores)sess.scores={};
  const body=document.getElementById('ss-body');
  body.innerHTML=CRITERIA.map(c=>{
    const v=sess.scores[c.id]??5;
    return`<div class="crit-row" id="ss-crit-${c.id}">
      <div class="crit-row-hdr">
        <span class="crit-row-name">${esc(c.name)}</span>
        <span class="crit-row-val" id="ss-val-${c.id}">${v}</span>
      </div>
      <input type="range" class="crit-slider" min="0" max="10" step="1" value="${v}" id="ss-slider-${c.id}"
        oninput="onCriteriaSlide('${c.id}',this.value)">
    </div>`;
  }).join('');
  updateScoreSheetAvg();
  document.getElementById('score-sheet').classList.add('open');
}

function onCriteriaSlide(criterionId, value){
  const v=parseInt(value);
  const lbl=document.getElementById('ss-val-'+criterionId);
  if(lbl)lbl.textContent=v;
  if(scoreSheetCtx.rid&&scoreSheetCtx.logId){
    setCriteriaScore(scoreSheetCtx.rid, scoreSheetCtx.logId, criterionId, v);
    updateScoreSheetAvg();
  }
}

function updateScoreSheetAvg(){
  const r=ROSTER.find(x=>x.id===scoreSheetCtx.rid);if(!r)return;
  const sess=r.sessions?.find(s=>s.logId===scoreSheetCtx.logId);if(!sess)return;
  const avg=avgCriteriaScore(sess.scores);
  const el=document.getElementById('ss-avg');
  if(el){
    el.textContent=avg!=null?avg+'/10':'—';
    el.style.color=avg==null?'var(--tx3)':avg>=7?'var(--accent)':avg>=4?'var(--amber)':'var(--red)';
  }
}

async function resetScoreSheet(){
  if(!scoreSheetCtx.rid||!scoreSheetCtx.logId)return;
  const ok=await openAppDialog({
    title:'Reset Score Sheet',
    message:'Reset all criteria for this response to unscored?',
    confirmLabel:'Reset scores',
    danger:true,
  });
  if(!ok)return;
  const r=ROSTER.find(x=>x.id===scoreSheetCtx.rid);if(!r)return;
  const sess=r.sessions?.find(s=>s.logId===scoreSheetCtx.logId);if(!sess)return;
  sess.scores={};
  CRITERIA.forEach(c=>{
    const sl=document.getElementById('ss-slider-'+c.id);if(sl)sl.value=5;
    const lbl=document.getElementById('ss-val-'+c.id);if(lbl)lbl.textContent=5;
  });
  save();updateScoreSheetAvg();
  if(state.selRoster===scoreSheetCtx.rid)refreshDetailStats(scoreSheetCtx.rid);
  // refresh score button label on the rendered bubble if visible
  refreshScoreButton(scoreSheetCtx.rid, scoreSheetCtx.logId);
}

function closeScoreSheet(){
  document.getElementById('score-sheet').classList.remove('open');
  // refresh button for the bubble we just scored
  if(scoreSheetCtx.rid&&scoreSheetCtx.logId){
    refreshScoreButton(scoreSheetCtx.rid, scoreSheetCtx.logId);
    if(state.selRoster===scoreSheetCtx.rid)renderRosterEvalCard(scoreSheetCtx.rid);
  }
}

function refreshScoreButton(rid, logId){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const sess=r.sessions?.find(s=>s.logId===logId);if(!sess)return;
  const btn=document.getElementById('scorebtn-'+logId);
  if(btn){
    const avg=avgCriteriaScore(sess.scores);
    if(avg!=null){btn.textContent=`★ ${avg}/10`;btn.classList.add('scored');}
    else{btn.textContent='Score';btn.classList.remove('scored');}
  }
}

/* ── V6.3: CRITERIA MANAGEMENT ── */
function openCriteriaModal(){
  document.getElementById('criteria-modal').style.display='flex';
  renderCriteriaList();
}

function renderCriteriaList(){
  const el=document.getElementById('criteria-list');if(!el)return;
  el.innerHTML=CRITERIA.map((c,i)=>`
    <div style="display:flex;gap:8px;align-items:center;background:var(--bg2);border:1px solid var(--line);border-radius:6px;padding:7px 10px">
      <span style="font-size:9px;color:var(--tx4);font-family:var(--mono);width:24px">${i+1}.</span>
      <input class="inp" id="cm-name-${c.id}" value="${esc(c.name)}" style="flex:1;font-size:12px">
      <button class="btn btn-sm" onclick="renameCriterion('${c.id}')">Save</button>
      <button class="btn btn-sm btn-danger" onclick="removeCriterion('${c.id}')" ${CRITERIA.length<=1?'disabled':''}>✕</button>
    </div>
  `).join('');
}

function renameCriterion(id){
  const el=document.getElementById('cm-name-'+id);if(!el)return;
  const newName=el.value.trim();if(!newName){toast('Name required',true);return;}
  const c=CRITERIA.find(x=>x.id===id);if(!c)return;
  c.name=newName.slice(0,30);
  saveCriteria();renderCriteriaList();
  toast('Criterion renamed ✓');
}

async function removeCriterion(id){
  if(CRITERIA.length<=1){toast('At least one criterion required',true);return;}
  const c=CRITERIA.find(x=>x.id===id);if(!c)return;
  const ok=await openAppDialog({
    title:'Remove Criterion',
    message:`Remove criterion "${c.name}"?\n\nScores already given for this criterion will remain stored but become invisible.`,
    confirmLabel:'Remove criterion',
    danger:true,
  });
  if(!ok)return;
  CRITERIA=CRITERIA.filter(x=>x.id!==id);
  saveCriteria();renderCriteriaList();
  toast('Criterion removed');
}

function addCriterion(){
  const el=document.getElementById('new-criterion-name');if(!el)return;
  const name=el.value.trim();if(!name){toast('Name required',true);return;}
  if(CRITERIA.length>=8){toast('Max 8 criteria',true);return;}
  CRITERIA.push({id:'cr'+Date.now(), name:name.slice(0,30)});
  el.value='';
  saveCriteria();renderCriteriaList();
  toast(`"${name}" added ✓`);
}

/* ── V6.3: ROSTER EVAL CARD ── */
function renderRosterEvalCard(rid){
  const r=ROSTER.find(x=>x.id===rid);if(!r)return;
  const card=document.getElementById('roster-eval-card-'+rid);if(!card)return;
  const ivSessions=(r.sessions||[]).filter(s=>s.team==='interview').sort((a,b)=>b.date.localeCompare(a.date));
  const latest=ivSessions[0];
  if(!latest){
    card.innerHTML=`<div class="roster-eval-empty">💬 No interview yet · ask ${r.first} something below to score</div>`;
    return;
  }
  const avg=avgCriteriaScore(latest.scores);
  const scored=avg!=null;
  card.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:7px">
      <span style="font-size:9px;color:var(--tx3);font-family:var(--mono);text-transform:uppercase;letter-spacing:.08em">Latest interview</span>
      <span style="font-size:9px;color:var(--tx4);font-family:var(--mono);margin-left:auto">${new Date(latest.date).toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</span>
    </div>
    <div class="roster-eval-prompt">${esc((latest.prompt||'').slice(0,140))||'(no prompt)'}</div>
    <div class="roster-eval-resp">${esc(splitThinking(latest.response).answer.slice(0,180)||splitThinking(latest.response).thinking.slice(0,180))}</div>
    <div class="roster-eval-actions">
      <button class="score-btn ${scored?'scored':''}" onclick="openScoreSheet('${r.id}','${latest.logId}')">${scored?`★ ${avg}/10`:'Score this'}</button>
      <span class="score-pill-mini">auto: ${latest.autoQ??'—'}/10</span>
      <span class="score-pill-mini" style="margin-left:auto">${latest.tps||'—'} t/s</span>
    </div>
  `;
}
