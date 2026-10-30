# Console verification reference

Use this reference for diagnosis, scoped implementation and handoff of Console or
Console-debug work. It records reusable lessons, not permission to repair every
discovered issue, add every family, change rules or redesign interfaces. AGENTS.md,
the approved file/behavior boundary and later direct user instructions control.
New findings go into the backlog. No artwork creation, publication or notification
authority is granted here. Preserve personal data and active-work holds.

## Before proposing a new Console family

Inventory and cite the actual production entrypoint and renderer, shared helpers,
CSS consumers, dedicated artwork and other asset roles. Identify each supported
tier/variant and the dependencies needed for its real operation:

- Installed equipment, EN, AU, ammunition or other resources, crew/station access,
  permissions, power/maintenance state, targets, range, locks and combat timing.
- Animations and their triggers, audio paths, hidden information and role filters.
- Normal, offline, invalid, empty and recovery states; actions that open another
  dialog, begin movement, wait for a GM or require a roll.
- What the debug fixture simulates, what it omits, and what must be tested in actual
  production. Do not copy Sensors assumptions into a different family.

Reuse production renderers and existing tests where appropriate. A purchase-preview
screenshot is not a live Console; a mock value is not proof of a game rule. Do not
claim all families work because one pilot or shared component passed.

## Delivery and entry

- Record checkout/build, server root/port, browser zoom, viewport and relevant
  scaling. Check actual running-server JS/CSS status, content/hash, dependencies,
  public-file allowlist, load order and browser/CSP errors. A fresh test server does
  not establish that an older running process can deliver new scripts.
- Test the natural Main Menu -> Debug path without injected navigation,
  authentication or campaign setup. Test the production station entry separately.
- Use owned isolated storage and headless/exact-tab automation. Do not steal focus,
  send global keyboard/mouse input or refresh a user's existing tab. Restarting a
  shared server requires the applicable authorization and verified configuration.

## Interaction matrix

List the applicable combinations before testing; record unsupported states
explicitly. Do not substitute isolated happy-path tests for combined sequences.

- Normal map -> enlarged map -> return, repeated, including active selection and
  resizing across layout thresholds. Enlargement must enlarge the real map.
- Every visible top/bottom Exit, outer/nested X, Escape, Leave and reopen route,
  powered and unpowered, before and after other dismissal paths. Preserve required
  roll/decision protections; do not introduce a generic dismissal bypass.
- Closed views stay closed through updates; deliberate reopen resumes animations.
  Check duplicate/stopped timers and listeners, tier switches, mute and power
  transitions. Inspect motion over multiple frames, not one screenshot.
- Leave may invoke real movement rather than simply close. Complete/cancel that
  flow and verify return to a valid station; do not assert immediate reopening if
  the game intentionally removed station access.
- Debug Restore changes only fixture state and remains reachable when offline.
  Real Restart has its own station/Bridge prerequisites, countdown, resources and
  ATB effects. Test those separately before making a gameplay claim.

## Rules and information visibility

Distinguish user-approved/current 2e specifications, historical notes, printed
foundations and present implementation. Code alone does not prove a rule correct.
Trace both the visible UI and authenticated server payload for GM/PC, own/friendly/
hostile ships, unknown/detected contacts, Analysis, shared intelligence and stale
last-known information where applicable. A UI mask is insufficient if the payload
still exposes hidden data. Clearly label fake values and simulated prerequisites.
Keep a narrow disclosure audit narrow; do not claim a whole privacy audit from it.

## Audio

Test synthesized Console ticks separately from asset-based button feedback such as
Chunk, Robot and Whoosh. Trace the existing shared mixer and handler; do not add a
competing click listener. Verify the intended Master/category multiplication,
mute/zero-volume suppression, preference restoration and open/closed/offline gates.
Check actual playback transport in the viewer's CSP/sandbox, not only HTTP200 for
an audio asset. Do not loosen security or write personal preferences without scope
approval. Technical scheduling/playback evidence is not subjective listening.

## Layout and artwork

- Inspect actual before/after pixels in production and Debug at 1920x1080,
  1366x768 and 1280x720, plus any reported viewport or relevant threshold. Do not
  claim exact-device reproduction when the user's configuration is unknown. No
  tablet/phone work until Jason opens that phase.
- Include normal, large and expanded content, online/offline warnings, nested
  dialogs and active attention/selection slots. Check clipping, intersections,
  alignment, reachable final controls, useful map area and readable information.
- Measure map/header/Tactical Ring bounds and fonts where preservation is required.
  SVG coordinate font sizes can vary with camera compensation: compare stabilized
  screen-space glyphs at equal state, without dropping the visual check.
- Preserve user-refined typography and proportions. An adjustment approved for one
  label is not permission to enlarge or shrink all text, buttons or Console families.
- Shared CSS must distinguish normal and enlarged structural layouts. A normal
  ring row must not become an enlarged footer. Test selector specificity and all
  dependent consumers; bound button sizes and verify footer/content nonoverlap.
- Distribute surplus between logical groups, not between related gauge components.
  Zero bottom slack or zero overflow alone does not establish visual quality.
- Attention slots must remain stable across idle/select/confirm/cancel where that
  behavior is approved. Account for real wrapped messages and available height;
  report explicit constrained-size exceptions. Never hide controls to pass a fit
  assertion. Preserve accessible scrolling for legitimate large content.
- Use the existing artwork as the physical shell; align controls/text to its panels
  and retain contrast/focus targets. Follow DEVELOPER-GLOSSARY.md: Floorplan graphics,
  SIC illustrations, dedicated Console artwork and preview screenshots are distinct.
  Filename, background presence or historical binding alone does not prove role.
  Never fabricate raster/SVG/vector/canvas replacements without Jason's permission
  and required design approval.

## Evidence and handoff

Reuse relevant modes of `scripts/playtest-console-viewer.cjs` and existing layout,
dialog, offline, Scan Hex, tactical-renderer and audio tests after inspecting what
they actually cover. Add missing state combinations within the approved scope.
Do not blindly copy fixtures, selectors or assertions into a new family.

Retain original failed screenshots/results and immutable pre-change baselines.
Explain any changed test expectation against the approved behavior; never weaken
tests or replace baselines to bless a defect. Review the complete scoped diff.
Run appropriate focused/aggregate/syntax/whitespace checks, but do not equate their
counts with workflow or pixel acceptance.

Return a passed/failed/untested matrix with exact workflows, viewports, roles,
fixture/server identity, screenshots, measurements, reproduction steps and limits.
Separate implementation completion from independent verification and Jason's
playtest acceptance. Independent review must inspect actual pixels and interactions,
not only DOM metrics or the implementer's self-report.

### Known limits to revalidate, not permanent rules

As of the October 26 Sensors work, normal Debug at 1280x720 retains the older
shifting selection slot because its Console viewport is below the approved 704px
reservation threshold. This is partial coverage, not all-size completion.
Subjective audio quality and untested production paths remain explicit gaps;
synthesized-tick success does not establish asset-button audio success. Review the
current task ledger before carrying these observations forward or declaring them
resolved. Later approved work may supersede them.
