(function(root){
  'use strict';
  // GM-only content; rendered by the existing campaign Help dialog.
  const shared = [
    ['Combat — Prepare, then run the encounter', `<p>Choose <strong class="help-check">Surface Combat</strong> for fighting on foot, or <strong class="help-check">Starship Combat</strong> for ships and their crews.</p><p>Choose who is taking part and arrange the battlefield. <strong>Begin Combat</strong> opens the encounter; <strong>Engage Clock</strong> starts its timing.</p><p>The next few pages cover shared controls. After those, choose Surface or Starship Combat for its walkthrough.</p>`, 'combat-prepare', 'Overview'],
    ['Preparation, saves, and recovery', `<p><strong class="help-check">Save Preparation &amp; Return to Campaign</strong> keeps your unfinished setup for later.</p><p><strong>Save Arena</strong> downloads a reusable battlefield and starting roster. <strong>Load Arena</strong> reviews it before replacing the preparation draft. Check the PC assignments and starting positions.</p><p><strong>Resume Encounter</strong> returns to an existing battle. <strong>Start New Encounter</strong> prepares its replacement.</p><p>For a mistake, use <strong>Reset</strong> or <strong>Undo</strong> when available. For a larger problem, use <strong>Restore Latest</strong> or <strong>Choose Earlier Checkpoint</strong>. Checkpoint recovery backs up the current campaign and restores combat paused.</p><p class="help-warning">Recovery rolls back progress. To finish a battle normally, use <strong>End Combat</strong>.</p>`, 'combat-prepare', 'Preparation & Saves'],
    ['The clock, turns, and missing results', `<p>ATB meters show who is getting ready. When a PC is ready, their <strong>Command Window</strong> gives them time to choose an action.</p><p><strong class="help-check">Engage Clock</strong> starts play and announces <strong>ALL HANDS ON DECK</strong> to everyone. The banner�s small X dismisses it early on your screen. <strong>Pause Everything</strong> gives you time to review.</p><p>Roll prompts take turns. A waiting notice tells you who needs to act next. Players finish each requested roll with <strong>Confirm and Submit</strong>; <strong>Retry Submit</strong> keeps the same result if sending fails.</p><p>If a player disconnects, use the pending step’s <strong>Resolve … for Player</strong> control. First Aid and ship roll panels also offer GM recovery controls.</p>`, 'combat-live', 'Clock & Recovery'],
    ['Choose the right delay', `<p>The <strong class="help-check">Delay Console</strong> handles custom waiting periods.</p><ul><li><strong>Reload/Recovery:</strong> wait before acting again.</li><li><strong>Delayed Resolution:</strong> wait, then pause for you to resolve an action.</li><li><strong>Queued Effect:</strong> finish setup first, then let an effect count down while the character works toward another turn.</li></ul><p>When a delayed action or effect becomes ready, resolve it and press <strong>Pass</strong>.</p><p>Use installed equipment’s own console for its operations. A custom delay’s name is your reminder of what to resolve.</p>`, 'combat-delay', 'Delay Types'],
    ['Use the Delay Console', `<ol><li>Press <strong class="help-check">Pause Everything</strong> and open the character’s <strong>Delay</strong> control.</li><li>Choose the delay type and name the action or effect.</li><li>Choose a starting speed, then adjust the arcs to suit the situation, equipment, and execution.</li><li>Press <strong>Confirm Delay</strong>, or <strong>Confirm Changes</strong> for an existing delay. Queued Effects have a second setup panel.</li></ol><p>Click the left side of an arc to lower it or the right side to raise it. <strong>Execution (Crit)</strong> toggles the critical bonus.</p><p class="help-reminder"><strong>Higher Delay Rate means faster completion.</strong></p><p>Ready for the battlefield? Choose <strong>Surface Combat</strong> or <strong>Starship Combat</strong> above.</p>`, ['combat-delay','combat-queued'], 'Using Delay']
  ];
  const surface = [
    ['Surface Combat — set the scene', `<p>Choose <strong class="help-check">Surface Combat</strong>, lay out the arena, and select the characters and NPCs taking part.</p><p>Use the highlighted map tool to paint floor, add walls and doors, or move starting positions. Switch to <strong>Pan Map</strong> to look around.</p><p>Once everyone is placed, press <strong>Begin Combat</strong>. Review the live map before <strong>Engage Clock</strong>.</p>`, 'combat-surface', 'Overview'],
    ['Build and edit the arena', `<p>Choose the highlighted tool for the change you want:</p><ul><li><strong>Paint Floor:</strong> lay out walkable space.</li><li><strong>Add Walls / Add Doors:</strong> click two adjacent floor squares to place a boundary. Doors can be automatic.</li><li><strong>Erase Boundaries:</strong> remove a wall or door.</li><li><strong>Move Characters:</strong> adjust starting positions.</li></ul><p><strong>Expand Zone +2 Each Side</strong> gives you more room. <strong>Terrain</strong> changes the arena’s appearance.</p>`, 'combat-arena', 'Arena Tools'],
    ['Choose combatants and starting positions', `<p>Select the PCs taking part, then add NPCs from <strong class="help-check">Add NPC</strong>. Choose a template, adjust its encounter copy, and press <strong>Add</strong>.</p><p>Set its weapon, color, Ally status, and <strong>Icon</strong>. Characters Help explains how to make reusable NPC templates.</p><p>Use <strong>Choose Starting Location</strong> and the map placement tools to put everyone where the scene begins. Review the added NPC list before starting.</p>`, 'characters-prepare', 'Combatants'],
    ['Fog of War and arena visibility', `<p><strong class="help-check">Fog of War</strong> gives PCs shared vision and remembers explored areas.</p><p>Use <strong>Preview player fog</strong> to check their view: grey areas are unexplored, and dim areas are remembered. Walls and closed doors affect sight.</p><p><strong>Reveal Squares</strong> exposes chosen areas. Press <strong>Done Revealing</strong> when finished.</p>`, 'combat-fog', 'Visibility'],
    ['Run a surface encounter', `<p>When a character is ready, choose an action and follow its prompts. You control NPCs and can help a disconnected PC.</p><h3>Attacks</h3><p>Choose the action and target. The defender rolls first, then the attacker rolls To-Hit. If the attack connects, the attacker submits damage. Finish the GM damage confirmation when shown.</p><p><strong>First Aid</strong> follows its check and healing prompts in the same way.</p><h3>Movement</h3><p><strong>Direct Route</strong> chooses a route to one destination. <strong>Custom Route</strong> lets you click or tap points along the way, then confirm the whole route. Use <strong>Undo Last Point</strong> to correct it.</p><p>Melee’s movement bonus uses the final straight stretch before the attack, capped by Move Speed.</p><p>Use <strong>Pause Everything</strong> for a break and <strong>End Combat</strong> when the encounter is over.</p>`, 'combat-live', 'Running Combat']
  ];
  const starship = [
    ['Starship Combat — ships and their crews', `<p>Choose <strong class="help-check">Starship Combat</strong> for a battle involving vessels and their crews.</p><p>Select the ships, check who is aboard, and arrange their starting positions. Crew operate the equipment installed in each ship.</p><p>Press <strong>Begin Combat</strong>, then <strong>Engage Clock</strong> when everyone is ready.</p>`, 'combat-ships', 'Overview'],
    ['Select ships and deploy their crews', `<p>Select the participating ships and review their crews. <strong>Controlled By</strong> identifies who operates each vessel.</p><p>Check each character’s starting ship; selecting them on another ship moves their deployment. Added NPCs also have a starting-ship dropdown.</p><p>Before engaging the clock, check the crew’s interior positions and place operators at the stations they will use.</p>`, 'combat-ships', 'Ships & Crews'],
    ['Arrange the space battlefield', `<p>The highlighted map tool chooses what you move: <strong class="help-check">Move Ships</strong>, <strong>Reposition Planets</strong>, or <strong>Reposition Objects</strong>.</p><p>To add an object, select it, press <strong>Place on Map</strong>, and choose a location. Expand <strong>Objects on map</strong> to review the scene.</p><p>Use zoom, <strong>Fit Map</strong>, and <strong>Enlarge Map</strong> to check the battlefield before beginning.</p>`, ['combat-space','combat-objects'], 'Space Map'],
    ['Stations, consoles, and crew locations', `<p>Move a character to an operating station and open <strong class="help-check">Console View</strong>. The installed equipment provides the available controls.</p><p><strong>Combat View</strong> returns to the battlefield. To move through the interior, use Move; <strong>Custom Route</strong> lets you choose intermediate points.</p><p>If a system is unavailable, check the character’s position, power, and equipment condition. See <strong>Starships Help</strong> for construction and refitting.</p>`, 'combat-station', 'Stations & Consoles'],
    ['Run a starship encounter', `<p>On a crewmember’s turn, use their station to pilot, fire weapons, scan, or operate other equipment.</p><p>Choose an operation, review its requirements, and confirm. Follow each roll prompt through <strong class="help-check">Confirm and Submit</strong>. The pending roll panel lets the GM take over if a player disconnects.</p><p>In navigation, <strong>Custom Route</strong> lets you click or tap intermediate destinations before confirming.</p><p>Direct the opposing crews, or monitor their actions where NPC automation is enabled. Use <strong>Pause Everything</strong> to review and <strong>End Combat</strong> to finish.</p>`, 'combat-space', 'Running Combat']
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
