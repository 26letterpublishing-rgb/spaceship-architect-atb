(function(root){
  'use strict';
  // GM-only content; rendered by the existing campaign Help dialog.
  const shared = [
    ['Combat — Prepare, then run the encounter', `<p>Use <strong class="help-check">Surface Combat</strong> for characters fighting on an arena, or <strong class="help-check">Starship Combat</strong> for ships and the crews operating them.</p><p>Start by choosing who is taking part, arranging the battlefield, and checking starting positions. <strong>Begin Combat</strong> opens the encounter. <strong>Engage Clock</strong> starts its timing.</p><p>Both use <strong>Active Time Battle (ATB)</strong>: characters become ready as their meters fill. You manage NPCs, keep play moving, and handle decisions the app cannot make for you.</p><p class="help-reminder">Preparing an encounter, opening it, and starting its clock are separate steps. You can review the setup before anyone needs to act.</p><p>Choose a Help section above at any time. <strong>Shared Controls</strong> covers timing, saves, and recovery. The other sections walk through each battlefield.</p>`, 'combat-prepare', 'Overview'],
    ['Preparation, saves, and recovery', `<p><strong class="help-check">Save Preparation &amp; Return to Campaign</strong> keeps your draft so you can return to it later. It does not start combat.</p><h3>Reuse a setup</h3><p><strong>Save Arena</strong> exports a <strong>.sa2arena</strong> setup: its battlefield, objects, NPCs, ships where applicable, and PC starting slots. Ongoing damage, timers, and explored-area memory are left out—even when you save from a live encounter.</p><p><strong>Load Arena</strong> opens a review before replacing the preparation draft. Check the PC assignments and starting positions. It does not resume a battle or replace the live encounter immediately.</p><h3>Return or replace</h3><p><strong>Resume Encounter</strong> returns to the existing battle. <strong>Start New Encounter</strong> prepares its replacement; read the confirmation before proceeding.</p><p><strong>Reset</strong> asks to undo the last action. <strong>Undo</strong> restores the preceding combat change when available. <strong class="help-warning">Clear</strong> removes the encounter’s combatants after confirmation; it is not the normal way to finish a battle.</p><h3>Recover from a problem</h3><p>Combat checkpoints are saved automatically. Use <strong class="help-check">Restore Latest</strong> or <strong>Choose Earlier Checkpoint</strong> when you need to recover. The app backs up the current campaign first and restores combat paused.</p><p class="help-warning">Restoring rolls back saved progress. Use Resume Encounter for an ordinary return to combat.</p>`, 'combat-prepare', 'Preparation & Saves'],
    ['The clock, turns, and missing results', `<p>ATB meters show who is getting ready to act. Speed affects how quickly they fill. A PC's <strong>Command Window</strong> gives them time to choose an action; its length comes from their character and the GM's Settings bonus.</p><p><strong class="help-check">Engage Clock</strong> starts progression. On the first engagement, everyone receives the pulsating <strong>ALL HANDS ON DECK</strong> announcement with the combat alarm. Use <strong>Pause Everything</strong> when you need to stop and review.</p><h3>Finish the roll</h3><p>For requested dice, players roll, review, then press <strong class="help-check">Confirm and Submit</strong>. Seeing dice on screen does not mean the result has been sent. If submission fails, <strong>Retry Submit</strong> keeps the same result.</p><h3>A player is disconnected or stuck</h3><p>The GM can act for a ready PC. During an attack, use <strong>Resolve To-Hit for Player</strong>, <strong>Resolve Defense for Player</strong>, or <strong>Resolve Damage for Player</strong> as needed. First Aid and ship roll panels also offer GM recovery controls. Finish the requested step using the offered dice or manual result controls.</p><p class="help-reminder">Required roll dialogs cannot simply be closed. Resolve the pending step instead of starting another roll.</p>`, 'combat-live', 'Clock & Recovery'],
    ['Choose the right delay', `<p>The <strong class="help-check">Delay Console</strong> represents waiting. Choose the type that matches what you want to happen afterward.</p><h3>Reload/Recovery — wait before acting again</h3><p>Use this for reloading, recovery, or another waiting period. When it finishes, that recovery delay is over.</p><h3>Delayed Resolution — wait, then resolve an action</h3><p>Name the action and give it time to finish. When it is ready, combat pauses for you to resolve it. After handling the outcome, use <strong>Pass</strong> on that resolution panel to continue.</p><h3>Queued Effect — setup first, effect later</h3><p>Configure the setup delay, then the separate effect's name and rate. When setup finishes, resolve it and press <strong>Pass</strong> to launch the effect countdown. The character can work toward another turn while that effect runs. When the effect is ready, resolve it and press <strong>Pass</strong> again.</p><p class="help-warning">A custom name is a reminder, not an automatic game command. Naming a delay “Scan” or “Explosion” does not make it run a sensor or deal damage. Installed systems have their own operating controls.</p>`, 'combat-delay', 'Delay Types'],
    ['Use the Delay Console', `<ol><li>Normally, press <strong class="help-check">Pause Everything</strong>, then open the character's <strong>Delay</strong> control. It is also available during a paused NPC turn.</li><li>Choose <strong>Reload/Recovery</strong>, <strong>Delayed Resolution</strong>, or <strong>Queued Effect</strong>. Give an action or effect a recognizable name.</li><li>Choose a starting speed from <strong>Very Slow</strong> through <strong>Very Fast</strong>.</li><li>Adjust the arcs, review the rate, and press <strong>Confirm Delay</strong>. An existing delay uses <strong>Confirm Changes</strong>. A new Queued Effect opens a second setup panel; finish with <strong>Confirm Queued Effect</strong>.</li></ol><h3>Adjust the pace</h3><p><strong>Situation</strong> reflects circumstances. <strong>Quality</strong>, <strong>Performance</strong>, <strong>Efficiency</strong>, and <strong>Ingenuity</strong> let you account for equipment, execution, and creative approaches. Click the left side to lower an adjustment, or the right side to raise it. Up to four arcs light up: blue for negative, green for positive.</p><p><strong>Execution (Crit)</strong> is an on/off critical bonus, not another four-step arc. The panel background colors group the controls; they do not identify automatic calculations.</p><p class="help-reminder"><strong>Higher Delay Rate = faster completion.</strong> The rate is not seconds remaining. Some equipment supplies its own settings, such as repair-drone Quality; review supplied values instead of assuming every action starts alike.</p>`, ['combat-delay','combat-queued'], 'Using Delay']
  ];
  const surface = [
    ['Surface Combat — set the scene', `<p>Choose <strong class="help-check">Surface Combat</strong> when the encounter takes place on foot. Build the arena, choose the characters and NPCs, and place them where the scene begins.</p><p>Make sure there is walkable floor and a clear route through the areas you intend the party to explore. Walls and doors help define the battlefield.</p><p>The highlighted map tool tells you what clicking or dragging will do. Switch back to <strong>Pan Map</strong> when you only want to look around.</p><p>Once the roster and positions are ready, choose <strong>Begin Combat</strong>. Review the live view before <strong>Engage Clock</strong>.</p>`, 'combat-surface', 'Overview'],
    ['Build and edit the arena', `<p>Choose one tool at a time. The highlighted button is your current action.</p><ul><li><strong class="help-check">Pan Map:</strong> move your view without editing.</li><li><strong>Paint Floor:</strong> lay out walkable space.</li><li><strong>Add Walls:</strong> create movement boundaries.</li><li><strong>Add Doors:</strong> add passages that can open or close.</li><li><strong>Erase Boundaries:</strong> remove a wall or door boundary.</li><li><strong>Move Characters:</strong> adjust starting positions during preparation.</li></ul><p>For walls, doors, or boundary erasing, click two adjacent floor squares. <strong>Automatic door</strong> is available with Add Doors. Use <strong>Expand Zone +2 Each Side</strong> when you need more room, and <strong>Terrain</strong> to choose the arena's appearance.</p><p class="help-reminder">Check the selected tool before clicking the map. Panning and editing are separate actions.</p>`, 'combat-arena', 'Arena Tools'],
    ['Choose combatants and starting positions', `<p>Select the PCs taking part. Their statistics come from their campaign characters.</p><h3>Add an NPC</h3><p>Under <strong class="help-check">Add NPC</strong>, choose a template and adjust that copy before pressing <strong>Add</strong>. Set its weapon, color, and Ally status as appropriate. <strong>Icon</strong> lets you choose its appearance.</p><p>For a new premade NPC, Physical and Mental statistics supply suggested HP, Move, and ATB Speed. You can override those values. See <strong>Characters Help</strong> for creating reusable templates.</p><h3>Place everyone</h3><p>Use <strong>Choose Starting Location</strong> and the arena placement controls. Check every marker; a character's starting position determines where they enter the fight.</p><p>Review the added NPC list before beginning. Remove unwanted copies or change their icons there. Editing this encounter's copy does not rewrite the original premade template.</p>`, 'characters-prepare', 'Combatants'],
    ['Fog of War and arena visibility', `<p><strong class="help-check">Fog of War</strong> limits what players can see. PCs share vision, and explored areas remain remembered. Remembering an area does not mean players can track enemies there forever.</p><p>Walls and closed doors affect routes and sight. Check your layout before starting, especially if a door is the only way into a room.</p><h3>Check what the party can see</h3><p>During combat, use <strong>Preview player fog</strong> to inspect visibility from the GM view. Grey areas are unexplored; dimmed areas are remembered.</p><p><strong>Reveal Squares</strong> lets you make chosen squares visible. Press <strong>Done Revealing</strong> when you have finished.</p><p class="help-reminder">The GM normally sees more than the players. Use the preview when checking whether a room or enemy has been revealed.</p>`, 'combat-fog', 'Visibility'],
    ['Run a surface encounter', `<p>When a character becomes ready, choose an available action. Movement, attacks, <strong>Aim</strong>, defensive actions, and items depend on the character's current situation. You handle NPC choices and can assist a disconnected PC.</p><h3>Follow an attack through</h3><p>Select the attacker’s action and target, then follow the requested to-hit and defense checks. If damage is needed, the attacker reviews and submits that roll too. Complete any GM confirmation shown before moving on.</p><p>For <strong>First Aid</strong>, follow its difficulty, skill check, and healing prompts. A healing result also needs confirmation and submission.</p><p>Choose movement destinations on the arena and let the app track the movement. Use the shared Delay pages when an action needs a custom wait.</p><h3>Pause, leave, or finish</h3><p><strong>Pause Everything</strong> stops play for a review. Browsing another tab does not end combat. Use <strong class="help-warning">End Combat</strong> and confirm when the encounter is actually over.</p>`, 'combat-live', 'Running Combat']
  ];
  const starship = [
    ['Starship Combat — ships and their crews', `<p>Choose <strong class="help-check">Starship Combat</strong> for encounters involving vessels. You prepare the space battlefield and the characters aboard each ship.</p><p>A ship's installed systems determine what it can do. Its crew still has physical locations, turns, and access to operating stations.</p><p>Choose the participating ships, review their crews, and arrange their starting positions. Then use <strong>Begin Combat</strong> and, when everyone is ready, <strong>Engage Clock</strong>.</p><p class="help-reminder">Use the Starships tab to build or refit a vessel. Combat preparation is where you decide which ships and crews enter this encounter.</p>`, 'combat-ships', 'Overview'],
    ['Select ships and deploy their crews', `<p>Select the participating PC-controlled and GM-controlled ships. Review the crew brought in with each selection rather than assuming every campaign character belongs in this battle.</p><p>Check the <strong>Controlled By</strong> selection. GM-controlled ships can represent enemies, allies, or neutral vessels; their role in the scene is your decision.</p><h3>Check starting locations</h3><p>Review which vessel each character is aboard. A character can only start on one ship; selecting them elsewhere changes their deployment. Added NPCs have a starting-ship dropdown.</p><p>After opening the encounter, check crew positions in the interior before engaging the clock. A floor location and an operating station are different positions.</p><p class="help-reminder">Crew assignment does not automatically seat someone at a console. Check the actual starting marker and station before beginning.</p>`, 'combat-ships', 'Ships & Crews'],
    ['Arrange the space battlefield', `<p>Use the highlighted action button to choose what you are moving.</p><ul><li><strong class="help-check">Move Ships:</strong> arrange participating vessels.</li><li><strong>Reposition Planets:</strong> move planetary objects.</li><li><strong>Reposition Objects:</strong> move other supported space objects.</li></ul><p>To add an object, choose it and press <strong>Place on Map</strong>, then select its location. <strong>Cancel Placement</strong> exits that action. Expand <strong>Objects on map</strong> to review what you have placed.</p><p>Use zoom, <strong>Fit Map</strong>, and <strong>Enlarge Map</strong> to check the battlefield. Leave enough room for the encounter you intend to run.</p><p class="help-reminder">Arranging starting positions during preparation is different from issuing piloting commands during combat.</p>`, ['combat-space','combat-objects'], 'Space Map'],
    ['Stations, consoles, and crew locations', `<p>To use a ship system, a character needs access to the appropriate working equipment. Move through the interior and use the available station controls to take an operating position.</p><p><strong class="help-check">Console View</strong> opens that station's operating interface. <strong>Combat View</strong> returns to the battlefield. Switching views does not move the character or leave their station.</p><h3>What a station can do</h3><p>The installed SIC determines its controls: piloting at the Bridge, firing weapons, using sensors, managing shields, or operating specialized equipment. Some systems work automatically and do not have a dedicated console.</p><p>If a control is unavailable, check the character's position, the equipment's condition and power, and the console's instructions. Where required, leave the station before choosing an ordinary character action.</p><p>See <strong>Starships Help</strong> and its shared creation guide for installing equipment and preparing a functional ship.</p>`, 'combat-station', 'Stations & Consoles'],
    ['Run a starship encounter', `<p>Use each character's turn and station to operate the ship. Piloting commands depend on its propulsion; weapons, sensors, and shields depend on the equipment installed and ready to use.</p><h3>Follow the console prompts</h3><p>Choose a target or operation, review its requirements, and confirm. Some operations need preparation, travel, or recovery time. Let their own controls manage those steps; a custom Delay does not replace them.</p><p>For attacks, finish each requested accuracy and damage step. Players use <strong class="help-check">Confirm and Submit</strong>. If a player disconnects, use the pending roll panel's GM recovery controls to continue.</p><h3>Manage the opposing ships</h3><p>You direct GM crews and vessels. Where NPC automation is enabled, monitor its actions and use the available manual controls when the scene needs your attention.</p><p><strong>Pause Everything</strong> gives you time to review. <strong>Combat View</strong> or another campaign tab changes what you see; <strong class="help-warning">End Combat</strong> ends the encounter after confirmation.</p>`, 'combat-space', 'Running Combat']
  ];
  const shots = {
    "combat-station": {"file":"help-starships-console.webp","w":1881,"h":1047,"alt":"Actual Bridge console preview with navigation and equipment controls","caption":"This is the Bridge Console Preview. Live operation needs a character at an eligible working station.","width":900,"gutter":0,"marks":[]},
  "combat-prepare": {
    "file": "help-combat-prepare.webp",
    "w": 1225,
    "h": 293,
    "alt": "Surface and Starship selectors, Save Arena, Load Arena and checkpoint controls",
    "caption": "Choose the battlefield type. Save Arena exports a setup; the checkpoint controls recover combat progress.",
    "width": 900,
    "gutter": 0,
    "marks": []
  },
  "combat-surface": {
    "file": "help-combat-surface.webp",
    "w": 1193,
    "h": 538,
    "alt": "Surface preparation with an automatic door between adjacent floor squares",
    "caption": "This example uses Add Doors. Click two adjacent floor squares to place the boundary.",
    "width": 900,
    "gutter": 0,
    "marks": []
  },
  "combat-arena": {
    "file": "help-combat-arena.webp",
    "w": 1193,
    "h": 128,
    "alt": "Surface editor toolbar with Add Doors selected and Automatic door enabled",
    "caption": "The highlighted tool changes what a map click does. The instruction below it explains the next step.",
    "width": 900,
    "gutter": 0,
    "marks": []
  },
  "combat-live": {
    "file": "help-combat-live.webp",
    "w": 1238,
    "h": 641,
    "alt": "Paused surface encounter with clock controls and a disconnected PC turn",
    "caption": "The GM can act for this disconnected PC. Engage Clock resumes timing; End Combat finishes the encounter.",
    "width": 900,
    "gutter": 0,
    "marks": []
  },
  "combat-fog": {
    "file": "help-combat-fog.webp",
    "w": 765,
    "h": 537,
    "alt": "GM Preview player fog and Reveal Squares beside the surface arena",
    "caption": "Preview player fog shows the party’s view. Reveal Squares lets the GM make chosen squares visible.",
    "width": 850,
    "gutter": 0,
    "marks": []
  },
  "combat-delay": {
    "file": "help-combat-delay.webp",
    "w": 910,
    "h": 657,
    "alt": "Delay Console showing a negative Situation adjustment and positive Quality adjustment",
    "caption": "Blue arcs slow this example; green arcs speed it up. Delay Rate is not seconds remaining.",
    "width": 900,
    "gutter": 230,
    "marks": [
      [
        "Choose delay type",
        137,
        725,
        137
      ],
      [
        "Read the rate",
        55,
        852,
        55
      ],
      [
        "Confirm",
        619,
        495,
        619
      ]
    ]
  },
  "combat-queued": {
    "file": "help-combat-queued.webp",
    "w": 851,
    "h": 681,
    "alt": "Configure Queued Effect with its own effect name, Delay Rate and confirmation",
    "caption": "This second panel sets the effect that starts after the initial setup has been resolved.",
    "width": 850,
    "gutter": 230,
    "marks": [
      [
        "Effect name",
        159,
        790,
        159
      ],
      [
        "Confirm effect",
        641,
        470,
        641
      ]
    ]
  },
  "combat-ships": {
    "file": "help-combat-ships.webp",
    "w": 591,
    "h": 466,
    "alt": "Selected Protos and White Dwarf with control settings and Protos crew",
    "caption": "Selecting Protos brings Nova and Orion aboard. Review crew and control settings before beginning.",
    "width": 850,
    "gutter": 0,
    "marks": []
  },
  "combat-space": {
    "file": "help-combat-space.webp",
    "w": 566,
    "h": 465,
    "alt": "Space preparation map with separate movement modes, two ships, a planet and an asteroid",
    "caption": "Move Ships, Reposition Planets and Reposition Objects keep their actions separate.",
    "width": 850,
    "gutter": 0,
    "marks": []
  },
  "combat-objects": {
    "file": "help-combat-objects.webp",
    "w": 566,
    "h": 449,
    "alt": "Add space object form and expanded Objects on map list",
    "caption": "Place on Map starts placement. Objects on map lists the objects already placed.",
    "width": 850,
    "gutter": 0,
    "marks": []
  }
};
  root.SACombatHelpContent={shared,surface,starship,shots};
})(window);
