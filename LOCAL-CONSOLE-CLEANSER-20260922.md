# Local console, maps and Cleanser pass — September 22, 2026

Implemented locally under Jason's #local authorization. No commit, push or deployment. Personal campaign files retained their original SHA-256 hashes.

## Player experience

- A large gold **Console View** button sits at the bottom center of the PC Combat screen, attached to the outer viewport so scrolling does not move it. It is available while stationed, including 99% Hold, and hides while another dialog is open. The GM's multi-operator selector remains available.
- Opening a console only changes the view. It does not resume Hold, spend ATB, or bypass disabled action controls.
- Each PC's console and view preference are stored separately by campaign and character. Returning to Combat restores the last selected console without needing another combat update. Explicit Combat View opts out until Console View is opened again; changing/leaving the station clears its saved selection. Restoring cannot cover another open dice/action dialog.
- Interior maps fit the ship on initial opening and character movement selection, including external components and triangular Hull. Expanded interiors fit on opening. Ordinary live updates retain manual zoom. The navigation starfield fills the chart behind its controls on all sides.

## Planetary Cleanser sequence

After 120 active seconds, the encounter pauses at the standard damage dialog displaying **20,000D12**. The firing operator clicks **Roll Damage**, which creates one server-owned simulated result and runs the existing physical dice renderer's 192-D12 cascade. All viewers see that same result. **Confirm and Submit** then begins zup and the shared destruction cinematic, followed by permanent map debris.

The explosion still starts 0.5 seconds before the 2.88288-second zup audio ends. The existing explosion/rumble tail remains. New version-3 cinematics do not roll the dice a second time. Previously saved version-1/2 firing events retain their old timing.

The GM has an explicit Resolve this roll control for disconnected-player recovery. Roll, animation acknowledgment and confirmation are authenticated, idempotent and persisted; retrying does not generate new damage or restart a confirmed cinematic. Pending damage/results freeze simulation and command clocks. Existing charge costs, cooldown, ship safety and mineral spending are preserved.

## Decisions and limits

- The damage result waits for the normal Confirm and Submit action, rather than dismissing itself on a timer. This allows players to read it before firing.
- Kept the bounded 192 visible D12 presentation and existing 100,000–160,000 simulated result range. The 20,000D12 pool is explicitly a spectacle as previously authorized.
- Fit runs when a view opens or movement selection begins; it does not fight intentional zoom during live play.
- Browser checks covered a separate normal campaign on port 8791, using PC and GM views. Per-character isolation and modal protection were also tested with independent PC fixtures. Full Explore GM/PC switching across every console type was not separately replayed. Audio playback progression/duration was inspected, but subjective sound balance was not auditioned.

## Verification

- Full suite: **525 passed**, 0 failed (test-artifacts/console-cleanser-full-final.txt).
- Final modal-protection/console/HTTP checks: **6 passed**, including one subsequently added regression (test-artifacts/console-cleanser-last-check.txt).
- Browser: held PC reopen with Resume still shown; saved Cleanser restored on returning to Combat; fixed gold button verified visually and by viewport bounds; navigation coverage; normal damage prompt, D12 cascade, identical PC/GM result, no audio before confirmation, shared cinematic and destroyed planet; expanded interior entirely inside viewport; zoom still works; PC Move restored Fit Ship after manual zoom.
- JavaScript syntax checks passed. Git whitespace check passed with Windows CRLF accepted.
- Personal storage hashes unchanged:
  - app/data/campaigns.json: 7B679E7F05595DFFB15F8ED08CC82DCD4961505088379330B38742D5D017E190
  - SA-ATB Local Development Files/campaign-data/campaigns.json: B4521B48265B48345CEC463C2085F906C6F23A9A451EE2CCDBC34D73C9A387A6

Restart the usual Spaceship Architect server on port 8790 and refresh browser views to load the backend sequence and new controls.
