# Changelog

## [0.3.2] - 2026-05-02

- Added First Officer flight controls check - @alexlenh
- Added "before start procedure" voice command to start the before-start flow on demand - @alexlenh
- Fixed descent callout at 10,000 ft sometimes saying the wrong call (FL 100 vs ten thousand) for the active transition level - @alexlenh
- Fixed Cockpit Preparation "Seatbelts on" check looking at the wrong switch position - @alexlenh
- Fixed Departure Change Flap Settings always reporting incorrect when the flaps were actually set - @marxio09dio
- Fixed Fire Test in the preliminary cockpit flow waiting for verification on a momentary press - @alexlenh
- Improved battery voltage check sequence speed (~halved per-step delays) - @alexlenh
- Changed Before Start at the preflight timer to a reminder — the flow can now be started by voice when you're ready instead of auto-running - @alexlenh
- Remove incorrect "XX Checklist completed" sound when a checklist is canceled - @marxio09dio
- Copilot will turn on the Dome LIghts on the shutdown flow when dusk, dawn, night - @marxio09dio
- Fix "arm approach" command not arming APPR mode - @marxio09dio
- Add a small delay on "Landing checklist completed" playback - @marxio09dio

## [0.3.1] - 2026-04-22

- Improved engine 2 start flow - @alexlenh
- Adjusted delays between flow items - @alexlenh
- Fixed flows not being auto executed - @marxio09dio
- Relaxed "thrust set" callouts thresholds - @marxio09dio
- Added "set altimeters/qnh" command - @marxio09dio
- Fixed speach engine not respecting mic status - @marxio09dio

## [0.3.0] - 2026-04-03

- Added a passing altitude callout when setting standard – @marxio09dio
- Implemented single-engine taxi flows, including Engine 1/2 shutdown commands and Engine 2 start command – @alexlenh
- Introduced random delays between flow steps for more realism – @alexlenh
- Chocks are now automatically removed during the before-start flow and automatically placed during the shutdown flow – @marxio09dio
- Added a Ground Engineer role to handle GPU/ASU/ACU connections and disconnections – @marxio09dio
- Commands now support optional “please” as a prefix or suffix (e.g., “please disconnect GPU”, “flaps 0 please”) – @marxio09dio
- Added commands to arm and disarm slides – @marxio09dio
- Added an optional 5-minute delay before engine shutdown – @marxio09dio
- Minor tweaks to voice hint logic – @marxio09dio
- Crewmate now opens the checklist (C/L) menu on the right-side MCDU (actions must still be completed manually due to lack of LVAR support for checklist items) – @marxio09dio

## [0.2.0] - 2026-03-27

- Removed unused grammar - @alexlenh @marxio09dio
- Added runway conditions grammar - @alexlenh
- Various manual corrections - @alexlenh
- Fixed "Voice Trainer" not being bundled - @marxio09dio
- Added visual feedback for speech-related errors (i.e. language pack not installed) - @marxio09dio
- Improved speech engine error handling - @marxio09dio
- Changed (packs off T.O. logic, it will be turned on when CLB thrust is set as per FCOM) - @alexlenh
- Added option to choose microphone device - @marxio09dio
- Improved various error handling throughout the app - @marxio09dio
- Adjusted various flows - @alexlenh
- Added helper panel (hints what to say) - @marxio09dio
- Fixed issue with spoilers check on landing checklist - @marxio09dio

## [0.1.9] - 2026-03-21

- Replaced VOSK with Windows Speach Engine - @marxio09dio
- Added a custom Speach Trainer - @marxio09dio
- Improved various checklists responses - @marxio09dio
- Added option to change audio output device - @marxio09dio
- Critical Voice Command Fixes - @alexlenh
- Fixed voice various commands terminology - @alexlenh
- Improved manual documentation - @alexlenh @marxio09dio

## [0.1.8] - 2026-03-17

- Voice Command Updates to FCOM and Manual Standards - @marxio09dio, @alexlenh
- Enhanced spoken number parsing capabilities - @marxio09dio
- Expanded grammar for better voice recognition - @marxio09dio
- Support for numeric commands in various contexts - @marxio09dio
- Autopilot & Flight Control Enhancements - @marxio09dio, @alexlenh
- Improved settings management across the application - @marxio09dio
- New setting for Voice Activity Detection toggle - @marxio09dio
- New setting for Voice Activity Detection toggle - @marxio09dio
- Display unrecognized voice commands in UI - @marxio09dio
- New "cabin ready" callout - @marxio09dio
- New "thrust set" callout based on thrust configuration - @marxio09dio
- Flow updates to match 2026 FCOM standards - @alexlenh, @marxio09dio
- Enhanced flows step execution with conditional logic - @alexlenh, @marxio09dio
- After Controls Check flow added - @alexlenh
- Lights control setting - @alexlenh
- HUD flows for aircraft with HUD installed - @alexlenh
- Replaced settings based T.O flap with lvar_plan_check (FMC needs to be fully setup) - @marxio09dio
- New departure change checklist implementation - @alexlenh
- Fixed white flashes during UI transitions - @marxio09dio
- Compact UI layout improvements - @marxio09dio
- Added voice command support for kg weight units - @marxio09dio
- Added voice command support for lbs weight units - @marxio09dio
- Flexible weight input for international operations - @marxio09dio
- Updated Silero VAD model - @marxio09dio

## Note

- Flow updates for lights control setting in progress

## [0.1.7] - 2026-03-13

- FMA Callouts System (early implementation) - @marxio09dio
- "Please" can now be append to all commands i.e "Gear up please" or "Gear up" - @marxio09dio
- Added Autopilot Command (push/pull/set speed/heading/altitude) - @alexlenh
- Improved flows sequences logic - @alexlenh
- Barometric Setting (hp or MB) will sync between Capt and FO regardless of user settings - @marxio09dio
- New "set standard" command - @marxio09dio
- Copilot confirms baro on relevant checklists - @marxio09dio
- Improved audio playback to trim silences - @marxio09dio
- Added fuel quantity voice response on checklist - @marxio09dio
- Added Wipers speed limit for activation (230kts) - @marxio09dio
- Added "One thousand to Go" Callout - @marxio09dio
- Added "set runway track" for landing runway heading - @alexlenh
- Added "set missed approach altitude" - @marxio09dio

## [0.1.6] - 2026-03-10

- Added Cabin Ready Callout - @marxio09dio
- Added Thrust Set Callout - @marxio09dio
- New voice commands for strobe lights, takeoff light, wipers and seatbelts - @alexlenh
- Added HUD steps to after start and after landing - @alexlenh
- Added Departure Change Checklist - @alexlenh
- Added Go-Around Flows - @marxio09dio
- Added Flows to open and close cabin curtains - @marxio09dio
- Added APU to pack flows support - @marxio09dio
- Added "Speed Check" callout on lower Landing Gear - @marxio09dio
- Added auto check for TO config Flaps - @marxio09dio
- Application data shortcut added to UI - @marxio09dio
- Fix all K-events handlers - @marxio09dio

## [0.1.5] - 2026-03-08

- Added start APU" voice commands - @marxio09dio
- Added "speed checked" callout when lowering the gear - @marxio09dio
- Added "go around flaps" command and go around flows - @marxio09dio
- Added open and close all curtains - @marxio09dio
- Added option to hold or skip on wrong checklists items - @marxio09dio
- Added "slides" checklist item on before start will now check if the slides are all armed - @marxio09dio
- Fixed improved connection to sim logic - @marxio09dio
- Fixed vars reads on checklists - @marxio09dio

## [0.1.4] - 2026-03-06

- Added Appdata shortcut - @marxio09dio
- Fixed simconnection status logic - @marxio09dio

## [0.1.3] - 2026-03-03

- Initial public realease - @marxio09dio
