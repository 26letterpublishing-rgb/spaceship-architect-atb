# v0.3 local implementation ledger

Authorized September 28, 2026: complete all queued passes sequentially, local only. No existing save migration required; do not delete existing files. Preserve gameplay and the established dice renderer. No commit/push/deploy.

## Sequence and acceptance

1. Main menu / campaign foundation: centered room join, file-based GM access, create campaign/character, tutorial toggle, v0.3; durable campaigns, stable/changeable room codes, close/reconnect/recovery; player first names, exclusive persistent links, visible unrestricted passwords, GM assignment, abandon; immediate native creation, approved portable imports, spectators see combined PC knowledge, GM-only crew, concurrent edits and cancel.
2. Ship inventory and snapshot: three recent cards, categorized contextual inventory, cached bounded static floorplan included in ship/campaign saves; dynamic overlays preserved, confirmed edits invalidate; no combat Hull view.
3. Combat fixes: NPC Console View, full-screen Cleanser, repeated hacking letters, hacked shutdown, escapable spectator roll screen, correct roll/result/cinematic sequencing, lightweight existing-renderer D12 display, start-only sensor-range validation and fixed target hex thereafter, hidden objects excluded from fit.
4. Keyboard movement: out-of-combat WASD/arrows, real doors/speed, no typing interference, live/saved positions and combat handoff.
5. PC sidebar/statistics and creation: Attribute/Skill roll controls, other tabs read-only, default Attributes, retract active tab; final-score averages/counts, personal damage records, lifetime earned EXP/Reverence retained in portable character; after first decimal roll (existing D10 rules) fade in Skip preserving results.
6. GM Quick Prompts: all-PC columns plus Everyone(all characters), ten independent presets each (five specified defaults), integer persisted difficulties, delete defaults, queued normal rolls, permanent capped +1 Reverence.
7. Full regression and multi-client browser playtest, detailed final report and decisions; ntfy only on actual completion.

## Clarified rules

- Cleanser validates sensor range at activation only. It fires at the original hex; a ship at least three hexes from it avoids damage.
- Loaded campaign file grants GM; an existing room prompts update from file or join current state. Close Room closes for all; disconnection alone does not.
- Standalone character cannot spend money; creation EXP allocation allowed. Portable files omit passwords/campaign link, retain statistics.
- Import approve/reject as-is. Native campaign character creation immediately playable. A linked PC cannot create/import another until abandoning (character remains).
- All assigned PCs may edit a ship. Confirmed changes eject stale editors with a notice; cancel spends nothing pending.

## Progress

All seven passes implemented and locally verified. See LOCAL-V03-20260928.md for changes, decisions, browser checks and testing limits.

Final regression: 653/653 tests passed. 66 changed/new JavaScript syntax checks and whitespace checks passed. Local only; no commit, push or deployment.
