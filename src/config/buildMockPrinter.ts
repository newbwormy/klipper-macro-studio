import { PrinterProfile, SimInitialState } from "../sim/types";
import { ParsedMacroEntry } from "./klipperCfgParser";

export function buildMockPrinterState(
  profile: PrinterProfile,
  initial: SimInitialState,
  configSettings: Record<string, Record<string, unknown>> = {},
  macros: ParsedMacroEntry[] = []
): Record<string, unknown> {
  const printer: Record<string, unknown> = {
    toolhead: {
      homed_axes: initial.homedAxes,
      axis_minimum: { x: profile.axisMin.x, y: profile.axisMin.y, z: profile.axisMin.z, e: 0 },
      axis_maximum: { x: profile.axisMax.x, y: profile.axisMax.y, z: profile.axisMax.z, e: 0 },
      position: { ...initial.position },
      max_velocity: profile.maxVelocity,
    },
    gcode_move: {
      absolute_coordinates: initial.absolutePos,
      absolute_extrude: initial.absoluteExtrude,
      gcode_position: { ...initial.position },
      speed: initial.feedrate,
    },
    extruder: {
      temperature: initial.toolTemp,
      target: initial.toolTemp,
      can_extrude: initial.toolTemp >= profile.minExtrudeTemp,
    },
    heater_bed: {
      temperature: initial.bedTemp,
      target: initial.bedTemp,
    },
    exclude_object: {
      objects: [],
      excluded_objects: [],
      current_object: null,
    },
    probe: {
      name: configSettings.cartographer ? "cartographer" : "probe",
      last_query: false,
      last_z_result: 0,
      last_probe_position: { x: initial.position.x, y: initial.position.y, z: 0 },
    },
    configfile: {
      settings: configSettings,
    },
  };

  for (const m of macros) {
    printer[`gcode_macro ${m.name}`] = { ...m.variables };
  }

  return printer;
}
