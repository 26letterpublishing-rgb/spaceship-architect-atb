# Remaining SICs

Updated October 1 2026

No in-scope SIC is entirely unstarted. Four earlier SIC implementations still require final integration verification before they should be treated as complete. This list tracks that remaining work rather than presenting unverified code as finished.

This pass implements Sensor Lure or Illusion (B-74) and Security Droid (B-73), with generated artwork, consoles, server rules and tests. The full local suite passes 857 tests. Browser card and console previews were checked; extended live multiplayer playtesting remains recommended.

Omitted by request: Reverse Targeting ID, Separation Module, Custom Build and SICs designed specifically for FTL battles, including FTL Burst and FTL Lock-On. Ordinary installed warp travel remains unchanged.

## Simple

None remaining in the Simple category.

## Moderate

### 1 Lock On Triangulator (B-121)

Implemented locally; final multiplayer and out-of-combat selection verification remains. Shares locks automatically with selected ships, including enemy ships. The source pays upkeep. The link survives while either ship can reach the other within twice its own sensor range.

**Verification:** No unanswered user rule. Verify asymmetric sensor ranges, lost sources and saved recipient selections.

### 2 Phazon Torpedo Launcher (B-109)

Implemented locally; final purchase, projectile and damage workflow verification remains. Footprint 1x2 EDG plus 1x3 EXT; EN 6; move speed 8; range 24; lock required; damage 3D10 multiplied by 2; shields apply normally.

**Verification:** No unanswered user rule. Audit ordinary missile purchases alongside mineral ammunition, interception and layered shields.

## Complex

### 3 Remote Receiver (B-113)

Implemented locally alongside Remote Controller; final permission and multiplayer verification remains. Local crew can cancel remote actions. Hacked access requires a carried remote.

**Verification:** No unanswered user rule. Verify unseen receiver selection, local override, range loss and hacked control.

### 4 Remote Controller (B-112)

Implemented locally; final interaction verification remains. Bridge-equivalent access, detachable Size C inventory controller, range 10, multiple linked receivers. Mirrored movement uses the same relative displacement; incompatible actions are skipped.

**Verification:** No unanswered user rule. Audit mirrored action timing and costs, portable access, maintenance routing and saved links.

## Maintenance

Omitted by request: Reverse Targeting ID, Separation Module, Custom Build and SICs designed specifically for FTL battles, including FTL Burst and FTL Lock-On. Ordinary installed warp travel remains unchanged.

After each SIC pass, verify working behavior, remove completed entries, update the count and date, reassess dependencies and regenerate the output documents. Read the original card before implementation.

This pass implements Sensor Lure or Illusion (B-74) and Security Droid (B-73), with generated artwork, consoles, server rules and tests. The full local suite passes 857 tests. Browser card and console previews were checked; extended live multiplayer playtesting remains recommended.
