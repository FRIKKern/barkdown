# Verified shutdown settlement

C097 repair of the reproduced stale-receipt and unsafe-quit failures. Paper verifies the current projection through retention and marker acknowledgement. The window keeps its input freeze until main releases the exact request; multiple notes and prior preparation freezes are covered. Main refuses unsafe, malformed and missing replies, including remote-only sessions, and ordinary window close uses the same shutdown path. Relaunch is armed only after successful settlement. Existing preparation drafts are reused only after exact owned readback.

54 Paper-host cases and four handshake tests pass in quit-contract-02 (6.417s and0.175s). Earlier failing reproductions remain in quit-dirty-01/02/03. Native refusal/retry/restart, adjacent preparation checks, visual review and root verification are pending. No stage acceptance is claimed.
