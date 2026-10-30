---
name: sa-diagnose-and-propose
description: Diagnose one Spaceship Architect issue and prepare its bounded repair plan. Use before implementation of a new issue or a proposed scope expansion.
---

Read the current AGENTS.md focused-change policy and DEVELOPMENT-STANDARDS.txt.
The policy controls authorization; this skill does not grant permission to edit.

For Console or Console-debug work, read [Console verification](../sa-implement-and-verify/references/console-verification.md).
Before proposing a new family, inventory its dependencies and production/simulation
differences; include the relevant state combinations and unresolved gaps in the plan.

1. Identify the single assigned issue, reported behavior, expected behavior and
   source of that expectation. Distinguish direct instructions from assumptions.
2. Check current task state, working-tree changes and concurrent ownership.
   Preserve completed uncommitted work, personal data and protected sessions.
3. Reproduce safely using isolated data. Record build, exact steps and evidence.
   For UI issues, inspect actual pixels and relevant DOM/computed geometry.
4. Trace the relevant code, history, assets and dependent consumers. Distinguish
   confirmed cause, hypothesis and missing evidence. Do not infer asset identity
   from filenames or assume older code is correct.
5. Propose the smallest repair: exact files, changed behaviors, preserved
   behaviors, dependencies, risks and regression/visual acceptance checks.
   Existing historically verified assets may be selected in an approved mapping
   restoration. Artwork creation or modification requires Jason's permission;
   new designs require his approval before use, as specified in AGENTS.md.
6. Record unrelated discoveries in the backlog. Do not repair them incidentally.
7. Stop for plan approval. Report diagnosis and proposal without applying it.

If reproduction or access is blocked, report the exact action and target,
reason, completed evidence and unresolved uncertainty. Continue independent
read-only investigation where useful.
