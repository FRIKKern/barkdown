# Rejected live status capture

The isolated capture completed against clean Barkdown `1d14faf` and Barkpark `bf23f773`, used a real Codex turn, and stopped its private runtime cleanly. Five full stills passed review.

This capture was rejected before publication for two evidence defects:

- the archive step named the previous manifest with the new capture-start time instead of its own `capturedAt` value;
- GIF frames 32–35 accumulated translucent Quick Open shadow outlines because an RGBA palette was used for opaque full-frame screenshots.

The original content-hashed media, current manifest and misnamed prior manifest are retained here for diagnosis. They are not current README evidence and must not be treated as an approval. The capture script now archives both prior and current manifests by their own timestamps and encodes the status GIF with an opaque RGB palette.
