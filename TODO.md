# TODO

Ideas and half-finished work, roughly in order of payoff.

## Brake and tire wear comment on walkaround return

Have the FO mention brake and tire condition in the "walkaround completed"
message (fires at T-35 from `preflight_timeline.json`).

- Brake temps are available: `INI_GEAR1_WHEEL0..5_BRAKE_TEMP` and
  `INI_GEAR2_WHEEL0..5_BRAKE_TEMP`.
- Tire/brake **wear** LVars are unconfirmed — needs a hunt. `INIB.SAVE_MAINTENANCE`
  and `INIB.RESET_BRAKE_TEMPS` custom events exist, so a maintenance/wear system
  is in there somewhere.
- Needs new audio generated for all four packs via `Scripts/FOvoices.ps1`.

## Smaller unused pieces

- **BTV callout** — `BTV.ogg` is recorded and referenced nowhere. Natural fit
  beside the existing autobrake checklist item.
- **`sound_after_execute`** — implemented in the flow runner, used by zero flows.

## User manual

- Bring `Manual/USER_MANUAL.md` up to date — nothing added since 0.3.3 is
  documented. Zero mentions of: brake fan, SEL LS, the Runway field in the
  Takeoff Plan, TCAS/XPDR in the flows, the FO being unavailable on the
  walkaround, "set missed approach altitude", "you have / I have control", and
  the "Hold checklist on incorrect item" setting.
- Produce a PDF version with a proper table of contents, PDF bookmarks and page
  numbers. Source is `USER_MANUAL.md` (282 lines, already has a hand-written
  TOC) plus `Manual/Images/`.

## Explicitly not doing

- **FO seat movement** — built and removed. MSFS does not move the copilot model
  with the seat, so only the chair slides and it looks wrong.
- **Fuel readback in tonnes** — the PF reads the fuel, not the FO.
  `point.ogg` and `tons.ogg` stay unused.
- **ECAM / abnormal procedures** — no LVars for it.
- **Approach briefing readback** — the briefing is the user's job.
- **SURV page ALT RPTG / ADS-B RPTG / ADS-B TRAFFIC** — not reachable. No LVar,
  no Input Event, no H-var, no custom event; the WASM handles those buttons with
  an x/y hit test (`SurvControlsBox::CheckClicked`). Confirmed by an isolated
  before/after LVar dump where the button visibly toggled and nothing changed.
