// A presentation of an acknowledged edit. Highlights never alter editor content or selection.
let nextId = 0;
export function agentPresence(pane, getRoot, scroller) {
  const name = 'bw-agent-' + (++nextId);
  let active = null;
  const stop = () => active?.finish();
  const takeoverEvents = ['pointerdown', 'keydown', 'beforeinput', 'compositionstart', 'wheel', 'touchstart'];
  for (const event of takeoverEvents) pane.addEventListener(event, stop, true);
  const visible = () => pane.isConnected && !pane.hidden && pane.getClientRects().length && getRoot()?.getClientRects().length;
  function run(edit, apply, allowed = () => true) {
    stop();
    if (!visible() || matchMedia('(prefers-reduced-motion: reduce)').matches || !CSS.highlights || !window.Highlight) { if (allowed()) apply(); return Promise.resolve(); }
    const root = getRoot(), oldText = root.textContent;
    const blocks = [...root.children];
    const target = blocks[edit.mode === 'append' ? blocks.length - 1 : edit.mode === 'replace_block' ? edit.blockIndex : 0] || root;
    const targetRect = target.getBoundingClientRect(), viewport = scroller.getBoundingClientRect();
    // A person reading elsewhere in the focused editor owns their scroll position.
    // Apply the real update without sending a presentation cursor offscreen.
    if (root.contains(document.activeElement) && (targetRect.bottom < viewport.top || targetRect.top > viewport.bottom)) {
      if (allowed()) apply(); return Promise.resolve();
    }
    let done = false, applied = false, attempted = false, frame = 0, timer = 0, resolve;
    const promise = new Promise(r => { resolve = r; });
    const style = document.createElement('style');
    style.textContent = `::highlight(${name}-select){background:rgba(133,165,84,.32);color:inherit}::highlight(${name}-hide){color:transparent;text-shadow:none}`;
    document.head.append(style);
    const cursor = document.createElement('div');
    cursor.className = 'bw-agent-caret'; cursor.setAttribute('aria-hidden', 'true');
    cursor.innerHTML = '<span>Barkdown</span>';
    document.body.append(cursor);
    pane.dataset.agentPhase = 'target';
    const locate = range => {
      const rect = range.getClientRects()[0] || target.getBoundingClientRect();
      const bounds = scroller.getBoundingClientRect();
      cursor.style.left = Math.max(bounds.left, Math.min(rect.left, bounds.right - 3)) + 'px';
      cursor.style.top = Math.max(bounds.top, Math.min(rect.top, bounds.bottom - 20)) + 'px';
      cursor.style.height = Math.min(30, Math.max(17, rect.height || 20)) + 'px';
    };
    const perform = () => { if (!attempted && allowed()) { attempted = true; applied = apply() !== false; } return applied; };
    const finish = () => {
      if (done) return;
      done = true; clearTimeout(timer); cancelAnimationFrame(frame);
      perform(); CSS.highlights.delete(name + '-select'); CSS.highlights.delete(name + '-hide');
      cursor.remove(); style.remove(); delete pane.dataset.agentPhase;
      if (active?.finish === finish) active = null;
      resolve();
    };
    active = { finish };
    if (targetRect.top < viewport.top + 40 || targetRect.bottom > viewport.bottom - 40) scroller.scrollTop += targetRect.top - viewport.top - 70;
    const selection = document.createRange(); selection.selectNodeContents(target);
    if (edit.mode === 'append') selection.collapse(false);
    locate(selection);
    timer = setTimeout(() => {
      if (!visible() || !allowed()) return finish();
      pane.dataset.agentPhase = 'select';
      CSS.highlights.set(name + '-select', new Highlight(selection));
      timer = setTimeout(() => {
        if (!visible() || !allowed()) return finish();
        CSS.highlights.delete(name + '-select');
        if (!perform()) return finish();
        const updated = getRoot(), text = updated.textContent;
        let start = 0, end = text.length, oldEnd = oldText.length;
        while (start < end && start < oldEnd && text[start] === oldText[start]) start++;
        while (end > start && oldEnd > start && text[end - 1] === oldText[oldEnd - 1]) { end--; oldEnd--; }
        pane.dataset.agentPhase = 'write';
        const nodes = []; const walker = document.createTreeWalker(updated, NodeFilter.SHOW_TEXT);
        let node, length = 0;
        while ((node = walker.nextNode())) { nodes.push({ node, start: length }); length += node.length; }
        const rangeAt = (from, to) => {
          const range = document.createRange();
          const point = offset => { const entry = nodes.find(n => offset <= n.start + n.node.length) || nodes.at(-1); return entry ? [entry.node, Math.max(0, Math.min(entry.node.length, offset - entry.start))] : [updated, 0]; };
          range.setStart(...point(from)); range.setEnd(...point(to)); return range;
        };
        const began = performance.now(), duration = Math.min(1800, Math.max(450, (end - start) * 13));
        const tick = now => {
          if (done) return;
          if (!visible()) return finish();
          const fraction = Math.min(1, (now - began) / duration);
          const at = start + Math.floor((end - start) * fraction);
          CSS.highlights.set(name + '-hide', new Highlight(rangeAt(at, end)));
          locate(rangeAt(at, at));
          if (fraction === 1) { timer = setTimeout(finish, 180); } else frame = requestAnimationFrame(tick);
        };
        tick(began);
      }, 420);
    }, 200);
    return promise;
  }
  return { run, stop, destroy() { stop(); for (const event of takeoverEvents) pane.removeEventListener(event, stop, true); } };
}
