// The one sentence a record carries, in its top-level "redaction" field, when it pins the bytes of an evidence file
// in which a user folder, name or email was replaced or covered. The sentence depends on the kind of file.
export const REDACTION_FIELD = 'redaction';
export const REDACTION_NOTE = {
  file: 'Redacted copy: a user folder, name or email is replaced by <user>, <name> or <email> in text, or covered by a box in a picture; nothing else changed.',
  video: 'Redacted copy: a user folder, name or email is covered by a box; re-encoded losslessly (VP9), so every pixel outside the boxes is unchanged.',
};
export const noteKind = file => (/\.(webm|mp4|mov|mkv)$/i.test(file) ? 'video' : 'file');

if (import.meta.url === `file://${process.argv[1]}`) process.stdout.write(JSON.stringify({ field: REDACTION_FIELD, note: REDACTION_NOTE }));
