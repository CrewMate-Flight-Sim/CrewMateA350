import departureChange from "@/data/checklists/10_departure_change.json"
import cockpitPrep from "@/data/checklists/1_cockpit_preparation.json"
import beforeStart from "@/data/checklists/2_before_start.json"
import afterStart from "@/data/checklists/3_after_start.json"
import taxi from "@/data/checklists/4_taxi.json"
import lineUp from "@/data/checklists/5_lineup.json"
import approach from "@/data/checklists/6_approach.json"
import landing from "@/data/checklists/7_landing.json"
import parking from "@/data/checklists/8_parking.json"
import secureAircraft from "@/data/checklists/9_secure_aircraft.json"
import type { Checklist } from "@/types/checklist"

export const ALL_CHECKLISTS: Checklist[] = [
  cockpitPrep,
  beforeStart,
  afterStart,
  taxi,
  lineUp,
  approach,
  landing,
  parking,
  secureAircraft,
  departureChange
] as Checklist[]

export function getChecklistById(id: string): Checklist | undefined {
  return ALL_CHECKLISTS.find((c) => c.id === id)
}
