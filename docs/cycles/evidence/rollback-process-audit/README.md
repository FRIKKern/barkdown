# Offline rollback and native work preflight audit

Root ran a disposable native-process probe against integration f99a05f. This is an audit finding, not a completed fix or a real-library operation.

A shell-only legacy workspace was adopted and activated. A real Windows-owned worker, child and grandchild then ran with that profile's store. Native verification reported false while active. Offline rollback lacked native-process preflight: it entered rolling-back and reached directory rename. Windows refused with EPERM; all three positively owned processes were alive. No successful authority retirement or content loss was demonstrated.

The probe stopped its owned host, awaited completion, verified the receipt and confirmed all three PIDs absent. See [result](result.json). Retained fixture: bd-rollback-process-audit-mMs7bO. Original and candidate trees remain; no destructive cleanup.

Next bounded work: inspect native attempts and receipts before changing rollback phase or relocating authority. Distinguish conclusively never-dispatched reservations from uncertain launches; refuse corrupt, foreign or unverified records. Reuse trusted native verification and prove running, stopped and crashed trees. Coordinate C018 terminal journals and C014 ordinary-chat attempts. Existing authority leases and cold database checks remain required. A dead app PID or OS rename refusal is not the product's process-shutdown contract.
