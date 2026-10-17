# A killed upload leaves warm-cache bytes outside ordinary admission

Two actual `Media.upload` observations pass on Windows: 3,568ms of fixture work,
5,661ms for its VM and55,400ms including the owned backend/PostgreSQL lifecycle.

After real loopback PUT and HEAD readback, S3 copies the upload source into its
local warm cache. A private barrier pauses immediately after that copy, before
`Media.upload` inserts the media row. Killing only that upload worker preserves
the exact cache bytes, but ordinary admission returns to open/zero and its
coordinator restarts open/zero. No media row was inserted. The copied file's
uncertainty is no longer represented in that journal.

The second private variant wraps both cache directory creation and copy in the
unchanged `LocalWrite`. At the same barrier, the actual media-table lock conflicts
and admission identifies the physical effect. Killing the worker still preserves
the copied bytes, while pending1/`recovery_required` survives coordinator restart.
The database lock releases; its release does not clear physical uncertainty.

The [fixture](fixture.exs) invokes unchanged compiled `Media.upload/3` with real
`Plug.Upload` files and the fresh database's actual default project/dataset.
The full owned backend seeds PostgreSQL; a separate native VM owns this caller,
Repo and coordinator. **This is not an HTTP-upload or completed-upload proof.**
Only [test seams and the private wrapper](derivation.json) differ in S3; the
original source, [license](SOURCE-LICENSE.txt) and both variants are retained.
The whole media-row snapshot remains unchanged in both cases.

Native observations before interruption and [after shutdown](post-shutdown-observations.json)
confirm both exact cache identities and hashes. Both synthetic upload originals
remain exact. [Author review](review.json) checks all6,193 release files, five
selected original BEAMs, eight source-owner hashes and205 entry originals.
Two real PUTs/two HEADs occur; all owned services are stopped. Files, fake-object
receipts, database and journals remain retained. No recovery or purge was invoked.

This private candidate does not repair production source or authorize adoption.
Successful/failed warm-cache contracts and its best-effort policy still need
review, as do actual cache-delete/checkout/rendition callers, native children
and full identity reconciliation. Source/app/pin/installer freezes and independent
review/owner integration gates remain. No real library/account, public S3 deletion,
cleanup authority, merge/deployment or A2/A3/A5 acceptance is established.
Task-0571ac0327eced87 remains0/4.
