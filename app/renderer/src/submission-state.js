// A pending send is shared by main/side composers and managed refreshes, but is
// never a persisted attempt or permission to replay work after a reload.
const pending = new WeakMap(), revisions = new WeakMap();
export const isSubmitting = chat => Boolean(chat && pending.has(chat));
export function markDraftChanged(chat) { if (chat) revisions.set(chat, (revisions.get(chat) || 0) + 1); }
export function beginSubmission(chat) {
  if (isSubmitting(chat)) return null;
  const intent = { revision: revisions.get(chat) || 0, draft: chat.draft, images: JSON.stringify(chat.draftImages || []) };
  pending.set(chat, intent);
  return intent;
}
export function acceptSubmission(chat, intent) {
  if (pending.get(chat) !== intent) return;
  if ((revisions.get(chat) || 0) === intent.revision && chat.draft === intent.draft && JSON.stringify(chat.draftImages || []) === intent.images) {
    chat.draft = ''; chat.draftImages = [];
  }
}
export function endSubmission(chat, intent) { if (pending.get(chat) === intent) pending.delete(chat); }
export function restoreFailedMessage(chat, index) {
  if (isSubmitting(chat) || chat.runId || chat.interruption || chat.draft || chat.draftImages?.length) return false;
  const reply = chat.messages[index], user = chat.messages[index - 1];
  if (!['api','claude','codex'].includes(reply?.authProvider) || user?.role !== 'user') return false;
  chat.draft = user.text || '';
  chat.draftImages = structuredClone(user.images || []);
  markDraftChanged(chat);
  return true;
}
export function mergeSubmissionMessages(chat, authoritative) {
  const intent = pending.get(chat);
  if (!intent?.attemptId || !intent.user || !intent.reply) return authoritative;
  // Before reservation the durable view cannot contain this optimistic pair.
  // Once it does, adopt main's exact transcript and its early provider events.
  if (authoritative.some(message => message.id === intent.reply.id)) return authoritative;
  return [...authoritative, intent.user, intent.reply];
}
