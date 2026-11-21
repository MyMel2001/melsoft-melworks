# Known bugs

## MelOffice

* XL: LOOKUP functions return an #ERROR — FIXED (commit fe2859e; browser evaluator `evaluateFormulaBrowser` in `mel-office/src/app.js` now handles LOOKUP before falling through to `#ERROR`).
* Slideshows: Extremely large text when opening a slideshow — FIXED (commit d7511cb; `loadCurrentSlide`/`renderSlideShowCurrent` now apply default font sizes, `promptAddSlide`/`newDocument` create slides with `titleSize`/`subtitleSize`, `loadCurrentSlide` normalizes `bg`/`background`).

## Context menu

* MelCromedia: Timeline right-click context menu missing — FIXED (commit 3d2b8b6; implemented `#timeline-context-menu`, `handleTimelineContextMenu`, `handleLayerContextMenu`, dismiss-on-Escape/outside-click/scroll; verified in browser).
