export const PROBE_COMMANDS = {
  Klipper: [
    "QUERY_PROBE",
    "PROBE",
    "PROBE_ACCURACY",
    "PROBE_CALIBRATE",
    "BED_MESH_CALIBRATE",
    "Z_TILT_ADJUST",
    "QUAD_GANTRY_LEVEL",
  ],
  Cartographer: [
    "CARTOGRAPHER_QUERY",
    "CARTOGRAPHER_SCAN_PROBE",
    "CARTOGRAPHER_SCAN_ACCURACY",
    "CARTOGRAPHER_SCAN_CALIBRATE",
    "CARTOGRAPHER_TOUCH_HOME",
    "CARTOGRAPHER_TOUCH_PROBE",
    "CARTOGRAPHER_TOUCH_ACCURACY",
    "CARTOGRAPHER_TOUCH_CALIBRATE",
  ],
} as const;

export type ProbeCommand = (typeof PROBE_COMMANDS)[keyof typeof PROBE_COMMANDS][number];

export const PROBE_COMMAND_NAMES: ReadonlySet<string> = new Set(Object.values(PROBE_COMMANDS).flat());
