# Prepared Windows rename reliability audit

This preparatory audit predates [C023 implementation](../../../cycles/C023-windows-atomic-write.md). The original observations below describe the unmodified single-rename writers; current implementation status and retry tests are recorded in the cycle.

- [Initial controlled reader](initial-controlled.json): actual bound-profile workspace and goal journal both reject rename with EPERM while a .NET reader denies delete; exact authority and prepared temp survive.
- [Expanded actual-writer proof](controlled-and-node.json): ordinary Node read handle also causes EPERM; old bytes and in-memory journal stay authoritative. Explicit new writes succeed after closing each reader. No failed temp is adopted or deleted.
- [Minimal core-fs proof](minimal-node.json): Node22.13.1/libuv1.49.2 on Windows10.0.26200, ten attempts to replace an open-read target all fail EPERM; target and candidate bytes remain intact. Closing the read handle permits the exact same candidate rename immediately.

This proves a reproducible read-handle contention mechanism. It does not identify which handle caused natural C020 RXyDwf EPERM, nor establish the exact error behind C015's retained unacknowledged goal-journal commit. No production retry, automatic temp promotion, directory fsync or power-loss claim. Disposable helper readers have exited; no UI or Barkpark runtime was used.
