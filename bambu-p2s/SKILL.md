---
name: bambu-p2s
description: Set up, slice, and send prints in Bambu Studio for a Bambu Lab P2S, including printer and filament profiles, object orientation, supports, brims, time estimates, and AMS mapping. Use for operating Bambu Studio or preparing a P2S print, not general CAD modeling.
---

# Bambu P2S setup

Prepare the requested model in Bambu Studio, verify the sliced result against the user's time and quality constraints, and send it only when printing is authorized. Preserve the user's chosen orientation and prioritize getting a verified print started over speculative optimization when they ask to proceed.

## Inspect before changing

- Bind the running macOS app using `com.bambulab.bambu-studio` if its display name fails to resolve. Confirm the window title identifies the intended project.
- Inspect printer, nozzle diameter and flow variant, plate, project filament, process, object count, dimensions, and existing orientation. A project can already contain split objects; do not split or import duplicates.
- Read the existing slice if available. Record total time, model/support material, and warnings. Compare subsequent slices against that baseline; a remembered time from the user is an approximate baseline.
- Check Objects as well as Global settings for overrides. Expand the plate tree to confirm every intended part is on the intended plate.

## Profiles and settings

Choose a compatible installed process before changing individual settings. Do not assume P1S preset names exist for P2S. In the observed installation, the standard-flow 0.4 mm P2S choices ended at `0.24mm Standard @BBL P2S`; `0.28mm Extra Draft @BBL P2S` was absent. Recheck current availability rather than treating this as a permanent hardware limit.

Installed profile JSON is readable under `/Applications/BambuStudio.app/Contents/Resources/profiles/BBL/`. Use it to inspect available names and inheritance when the UI is unclear. Upstream profiles are in https://github.com/bambulab/BambuStudio/tree/master/resources/profiles/BBL . Do not edit application resources or raise printer limits just to make an unavailable preset work.

- Match the actual printer, nozzle, and plate. A project filament profile is separate from the physical AMS slot mapping in Send print job.
- For a light divider, two walls and low sparse infill may be appropriate; preserve top/bottom shell defaults unless the task calls for changing them. Visible honeycomb holes can be modeled geometry, so reducing infill does not remove those toolpaths.
- A brim is bed adhesion, not support. Select the requested brim type and verify its width is editable and correct. Auto mode can show a disabled width.
- Do not promise a time from layer height alone. Geometry, short paths, overhang speed, supports, and cooling can dominate.

## Native UI behavior learned in use

Use current accessibility indices for exposed fields and screenshots for custom controls. Re-read state after actions. Dialog screenshots can change size and origin; get a fresh screenshot before coordinate clicks.

- Text fields expose parameter names such as `layer_height`, `wall_loops`, `sparse_infill_density`, and `enable_support`. Setting a value followed by Tab committed it in the observed app; verify by returning to the tab.
- Custom dropdowns sometimes only focused on click. Arrow keys changed selections. Inspect the visible result after each step instead of repeatedly clicking an unchanged control or blindly sending many keys.
- Preset changes with unsaved overrides behaved inconsistently. Prefer selecting the base preset first. If a reset is needed, record the task's overrides and preserve unrelated user settings before resetting; then reapply and verify intended changes.
- The displayed preset name does not prove the actual layer height after overrides. Check the field itself.
- `F` enters Lay on Face for a selected object; clicking a highlighted convex-hull face changes orientation. `R` enters Rotate. These are optional operations, not reasons to alter an accepted layout.
- `A` or the Arrange toolbar control can arrange across multiple plates. “Arranging done” does not establish that both parts fit on one plate. Inspect the tree and preview afterward.
- If an undo shortcut produces no change, use Edit → Undo and verify each reverted action. Do not assume a shortcut worked or undo an unknown batch.

## Supports and slice verification

Use supports where the geometry needs them, not as an automatic precaution. Inspect their actual placement and material cost. Automatic tree supports on a perforated upright divider generated support through many honeycomb openings and collided between adjacent halves.

Before sending, verify:

1. All intended parts appear once, with correct scale and orientation, on the selected plate.
2. Layer preview includes the intended base, body, and top. Check bed contact, brim, bridges/overhangs, and any generated supports.
3. The slice has no unresolved toolpath conflicts or out-of-bounds errors. Arrange success and a completed slice alone are insufficient.
4. Total estimated time satisfies the user's current constraint. If it does not, report the actual estimate; do not silently reinterpret a hard limit. A later explicit request to proceed may supersede earlier optimization goals.
5. Report estimated duration as an estimate, not guaranteed completion time or demonstrated print quality.

Observed divider example: upright at 0.24 mm with two walls, 5% infill, and an outer brim sliced at 5h 11m / 69.07 g without supports. Automatic tree supports produced 10h 41m / 186.26 g and a collision warning. These are model-specific observations, not reusable time promises. Flat orientation was tried and rejected by the user; it was restored before printing.

## Send and verify

Open Print plate. Confirm target printer, job thumbnail, total time/material, plate type, and every filament mapping. White PLA was in A3 in the observed session, but inspect current slot color/material rather than hardcoding A3. Keep normal bed leveling and flow calibration unless the user requests otherwise.

When authorized, Send once. Verify the Device page shows the matching job and progresses from upload/download to preparation or printing. Do not retry an ambiguous send without checking current printer state. Distinguish “sent,” “downloading,” “preparing,” and actual layer printing in the report. A successful send does not prove first-layer adhesion or completed part quality.
