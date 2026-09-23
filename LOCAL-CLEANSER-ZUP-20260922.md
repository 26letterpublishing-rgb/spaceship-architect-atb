# Cleanser zup synchronization — September 22, 2026

Implemented locally. The original assets/zup.mp3 is preserved; its byte-identical served copy is cleanser-zup.mp3.

Interpreted Jason's half-second instruction as starting the explosion **0.5 seconds before the clip ends**. The browser decodes 2.88288 seconds of playable audio (file metadata includes extra MP3 padding). Impact begins at 2.38288 seconds. A shared, versioned timeline drives server duration, visuals and playback; muted/hidden clients keep the same visual schedule. Late playback seeks to the current shared time, and completed clips do not restart.

The previous firing audio's explosion/rumble tail is retained from its 8-second mark, beginning with impact. The original charge hum, 192-D12 cascade, debris, damage result and gameplay rules remain. The presentation now lasts about 14.383 seconds; charging still takes 120 active seconds. Already-saved legacy firing events retain the old 20-second schedule and audio.

Verification: 18 focused tests passed, including HTTP delivery of the exact audio bytes, authoritative event timing, pause/restart persistence, stage boundaries, mute/resume/no replay and legacy fallback. Browser loaded/decoded zup.mp3 and displayed the shortened aftermath without script errors. The hidden test browser suppressed audible output; final subjective sound balance was not auditioned. JavaScript syntax checks passed. Both personal campaign files retained their baseline hashes. No commit, push or deployment.

Restart the local Spaceship Architect server and refresh the browser to load the shared timing changes.
