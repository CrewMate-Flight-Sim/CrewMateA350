# TODO

Ideas and half-finished work, roughly in order of payoff.

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
- **AUTOBRAKE OFF callout** — the aircraft plays its own AUTO BRAKE OFF aural
  when the autobrake disconnects, and the FCOM has the PM call auto callouts
  only when they are inoperative (PRO-NOR-SCO note 2).
- **GSX pushback direction and good engine start** — GSX only takes these
  through its menu, which changes with GSX updates. No variable answers the
  good engine start question (`L:FSDT_GSX_SET_GOOD_ENGINE_START` only turns it
  on or off). Revisit only if GSX exposes one.
