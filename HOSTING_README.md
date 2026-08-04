# Spaceship Architect Campaign Hosting Notes

The application now supports multiple permanent campaign codes. Each campaign keeps its roster, character sheets, GM script, shared credits, private notes, roll requests, and current ATB encounter separate from every other campaign.

## Local Testing

Run `START ATB MULTIPLAYER SERVER.cmd` and open the local address it displays. Local testing stores campaigns in `data/campaigns.json`. Encounter clocks restore in a hard-paused state after a restart so no time advances while the server is offline.

## Hosted Setup

1. Upload the contents of `sa-atb-multiplayer` to the GitHub repository.
2. Keep the Render Web Service connected to that repository.
3. Use `npm install` as the Build Command and `npm start` as the Start Command.
4. Attach a PostgreSQL database and add its connection string to the Web Service as an environment variable named `DATABASE_URL`.
5. Deploy the latest commit.

The server's startup log and `/ping` page report either `postgres` or `local-file` storage. A hosted public playtest should report `postgres`.

## Important Storage Warning

Without `DATABASE_URL`, the app falls back to a local JSON file so it remains easy to test on one computer. Files created inside a typical hosted Web Service are temporary and may disappear after a redeploy or service replacement. Do not treat hosted campaign data as permanent until `/ping` reports `Campaign storage: postgres`.

## Local-First Safety

- Campaign characters autosave a device-local copy and synchronize with the campaign server whenever the character is unlocked.
- `Save & Sync` creates a recovery snapshot, updates the device copy, and immediately requests a server save.
- The GM Control Panel caches its latest campaign view locally.
- `Save Campaign Backup` downloads a complete `.sa2campaign` file containing character sheets, PINs, scripts, awards, notes, shared credits, and the paused encounter.
- `Restore Campaign Backup` can rebuild a missing campaign with its original code and a new GM password.
- Browser storage is a convenience copy, not guaranteed archival storage. Keep periodic downloaded campaign backups.

## Current Access Model

- Campaign codes are four characters during private playtesting.
- GMs open a campaign with its code and GM password.
- Players may view every character in the campaign.
- A player-chosen PC Code is required to edit a character, spend Experience, join the ATB as that character, or transfer credits.
- The GM can see all character PINs and directly edit every sheet.
- There is no password recovery yet. Keep the GM password somewhere secure.
- Imported characters require GM approval; characters created inside the campaign do not.
