# Local map, crew, hacking and oxygen pass — September 21, 2026

Implemented locally. No commit, push, deployment or personal campaign edits.

## Changes

- GM ship statistics now use compact labels and values that stay inside their columns.
- Ship glow settings use a small gear on maps. The color dialog has explicit readable button colors. Map Glow Color is also at the top of ship creation; editor saves update both saved and deployed copies.
- Navigation Auto Zoom and Sensors Fit Contacts share fitting based on visible contact positions. Navigation controls occupy their own space below the map. The grid fills the visible canvas, including wide layouts and enlarged maps. Map labels use short ship names, retain full titles in tooltips, and stay within the canvas.
- During combat, the PC Starships list and crew summaries use deployed ships. Permanent multiple-ship memberships remain saved. The server provides authorized deployment metadata, including when a PC has not detected an enemy. Combat ship columns put PC ships before GM ships.
- A captured SIC offers Turn Off SIC. Shutdown does not inflict damage or impairment. The defender must physically enter that SIC to restart it through the existing maintenance control. Lost-response retries retain their original request and remain accessible after shutdown revokes the intrusion.
- Low-resolution room O2 labels sit at the bottom center of the whole room and move upward around labels/stations. Placement accounts for scaled/zoomed floorplans. Corridor labels sit on an actual bottom-center corridor cell.
- Live crew updates preserve the humanoid figure and walking animation class. Figure colors continue to follow the character's ATB color.
- Oxygen resistance starts at difficulty 6, then 10, 14, 18, etc. The existing 16-active-second repeat interval, 5 HP failure consequence, normal dice animation, pause behavior and atmospheric threshold remain unchanged. Existing saved escalation is shifted down by 8 once, preserving timers and pending roll IDs.

## Scan investigation and decisions

Unknown Object markers are approximate locations, not exact starship positions. A hex scan searches the chosen hex and its adjacent hexes against real locations. It can therefore resolve no ship even when an approximate marker appears on the selected hex. A nearby high-masking ship does not automatically make every other ship fail its check.

The supplied screenshots cannot establish the exact historic roll, position or knowledge state. Source review found the default Red Horizon masking value is 13 and the Ghost Surveyor preset is -5, with Sensors 18. Detection mechanics were preserved. Empty-result text now says that no contacts were resolved in the scanned area and explains approximate unknown markers.

Fit Contacts deliberately fits contact centers rather than the full uncertainty circle or planned movement route; those overlays no longer force excessive zoom-out. Full SIC showcase suffixes remain in ship titles/tooltips, while map labels show the short ship name.

Hacked shutdown reuses the existing physical maintenance restart and boot timing rather than adding a separate repair rule. Room O2 nudges stop inside the room if a very small room has no completely empty vertical space.

## Verification

- Full automated suite: 502 passed before the last UI refinements and added shield-specific regression.
- Final focused oxygen/hacking/sensor/color persistence checks: 33 passed, including shield shutdown preserving stored shield HP while removing protection, receipt-safe retry, local-only restart, oxygen migration and creator color saves.
- Final map/atmosphere checks: 22 passed.
- All 13 edited JavaScript files passed syntax checks. Whitespace check passed with CRLF-aware configuration.
- Mouse/browser playtest used disposable Explore Features rooms on isolated port 8791. Verified compact GM statistics, enlarged grid, compact glow control and readable dialog, PC-only deployed ship list with Nova linked to two ships, a completed walking move and ATB-matching figure, station access, navigation Auto Zoom, Sensors Fit Contacts, and creator color placement.
- Hacking shutdown and failed-response behavior were verified through automated checks/source review; a full manual password-solving sequence was not repeated in this pass. The screenshots' exact historical scan cannot be replayed from screenshots alone.
- Both personal campaign JSON files retain their original SHA-256 hashes. Temporary browser tab/server are cleaned up after verification. Vector servers were not touched.

## Use

Restart Spaceship Architect with its normal local launcher (port 8790), then refresh the GM and PC pages to load server rules and UI updates.
