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

// Packs carry 0-9, "thousand", "ten thousand" and "hundred"; anything they can't say falls back to "go around altitude set"
export const buildGoAroundAltSequence = (altValue: number): string[] => {
  const fallback = ["go_around_alt.ogg", "set.ogg"]
  if (!Number.isInteger(altValue / 100) || altValue <= 0) return fallback

  const thousands = Math.floor(altValue / 1000)
  const hundreds = (altValue % 1000) / 100
  const words: string[] = []

  if (thousands === 10) words.push("ten_thousand.ogg")
  else if (thousands >= 1 && thousands <= 9) words.push(`${thousands}.ogg`, "thousand.ogg")
  else if (thousands > 10) return fallback

  if (hundreds > 0) words.push(`${hundreds}.ogg`, "hundred.ogg")

  return ["go_around_alt.ogg", ...words, "feet_set.ogg"]
}
