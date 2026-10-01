# October 1: ship continuity, rescue and two SICs

This pass completes the authorized rescue/state/sensor work and adds Hull Breach Repair Drone and Analysis Screening. The later #commit instruction authorizes publishing this and the previously completed local passes together. Personal campaign saves, Vector and Gold Standard remain excluded.

## Hull Breach Repair Drone

- Replaced the printed fixed travel delay with physical interior movement at PC Move Speed 7: seven movement-mesh squares per three active seconds. Actual route length determines arrival; closed doors add the existing 0.6-second opening delay. The robot cannot cross walls or teleport across disconnected rooms.
- A small generated robot follows that path on ship maps. Its movement is interpolated separately from the floorplan, without repeatedly compiling the entire ship image.
- Automatically selects the oldest unsealed breach, then proceeds to the next. It does not operate airlocks.
- After arrival, waits 12 active seconds for its first D6 repair attempt. A result of 5 or higher seals the breach. Failed attempts increase to D8, D10, then D12, with 12 active seconds between attempts; D12 remains the ceiling.
- Uses the existing visible GM dice interface, pauses for the roll, and cannot spend Exertion. Travel and repair time follow paused/resumed ATB time.
- A deployed bot keeps working through its bay's power loss or destruction. It cannot be targeted. After the queue empties, it returns to a usable bay or vanishes if the bay is damaged or missing.
- Added distinct generated equipment art, floorplan, robot token and console scene. The console shows its task, repair progress and queue, with normal maintenance controls.
- Autopilot and Handyman provide fresh Explore examples.

## Analysis Screening and sensor snapshots

- Added the host-attached Analysis Screening SIC. Each Systems Analysis checks D6; 1–4 conceals its host. Previously obtained host information remains explicitly last known; otherwise the room is unknown.
- Systems Analysis, followed by Life Scan, followed by another Systems Analysis produces a saved timestamped interior snapshot. Repeating the scan updates that snapshot.
- The read-only viewer includes exact ship statistics, room impairments, oxygen, breaches, doors and detectable crew. Life Scan exclusions still apply. Screened systems do not leak fresh room instrumentation.
- Snapshots do not update continuously. The Sensor Console can reopen the latest snapshot for each target even after it leaves sensor range.
- Added separate generated card art and Peekaboo/Hideaway examples.

## Shared ship state and rescue

- Outside-combat escape pod departure or opening an airlock starts a rescue encounter containing that ship, its current occupants and empty surrounding space. If an active encounter already exists, it is reused.
- Escape-pod passengers are removed from the interior and remain outside after subsequent updates, saves and restart. Confirmation is required before opening an airlock; closing one outside combat does not create a rescue encounter.
- Ship preparation now takes current saved/live ship state: crew locations and station assignments, doors and airlocks, damage and impairments, power, shields, AU, resources, ammunition, cooldowns and ongoing jobs.
- Shared location updates remove stale copies on other ships. Ship edits preserve runtime state while allowing deliberately edited airlock placements.
- Android, Epoc, mechanical and AI characters avoid oxygen checks and vacuum damage. Suction, outward drift and unrelated damage remain applicable.

## Combat continuity and recovery

- GM tab selection is remembered. Returning to Combat opens the existing encounter. Resume cannot silently prepare a default roster.
- PC combat status distinguishes an active encounter even while its clock is paused; another tab receives the existing attention effect when time is running.
- Automatic durable checkpoints and checkpoints before destructive changes support GM encounter recovery. Restoring requires confirming the campaign name and current encounter, preserves a backup of the present state, creates a new encounter identity and starts paused.
- Stale actions from other tabs are rejected. Duplicate preparation requests remain idempotent. Queued writes belonging to a replaced campaign object cannot overwrite its replacement.
- Encounter preparation intentionally saves the new candidate before exposing it; it must not be rejected merely because its new identity differs from the old live encounter.
- Added visible Add, Reposition and Remove Airlock controls for new GM ships and upgrades, including legal blank-edge highlighting and existing Cancel Upgrade rollback.

## Validation and practical limits

- Full automated suite: **806 passed, zero failures**. Coverage includes actual HTTP rescue creation, restart persistence, recovery authorization/confirmation, stale encounter rejection, drone travel positions, GM repair pause and successful sealing.
- Unit coverage exercises route timing, oldest-first order, escalation through D12, bay destruction, breathing immunity, shared state and frozen screened snapshots.
- Syntax checked all 155 root JavaScript files; CRLF-aware whitespace check passed.
- Disposable local browser checks covered GM ship creation and airlock repositioning, the new equipment card and full-size console preview, leaving/reopening the console, explicit encounter preparation, engaging the clock, and switching away from and back to active GM Combat. A visual check caught and fixed the drone console progress display overlapping its timeline.
- The moving robot's server positions were tested; its entire animated journey was not manually followed in the browser. A complete two-player sensor-snapshot session and hosted PostgreSQL recovery were not exercised. No hosted/Render testing was performed.
- Remaining SIC documents in outputs now list eight in-scope cards. The two-page PDF was visually checked. DOCX content was regenerated, but its separate visual render could not run because LibreOffice was unavailable.

Restart the normal local server and refresh browsers to load the backend changes. Reset or create a disposable Explore room for updated sample equipment. Do not reset a real campaign to obtain those samples.
