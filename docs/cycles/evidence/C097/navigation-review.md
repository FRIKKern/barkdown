# Coordinator navigation checkpoint

Hosted Windows Desktop run37585676008 failed at026e9866 after19m29s: the crash/relaunch journey timed out waiting30s for the Goals view after palette navigation. The ordinary native journey had passed. [Metadata](hosted-desktop-07.json), [raw log](hosted-desktop-07.log) and downloaded artifacts are retained. Prior full hosted success at2712dff5 does not validate this later head.

The original crash journey passes locally in30.088s ([receipt](coordinator-navigation-before-01/result.json)), so the hosted cause remains unconfirmed. A controlled blur between input fill and window Enter fails the original helper in14.162s ([receipt](coordinator-focus-before-01/result.json)); its diagnostic image shows the selected Goals option with focus on the document body.

Implementation1f749cb9 waits for the selected Goals option, addresses Enter to the palette input and asserts the resulting Goals view. Failures retain active-element, palette, dialog and profile state plus a screenshot. It adds no retry or state-repair shortcut and preserves every coordinator outcome/recovery assertion. Three main-module comments now distinguish matching recovery counts from proof of reconciled effects; their behavior is unchanged.

[After checks](coordinator-navigation-after-01/result.json) pass: controlled focus loss29.291s, ordinary native coordinator24.315s and crash/relaunch29.173s. All20 [remaining Desktop steps](navigation-desktop-tail-01/result.json) pass. These are resumed segments, not a new uninterrupted full-suite result. [Byte provenance](navigation-provenance.json) binds the tested uncommitted bytes to the implementation. Local deterministic provider fixtures do not establish real-provider success.

[Visual review](review-navigation.json) covers all17 native stills, ten focus-after stills and the two hosted pre-failure stills. Interrupted and narrow native views and the original focus failure were also inspected full-size. Light native media deliberately preserves the failed journey's theme. Other downloaded hosted images remain diagnostic artifacts with no new approval claim.

Fresh [capture09](capture-09/result.json) at a19a1b76 passes: Paper102.007s, standard30.312s, comparison8.204s. All44 standard stills/differences and44 decoded motion frames, five Paper stills and37 decoded Paper motion frames were inspected. Only temporary Settings path text differs; geometry is unchanged. Capture08 refused dirty tracked planning files before runtime startup; that failure is retained. Existing retention was applied through recoverable moves ([receipt](retention-07.json)).

Root verification and hosted confirmation are recorded in the active handoff. No merge, deployment, real-library change or new migration acceptance is claimed.
