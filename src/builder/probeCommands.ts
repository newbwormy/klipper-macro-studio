const simulatedProbeCommands = {
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

export const eddyNgCommandGroups = {
  Calibration: ["PROBE_EDDY_NG_SETUP", "PROBE_EDDY_NG_AUTO_SETUP", "PROBE_EDDY_NG_CALIBRATE",
    "PROBE_EDDY_NG_CALIBRATION_STATUS", "PROBE_EDDY_NG_CLEAR_CALIBRATION", "PROBE_EDDY_NG_TEST_DRIVE_CURRENT"],
  Probe: ["PROBE_EDDY_NG_TAP", "PROBE_EDDY_NG_PROBE", "PROBE_EDDY_NG_PROBE_STATIC",
    "PROBE_EDDY_NG_PROBE_ACCURACY", "PROBE_EDDY_NG_STATUS"],
  Profiles: ["PROBE_EDDY_NG_SET_TAP_ADJUST_Z", "PROBE_EDDY_NG_SET_TAP_OFFSET", "PROBE_EDDY_NG_PLATE_PROFILE",
    "PROBE_EDDY_NG_TAP_PROFILE"],
  Diagnostics: ["PROBE_EDDY_NG_STREAM_START", "PROBE_EDDY_NG_STREAM_STOP"],
} as const;

export const PROBE_COMMANDS = {
  ...simulatedProbeCommands,
  "Eddy-NG": Object.values(eddyNgCommandGroups).flat(),
};

export type ProbeCommand = (typeof PROBE_COMMANDS)[keyof typeof PROBE_COMMANDS][number];

export const SIMULATED_PROBE_COMMANDS: ReadonlySet<string> = new Set(Object.values(simulatedProbeCommands).flat());
