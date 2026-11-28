import { PrinterProfile } from "../sim/types";

export interface ParsedMacroEntry {
  name: string;
  description: string;
  variables: Record<string, unknown>;
  gcode: string;
  options: Record<string, string>;
}

export interface ParsedKlipperConfig {
  profile: PrinterProfile;
  settings: Record<string, Record<string, unknown>>;
  macros: ParsedMacroEntry[];
  includes: string[];
}

function parseKlipperValue(raw: string): unknown {
  const s = raw.trim();
  if (s === "True" || s === "true") return true;
  if (s === "False" || s === "false") return false;
  if (s === "None") return null;
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    return s.slice(1, -1);
  }
  if ((s.startsWith("[") && s.endsWith("]")) || (s.startsWith("{") && s.endsWith("}"))) {
    try {
      return JSON.parse(s.replace(/'/g, '"').replace(/\bTrue\b/g, "true").replace(/\bFalse\b/g, "false"));
    } catch {
      return s;
    }
  }
  return s;
}

function stripInlineComment(line: string): string {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) inDouble = !inDouble;
    else if ((ch === "#" || ch === ";") && !inSingle && !inDouble) {
      return line.slice(0, i).trimEnd();
    }
  }
  return line.trimEnd();
}

export function readMacroSections(sections: Record<string, unknown>): ParsedMacroEntry[] {
  const macros: ParsedMacroEntry[] = [];
  for (const [section, value] of Object.entries(sections)) {
    const match = /^gcode_macro\s+(.+)$/i.exec(section);
    if (!match || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const entries = Object.fromEntries(Object.entries(value).map(([key, entry]) => [key.toLowerCase(), entry]));
    if (typeof entries.gcode !== "string") continue;
    const options: Record<string, string> = {};
    const variables: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(entries)) {
      if (key === "gcode" || key === "description" || !/^[a-z0-9_.-]+$/.test(key)) continue;
      if (typeof entry === "string") options[key] = entry;
      if (key.startsWith("variable_")) {
        variables[key.slice(9)] = typeof entry === "string" ? parseKlipperValue(entry) : entry;
      }
    }
    macros.push({
      name: match[1].trim(),
      description: typeof entries.description === "string" ? entries.description : "",
      variables,
      options,
      gcode: entries.gcode,
    });
  }
  return macros;
}

export function parseKlipperConfig(
  files: string[],
  baseProfile?: Partial<PrinterProfile>
): ParsedKlipperConfig {
  const rawSections: Record<string, Record<string, string>> = {};
  const includes: string[] = [];

  for (const content of files) {
    let currentSection: string | null = null;
    let currentKey: string | null = null;

    for (const rawLine of content.split(/\r?\n/)) {
      const trimmed = rawLine.trim();
      const indented = /^[ \t]/.test(rawLine);
      if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
        if (currentSection && currentKey === "gcode" && (indented || !trimmed)) {
          rawSections[currentSection].gcode += "\n" + rawLine.replace(/^\s{1,4}/, "");
        }
        continue;
      }

      const secMatch = trimmed.match(/^\[([^\]]+)\]/);
      if (secMatch && !indented) {
        const header = secMatch[1].trim();
        if (header.toLowerCase().startsWith("include ")) {
          includes.push(header.slice(8).trim());
          currentSection = null;
          currentKey = null;
          continue;
        }
        currentSection = header;
        currentKey = null;
        if (!rawSections[currentSection]) rawSections[currentSection] = {};
        continue;
      }

      if (!currentSection) continue;

      if (indented && currentKey) {
        const lineText = currentKey === "gcode" ? rawLine.replace(/^\s{1,4}/, "") : stripInlineComment(trimmed);
        const prev = rawSections[currentSection][currentKey];
        rawSections[currentSection][currentKey] = prev ? `${prev}\n${lineText}` : lineText;
        continue;
      }

      const kvMatch = rawLine.match(/^([A-Za-z0-9_.-]+)\s*[:=]\s*(.*)$/);
      if (kvMatch) {
        currentKey = kvMatch[1].toLowerCase();
        const val = currentKey === "gcode" ? kvMatch[2] : stripInlineComment(kvMatch[2]);
        rawSections[currentSection][currentKey] = val;
      }
    }
  }

  const settings: Record<string, Record<string, unknown>> = {};

  for (const [secName, entries] of Object.entries(rawSections)) {
    const typed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(entries)) {
      typed[k] = k === "gcode" ? v : parseKlipperValue(v);
    }
    settings[secName.toLowerCase()] = typed;

  }

  const num = (sec: string, key: string, fallback: number): number => {
    const val = settings[sec]?.[key];
    return typeof val === "number" && !Number.isNaN(val) ? val : fallback;
  };

  let homeX = num("stepper_x", "position_endstop", 0);
  let homeY = num("stepper_y", "position_endstop", 0);
  const safeHome = String(settings["safe_z_home"]?.["home_xy_position"] ?? "");
  if (safeHome.includes(",")) {
    const [sx, sy] = safeHome.split(",").map((n) => parseFloat(n.trim()));
    if (!Number.isNaN(sx) && !Number.isNaN(sy)) {
      homeX = sx;
      homeY = sy;
    }
  }

  const profile: PrinterProfile = {
    name: baseProfile?.name ?? "Imported Klipper Printer",
    axisMin: {
      x: num("stepper_x", "position_min", 0),
      y: num("stepper_y", "position_min", 0),
      z: num("stepper_z", "position_min", 0),
    },
    axisMax: {
      x: num("stepper_x", "position_max", 250),
      y: num("stepper_y", "position_max", 250),
      z: num("stepper_z", "position_max", 250),
    },
    homePos: {
      x: homeX,
      y: homeY,
      z: num("stepper_z", "position_endstop", 0),
    },
    minExtrudeTemp: num("extruder", "min_extrude_temp", 170),
    maxVelocity: num("printer", "max_velocity", 300),
    fixtures: baseProfile?.fixtures ?? [],
  };

  return { profile, settings, macros: readMacroSections(rawSections), includes };
}
