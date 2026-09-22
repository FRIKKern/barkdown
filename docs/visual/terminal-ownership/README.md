# Terminal ownership evidence

C018 is active. Actual Electron A/B switching, descendant shutdown and abrupt main restart capture is pending; backend native process tests alone are not UI proof. [Cycle and limits](../../cycles/C018-terminal-ownership.md).

The original 87b965e pipe-shell baseline left three descendants alive after stopping its immediate shell (fixture CohCRA); the audit cleaned and verified those exact PIDs stopped. Replacement native tests prove scoped A/B drain and abrupt host cleanup, explicit restart identity, uncertain-launch refusal and no automatic replay.
