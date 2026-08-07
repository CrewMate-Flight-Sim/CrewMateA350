namespace VoiceSidecar
{
    public record VoiceCommand(string Type, string Raw, Dictionary<string, object> Payload);

    /// Dispatches a recognized grammar result to a structured VoiceCommand.
    public static class CommandDispatcher
    {
        public static VoiceCommand? Dispatch(
            string actionRuleId,
            string cmdId,
            string cmdValue,
            string rawText
        )
        {
            if (!int.TryParse(cmdId, out var pid))
                return null;

            return actionRuleId switch
            {
                "FO_COMMANDS" => DispatchFo(pid, cmdValue, rawText),
                "FMA_CALLOUTS" => DispatchFma(cmdValue, rawText),
                "DISCRETE_COMMANDS" => DispatchDiscrete(pid, rawText),
                _ => null,
            };
        }

        // FO_COMMANDS
        private static VoiceCommand? DispatchFo(int pid, string cval, string raw)
        {
            return pid switch
            {
                1 => Heading(cval, raw),
                2 => FlightLevel(cval, raw),
                3 => AltitudeFeet(cval, raw),
                4 => Speed(cval, raw),
                7 => Altimeter(cval, raw),
                8 => Fuel(cval, "kg", balanced: false, raw),
                9 => Fuel(cval, "kg", balanced: true, raw),
                10 => Fuel(cval, "lbs", balanced: false, raw),
                11 => Fuel(cval, "lbs", balanced: true, raw),
                12 => FuelTons(cval, balanced: false, raw),
                13 => FuelTons(cval, balanced: true, raw),
                14 => TakeoffData(cval, raw),
                15 => TakeoffData(cval, raw),
                16 => MissedApproachAuto(raw),
                17 => MissedApproachFeet(cval, raw),
                18 => MissedApproachFL(cval, raw),
                19 => Minimums(cval, "baro", raw),
                20 => Minimums(cval, "radio", raw),
                _ => null,
            };
        }

        private static VoiceCommand? Heading(string cval, string raw)
        {
            if (!int.TryParse(cval, out var v) || v < 0 || v > 359)
                return null;
            return Cmd("heading", raw, new() { ["value"] = v });
        }

        private static VoiceCommand? FlightLevel(string cval, string raw)
        {
            if (!int.TryParse(cval, out var fl) || fl < 10 || fl > 450)
                return null;
            return Cmd(
                "altitude",
                raw,
                new()
                {
                    ["value"] = fl * 100,
                    ["unit"] = "feet",
                    ["flightLevel"] = fl,
                }
            );
        }

        private static VoiceCommand? AltitudeFeet(string cval, string raw)
        {
            if (!int.TryParse(cval, out var v) || v < 100 || v > 60000)
                return null;
            return Cmd("altitude", raw, new() { ["value"] = v, ["unit"] = "feet" });
        }

        private static VoiceCommand? Speed(string cval, string raw)
        {
            if (!int.TryParse(cval, out var v) || v < 60 || v > 400)
                return null;
            return Cmd("speed", raw, new() { ["value"] = v, ["unit"] = "knots" });
        }

        private static VoiceCommand? Altimeter(string cval, string raw)
        {
            if (!int.TryParse(cval, out var v))
                return null;

            // inHg
            if (v is >= 2700 and <= 3100)
            {
                return Cmd(
                    "altimeter",
                    raw,
                    new()
                    {
                        ["value"] = Math.Round(v / 100.0, 2),
                        ["unit"] = "inHg",
                        ["raw"] = v,
                    }
                );
            }

            // hPa
            if (v is >= 900 and <= 1100)
                return Cmd(
                    "altimeter",
                    raw,
                    new()
                    {
                        ["value"] = v,
                        ["unit"] = "hPa",
                        ["raw"] = v,
                    }
                );

            return null;
        }

        private static VoiceCommand? Fuel(string cval, string unit, bool balanced, string raw)
        {
            // cval = "thousands|hundreds" e.g. "60|600" → 60600
            var parts = cval.Split('|');
            if (parts.Length != 2)
                return null;
            if (!int.TryParse(parts[0], out var thousands))
                return null;
            if (!int.TryParse(parts[1], out var hundreds))
                return null;
            var qty = thousands * 1000 + hundreds;
            if (qty <= 0 || qty > 999_999)
                return null;
            return Cmd(
                "fuel",
                raw,
                new()
                {
                    ["quantity"] = qty,
                    ["unit"] = unit,
                    ["balanced"] = balanced,
                }
            );
        }

        private static VoiceCommand? FuelTons(string cval, bool balanced, string raw)
        {
            // cval = "18.5"
            if (
                !double.TryParse(
                    cval,
                    System.Globalization.NumberStyles.Any,
                    System.Globalization.CultureInfo.InvariantCulture,
                    out var tons
                )
            )
                return null;
            if (tons <= 0 || tons > 999)
                return null;
            return Cmd(
                "fuel",
                raw,
                new()
                {
                    ["quantity"] = Math.Round(tons, 1),
                    ["unit"] = "t",
                    ["balanced"] = balanced,
                }
            );
        }

        private static VoiceCommand MissedApproachAuto(string raw) =>
            Cmd("missed_approach_altitude", raw, new() { ["mode"] = "auto" });

        private static VoiceCommand? MissedApproachFeet(string cval, string raw)
        {
            if (!int.TryParse(cval, out var v) || v < 100 || v > 60000)
                return null;
            return Cmd(
                "missed_approach_altitude",
                raw,
                new()
                {
                    ["mode"] = "manual",
                    ["value"] = v,
                    ["unit"] = "feet",
                }
            );
        }

        private static VoiceCommand? MissedApproachFL(string cval, string raw)
        {
            if (!int.TryParse(cval, out var fl) || fl < 10 || fl > 450)
                return null;
            return Cmd(
                "missed_approach_altitude",
                raw,
                new()
                {
                    ["mode"] = "manual",
                    ["value"] = fl * 100,
                    ["unit"] = "feet",
                    ["flightLevel"] = fl,
                }
            );
        }

        private static VoiceCommand? Minimums(string cval, string type, string raw)
        {
            // cval = plain integer string: "450", "160", "1000", "50"
            // type = "baro" | "radio"
            // Realistic range: 0–10000 ft. Grammar only generates values that SAPI
            // actually heard, so we just sanity-check the bounds.
            if (!int.TryParse(cval, out var v) || v < 0 || v > 10000)
                return null;
            return Cmd(
                "minimums",
                raw,
                new()
                {
                    ["type"] = type,
                    ["value"] = v,
                    ["unit"] = "feet",
                }
            );
        }

        private static VoiceCommand? TakeoffData(string cval, string raw)
        {
            // cval = "V1|VR|V2|thrustMode|flexTemp"
            // e.g.  "130|135|142|FLX|65"  or  "130|135|142|TOGA|"
            var parts = cval.Split('|');
            if (parts.Length != 5)
                return null;

            if (!int.TryParse(parts[0], out var v1) || v1 < 100 || v1 > 199)
                return null;
            if (!int.TryParse(parts[1], out var vr) || vr < 100 || vr > 199)
                return null;
            if (!int.TryParse(parts[2], out var v2) || v2 < 100 || v2 > 199)
                return null;

            var thrust = parts[3]; // "FLX" or "TOGA"
            var flexTemp = parts[4];

            var payload = new Dictionary<string, object>
            {
                ["v1"] = v1,
                ["vr"] = vr,
                ["v2"] = v2,
                ["thrust"] = thrust,
            };

            if (flexTemp.Length > 0 && int.TryParse(flexTemp, out var ft))
                payload["flexTemp"] = ft;

            return Cmd("takeoff_data", raw, payload);
        }

        private static VoiceCommand DispatchFma(string cval, string raw)
        {
            var payload = new Dictionary<string, object>();

            // urgent: "||||||A.FLOOR"
            var parts = cval.Split('|');

            // parts[0]=thrust, [1]=vertical, [2]=lateral, [3]=combined,
            //         [4]=approachCat, [5]=armed, [6]=urgent
            void Set(int i, string key)
            {
                if (parts.Length > i && parts[i].Length > 0)
                    payload[key] = parts[i];
            }

            Set(0, "thrust");
            Set(1, "vertical");
            Set(2, "lateral");
            Set(3, "combined");
            Set(4, "approachCat");
            Set(5, "armed");
            Set(6, "urgent");

            // extract flexTemp from thrust if present: "MAN FLX/65" → flexTemp="65"
            if (
                payload.TryGetValue("thrust", out var t)
                && t is string ts
                && ts.StartsWith("MAN FLX/")
            )
                payload["flexTemp"] = ts[8..];

            return Cmd("fma_callout", raw, payload);
        }

        // ─── DISCRETE_COMMANDS ────────────────────────────────────────────────────

        private static readonly Dictionary<int, string> DiscreteNames = new()
        {
            // Gear
            [1] = "gear_up",
            [2] = "gear_down",
            // Flaps
            [3] = "flaps_0",
            [4] = "flaps_1",
            [5] = "flaps_2",
            [6] = "flaps_3",
            [7] = "flaps_full",
            // Autopilot
            [8] = "autopilot_engage",
            [9] = "autopilot_disconnect",
            [65] = "set_runway_track",
            [102] = "pull_altitude",
            [103] = "manage_altitude",
            [104] = "pull_speed",
            [105] = "manage_speed",
            [106] = "pull_heading",
            [107] = "manage_nav",
            [110] = "push_to_level_off",
            [111] = "arm_approach",
            [112] = "arm_localizer",
            // Lights
            [12] = "landing_lights_on",
            [13] = "landing_lights_off",
            [14] = "strobe_lights_on",
            [15] = "strobe_lights_auto",
            [16] = "strobe_lights_off",
            [17] = "taxi_lights_on",
            [18] = "taxi_lights_off",
            [69] = "takeoff_lights_on",
            // Flight director
            [19] = "flight_director_on",
            [20] = "flight_director_off",
            [21] = "flight_director_off_bird_on",
            [67] = "bird_on",
            [68] = "bird_off",
            // Checklists
            [22] = "checklist_cockpit_preparation",
            [23] = "checklist_departure_change",
            [24] = "checklist_before_start",
            [25] = "checklist_after_start",
            [26] = "checklist_taxi",
            [27] = "checklist_lineup",
            [28] = "checklist_approach",
            [29] = "checklist_landing",
            [30] = "checklist_parking",
            [31] = "checklist_secure_aircraft",
            [32] = "checklist_cancel",
            // Start preflight
            [33] = "prepare_aircraft",
            // Engine/apu start
            [34] = "engine_start_1",
            [35] = "engine_start_2",
            [36] = "apu_start",
            // Flows
            [37] = "clear_left",
            [38] = "runway_entry_procedure",
            [39] = "start_engine_2",
            [40] = "clear_for_takeoff",
            [123] = "before_start",
            // Shutdown
            [41] = "shutdown_engine_1",
            [42] = "shutdown_engine_2",
            [43] = "shutdown",
            // Flight controls
            [44] = "flight_controls_check",
            // Anti ice
            [45] = "wing_anti_ice_on",
            [46] = "wing_anti_ice_off",
            [47] = "engine_anti_ice_on",
            [48] = "engine_anti_ice_off",
            // Wipers
            [49] = "wipers_off",
            [50] = "wipers_slow",
            [51] = "wipers_fast",
            [52] = "wipers_slow_intermittent",
            [53] = "wipers_medium_intermittent",
            [54] = "wipers_fast_intermittent",
            // Seat belts
            [55] = "seat_belts_on",
            [56] = "seat_belts_off",
            [57] = "seat_belts_auto",
            // Parking
            [58] = "chocks_in_place",
            [59] = "parking_brake_set",
            // Cabin crew
            [60] = "cabin_crew_arm_slides",
            [121] = "cabin_crew_disarm_slides",
            // Brake
            [61] = "brake_check",
            // Altimeter
            [64] = "set_standard",
            [122] = "set_altimeter",
            // Generic checklist responses
            [70] = "confirm",
            [71] = "negative",
            [72] = "set",
            [73] = "checked",
            [74] = "on",
            [75] = "off",
            [76] = "armed",
            [77] = "auto",
            [78] = "normal",
            [79] = "retracted",
            [80] = "down",
            [81] = "secured",
            [82] = "removed",
            [83] = "released",
            [84] = "received",
            [85] = "started",
            [86] = "running",
            [87] = "advised",
            [88] = "signaled",
            [90] = "medium",
            [91] = "btv",
            [92] = "engines_on",
            [93] = "engines_on_wings_on",
            [94] = "on_supplied_by_apu",
            [95] = "config_1",
            [96] = "config_1f",
            [97] = "config_2",
            [98] = "config_3",
            [10] = "rwy_cond",
            // Go around / abort
            [99] = "go_around_flaps",
            [100] = "abort_takeoff",
            [101] = "continue",
            // Ground engineer
            [113] = "ground_call",
            [114] = "connect_gpu",
            [115] = "disconnect_gpu",
            [116] = "connect_asu",
            [117] = "disconnect_asu",
            [118] = "connect_acu",
            [119] = "disconnect_acu",
            [120] = "disconnect_all_ground",
            [124] = "pushback_request",
        };

        private static VoiceCommand? DispatchDiscrete(int pid, string raw)
        {
            if (!DiscreteNames.TryGetValue(pid, out var name))
                return null;
            return Cmd("discrete", raw, new() { ["command"] = name });
        }

        // ─── Helper ───────────────────────────────────────────────────────────────

        private static VoiceCommand Cmd(
            string type,
            string raw,
            Dictionary<string, object> payload
        ) => new(type, raw, payload);
    }
}
