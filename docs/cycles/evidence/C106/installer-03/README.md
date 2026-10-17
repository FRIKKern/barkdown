# Guarded actual NSIS rebuild

Implementation b74ab881 builds an actual unsigned Windows x64 installer in136,525ms. [Build](result.json) and [extracted payload review](payload-review.json) bind its SHA-256 5147ae99911f394fa7be0dbc3314e43c1bb5ae340d2f5ad951a446a764e00bb4, 199424591 bytes, all6324 application files and6067 runtime files to the producer output and unchanged original runtime. Actual 7-Zip archive tests/extraction, static packaged resources and external PowerShell signature/metadata probes pass: Barkdown0.6.0.0, application/installer NotSigned.

The input guard passes before and after assembly. Original output02/data remain retained. Application code, locks, runtime/pin and capture inputs are unchanged, so previous reviewed application visuals remain applicable; this proof concerns actual new package bytes. No installer execution, clean-machine lifecycle, public binary/feed, prerequisite/notices closure or A5 acceptance.
