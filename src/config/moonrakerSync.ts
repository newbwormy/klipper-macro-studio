import { invoke } from "@tauri-apps/api/core";
import { PrinterProfile, SimInitialState } from "../sim/types";
import { readMacroSections, type ParsedMacroEntry } from "./klipperCfgParser";

export interface MoonrakerSyncResult {
  profile: PrinterProfile;
  initialState: SimInitialState;
  configSettings: Record<string, Record<string, unknown>>;
  macros: ParsedMacroEntry[];
  source: string;
}

export async function syncFromMoonraker(
  baseUrl: string,
  existingFixtures = [] as PrinterProfile["fixtures"]
): Promise<MoonrakerSyncResult> {
  const address = baseUrl.trim();
  const hasScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(address);
  const url = new URL(hasScheme ? address : `http://${address}`);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Enter a Moonraker HTTP or HTTPS address without credentials, a query, or a fragment.");
  }
  const directHttp = url.protocol === "http:" && url.pathname === "/";
  if ((!hasScheme || directHttp) && !url.port && !/:\d+(?:\/|$)/.test(address)) url.port = "7125";
  const normalized = url.href.replace(/\/+$/, "");

  const raw = await invoke<{ result?: { status?: Record<string, any> } }>(
    "fetch_moonraker_snapshot",
    { baseUrl: normalized }
  );

  const status = raw?.result?.status;
  if (!status) throw new Error("Unexpected Moonraker response format.");

  const th = status.toolhead ?? {};
  const ext = status.extruder ?? {};
  const bed = status.heater_bed ?? {};
  const gm = status.gcode_move ?? {};
  const settings = status.configfile?.settings ?? {};
  const macros = new Map(readMacroSections(settings).map(macro => [macro.name.toLowerCase(), macro]));
  for (const macro of readMacroSections(status.configfile?.config ?? {})) {
    macros.set(macro.name.toLowerCase(), macro);
  }

  const minArr = th.axis_minimum ?? [0, 0, 0];
  const maxArr = th.axis_maximum ?? [250, 250, 250];
  const posArr = th.position ?? [0, 0, 0, 0];

  const profile: PrinterProfile = {
    name: `Moonraker (${normalized.replace(/^https?:\/\//, "")})`,
    axisMin: { x: minArr[0] ?? 0, y: minArr[1] ?? 0, z: minArr[2] ?? 0 },
    axisMax: { x: maxArr[0] ?? 250, y: maxArr[1] ?? 250, z: maxArr[2] ?? 250 },
    homePos: {
      x: settings.safe_z_home?.home_xy_position?.[0] ?? settings.stepper_x?.position_endstop ?? 0,
      y: settings.safe_z_home?.home_xy_position?.[1] ?? settings.stepper_y?.position_endstop ?? 0,
      z: settings.stepper_z?.position_endstop ?? 0,
    },
    minExtrudeTemp: settings.extruder?.min_extrude_temp ?? 170,
    maxVelocity: th.max_velocity ?? settings.printer?.max_velocity ?? 300,
    fixtures: existingFixtures,
  };

  const initialState: SimInitialState = {
    homedAxes: th.homed_axes ?? "",
    position: {
      x: posArr[0] ?? 0,
      y: posArr[1] ?? 0,
      z: posArr[2] ?? 0,
      e: posArr[3] ?? 0,
    },
    bedTemp: Math.round(bed.temperature ?? 25),
    toolTemp: Math.round(ext.temperature ?? 25),
    feedrate: gm.speed ?? 3000,
    absolutePos: gm.absolute_coordinates ?? true,
    absoluteExtrude: gm.absolute_extrude ?? true,
  };

  return { profile, initialState, configSettings: settings, macros: [...macros.values()], source: normalized };
}
