// The "redaction" field a record carries when it pins the bytes of an evidence file in which a user folder, name or
// email was replaced or covered. The field is an array of the fixed sentences for the kinds of file the object pins,
// in REDACTION_ORDER, each at most once. It sits on the record's top-level object, or on each item of a top-level
// array that pins such a file. The record sentence stands alone: it is the field of a visual-retain.mjs redaction
// record for records whose only change is their pins of redacted files and this field, which --check proves.
export const REDACTION_FIELD = 'redaction';
export const REDACTION_NOTE = {
  file: 'Redacted copy: a user folder, name or email is replaced by <user>, <name> or <email> in text, or covered by a box in a picture; nothing else changed.',
  video: 'Redacted copy: a user folder, name or email is covered by a box; re-encoded losslessly (VP9), so every pixel outside the boxes is unchanged.',
  record: 'Record of redacted copies: only the pins of the redacted files and this field changed.',
};
export const REDACTION_ORDER = ['file', 'video'];
export const noteKind = file => (/\.(webm|mp4|mov|mkv)$/i.test(file) ? 'video' : 'file');
export const redactionValue = kinds => REDACTION_ORDER.filter(k => kinds.has(k)).map(k => REDACTION_NOTE[k]);

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(JSON.stringify({ field: REDACTION_FIELD, note: REDACTION_NOTE, order: REDACTION_ORDER }));
}
