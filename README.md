# CrewMate A350

[![Latest Release](https://img.shields.io/github/v/release/marxio09dio/CrewMateA350?label=Latest%20Release)](https://github.com/marxio09dio/CrewMateA350/releases)
![GitHub all releases](https://img.shields.io/github/downloads/CrewMate-Flight-Sim/CrewMateA350/total?label=Downloads&style=plastic)

[![Discord](https://img.shields.io/badge/discord-CrewMate-5865F2?logo=discord&logoColor=white)](https://discord.gg/aBZZWG2Y6F)

[![License](https://img.shields.io/badge/license-GPL%203.0-blue.svg)](LICENSE)

![CrewMate Logo](./src-tauri/icons/icon.png)

> **CrewMate A350** is a free and open-source alternative to Copilot-style apps for aircraft workflows.
> All data from the voice recognition is processed locally on your machine.

---

## Quick Links

- [Contribution Guidelines](.github/Contributing.md)
- [License](LICENSE)
- [Manual](Manual/USER_MANUAL.md)

---

## Installation and Usage

- **English** speech recognition must be installed in Windows (Settings → Time & language → Speech). Any regional English pack Windows offers (United States, United Kingdom, Australia, India, etc.) works — not US-only. If multiple English recognizers are installed, which one loads follows Windows’ order.
- To use the speech trainer, the OS Display Language needs to be set to EN-US

1. Install the .msi package
2. Open the CrewMate.exe (the voice recognition engine will start automatically)
3. Download and activate a voice model from the settings window

## Requirements

- Microsoft Flight Simulator 2020 or 2024
- Inibuilds A350

## Voice Commands (Examples)

<details>
<summary>Click to expand voice commands</summary>

- Gear Down / Gear Up
- Flaps 0, 1, 2, 3, Full
- Engine anti ice on/off
- Wing anti ice on/off
- Landing lights on/off
- Taxi lights on/off
- Strobe lights on/off
- Flight Director on/off
- Auto Pilot On
- Flight controls check

</details>

<details>
<summary>Sample Flow Triggers (Voice → Flow)</summary>

- `"before start procedure"` / `"before start flow"` → starts the **Before Start** flow
- `"clear left"` / `"clear on the left"` → left side check
- `"runway entry procedure"` / `"clear to line up"` / `"clear for takeoff"` → starts **Before Takeoff** flow
- `"lets prepare the aircraft"` / `"lets set up the aircraft"` → starts **Preflight** events

> Full list of available voice phrases and flow definitions:  
> `src/data/flows/` and `src/voice/`

</details>

---

## Reporting Bugs & Requesting Features

If you encounter a problem or want to request a new feature, please [open an issue](https://github.com/marxio09dio/CrewMateA350/issues).

---

## Want to Contribute?

Contributions are welcome! Check out the [Contribution Guidelines](.github/Contributing.md) to get started.

## License

This project is licensed under the GNU GPLv3.

This project is not endorsed by or affiliated with Microsoft or Inibuilds.
