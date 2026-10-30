---
name: sa-implement-and-verify
description: Implement and hand off an approved bounded Spaceship Architect repair. Use only after the issue plan and local implementation are authorized.
---

Read the current AGENTS.md focused-change policy and DEVELOPMENT-STANDARDS.txt.
Confirm the approved issue, files, behaviors and acceptance checks.

For Console or Console-debug work, read [Console verification](references/console-verification.md).
Use its applicable state matrix and evidence requirements within the approved scope;
record uncovered cases rather than treating this checklist as permission to expand work.

1. Recheck working-tree state and concurrent edits before modifying shared files.
   Preserve unrelated work and record the pre-existing diff.
2. Implement only the approved repair. Routine choices inside that boundary
   need no repeated approval. If the boundary must expand, explain why and stop
   that portion for approval. Put unrelated discoveries in the backlog.
3. Review the complete resulting diff, separating this repair from inherited
   changes. Verify preserved mechanics, assets, controls and data behavior.
4. Run the approved regression checks and required repository checks.
   For visual work, inspect before/after pixels and complete relevant actions
   at the approved desktop sizes and transitions. Check occlusion, alignment,
   readability and reachability, not only overflow or test counts.
5. Never weaken tests or replace baselines merely to accept a defect.
   Explain any intentional expectation change against the approved requirement.
6. Provide changed files, rationale, test results, screenshot paths, reproducible
   isolated review setup, remaining gaps and backlog additions.
7. Hand off for parent independent verification and Jason's playtest. Distinguish
   implementation complete, verification passed and acceptance pending.
8. Publication requires separately applicable scoped #commit authorization.
   Stage only reviewed intended changes, follow existing publication checks,
   verify the remote result and use the configured final notification workflow.
   #local never authorizes publication or a completion notification.

Do not change account-level approval settings. Do not expose notification secrets.
