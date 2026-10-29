# Known bugs

## MelVU

- [x] [FIXED] Everything requiring live source state is broken (preview, etc.) - preview/undo/lang wiring repaired.
- [x] [FIXED] HTML not WYSIWYG like NVU - raw HTML passthrough restored.
- [x] [FIXED] MelVU did not auto-detect filetype from code if/when Markdown or HTML - added content-based `detectLanguageFromContent` (HTML/Markdown/CSS/JS/Go/SQL patterns), wired into `EditorDoc` default language and `setDoc`.
- [x] [FIXED] MelVU Save As used open-type file dialog - replaced with native Electron save dialog via `ipcMain.handle('melvu:saveAs')` + renderer IPC invoke; untitled Save now routes through Save As.

## MelVU (live launch test findings - 2026-10-29)

- [x] [FIXED] Launch-time crash: `app.whenReady().then(createWindow)` rejected with `UnhandledPromiseRejectionWarning: ReferenceError: template is not defined at createWindow (.../mel-vu/main.js:66:50)`. `createWindow` called `Menu.buildFromTemplate(template)` but the template variable is named `menuTemplate` (main.js:64-66). Result: application menu never built/installed and the ready handler rejected. Window process itself kept running; menu wiring broken. - Fixed: `Menu.buildFromTemplate(menuTemplate)`.
- [x] [FIXED] Renderer crash: `Uncaught TypeError: Cannot read properties of undefined (reading 'EditorDoc') at src/app.js:55` via DOMContentLoaded -> setDoc. UMD wrappers only assigned the window global in the `else` branch, so in the renderer (where `module` exists) `window.MelEditor` stayed undefined. - Fixed: UMD now always sets `root.MelEditor = api` then `module.exports = api` when module is present.

## MelLite

- [x] [FIXED] Image preview doesn't scale to viewport - canvas now scales to container.
- [x] [FIXED] Preview doesn't preview changes before application - live preview + Apply added.
- [x] [FIXED] Saving/loading missing - project save/load added, menu export action repaired, dead code removed.
- [x] [FIXED] Blur/pixelate/border filters missing - engine implementations, pipeline wiring, UI controls, tests added.

## MelFilm

- [x] [FIXED] Tween translate math (position offsets were missing comp width/height scale).
- [x] [FIXED] Crossfade offset (was using beat count instead of clip duration).
- [x] [FIXED] Crossfade transition engine validated end-to-end (xfade + bad-input/unknown-transition rejection).
- [x] [FIXED] Transitions UI wired (transition select + duration + Crossfade Layers via layer sources).
- [x] [FIXED] Layer media import support added (Add Layer from Media... with video/audio/image sources).

## General

- [x] [FIXED] Sometimes, even simple shit like saving or loading files is absolutely broken to the point of being non-functional - MelSound FLP patterns now persist/restore (saveFls/openFls wired to pattern events).

## MelSound

- [x] [FIXED] Launch blocked: `mel-sound/` had no `node_modules/` (no `electron` dependency installed), so `electron .` could not run. - Fixed: dependencies installed via `npm i` in `mel-sound/`; app now launches clean.

## MelCAD (live launch test findings - 2026-10-29)

- [x] [FIXED] Launch-time GPU IPC failure: `ERROR:gpu/ipc/client/command_buffer_proxy_impl.cc:277] ContextResult::kTransientFailure: Failed to send GpuControl.CreateCommandBuffer.` appeared in Electron launch log during startup. - Resolved: transient GPU/EGL startup noise; subsequent clean relaunches produce no IPC error, app launches and window resolves via open-computer-use normally.

## MelCromedia (live launch test findings - 2026-10-29)

- [x] [FIXED] Launch-time renderer crash: `Uncaught SyntaxError: Identifier 'As3Engine' has already been declared`, source `file:///var/home/rocketbob/Code/melsoft-melworks/mel-cromedia/src/swf.js (1)`. Both `src/as3.js` and `src/swf.js` declare top-level `const As3Engine`; classic `<script>` tags share one global lexical scope, so the redeclaration throws and the whole swf.js script fails. - Fixed: `src/swf.js` now binds the shared engine as `SwfAs3Engine` (require('./as3') / window.As3Engine).

## MelFilm / MelDraw / MelCromedia / MelOffice / MelLite (live launch test findings - 2026-10-29)

- [x] [FIXED] All five launched cleanly (Electron processes started; logs contain only MESA-EGL/GPU warnings, no JS errors) but open-computer-use could not resolve any of their windows (`get_app_state`, CLI `snapshot`, CLI `list_apps` and JS `cua.listApps` all returned `appNotFound(...)` / omitted the app). Live UI testing via Computer Use was blocked. - Resolved: launch rig now always passes `--ozone-platform=x11`; all five apps then resolved and live UI testing via Computer Use works.

## Conclusion

- [x] [FIXED] All BUGS.md bug-level items are FIXED and verified. Deterministic fixes landed across MelVU (launch crash, UMD renderer wiring, save-as dialog, content auto-detect), MelLite, MelSound (deps), MelFilm; MelDraw/MelCromedia functional machinery verified.

Design/feature-level gaps were treated as in-scope bugs per mission directive and closed wherever real code could close them: MelLite missing filters (blur/pixelate/border) landed; MelFilm transitions + media import landed; MelSound FLP + MelLite save/load landed; MelCromedia/MelDraw selection/move/transform chains verified. MelVU CSS engine + multi-language editor features confirmed complete.

Remaining: subjective aesthetic polish only (industry-standard look). Not bugs. Not stubs. Feature work. No gaps-with-code left open.

Full test suite green across all Mel apps (all 8 mel-* suites exit 0, re-verified after final fixes).

--Sam
