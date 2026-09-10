# Shield Generators and Shipyard Follow-Up

Authorized by #commit. Baseline 6472c14. Published application commit b0aeca9; GitHub push and hosted Render verification completed.

- [x] Restore large Construction map, separate Details tools, prominent green confirmation, ascending family cards.
- [x] Shield generators 2-10: source stats, unique art, tier-aware local/remote console.
- [x] Distance-based inertia; muted/reduced-motion-aware console emphasis and charge audio.
- [x] Review race/class text and repair 59 race transcription errors; skill descriptions with default/alternate attribute and existing roll flow.
- [x] Automated and desktop GM/PC checks.
- [x] GitHub and Render verification. Test-owned browsers and servers closed. Completion notification follows the final documentation push and cleanup check.

Rules: Restabilize is only available at zero HP; Reinforce remains for active shields. Initial drift is max(0, floor(actual powered distance / 2) - 2), then repeats the existing decay every 12 combat seconds. CvC is 3 seconds and SvS is 12 seconds unless explicit digital timing overrides it. Only generator SICs are included, not shield add-ons. Preserve Gold Standard and campaign data.

## Verification

- 104 automated checks pass. New coverage includes every generator's footprint, station count, HP, reduction, regeneration, price and total restabilization AU; short-hop inertia; every standard skill description.
- scripts/playtest-shields.cjs passes with isolated fresh campaign, GM and two PC clients, real mouse retries, remote/local shield access, zero-HP button gating, AU reservations, station departure, physical-only restabilization, frozen ATB, and actual server restart.
- Desktop screenshots checked at 1600x1000 and 1366x768. Construction map fills available width; Details hides construction tools; Bridge and Shield families ascend; ten shields fit the picker; skill reference remains centered after scrolling.
- Skill browser checks open default Intellect and alternate Dexterity roll setup with the existing D6+D4 pool. These are setup checks, not a new exhaustive dice-physics audit.
- scripts/playtest-cockpit.cjs passes 12 mouse orders: three PC and three NPC orders in a fresh campaign, then three each after station arrival in Explore Features. Engine charge starts once and stops on pause; existing turn-audio mute checks remain passing.
- Source metadata checked against SIC Series A/B; Shield 10 PDF card visually verified. Core skills use PDF pages 15-17, First Aid page 33. Existing digital timing overrides take precedence.
- Eighteen new PNG masters and WebP derivatives. Existing PNG masters untouched. All 122 optimized assets total about 17.2 MB versus 285.5 MB source images.
- Legacy in-flight orders without a traveled counter count remaining travel after upgrade; new orders persist their full traveled distance. No speculative reconstruction of historic travel.

Class summaries/previews were reviewed; identified PDF transcription repairs were in race lore. No class mechanics changed. Shield Engineering behavior preserves the previous approved implementation.

Hosted verification matched 18 application/style files and 24 optimized artwork responses to local hashes. Bridge and Shield pickers passed at 1366x768 without page errors; hosted screenshot inspected. Initial check saw the preceding deployment; retry after rollout matched. No hosted campaign records were created or changed.
