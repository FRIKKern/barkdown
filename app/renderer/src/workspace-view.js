// Only the view belongs to a profile renderer. Provider transcripts and run
// bookkeeping remain main-owned and may advance while a save is acknowledged.
const navigation = ['title', 'folder', 'tabs', 'active', 'draft', 'draftImages', 'following', 'editorExpanded', 'chatScroll', 'closedTargets', 'provider', 'model', 'effort', 'parent', 'parentTitle', 'side', 'createdAt'];
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().filter(key => value[key] !== undefined).map(key => [key, stable(value[key])])) : value;

export function workspaceViewFingerprint(view) {
  const chats = Object.fromEntries(Object.entries(view.chats || {}).map(([id, chat]) => [id,
    view.profileId ? Object.fromEntries(navigation.filter(key => key in chat || key === 'closedTargets').map(key => [key, key === 'closedTargets' ? chat[key] || [] : chat[key]]))
      : { ...chat, runId: null }]));
  return JSON.stringify(stable({ profileId: view.profileId || null, generation: view.generation || null,
    chats, order: view.order || [], favorites: view.favorites || [], pages: view.pages || null,
    current: view.current || null, mode: view.mode || 'chat', directTab: view.directTab || null }));
}
