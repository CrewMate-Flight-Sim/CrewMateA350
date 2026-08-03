# CrewmateA350 — User Manual

**CrewmateA350** is a virtual First Officer companion for the **Airbus A350** in Microsoft Flight Simulator. It listens to your voice, responds with audio callouts, runs automated cockpit flows, and guides you through interactive checklists — just like a real crew member.

---

<div style="text-align: center;">
  <img src="../crewmate.png" alt="Crewmate avatar" width="800">
</div>

## Table of Contents

1. [Getting Started](#getting-started)
2. [Tutorial](#tutorial)
3. [Voice Commands](#voice-commands)
4. [Tips & Troubleshooting](#tips--troubleshooting)

---

## Getting Started

### Requirements

- Install **an English** Windows speech recognition language pack (Settings → Time & language → Speech). Regional variants (e.g. US, UK, Australia, India) are supported — whichever English recognizer Windows exposes. If several English packs are installed, the active engine follows Windows’ installed-recognizer order.
- To use the trainer app, set your Display Language to EN‑US while training (you can change it back afterward).

### Voice Modes

CrewmateA350 supports two voice recognition modes:

| Mode                   | How it works                                         |
| ---------------------- | ---------------------------------------------------- |
| **Continuous**         | The microphone is always listening. Speak naturally. |
| **Push-to-Talk (PTT)** | Not implemented yet.                                 |

### Volume & Voice Sensitivity

- **Sound Volume** — Controls how loud the FO's audio callouts are (0–100).
- **Voice Sensitivity** — Lower settings are more tolerant of variations (may increase false positives); higher settings are stricter.

---

## Tutorial

### Assumptions

This tutorial assumes you are parked at the gate with engines off. You are the Captain and PF (Pilot Flying); CrewMate acts as PM (Pilot Monitoring).

### Typical preflight timeline (example)

- 60 min: Cockpit door and curtains opened.
- 58 min: PM takes their seat.
- 55 min: PM starts preliminary cockpit preparation.
- 45 min: PM departs for external walkaround. PF starts cockpit preparation.
  ![Cockpit Preparation flow pattern](Images/COCKPIT%20PREPARATION%20FLOW%20PATTERN.png)
- 33 min: PM returns and starts cockpit preparation on his side.
- 25 min: PF conducts the departure briefing (enter takeoff data in the Takeoff Performance window).
- 20 min: PF calls for the COCKPIT PREPARATION checklist.
- 1 min: CrewMate closes the cockpit door. PF and PM perform before start flow, after that PF calls for the BEFORE START checklist.

![Before Start flow pattern](Images/BEFORE%20START%20FLOW%20PATTERN.png)

### Pushback and Engine Start

- Announce each engine start (e.g., “Starting engine one”).
- When ignition is set to NORMAL, PF and PM will start the AFTER START flow pattern. If anti‑ice will be used, flaps may be left as required.
- On hand signal from ground personnel, call for the AFTER START checklist.

![After Start flow pattern](Images/AFTER%20START%20FLOW%20PATTERN.png)

### Taxi

- PM announces when the cabin is ready.
- Check flight controls at a convenient time before or during taxi (this is done before arming the autobrake).
- Control check sequence: Full Up, Full Down, Full Left, Full Right, Rudder Full Left, Rudder Full Right.
- After the controls check, PM performs the TAXI flow pattern.
- After T.O. CONFIG pushbutton is pressed and a cabin report is received, PF calls for the TAXI checklist.

![Taxi flow pattern](Images/TAXI%20FLOW%20PATTERN.png)

### Line‑up & Takeoff

- PF calls for the Line‑up flow.
- When line‑up clearance is received and the Line‑up flow pattern is complete, PF calls for the LINE‑UP checklist.
- When cleared for takeoff, announce “TAKEOFF.”

![Line‑up flow pattern](Images/LINE-UP%20FLOW%20PATTERN.png)

### Acceleration

- The After‑Takeoff flow is triggered when flaps are retracted to zero.

![Acceleration flow pattern](Images/ACCELERATION%20FLOW%20PATTERN.png)

### Climb to 10,000 ft

![10,000 ft flow pattern](Images/AT%2010%20000%20FT%20AAL%20FLOW%20PATTERN.png)

### Descent Preparation

- PF should insert landing data in the Landing Performance window.

![PF Descent preparation items](Images/PF%20DESCENT%20PREP%20ITEMS.png)

### 10k Descent

![10k descent flow pattern](Images/AT%2010%20000%20FT%20AAL%20DES%20FLOW%20PATTERN.png)

### Approach

- After passing the transition level call for "set altimeters/QNH", complete the APPROACH checklist.

### Landing

- When LDG CONF is set and a cabin report is received, call for the LANDING checklist.
- PF announces “Continue” at minima or “Go‑around - flaps” as appropriate.

### After Landing

- Disarming the ground spoilers will trigger the After‑Landing flow.
- If anti‑ice is used, flaps may remain at LDG CONF per procedure.

![After landing flow pattern](Images/AFTER%20LANDING%20FLOW%20PATTERN.png)

### Parking

- Turn off taxi lights when turning into the gate, or ask the PM to confirm.
- Shutting down the engines will trigger the Parking flow.
- After the Parking flow pattern completes, PM calls for the SHUTDOWN checklist.

![Parking flow pattern](Images/PARKING%20FLOW%20PATTERN.png)

### Securing the Aircraft

- After the last passenger leaves (if securing the aircraft), call for the SECURE AIRCRAFT checklist.

---

## Voice Commands

Speak these phrases clearly during flight. The FO uses partial matching — you don't need to be word‑perfect, but include the key phrase.

### Preflight Timer

| Say                          | What happens                                                             |
| ---------------------------- | ------------------------------------------------------------------------ |
| "Let's prepare the aircraft" | Starts the preflight countdown timer to help you track preparation time. |

### Ground Engineer

| Say                   | What happens                                |
| --------------------- | ------------------------------------------- |
| "Ground from cockpit" | Ground Engineer will ask whats your request |
| "Cockpit to ground"   | Ground Engineer will ask whats your request |

### Gear

| Say         | What happens                                                      |
| ----------- | ----------------------------------------------------------------- |
| "gear down" | Lowers the landing gear. **Speed must be at or below 255 knots.** |
| "gear up"   | Raises the landing gear.                                          |

### Flaps

The FO will confirm speed limits before moving flaps while airborne.

| Say           | Flap Setting        | Max Speed                                |
| ------------- | ------------------- | ---------------------------------------- |
| "flaps zero"  | Flaps 0 (retracted) | —                                        |
| "flaps one"   | Flaps 1             | 255 kts (A350‑900) / 260 kts (A350‑1000) |
| "flaps two"   | Flaps 2             | 212 kts / 219 kts                        |
| "flaps three" | Flaps 3             | 195 kts / 206 kts                        |
| "flaps full"  | Flaps Full          | 186 kts / 192 kts                        |

### Engine Anti‑Ice

| Say                   | What happens                               |
| --------------------- | ------------------------------------------ |
| "Engine anti ice on"  | Turns on engine anti‑ice for both engines. |
| "Engine anti ice off" | Turns off engine anti‑ice.                 |

### Wing Anti‑Ice

| Say                 | What happens             |
| ------------------- | ------------------------ |
| "Wing anti ice on"  | Turns on wing anti‑ice.  |
| "Wing anti ice off" | Turns off wing anti‑ice. |

### Lights (Landing / Taxi / Nose / Strobe)

| Say                  | What happens                 |
| -------------------- | ---------------------------- |
| "Landing lights on"  | Turns on landing lights.     |
| "Landing lights off" | Turns off landing lights.    |
| "Taxi lights on"     | Turns on nose taxi light.    |
| "Taxi lights off"    | Turns off nose taxi light.   |
| "Takeoff light on"   | Turns on nose takeoff light. |
| "Strobe lights on"   | Turns on strobes.            |
| "Strobe lights auto" | Sets strobes to AUTO.        |
| "Strobe lights off"  | Turns off strobes.           |

### Flight Director

| Say                           | What happens                                         |
| ----------------------------- | ---------------------------------------------------- |
| "Flight Director on"          | Activates the Flight Director.                       |
| "Flight Director off"         | Deactivates the Flight Director.                     |
| "Flight Director off bird on" | Deactivates FD and selects TRK/FPA on the autopilot. |
| "Bird on"                     | Selects TRK/FPA on the autopilot.                    |
| "Bird off"                    | Deselects TRK/FPA on the autopilot.                  |

### Autopilot

| Say                                                                                                | What happens                                       |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| "Autopilot on"                                                                                     | Engages Autopilot 1.                               |
| "Set speed **_ or speed select _**"                                                                | Sets commanded speed.                              |
| "Set heading **\_ or heading select \_\_**"                                                        | Sets commanded heading.                            |
| "Set altitude **\_** or altitude select **\_** or set flight level **_ or flight level select _**" | Sets commanded altitude.                           |
| "Pull speed"                                                                                       | Pulls speed knob to select selected speed.         |
| "Pull speed \_\_\_"                                                                                | Pulls speed knob and sets the commanded speed.     |
| "Manage speed"                                                                                     | Pushes speed knob to select managed speed.         |
| "Pull heading"                                                                                     | Pulls heading knob to select selected heading.     |
| "Pull heading \_\_\_"                                                                              | Pulls heading knob and sets the commanded heading. |
| "Manage nav"                                                                                       | Pushes heading knob to select LNAV.                |
| "Altitude **\_** pull or Flight level \_\_\_ pull"                                                 | Sets commanded altitude and pulls altitude knob.   |
| "Altitude **\_** manage or Flight level \_\_\_ manage"                                             | Sets commanded altitude and pushes altitude knob.  |
| "Altitude pull or Flight level pull"                                                               | Pulls altitude knob.                               |
| "Altitude manage or Flight level manage"                                                           | Pushes altitude knob.                              |

### Flight Controls Check

| Say                     | What happens                                                                      |
| ----------------------- | --------------------------------------------------------------------------------- |
| "Flight controls check" | Starts the flight controls flow: Up, Down, Left, Right, Rudder Left, Rudder Right |

### Launching Flows by Voice

| Say                                            | Flow launched       |
| ---------------------------------------------- | ------------------- |
| "Clear left" or "Left side clear"              | Clear Left flow     |
| "Runway entry procedure" or "Clear to line up" | Before Takeoff flow |

### Launching Checklists by Voice

| Say                                                         | Checklist launched          |
| ----------------------------------------------------------- | --------------------------- |
| "Cockpit preparation checklist"                             | Cockpit Preparation         |
| "Before start checklist"                                    | Before Start                |
| "After start checklist"                                     | After Start                 |
| "Taxi checklist"                                            | Taxi                        |
| "Lineup checklist"                                          | Line Up                     |
| "Approach checklist"                                        | Approach                    |
| "Landing checklist"                                         | Landing                     |
| "Parking checklist"                                         | Parking                     |
| "Secure aircraft checklist"                                 | Secure Aircraft             |
| "Departure change checklist"                                | Departure Change Checklist  |
| "Stop checklist" or "Abort checklist" or "Cancel checklist" | Aborts the active checklist |

---

## Tips & Troubleshooting

**The FO isn't hearing me**

- Check that your microphone is selected and working.
- Adjust the **Voice Sensitivity** setting.

**The FO keeps repeating the challenge**

- Your response didn't match the expected phrase. Listen to the challenge and use one of the phrases listed in this manual (voice matching can be tuned in settings).
- If a physical switch must be set first (e.g., parking brake), set it in the cockpit before responding.

**How do I stop a checklist mid‑way?**

- Say **"Stop checklist"**, **"Abort checklist"**, or **"Cancel checklist"** at any time.

**Can I run flows and checklists manually without voice?**

- Yes. Both can be triggered from the **Flows** and **Checklist** panels in the app UI.

---
