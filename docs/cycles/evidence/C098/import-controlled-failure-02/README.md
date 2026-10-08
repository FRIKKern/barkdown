# Failed nonempty-stream control

The [original producer](producer.mjs) ran a clearly labelled copy of Windows `where.exe` as a command-failure fixture. It returned failure and the [audit](audit/imports.json) retained the original empty stream. The control assertion then failed because it incorrectly required nonempty output. No success is claimed for this control. Control03 preserves empty stdout/stderr separately with the measured exit2, then proves byte preservation and output reuse refusal. The fault copy is not an actual dumpbin input.
