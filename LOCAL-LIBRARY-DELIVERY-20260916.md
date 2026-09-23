# Local GM Library delivery — September 16, 2026

Implemented Jason’s request locally. No commit, GitHub push, deployment, or edits to personal campaign data or Gold Standard.

## Using it

Open GM → Prompt / Give → Send to Library. Choose a destination Library, enter a title and up to 4,000 characters of information, then choose Send Library Entry. The control appears when a usable Library is available.

The entry is archived in that specific Library’s existing Shared Records, labeled GM. Paragraph breaks are retained. Assigned PCs receive “Library has been updated” in their normal inbox, including players who are offline. The notice names the ship and entry; the full text is read at the Library console. Search and existing PC-created Library records continue to work. An already-open Library receives new entries on its normal refresh.

## Decisions made without asking

- Put the GM authoring form beside Private Note in Prompt / Give. Library delivery uses its own ship/SIC destination, independent of the character-recipient checkboxes used for other tools.
- “Available” means installed, online, undamaged, sufficiently powered, and on a surviving ship. Multiple Libraries have separate destinations. If a selected Library becomes unavailable, the GM must choose again; the form never silently redirects an entry to another ship.
- Notify all registered PCs assigned to that ship, including offline PCs. Do not notify unrelated PCs or put the full entry text in their inbox.
- Allow the GM to deliver information without seating a character at the Library, including during combat. Existing PC physical-access and outside-combat room-use restrictions are unchanged.
- Preserve the existing title/text limits (100/4,000 characters) and 100-entry room limit. GM entries follow existing author-only/GM deletion permission; PCs can read/search them and use the existing completion checkbox.
- Preserve an unfinished draft through campaign updates and tab switches. Retain it on error, with the same delivery receipt for an unchanged retry, so a lost response cannot create duplicate entries or inbox notices within the existing 256-command receipt window.

## Implementation

ship-crew-rooms.js shares archive creation between ordinary crew notes and GM delivery. It owns destination availability, receipt checks and crew notification. campaign-api.js exposes GM-only destinations and an authenticated /api/campaign/starship/library-entry route. Live deliveries update both authoritative encounter room records and the campaign copy; the existing persistence path keeps them through later combat saves and restarts. gm.html/gm.js add the authoring form. Existing Library rendering already supports paragraph-preserving plain text and search.

## Verification

- Full automated suite: 423 tests passed, zero failures.
- Five focused Library unit tests cover destination eligibility, notifications, retries, validation, archive limits, live damage and PC access/removal restrictions.
- HTTP test covers rejected player/anonymous delivery, private recipient visibility, stale builder saves, delivery during a paused combat without advancing turns, real server restart and persisted retry deduplication.
- Chrome Library delivery test covers the actual GM form, no-Library hiding, live draft retention, a deliberately lost successful response and retry, PC inbox notice, physical Library access, paragraphs/plain text, search, reload, updates while open, and mobile layout. Screenshots inspected.
- Existing Chrome crew-room playtest passed, including VR training, Library records/search, Meeting Room, Medbay, AI and desktop/mobile controls.
- Shared held-turn, weapon-clock and ship-workflow browser checks passed.
- Syntax and whitespace checks passed. Tests use isolated temporary campaigns and servers, and close their own browsers/server processes. The user’s server was not restarted.

Evidence: test-artifacts/library-delivery and test-artifacts/library-full-tests.txt. Restart the local server and refresh the GM/player pages to load the changes.
