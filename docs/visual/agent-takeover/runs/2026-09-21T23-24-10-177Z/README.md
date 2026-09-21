# E002 server preservation passed; motion review requires correction

Source: Barkdown `afc9c79`, Barkpark `bb3bd299d`, both clean. The manifest records the private build fingerprint and exact fetched server bundle. All eight live behavior cases passed. Runtime `7XtbS6` stopped normally.

**Not visually approved.** Agent inspection of the continuous recording and its 60-frame normal-motion excerpt found an approximately 44px document shift after presentation, when the Undo receipt row appeared. The person’s data and selection survived, but the layout movement conflicts with the intended natural handoff. Preserve this run as evidence; recapture after keeping receipt geometry stable.

The [full video](agent-takeover.webm) is a continuous recording of real Electron actions, including real Chromium IME. It uses the production revision-checked agent adapter, not a model turn. The [result](result.json) records the first keyboard takeover’s actual visible and server blocks. Intermediate stills include selection, writing, narrow reduced motion and offscreen reading position.
