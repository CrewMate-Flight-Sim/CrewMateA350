/**
 * Builders for multi-file callouts played through `playSoundSequence`.
 * Every pack carries the digits 0-9, "thousand" and "ten thousand", so numbers
 * are spelled out from those rather than recorded per value.
 */

/**
 * Build audio sequence for "standard crosschecked, passing FL XXX"
 * @param targetAlt Target altitude in feet
 * @returns Array of audio filenames to play in sequence
 */
export const buildPassingAltitudeSequence = (targetAlt: number): string[] => {
  const sequence: string[] = ["standard_cross_checked.ogg", "passing_flight_level.ogg"]

  const flightLevel = Math.round(targetAlt / 100)
  //  FL050, FL100, FL250, etc.
  const flString = flightLevel.toString().padStart(3, "0")

  for (const digit of flString) {
    sequence.push(`${digit}.ogg`)
  }

  return sequence
}

/**
 * Build the go-around altitude readback. Only exact thousands up to 10000 can be
 * spoken — the packs carry 0-9, thousand and ten_thousand, but no "hundred" — so
 * anything else falls back to "go around altitude set" rather than a wrong or
 * missing number file.
 */
export const buildGoAroundAltSequence = (altValue: number): string[] => {
  if (altValue === 10000) {
    return ["go_around_alt.ogg", "ten_thousand.ogg", "feet_set.ogg"]
  }
  const thousands = altValue / 1000
  if (Number.isInteger(thousands) && thousands >= 1 && thousands <= 9) {
    return ["go_around_alt.ogg", `${thousands}.ogg`, "thousand.ogg", "feet_set.ogg"]
  }
  return ["go_around_alt.ogg", "set.ogg"]
}
