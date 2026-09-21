// Ten maximum-size20MiB attachments can expand to~267MiB in API history. Keep
// the same local descriptor representation for new images and allow512MiB per
// history/event envelope. Oversize input fails explicitly before dispatch.
module.exports = { MAX_MESSAGE_CHARS: 512 * 1024 * 1024 };
