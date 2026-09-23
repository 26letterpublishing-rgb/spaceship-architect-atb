# Local mouse playtest — September 21, 2026

Completed Jason's requested follow-up mouse test of the recent SIC, triangle-hull, and character movement work. Local only; no commit, push, deployment, or personal campaign changes.

## Defects fixed

- Power Engines 1–6 and the Nutritional Supplement had printed damage thresholds but lacked them in the shared rules catalog. This excluded them from Vulnerability Fortification host choices and let component damage use the missing-value fallback. The shared catalog now uses the existing card values: Power Engines 10/17/25/33/43/53; Nutritional Supplement 10. A regression verifies actual Engine damage before and after fortification.
- Fortification's Purchase Duplicate label displayed the old card's purchase price, even though the actual price depends on the selected host. It now says “choose host”; the dialog shows the correct price before purchase. Pricing and deductions remain unchanged.
- Interior crew figures were drawn over exterior Hull plating in the PC details view. The shared Hull presentation now hides those figures, just as it hides other interior crew markers. Starting Move temporarily restores the interior and existing colored humanoid; Cancel or movement completion restores the saved Hull view.

## Mouse verification

Used the GM and PC views of disposable campaign “September 21 Verification” on an isolated server at port 8791.

- Opened the nested GM ship editor and bought a second Life Support fortification for 1,000 credits; confirmation deducted that amount.
- Confirmed the second Power Core Damper is rejected with its explanatory message.
- Removed Life Support: both attached fortifications entered Storage. Undo restored all three together.
- After the fix and test-server restart, Power Engine 4 appeared in the host list. Purchased and confirmed its 500-credit fortification. The card displayed threshold 34, also verified in the independently loaded PC view.
- Clicked the existing triangular hull: confirmation offered a 300-credit refund. Undo restored it. Attempting to remove its normal supporting square was blocked with “Remove the supported triangle first.”
- Removed and reinstalled the Gym using the grid. It occupied exactly nine squares, and confirmation completed for zero credits.
- Opened and cancelled the print options dialog. No physical print or PDF export was performed in this pass.
- Turned on Hull, clicked Move, moved the mouse to preview a route, clicked to select it, moved the pointer elsewhere, and verified the selected line remained fixed. Confirmed the move and watched the amber humanoid walk the selected route.
- Verified Hull preference restoration after completion and Cancel. Rechecked the figure visibility fix with actual Move/Cancel clicks. Restored the initial Hull-off preference afterward.
- Browser error logs were empty in both test tabs.

## Automated verification and cleanup

464 tests passed, zero failures. Log: test-artifacts/september21-mouse-regression.txt. JavaScript syntax checks passed for the modified scripts. Targeted diff whitespace check passed with CRLF-aware whitespace settings; the broad working tree still contains pre-existing line-ending warnings.

Both test tabs were closed. The isolated server was no longer listening after the interruption/resume; confirmed port 8791 was clear. Existing Spaceship Architect and Vector services were not stopped or reconfigured. Both personal campaign files retained their prior sizes and modification timestamps.

No new game rules were introduced. Threshold values were taken from the existing SIC card definitions. The wording and Hull-visibility correction were routine decisions made without further questions. This was focused coverage of recent changes, not a repeat of every historical combat/console workflow.

Restart the normal Spaceship Architect server on port 8790 and refresh its pages to load the updated shared rules.
