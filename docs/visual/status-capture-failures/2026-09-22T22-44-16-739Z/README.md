# Rejected live status recapture

The manifest-history correction worked: prior and current manifests were archived under their own `capturedAt` timestamps, and the isolated runtime stopped cleanly. Five stills and real Codex/Paper provenance passed review.

The motion artifact was rejected because GIF frames 32–35 showed broad false halo bands around Quick Open. Switching from RGBA to a single opaque RGB palette removed transparency, but the palette was still derived from the first Paper-only frame and lacked the later modal-shadow gradient. Quantization mapped that gradient into conspicuous bands.

The original hashed media and both archived manifests are retained here. They are diagnostic evidence, not current README evidence. The encoder now uses a local opaque RGB palette for each full frame so newly appearing modal colours are represented directly.
