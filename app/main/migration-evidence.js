// Inspect exact retained legacy records. No restore, Undo, proposal acceptance or Paper adapter.
const crypto = require('node:crypto');
const { validateBackup } = require('./migration-restore');
const { fail, hash } = require('./migration-journal');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const revision = value => Number.isSafeInteger(value) && value > 0;
const content = value => object(value) && value.type === 'doc' && Array.isArray(value.content);

function readRetainedDocument(options) {
  const { documentId } = options;
  if (typeof documentId !== 'string' || !/^[\w-]{1,128}$/.test(documentId)) fail('evidence_identity', 'An exact local document identity is required');
  const backup = validateBackup(options);
  const documentFile = backup.files.find(file => file.path === `documents/${documentId}.json`);
  if (!documentFile) fail('evidence_missing', 'Document is absent from the captured backup');
  function parsed(file) {
    try { return JSON.parse(backup.content(file).toString('utf8')); }
    catch (error) { if (!(error instanceof SyntaxError)) throw error; fail('evidence_json', 'Unreadable retained record: ' + file.path); }
  }
  const document = parsed(documentFile);
  if (!object(document) || document.id !== documentId || typeof document.title !== 'string' || !revision(document.rev) || !content(document.content)) fail('evidence_document', 'Invalid retained document identity or shape');
  if (document.revisions !== undefined && (!Array.isArray(document.revisions) || document.revisions.some(entry => !object(entry) || !revision(entry.rev) || !content(entry.content)))) fail('evidence_history', 'Invalid retained revision history');
  if (document.proposals !== undefined && (!Array.isArray(document.proposals) || document.proposals.some(entry => !object(entry)))) fail('evidence_proposals', 'Invalid retained proposal collection');
  // The filename is the real agent-edits contract. Never look up a bp: receipt or
  // use a destination slug/revision as a substitute for this original identity.
  const receiptPath = 'agent-edits/' + crypto.createHash('sha256').update(documentId).digest('hex') + '.json';
  const receiptFile = backup.files.find(file => file.path === receiptPath) || null;
  const latestAgentEdit = receiptFile ? parsed(receiptFile) : null;
  if (receiptFile && (!object(latestAgentEdit) || latestAgentEdit.documentId !== documentId || typeof latestAgentEdit.id !== 'string' || !revision(latestAgentEdit.beforeRev) || !revision(latestAgentEdit.afterRev) || !object(latestAgentEdit.before) || !content(latestAgentEdit.before.content) || (latestAgentEdit.undone !== undefined && typeof latestAgentEdit.undone !== 'boolean'))) fail('evidence_receipt', 'Receipt does not describe this retained local document');
  // These records remain data, including unsupported historical blocks and old
  // proposal modes. Their revisions are never converted into executable actions.
  const result = { version: 1, kind: 'retained-legacy-evidence', profileId: options.profileId,
    sourceHash: options.expectedSourceHash, manifestHash: backup.manifestHash,
    revisionDomain: 'legacy', readOnly: true, actions: [],
    documentFile, receiptFile, document, latestAgentEdit };
  backup.store.filePath('manifest.json'); // Recheck the originally captured root identity.
  if (validateBackup(options).manifestHash !== backup.manifestHash) fail('evidence_changed', 'Backup commitment changed while reading');
  return { ...result, evidenceHash: hash(result) };
}

module.exports = { readRetainedDocument };
