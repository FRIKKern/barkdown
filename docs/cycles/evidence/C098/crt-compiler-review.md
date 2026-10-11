# Windows compiler record association

Retained records now associate reported compiler versions with four exact carried files. [Association02](crt-compiler-02/result.json) passes in 629 ms; [outer receipt](crt-compiler-run-02/result.json) is 752 ms. This establishes scoped provenance, not a complete runtime minimum or ABI acceptance.

| Exact current artifact | Retained compiler report | Source of association |
|---|---|---|
| Argon2 NIF | MSVC 19.50.35721 | Later reader release build log and matching original inventory/output |
| ExPTY NIF | MSVC 19.50.35721 | Exact native Release configure/flags/output receipt |
| ExPTY console helper | MSVC 19.50.35721 | Exact native Release configure/flags/output receipt |
| PostgreSQL main executable | msvc-19.44.35226 | Original relocated startup self-report and matching original manifest/output |

All four match current source runtime, actual packaged files and the retained PE scan. Three locally compiled artifacts retain dynamic Release /MD records; libuv's static build also reports MSVC 19.50.35721. The PostgreSQL record applies to its main executable, not every extension. Of the 153 binaries importing the three ordinary VC modules, 149 still lack an exact compiler record in this scoped association. No vendor-wide maximum is inferred from PE linker fields or a shared directory.

The [first association](crt-compiler-01/result.json) correctly refused the wrong Argon2 build in 191 ms ([outer 265 ms](crt-compiler-run-01/result.json)). The original 07:02 release produced SHA256 48752b32…; the carried later reader release produces 42529fd8…. The later 11:11 reader build, retained log and original inventory match the carried artifact. The corrected probe changes the provenance source and retains the exact hash assertion; original failure data is preserved. No artifact was rebuilt or changed to obtain a match.

[Read-only native SDK metadata](crt-compiler-02/native/result.json) takes 437 ms. Current cl.exe has file version 19.50.35721.0/product 14.50.35721.0; link.exe is 14.50.35721.0. Their toolset folder/default is 14.50.35717. The current CRT header defaults are 14.50.35717.0, and the separate redist directory/default is 14.50.35710. The three actual x64 SDK CRT DLLs are 14.50.35719.0 and byte-identical to the [inspected signed candidate](crt-payload-review.md). All five metadata signature observations are Valid Microsoft signatures. These fields are recorded separately. Current header defaults do not prove historical compiled macros or absence of overrides, and compiler/CRT servicing suffixes are not an established runtime-minimum comparison.

Microsoft's [compatibility guidance](https://learn.microsoft.com/en-us/cpp/porting/binary-compat-2015-2017?view=msvc-170) requires runtime selection to account for the newest component build tools. The current evidence neither accepts nor rejects the candidate's full minimum-version compatibility. [Static coverage](crt-symbol-review.md) accounts for all 1553 actual named imports, while ABI, dynamic loading, Windows loader/API-set/UCRT resolution and prerequisite deployment remain separate.

Original logs/manifests/header/default files, source hashes, metadata reader/producer and native streams are retained. SDK/compiler/linker/candidate code was not invoked; only version/signature metadata was read. No installer action, installed-runtime change, candidate DLL copied into the carried payload, real profile or sibling source change. Original executable inputs remain in private caches/SDK. Full notices, clean install/update/rollback/uninstall and A2/A3/A5 remain open. PR76 engineering merge approval is still pending.

[Fresh applicability](crt-compiler-applicability-01/review.json) retains all 536 app inputs,6067 runtime files in both source/package, EXE/ASAR, eight audit inputs and Windows visual approval; [outer receipt](crt-compiler-applicability-run-01/result.json) passes 9.522 s. No fresh Desktop/native journey or image restamp is claimed.

Closeout: [root verification](crt-compiler-verify-01/result.json) passes 52.293 s; [indexed byte review](crt-compiler-indexed-bytes-01/result.json) preserves 57 raw files/4354568 bytes/eight unchanged audit inputs. Repository/sibling inventory is unchanged. [Hosted16](hosted-driver-16/review.json) refuses both 16f jobs before steps by billing; no retry. Roadmap/effort reviewed unchanged because this is provenance preparation, not delivered installation.
