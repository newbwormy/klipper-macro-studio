import React, { useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { MacroDocument } from "./builder/blockTypes";
import { compileBrowserProbePreview, compileKlipperConfig, compileMacroBody } from "./builder/compiler";
import { buildMockPrinterState } from "./config/buildMockPrinter";
import { ParsedMacroEntry } from "./config/klipperCfgParser";
import { evaluateKlipperMacro } from "./lib/macroApi";
import { simulateGcode } from "./sim/gcodeSimulator";
import { PrinterProfile, SimInitialState, SimulationResult } from "./sim/types";
import { ExportToolbar } from "./components/ExportToolbar";
import { MacroBuilder } from "./components/MacroBuilder";
import { PrinterConfigPanel } from "./components/PrinterConfigPanel";
import { PrinterViewport } from "./components/PrinterViewport";
import sampleGcode from "./demo/prime-and-wipe.gcode?raw";

const browserDemo = !isTauri();

const DEFAULT_PROFILE: PrinterProfile = {
  name: "256mm CoreXY",
  axisMin: { x: 0, y: 0, z: 0 },
  axisMax: { x: 256, y: 256, z: 256 },
  homePos: { x: 128, y: 128, z: 0 },
  minExtrudeTemp: 170,
  maxVelocity: 300,
  fixtures: [
    {
      id: "purge",
      name: "Purge Bucket",
      min: { x: 0, y: 236, z: 0 },
      max: { x: 35, y: 256, z: 12 },
      color: "#eab308",
    },
  ],
};

const DEFAULT_INITIAL: SimInitialState = {
  homedAxes: "xyz",
  position: { x: 128, y: 128, z: 20, e: 0 },
  bedTemp: 60,
  toolTemp: 210,
  feedrate: 3000,
  absolutePos: true,
  absoluteExtrude: false,
};

const DEFAULT_MACRO: MacroDocument = {
  name: "DEMO_PRIME_AND_WIPE",
  description: "Homes if needed, heats, wipes over purge bucket, and lays a prime line",
  params: [
    { name: "BED_TEMP", defaultValue: "60", type: "float" },
    { name: "HOTEND_TEMP", defaultValue: "215", type: "float" },
  ],
  blocks: [
    { id: "b1", type: "save_state", name: "start_state" },
    { id: "b2", type: "positioning", mode: "G90", extrudeMode: "M83" },
    {
      id: "b3",
      type: "if_block",
      condition: "'xyz' not in printer.toolhead.homed_axes",
      thenBlocks: [{ id: "b3a", type: "home", axes: ["X", "Y", "Z"] }],
      elseBlocks: [],
    },
    { id: "b4", type: "temp", heater: "bed", wait: false, temp: "bed_temp" },
    { id: "b5", type: "temp", heater: "extruder", wait: true, temp: "hotend_temp" },
    { id: "b6", type: "move", rapid: true, x: "18", y: "245", z: "15", f: "9000" },
    { id: "b7", type: "move", rapid: false, e: "12", f: "300" },
    { id: "b8", type: "move", rapid: true, x: "15", y: "20", z: "0.3", f: "9000" },
    { id: "b9", type: "move", rapid: false, x: "15", y: "180", e: "15", f: "1500" },
    { id: "b10", type: "move", rapid: true, z: "15", f: "3000" },
    { id: "b11", type: "respond", message: "Prime and wipe complete!" },
  ],
};

export default function App() {
  const [profile, setProfile] = useState<PrinterProfile>(DEFAULT_PROFILE);
  const [initialState, setInitialState] = useState<SimInitialState>(DEFAULT_INITIAL);
  const [configSettings, setConfigSettings] = useState<Record<string, Record<string, unknown>>>({});
  const [importedMacros, setImportedMacros] = useState<ParsedMacroEntry[]>([]);
  const [testParams, setTestParams] = useState<Record<string, string>>({
    BED_TEMP: "65",
    HOTEND_TEMP: "220",
  });
  const [kalicoMode, setKalicoMode] = useState(false);

  const [macroDoc, setMacroDoc] = useState<MacroDocument>(DEFAULT_MACRO);
  const [renderedGcode, setRenderedGcode] = useState("");
  const [evalError, setEvalError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<SimulationResult>({
    segments: [],
    issues: [],
    totalDuration: 0,
  });

  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [centerTab, setCenterTab] = useState<"builder" | "code">("builder");

  const mockPrinter = useMemo(
    () => buildMockPrinterState(profile, initialState, configSettings, importedMacros),
    [profile, initialState, configSettings, importedMacros]
  );

  const browserProbeGcode = useMemo(() => {
    return browserDemo ? compileBrowserProbePreview(macroDoc) : "";
  }, [macroDoc]);

  useEffect(() => {
    if (!browserDemo) return;
    const gcode = browserProbeGcode || sampleGcode;
    setRenderedGcode(gcode);
    setSimResult(simulateGcode(gcode, DEFAULT_PROFILE, DEFAULT_INITIAL));
    setIsPlaying(false);
    setCurrentTime(0);
  }, [browserProbeGcode]);

  useEffect(() => {
    if (browserDemo) return;
    const timer = setTimeout(async () => {
      const body = compileMacroBody(macroDoc);
      try {
        const res = await evaluateKlipperMacro(body, mockPrinter, testParams, kalicoMode);
        if (res.ok && res.gcode !== undefined) {
          setRenderedGcode(res.gcode);
          setEvalError(null);
          const sim = simulateGcode(res.gcode, profile, initialState, configSettings);
          setSimResult(sim);
          setCurrentTime(0);
        } else {
          setEvalError(res.error ?? "Jinja2 evaluation failed");
        }
      } catch (err) {
        setEvalError(String(err));
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [macroDoc, mockPrinter, testParams, kalicoMode, profile, initialState, configSettings]);

  const handleTimeAdvance = (delta: number) => {
    setCurrentTime((prev) => {
      const next = prev + delta;
      if (next >= simResult.totalDuration) {
        setIsPlaying(false);
        return simResult.totalDuration;
      }
      return next;
    });
  };

  const activeSeg = useMemo(
    () =>
      simResult.segments.find((s) => currentTime >= s.startTime && currentTime <= s.endTime) ??
      simResult.segments[simResult.segments.length - 1],
    [simResult.segments, currentTime]
  );

  return (
    <div style={{ display: "grid", gridTemplateRows: "46px 1fr", height: "100vh", width: "100vw" }}>
      {/* Top Bar */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          background: "#0f172a",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <strong style={{ color: "#38bdf8" }}>Klipper Macro Studio</strong>
          <input
            value={macroDoc.name}
            onChange={(e) => setMacroDoc({ ...macroDoc, name: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
            style={{ width: 200, fontFamily: "monospace" }}
          />
          {!browserDemo && <label style={{ fontSize: 12, color: "#94a3b8" }}>
            <input
              type="checkbox"
              checked={kalicoMode}
              onChange={(e) => setKalicoMode(e.target.checked)}
            />{" "}
            Kalico Jinja2 Extensions
          </label>}
        </div>
        <ExportToolbar doc={macroDoc} />
      </header>

      {/* Main 3-Pane Workspace */}
      <div style={{ display: "grid", gridTemplateColumns: "290px 1fr 480px", overflow: "hidden" }}>
        {/* Left: Printer Config & State */}
        <aside style={{ borderRight: "1px solid #1e293b", background: "#020617", overflow: "hidden" }}>
          {browserDemo ? (
            <div style={{ padding: 12, fontSize: 13 }}>
              <strong>Browser demo</strong>
              <p>{DEFAULT_PROFILE.name} · Prime and wipe</p>
              <p>Add a top-level Probe block and press Play to preview it alongside other literal G-code. With no probe commands, playback uses the prime-and-wipe sample.</p>
              <p>Use the desktop app to evaluate Jinja2 or connect to Moonraker.</p>
            </div>
          ) : <PrinterConfigPanel
            profile={profile}
            initialState={initialState}
            testParams={testParams}
            onProfileChange={setProfile}
            onInitialStateChange={setInitialState}
            onTestParamsChange={setTestParams}
            onConfigImported={(parsed) => {
              setConfigSettings(parsed.settings);
              setImportedMacros(parsed.macros);
            }}
            onMoonrakerSynced={(settings) => setConfigSettings(settings)}
          />}
        </aside>

        {/* Center: Visual Builder / Live Code */}
        <main style={{ display: "grid", gridTemplateRows: "36px 1fr", borderRight: "1px solid #1e293b", overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 6, padding: "4px 10px", background: "#0f172a", borderBottom: "1px solid #1e293b" }}>
            <button
              type="button"
              onClick={() => setCenterTab("builder")}
              style={{ background: centerTab === "builder" ? "#2563eb" : "#1e293b" }}
            >
              Visual Builder
            </button>
            <button
              type="button"
              onClick={() => setCenterTab("code")}
              style={{ background: centerTab === "code" ? "#2563eb" : "#1e293b" }}
            >
              Generated Macro &amp; Rendered G-code
            </button>
          </div>

          {centerTab === "builder" ? (
            <MacroBuilder doc={macroDoc} onChange={setMacroDoc} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <strong style={{ fontSize: 12, marginBottom: 6 }}>Compiled [gcode_macro]</strong>
                <pre style={{ flex: 1, margin: 0, padding: 10, background: "#0f172a", overflow: "auto", fontSize: 12 }}>
                  {compileKlipperConfig(macroDoc)}
                </pre>
              </div>
              <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                <strong style={{ fontSize: 12, marginBottom: 6 }}>
                  {browserDemo ? (browserProbeGcode ? "Probe Preview G-code" : "Bundled Sample G-code") : "Evaluated G-code (Real Jinja2 Output)"}
                </strong>
                <pre style={{ flex: 1, margin: 0, padding: 10, background: "#0f172a", overflow: "auto", fontSize: 12, color: "#93c5fd" }}>
                  {evalError ? `ERROR: ${evalError}` : renderedGcode}
                </pre>
              </div>
            </div>
          )}
        </main>

        {/* Right: 3D Simulator + Playback Controls */}
        <section style={{ display: "grid", gridTemplateRows: "1fr auto auto", overflow: "hidden" }}>
          <div style={{ position: "relative", overflow: "hidden" }}>
            <PrinterViewport
              profile={profile}
              segments={simResult.segments}
              currentTime={currentTime}
              isPlaying={isPlaying}
              speed={speed}
              onTimeAdvance={handleTimeAdvance}
            />
            {activeSeg && (
              <div
                style={{
                  position: "absolute",
                  top: 10,
                  left: 10,
                  padding: "6px 10px",
                  background: "rgba(15,23,42,0.85)",
                  border: "1px solid #334155",
                  borderRadius: 6,
                  fontSize: 11,
                  fontFamily: "monospace",
                }}
              >
                <div>Line {activeSeg.lineNumber}: {activeSeg.gcode}</div>
                {activeSeg.message && <div>{activeSeg.message}</div>}
                <div style={{ color: "#94a3b8", marginTop: 2 }}>
                  Hotend: {activeSeg.toolTemp}°C | Bed: {activeSeg.bedTemp}°C
                </div>
              </div>
            )}
          </div>

          {/* Playback Controls */}
          <div style={{ padding: 10, background: "#0f172a", borderTop: "1px solid #1e293b", display: "flex", flexDirection: "column", gap: 8 }}>
            {browserDemo && <strong style={{ fontSize: 12 }}>{browserProbeGcode ? "Approximate probe playback" : "Sample playback"}</strong>}
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  if (currentTime >= simResult.totalDuration) setCurrentTime(0);
                  setIsPlaying((p) => !p);
                }}
              >
                {isPlaying ? "Pause" : "Play"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setCurrentTime(0);
                }}
              >
                Reset
              </button>
              <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={5}>5x</option>
              </select>
              <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>
                {currentTime.toFixed(1)}s / {simResult.totalDuration.toFixed(1)}s
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={Math.max(simResult.totalDuration, 0.01)}
              step={0.02}
              value={currentTime}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentTime(Number(e.target.value));
              }}
              style={{ width: "100%" }}
            />
          </div>

          {/* Diagnostics / Errors */}
          {(evalError || simResult.issues.length > 0) && (
            <div style={{ maxHeight: 130, overflowY: "auto", padding: 8, background: "#450a0a", borderTop: "1px solid #991b1b", fontSize: 12 }}>
              {evalError && <div><strong>Jinja2 Error:</strong> {evalError}</div>}
              {simResult.issues.map((iss, i) => (
                <div key={i}>
                  <strong>Line {iss.lineNumber}:</strong> {iss.message} <code>({iss.gcode})</code>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
