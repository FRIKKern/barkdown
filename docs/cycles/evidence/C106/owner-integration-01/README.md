# Owner-authorized Windows checkpoint integration

The owner authorized merging Barkdown PR80, then PR79 after integration checks. PR80 is merged346d1389. This refresh combines the installer engineering scripts with the current custody tools and evidence, retaining every prior check exactly once. C108 remains the current cycle; the C106 cycle is archived as an engineering checkpoint.

[Conflict and check inventory](preflight.json). [Full combined verification](result.json) passes127741ms on the exact staged tree; [review](review.json) retains both test chains and unchanged inputs. Refreshed hosted checks and merge remain pending. App/locks/runtime pin/capture inputs and installer payload producers retain their tested bytes; the installer is not executed. No production deployment, private guard adoption, G2/paired-source merge or A2/A3/A5 acceptance.
