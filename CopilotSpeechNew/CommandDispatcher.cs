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
            return actionRuleId switch
            {
                "FO_COMMANDS" => int.TryParse(cmdId, out var pid) ? DispatchFo(pid, cmdValue, rawText) : null,
                "FMA_CALLOUTS" => DispatchFma(cmdValue, rawText),
                "DISCRETE_COMMANDS" => DispatchDiscrete(cmdId, rawText),
                _ => null,
            };
        }

        // Grammar ids are the command names (brake_fan_on), so a numeric id means an old grammar
        public static bool IsNumericDiscreteId(string actionRuleId, string cmdId) =>
            actionRuleId == "DISCRETE_COMMANDS" && cmdId.Length > 0 && cmdId.All(char.IsAsciiDigit);

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
                21 => Runway(cval, raw),
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

        private static VoiceCommand? Runway(string cval, string raw)
        {
            // cval = "identifier|designator" e.g. "09|L", "27|", "36|R"
            var parts = cval.Split('|');
            if (parts.Length < 1)
                return null;

            var identifier = parts[0];
            var designator = parts.Length > 1 ? parts[1] : string.Empty;

            var payload = new Dictionary<string, object>
            {
                ["runway"] = identifier + designator,
                ["identifier"] = identifier
            };

            if (!string.IsNullOrEmpty(designator))
                payload["designator"] = designator;

            return Cmd("runway", raw, payload);
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

        private static readonly System.Text.RegularExpressions.Regex SnakeCase = new("^[a-z][a-z0-9_]*$");

        private static VoiceCommand? DispatchDiscrete(string cmdId, string raw)
        {
            if (!SnakeCase.IsMatch(cmdId))
                return null;
            return Cmd("discrete", raw, new() { ["command"] = cmdId });
        }

        // ─── Helper ───────────────────────────────────────────────────────────────

        private static VoiceCommand Cmd(
            string type,
            string raw,
            Dictionary<string, object> payload
        ) => new(type, raw, payload);
    }
}