# Spaceship Architect — Developer Glossary

**Status: Draft / developer communication reference.** These definitions do not
authorize behavior changes, automatic renaming, refactoring, or player Help
terminology changes. Later direct instructions from Jason take precedence.

## Console and artwork terms

**Console:** A full-screen operational starship station interface, distinct from a
Popup, SIC card, and Floorplan graphic. The live interface, its dedicated artwork,
and a preview screenshot are separate things. Existing Console artwork is the
physical shell: text and controls should align with its intended panels. This is
guidance for individually scoped work, not permission to redesign an interface.

**Floorplan graphic:** Equipment imagery used on a ship map. It is not a SIC
illustration or Console artwork. There is no universal file-format or transparency
convention that establishes this role.

**SIC artwork:** A stylized AI-generated illustration associated with a SIC card.
A background is common but is not required; the approved Lock-On illustrations
are an exception. Many illustrations use level-specific palettes, but there is
no universal palette. Confirm the intended role and SIC association rather than
relying on filenames, background presence, or historical bindings alone.

**Console artwork:** Dedicated interface artwork for a Console. SIC illustrations
and Floorplan icons must not replace a dedicated panoramic or scene display.
Small identification thumbnails beside equipment information are allowed; Jason
explicitly approved retaining the Sensors thumbnail. That thumbnail is not a
substitute for the Console's dedicated background or scene. The existing Meeting
Room is a good example and must not be changed under this clarification. Not every
Console necessarily has an illustration.

**Console preview screenshot:** A captured representation of a Console. It is not
automatically the underlying Console artwork, nor evidence that the live
interface's interactions function correctly.

**Tactical Ring:** The circular combat timing/status display, distinct from its
surrounding panel or card container. Authorization to change the ring does not
implicitly authorize changes to its container, or vice versa.

## Messages and attention interfaces

**Popup:** An attention-demanding green Vector-style box that dims the background.
Most have a top-right X. Consoles are excluded. Required decision workflows may
involve a Prompt; confirm the workflow-specific dismissal rules rather than
assuming every Popup can be dismissed.

**Notification:** A small, silent, bottom-right, non-scrolling transient notice.
It auto-dismisses and may also offer manual dismissal. Routine planet-arrival
information belongs here, not in Mail.

**Prompt:** A larger, stylized, bottom-right notice requiring action. It persists
and is generally non-dismissible, subject to established exceptions. A GM roll
request opens a completion Popup. Quick Prompt Reverence awards go to Mail.
This term does not mean an AI prompt.

**Mail:** Inbox items for approvals, near-future decisions, awards, and messages
from other users. Mail is not for routine informational notices or self-messaging.

**Top-Banner:** Static attention text, such as intruder or O2 information, with a
tone/chime and a small X. Persistence and fading depend on the condition.

**Alert Banner:** An urgent attention category. ALL HANDS ON DECK uses an alarm
and a rainbow Combat tab. AWAITING GM APPROVAL must use a **tone, not an alarm**,
per Jason's explicit correction. Its cadence and flashing are unspecified; do
not automatically inherit the combat alarm behavior.

## Preservation and scope safeguards

- Distinguish Floorplan graphics, SIC artwork, and dedicated Console artwork by
  their roles. An allowed identification thumbnail does not replace a Console
  scene. Keep preview screenshots distinct from live interfaces.
- Historical backups and bindings are candidate leads, not proof that an asset
  or mapping is correct.
- Creating or modifying artwork requires Jason's explicit permission. New
  designs also require his approval before use. Vector, SVG, canvas, and other
  substitutes do not bypass these requirements.
- A confirmed restoration must remain within its approved repair scope.
- This glossary is a developer communication reference. It does not authorize
  automatic renaming, refactoring, behavior changes, or player Help rewrites.
