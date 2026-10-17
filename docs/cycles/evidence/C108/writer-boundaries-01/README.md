# Windows media-writer boundaries

The original-blob guard does not yet establish a complete physical-writer fence.
This review narrows the remaining work with exact environment, source and native
evidence. No source, app, dependency, runtime pin or capture input changed.

[Environment construction](environment.json) evaluates the actual JavaScript
initializers with synthetic inputs: packaged Windows excludes inherited S3
settings; source-checkout mode retains them. Both set their owned media root and
admission identity. This is construction evidence, not a backend boot.

[Literal-call inventory](syntax-inventory.json) parses 37 media-owner files with
Elixir1.19.5/OTP28 and records 49 selected calls without counting comments. It
does not expand macros, resolve every alias or enumerate all dynamic/native
effects. The table below adds manually traced boundaries; it is not a full census.

| Boundary | Observed coverage | Remaining proof |
|---|---|---|
| Local original bytes/copy/delete | C109 LocalWrite takes the reservation lock and physical-effect admission. Its separate Windows/CI proof is published. | Independent review, integration and runtime adoption. |
| S3 original cache | ensure_local/download/warm_cache/delete have local write, rename, copy or removal effects. Packaged child construction excludes inherited S3 configuration; source mode differs. | Actual supported managed configuration and caller/race coverage; no S3 account was contacted. |
| Rendition generation | ensure/transform use Door.admit before generation; render/rename/reap can mutate cache files. | Complete physical-effect settlement, native child lifetime and interruption. |
| Rendition deletion | delete_for_file directly removes its cache directory. The native probe below observes that helper alone mutating during a held seal. | Checkout/HTTP/background caller and race coverage; do not infer every caller bypasses admission. |
| Native image output | Magick uses System.cmd in a linked task; Vix uses Image.write. | Actual child/owner death and all supported-platform settlement. No renderer was run here. |
| Processing/admin artifacts | Processing renders a temporary LQIP and removes it; dataset backfill writes a journal. | Classify actual roots and invocation scope before including them in a sealed-root claim. |

The [actual Windows probe](native-result.json) loads the retained compiled C109
backend modules, holds its real coordinator, and confirms ordinary Door.admit
refuses. A direct Renditions.delete_for_file call then removes only its freshly
allocated synthetic rendition directory while status remains held, zero writers
and zero pending. Original synthetic bytes and a separate backup stay exact.
The body takes 48ms; its VM takes 1,173ms. All owned VMs are closed. No database,
HTTP caller, S3 request, renderer, real media or installer was used.

This proves a direct-helper coverage boundary, not an end-to-end exploit or
complete caller failure. The HTTP preflight and inner Content writer have their
own admission checks; contiguous caller/race coverage still needs proof. The
separate [follow-up](followup.json), task-0571ac0327eced87, remains open with all
criteria unmet. C109 PR23205 stays frozen at fce63; no repair was smuggled into it.

The first preflight refused a documentation-inclusive production comparison
before allocation. Two direct VM boot attempts then failed before the fixture:
missing clean boot path, then duplicate root flags. Their producers, terminal
receipts and exact captured log bytes remain here; crash dumps stay private.
The successful command uses the release's clean boot file and RELEASE_LIB,
without loading runtime configuration or starting the application/database.
Readable logs normalize line endings/trailing whitespace; base64 retains their
exact captured bytes. Original journals and files remain private and recoverable.

Native custody, full cleanup/reconciliation, source integration and A2/A3/A5
acceptance remain separate. The migration effort estimate is unchanged; this
review exposes remaining boundaries rather than claiming shipped capability.
