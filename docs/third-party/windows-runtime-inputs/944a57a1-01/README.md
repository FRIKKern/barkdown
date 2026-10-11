# Windows runtime notice preparation

[Original inputs and immutable release references](provenance/result.json) and the [offline audit](audit/audit.json) cover 80 carried applications, 6067 payload files, 160 native binaries and91 retained notice texts. This is incomplete preparation. Existing Mac notices and all earlier evidence remain unchanged.

Nine package directories omitted standalone license files. Exact release commits supply ecto/ecto_sql LICENSE texts and seven original README declarations; full referenced Apache terms are retained separately, without replacing copyrights. Erlang/OTP28.5 and Elixir1.20.1 original texts plus 17 OTP embedded/SPDX inputs are preserved. Copying a text does not establish its applicability to every binary.

[Measured byte/PE evidence](../../../cycles/evidence/C098/notice-audit-01/language-provenance.json) finds all retained chunks in 863 stripped language BEAMs identical to installed originals; 27 OTP native files and three ExPTY/Argon2 binaries match their build inputs. Whole BEAM and release-generated .app files differ from installed originals. Build-input equality alone does not prove a NIF was compiled from source: the pinned elixir_make adapter can reuse/download an existing artifact.

[Static imports](../../../cycles/evidence/C098/notice-audit-01/pe-imports.json) find debug CRT imports in ERTS beam.debug.smp.dll and both ExPTY binaries. The next producer must retain this old output, exclude unused debug ERTS through a fresh selective copy, and rebuild required ExPTY binaries in Release mode with byte/provenance/import proof. PostgreSQL DLL/version attribution, frontend assets, ordinary VC runtime prerequisites and complete native notices remain open. Do not distribute this as a complete notice set or an installer.
