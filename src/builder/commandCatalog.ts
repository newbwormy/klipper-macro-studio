import { firmwareCommands } from "./firmwareCommands";
import { eddyNgCommandGroups, PROBE_COMMANDS } from "./probeCommands";

export const commandCatalog: Record<string, { reference: string; groups: Record<string, readonly string[]> }> = {
  Klipper: { reference: "https://www.klipper3d.org/G-Codes.html", groups: firmwareCommands.Klipper },
  Kalico: { reference: "https://docs.kalico.gg/G-Codes.html", groups: firmwareCommands.Kalico },
  Cartographer: {
    reference: "https://docs.cartographer3d.com/cartographer-probe/reference/macros-reference/",
    groups: { Probe: [
      ...PROBE_COMMANDS.Cartographer, "CARTOGRAPHER_AXIS_TWIST_COMPENSATION",
      "CARTOGRAPHER_ESTIMATE_BACKLASH", "CARTOGRAPHER_SCAN_MODEL", "CARTOGRAPHER_STREAM",
      "CARTOGRAPHER_TEMPERATURE_CALIBRATE", "CARTOGRAPHER_TOUCH_MODEL",
    ] },
  },
  "Eddy-NG": {
    reference: "https://github.com/vvuk/eddy-ng/blob/main/docs/commands.md",
    groups: eddyNgCommandGroups,
  },
  Beacon: {
    reference: "https://docs.beacon3d.com/commands/",
    groups: {
      Probe: ["BEACON_QUERY", "BEACON_STREAM", "BEACON_CALIBRATE", "BEACON_ESTIMATE_BACKLASH",
        "BEACON_AUTO_CALIBRATE", "BEACON_POKE", "BEACON_OFFSET_COMPARE"],
      Models: ["BEACON_MODEL_SELECT", "BEACON_MODEL_SAVE", "BEACON_MODEL_REMOVE", "BEACON_MODEL_LIST"],
    },
  },
  KAMP: {
    reference: "https://github.com/kyleisah/Klipper-Adaptive-Meshing-Purging",
    groups: { "Mesh and purge": ["BED_MESH_CALIBRATE", "LINE_PURGE", "VORON_PURGE", "SMART_PARK"] },
  },
  "Shake&Tune": {
    reference: "https://github.com/Frix-x/klippain-shaketune/tree/main/docs",
    groups: { "Input shaping": ["AXES_MAP_CALIBRATION", "COMPARE_BELTS_RESPONSES", "AXES_SHAPER_CALIBRATION",
      "CREATE_VIBRATIONS_PROFILE", "EXCITATE_AXIS_AT_FREQ"] },
  },
  "Happy Hare": {
    reference: "https://moggieuk.github.io/Happy-Hare-Doc/Reference-Commands/",
    groups: { MMU: ["MMU_HOME", "MMU_SELECT", "MMU_LOAD", "MMU_UNLOAD", "MMU_EJECT",
      "MMU_CHANGE_TOOL", "MMU_STATUS", "MMU_PAUSE", "MMU_CHECK_GATE",
      "MMU_PRELOAD", "MMU_STATS"] },
  },
  AFC: {
    reference: "https://github.com/ArmoredTurtle/AFC-Klipper-Add-On",
    groups: { "Filament changer": ["TOOL_LOAD", "TOOL_UNLOAD", "CHANGE_TOOL", "AFC_STATS",
      "AFC_RESET_STATS", "AFC_CHANGE_BLADE", "AFC_CLEAR_MESSAGE", "AFC_QUIET_MODE", "AFC_TOGGLE_MACRO"] },
  },
};

export const catalogCommandNames: ReadonlySet<string> = new Set(Object.values(commandCatalog)
  .flatMap(({ groups }) => Object.values(groups).flat()));

export const jinjaHelpers = {
  "For loop": "{% for index in range(3) %}\n  G4 P100\n{% endfor %}",
  "Set variable": "{% set target = params.TARGET|default(60)|float %}",
  "Printer status": "{% set homed = printer.toolhead.homed_axes %}",
  "Raw parameters": "{% set raw = rawparams %}",
  "Report message": '{ action_respond_info("Macro started") }',
  "Log message (Kalico)": '{ action_log("Macro started") }',
  "Raise error": '{ action_raise_error("Macro aborted") }',
  "Emergency stop": '{ action_emergency_stop("Macro requested shutdown") }',
  "Remote method": '{ action_call_remote_method("method_name") }',
  "Early return (Kalico)": "RETURN",
};

export const pythonHelpers = {
  "emit": 'emit("G4 P100")',
  "params": 'target = float(params.get("TARGET", "60"))',
  "rawparams": "respond_info(rawparams)",
  "own_vars": "respond_info(str(own_vars))",
  "printer": 'respond_info(str(printer["toolhead"]["homed_axes"]))',
  "wait_while": 'wait_while(lambda: printer["extruder"]["temperature"] < 180)',
  "wait_until": 'wait_until(lambda: printer["extruder"]["temperature"] >= 180)',
  "wait_moves": "wait_moves()",
  "blocking": "result = blocking(lambda: math.sqrt(16))",
  "sleep": "sleep(1)",
  "set_gcode_variable": 'set_gcode_variable("MACRO_NAME", "variable_name", 1)',
  "respond_info": 'respond_info("Macro started")',
  "action_log": 'action_log("Macro started")',
  "raise_error": 'raise_error("Macro aborted")',
  "emergency_stop": 'emergency_stop("Macro requested shutdown")',
  "call_remote_method": 'call_remote_method("method_name")',
  "math": "angle = math.radians(90)",
};
