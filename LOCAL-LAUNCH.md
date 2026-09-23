# Launch Spaceship Architect locally

1. Double-click **Start Spaceship Architect** on the Windows desktop.
2. Keep its server window open. Wait for "Spaceship Architect campaign and ATB server running".
3. Double-click **Spaceship Architect ATB Sync** on the desktop, or open http://127.0.0.1:8790/index.html.

The first shortcut starts the server. The second only opens the browser.

The server shortcut runs `START SA ATB MULTIPLAYER.cmd` in the project folder, which calls `sa-atb-multiplayer/START ATB MULTIPLAYER SERVER.cmd`. Existing local campaign storage remains `SA-ATB Local Development Files/campaign-data` beside the app folder. No saved campaigns were moved or reset.

Spaceship Architect uses port **8790**, separate from Vector. The Windows launchers explicitly select this port. Direct `node server.js` also defaults to it while honoring an explicitly supplied PORT for hosted deployments and tests.

For phones on the same network, use the Phone address printed by the server, ending in `:8790`. The connection-test and firewall-helper scripts have been updated to match. The firewall helper was not run automatically.

If the server says the address is already in use, first check whether Spaceship Architect is already running. Do not stop a Vector server to make room. Close the Spaceship Architect server window when finished.

Changing the port creates a separate browser storage location, so you may need to rejoin your saved campaign or set browser preferences again. Server-side campaign files are unchanged.

Verified September 21, 2026: an isolated server with no PORT override served the Spaceship Architect page and `/ping` on 8790 while Vector remained available on 8787 and 8792. Hashes of both existing Spaceship Architect campaign files were unchanged. The temporary verification server was stopped afterward. No commit, push, or deployment.
