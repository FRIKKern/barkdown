# Rejected live status capture — 23:02 UTC

The isolated live capture completed against clean Barkdown `508a261` and clean Barkpark `bf23f773`, used a real Codex turn, and stopped its owned runtime cleanly. Both independent reviewers accepted provenance, history, aliases, all five stills, and the non-Quick-Open motion frames.

The capture is rejected because Quick Open frames 32–35 still show broad concentric shadow bands. Waiting for the real entrance transition proved that timing was not the cause: `gifenc` has no dithering and cannot represent the modal gradient cleanly within a 256-colour frame. The next source uses ImageMagick's Floyd–Steinberg GIF conversion over the lossless captured PNG frames. This folder preserves the rejected assets and manifest; it is not current or approved evidence.
