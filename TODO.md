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

## Fuel readback in tonnes

Recorded and never wired: `point.ogg` and `tons.ogg` exist in every pack, and
`CommandDispatcher.cs` already emits a `fuel` command with `quantity`, `unit` and
`balanced`. `dispatchFoCommand` has no `case "fuel"`. Would give "six point five
tons, balanced".

## Smaller unused pieces

- **BTV callout** — `BTV.ogg` is recorded and referenced nowhere. Natural fit
  beside the existing autobrake checklist item.
- **`standard_set.ogg`** — recorded, unused, despite the transition altitude
  callout logic already existing.
- **RTO** — `abort_takeoff` is in the grammar and its handler is commented out in
  `commandDispatch.ts`, so the FO does nothing during a rejected takeoff.
- **`sound_after_execute`** — implemented in the flow runner, used by zero flows.

## User manual

- Bring `Manual/USER_MANUAL.md` up to date — nothing added since 0.3.3 is
  documented. Zero mentions of: brake fan, SEL LS, the Runway field in the
  Takeoff Plan, TCAS/XPDR in the flows, the FO being unavailable on the
  walkaround, "set missed approach altitude", "you have / I have control", and
  the "Hold checklist on incorrect item" setting.
- Fix the walkaround timing: the manual says the PM returns at T-33, but
  `src/data/preflight_timeline.json` fires the return at T-35.
- Produce a PDF version with a proper table of contents, PDF bookmarks and page
  numbers. Source is `USER_MANUAL.md` (282 lines, already has a hand-written
  TOC) plus `Manual/Images/`.

## Explicitly not doing

- **ECAM / abnormal procedures** — no LVars for it.
- **Approach briefing readback** — the briefing is the user's job.
- **SURV page ALT RPTG / ADS-B RPTG / ADS-B TRAFFIC** — not reachable. No LVar,
  no Input Event, no H-var, no custom event; the WASM handles those buttons with
  an x/y hit test (`SurvControlsBox::CheckClicked`). Confirmed by an isolated
  before/after LVar dump where the button visibly toggled and nothing changed.
