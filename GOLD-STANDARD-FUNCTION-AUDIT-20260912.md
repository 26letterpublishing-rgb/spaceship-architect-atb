# Gold Standard Function Audit

Reference: ../sa-atb-multiplayer_GOLD-STANDARD-BACKUP_20260906-122807, newest of the three Gold Standard folders. Audit baseline: e1b389e, documentation HEAD 1308466. The findings below describe that baseline. The subsequent #local pass authorizes repairs, but no publishing. Gold Standard remains untouched.

## Local Repair Evidence

Follow-up comparison: VISUAL-PRESERVATION-CORRECTION.md records the September 9 sidebar-hide regression (b0aeca9), September 11 PC wrapper regression (e1b389e), original-style left-side panel restoration, six-toggle real-browser checks, and a repeat file/ID inventory against this same frozen reference. Construction's original controls still exist and are now tested for visibility and behavior; the Details sidebar hiding was the confirmed direct removal. No additional original JS/HTML files or unapproved static IDs are missing. This does not prove every dynamic feature works.

- Restored fresh-campaign NPC editor initialization on Characters, using live DOM updates to retain inputs. Verified ten editor inputs before visiting Combat.
- Mid-combat Add now awaits the starting-location picker and server result. Verified custom NPC creation at the selected square, cancellation retaining its draft, and its turn prompt appearing without a perspective switch.
- Restored PC map controls and named crew roster. Move now selects and confirms on the shared Ship Details map. Verified saved destination, crew markers, preview/Cancel, both print modes and unchanged construction drafts.
- End Combat previously called postCombatMessage, a PC-only helper, from a GM handler. The server ended combat but the parent GM page never received the navigation message. The GM handler now posts directly to its authenticated same-origin parent; Prepare Combat remains selected through subsequent refreshes. Verified from the actual embedded End Combat button.
- Kept the NPC action panel below the embedded toolbar so End Combat remains clickable.
- Mute controls now have one shared icon/label updater. Damage presentation temporarily covers obstructing windows without closing them or deleting input. Verified with a populated native dialog, and through the full GM/PC laser/damage/victory browser regression.
- No intentionally removed Station action or destructive old-data reset was restored. No new feature removal was requested or performed.

This restores the concrete regressions identified by the comparison. Static preservation checks and focused browser regressions are not proof that every historical workflow is bug-free; the remaining coverage limits below still apply.

## Confirmed Regressions

1. Fresh-campaign Premade NPC editor initialization: gm.js:1395 calls renderPremadeNpcConsole only when the Combat tab is visible and the live encounter is hidden. The editor actually belongs to Characters (gm.html:151). Local Chrome comparisons created a fresh isolated campaign in each build: Gold Standard immediately has 10 editor inputs and one template option; current has zero inputs and zero options. Visiting Combat and returning to Characters restores all 10 inputs. Explore initializes Combat first and did not reproduce this fresh-campaign failure. This is separate from the user's mid-combat Add complaint, whose precise cause is not confirmed here.
2. PC Starships map controls hidden outside Move: ship-pass2.css:12 hides player-starship-view-controls with the old map layout. The replacement details sheet does not expose equivalent controls in that view. Source-confirmed loss of the old accessible control strip.
3. PC Starships named, color-keyed crew list hidden outside Move: character.js:2171 still renders the crew list in player-starship-sidebar, but ship-pass2.css:12 hides its parent. The replacement markers/hover titles do not replace the always-visible roster. The decorative sheet crew fields are not the campaign roster.
4. PC Starships movement changes the entire map interface: the same CSS hides the shared details iframe during Move and reveals the old map. The movement function itself remains, but map context, details and cards are temporarily inaccessible. The user wants movement in the same main map, not an interface swap.

## Related Risks / Reported Failures

- Adding units mid-combat now passes through chooseStartingLocation. app.js:4152 advances the default NPC immediately rather than awaiting the asynchronous action/picker; cancellation or failure can discard the entered draft. The reported inability to add still needs direct reproduction with the user's workflow.
- End Combat not landing on Prepare Combat is user-reported. Current gm.js contains the intended route in both exitCampaignEncounter and the sa-combat-ended handler; presence of these handlers does not prove the transition works. Trace refresh/state ordering, including Explore reset, in the repair pass.
- Missing damage presentation, obstructing windows, Rapid Laser low-res art and mute-label competition are recorded user reports from after this release, not evidence that these features existed in the September 6 reference. Treat them as regressions/fixes, not requests to remove features.

## Retained Or Intentionally Changed

- All five original HTML pages and every original top-level JavaScript module still exist. Original static HTML IDs remain except enterCombatStation, removed with the explicitly requested move-to-station workflow. Static IDs are a screening check, not proof that all controls function.
- Original named functions mostly remain. c4StepsForValue and shipSegmentStates were replaced by shared delay/health rendering; corresponding UI remains. resetOldPlaytestData was removed to prevent deleting existing player saves; do not restore that destructive startup reset.
- Vehicle mount/dismount controls remain separately implemented, conditionally exposed when usable vehicles exist. Removing the free Station action did not require removing vehicles.
- Stored weapons moved to Items in Storage at the user's request; storage/retrieval handlers remain.
- Ship/character import/export, character printing, GM campaign backup/restore, script tools, Prompt/Give, Drama Cards, timing controls, delayed resolution and queued-effect controls retain their static entry points. This audit did not perform a full end-to-end browser test of each.
- The Lock-On map replacing its card image, quiet impacts, and removal of main Combat Activity flashing were explicit user requests, not accidental feature deletions.

## Baseline Verification Limits

Compared page IDs, named functions, server action cases, changed control markup, view styles and recent history. Ran local Chrome Gold/current NPC-editor checks in both Explore and fresh isolated campaigns. No Render traffic, personal campaign mutation, app fixes, commits or Gold Standard edits. Test browsers/servers closed. This is not a certification that every historical feature is regression-free.

The original recommendations above were implemented in the local repair pass documented at the top. Broader historical workflows remain subject to the stated verification limits.
