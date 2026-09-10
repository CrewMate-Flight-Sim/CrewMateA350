# === CONFIGURATION ===

$voicesToGenerate = @(
    "en-US-JennyNeural", 
    "en-US-AriaNeural", 
    "en-US-GuyNeural", 
    "en-US-ChristopherNeural"
)

$phrases = @{
    "checked"                                   = "Checked"
    "clear_right"                               = "Clear right"
    "check"                                     = "Check"
    "ready"                                     = "Ready"
    "rotate"                                    = "Rotate"
    "100_knots"                                 = "One hundred knots"
    "70_knots"                                  = "Seventy knots"
    "positive_climb"                            = "Positive climb"
    "fl_100"                                    = "Flight level one hundred"
    "ten_thousand"                              = "Ten thousand"
    "transiton_altitude"                        = "Transition altitude"
    "transiton_level"                           = "Transition level"
    "spoilers"                                  = "Spoilers"
    "no_spoilers"                               = "No spoilers"
    "reverse_green"                             = "Reverse green"
    "no_reverse_engine_1_and_2"                 = "No reverse engine one and two"
    "decel"                                     = "Deecel"
    "check_speed"                               = "Check speed"
    "speed_checked"                             = "Speed checked"
    "gear_down"                                 = "Gear down"
    "gear_up"                                   = "Gear up"
    "exterior_lights"                           = "Exterior lights"
    "ground_servicing"                          = "Ground servicing"
    "external_power"                            = "External power"
    "efbs"                                      = "EFBs"
    "batteries"                                 = "Batteries"
    "securing_the_aircraft_checklist_completed" = "Securing the aircraft checklist completed"
    "parking_brake_or_chocks"                   = "Parking brake or chocks"
    "wing_lights"                               = "Wing lights"
    "parking_checklist_completed"               = "Parking checklist completed"
    "landing_checklist_completed"               = "Landing checklist completed"
    "baro_ref"                                  = "Baro ref"
    "minimum"                                   = "Minimum"
    "runway_condition"                          = "Runway condition"
    "auto_brake"                                = "Auto brake"
    "approach_checklist_completed"              = "Approach checklist completed"
    "cabin"                                = "Cabin"
    "takeoff_runway"                            = "Takeoff runway"
    "packs_one_and_two"                         = "Packs one and two"
    "line_up_checklist_completed"               = "Line up checklist completed"
    "flap_settings"                             = "Flap settings"
    "radar"                                     = "Radar"
    "taxi_checklist_completed"                  = "Taxi checklist completed"
    "anti_ice"                                  = "Anti ice"
    "flight_controls"                           = "Flight controls"
    "ground_clearance"                          = "Ground clearance"
    "after_start_checklist_completed"           = "After start checklist completed"
    "parking_brake"                             = "Parking brake"
    "takeoff_speeds_and_thrust"                 = "Takeoff speeds and thrust"
    "slides"                                    = "Slides"
    "nws_disc_memo"                             = "nose wheel steering disconnect memo"
    "before_start_checklist_completed"          = "Before start checklist completed"
    "gear_pins_and_covers"                      = "Gear pins and covers"
    "fuel_quantity"                             = "Fuel quantity"
    "cockpit_preparation_checklist_completed"   = "Cockpit preparation checklist completed"
    "full_left"                                 = "Full left"
    "full_right"                                = "Full right"
    "full_up"                                   = "Full up"
    "full_down"                                 = "Full down"
    "neutral"                                   = "Neutral"
    "flaps_0"                                   = "Flaps zero"
    "flaps_1"                                   = "Flaps one"
    "flaps_2"                                   = "Flaps two"
    "flaps_3"                                   = "Flaps three"
    "flaps_full"                                = "Flaps full"
    "config_1_plus_f"                           = "Config one plus f"
    "config_2"                                  = "Config two"
    "config_3"                                  = "Config three"
    "walkaround"                                = "I'll perform the walkaround now"
    "walkaround_completed"                      = "Walkaround completed, all good no issues found"
    "0"                                         = "Zero"
    "1"                                         = "One"
    "2"                                         = "Two"
    "3"                                         = "Three"
    "4"                                         = "Four"
    "5"                                         = "Five"
    "6"                                         = "Six"
    "7"                                         = "Seven"
    "8"                                         = "Eight"
    "9"                                         = "Niner"
    "Ok"                                        = "Ok"
    "v_one"                                     = "V one"
    "v_r"                                       = "V r"
    "v_2"                                       = "V two"
    "fire_test"                                 = "Fire test"
    "thousand"                                  = "Thousand"
    "tons"                                      = "Tons"
    "point"                                     = "Point"
    "set"                                       = "Set"
    "TOGA"                                      = "Toga"
    "flex"                                      = "Flex"
    "confirmed"                                 = "Confirmed"
    "BTV"                                       = "BTV"
    "check_seatbelts"                           = "Check seatbelts"
    "check_landing_gear"                        = "Check landing gear"
    "check_flaps"                               = "Check flaps"
    "check_spoilers"                            = "Check spoilers"
    "cabin_takeoff"                             = "Cabin crew, please be seated for takeoff"
    "cabin_landing"                             = "Cabin crew, please be seated for landing"
    "are_you_sure"                              = "Are you sure?"
    "packs_1_and_2_on"                          = "Packs one and two on"
    "cabin_ready"                               = "Cabin is ready"
    "thrust_set"                                = "Thrust set"
    "rwy&sid"                                   = "Runway and seed"
    "fcualt"                                    = "FCU altitude"
    "departure_change_checklist_completed"      = "Departure change checklist completed"
    "one_to_go"                                 = "One thousand to go"
    "standard_set"                              = "Standard Set"
    "go_around_alt"                   = "Go around altitude" # changed
    "check_beacon"                              = "Beacon is not on"
    "check_belts"                               = "Seat belt sign is not on"
    "pressure_zero"                             = "Pressure zero"
    "standard_cross_checked"                    = "Standard cross checked"
    "passing_flight_level"                      = "Passing flight level"
    "now_at"                                    = "Now"
    "starting_engine_2"                         = "Starting engine two"
    "five_minutes"                              = "Five minutes"
    "five_minutes_not_passed"                   = "Five minutes not passed yet"
    "feet_set" = "feet set" # new
    "appr_path_clear_of_tfc" = "approach path clear of traffic" # new
    "i_have_ctrl" = "I have control" # new
    "you_have_ctrl" = "You have control" # new
    "left" = "Left" # new
    "center" = "Center" # new
    "right" = "Right" # new
} 

# Find Python automatically
$pythonExe = Get-Command python.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
if (-not $pythonExe) { $pythonExe = "py" } # Fallback to launcher


# === DYNAMIC FFmpeg SEARCH ===
$ffmpegExe = Get-Command ffmpeg -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source

if (-not $ffmpegExe) {
    # Fallback to your specific path if it's not in the System PATH
    $ffmpegExe = "C:\Users\extra\Downloads\Wwise-Unpacker-master\Tools\ffmpeg.exe"
}

if (-not (Test-Path $ffmpegExe)) {
    Write-Error "FFmpeg NOT FOUND! Please install it or check the path: $ffmpegExe"
    exit 1
}
Write-Host "Using FFmpeg from: $ffmpegExe" -ForegroundColor Yellow

# === VOICE GENERATION LOOP ===
foreach ($voiceName in $voicesToGenerate) {
    
    $voiceShortName = ($voiceName -replace '^.*-([A-Za-z]+)Neural$', '$1')
    $outDir = Join-Path $PSScriptRoot "..\src-tauri\sounds\$voiceShortName"
    $outDir = [System.IO.Path]::GetFullPath($outDir)
    New-Item -ItemType Directory -Force -Path $outDir | Out-Null

    Write-Host "`n>>> STARTING VOICE: $voiceShortName" -ForegroundColor Cyan

    foreach ($file in $phrases.Keys) {
        $text = $phrases[$file]
        $mp3Path = "$outDir\$file.mp3"
        $oggPath = "$outDir\$file.ogg"

        try {
            # Use edge-tts (free)
            edge-tts --voice $voiceName --text "$text" --write-media "$mp3Path"
            
            # Convert to OGG
            if (Test-Path $mp3Path) {
                & $ffmpegExe -i "$mp3Path" -c:a libvorbis -q:a 4 "$oggPath" -y -loglevel error
                Remove-Item $mp3Path -ErrorAction SilentlyContinue
                Write-Host "  [OK] $file"
            }
        }
        catch {
            Write-Error "Failed $file : $_"
        }
    }
}

Write-Host "Completed! Audio files created in $outDir"