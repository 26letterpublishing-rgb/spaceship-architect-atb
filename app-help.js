(function(){
  'use strict';
  const gm=Boolean(document.getElementById('saveCampaignBackup'));
  const pages={
    campaign:[
      [gm?'Campaign — Build and Explore Your Universe':'Campaign — Explore Your Universe',gm?
        "<p>Use <strong class=\"help-check\">Campaign</strong> to build your universe and follow the party through it.</p><p>The location bar runs from <strong>Sector → Star System → Planet → Region</strong>. Click a section to open that view. The glow shows the map you are viewing; the red pin shows where the party is.</p><p>Choose a highlighted map tool before interacting with the map. <strong>Pan Map</strong> moves your view; the other tools edit locations or move ships and markers.</p><p>Scroll or use <strong>+ / −</strong> to zoom. <strong>Fit Map</strong> restores the framing, and <strong>Enlarge Map</strong> fills the workspace. Use the yellow <strong>Return to Campaign</strong> button to return.</p>":
        `<p>The <strong class="help-check">Campaign</strong> tab shows the maps and destinations your GM has made available. Use it to read location information, follow your party, and plan travel.</p><h3>Read the location bar</h3><p>The four sections are <strong>Sector → Star System → Planet → Region</strong>. The glowing section identifies your current map view. The tiny red pin identifies the party’s location. Empty or disabled sections are not currently available.</p><p class="help-reminder"><strong>Changing your view does not move your character, party, or ship.</strong> Some views become available only after travel or a GM change.</p><p>Drag empty space to pan, scroll or press <strong>+ / −</strong> to zoom, and use <strong>Fit Map</strong> to frame the map. <strong class="help-check">Enlarge Map</strong> fills the workspace; <strong>Return to Campaign</strong> restores the normal view.</p><p>The <strong>envelope beside Help</strong> opens Private Notes. Read GM messages, travel decisions, rewards, and other notices there, or send a private message to your GM.</p>`,gm?'campaign-gm-overview':'campaign-pc-overview','Overview'],
      [gm?'Galaxy Maps — Create, Inspect, and Navigate':'Galaxy Maps — Explore Known Stars',gm?
        "<p>Open <strong class=\"help-check\">Map options</strong> to create, save, or load a Galaxy Map. Use the map dropdown to switch between galaxies.</p><p>Press <strong>Add Star</strong>, click an empty hex, and name it. Then choose a tool:</p><ul><li><strong>Inspect Stars:</strong> read a star’s details.</li><li><strong>Edit Stars:</strong> change its name, description, or visibility.</li><li><strong>Reposition Stars:</strong> drag stars to new positions.</li><li><strong>Move Ships:</strong> directly place the selected ship.</li></ul><p><strong>Star directory</strong> helps you find a destination. <strong>Edit Solar System</strong> opens the objects around a star.</p><p><strong>Change Distances</strong> changes the travel scale and fuel needed. Finish current journeys on that map first. <strong>PC Map Visibility</strong> controls the views available to players.</p>":
        `<p>The Galaxy Map shows the stars your GM has made available. Its dropdown selects an available map; <strong class="help-check">Star directory</strong> lists its visible stars.</p><h3>Inspect a destination</h3><p>Click a star to read its public description and listed planets. Selecting a star only inspects it. To travel, select your ship, open <strong>Ship &amp; travel</strong>, and use <strong>Review Journey</strong>. Page 5 explains fuel and departure.</p><p><strong>Find Ship</strong> centers the chart on your selected ship. <strong>Enter Star System</strong> opens the system at your ship’s current star when available.</p><h3>Read the distance scale</h3><p>The displayed scale tells you how many light-years each hex represents. One <strong class="help-reminder">parsec</strong> is displayed as <strong>3.26 light-years</strong>, but the GM can give a map a different scale.</p><p class="help-reminder">An unavailable map level or destination may reflect GM visibility settings or the party’s current location. Returning to the Galaxy Map is not a way to leave a planet.</p>`,gm?'campaign-star-details':null,'Galaxy Maps'],
      ['Star Systems — Planets and Orbits',gm?
        "<p>Select a star, then <strong class=\"help-check\">View [star name] System</strong> to open its map.</p><h3>Build the system</h3><p>Use <strong>Edit Solar System</strong> to add planets. Choose Large, Small, or Moon; a Moon starts with lunar artwork and terrain.</p><p>In <strong>Edit Planets</strong> mode, click a planet to change its size, name, description, or appearance. <strong>Browse Planets</strong> offers the same editor and a way to open each surface. Choose <strong>Reposition Planets</strong> to drag planets instead.</p><p>When shrinking a planet, the app tries to preserve cities and regions. Review any warning before accepting a size that cannot fit them.</p><h3>Move a ship</h3><p><strong>Plot Travel</strong> plans a timed journey: choose the ship and destination, then <strong>Confirm Move</strong>. At a planet, use <strong>Enter Orbit</strong>.</p><p><strong>Move Ships</strong> is direct GM placement. Choose the ship, then click its new location or drag its marker.</p>":
        `<h3>Enter and explore a system</h3><p>At your ship’s current star, choose <strong class="help-check">Enter Star System</strong>. Select your ship, click a destination hex, and press <strong>Confirm Move</strong>. A crew member operating the ship must be stationed at its working Bridge. Movement within a system uses no warp fuel.</p><p>When the ship reaches a planet’s hex, use <strong>Enter Orbit · [planet]</strong>. In orbit, <strong>Leave Orbit</strong> returns the ship to the system view. Page 5 explains descent and departure.</p><h3>Revisit known planets</h3><p><strong class="help-check">Browse Planets</strong> lists available destinations. For visited planets, it includes the planet graphic, the GM’s public planet description, and <strong>Preview Surface</strong>, a small surface-map preview.</p><p class="help-reminder">A preview does not land the ship or reveal GM-only notes. Unvisited planets do not receive the same visited-planet preview controls.</p>`,gm?'campaign-system':'campaign-planets','Star Systems'],
      [gm?'Planetary and Regional Maps — Explore and Edit':'Planetary and Regional Maps — Explore Locations',gm?
        "<p>Select <strong class=\"help-check\">Paint Terrain</strong>, choose a brush, and paint the surface. City brushes add or erase settlement markers. <strong>Apply to all</strong> fills the map with the selected terrain after confirmation, keeping its locations and attachments. <strong>Undo Stroke</strong> reverses the last paint change.</p><p>Use <strong>Edit Locations</strong>, select a hex, and open <strong>Edit Location Details</strong> to add a name, description, secrets, or prepared content.</p><p>For a closer view, select a planetary hex and choose <strong>Create Region</strong>, or open its existing region with <strong>Enlarge Region</strong>.</p><p><strong>Move Markers</strong> lets you drag the party pin or use <strong>Move Party Here</strong>.</p><p><strong>Fit Map</strong> shows the planet’s full height. On a narrow screen, pan sideways to see the rest.</p>":
        `<h3>Inspect a hex</h3><p>Click a hex to select it, then <strong class="help-check">Read Location Details</strong> for its public description. City markers and named locations help identify places of interest.</p><p>Selecting a hex does not move the party. On the party’s current map, <strong>Travel Here</strong> sends a request to the GM. Page 5 explains approval and arrival.</p><h3>Open a regional map</h3><p>A region is a closer map associated with one planetary hex. <strong>View Region · [name]</strong> becomes available when the GM has brought the party into that region. Use the location bar to return to an available broader view.</p><h3>Move the view</h3><p>Drag to pan and scroll or press <strong>+ / −</strong> to zoom. Planet surfaces have fixed edges and do not wrap. <strong>Fit Map</strong> shows the full height; on narrow screens, pan horizontally to see the far side. For regions, it restores the normal framing.</p><p class="help-reminder">The party pin and parked ship are separate. Reading a location or panning the map does not bring your party aboard a ship.</p>`,gm?'campaign-terrain':null,'Surface & Region'],
      ['Travel — Journeys, Landing, and Boarding',gm?
        "<h3>Between stars</h3><p>Select the ship and destination, then open <strong class=\"help-check\">Ship &amp; travel → Review Journey</strong>. Check the drive, fuel, and travel time before <strong>Enter Warp</strong>. Players operate travel from the ship’s working Bridge.</p><p class=\"help-warning\">If fuel only covers part of the journey, the ship will stop short. Review the warning before departing.</p><h3>On the surface</h3><p>A player’s <strong>Travel Here</strong> request appears in your inbox. <strong>Approve Travel</strong> starts the party’s journey; <strong>Decline Travel</strong> turns it down.</p><h3>Land and return</h3><p>From orbit, use <strong>Descend</strong> when the ship has working landing equipment. After descent, the GM or initiating player chooses a hex and presses <strong>Land Here</strong>.</p><p>Reaching a parked PC ship boards the party near its airlock. Move a crewmember to the Bridge, then use <strong>Leave Atmosphere</strong> to return to orbit. A working Transporter provides another route through its <strong>Beam Down</strong> and <strong>Beam Aboard</strong> controls.</p>":
        `<h3>Travel between stars</h3><p>Select your ship and destination, then open <strong class="help-check">Ship &amp; travel → Review Journey</strong>. You must belong to the ship’s crew and be stationed at its working Bridge to initiate warp. Review distance, timing, and selected fuel before pressing <strong>Enter Warp</strong>.</p><p class="help-warning">If fuel covers only part of the route, acknowledge the warning to depart. The ship will stop between stars, short of the destination.</p><h3>Land on a planet</h3><p>Reach its system hex, <strong>Enter Orbit</strong>, then <strong>Descend</strong>. The ship needs working landing equipment and <strong class="help-check">a character stationed at the Bridge</strong>. After descent, the player who began it or the GM selects a hex and presses <strong>Land Here</strong>.</p><h3>Travel on foot and return aboard</h3><p>Choose a hex on the party’s current map and press <strong>Travel Here</strong>. The GM approves or declines; decisions arrive in the <strong>envelope beside Help</strong>. Approval starts a shared journey.</p><p>Reaching a parked PC ship’s location places the party aboard near its airlock. Open <strong>Starships</strong>, move to a working Bridge station, then use <strong>Leave Atmosphere</strong> when the ship can launch.</p><p>Transporter travel is an alternative when available. Follow the <strong>Beam Down to Planet’s Surface</strong> / <strong>Beam Aboard</strong> prompts; passenger location, crew, shields, and working equipment matter.</p>`,null,'Travel'],
      ['Locations, Discoveries, and Shops',gm?
        "<p>In <strong class=\"help-check\">Edit Location Details</strong>, write lore in <strong>Public description</strong> and keep secrets in <strong>GM-only information</strong>.</p><p>Attach an NPC roster, surface encounter, or Story Console file to a hex. Select the hex and press its <strong>Load</strong> button when you are ready. Loading an attached Story Console opens Script and adds new chapters.</p><p>Choose an <strong>Arrival shop</strong> or attach a saved Shop file. Confirm <strong>Open Shop</strong> when the party arrives to make it available.</p><p><strong>Location Files</strong> can also suggest a file to load on first arrival. Settings Help explains these reminders and Adventure Modules.</p><p class=\"help-warning\"><strong>Start Campaign Here</strong>, in Move Markers mode, saves the starting location and moves the party there now. Use <strong>Move Party Here</strong> for an ordinary relocation.</p>":
        `<h3>Read what the party discovers</h3><p>Select a location and use <strong class="help-check">Read Location Details</strong> for its public description. A planet’s general public description and surface preview are also available under <strong>Browse Planets</strong> after it has been visited.</p><p>Your GM may reveal additional clues through narration or Private Notes. The <strong>envelope beside Help</strong> shows private messages and notices; use it to reply to your GM. A <strong>Receive Reward</strong> button applies an offered resource reward once.</p><h3>Visit a shop</h3><p>Some locations have an associated shop. Reaching the location prompts the GM to make it available. Open the <strong class="help-check">Shop</strong> tab to browse available equipment and purchase it. See Shop Help for departments, prices, and purchasing.</p><h3>When a view is unavailable</h3><p>A campaign can begin on a planet or inside a region. Broader map views may remain unavailable until the party departs or the GM changes access. Ask your GM about the next destination; inspecting maps does not relocate the party.</p>`,gm?'campaign-location-editor':null,'Locations & Shops']
    ],
    characters:gm?[
  [
    "Characters — Manage Your Cast",
    "<p><strong class=\"help-check\">Characters</strong> brings together your PCs, allied NPCs, and reusable <strong>Premade NPCs</strong>.</p><p>Use the roster to see who is connected, open a sheet, or give a class-specific reward. Allied NPCs appear with the PCs; premade templates stay below the roster.</p><p>NPCs use simplified Physical and Mental statistics. Create a template here, then add copies to encounters from <strong>Prepare Combat</strong>.</p>",
    "characters-overview",
    "Overview"
  ],
  [
    "Player Characters and the Roster",
    "<p>Click <strong class=\"help-check\">View Sheet</strong> to inspect a character. For corrections, open <strong>GM Settings → Adjust Character</strong>.</p><p>Each card shows connection status, ATB Speed, Command Window, and how many private notes the player has read. <strong>Character Password</strong> can help a player regain access; share it privately.</p><p>Ally NPC sheets show their simplified statistics. Assign their ship crew under <strong>Starships</strong>.</p><h3>Class rewards</h3><p>Eligible characters have their class reward button on the card: Playboy / Minx, Psychopath, or Peacekeeper. Use it when the character meets the class condition; the app tracks session limits.</p>",
    "characters-roster",
    "Roster & Sheets"
  ],
  [
    "NPCs — Same Dice, Fewer Stats",
    "<p>NPCs have a <strong class=\"help-check\">Physical Attribute</strong> and <strong class=\"help-check\">Mental Attribute</strong>, each with a matching Skill.</p><p>The Attribute rating builds a dice pool. For example, a rating of 8 gives <strong>4D6</strong>. Skills add training to the check.</p><p>Physical stats handle actions such as attacking and dodging. Mental stats handle checks such as perception or resisting distress. Combat chooses the relevant pair and applies the action’s modifiers.</p><p>For an NPC action outside the combat controls, choose the appropriate pool and resolve it using the normal tabletop rules.</p>",
    "characters-stats",
    "NPC Dice"
  ],
  [
    "Premade NPCs and Encounters",
    "<p>Choose <strong class=\"help-check\">New NPC</strong>, then set its name, Physical and Mental stats, weapon, color, and Ally status.</p><p>The stats suggest <strong>ATB Speed</strong>, <strong>Move</strong>, and <strong>HP</strong>. Edit any of those directly to keep a manual value, or use <strong>Recalculate</strong> to return to calculated values.</p><p>Click <strong>Icon</strong> to choose any available character appearance.</p><p>Press <strong>Save Premade NPC</strong>. To revise a template later, select it and press <strong>Update Premade NPC</strong>.</p><p>In <strong>Prepare Combat → Add NPC</strong>, choose the template, adjust the encounter copy, and press <strong>Add</strong>. Its icon can also be changed in the added NPC list.</p>",
    "characters-prepare",
    "Create & Reuse"
  ],
  [
    "Character Files and the Drama Deck",
    "<h3>Roster files</h3><p><strong class=\"help-check\">Save</strong> downloads the campaign’s character and NPC roster. <strong>Save Selected NPCs</strong> exports only the templates you choose.</p><p><strong>Load</strong> lets you review a roster before adding it. Imported PCs receive new passwords; assign their crew in <strong>Starships</strong>. If the file was loaded before, choose <strong>Open current content</strong> or deliberately add a <strong>New Copy</strong>.</p><p>Use <strong>Save Campaign</strong> when you want to preserve the whole game and its progress.</p><h3>Drama Deck</h3><p>Click the <strong>Drama Deck</strong> badge to see the draw and discard counts. Click a discarded card to read it; <strong>Reshuffle</strong> returns discarded cards to the draw pile.</p>",
    "characters-deck",
    "Files & Drama"
  ]
]:[['Characters',"Your Character Sheet holds identity, attributes, skills, health, equipment, and advancement. During creation, follow Next Step, spend your starting points, and finish with Finalize. Purchased equipment is managed under Supplies; use the Shop to buy more.",'Identity  →  Attributes & Skills  →  Supplies']],
    starships:[['Starships and crew','Choose a ship to see its sheet and interior map. Crew assignments say who belongs to a ship; the map shows where they actually are. Select a destination to move, then confirm the route. Move onto a station and use Console View to operate it. Combat View returns to the encounter. Drag empty map space to reposition the view.','Ship  →  Crew  →  Station  →  Console'],['Building and resources',gm?'Create or load ships here, then assign PCs or NPCs as crew. In construction, purchase SICs, place them on legal hull cells, and confirm your changes. A SIC in Storage is owned but not installed. Read card restrictions before placing exterior equipment or adding stations.':'Your GM assigns ship crew. If you can upgrade a ship, purchase and place its equipment in construction, then Confirm Changes. Cancel Upgrade discards that unfinished edit. Fuel, minerals, and installed systems are shown on the ship sheet.'] ],
    prompt:[['Prompt / Give','First select the PCs in Recipients; each box uses that character’s ATB color. Direct Check asks them for an attribute and skill check; the results appear below after they confirm their dice.','Recipients  →  Action  →  Result'],['Awards, time, and records','Give Resources awards the selected resource and amount. Check whether you chose Personal or Group Credits. Recharge Items restores supported carried equipment. Pass Time advances campaign time and timed services outside active combat. Give Minerals selects a destination ship. Library entries become campaign reference material and are included in Save Campaign.']],
    combat:[['Prepare and begin combat',gm?'Choose Surface Combat for characters on an arena, or Starship Combat for ships and their crews. Add combatants, choose their starting locations, and arrange objects. The highlighted map action controls what a click or drag does. Surface preparation has Pan Map, Paint Floor, Add Walls, Add Doors, Erase Boundaries, and Move Characters. Starship preparation separates Move Ships, Reposition Planets, and Reposition Objects. Place on Map highlights the object being placed; Cancel Placement exits that action. Expand Objects on map to edit placed objects. Review the roster before Begin Combat; Engage Clock starts ATB progression.':'Your GM prepares the encounter. Watch your character’s ATB bar; when it fills, choose an available action. Select a target or movement destination and confirm. The clock pauses for requested dice.','Prepare  →  Begin Combat  →  Engage Clock'],['Actions and dice','Movement, attacks, Aim, items, and station controls become available when appropriate. Charges and recovery use active combat time. Roll when prompted, inspect the result, and Confirm and Submit. A displayed result is not sent until confirmed. If you are viewing a console, Combat View returns to the map. The GM can pause the clock and help disconnected players.']],
    shop:[['Shop','Create or load shops here. Edit availability and prices, then enable Available to let players purchase. Private messages and approvals are in the header mail window.']],
    inbox:[['Inbox','Review incoming messages, roll results, and approvals here. Select an entry to see its details. The unread count helps you find new information. Finish a requested action through its own confirmation controls before deleting the message.']],
    settings:gm?[
  [
    "Settings — Manage Your Campaign",
    "<p>Open the <strong class=\"help-check\">Settings gear</strong> to manage player access, correct characters, change campaign preferences, and work with saved content.</p><p><strong>Save Campaign</strong> in the header preserves your ongoing game. <strong>Export Adventure Module</strong> packages individually saved content for a new adventure.</p><p>Use <strong>Module Files</strong> and <strong>Arrival Reminders</strong> to bring prepared content into play when you need it.</p><p class=\"help-reminder\">Keep your Campaign Save and original Adventure Module together: one preserves progress, and the other holds packaged files you have not loaded yet.</p>",
    null,
    "Overview"
  ],
  [
    "Managing Players and Character Settings",
    "<p><strong class=\"help-check\">Adjust Character</strong> opens a sheet for GM corrections. <strong>Kick Player</strong> removes a character after confirmation.</p><p><strong>Universal Bonus</strong> adds time to every PC’s Command Window. Enter the extra seconds and press <strong>Save Command Window Bonus</strong>.</p><p>Choose a <strong>Campaign Banker</strong> to reserve Group Credit transfers for one character, or choose No Banker. Press <strong>Save Banker Rule</strong>.</p><p>Under <strong>Room and Players</strong>, you can link a player to an available character, retrieve a character password, or change the Room Code. Share passwords privately.</p><p><strong>Close Room</strong> ends the shared session while keeping its stored data. Save a portable backup before finishing an important session.</p><p>Use <strong>Adjust Time</strong> in Settings to set the displayed date or pause the in-universe clock.</p>",
    "settings-players",
    "Players & Characters"
  ],
  [
    "Display and Privacy Settings",
    "<p><strong class=\"help-check\">Interface Banner</strong> controls the header on this device: show it, hide only the Room Code, or hide the whole banner.</p><p><strong>Press banner to exit campaign</strong> makes the logo a shortcut back to the main menu.</p><p>For streaming, <strong>Hide Room Code from campaign screens</strong> conceals the code across GM and player screens. The eye button in Settings lets the GM reveal it.</p><p>If a code appears on one computer but not another, check that device’s Interface Banner preference as well as the campaign privacy setting.</p>",
    "settings-privacy",
    "Interface & Privacy"
  ],
  [
    "Preserving and Restoring Your Campaign",
    "<p><strong class=\"help-check\">Save Campaign</strong> downloads a <strong>.sa2campaign</strong> backup of your world and progress: characters, ships, scripts, shops, maps, and saved encounter state.</p><p><strong>Load Campaign</strong> restores that backup. It replaces newer progress for the same Room Code, so save the current game first if you may want to return to it.</p><h3>Moving to another computer</h3><p>Restore the Campaign Save, then use <strong>Module Files → Attach Module</strong> to choose the original <strong>.sa2module</strong>. Unused packaged files live in the browser’s Module library and are not included in the Campaign Save.</p><p><strong>Log Out</strong> leaves your GM screen. <strong>Close Room</strong> closes the session for everyone. <strong>Delete Campaign</strong> permanently removes the stored campaign after confirmation.</p>",
    "settings-campaign",
    "Save & Access"
  ],
  [
    "Creating a Reusable Adventure",
    "<p><strong class=\"help-check\">Export Adventure Module</strong> bundles individually saved files into a reusable <strong>.sa2module</strong>.</p><ol><li>Save your maps, stories, NPCs, shops, ships, and arenas using their own Save controls.</li><li>Open the exporter, enter the adventure details, and choose <strong>Add Saved Files</strong>.</li><li>Check <strong>Load at Start</strong> for the opening content only. Give starting Systems, Planets, and Regions the destinations requested by the form.</li><li>Press <strong>Export Module</strong>. If it refers to outside files, include them too.</li></ol><p>A Star System file already includes its planets and regions. A Planet includes its regions. Use a Galaxy’s <strong>Overview only</strong> save when you plan to load its systems later.</p><p>Starting shops arrive closed, ships need crew assignments, and an arena opens in preparation. Choose just one starting arena.</p><p>Use <strong>Load Campaign</strong> with the Module to begin a fresh adventure. Use <strong>Module Files → Attach Module</strong> to add its catalog to an existing campaign. To resume progress, load the Campaign Save.</p><p>After revising source files, export a new Module to include those changes.</p><p>For an optional branching adventure, enable <strong>Switch Toggles</strong> in Script. When saving a file, choose its default filename and a switch or elapsed-time condition under <strong>Adventure Module alternative</strong>. Package both versions; the first matching alternative is suggested when its file prompt is opened.</p>",
    "settings-export",
    "Export Module"
  ],
  [
    "Loading Adventure Content During Play",
    "<p>Open <strong class=\"help-check\">Module Files</strong> to review the catalog and load content as the adventure needs it.</p><p>In Script, <strong>Insert File Load</strong> creates a clickable reminder. Choose the save type and paste the filename; the extension is supplied. Clicking the keyword offers the matching Module file or a file chooser.</p><p>For a location, use <strong>Location Files → Configure Arrival Content</strong>. Enable <strong>Remind GM on first arrival</strong> for a prompt when the party arrives. <strong>Later</strong> keeps it in Arrival Reminders; <strong>Mark Handled</strong> clears it.</p><h3>Check where the file goes</h3><p>A System replaces the selected star’s system, preserving other stars. A Planet replaces the selected planet, and a Region targets the chosen surface hex. Galaxy loading can add a map or replace one. Review the destination before confirming.</p><p><strong>Open Current Content</strong> returns to a previous import. <strong>Load New Copy</strong> imports again, with the same destination replacement rules.</p><p><strong>Manage Campaign Content</strong> lets you export or remove old systems, NPC templates, and shops. Export anything you want to keep first. <strong>Restore Previous Map</strong> recovers the latest map saved before a supported replacement.</p>",
    "settings-files",
    "Content & Reminders"
  ]
]:[['Settings and campaign files',"Use Settings for sound and character or campaign preferences. Keep your character access code private. Your GM saves the shared campaign. Help is always available from the header and opens only when you press it."]],
    story:[
  [
    "Script: Prepare Your Story, Run Your Game",
    "<p>Use the <strong class=\"help-check\">Story Console</strong> as your GM notebook: scenes, dialogue, clues, and notes, organized into Chapters.</p><p>You can also put clickable checks in your story, ready to send when the players reach that moment.</p><ul><li><strong class=\"help-check\">Scripted Direct Check</strong> asks for a roll from a prepared spot in your script.</li><li><strong class=\"help-check\">Scripted Reward Check</strong> adds a success outcome, such as a private clue or reward.</li><li><strong class=\"help-quick\">Quick Check</strong>, at the bottom left, keeps frequently used rolls close at hand.</li></ul><p>For an immediate Direct Check, use <strong>Prompt / Give</strong>. See Prompt/Give Tab for details.</p>",
    "story-overview",
    "Introduction"
  ],
  [
    "Writing and Organizing Your Story",
    "<p>Write your scene in the <strong class=\"help-check\">Story Console</strong>. Use <strong>Chapters</strong> to separate locations or events, and choose the recipients above the editor.</p><p>Place the cursor where a roll belongs, then use <strong>Insert Scripted Check</strong>. A direct check appears as its Attribute + Skill; a reward check appears as its saved keyword. Click it during play to send the request.</p><h3>Keep your work</h3><p><strong>Quick Save</strong> saves into this campaign. <strong>Save</strong> downloads a portable Story Console file. <strong>Load</strong> replaces the current chapters after confirmation; loading a story attached to a map location adds new chapters instead.</p><p><strong>Insert File Load</strong> adds a keyword that helps you find and load a prepared file during play. Choose its save type and paste the filename; the tool supplies the extension. Settings Help explains Adventure Modules and file loading.</p>",
    "story-console",
    "Story Console"
  ],
  [
    "Creating Checks With Automatic Outcomes",
    "<p>A <strong class=\"help-check\">Scripted Reward Check</strong> is useful when success should reveal a clue or give something to the player.</p><ol><li>Name the keyword, such as <strong>FIND CACHE</strong>.</li><li>Choose its Attribute, Skill, and Difficulty.</li><li>Choose the success effect. For a clue, select <strong>Private Message</strong> and write what the character discovers.</li><li>Press <strong>Save Reward Check</strong>.</li></ol><p>Select the saved check in <strong>Insert Scripted Check</strong>, then press <strong>Insert Check</strong> to put its clickable keyword at the story cursor.</p><p>When you click the keyword, players receive the roll request. A confirmed success sends the private message or an inbox reward. Players collect rewards with <strong>Receive Reward</strong>.</p><p><strong>Send to Story Recipient</strong> sends the configured check immediately.</p><p>Creating an Adventure Module? Enable <strong>Switch Toggles</strong> to save a clickable switch keyword. Click it to turn a story outcome on or off; alternate file prompts can respond to that outcome or elapsed time.</p>",
    "story-keywords",
    "Scripted Reward Checks"
  ],
  [
    "Choosing the Right Check",
    "<p>Choose the tool that fits the moment:</p><ul><li><strong>Direct Check:</strong> an unexpected action. Send it from <strong>Prompt / Give</strong>; see that tab’s Help for details.</li><li><strong class=\"help-quick\">Quick Check:</strong> a familiar roll you ask for often. Open the pink button, choose a saved check, and send it.</li><li><strong class=\"help-check\">Scripted Direct Check:</strong> a planned roll. Insert it in your story and click it when needed.</li><li><strong class=\"help-check\">Scripted Reward Check:</strong> a planned roll with a clue or reward attached to success.</li></ul><p>Players roll and press <strong>Confirm and Submit</strong>. Review their results, then carry on with the scene.</p>",
    "story-rolls",
    "Understanding Checks"
  ]
]
  };
  if(gm)pages.starships=window.SAStarshipHelpContent.gmPages;
  if(gm)pages.prompt=[
  [
    "Prompt / Give - Work with your players",
    "<p>Use <strong class=\"help-check\">Prompt / Give</strong> to ask for rolls, reward the party, or update their resources.</p><p>Start with <strong>Recipients</strong>: choose individual characters, everyone, or just connected players.</p><ul><li><strong>Player Interaction:</strong> send Direct Checks.</li><li><strong>Rewards &amp; Supplies:</strong> give awards, restore HP and Exertion, recharge items, or deliver minerals.</li><li><strong>Campaign Tools:</strong> pass time, share Library information, and review discarded Drama Cards.</li></ul><p>The pink <strong class=\"help-quick\">Quick Check</strong> button stays available across the GM interface.</p>",
    "prompt-overview",
    "Overview"
  ],
  [
    "Direct Checks - Ask for a roll",
    "<p>Use a <strong class=\"help-check\">Direct Check</strong> when you need a roll now.</p><ol><li>Select the recipients.</li><li>Choose the Attribute and Skill.</li><li>Enter a Difficulty, or leave it blank to judge the result yourself.</li><li>Press <strong>Send Direct Check</strong>.</li></ol><p>Players see the Difficulty, roll, and press <strong>Confirm and Submit</strong>. Their confirmed results appear in <strong>Roll Results</strong>, highest first. Offline players can respond when they return.</p><p>For prepared checks inside your story, see <strong>Script Help</strong>.</p>",
    "prompt-direct",
    "Direct Checks"
  ],
  [
    "Quick Checks - Reuse a familiar roll",
    "<p>Open <strong class=\"help-quick\">Quick Check</strong> at the bottom left. Click a saved check in a character’s column, or under <strong>Everyone</strong>.</p><p>To make a shortcut, choose the roll, name the button, and select recipients inside this panel. Press <strong>Add to Quick Checks</strong>; leaving recipients empty saves it under Everyone. <strong>Send</strong> requests a roll without saving it.</p><h3>Reputation in conversation</h3><p><strong>Persuade Check</strong> can help with recognition and NPC attitude. <strong>Popularity</strong> asks whether the NPC recognizes the ship; <strong>Affinity / Bias</strong> records which Reputation traits they like or dislike.</p><p>Compare the <strong>Original</strong> result with <strong>With Reputation</strong> and choose what fits the scene.</p>",
    "prompt-quick",
    "Quick Checks"
  ],
  [
    "Rewards & Supplies - Give the party what they earned",
    "<p>Under <strong class=\"help-check\">Give Resources</strong>, select a resource and amount, choose recipients, then press <strong>Give Award</strong>. Players collect awards from their inbox with <strong>Receive Reward</strong>.</p><p>Use it for XP, Personal Credits, Reverence, Drama Cards, Attribute Points, or Skill Points. Group Credits go directly into the shared pool.</p><p><strong>Send Recharge</strong> restores supported equipment carried by the selected characters.</p><p class=\"help-warning\"><strong>Undo Most Recent Award</strong> restores the previous resource values, so use it promptly before later changes would be overwritten.</p>",
    "prompt-awards",
    "Rewards"
  ],
  [
    "Restore HP / Exertion - Help characters recover",
    "<p><strong class=\"help-check\">Restore HP / Exertion</strong> lets you make a direct adjustment.</p><p>Select the PCs, enter how much to restore, and press <strong>Restore Selected PCs</strong>. Or choose <strong>Restore both to maximum</strong>. This applies immediately without advancing time.</p><h3>When the party rests</h3><p>A PC requests <strong>Rest</strong> from their sheet. In your inbox, approve that character or all PCs, or deny the request.</p><p>Approval advances eight hours, restores Exertion, and heals HP equal to Health Rating. Rest in a working Medbay restores maximum HP.</p>",
    "prompt-restore",
    "HP / Exertion"
  ],
  [
    "Campaign Tools - Time, supplies, and discoveries",
    "<p><strong class=\"help-check\">Pass Time</strong> moves the campaign forward outside active combat. Enter a duration and confirm. Journeys, crafting, healing, and other timed activities advance with it; follow any event prompts that appear.</p><p>To deliver minerals, open <strong>Rewards &amp; Supplies → Give Minerals</strong>, choose a ship, and enter the mineral and quantity.</p><p><strong>Send to Library</strong> shares discoveries or mission notes with a ship’s Library. Choose the destination, write the entry, and send it. Assigned PCs get an inbox notice.</p><p><strong>Crew Logs &amp; Library Data</strong> lets you review submitted logs or share a reference across Libraries.</p>",
    "prompt-tools",
    "Campaign Tools"
  ],
  [
    "Drama Cards - Review and reward",
    "<p>Open <strong class=\"help-check\">Campaign Tools → Drama Card Discard Pile</strong> to read played cards. <strong>Reshuffle</strong> returns them to the draw pile.</p><p>To award new cards, use <strong>Give Resources → Drama Card</strong>. Choose recipients and an amount, then <strong>Give Award</strong>. Players collect the cards from their inbox.</p><p>For a quick Reverence award, use <strong>+1 Reverence</strong> in a character’s <strong class=\"help-quick\">Quick Check</strong> column or under Everyone.</p>",
    "prompt-drama",
    "Drama & Shortcuts"
  ]
];
  if(gm)pages.shop=[
  [
    "Shop — Manage what players can buy",
    "<p>Use <strong class=\"help-check\">Shop</strong> to prepare merchants, choose their stock and prices, and decide when players can buy from them.</p><p>Several shops can be <strong>Available</strong> at once. Players get the lowest available price for each item.</p><p><strong>Everything</strong> offers the standard catalog at standard prices. Open it when that suits the campaign; close it when your custom merchants should set the prices.</p><p><strong>Equipment Catalog</strong> lets you read SIC and weapon cards, including supported Console Previews. Players can browse these cards even when no open shop sells them.</p>",
    "shop-overview",
    "Overview"
  ],
  [
    "Create, save, and load shops",
    "<p>Enter a name in <strong class=\"help-check\">Edit Shop</strong>, choose stock and prices, then press <strong>Apply Changes</strong>. New shops start closed.</p><p>For an existing merchant, use <strong>Edit Availability / Prices</strong>.</p><p><strong>Save Shop</strong> downloads a reusable <strong>.sa2shop</strong> file. These files can also go into an Adventure Module.</p><p><strong>Load Shop</strong> opens a review. Check <strong>Open shop for players now</strong> if you want to start trading immediately. For a previously loaded file, open its current content or choose <strong>Load New Copy</strong>.</p>",
    "shop-editor",
    "Create & Files"
  ],
  [
    "Stock — Choose what the merchant offers",
    "<p>Under <strong class=\"help-check\">Availability</strong>, select what this merchant offers from SICs, Weapons, and Items.</p><p>Start with department or category checkboxes, then expand a category to refine individual choices. <strong>Find item</strong> searches names and categories.</p><p>Use a preset for a starting selection, such as <strong>Weapons &amp; Ammunition</strong> or <strong>Medical Supplies</strong>. Presets replace stock selections while keeping your prices.</p><p><strong>Maximum SIC Level</strong> limits numbered models. Leave it blank for no limit, then press <strong>Apply Changes</strong>.</p>",
    "shop-stock",
    "Stock"
  ],
  [
    "Prices — Set markups and discounts",
    "<p>Under <strong class=\"help-check\">Prices</strong>, choose the whole shop, a category, or an item. Enter a positive percentage for a markup or a negative one for a discount.</p><p>The most specific rule wins: <strong>item → category → whole shop</strong>. For example, an item’s discount replaces the general markup.</p><p><strong>Reset to 0%</strong> gives standard pricing. <strong>Use inherited price</strong> removes an override so the broader rule applies again.</p><p>Check <strong>Preview final prices</strong>, then press <strong>Apply Changes</strong>. Remember that a cheaper offer from another open shop takes priority.</p>",
    "shop-prices",
    "Prices"
  ],
  [
    "Open shops and guide player purchases",
    "<p>Set a shop to <strong class=\"help-check\">Available</strong> when the party can trade there, and close it when access ends.</p><p>A location’s <strong>Arrival shop</strong> offers to open it when the party arrives. In Script, a loaded shop’s keyword activates that shop; <strong>Insert File Load</strong> instead helps you load a prepared file.</p><p>Players can browse every SIC and weapon card. Purchasing becomes available when an open shop sells the item and the player can pay.</p><p>SICs go into the chosen ship’s storage for installation. See <strong>Starships Help</strong> for building and refitting.</p><p>Purchase notices let you review the transaction. <strong>Approve</strong> clears the notice; <strong>Deny</strong> uses the purchase reversal controls.</p>",
    "shop-player",
    "Access & Purchases"
  ]
];
  if(!gm&&window.SAPCHelpContent)Object.assign(pages,window.SAPCHelpContent);
  function open(requestedTopic){
    const opener=document.activeElement;
    let host=window;try{while(host.parent!==host&&host.parent.document)host=host.parent;}catch{}
    const doc=host.document;
    if(doc.getElementById('sa-app-help'))return;
    const key=typeof requestedTopic==='string'?requestedTopic:gm?document.querySelector('.gm-tab.active[data-tab-panel]')?.dataset.tabPanel:document.querySelector('[data-character-tab].active')?.dataset.characterTab;
    const topic=({roster:'campaign',sheet:'characters',atb:'combat',give:'prompt',prompts:'prompt',script:'story'})[key]||key||'campaign';
    const combat=topic==='combat'?(gm?window.SACombatHelpContent:window.SAPCCombatHelp):null;
    const sharedCount=combat?.shared.length||0;
    let combatType='surface',page=0;
    const remembered={shared:0,surface:0,starship:0};
    let content=combat?[...combat.shared,...combat[combatType]]:pages[topic]||pages.campaign;
    const rich=['story','campaign','characters','settings','starships','prompt','shop','combat'].includes(topic);
    const dialog=doc.createElement('dialog');dialog.id='sa-app-help';dialog.setAttribute('aria-label','Help');
    dialog.style.cssText='width:min(1000px,94vw);max-height:85vh;box-sizing:border-box;background:#382112;color:#fff1df;border:2px solid #cd843b;border-radius:14px;padding:20px;box-shadow:0 18px 90px #000c;font:15px/1.5 Arial,sans-serif';
    const style=doc.createElement('style');style.textContent='#sa-app-help::backdrop{background:#080401aa;backdrop-filter:blur(8px)}#sa-app-help button{font:inherit;color:#fff1df;background:#633810;border:1px solid #d8944c;border-radius:8px;padding:8px 16px;cursor:pointer}#sa-app-help button:disabled{opacity:.4;cursor:default}#sa-app-help p{margin:8px 0}#sa-app-help .help-check{color:#80ddff;font-weight:700}#sa-app-help .help-quick{color:#ff91cb;font-weight:700}#sa-app-help .help-warning{color:#ffb3a5}#sa-app-help .help-reminder{color:#ffdf77}#sa-app-help h3{font-size:17px;margin:16px 0 6px}#sa-app-help table{width:100%;border-collapse:collapse;font-size:14px}#sa-app-help th,#sa-app-help td{padding:6px 9px;border:1px solid #946138;text-align:left}#sa-app-help nav{display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px}#sa-app-help nav button{font-size:13px;padding:5px 9px}#sa-app-help nav button[aria-current=page],#sa-app-help nav button[aria-pressed=true]{background:#96601f;border-color:#ffcf78}#sa-app-help .combat-help-nav{position:sticky;top:-20px;z-index:3;background:#382112;padding:12px 42px 6px 0}#sa-app-help .combat-help-nav nav{margin-bottom:6px}#sa-app-help .combat-help-nav button:focus-visible{outline:2px solid #80ddff;outline-offset:2px}';
    style.textContent+='#sa-app-help .combat-help-nav{padding-top:0}#sa-app-help .combat-help-nav [data-combat-help-section]{position:relative;isolation:isolate;border:0;border-radius:0;min-height:44px;padding:9px 18px;font-weight:700;font-size:15px;color:#fff;background:#c28a40;clip-path:polygon(9px 0,calc(100% - 9px) 0,100% 9px,100% calc(100% - 9px),calc(100% - 9px) 100%,9px 100%,0 calc(100% - 9px),0 9px)}#sa-app-help [data-combat-help-section]::after{content:"";position:absolute;inset:2px;z-index:-1;clip-path:inherit;background:linear-gradient(120deg,#48301b,#161a21)}#sa-app-help .combat-help-nav [data-combat-help-section=starship]{background:#ac78ed;clip-path:polygon(0 0,calc(100% - 13px) 0,100% 50%,calc(100% - 13px) 100%,0 100%,7px 50%)}#sa-app-help [data-combat-help-section=starship]::after{background:linear-gradient(120deg,#302250,#13263b)}#sa-app-help [data-combat-help-section][aria-pressed=true]{background:#fff1c2}#sa-app-help [data-combat-help-section][aria-pressed=true]::after{inset:4px}#sa-app-help .combat-help-nav select{max-width:100%;padding:6px;background:#161c26;color:#fff;border:1px solid #ad9270;border-radius:4px;font:inherit}#sa-app-help .combat-help-nav label{display:block;font-size:13px;margin-bottom:6px}#sa-app-help .help-example{padding:10px;border:1px solid #a17c43;margin:12px 0}#sa-app-help .help-example summary{cursor:pointer;color:#ffe1a1;font-weight:bold}';
    dialog.append(style);const heading=doc.createElement('h2'),body=doc.createElement('div'),preview=doc.createElement('div'),footer=doc.createElement('footer');
    heading.style.cssText='margin:0 0 12px;font-size:22px';body.style.minHeight='0';preview.style.cssText='padding:10px;border:1px solid #bd8648;background:#21160f;text-align:center;color:#ffd494';
    footer.style.cssText='display:flex;align-items:center;gap:12px;margin-top:16px;flex-wrap:wrap;position:sticky;bottom:-20px;background:#382112;padding:12px 0;z-index:2';
    const prev=doc.createElement('button'),next=doc.createElement('button'),count=doc.createElement('span'),dismiss=doc.createElement('button');
    prev.textContent='Previous';next.textContent='Next';dismiss.textContent='Dismiss';dismiss.style.marginLeft='auto';
    const renderPreview=(label,target=preview)=>{
      target.replaceChildren();if(Array.isArray(label)){target.removeAttribute('role');target.removeAttribute('aria-label');for(const key of label){const part=doc.createElement('div');part.style.marginBottom='16px';target.append(part);renderPreview(key,part);}return;}target.setAttribute('role','img');target.setAttribute('aria-label',label||'');
      if(String(label||'').startsWith('ships-')){
        target.setAttribute('aria-label',window.SAStarshipHelpContent.shots[label]?.alt||label);target.append(window.SAStarshipGuide.figure(doc,label));
      }else if(/^(story|campaign|characters|settings|prompt|shop|combat|pc)-/.test(String(label||''))){
        const shots={
          ...(combat?.shots||{}),
          ...(window.SAPCHelpShots||{}),
"shop-overview":{"file": "help-shop-overview.png", "w": 1225, "h": 259, "alt": "GM shop list with Frontier Trading Post available and Everything closed", "caption": "Only Frontier Trading Post is open in this example. Everything remains optional.", "width": 900, "gutter": 0, "marks": []},
"shop-editor":{"file": "help-shop-editor.png", "w": 1225, "h": 143, "alt": "Edit Shop header and the Frontier Trading Post name field", "caption": "Use the form beneath the shop list. Apply Changes saves into the campaign; Save Shop exports a file.", "width": 900, "gutter": 0, "marks": []},
"shop-stock":{"file": "help-shop-stock.png", "w": 780, "h": 654, "alt": "Availability controls with SIC Level 2, Enable All and Exhaust Thruster search results", "caption": "Checked models above the SIC limit are still excluded. Searching filters the list without changing stock.", "width": 780, "gutter": 0, "marks": []},
"shop-prices":{"file": "help-shop-prices.png", "w": 385, "h": 492, "alt": "Ballistic Sidearm discount, inheritance controls and a price preview of 144 credits", "caption": "This item uses its own discount. Use inherited price returns it to the broader pricing rule.", "width": 700, "gutter": 230, "marks": [["Choose the scope", 89, 375, 89], ["Reset or inherit", 311, 300, 311], ["Check the result", 450, 350, 450]]},
"shop-player":{"file": "help-shop-player.png", "w": 1242, "h": 775, "alt": "Player Shop showing Frontier Trading Post and its weapon card stacks", "caption": "Players browse the merchandise offered by Available shops in their normal Shop tab.", "width": 900, "gutter": 0, "marks": []},
"prompt-overview":{"file": "help-prompt-overview.png", "w": 1256, "h": 582, "alt": "Prompt / Give recipients and the three tool groups", "caption": "Choose recipients, then expand the tool you need.", "width": 900, "gutter": 0, "marks": []},
"prompt-direct":{"file": "help-prompt-direct.png", "w": 1225, "h": 359, "alt": "Selected recipients with Perception, Awareness and Difficulty 10 in Direct Check", "caption": "Choose recipients above the form. The Difficulty is visible to players.", "width": 900, "gutter": 0, "marks": []},
"prompt-quick":{"file": "help-prompt-quick.png", "w": 746, "h": 590, "alt": "Quick Check composer, its own recipients and character and Everyone shortcuts", "caption": "Save a familiar check or send one now. This panel has its own recipients.", "width": 746, "gutter": 0, "marks": []},
"prompt-awards":{"file": "help-prompt-awards.png", "w": 606, "h": 572, "alt": "Give Resources and Recharge Items expanded in Rewards and Supplies", "caption": "Give Award sends a reward to collect. Send Recharge directly restores supported equipment.", "width": 650, "gutter": 0, "marks": []},
"prompt-restore":{"file": "help-prompt-restore.png", "w": 580, "h": 305, "alt": "Restore HP and Exertion with amount fields, full recovery checkbox and Restore Selected PCs", "caption": "Choose recipients above this card. Restore applies immediately without passing time.", "width": 850, "gutter": 240, "marks": [["Amounts to add", 158, 565, 158], ["Full recovery", 254, 160, 254], ["Apply restoration", 283, 200, 283]]},
"prompt-tools":{"file": "help-prompt-tools.png", "w": 587, "h": 217, "alt": "Pass Time amount, time unit and confirmation button", "caption": "Choose the duration, then click Pass Time to review and confirm.", "width": 700, "gutter": 0, "marks": []},
"prompt-drama":{"file": "help-prompt-drama.png", "w": 587, "h": 89, "alt": "Drama Card Discard Pile with its count and Reshuffle control", "caption": "Played cards appear here. Click a discarded card to read it.", "width": 700, "gutter": 0, "marks": []},
"settings-players":{"file":"help-settings-players.png","w":1060,"h":461,"alt":"Kick Player, Adjust Character, Command Window and Ship Credit Authority in GM Settings","caption":"Choose a character before using its controls. Save the Command Window bonus and banker rule separately.","width":900,"gutter":0,"marks":[]},
"settings-privacy":{"file":"help-settings-privacy.png","w":525,"h":230,"alt":"Streaming Privacy with a campaign-wide Hide Room Code checkbox and the GM reveal button","caption":"Streaming Privacy affects campaign headers. The eye reveals the code here in Settings.","width":800,"gutter":245,"marks":[["Hide on screens",99,500,99],["Reveal code",165,480,165]]},
"settings-campaign":{"file":"help-settings-campaign.png","w":525,"h":230,"alt":"Campaign storage card with Load Campaign, Export Adventure Module, Module Files and content-management controls","caption":"Load Campaign restores progress or starts a Module. Module Files attaches a catalog to the existing campaign.","width":800,"gutter":245,"marks":[["Load Campaign",99,170,99,70],["Module Files",147,146,147,126]]},
"settings-export":{"file":"help-settings-export.png","w":838,"h":919,"alt":"Adventure Module exporter with title, author, instructions, three saved files and selective Load at Start checkboxes","caption":"Sector and Arrival load at startup. Coral stays packaged until the GM chooses to import it.","width":900,"gutter":245,"marks":[["Starting content",424,165,424],["Load later",707,165,707],["Export package",862,430,862]]},
"settings-files":{"file":"help-settings-files.png","w":838,"h":704,"alt":"Module Files catalog with Arrival loaded and Sector and Coral not loaded, plus Attach Module","caption":"This example was attached to an existing campaign, so Load at Start did not run. Only Arrival was then imported.","width":900,"gutter":245,"marks":[["Imported Story",371,320,371],["Load shop",567,110,567],["Reattach source",665,169,648,686]]},
          "characters-overview":{"file": "help-characters-overview.png", "alt": "Characters roster with PCs, an Ally NPC, and the Premade NPC editor", "caption": "PCs and Ally NPCs appear in the roster. Premade NPCs stay beneath it.", "w": 1249, "h": 672, "width": 900, "gutter": 0, "marks": []},
          "characters-roster":{"file": "help-characters-roster.png", "alt": "PC roster card with status, ATB Speed, Command, Notes Read and View Sheet", "caption": "View Sheet opens the PC sheet. Ally NPCs use a simplified summary.", "w": 403, "h": 225, "width": 780, "gutter": 230, "marks": [["Status", 45, 397, 45], ["View Sheet", 205, 397, 205]]},
          "characters-stats":{"file": "help-characters-stats.png", "alt": "NPC editor with Physical and Mental statistics and calculated values", "caption": "Attribute ratings determine dice; Skills add training. Calculated fields can be overridden.", "w": 710, "h": 435, "width": 780, "gutter": 230, "marks": [["Physical stats", 215, 700, 215], ["Mental stats", 295, 700, 295], ["Recalculate", 410, 700, 410]]},
          "characters-prepare":{"file": "help-characters-prepare.png", "alt": "Prepare Combat NPC editor and a staged NPC with its Icon control", "caption": "Select a template, adjust the copy and Add it. The staged NPC also has an Icon button.", "w": 591, "h": 784, "width": 780, "gutter": 230, "marks": [["Select template", 38, 580, 38], ["Add copy", 570, 370, 570], ["Change icon", 704, 580, 704]]},
          "characters-deck":{"file": "help-characters-deck.png", "alt": "Drama Deck dialog with counts, discarded cards, Reshuffle and Close", "caption": "Click a discarded card to read it. Reshuffle returns discards to the draw pile.", "w": 900, "h": 378, "width": 900, "gutter": 230, "marks": [["Reshuffle", 120, 870, 120], ["Read a card", 240, 445, 240]]},
          'story-overview':{file:'help-script-preview.png',alt:'Complete Script tab, including Insert Scripted Check',caption:'A — Story Console · B — Scripted Reward Check · C — Insert Scripted Check',w:1584,h:1178,width:900,gutter:400,marks:[['A · Story Console',200,1540,200],['B · Reward Check',300,520,300],['C · Insert Check',1000,520,1000]]},
          'story-console':{file:'help-script-console.png',alt:'Story Console with recipients, chapter tabs and the clickable Find Cache command',caption:'A — Choose recipients · B — Organize chapters · C — Click the inserted command during play',w:1031,h:360,width:900,marks:[['A · Recipients',65,650,59],['B · Chapters',140,65,117,140],['C · Run check',280,514,280]]},
          'story-keywords':{file:'help-script-keywords.png',alt:'Find Cache reward check with keyword, success effect and Save Reward Check button',caption:'A — Name the keyword · B — Configure its success effect · C — Save Reward Check',w:516,h:644,height:690,width:740,marks:[['A · Keyword',204,504,204],['B · Success effect',277,504,277],['C · Save check',665,90,633,665]]},
          'story-rolls':{file:'help-script-rolls.png',alt:'Insert Scripted Check configured for Perception plus Awareness at difficulty 10, with Insert Check visible',caption:'A — Choose the check type · B — Insert it at the Story Console cursor',w:516,h:430,width:740,marks:[['A · Check type',90,504,90],['B · Insert Check',396,504,396]]},
          'campaign-gm-overview':{file:'help-campaign-gm-overview.png',alt:'GM Galaxy Map with location bar, map options, ship selector and enlargement controls',caption:'GM overview: location hierarchy above the map, with ship and travel controls beneath it.',w:1800,h:1000,width:900,gutter:0,marks:[]},
          'campaign-pc-overview':{file:'help-campaign-pc-overview.png',alt:'Player Galaxy Map with permitted navigation, Find Ship and Ship and travel',caption:'Player overview: available map views and travel controls. The party is still on Harbor in this example.',w:1800,h:1000,width:900,gutter:0,marks:[]},
          'campaign-star-details':{file:'help-campaign-star-details.png',alt:'Selected Haven star with Edit Details, Edit Solar System, View Haven System and Enter Star System',caption:'View Haven System lets the GM browse. Enter Star System uses the selected ship’s current star.',w:620,h:445,width:840,gutter:240,marks:[['Current star',364,584,364]]},
          'campaign-system':{file:'help-campaign-system.png',alt:'Haven System with its planets, Edit Solar System and Browse Planets',caption:'The system view shows orbital destinations. Browse Planets opens the planet directory.',w:1800,h:1000,width:900,gutter:0,marks:[]},
          'campaign-planets':{file:'help-campaign-planets.png',alt:'Player planet directory with Harbor artwork and Preview Surface; unvisited planets have name buttons',caption:'Visited Harbor has a graphic and a surface preview. Its public description has not yet been written in this example.',w:620,h:456,width:850,gutter:230,marks:[['Surface preview',302,587,302]]},
          'campaign-terrain':{file:'help-campaign-terrain.png',alt:'Paint Terrain mode with six terrain types, city brushes, Undo Stroke and Apply to all at the far right',caption:'Paint Terrain changes terrain. Apply to all confirms a whole-map fill and preserves locations. Edit Locations and Move Markers are separate modes.',w:1800,h:1000,height:145,cropTop:198,width:900,gutter:250,marks:[['Apply to all',62,1750,62],['Brushes',115,390,62]]},
          'campaign-location-editor':{file:'help-campaign-location-editor.png',alt:'Location editor showing separate public description, GM-only information and Arrival shop fields',caption:'Players receive the public description. GM-only information remains private; Arrival shop is a separate setting.',w:584,h:338,width:820,gutter:236,marks:[['Public description',77,575,77],['GM only',209,575,209],['Arrival shop',312,575,312]]}
        },shot=shots[label];if(!shot){target.hidden=true;return;}target.hidden=false;const gutter=shot.gutter??224,totalWidth=shot.w+gutter,totalHeight=shot.height||shot.h;
        target.setAttribute('aria-label',shot.alt+'. '+shot.caption);
        const figure=doc.createElement('figure');figure.style.cssText='margin:0 auto;max-width:'+shot.width+'px';
        const frame=doc.createElement('div');frame.style.cssText='position:relative;aspect-ratio:'+totalWidth+'/'+totalHeight;
        const image=doc.createElement('img');image.src=new URL(shot.file+'?v='+(label.startsWith('pc-')?'20261021-pc-help':label.startsWith('combat-')?'20261021-combat':label.startsWith('story-')?'20261017-arrows':label.startsWith('characters-')?'20261018-characters':label.startsWith('shop-')?'20261019-shop':label.startsWith('prompt-')?'20261019-prompt':label.startsWith('settings-')?'20261018-settings':'20261018-map-controls'),location.href).href;image.alt=shot.alt;image.style.cssText='display:block;width:'+shot.w/totalWidth*100+'%;height:auto;border:1px solid #aa8050;box-sizing:border-box';if(shot.cropTop){frame.style.overflow='hidden';image.style.transform='translateY(-'+shot.cropTop/shot.h*100+'%)';}frame.append(image);
        const ns='http://www.w3.org/2000/svg',overlay=doc.createElementNS(ns,'svg'),arrowId='help-arrow-'+label;
        overlay.setAttribute('viewBox',`0 0 ${totalWidth} ${totalHeight}`);overlay.setAttribute('aria-hidden','true');overlay.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
        overlay.innerHTML=`<defs><marker id="${arrowId}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#ffd474"/></marker></defs>`;
        for(const [text,y,tx,ty,routeY]of shot.marks){
          const line=doc.createElementNS(ns,'path'),start=shot.w+10;
          line.setAttribute('d',routeY==null?`M${start} ${y}L${tx} ${ty}`:`M${start} ${y}V${routeY}H${tx}V${ty}`);line.setAttribute('fill','none');line.setAttribute('stroke','#ffd474');line.setAttribute('stroke-width',shot.w>1400?'3':'2');line.setAttribute('marker-end',`url(#${arrowId})`);line.style.filter='drop-shadow(0 1px 2px #000)';
          const label=doc.createElementNS(ns,'text');label.setAttribute('x',shot.w+22);label.setAttribute('y',y+7);label.setAttribute('fill','#ffdc8b');label.setAttribute('font-size',shot.w>1400?'30':'20');label.setAttribute('font-family','Arial, sans-serif');label.setAttribute('font-weight','700');label.textContent=text;overlay.append(line,label);
        }
        frame.append(overlay);
        const caption=doc.createElement('figcaption');caption.textContent=shot.caption;caption.style.cssText='font-size:13px;line-height:1.5;margin-top:8px';figure.append(frame,caption);target.append(figure);
      }else if(/Select star/.test(label||'')){
        const svg=doc.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 520 70');svg.style.cssText='width:100%;max-height:75px';
        for(const [tag,attributes] of [['path',{d:'M70 35L430 35',stroke:'#67dfff','stroke-width':2,'stroke-dasharray':'7 6'}],['circle',{cx:70,cy:35,r:18,fill:'#ffd361'}],['circle',{cx:430,cy:35,r:12,fill:'#f5a444'}],['path',{d:'M246 24L267 35L246 46L251 35Z',fill:'#73e7ff'}]]){const node=doc.createElementNS(svg.namespaceURI,tag);for(const [key,value] of Object.entries(attributes))node.setAttribute(key,String(value));svg.append(node);}target.append(svg);
      }else for(const [i,text] of String(label||'').split(/\s*(?:→|\||·)\s*/).entries()){
        const chip=doc.createElement('span');chip.textContent=text;chip.style.cssText='display:inline-block;margin:4px;padding:8px 12px;border:1px solid '+['#63d7f1','#ffcd6b','#aef0bc'][i%3]+';border-radius:6px;background:#17242a;font-size:14px';target.append(chip);
      }
    };
    const tabs=doc.createElement('nav');tabs.setAttribute('aria-label','Help pages');
    const sections=doc.createElement('nav');sections.setAttribute('aria-label','Combat Help sections');
    const navigation=doc.createElement('div');if(combat)navigation.className='combat-help-nav';
    const section=()=>page<sharedCount?'shared':combatType;
    const remember=()=>{remembered[section()]=page<sharedCount?page:page-sharedCount;};
    const buildTabs=()=>{
      if(!combat&&tabs.children.length){for(const [index,tab]of [...tabs.children].entries()){if(index===page)tab.setAttribute('aria-current','page');else tab.removeAttribute('aria-current');}return;}
      tabs.replaceChildren();
      if(!rich||combat)return;
      content.forEach((item,index)=>{
        const tab=doc.createElement('button');tab.type='button';tab.textContent=item[3];
        if(index===page)tab.setAttribute('aria-current','page');
        tab.onclick=()=>{page=index;render();[...tabs.children].find(button=>button.getAttribute('aria-current')==='page')?.focus();};tabs.append(tab);
      });
    };
    if(combat){
      for(const [key,label]of [['shared','Overview'],['surface','Surface Combat'],['starship','Starship Combat']]){
        const tab=doc.createElement('button');tab.type='button';tab.textContent=label;tab.dataset.combatHelpSection=key;
        tab.onclick=()=>{remember();if(key!=='shared')combatType=key;content=[...combat.shared,...combat[combatType]];page=key==='shared'?remembered.shared:sharedCount+remembered[key];render();};sections.append(tab);
      }
      navigation.append(sections);
      const label=doc.createElement('label');label.textContent='Topic ';const select=doc.createElement('select');select.setAttribute('aria-label','Combat Help topic');select.onchange=()=>{page=Number(select.value);render();};label.append(select);navigation.append(label);
    }
    navigation.append(tabs);
    const render=()=>{
      heading.textContent=content[page][0];if(rich)body.innerHTML=content[page][1];else body.textContent=content[page][1];
      if(topic==='starships'&&(page===0||gm&&page===3||!gm&&page===6)){const entry=doc.createElement('button');entry.type='button';entry.className='sg-help-entry';entry.textContent='How to Create a Starship';entry.onclick=()=>window.SAStarshipGuide.mount(dialog,{fromHelp:true});body.append(entry);}
      buildTabs();
      if(combat){
        remember();sections.hidden=false;sections.style.display='flex';const branch=section(),theme=branch==='shared'?'#382112':branch==='surface'?'#432711':'#302044';dialog.style.background=footer.style.background=navigation.style.background=theme;dialog.dataset.combatHelpSection=branch;
        for(const tab of sections.children)tab.setAttribute('aria-pressed',String(tab.dataset.combatHelpSection===branch));
        const select=navigation.querySelector('select');select.replaceChildren();const start=branch==='shared'?0:sharedCount,end=branch==='shared'?sharedCount:content.length;
        for(let i=start;i<end;i++){const option=doc.createElement('option');option.value=i;option.textContent=content[i][0];option.selected=i===page;select.append(option);}
      }
      preview.hidden=!content[page][2];renderPreview(content[page][2]);prev.hidden=next.hidden=count.hidden=content.length===1;
      const start=combat&&page>=sharedCount?sharedCount:0,end=combat&&page<sharedCount?sharedCount:content.length;
      prev.disabled=page===start;next.disabled=page===end-1;count.textContent=combat?`${section()==='shared'?'Overview':combatType==='surface'?'Surface Combat':'Starship Combat'} — Page ${page-start+1} of ${end-start}`:`${page+1} / ${content.length}`;dialog.scrollTop=0;
    };
    prev.onclick=()=>{page--;render();};next.onclick=()=>{page++;render();};dismiss.onclick=()=>dialog.close();
    footer.append(prev,count,next,dismiss);dialog.append(navigation,heading,body,preview,footer);doc.body.append(dialog);
    dialog.onclose=()=>{dialog.remove();(opener?.isConnected?opener:button).focus();};window.addEventListener('pagehide',()=>dialog.remove(),{once:true});render();dialog.showModal();dismiss.focus();
  }
  const anchor=document.getElementById(gm?'gmMailButton':'pcHeaderMail');if(!anchor)return;
  const button=document.createElement('button');button.type='button';button.id='appHelp';button.textContent='Help';button.onclick=()=>open();anchor.before(button);
  document.getElementById('gmSettingsHelp')?.addEventListener('click',()=>open('settings'));
})();
