import { PrinterProfile, SimInitialState, SimIssue, SimSegment, SimulationResult, Vec3 } from "./types";

interface SavedState {
  absolutePos: boolean;
  absoluteExtrude: boolean;
  feedrate: number;
  position: { x: number; y: number; z: number; e: number };
}

function parseKlipperParams(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  const regex = /([A-Za-z0-9_]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(raw)) !== null) {
    out[m[1].toUpperCase()] = m[2] ?? m[3] ?? m[4] ?? "";
  }
  return out;
}

function parseStandardWords(tokens: string[]): Record<string, number> {
  const words: Record<string, number> = {};
  for (const t of tokens) {
    const letter = t[0]?.toUpperCase();
    const val = parseFloat(t.slice(1));
    if (letter && !Number.isNaN(val)) words[letter] = val;
  }
  return words;
}

export function simulateGcode(
  renderedGcode: string,
  profile: PrinterProfile,
  initial: SimInitialState
): SimulationResult {
  const segments: SimSegment[] = [];
  const issues: SimIssue[] = [];
  const savedStates = new Map<string, SavedState>();

  let pos = { ...initial.position };
  let homed = new Set(initial.homedAxes.toLowerCase().split("").filter(Boolean));
  let absolutePos = initial.absolutePos;
  let absoluteExtrude = initial.absoluteExtrude;
  let feedrate = initial.feedrate || 3000;
  let bedTemp = initial.bedTemp;
  let bedTarget = initial.bedTemp;
  let toolTemp = initial.toolTemp;
  let toolTarget = initial.toolTemp;
  let fanSpeed = 0;
  let currentTime = 0;
  let segId = 0;

  const pushSegment = (
    lineNumber: number,
    gcode: string,
    type: SimSegment["type"],
    from: Vec3,
    to: Vec3,
    duration: number,
    eDelta = 0,
    message?: string
  ) => {
    const safeDuration = Math.max(duration, 0.02);
    segments.push({
      id: segId++,
      lineNumber,
      gcode,
      type,
      from: { ...from },
      to: { ...to },
      eDelta,
      startTime: currentTime,
      endTime: currentTime + safeDuration,
      bedTemp,
      bedTarget,
      toolTemp,
      toolTarget,
      fanSpeed,
      message,
    });
    currentTime += safeDuration;
  };

  const lines = renderedGcode.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const lineNumber = i + 1;
    const clean = lines[i].split(";")[0].split("#")[0].trim();
    if (!clean) continue;

    const tokens = clean.split(/\s+/);
    const cmd = tokens[0].toUpperCase();
    const rest = clean.slice(cmd.length).trim();

    if (cmd === "G90") { absolutePos = true; continue; }
    if (cmd === "G91") { absolutePos = false; continue; }
    if (cmd === "M82") { absoluteExtrude = true; continue; }
    if (cmd === "M83") { absoluteExtrude = false; continue; }

    if (cmd === "G92") {
      const w = parseStandardWords(tokens.slice(1));
      if (w.X !== undefined) pos.x = w.X;
      if (w.Y !== undefined) pos.y = w.Y;
      if (w.Z !== undefined) pos.z = w.Z;
      if (w.E !== undefined) pos.e = w.E;
      continue;
    }

    if (cmd === "G28") {
      const from = { x: pos.x, y: pos.y, z: pos.z };
      const axesSpecified = tokens
        .slice(1)
        .map((t) => t[0]?.toUpperCase())
        .filter((a) => ["X", "Y", "Z"].includes(a));
      const axes = axesSpecified.length ? axesSpecified : ["X", "Y", "Z"];

      for (const axis of axes) {
        if (axis === "X") { pos.x = profile.homePos.x; homed.add("x"); }
        if (axis === "Y") { pos.y = profile.homePos.y; homed.add("y"); }
        if (axis === "Z") { pos.z = profile.homePos.z; homed.add("z"); }
      }
      pushSegment(lineNumber, clean, "home", from, { x: pos.x, y: pos.y, z: pos.z }, 1.0, 0, `Homed ${axes.join("")}`);
      continue;
    }

    if (cmd === "G0" || cmd === "G1") {
      const w = parseStandardWords(tokens.slice(1));
      if (w.F !== undefined && w.F > 0) feedrate = w.F;

      const from = { x: pos.x, y: pos.y, z: pos.z };
      const next = { ...pos };

      if (w.X !== undefined) next.x = absolutePos ? w.X : pos.x + w.X;
      if (w.Y !== undefined) next.y = absolutePos ? w.Y : pos.y + w.Y;
      if (w.Z !== undefined) next.z = absolutePos ? w.Z : pos.z + w.Z;

      let eDelta = 0;
      if (w.E !== undefined) {
        eDelta = absoluteExtrude ? w.E - pos.e : w.E;
        next.e = absoluteExtrude ? w.E : pos.e + w.E;
      }

      if ((w.X !== undefined && !homed.has("x")) ||
          (w.Y !== undefined && !homed.has("y")) ||
          (w.Z !== undefined && !homed.has("z"))) {
        issues.push({
          lineNumber,
          gcode: clean,
          severity: "error",
          message: "Must home axis first before moving.",
        });
      }

      const outOfBounds =
        next.x < profile.axisMin.x || next.x > profile.axisMax.x ||
        next.y < profile.axisMin.y || next.y > profile.axisMax.y ||
        next.z < profile.axisMin.z || next.z > profile.axisMax.z;

      if (outOfBounds) {
        issues.push({
          lineNumber,
          gcode: clean,
          severity: "error",
          message: `Move out of range: (${next.x.toFixed(1)}, ${next.y.toFixed(1)}, ${next.z.toFixed(1)})`,
        });
      }

      if (Math.abs(eDelta) > 0.001 && toolTemp < profile.minExtrudeTemp) {
        issues.push({
          lineNumber,
          gcode: clean,
          severity: "error",
          message: `Extrude below minimum temp (${toolTemp}°C < ${profile.minExtrudeTemp}°C).`,
        });
      }

      const dist = Math.hypot(next.x - from.x, next.y - from.y, next.z - from.z);
      const speedMmS = Math.min(feedrate / 60, profile.maxVelocity);
      const moveDist = dist > 0 ? dist : Math.abs(eDelta);
      const duration = speedMmS > 0 ? moveDist / speedMmS : 0.05;

      const type: SimSegment["type"] =
        eDelta > 0.001 ? "extrude" : eDelta < -0.001 ? "retract" : "travel";

      pos = next;
      pushSegment(lineNumber, clean, type, from, { x: pos.x, y: pos.y, z: pos.z }, duration, eDelta);
      continue;
    }

    if (cmd === "G4") {
      const w = parseStandardWords(tokens.slice(1));
      const sec = (w.P ? w.P / 1000 : 0) + (w.S ?? 0);
      const p = { x: pos.x, y: pos.y, z: pos.z };
      pushSegment(lineNumber, clean, "wait", p, p, Math.min(sec, 5), 0, `Dwell ${sec.toFixed(2)}s`);
      continue;
    }

    if (cmd === "M104" || cmd === "M109") {
      const w = parseStandardWords(tokens.slice(1));
      if (w.S !== undefined) {
        toolTarget = w.S;
        if (cmd === "M109") toolTemp = w.S;
        const p = { x: pos.x, y: pos.y, z: pos.z };
        pushSegment(
          lineNumber,
          clean,
          "temp",
          p,
          p,
          cmd === "M109" ? 0.8 : 0.05,
          0,
          `${cmd === "M109" ? "Wait" : "Set"} Hotend ${w.S}°C`
        );
      }
      continue;
    }

    if (cmd === "M140" || cmd === "M190") {
      const w = parseStandardWords(tokens.slice(1));
      if (w.S !== undefined) {
        bedTarget = w.S;
        if (cmd === "M190") bedTemp = w.S;
        const p = { x: pos.x, y: pos.y, z: pos.z };
        pushSegment(
          lineNumber,
          clean,
          "temp",
          p,
          p,
          cmd === "M190" ? 0.8 : 0.05,
          0,
          `${cmd === "M190" ? "Wait" : "Set"} Bed ${w.S}°C`
        );
      }
      continue;
    }

    if (cmd === "M106") {
      const w = parseStandardWords(tokens.slice(1));
      fanSpeed = Math.min(1, Math.max(0, (w.S ?? 255) / 255));
      continue;
    }
    if (cmd === "M107") { fanSpeed = 0; continue; }

    if (cmd === "SAVE_GCODE_STATE") {
      const p = parseKlipperParams(rest);
      const name = p.NAME || "default";
      savedStates.set(name, {
        absolutePos,
        absoluteExtrude,
        feedrate,
        position: { ...pos },
      });
      continue;
    }

    if (cmd === "RESTORE_GCODE_STATE") {
      const p = parseKlipperParams(rest);
      const name = p.NAME || "default";
      const saved = savedStates.get(name);
      if (!saved) {
        issues.push({
          lineNumber,
          gcode: clean,
          severity: "error",
          message: `Unknown gcode state: "${name}"`,
        });
        continue;
      }
      absolutePos = saved.absolutePos;
      absoluteExtrude = saved.absoluteExtrude;
      feedrate = saved.feedrate;

      if (p.MOVE === "1") {
        const from = { x: pos.x, y: pos.y, z: pos.z };
        const speed = Number(p.MOVE_SPEED) || 100;
        const dist = Math.hypot(
          saved.position.x - from.x,
          saved.position.y - from.y,
          saved.position.z - from.z
        );
        pos = { ...saved.position };
        pushSegment(lineNumber, clean, "travel", from, { x: pos.x, y: pos.y, z: pos.z }, dist / speed, 0, `Restore state "${name}"`);
      }
      continue;
    }

    if (cmd === "RESPOND") {
      const p = parseKlipperParams(rest);
      const pt = { x: pos.x, y: pos.y, z: pos.z };
      pushSegment(lineNumber, clean, "info", pt, pt, 0.05, 0, p.MSG || rest);
      continue;
    }
  }

  return { segments, issues, totalDuration: currentTime };
}
