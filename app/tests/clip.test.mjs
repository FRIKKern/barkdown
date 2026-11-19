// Web clipper: a page or a selection becomes a Paper note's markdown (shared/clip.js), and the save keeps
// New page's rules (renderer/src/clip-note.js): the intent with its content is saved before main is asked,
// one press makes one note, and a late result after a profile switch is dropped.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { JSDOM } from 'jsdom';
const require = createRequire(import.meta.url);
const { clipPage } = require('../shared/clip');
const { markdownToBlocks } = require('../shared/portabledoc');
const parse = html => new (new JSDOM('').window.DOMParser)().parseFromString(html, 'text/html');
const now = new Date(2026, 10, 15, 12, 0, 0);

const page = `<!doctype html><html><head><title>Badgers at dusk</title><script>window.stolen = 1</script><style>p{color:red}</style></head><body>
<nav><a href="/">Home</a> <a href="/about">About the site</a></nav>
<div class="cookie-banner">We use cookies. <button>Accept</button></div>
<article>
  <h1>Badgers at dusk</h1>
  <p>Badgers leave the sett <strong>after sunset</strong> and follow <a href="/paths?x=1">old paths</a>.</p>
  <h2>What they eat</h2>
  <ul><li>Earthworms</li><li>Beetles <em>and</em> grubs</li></ul>
  <pre><code class="language-js">const sett = dig();
if (sett) sleep();</code></pre>
  <img src="img/badger.jpg" alt="A badger" onerror="alert(1)">
  <p><a href="javascript:alert(2)">Click me</a> and <a href="https://example.org/(paren)">a paren link</a>.</p>
  <script>document.write('injected')</script>
  <table><tr><th>Month</th><th>Cubs</th></tr><tr><td>March</td><td>3</td></tr></table>
  <blockquote><p>The badger is a quiet neighbour.</p></blockquote>
</article>
<aside>Related: foxes</aside>
<footer>© Example 2026 · Privacy</footer>
</body></html>`;

test('a page clips to its article: title, source line, absolute links, no chrome or script', () => {
  const clip = clipPage({ html: page, url: 'https://example.com/wild/badgers.html', now, parse });
  const md = clip.markdown;
  assert.equal(clip.title, 'Badgers at dusk');
  assert.match(md.split('\n')[0], /^Source: \[example\.com\/wild\/badgers\.html\]\(https:\/\/example\.com\/wild\/badgers\.html\) · 2026-11-15$/);
  assert.match(md, /^## What they eat$/m);
  assert.match(md, /^- Earthworms$/m); assert.match(md, /^- Beetles \*and\* grubs$/m);
  assert.match(md, /\*\*after sunset\*\*/);
  assert.match(md, /\[old paths\]\(https:\/\/example\.com\/paths\?x=1\)/);
  assert.match(md, /```js\nconst sett = dig\(\);\nif \(sett\) sleep\(\);\n```/);
  assert.match(md, /\[Image: A badger\]\(https:\/\/example\.com\/wild\/img\/badger\.jpg\)/);
  assert.match(md, /\(https:\/\/example\.org\/%28paren%29\)/);
  assert.match(md, /^\| Month \| Cubs \|$/m); assert.match(md, /^\| March \| 3 \|$/m);
  assert.match(md, /^> The badger is a quiet neighbour\.$/m);
  // The article's own h1 is the note's title, not a second heading.
  assert.doesNotMatch(md, /^#+ Badgers at dusk$/m);
  for (const gone of ['Home', 'About the site', 'cookies', 'Accept', 'Related: foxes', 'Privacy', 'stolen', 'injected', 'alert', 'javascript:', 'onerror', 'color:red'])
    assert(!md.includes(gone), `clip leaks ${gone}:\n${md}`);
  assert(md.includes('Click me'), 'the text of a dropped javascript: link stays');
  // What main will do with it: every block converts.
  const blocks = markdownToBlocks(md);
  assert(blocks.some(b => b.type === 'code' && b.lang === 'js'));
  assert(blocks.some(b => b.type === 'table'));
  assert(blocks.some(b => b.type === 'list'));
});

test('a selection clips only the selection, with the same source line', () => {
  const clip = clipPage({ html: page, url: 'https://example.com/wild/badgers.html', selectionHtml: '<li>Beetles <em>and</em> grubs</li><li>Earthworms</li>', now, parse });
  assert.equal(clip.title, 'Badgers at dusk');
  assert.equal(clip.markdown, 'Source: [example.com/wild/badgers.html](https://example.com/wild/badgers.html) · 2026-11-15\n\n- Beetles *and* grubs\n- Earthworms\n');
  const plain = clipPage({ html: page, url: 'https://example.com/a', selectionHtml: 'just some <b>words</b> here', now, parse });
  assert.match(plain.markdown, /\n\njust some \*\*words\*\* here\n$/);
});

test('text that looks like markdown stays text, and awkward structure still converts', () => {
  const html = `<title>T</title><main><p># not a heading</p><p>- not a list</p><p>1. not a list</p><p>[x](javascript:alert(1))</p>
    <ul><li>outer<ul><li>inner</li></ul></li></ul><blockquote><p>one</p><p>two</p></blockquote>
    <table><tr><td>a|b</td><td colspan="1">c</td></tr><tr><td>only</td></tr></table><pre>\`\`\`
fence</pre><p>line one<br>  - two</p></main>`;
  const { markdown } = clipPage({ html, url: 'https://example.com/', now, parse });
  const blocks = markdownToBlocks(markdown);
  assert(!blocks.some(b => b.type === 'heading'), markdown);
  assert.equal(blocks.filter(b => b.type === 'list').length, 1, markdown);
  assert(!JSON.stringify(blocks).includes('"href":"javascript'), markdown);
  assert(blocks.some(b => b.type === 'table' && b.rows.length === 1), markdown);
  assert(blocks.some(b => b.type === 'blockquote'), markdown);
});

// Every link in the note is http(s) or mailto, however the page splits "[text](url)" across nodes.
const hrefs = node => Array.isArray(node) ? node.flatMap(hrefs) : node && typeof node === 'object' ? [...(node.type === 'link' ? [String(node.href)] : []), ...Object.values(node).flatMap(hrefs)] : [];
test('a page cannot assemble a javascript:, data: or file: link from separate pieces', () => {
  const cases = {
    span: '<p>[click me]<span>(javascript:alert(1))</span></p>',
    comment: '<p>[x]<!-- -->(javascript:alert(1))</p>',
    anchorWithoutHref: '<p><a name="x">[y]</a>(file:///etc/passwd)</p>',
    codeWithBacktick: '<p><code>a`[x]</code>(javascript:alert(1))</p>',
    codeSpan: '<p>[x <code>a]</code>(javascript:alert(1))</p>',
    data: '<p>[x]<span>(data:text/html,&lt;script&gt;alert(1)&lt;/script&gt;)</span></p>',
  };
  for (const [name, body] of Object.entries(cases)) {
    const { markdown } = clipPage({ html: `<title>T</title><main><h2>Kept heading</h2>${body}</main>`, url: 'https://example.com/', now, parse });
    const links = hrefs(markdownToBlocks(markdown));
    assert(links.every(h => /^(https?:|mailto:)/.test(h)), `${name}: ${links.join(', ')}\n${markdown}`);
  }
  const sel = clipPage({ html: '<title>T</title>', url: 'https://example.com/', selectionHtml: '[s]<i></i>(javascript:alert(3))', now, parse });
  assert(hrefs(markdownToBlocks(sel.markdown)).every(h => /^https?:/.test(h)), sel.markdown);
});

test('a quote that starts like a list or heading stays a quote and keeps the note structured', () => {
  const html = '<title>T</title><article><h2>Section</h2><ul><li>one</li><li>two</li></ul><blockquote><p>1. Never give up</p></blockquote><blockquote><p># not a heading</p></blockquote><pre>code()</pre></article>';
  const blocks = markdownToBlocks(clipPage({ html, url: 'https://example.com/', now, parse }).markdown);
  assert.deepEqual(blocks.map(b => b.type), ['paragraph', 'heading', 'list', 'blockquote', 'blockquote', 'code']);
});

test('a huge page is capped and the note says so', () => {
  const html = `<title>Huge</title><article>${Array.from({ length: 4000 }, (_, i) => `<p>Paragraph ${i} ${'word '.repeat(40)}</p>`).join('')}</article>`;
  const clip = clipPage({ html, url: 'https://example.com/huge', now, parse });
  assert(clip.truncated);
  assert(clip.markdown.length < 105000, String(clip.markdown.length));
  assert.match(clip.markdown, /Clipped: this note keeps the first part of the page/);
  markdownToBlocks(clip.markdown);
});

test('without an article the densest text wins over navigation', () => {
  const html = `<title>No landmarks</title><body><div class="menu">${'<a href="/x">Link</a> '.repeat(60)}</div>
    <div id="content"><div><p>${'Real words about the topic. '.repeat(20)}</p><p>${'More words. '.repeat(20)}</p></div></div><div>© footer text</div></body>`;
  const { markdown } = clipPage({ html, url: 'https://example.com/', now, parse });
  assert.match(markdown, /Real words about the topic/); assert.doesNotMatch(markdown, /Link/); assert.doesNotMatch(markdown, /footer text/);
});

// ---- the save action (renderer ESM inside a CommonJS package)
// Renderer modules are ESM in this CommonJS package; Node 22 detects that and imports them as they are.
const { createClipAction } = await import('../renderer/src/clip-note.js');
const id = '22222222-2222-4222-8222-222222222222';
function fixture() {
  const state = { profileId: 'A', generation: 1, pages: {}, barkparkDocs: [], settings: { barkpark: { enabled: true } } };
  const calls = [], errors = [], saved = [];
  const args = { state, serialise: () => structuredClone(state), pages: () => state.pages, refresh: async () => {}, render: () => {}, newId: () => id,
    api: { state: { save: async value => { calls.push(['save', value]); } }, barkpark: { createNoteWith: async input => { calls.push(['create', input]); return { id: 'drafts.bd-note-' + input.requestId, paperOwner: 'owner', title: input.title }; } } },
    place: note => calls.push(['place', note]), open: note => calls.push(['open', note]), report: e => errors.push(e), done: note => saved.push(note) };
  return { state, calls, errors, saved, args };
}
const capture = async () => ({ title: 'Badgers', markdown: 'Source: x\n\nBody\n' });

test('the clip and its request are saved before main is asked, then placed and opened once', async () => {
  const f = fixture(), save = createClipAction(f.args);
  await Promise.all([save(capture), save(capture)]);
  assert.equal(f.calls[0][0], 'save'); assert.deepEqual(f.calls[0][1].pages.clipCreation, { requestId: id, profileId: 'A', title: 'Badgers', markdown: 'Source: x\n\nBody\n' });
  assert.equal(f.calls.filter(c => c[0] === 'create').length, 1, 'two quick presses make one note');
  assert.deepEqual(f.calls.find(c => c[0] === 'create')[1], { requestId: id, title: 'Badgers', markdown: 'Source: x\n\nBody\n' });
  assert.equal(f.calls.filter(c => c[0] === 'place').length, 1); assert.equal(f.calls.filter(c => c[0] === 'open').length, 1);
  assert.equal(f.state.pages.clipCreation, undefined); assert.equal(f.saved.length, 1);
});

test('an unconfirmed clip is kept and the next press checks the same request with the same content', async () => {
  const f = fixture(); f.args.api.barkpark.createNoteWith = async input => { f.calls.push(['create', input]); throw Error('lost reply'); };
  await createClipAction(f.args)(capture);
  assert.equal(f.state.pages.clipCreation.requestId, id); assert.equal(f.errors.length, 1); assert.match(f.errors[0], /not confirmed/);
  f.args.api.barkpark.createNoteWith = async input => { f.calls.push(['retry', input]); return { id: 'drafts.x', paperOwner: 'owner' }; };
  await createClipAction({ ...f.args, newId: () => 'other' })(async () => ({ title: 'Another page', markdown: 'other' }));
  assert.deepEqual(f.calls.find(c => c[0] === 'retry')[1], { requestId: id, title: 'Badgers', markdown: 'Source: x\n\nBody\n' });
});

test('a late result after a profile switch is dropped: nothing placed or opened in the other profile', async () => {
  const f = fixture(), original = f.state.pages;
  f.args.api.barkpark.createNoteWith = async () => { f.state.profileId = 'B'; f.state.generation++; f.state.pages = {}; return { id: 'drafts.x' }; };
  await createClipAction(f.args)(capture);
  assert.equal(original.clipCreation.requestId, id); assert.equal(f.state.pages.clipCreation, undefined);
  assert(!f.calls.some(c => ['place', 'open'].includes(c[0]))); assert.equal(f.state.barkparkDocs.length, 0); assert.equal(f.errors.length, 0);
});

test('a refused capture or a failed intent save creates nothing', async () => {
  const f = fixture();
  await createClipAction(f.args)(async () => { throw Error('The page is still loading.'); });
  assert(!f.calls.length); assert.match(f.errors[0], /still loading/); assert.equal(f.state.pages.clipCreation, undefined);
  const g = fixture(); g.args.api.state.save = async () => { throw Error('disk unavailable'); };
  await createClipAction(g.args)(capture);
  assert(!g.calls.some(c => c[0] === 'create')); assert.equal(g.errors.length, 1);
});

// Save as a note from the chat menu uses this same action in the slot `chatNoteCreation`.
const id2 = '33333333-3333-4333-8333-333333333333';
const ids = () => { const list = [id, id2]; return () => list.shift(); };
const chatNote = (f, extra = {}) => createClipAction({ ...f.args, newId: ids(), slot: 'chatNoteCreation', lenient: true,
  words: { earlier: 'The earlier chat note', saving: 'Saving the chat as a note' }, remember: chatId => ({ chatId }), ...extra });
const kept = f => f.calls.filter(c => c[0] === 'save').at(-1)[1].pages.chatNoteCreation;

test('a request main refuses for good is dropped at once with the reason, and the next press makes a new note', async () => {
  for (const [code, why] of [['draft_identity', 'The server refused this creation.'], ['writes_disabled', 'Enable local Paper writes before creating a note.']]) {
    const f = fixture(), ok = f.args.api.barkpark.createNoteWith;
    // As it arrives across the context bridge: the message only, "[code] text" (preload.js); no .code.
    f.args.api.barkpark.createNoteWith = async input => { f.calls.push(['create', input]); throw new Error(`[${code}] ${why}`); };
    const save = chatNote(f);
    await save(capture, 'otter');
    assert.equal(f.state.pages.chatNoteCreation, undefined, `${code}: not kept`);
    assert.equal(kept(f), undefined, `${code}: the drop is saved`);
    assert.equal(save.kept(), false, 'Pages shows no notice');
    assert.equal(f.errors.length, 1); assert.match(f.errors[0], /refused, so that request was dropped/); assert(f.errors[0].endsWith('Press again to try anew. ' + why), f.errors[0]);
    f.args.api.barkpark.createNoteWith = ok;
    await save(async () => ({ title: 'Heron watch', markdown: 'Herons wait.' }), 'heron');
    assert.deepEqual(f.calls.filter(c => c[0] === 'create').at(-1)[1], { requestId: id2, title: 'Heron watch', markdown: 'Herons wait.', lenient: true }, 'a new request with the new chat');
    assert.equal(f.state.pages.chatNoteCreation, undefined);
  }
});

test('a 422 with the server’s own code keeps that code all the way to the window and is still dropped as refused for good', async () => {
  // Main's real create (draft-notes.js) against a server that answers 422 validation_failed, then the answer
  // as main's IPC envelope and preload put it across the bridge (shared/error-code.js wireMessage).
  const fsm = await import('node:fs'), os = await import('node:os'), path = await import('node:path');
  const { createDraftNotes } = require('../main/draft-notes'), { createStore } = require('../main/store'), { wireMessage, errorCode } = require('../shared/error-code');
  const store = createStore(fsm.mkdtempSync(path.join(os.tmpdir(), 'bd-clip-refused-')));
  const server = async (_c, method) => { if (method === 'POST') throw Object.assign(new Error('Block 3 is not valid.'), { status: 422, code: 'validation_failed' }); throw Object.assign(new Error('Missing'), { status: 404 }); };
  const notes = createDraftNotes({ store, profileId: '44444444-4444-4444-8444-444444444444', paperOwner: 'a'.repeat(64), config: { enabled: true, writes: true, server: 'http://fixture', dataset: 'test' }, assertOwned: () => {}, request: server });
  const f = fixture(), seen = [];
  f.args.api.barkpark.createNoteWith = async input => {
    try { return await notes.create(input.requestId, { title: input.title, markdown: '' }, { blocks: [] }); }
    catch (error) { seen.push(error.code); const bridged = new Error(wireMessage({ code: error.code, refused: error.refused, message: error.message })); seen.push(errorCode(bridged)); throw bridged; }
  };
  await chatNote(f)(capture, 'otter');
  assert.deepEqual(seen, ['validation_failed', 'validation_failed'], 'the server’s code in main and in the window');
  assert.equal(f.state.pages.chatNoteCreation, undefined, 'dropped as refused for good');
  assert(f.errors[0].endsWith('Press again to try anew. Block 3 is not valid.'), f.errors[0]);
});

test('Retry from Pages with the library off says so and keeps the request', async () => {
  const f = fixture(); let off = false;
  f.args.api.barkpark.createNoteWith = async () => { throw Error('lost reply'); };
  const why = 'Saving to notes needs this profile’s local library. Turn it on in Settings › Barkpark.';
  const save = createClipAction({ ...f.args, unavailable: () => off ? why : null });
  await save(capture, null);
  assert.equal(f.state.pages.clipCreation.requestId, id);
  f.calls.length = 0; f.errors.length = 0; off = true;
  await save.retry();
  assert.deepEqual(f.errors, [why], 'the library message, not "not confirmed"');
  assert.equal(f.calls.length, 0, 'nothing saved or sent'); assert.equal(f.state.pages.clipCreation.requestId, id, 'the request is kept');
  await save(capture, null); assert.equal(f.errors.at(-1), why, 'a new press says the same');
});

test('Discard drops a kept request: Pages loses its notice and the next press makes a new note', async () => {
  const f = fixture(), ok = f.args.api.barkpark.createNoteWith;
  f.args.api.barkpark.createNoteWith = async () => { throw Error('lost reply'); };
  const save = chatNote(f);
  await save(capture, 'otter');
  assert.equal(kept(f).requestId, id); assert.equal(save.kept(), true, 'Pages shows the notice');
  assert.equal(await save.discard(), true);
  assert.equal(f.state.pages.chatNoteCreation, undefined); assert.equal(kept(f), undefined, 'the drop is saved'); assert.equal(save.kept(), false);
  assert.equal(await save.discard(), false, 'nothing left to discard');
  f.args.api.barkpark.createNoteWith = ok;
  await save(async () => ({ title: 'Heron watch', markdown: 'Herons wait.' }), 'heron');
  assert.equal(f.calls.filter(c => c[0] === 'create').at(-1)[1].requestId, id2);
});

test('Retry checks the same request and opens the note beside the chat it came from', async () => {
  const f = fixture(), ok = f.args.api.barkpark.createNoteWith, opened = [], done = [];
  f.args.api.barkpark.createNoteWith = async () => { throw Error('lost reply'); };
  const save = chatNote(f, { open: (note, to, intent) => opened.push([to, intent.chatId]), done: (note, intent, earlier, retried) => done.push([earlier, retried]) });
  await save(capture, 'otter');
  assert.equal(kept(f).chatId, 'otter');
  f.args.api.barkpark.createNoteWith = ok;
  await save.retry();
  assert.deepEqual(f.calls.filter(c => c[0] === 'create').at(-1)[1], { requestId: id, title: 'Badgers', markdown: 'Source: x\n\nBody\n', lenient: true });
  assert.deepEqual(opened, [[null, 'otter']]); assert.deepEqual(done, [[true, true]]);
  assert.equal(await save.retry(), undefined, 'a retry with nothing kept makes nothing');
  assert.equal(f.calls.filter(c => c[0] === 'create').length, 1);
});

// The reviewer's scene: Otter's request is kept, the person is on Heron and presses Save as a note there.
test('Save as a note on Heron while Otter’s request is kept: the screen stays on Heron, and following the message saves each chat once', async () => {
  const dom = new JSDOM('<div id="bw-toasts"></div>');
  globalThis.document = dom.window.document;
  const { createChatMenu } = await import('../renderer/src/chat-menu.js');
  const toasts = () => [...dom.window.document.querySelectorAll('.bw-toast')].map(n => n.textContent);
  for (const otterLands of [true, false]) {
    dom.window.document.getElementById('bw-toasts').replaceChildren();
    const chat = (id, title) => ({ id, title, messages: [{ role: 'user', text: `${title} words` }] });
    const state = { profileId: 'A', generation: 1, pages: {}, barkparkDocs: [], current: 'otter', settings: { barkpark: { local: { enabled: true } } },
      chats: { otter: chat('otter', 'Otter notes'), heron: chat('heron', 'Heron watch') } };
    const made = new Map(), opened = [], switched = [];
    let lost = true, otterAnswers = otterLands;
    const api = { state: { save: async () => {} }, barkpark: { createNoteWith: async input => {
      const otter = input.title === 'Otter notes';
      // Otter's first send is a lost reply after the note landed; later sends answer as the scene says.
      if (otter && lost) { lost = false; made.set(input.requestId, input.title); throw Error('lost reply'); }
      if (otter && !otterAnswers) throw Error('timed out');
      made.set(input.requestId, input.title);
      return { id: 'drafts.bd-note-' + input.requestId, paperOwner: 'owner', title: input.title };
    } } };
    const menu = createChatMenu({ state, api, serialise: () => structuredClone(state), render: () => {}, refresh: async () => {}, pages: () => state.pages, place: () => {},
      openNote: (note, chatId) => { opened.push([note.title, chatId]); if (chatId !== state.current) { switched.push(chatId); state.current = chatId; } },
      deleteChat: () => {}, switchChat: id => { switched.push(id); state.current = id; } });
    const press = id => menu.saveNote(async () => ({ title: state.chats[id].title, markdown: `# ${state.chats[id].title}` }), id);
    await press('otter');
    assert.equal(state.pages.chatNoteCreation.chatId, 'otter', 'Otter’s request is kept');
    state.current = 'heron';
    await press('heron');
    if (!otterLands) {
      const message = toasts().at(-1);
      assert.match(message, /“Heron watch” was not saved\. Press Save as a note on “Heron watch” again: it checks “Otter notes”’s note first/, message);
      assert.equal(state.pages.chatNoteCreation.chatId, 'otter', 'Otter’s request is still kept');
      otterAnswers = true;
      await press('heron'); // following the message
    }
    const titles = [...made.values()].sort();
    assert.deepEqual(titles, ['Heron watch', 'Otter notes'], `${otterLands}: one Otter note and one Heron note: ${titles}`);
    assert.deepEqual(switched, [], 'the screen never moved to another chat');
    assert.equal(state.current, 'heron');
    assert.deepEqual(opened, [['Heron watch', 'heron']], 'only Heron’s note opens, beside Heron');
    assert.equal(state.pages.chatNoteCreation, undefined, 'nothing kept');
    assert(toasts().some(t => t.startsWith('Saved the earlier note of “Otter notes”, which was not confirmed: Otter notes. It is in Pages.')), toasts().join(' | '));
    assert(toasts().some(t => t === 'Saved as a note: Heron watch'), toasts().join(' | '));
  }
  delete globalThis.document;
});

// ---- main: the capture reads only this window's webview, in an isolated world, and caps what it returns
const { createPageCapture, MAX_HTML } = require('../main/page-capture');
test('the page capture refuses a foreign tab, answers a loading page at once and caps the page', async () => {
  const host = {}, worlds = [];
  const guest = (over = {}) => ({ isDestroyed: () => false, getType: () => 'webview', hostWebContents: host, isLoadingMainFrame: () => false, getURL: () => 'https://example.com/',
    executeJavaScriptInIsolatedWorld: async (world, scripts) => { worlds.push(world); return { html: 'x'.repeat(MAX_HTML + 10), selectionHtml: 7 }; }, ...over });
  const capture = contents => createPageCapture({ webContentsFromId: () => contents, host: () => host });
  await assert.rejects(capture(guest({ hostWebContents: {} }))({ webContentsId: 1 }), /not a page in this window/);
  await assert.rejects(capture(guest({ getType: () => 'window' }))({ webContentsId: 1 }), /not a page in this window/);
  assert.deepEqual(await capture(guest({ isLoadingMainFrame: () => true }))({ webContentsId: 1 }), { loading: true });
  const page = await capture(guest())({ webContentsId: 1, selection: true });
  assert.equal(page.html.length, MAX_HTML); assert.equal(page.selectionHtml, null); assert.equal(page.url, 'https://example.com/');
  assert(worlds.length === 1 && worlds[0] > 0, 'an isolated world, not the page\'s own');
});
