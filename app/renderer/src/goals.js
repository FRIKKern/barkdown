// Acknowledged goal snapshots. Worker destinations remain ordinary full conversations.
import { el, esc } from './ui.js';
import { openDialog } from './dialogs.js';
const states = { planned:'Ready to start', active:'In progress', paused:'Paused', cancelled:'Cancelled', expired:'Time window ended', review:'Ready for review', completed:'Completed' };
const tasks = { pending:'Waiting', running:'Running', interrupted:'Needs reconciliation', failed:'Failed', cancelled:'Stopped', review:'Result to review', completed:'Reviewed' };

export function openGoalView({ owner, service, openChat, onSaved = () => {} }) {
  const captured = Object.freeze({ ...owner }), previousFocus = document.activeElement;
  const node = el(`<section class="bw-sheet bw-goals" role="dialog" aria-modal="true" aria-label="Conversation goals"><header><div><h2>Conversation goals</h2><p>Bounded work, with each worker in a full side chat.</p></div><button data-close aria-label="Close goals">×</button></header><div class="bw-goal-error" role="alert" hidden></div><main data-content><p>Loading goals…</p></main><footer><span>Work continues while Barkdown is open and the computer is awake. Deadlines use the clock.</span><button data-refresh>Refresh</button></footer></section>`);
  let disposed = false, busy = false, revision = 0, goals = [], unsubscribe;
  const q = selector => node.querySelector(selector);
  const closeDialog = openDialog(node, { onDismiss: () => close() });
  function close() { disposed = true; unsubscribe?.(); closeDialog(); previousFocus?.focus(); }
  q('[data-close]').onclick = close;
  function error(message) { q('.bw-goal-error').hidden = !message; q('.bw-goal-error').textContent = message || ''; }
  async function invoke(operation) {
    if (busy || disposed) return;
    busy = true; error(''); node.setAttribute('aria-busy','true');
    try { await operation(); if (!disposed) { await refresh(); onSaved(); } }
    catch (e) { if (!disposed) error(e.message || String(e)); }
    finally { busy = false; node.removeAttribute('aria-busy'); }
  }
  async function refresh() {
    const request = ++revision;
    try { const result = await service.list(captured); if (disposed || request !== revision) return; goals = result; render(); }
    catch (e) { if (!disposed && request === revision) error(e.message || String(e)); }
  }
  q('[data-refresh]').onclick = refresh;
  const reviewFields = () => '<label>What did you verify?<textarea name="note" required rows="2"></textarea></label><label>Evidence references, one per line<textarea name="evidence" required rows="2" placeholder="Test result, saved revision, or artifact path"></textarea></label>';
  const evidence = form => { const data = new FormData(form); return { note:data.get('note'), evidence:String(data.get('evidence')).split('\n').map(s=>s.trim()).filter(Boolean) }; };
  function taskHtml(goal, task) {
    const attempt = task.attempts.at(-1), terminal = ['expired','cancelled','completed'].includes(goal.status);
    const waiting = task.status==='pending' && task.dependsOn.some(id=>goal.tasks.find(t=>t.id===id)?.status!=='completed');
    const pendingTermination = task.status==='interrupted' && !attempt?.stoppedAt;
    return `<article class="bw-goal-task" data-task="${esc(task.id)}"><div class="bw-goal-task-head"><button data-chat="${esc(task.chatId)}">${esc(task.title || task.chatTitle || task.id)} ↗</button><span class="bw-goal-state" data-state="${esc(task.status)}">${esc(terminal&&task.status==='pending'?'Not started':waiting?'Waiting for reviewed dependency':tasks[task.status])}</span></div><p>${esc(task.prompt)}</p><p class="bw-goal-context">${esc(task.context.provider)}${task.context.model?' · '+esc(task.context.model):''}${task.context.effort?' · '+esc(task.context.effort):''} · ${esc(task.context.folder || 'No working folder')}</p>
      ${attempt?.progress?.text?`<p class="bw-goal-progress">${esc(attempt.progress.text)}</p>`:''}${task.status==='completed'&&task.review?.note?`<p class="bw-goal-reason">Verified: ${esc(task.review.note)}</p>`:attempt?.reason&&task.status!=='completed'?`<p class="bw-goal-reason">${esc(attempt.reason)}</p>`:''}${attempt?.result?.text?`<details><summary>Observed result</summary><pre>${esc(attempt.result.text)}</pre></details>`:''}
      ${pendingTermination?'<p class="bw-goal-reason">Provider termination is not confirmed. Check shutdown before reconciling or retrying.</p><button data-command="reconcileTermination">Check worker shutdown</button>':['review','interrupted','failed','cancelled'].includes(task.status)?`<details class="bw-goal-review"><summary>Review evidence and effects</summary><form data-review="${esc(task.id)}">${reviewFields()}<div class="bw-goal-actions">${['review','interrupted'].includes(task.status)?'<button name="decision" value="accept" class="primary">Accept verified work</button>':''}${!terminal?'<button name="decision" value="retry">Reconciled; retry remaining work</button>':''}<button name="decision" value="reject">Record unresolved result</button></div></form></details>`:''}</article>`;
  }
  function render() {
    const fieldKey = field => [field.closest('[data-goal]')?.dataset.goal || 'new',field.closest('form')?.dataset.review || 'goal',field.name].join('|');
    const drafts = new Map([...node.querySelectorAll('textarea,input')].map(field=>[fieldKey(field),field.value]));
    const focus = node.contains(document.activeElement) && document.activeElement.matches('textarea,input') ? {key:fieldKey(document.activeElement),start:document.activeElement.selectionStart,end:document.activeElement.selectionEnd} : null;
    const scroll = q('[data-content]').scrollTop;
    const openDetails = new Set([...node.querySelectorAll('details[open]')].map(detail=>[detail.closest('[data-goal]')?.dataset.goal || 'new',detail.closest('[data-task]')?.dataset.task || '',detail.className].join('|')));
    q('[data-content]').innerHTML = `${goals.map(goal=>`<section class="bw-goal-card" data-goal="${esc(goal.id)}"><div class="bw-goal-heading"><h3>${esc(goal.objective)}</h3><span class="bw-goal-state" data-state="${esc(goal.status)}">${esc(states[goal.status])}</span></div><p class="bw-goal-deadline">Deadline ${esc(new Date(goal.deadline).toLocaleString())} · ${goal.tasks.filter(t=>t.status==='completed').length} of ${goal.tasks.length} tasks reviewed</p>${goal.reason?`<p>${esc(goal.reason)}</p>`:''}<div class="bw-goal-actions">${['planned','paused'].includes(goal.status)?`<button class="primary" data-command="start">${goal.status==='paused'?'Resume':'Start'}</button>`:''}${goal.status==='active'?'<button data-command="pause">Pause</button>':''}${!['completed','cancelled','expired'].includes(goal.status)?'<button data-command="cancel">Cancel goal</button>':''}</div>${goal.tasks.map(t=>taskHtml(goal,t)).join('')}${goal.status==='review'?`<form data-complete>${reviewFields()}<button class="primary">Mark verified goal complete</button></form>`:''}</section>`).join('')}
      <details class="bw-goal-create" ${goals.length?'':'open'}><summary>New goal</summary><form data-create><label>Goal<textarea name="objective" rows="3" required placeholder="What should this conversation accomplish?"></textarea></label><label>Time window in minutes<input name="minutes" type="number" min="1" max="10080" value="60" required></label><p>Give three workers bounded assignments. Each starts with this conversation’s folder and model choices.</p>${[1,2,3].map(n=>`<label>Worker ${n} assignment<textarea name="worker${n}" rows="2" required></textarea></label>`).join('')}<button class="primary">Create planned goal</button></form></details>`;
    node.querySelectorAll('[data-chat]').forEach(button=>button.onclick=()=>{ const id=button.dataset.chat; close(); openChat(captured,id); });
    node.querySelectorAll('[data-command]').forEach(button=>button.onclick=()=>invoke(()=>service.command(captured,button.closest('[data-goal]').dataset.goal,button.dataset.command,button.closest('[data-task]')?{taskId:button.closest('[data-task]').dataset.task}:undefined)));
    node.querySelectorAll('[data-review]').forEach(form=>form.onsubmit=event=>{ event.preventDefault(); const decision=event.submitter?.value; if(decision) invoke(()=>service.command(captured,form.closest('[data-goal]').dataset.goal,'reviewTask',{taskId:form.dataset.review,accepted:decision==='accept',retry:decision==='retry',...evidence(form)})); });
    node.querySelectorAll('[data-complete]').forEach(form=>form.onsubmit=event=>{ event.preventDefault(); invoke(()=>service.command(captured,form.closest('[data-goal]').dataset.goal,'complete',evidence(form))); });
    q('[data-create]').onsubmit=event=>{ event.preventDefault(); const data=new FormData(event.currentTarget); invoke(()=>service.create(captured,{objective:data.get('objective'),durationMinutes:Number(data.get('minutes')),assignments:[1,2,3].map(n=>({title:`Worker ${n}`,prompt:data.get(`worker${n}`)}))})); };
    node.querySelectorAll('details').forEach(detail=>{if(openDetails.has([detail.closest('[data-goal]')?.dataset.goal || 'new',detail.closest('[data-task]')?.dataset.task || '',detail.className].join('|')))detail.open=true;});
    node.querySelectorAll('textarea,input').forEach(field=>{const key=fieldKey(field);if(drafts.has(key))field.value=drafts.get(key);if(focus?.key===key){field.focus();if(field.setSelectionRange&&field.type!=='number')field.setSelectionRange(focus.start,focus.end);}});
    node.querySelectorAll('[data-command="start"]').forEach(button=>{const goal=goals.find(g=>g.id===button.closest('[data-goal]').dataset.goal);if(goal.tasks.some(t=>['running','interrupted'].includes(t.status))){button.disabled=true;button.title='Reconcile interrupted workers before resuming';}});
    q('[data-content]').scrollTop=scroll;
  }
  if(service.subscribe) unsubscribe=service.subscribe(captured,refresh);
  refresh(); q('[data-close]').focus();
  node.addEventListener('keydown',event=>{ if(event.key!=='Tab') return; const controls=[...node.querySelectorAll('button,input,textarea,summary')].filter(e=>!e.disabled&&e.getClientRects().length); if(!controls.length)return; if(event.shiftKey&&document.activeElement===controls[0]){event.preventDefault();controls.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===controls.at(-1)){event.preventDefault();controls[0].focus();} });
  return {close,refresh};
}
