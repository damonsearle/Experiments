import './style.css';
import { evidence, places, deductions, assessDeduction } from './case.js';
import { createScene } from './scene.js';

const collected = new Set(), solved = new Set(), drafts = new Map();
let activeTab='scene', closed=false, scene;
const app=document.querySelector('#app');
app.innerHTML=`
  <header class="masthead"><a class="brand" href="./" aria-label="Jerry and the Missing Hours home"><span class="brand-mark">J.</span><span>JERRY <em>&</em> THE MISSING HOURS<small>A DETECTIVE STORY</small></span></a><div class="case-number">CASE FILE <b>001</b><span>UNSOLVED</span></div></header>
  <main><section class="case-heading"><div><p class="eyebrow">THE CONSERVATORY DISTRICT · 00:17</p><h1>The Midnight Greenhouse</h1></div><p class="case-brief">One missing moonflower. Three witnesses.<br>A night that doesn’t quite add up.</p></section>
  <nav class="tabs" aria-label="Investigation"><button data-tab="scene" aria-current="page">01 <span>Investigate</span></button><button data-tab="notebook">02 <span>Evidence</span> <b id="evidence-count">0</b></button><button data-tab="board">03 <span>Deduction board</span> <b id="solved-count">0/3</b></button></nav>
  <div id="scene-view" class="view scene-layout"><section class="scene-wrap"><div id="scene"><div class="scene-caption"><span class="live-dot"></span> MIDNIGHT GREENHOUSE <span class="weather">RAIN / 12°C</span></div><div id="loading" role="status">Jerry is on his way…</div><button id="rotate" class="rotate" aria-label="Change camera angle">Change view</button></div><div class="dialogue"><span class="speaker">JERRY</span><p id="jerry-quote">“A locked greenhouse. An empty plinth. Someone is hoping we stop at the obvious answer.”</p></div></section>
  <aside class="investigation"><p class="eyebrow">EXAMINE THE SCENE</p><h2>Everything leaves a trace.</h2><p class="muted">Choose a location. Jerry will take a closer look and add what he finds to your notebook.</p><div id="locations">${places.map((p,i)=>`<button class="location" data-place="${p.id}" disabled><span class="location-number">0${i+1}</span><span>${p.label}</span><span class="location-status">Inspect</span></button>`).join('')}</div><div class="objective"><span class="eyebrow">YOUR ASSIGNMENT</span><p>Establish when the cart left, interpret the tracks, and reconstruct the flower’s removal.</p><small>Take your time. There’s no countdown.</small></div></aside></div>
  <section id="notebook-view" class="view" hidden><div class="section-intro"><p class="eyebrow">JERRY’S FIELD NOTES</p><h2>The evidence, as found.</h2><p>Records can disagree. Keep their sources in mind.</p></div><div id="notebook"></div></section>
  <section id="board-view" class="view" hidden><div class="section-intro"><p class="eyebrow">MAKE THE CASE</p><h2>A theory needs something to stand on.</h2><p>Choose a claim and cite its essential supporting evidence. All three deductions are needed to close the case.</p></div><div id="deductions"></div><div id="close-case"></div></section>
  <footer><span>JERRY’S DETECTIVE AGENCY</span><span>CASE 001 / THE MISSING HOURS</span><button id="help">How to investigate</button></footer></main>
  <dialog id="evidence-dialog" aria-labelledby="dialog-title"><button class="dialog-close" aria-label="Close evidence">×</button><div id="dialog-content"></div></dialog>
  <div id="announcement" class="sr-only" role="status" aria-live="polite"></div>`;
const dialog=document.querySelector('dialog');
let previousFocus;
function openDialog(content) { previousFocus=document.activeElement; document.querySelector('#dialog-content').innerHTML=content; if(!dialog.open) dialog.showModal(); dialog.querySelector('.dialog-close').focus(); }
function closeDialog(){dialog.close();previousFocus?.focus();}
document.querySelector('.dialog-close').onclick=closeDialog;
dialog.addEventListener('click',event=>{if(event.target===dialog) {const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDialog();}});
function switchTab(tab) {
  activeTab=tab;
  for(const view of document.querySelectorAll('.view')) view.hidden=view.id!==`${tab}-view`;
  for(const button of document.querySelectorAll('[data-tab]')) { if(button.dataset.tab===tab)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current'); }
  if(tab==='notebook')renderNotebook(); if(tab==='board')renderBoard();
}
document.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>switchTab(button.dataset.tab));
function inspect(place) {
  const findings=evidence.filter(e=>e.place===place.id);
  findings.forEach(e=>collected.add(e.id)); scene?.markCollected(place.id);
  document.querySelector('#evidence-count').textContent=collected.size;
  document.querySelector(`[data-place="${place.id}"] .location-status`).textContent='Examined';
  document.querySelector(`[data-place="${place.id}"]`).classList.add('examined');
  document.querySelector('#jerry-quote').textContent=place.quote;
  document.querySelector('#announcement').textContent=`${place.label} examined. ${collected.size} pieces of evidence collected.`;
  if(activeTab==='scene')openDialog(`<p class="eyebrow">LOCATION ${places.indexOf(place)+1} / FIELD NOTES</p><h2 id="dialog-title">${place.label}</h2>${findings.map(e=>`<article class="finding"><p class="eyebrow">${e.kind}</p><h3>${e.title}</h3><p>${e.body}</p></article>`).join('')}<p class="filed">Filed in your evidence notebook.</p><button class="primary" id="continue">Continue investigating</button>`);
  document.querySelector('#continue')?.addEventListener('click',closeDialog);
  if(activeTab==='notebook')renderNotebook();if(activeTab==='board')renderBoard();
}
document.querySelectorAll('[data-place]').forEach(button=>button.onclick=()=>scene?.visit(button.dataset.place));
function renderNotebook() {
  const notes=evidence.filter(e=>collected.has(e.id));
  document.querySelector('#notebook').innerHTML=notes.length?`<div class="evidence-grid">${notes.map(e=>`<article class="note"><p class="eyebrow">${e.kind}</p><h3>${e.title}</h3><p>${e.body}</p><span class="note-source">${places.find(p=>p.id===e.place).label}</span></article>`).join('')}</div>`:`<div class="empty"><h3>Your notebook is still empty.</h3><p>Visit a location at the greenhouse to collect your first clues.</p><button class="primary" id="return-scene">Examine the scene</button></div>`;
  document.querySelector('#return-scene')?.addEventListener('click',()=>switchTab('scene'));
}
function renderBoard() {
  document.querySelector('#deductions').innerHTML=deductions.map(d=>{
    const draft=drafts.get(d.id)||{answer:'',selected:[]};const done=solved.has(d.id);
    return `<article class="deduction ${done?'solved':''}" data-deduction="${d.id}"><p class="eyebrow">${d.title} ${done?'<span class="verified">ESTABLISHED</span>':''}</p><h3>${d.question}</h3>${done?`<p class="solution">${d.explanation}</p><p class="eyebrow">SUPPORTED BY</p><p class="citations">${d.requires.map(id=>evidence.find(e=>e.id===id).title).join(' · ')}</p>`:`<fieldset><legend class="sr-only">Your explanation</legend>${d.options.map((option,i)=>`<label class="claim"><input type="radio" name="${d.id}" value="${i}" ${draft.answer===option?'checked':''}><span>${option}</span></label>`).join('')}</fieldset><details ${draft.selected.length?'open':''}><summary>Attach evidence <span>Choose ${d.requires.length} records · ${collected.size} available</span></summary><div class="citation-list">${evidence.filter(e=>collected.has(e.id)).map(e=>`<label><input type="checkbox" value="${e.id}" ${draft.selected.includes(e.id)?'checked':''}><span>${e.title}<small>${e.kind}</small></span><button type="button" class="read-evidence" data-evidence="${e.id}" aria-label="Read ${e.title}">Read</button></label>`).join('')||'<p>Inspect the scene to gather evidence.</p>'}</div></details><div class="deduction-actions"><button class="primary test-claim">Test deduction</button><button class="hint">Ask Jerry</button></div><p class="feedback" role="status">${draft.feedback||''}</p>`}</article>`;
  }).join('');
  document.querySelectorAll('[data-deduction]').forEach(card=>{
    const id=card.dataset.deduction,d=deductions.find(d=>d.id===id);
    const read=()=>({answer:d.options[card.querySelector('input[type=radio]:checked')?.value]||'',selected:[...card.querySelectorAll('input[type=checkbox]:checked')].map(e=>e.value)});
    card.querySelectorAll('input').forEach(input=>input.onchange=()=>drafts.set(id,read()));
    card.querySelector('.test-claim')?.addEventListener('click',()=>{
      const draft=read(),result=assessDeduction(id,draft.answer,draft.selected,[...collected]);
      drafts.set(id,{...draft,feedback:result.message});
      if(result.ok){solved.add(id);document.querySelector('#solved-count').textContent=`${solved.size}/3`;renderBoard();document.querySelector('#announcement').textContent=`Deduction established. ${solved.size} of 3 complete.`;}
      else card.querySelector('.feedback').textContent=result.message;
    });
    card.querySelector('.hint')?.addEventListener('click',()=>{card.querySelector('.feedback').textContent=`Jerry: “${d.hint}”`;});
  });
  document.querySelectorAll('[data-evidence]').forEach(button=>button.onclick=event=>{
    event.preventDefault();const e=evidence.find(e=>e.id===button.dataset.evidence);
    openDialog(`<p class="eyebrow">${e.kind}</p><h2 id="dialog-title">${e.title}</h2><p>${e.body}</p>`);
  });
  document.querySelector('#close-case').innerHTML=solved.size===3?`<div class="case-ready"><div><h2>The evidence fits.</h2><p>File Jerry’s reconstruction and see what remains unanswered.</p></div><button class="primary" id="file-case">${closed?'Read case conclusion':'Close the case'}</button></div>`:`<p class="board-progress">${solved.size} of 3 deductions established. No penalties for revising a theory.</p>`;
  document.querySelector('#file-case')?.addEventListener('click',finish);
}
function finish(){
  closed=true;document.querySelector('.case-number span').textContent='CASE CLOSED';
  openDialog(`<p class="eyebrow">CASE 001 / RECONSTRUCTION FILED</p><h2 id="dialog-title">The flower. And the freight train.</h2><p>At 23:56, Orin wheeled the moonflower out through the service entrance. His cart gained the tub’s exact weight. The slow controller disguised the time; overlapping tracks wrongly suggested a giant visitor.</p><p>Mara had already left. Bront never left the gate. Orin’s claim that Mara borrowed his cart contradicts the independent observations.</p><blockquote>“We can establish who moved it. Who wanted it moved—that’s another question.”<cite>Jerry</cite></blockquote><div class="ending-hook"><p class="eyebrow">ONE THREAD REMAINS</p><h3>${collected.has('ledger')?'The train that wasn’t there.':'A train in the rain.'}</h3><p>${collected.has('ledger')?'Two witnesses heard a freight train. The municipal ledger records no movements. Jerry copies the entry into his paper notebook. By morning, he suspects, the original may say something else.':'The gatekeeper mentioned a freight train at 23:56. There is still a municipal freight ledger at the scene. Jerry has a feeling he should read it.'}</p></div><p class="filed">End of the first playable case · The investigation continues.</p><button class="primary" id="back-case">Return to the case</button>`);
  document.querySelector('#back-case').onclick=closeDialog;
}
document.querySelector('#help').onclick=()=>openDialog(`<p class="eyebrow">THE DETECTIVE’S NOTEBOOK</p><h2 id="dialog-title">Follow the evidence.</h2><p><b>1. Investigate.</b> Choose numbered locations in the scene or use the location list. Jerry walks over and records his findings.</p><p><b>2. Compare.</b> Read your evidence notebook. Pay attention to who recorded each fact and which clocks their records use.</p><p><b>3. Deduce.</b> Choose an explanation on the deduction board and attach the essential records that establish it. Use Read to check a record without losing your theory.</p><p>Ask Jerry for a hint whenever you want. There is no timer or penalty. Progress lasts for this visit; reloading starts a new case.</p>`);
try {
  scene=createScene(document.querySelector('#scene'),places,inspect,()=>{
    document.querySelector('#loading').remove();document.querySelectorAll('[data-place]').forEach(b=>b.disabled=false);
  },()=>{document.querySelector('#loading').textContent='Jerry could not load. Reload to try again.';});
  document.querySelector('#rotate').onclick=()=>scene.rotate();
}catch(error){document.querySelector('#loading').textContent='The 3D scene needs WebGL. You can still investigate using the location list.';document.querySelectorAll('[data-place]').forEach(b=>{b.disabled=false;b.onclick=()=>inspect(places.find(p=>p.id===b.dataset.place));});console.error(error);}
