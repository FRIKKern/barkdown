# Retained original C023 gate logs

These four logs are byte-for-byte copies of the ignored local files referenced by [the original validation record](../../../../cycles/C023-validation-plan.json). [Manifest](manifest.json) maps each original path and recorded SHA-256 to its retained path, byte count and independently checked SHA-256. The validation record itself is unchanged; its hash is recorded in the mapping.

Credential review found no credential values. Token/private-key/authorization/assignment scans and comparisons to configured secret values ran without printing secret values. Opaque-token contexts were inspected with values withheld; they identified disposable profile IDs and local test/module paths. All four logs are retained, with no omissions, redactions, encoding conversion or line-ending normalization. These are the original source-specific runs, not fresh execution or combined-source approval.

The scoped `.gitattributes` disables Git text conversion for these archival logs. Staged blob hashes were checked against the original recorded hashes.
