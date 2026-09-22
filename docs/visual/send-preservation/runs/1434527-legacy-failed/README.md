# Preserved failed setup

The original1434527 legacy fixture swallowed Settings validation failure for a nonexistent source. Local mode/key were never saved, so the send legitimately completed offline. The timeout is a fixture setup failure, not proof of a contextBridge failure. Corrected fixture9cc5f8a asserts saved preconditions and passed. Normal cleanup stopped=true; original manifest and video retained.
