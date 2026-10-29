# Known bugs

## MelVU

* [FIXED] Everything requiring live source state is broken (preview, etc.) - preview/undo/lang wiring repaired.
* [FIXED] HTML not WYSIWYG like NVU - raw HTML passthrough restored.

## MelLite

* [FIXED] Image preview doesn't scale to viewport - canvas now scales to container.
* [FIXED] Preview doesn't preview changes before application - live preview + Apply added.

## MelFilm

* [FIXED] Tween translate math (position offsets were missing comp width/height scale).
* [FIXED] Crossfade offset (was using beat count instead of clip duration).
* Still open: no image/sound importing support, no transitions.

## General

* Doesn't look like the industry standards
	* (Should be: NVU for MelVU, FL Studio for MelSound, MelLite/MelFilm/etc Adobe)
* Very few features
	* There's a reason I say "don't stop until 100% done" and "make it feature complete"
* These apps are clearly AI slop except for the original few (MelDraw, MelCromedia, MelCAD, MelOffice)
	* Even with the ones that don't look like absolute shit, some of them - such as MelDraw and MelCromedia, *functionally* suck. Some tools are in a sort of a half-vegitable state - as in, only like 25-75% functions of leading brand - and that's being generous.
	* Some functions don't work in the slightest - such as some key shortcuts, icons, and functionality being outright missing.
		* One such example being something absolutely dumb as a monkey throwing it's shit at a fan in front of it is that you can't select paint/drawn things in MelCromedia.
		* Another being that some functions in MelDraw is absolute apeshit. The select tool cannot be followed by move, free-transform is broken, etc.
* [FIXED] Sometimes, even simple shit like saving or loading files is absolutely broken to the point of being non-functional - MelSound FLP patterns now persist/restore (saveFls/openFls wired to pattern events).

## Conclusion

Fix this shit while I go sleep. You'll have several hours to fix this crap - plenty of time for testing, bug fixiing, design fixing, feature adding, and validation.

Truly unacceptable output. With some project it's "so close but no cigar", others are like "what the fuck is this absolute apeshit!?!"

Fix this shit now.

--Sam
