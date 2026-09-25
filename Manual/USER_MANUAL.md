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
4. [Checklist Responses](#checklist-responses)
5. [Tips & Troubleshooting](#tips--troubleshooting)

---

## Getting Started

### Requirements

- Install **an English** Windows speech recognition language pack (Settings → Time & language → Speech). Regional variants (e.g. US, UK, Australia, India) are supported — whichever English recognizer Windows exposes. If several English packs are installed, the active engine follows Windows' installed-recognizer order.
- **Set up Windows Speech Recognition once** before using the Voice Trainer. The trainer teaches Windows your voice, and Windows needs an existing speech profile to train. If the setup has never been run, there is no profile and training cannot start.
- To use the trainer app, set your Display Language to EN‑US while training (you can change it back afterward).

### Voice Modes

CrewmateA350 supports two voice recognition modes, chosen with **Voice Mode** in Settings:

| Mode                 | How it works                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Always listening** | The microphone is always listening. Speak naturally.                                                            |
| **Push-to-talk**     | The FO only listens while you hold the **PTT button**. Keep holding until you finish the command, then release. |

The mic button on the toolbar is the master switch in both modes. When it is off the FO hears nothing, even with PTT held. The icon shows what the FO can hear:

| Toolbar mic | Meaning                                            |
| ----------- | -------------------------------------------------- |
| Crossed out | Off. The FO hears nothing.                         |
| Red         | Always listening. The FO hears everything.         |
| Faded red   | Push-to-talk, ready. Hold the PTT button to speak. |
| Green       | Push-to-talk, PTT held. The FO is listening.       |

### PTT and Mic On/Off Buttons

Both buttons can be a keyboard key, mouse button 4 or 5, or a button or hat on a joystick, yoke, throttle or game controller. They work while MSFS has focus, including in fullscreen.

- **PTT Button**: hold to talk in Push-to-talk mode.
- **Mic On/Off**: works like clicking the toolbar mic, in either mode. It only works while the sim is connected.

To set one, open **Settings → Microphone**, click **Set** and press the key or button. Press **Esc** or click **Cancel** to stop without changing it, and click **×** to clear it.

CrewMate does not take the key or button away from MSFS, so pick one that is not bound to anything in the sim. Analog triggers and axes cannot be bound.

### Settings

| Setting                                      | What it does                                                                                                                                       |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Copilot**                                  | Which voice the FO speaks with (Jenny, Aria, Guy, Christopher).                                                                                    |
| **Ground Eng.**                              | The voice used by the ground engineer on the interphone.                                                                                           |
| **Output Device**                            | Where the FO's audio is played. Useful if you keep the sim on one device and voices on another.                                                    |
| **Input Device**                             | Which microphone the speech engine listens to.                                                                                                     |
| **Sound Volume**                             | How loud the FO's audio is (0–200; above 100 amplifies).                                                                                           |
| **Voice Sensitivity**                        | How confident the engine must be before accepting a command (50–100). Lower is more tolerant and may accept the wrong command; higher is stricter. |
| **Voice Mode**                               | **Always listening** or **Push-to-talk**. See [Voice Modes](#voice-modes).                                                                         |
| **PTT Button**                               | The key or button held to talk in Push-to-talk mode.                                                                                               |
| **Mic On/Off**                               | A key or button that switches the mic on and off, like the toolbar mic.                                                                            |
| **Hold checklist on incorrect item**         | On: the FO repeats the challenge until the item is answered correctly. Off: the item is skipped and the checklist moves on.                        |
| **Auto Ground lights control**               | On: the FO operates landing, taxi and strobe lights during the flows. Off: the lights are left to you.                                             |
| **5 minutes cool down (for engine shutoff)** | On: the FO refuses to shut an engine down until five minutes have passed since landing, and says so. Off: engines can be shut down at any time.    |

---

## Tutorial

### Assumptions

This tutorial assumes you are parked at the gate with engines off. You are the Captain and PF (Pilot Flying); CrewMate acts as PM (Pilot Monitoring).

### Typical preflight timeline (example)

- 50 min: Cockpit door and curtains opened.
- 48 min: PM starts preliminary cockpit preparation.
- 44 min: PM departs for external walkaround. PF starts cockpit preparation.
  ![Cockpit Preparation flow pattern](Images/COCKPIT%20PREPARATION%20FLOW%20PATTERN.png)
- 35 min: PM returns and starts cockpit preparation on the right-hand side.
- 25 min: PF conducts the departure briefing (enter takeoff data in the Takeoff Performance window, including the departure **Runway** — the FO reads it back on the LINE-UP checklist).
- 20 min: PF calls for the COCKPIT PREPARATION checklist.
- 5 min: PM closes the table, and a reminder to start the APU is shown.
- 1 min: CrewMate closes the cockpit door. PF and PM perform before start flow, after that PF calls for the BEFORE START checklist.

The before start flow takes TCAS out of standby and sets the transponder mode, then **leaves the SURV page open on the MCDU on purpose**. The ALT RPTG, ADS-B RPTG and ADS-B TRAFFIC pushbuttons on that page cannot be operated from outside the aircraft, so the FO cannot press them — set them yourself while the page is up.

> **The FO is outside between T-44 and T-35.** While away on the walkaround the FO does not answer any command, and an **FO outside** indicator is shown. Ground engineer calls and the preflight timer still work, because the ground engineer is a different person on the interphone.

![Before Start flow pattern](Images/BEFORE%20START%20FLOW%20PATTERN.png)

### Pushback and Engine Start

- Announce each engine start (e.g., "Starting engine one").
- When ignition is set to NORMAL, PF and PM will start the AFTER START flow pattern. If anti‑ice will be used, flaps may be left as required.
- After the AFTER START flow, complete the flight controls check when prompted.
- Control check sequence: Full Up, Full Down, Neutral, Full Left, Full Right, Neutral, Rudder Full Left, Rudder Full Right, Neutral. The FO calls out each position as it is reached and waits for you.
- When the controls check is complete, call for the AFTER START checklist.

![After Start flow pattern](Images/AFTER%20START%20FLOW%20PATTERN.png)

### Taxi

- PM announces when the cabin is ready.
- After the AFTER START checklist, PM performs the TAXI flow pattern.
- After T.O. CONFIG pushbutton is pressed PF calls for the TAXI checklist.

![Taxi flow pattern](Images/TAXI%20FLOW%20PATTERN.png)

### Line‑up & Takeoff

- PF calls for the Line‑up flow.
- When line‑up clearance is received and the Line‑up flow pattern is complete, PF calls for the LINE‑UP checklist.
- When cleared for takeoff, announce "TAKEOFF."

![Line‑up flow pattern](Images/LINE-UP%20FLOW%20PATTERN.png)

### Rejected Takeoff

- To reject, announce **"STOP"**. The FO then follows the FCOM tasksharing: **"reverse green"** once reverse is selected, then **"decel"** or **"no decel"**.
- Nothing is said about reverse if it is never selected — a low speed reject produces no reverse call at all.

### Acceleration

- The After‑Takeoff flow is triggered when flaps are retracted to zero.

![Acceleration flow pattern](Images/ACCELERATION%20FLOW%20PATTERN.png)

### Climb to 10,000 ft

![10,000 ft flow pattern](Images/AT%2010%20000%20FT%20AAL%20FLOW%20PATTERN.png)

### Descent Preparation

- PF should insert landing data in the Landing Performance window.
- **SEL LS** selects the LS pushbutton on the FO side during the descent flow. Deselect it for RNP AR approaches.

![PF Descent preparation items](Images/PF%20DESCENT%20PREP%20ITEMS.png)

### 10k Descent

![10k descent flow pattern](Images/AT%2010%20000%20FT%20AAL%20DES%20FLOW%20PATTERN.png)

### Approach

- After passing the transition level call for "set altimeters/QNH", complete the APPROACH checklist.
- The transition altitude and transition level calls are skipped when the altimeter has already been set, so setting standard early does not produce a redundant call later.

### Landing

- When LDG CONF is set and a cabin report is received, call for the LANDING checklist.
- PF announces "Continue" at minima or "Go‑around - flaps" as appropriate.

### After Landing

- Disarming the ground spoilers will trigger the After‑Landing flow.
- If anti‑ice is used, flaps may remain at LDG CONF per procedure.

![After landing flow pattern](Images/AFTER%20LANDING%20FLOW%20PATTERN.png)

### Parking

- Turn off taxi lights when turning into the gate, or ask the PM to confirm.
- Shutting down the engines will trigger the Parking flow.
- After the Parking flow pattern completes, PF calls for the PARKING checklist.

> **Engine shutdown is held for five minutes after landing.** With **5 minutes cool down** enabled, asking the FO to shut an engine down before the cooling period has elapsed is refused with "five minutes not passed". The countdown starts automatically at the 70 knot call.

![Parking flow pattern](Images/PARKING%20FLOW%20PATTERN.png)

### Securing the Aircraft

- After the last passenger leaves (if securing the aircraft), call for the SECURING THE AIRCRAFT checklist.
- The shutdown flow returns TCAS and the transponder to standby.

---

## Voice Commands

Speak these phrases clearly during flight. The FO uses partial matching — you don't need to be word‑perfect, but include the key phrase. **"Please" may be added before or after any command** ("please gear up", "gear up please").

Where a command takes a number, say it naturally: "two seven zero", "three hundred fifty", "one zero one three".

### Preflight Timer

| Say                                                                                     | What happens                                                             |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| "Let's prepare the aircraft" / "Let's prepare the flight" / "Let's set up the aircraft" | Starts the preflight countdown timer to help you track preparation time. |

### Launching Flows by Voice

| Say                                                                        | Flow launched                                            |
| -------------------------------------------------------------------------- | -------------------------------------------------------- |
| "Clear left" / "Clear on the left" / "Left side clear" / "Clear left side" | Clear Left flow                                          |
| "Before start procedure"                                                   | Before Start flow                                        |
| "Runway entry procedure" / "Clear to line up"                              | Before Takeoff flow                                      |
| "Takeoff"                                                                  | Takeoff flow                                             |
| "Flight controls check"                                                    | Flight controls sequence, then the next After Start hint |
| "Start engine two"                                                         | Starts engine 2 (single-engine taxi start)               |

### Launching Checklists by Voice

| Say                                                       | Checklist launched          |
| --------------------------------------------------------- | --------------------------- |
| "Cockpit preparation checklist"                           | COCKPIT PREPARATION         |
| "Before start checklist"                                  | BEFORE START                |
| "After start checklist"                                   | AFTER START                 |
| "Taxi checklist"                                          | TAXI                        |
| "Departure change checklist"                              | DEPARTURE CHANGE            |
| "Lineup checklist"                                        | LINE-UP                     |
| "Approach checklist"                                      | APPROACH                    |
| "Landing checklist"                                       | LANDING                     |
| "Parking checklist"                                       | PARKING                     |
| "Secure aircraft checklist"                               | SECURING THE AIRCRAFT       |
| "Cancel checklist" / "Stop checklist" / "Abort checklist" | Aborts the active checklist |

### Gear

| Say         | What happens                                                      |
| ----------- | ----------------------------------------------------------------- |
| "Gear down" | Lowers the landing gear. **Speed must be at or below 255 knots.** |
| "Gear up"   | Raises the landing gear.                                          |

### Flaps

The FO will confirm speed limits before moving flaps while airborne.

| Say           | Flap Setting        | Max Speed                                |
| ------------- | ------------------- | ---------------------------------------- |
| "Flaps zero"  | Flaps 0 (retracted) | —                                        |
| "Flaps one"   | Flaps 1             | 255 kts (A350‑900) / 260 kts (A350‑1000) |
| "Flaps two"   | Flaps 2             | 212 kts / 219 kts                        |
| "Flaps three" | Flaps 3             | 195 kts / 206 kts                        |
| "Flaps full"  | Flaps Full          | 186 kts / 192 kts                        |

### Autopilot

| Say                                                     | What happens                                      |
| ------------------------------------------------------- | ------------------------------------------------- |
| "Autopilot on"                                          | Engages Autopilot 1.                              |
| "Autopilot off"                                         | Disconnects the autopilot.                        |
| "Set speed \_\_\_" / "Pull speed \_\_\_"                | Sets the commanded speed. "Knots" may be added.   |
| "Pull speed"                                            | Pulls the speed knob (selected speed).            |
| "Manage speed"                                          | Pushes the speed knob (managed speed).            |
| "Set heading \_\_\_"                                    | Sets the commanded heading.                       |
| "Pull heading \_\_\_"                                   | Sets the heading and pulls the knob.              |
| "Pull heading"                                          | Pulls the heading knob (selected heading).        |
| "Manage nav"                                            | Pushes the heading knob (managed NAV).            |
| "Set altitude \_\_\_"                                   | Sets the commanded altitude in feet.              |
| "Set flight level \_\_\_"                               | Sets the commanded altitude as a flight level.    |
| "Altitude \_\_\_ pull" / "Flight level \_\_\_ pull"     | Sets the altitude and pulls the knob.             |
| "Altitude \_\_\_ manage" / "Flight level \_\_\_ manage" | Sets the altitude and pushes the knob.            |
| "Altitude pull" / "Flight level pull"                   | Pulls the altitude knob.                          |
| "Altitude manage" / "Flight level manage"               | Pushes the altitude knob.                         |
| "Press alt"                                             | Pushes the level-off pushbutton.                  |
| "Arm approach"                                          | Arms APPR.                                        |
| "Arm localizer" / "Arm loc"                             | Arms LOC.                                         |
| "Set runway track"                                      | Sets the FCU heading to the landing runway track. |

### Flight Director

| Say                           | What happens                                         |
| ----------------------------- | ---------------------------------------------------- |
| "Flight director on"          | Activates the Flight Director.                       |
| "Flight director off"         | Deactivates the Flight Director.                     |
| "Flight director off bird on" | Deactivates FD and selects TRK/FPA on the autopilot. |
| "Bird on"                     | Selects TRK/FPA on the autopilot.                    |
| "Bird off"                    | Deselects TRK/FPA on the autopilot.                  |

### Altimeter

| Say                          | What happens                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| "Set standard"               | Sets STD on both sides. In the climb the FO calls "standard crosschecked, passing flight level \_\_\_", then "now" as the level is reached. |
| "Set altimeters" / "Set QNH" | Sets the altimeters to the current QNH.                                                                                                     |

### Missed Approach Altitude

| Say                                                       | What happens                                                    |
| --------------------------------------------------------- | --------------------------------------------------------------- |
| "Set go around altitude" / "Set missed approach altitude" | Uses the missed approach altitude from the Landing Plan window. |
| "Set go around altitude \_\_\_ feet"                      | Sets an explicit altitude in feet.                              |
| "Set go around altitude flight level \_\_\_"              | Sets an explicit flight level.                                  |

The FO reads the altitude back — "go around altitude, four thousand, feet set".

### Lights

| Say                 | What happens                 |
| ------------------- | ---------------------------- |
| "Landing light on"  | Turns on landing lights.     |
| "Landing light off" | Turns off landing lights.    |
| "Taxi light on"     | Turns on nose taxi light.    |
| "Taxi light off"    | Turns off nose taxi light.   |
| "Takeoff light on"  | Turns on nose takeoff light. |
| "Strobe light on"   | Turns on strobes.            |
| "Strobe light auto" | Sets strobes to AUTO.        |
| "Strobe light off"  | Turns off strobes.           |

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

### Wipers

Wipers are refused above 230 knots unless you are selecting OFF.

| Say                          | What happens         |
| ---------------------------- | -------------------- |
| "Wipers off"                 | Wipers off.          |
| "Wipers slow"                | Slow continuous.     |
| "Wipers fast"                | Fast continuous.     |
| "Wipers slow intermittent"   | Slow intermittent.   |
| "Wipers medium intermittent" | Medium intermittent. |
| "Wipers fast intermittent"   | Fast intermittent.   |

### Engines and APU

| Say                                                                                           | What happens                                              |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| "Starting engine one" / "Starting engine number one" / "Starting one" / "Starting number one" | You announce the start; the FO acknowledges with "check". |
| "Starting engine two" / "Starting engine number two" / "Starting two" / "Starting number two" | You announce the start; the FO acknowledges with "check". |
| "Start engine two"                                                                            | Starts engine 2 and runs the after start flow for it.     |
| "Shutdown engine one"                                                                         | Shuts down engine 1.                                      |
| "Shutdown engine two"                                                                         | Shuts down engine 2.                                      |
| "Start the apu" / "Start apu"                                                                 | Starts the APU.                                           |

### Cabin and Doors

| Say                                                               | What happens             |
| ----------------------------------------------------------------- | ------------------------ |
| "Cabin crew arm slides" / "Cabin crew arm slides and cross check" | Arms the door slides.    |
| "Cabin crew disarm slides"                                        | Disarms the door slides. |
| "Seat belts on"                                                   | Seat belt signs on.      |
| "Seat belts off"                                                  | Seat belt signs off.     |
| "Seat belts auto"                                                 | Seat belt signs to AUTO. |

### Brakes

| Say             | What happens                                                  |
| --------------- | ------------------------------------------------------------- |
| "Brake check"   | The FO answers "pressure zero".                               |
| "Brake fan on"  | Turns the brake fans on, if the aircraft is fitted with them. |
| "Brake fan off" | Turns the brake fans off.                                     |

If the aircraft has no brake fans, the FO answers "are you sure?" instead.

### Control Handover

| Say                | What happens                       |
| ------------------ | ---------------------------------- |
| "You have control" | The FO answers "I have control".   |
| "I have control"   | The FO answers "you have control". |

### Takeoff and Go‑Around

| Say               | What happens                                                           |
| ----------------- | ---------------------------------------------------------------------- |
| "Takeoff"         | Runs the Takeoff flow.                                                 |
| "Stop"            | Rejected takeoff — the FO calls reverse green, then decel or no decel. |
| "Go around flaps" | Retracts one flap stage and re-arms the after takeoff flow.            |
| "Continue"        | Acknowledged at minima.                                                |

### Ground Engineer

Call the ground engineer first — the rest are only answered once the interphone call has been made.

| Say                                              | What happens                            |
| ------------------------------------------------ | --------------------------------------- |
| "Ground from cockpit" / "Cockpit to ground"      | The ground engineer answers "go ahead". |
| "Connect GPU" / "Connect ground power"           | Connects ground power.                  |
| "Disconnect GPU" / "Disconnect ground power"     | Disconnects ground power.               |
| "Connect ASU" / "Connect air starter"            | Connects the air starter unit.          |
| "Disconnect ASU" / "Disconnect air starter"      | Disconnects the air starter unit.       |
| "Connect ACU" / "Connect air conditioning"       | Connects the air conditioning unit.     |
| "Disconnect ACU" / "Disconnect air conditioning" | Disconnects the air conditioning unit.  |
| "Disconnect all" / "Disconnect all services"     | Disconnects everything.                 |
| "We are ready for pushback"                      | Requests pushback.                      |

### FMA Callouts

The FMA can be read out loud as the PF ("man toga, srs, runway, autothrust blue"). The FO recognises the standard thrust, vertical, lateral, approach and armed mode wording, including "man flex" with a flex temperature.

---

## Checklist Responses

During a challenge/response checklist the FO reads each item and waits for your answer. **"Set and checked" is accepted for every item**, and items marked _auto_ are verified silently without a spoken response.

Some items are also verified against the aircraft — if the switch is not actually set, the FO answers "are you sure?" and, depending on the **Hold checklist on incorrect item** setting, either repeats the challenge or moves on.

The answers that carry numbers — speeds, altimeter settings, minimums, the runway, fuel — are only understood **while a checklist is running**. They are readbacks, not commands: saying them at any other time does nothing.

### Cockpit Preparation

| Item                 | Say                                                                                                                                                              |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gear Pins and Covers | "removed"                                                                                                                                                        |
| Fuel Quantity        | "fuel quantity \_\_\_ kilograms / pounds / tons", optionally "balanced". The short forms "tons" / "kilograms" / "pounds" also match.                             |
| Seat Belts           | _auto_ — checked against the seat belt switch                                                                                                                    |
| Barometric Reference | "altimeter \_\_\_\_ set" / "QNH \_\_\_\_ set" / "\_\_\_\_ set" / "set" — the FO reads the setting back. inHg (2700–3100) and hPa (900–1100) are both understood. |

### Before Start

| Item                       | Say                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parking Brake              | "set" — verified against the parking brake                                                                                                                        |
| Takeoff Speeds and Thrust  | "V1 \_\_\_ VR \_\_\_ V2 \_\_\_ flex \_\_" or "V1 \_\_\_ VR \_\_\_ V2 \_\_\_ toga" — all three speeds and the thrust setting must be said; the FO reads them back. |
| Slides                     | "armed" — verified against the door slides                                                                                                                        |
| Beacon                     | _auto_ — checked against the beacon switch                                                                                                                        |
| Nose Wheel Disconnect Memo | "checked"                                                                                                                                                         |

### After Start

| Item             | Say                                          |
| ---------------- | -------------------------------------------- |
| Anti Ice         | "engines on" / "engines on wings on" / "off" |
| Flight Controls  | "checked"                                    |
| Ground Clearance | "received"                                   |

### Taxi

| Item          | Say                                                 |
| ------------- | --------------------------------------------------- |
| Flap Settings | "config one plus f" / "config two" / "config three" |
| Radar         | "on"                                                |

### Departure Change

| Item                      | Say                                                                               |
| ------------------------- | --------------------------------------------------------------------------------- |
| Runway and SID            | "set and checked"                                                                 |
| Flap Settings             | "config one plus f" / "config two" / "config three"                               |
| Takeoff Speeds and Thrust | "V1 \_\_\_ VR \_\_\_ V2 \_\_\_ flex \_\_" or "V1 \_\_\_ VR \_\_\_ V2 \_\_\_ toga" |
| FCU ALT                   | "set"                                                                             |

### Line-Up

| Item           | Say                                                                                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cabin Advisory | "secured" / "signaled"                                                                                                                               |
| Takeoff Runway | The runway, then "confirmed" — e.g. "zero nine left confirmed". "Left", "right", "center" and "centre" are understood; the FO reads the runway back. |
| Packs Settings | "on" / "on supplied by apu" / "off"                                                                                                                  |

### Approach

| Item                 | Say                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------- |
| Barometric Reference | "altimeter \_\_\_\_ set" / "QNH \_\_\_\_ set" / "\_\_\_\_ set" / "set" — the FO reads the setting back. |
| Minimums Reference   | "baro \_\_\_ feet" or "radio \_\_\_ feet"                                                               |
| Runway Condition     | "dry" / "wet" / "compacted snow" / "snow" / "slippery" / "standing water" / "slush" / "ice"             |
| Auto Brake           | "medium" / "BTV"                                                                                        |

### Landing

Run silently — the FO checks spoilers armed, flaps and gear down, and calls out anything that is not set.

### Parking

| Item                    | Say                                     |
| ----------------------- | --------------------------------------- |
| Parking Brake or Chocks | "chocks in place" / "parking brake set" |
| Wing Lights             | "off"                                   |

### Securing the Aircraft

| Item             | Say          |
| ---------------- | ------------ |
| Exterior Lights  | "off"        |
| Ground Servicing | "off"        |
| External Power   | "off" / "on" |
| EFBs             | "off"        |
| Batteries        | "off"        |

---

## Tips & Troubleshooting

**The FO isn't hearing me**

- Check that your microphone is selected and working.
- Adjust the **Voice Sensitivity** setting.
- In Push-to-talk mode, check that a **PTT Button** is set and that the toolbar mic turns green while you hold it.

**My PTT or Mic On/Off key does nothing while MSFS has focus**

- MSFS is probably running as administrator. Run CrewMate as administrator too.

**The FO ignores everything I say before departure**

- Between T-44 and T-35 on the preflight timer the FO is outside on the walkaround and does not answer. The **FO outside** indicator is shown while this is the case. Ground engineer calls still work.

**The FO keeps repeating the challenge**

- Your response didn't match the expected phrase. Listen to the challenge and use one of the phrases listed in [Checklist Responses](#checklist-responses) (voice matching can be tuned in settings).
- If a physical switch must be set first (e.g., parking brake), set it in the cockpit before responding.

**The FO won't shut the engines down**

- The **5 minutes cool down** setting holds engine shutdown until five minutes have passed since landing, and the FO says "five minutes not passed". Wait, or switch the setting off.

**The Voice Trainer says training failed**

- "Value does not fall within the expected range" means Windows has no speech profile for your account. Run Windows Speech Recognition setup once, then start the trainer again.
- The trainer also needs the Windows Display Language set to EN‑US while it runs.

**How do I stop a checklist mid‑way?**

- Say **"Cancel checklist"**, **"Stop checklist"**, or **"Abort checklist"** at any time.

**Can I run flows and checklists manually without voice?**

- Yes. Both can be triggered from the **Flows** and **Checklist** panels in the app UI.

---
