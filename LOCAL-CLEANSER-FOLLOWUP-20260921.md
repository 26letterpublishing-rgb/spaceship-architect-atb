# Planetary Cleanser presentation fixes — September 21, 2026

Completed locally. No commit, deployment or personal campaign changes.

- **Combat View:** remembers the shared combat-view preference before closing the Cleanser console. Live updates no longer reopen it. Switching between consoles still preserves console mode.
- **Impact rings:** planet, debris, rings and fragments share one impact anchor. SVG outline rings keep a narrow stroke as they expand, replacing the large opaque-looking bands. The weapon-source glow remains, with its misleading separate circular outline removed.
- **Dice flood:** the existing PhysicalDiceRoller now supports an opt-in, full-viewport presentation for the simulated Cleanser result: **192 red D12s**, released in a cascade across the screen. The same numbered models, physics, tumble and settle animation are reused. The previously agreed simulated damage value and gameplay rules are unchanged.

## Performance choices made

The spectacle caps the visible pool at 192 rather than simulating 20,000 physical objects. Number textures and model geometry are shared; each die retains its own result-highlight material. This cosmetic pool uses reduced rendering resolution, no shadow-map pass and tray collisions without dice-to-dice collisions. Ordinary dice rolls retain their existing rendering settings, collisions and timings. The sequence still completes automatically and honors existing mute settings.

## Verification

- **517 automated tests passed**, zero failures, including new regression checks for the Combat View preference and the bounded dice presentation.
- Browser-tested as Nova: switched from Bridge to Cleanser, clicked Combat View, and confirmed the console stayed closed across live updates and the subsequent cinematic.
- Browser measurements placed planet, debris and both ring centers at the same point (less than 0.02 pixels difference during the small planet shake).
- Visually verified the full-screen D12 cascade using the existing physical renderer; confirmed automatic cinematic cleanup and the destroyed planet remaining on the map. No browser script errors were captured.
- Syntax and whitespace checks passed. Both personal campaign files retained their original SHA-256 hashes.

Refresh Spaceship Architect to load these browser changes. Testing used a separate temporary campaign/server; normal port 8790 and Vector were untouched.
