import React, { useEffect, useMemo, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { MacroDocument } from "./builder/blockTypes";
import { compileBrowserPreview, compileKlipperConfig, compileMacroBody } from "./builder/compiler";
import { buildMockPrinterState } from "./config/buildMockPrinter";
import { ParsedMacroEntry } from "./config/klipperCfgParser";
import { evaluateKlipperMacro } from "./lib/macroApi";
import { simulateGcode } from "./sim/gcodeSimulator";
import { PrinterProfile, SimInitialState, SimulationResult } from "./sim/types";
import { ExportToolbar } from "./components/ExportToolbar";
import { createTourSteps, FirstRunTour, initialTourStep, tourStorageKey } from "./components/FirstRunTour";
import { MacroBuilder } from "./components/MacroBuilder";
import { PrinterConfigPanel } from "./components/PrinterConfigPanel";
import { PrinterViewport } from "./components/PrinterViewport";
import sampleGcode from "./demo/prime-and-wipe.gcode?raw";

const browserDemo = !isTauri();
const tourSteps = createTourSteps(browserDemo);

const DEFAULT_PROFILE: PrinterProfile = {
  name: "256mm CoreXY",
  axisMin: { x: 0, y: 0, z: 0 },
  axisMax: { x: 256, y: 284, z: 256 },
  printArea: { min: { x: 0, y: 0 }, max: { x: 256, y: 256 } },
  homePos: { x: 128, y: 128, z: 0 },
  minExtrudeTemp: 170,
  maxVelocity: 300,
  fixtures: [
    {
      id: "purge",
      name: "Purge Bucket",
      min: { x: 0, y: 262, z: 0 },
      max: { x: 35, y: 282, z: 12 },
      color: "#b48540",
      kind: "purge_bucket",
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
  description: "Homes if needed, heats, purges off the plate, and lays a prime line",
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
    { id: "b6", type: "move", rapid: true, x: "18", y: "272", z: "15", f: "9000" },
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
  const [tourIndex, setTourIndex] = useState(initialTourStep);
  const tourStep = tourIndex === null ? undefined : tourSteps[tourIndex];

  const closeTour = () => {
    setTourIndex(null);
    try {
      localStorage.setItem(tourStorageKey, "1");
    } catch {
      // The tutorial can still be dismissed when storage is unavailable.
    }
  };

  const goToTourStep = (index: number) => {
    const step = tourSteps[index];
    if (!step) return;
    if (step.view) setCenterTab(step.view);
    setTourIndex(index);
  };

  useEffect(() => {
    if (!tourStep?.target) return;
    document.querySelector(`[data-tour-target="${tourStep.target}"]`)
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [tourStep]);

  const mockPrinter = useMemo(
    () => buildMockPrinterState(profile, initialState, configSettings, importedMacros),
    [profile, initialState, configSettings, importedMacros]
  );

  const browserGcode = useMemo(() => {
    if (!browserDemo) return "";
    return macroDoc.language !== "python" && macroDoc.blocks === DEFAULT_MACRO.blocks
      ? sampleGcode : compileBrowserPreview(macroDoc);
  }, [macroDoc]);

  useEffect(() => {
    if (!browserDemo) return;
    setRenderedGcode(browserGcode);
    setSimResult(simulateGcode(browserGcode, DEFAULT_PROFILE, DEFAULT_INITIAL));
    setIsPlaying(false);
    setCurrentTime(0);
  }, [browserGcode]);

  useEffect(() => {
    if (browserDemo) return;
    if (macroDoc.language === "python") {
      setRenderedGcode("");
      setEvalError(null);
      setSimResult({ segments: [], issues: [], totalDuration: 0 });
      setIsPlaying(false);
      setCurrentTime(0);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const body = compileMacroBody(macroDoc);
      try {
        const res = await evaluateKlipperMacro(body, mockPrinter, testParams, kalicoMode);
        if (cancelled) return;
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
        if (!cancelled) setEvalError(String(err));
      }
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
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
    <div className={tourStep ? "studio studio--tour" : "studio"} data-tour-step={tourStep?.target}>
      <header className="app-header">
        <div className="wordmark">
          <span className="studio-mark" aria-hidden="true"><span /></span>
          <h1>Klipper <span>Macro Studio</span></h1>
        </div>
        <label className="macro-name">
          <span>Macro</span>
          <input
            value={macroDoc.name}
            onChange={(e) => setMacroDoc({ ...macroDoc, name: e.target.value.toUpperCase().replace(/\s+/g, "_") })}
          />
        </label>
        {!browserDemo && <label className="kalico-toggle">
            <input
              type="checkbox"
              checked={kalicoMode}
              onChange={(e) => setKalicoMode(e.target.checked)}
            />{" "}
            Kalico Jinja2 Extensions
        </label>}
        <div className="header-actions">
          <button type="button" className="tour-trigger" aria-expanded={Boolean(tourStep)}
            onClick={() => tourStep ? closeTour() : goToTourStep(0)}>
            Tutorial
          </button>
          <ExportToolbar doc={macroDoc} />
        </div>
      </header>

      {tourStep && tourIndex !== null && <FirstRunTour step={tourStep} index={tourIndex} count={tourSteps.length}
        onBack={() => goToTourStep(tourIndex - 1)}
        onNext={() => tourIndex === tourSteps.length - 1 ? closeTour() : goToTourStep(tourIndex + 1)}
        onClose={closeTour} />}

      <div className={browserDemo ? "workspace workspace--browser" : "workspace workspace--desktop"}>
        {!browserDemo && <aside className="panel printer-panel" aria-label="Printer settings" data-tour-target="printer">
          <div className="panel-heading"><h2>Printer settings</h2></div>
          <PrinterConfigPanel
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
          />
        </aside>}

        <main className="panel editor-panel">
          <div className="editor-tabs" role="group" aria-label="Editor view">
            <button
              type="button"
              onClick={() => setCenterTab("builder")}
              aria-pressed={centerTab === "builder"}
            >
              Visual Builder
            </button>
            <button
              type="button"
              onClick={() => setCenterTab("code")}
              aria-pressed={centerTab === "code"}
              data-tour-target="code"
            >
              Generated code
            </button>
          </div>

          {centerTab === "builder" ? (
            <MacroBuilder doc={macroDoc} onChange={setMacroDoc} importedCommands={importedMacros} />
          ) : (
            <div className="code-grid">
              <div className="code-panel">
                <h3>Klipper config</h3>
                <pre>
                  {compileKlipperConfig(macroDoc)}
                </pre>
              </div>
              <div className="code-panel">
                <h3>
                  {browserDemo ? (browserGcode === sampleGcode ? "Bundled Sample G-code" : "Preview G-code") : "Evaluated G-code (Real Jinja2 Output)"}
                </h3>
                <pre>
                  {macroDoc.language === "python" ? "Kalico runs Python macros on the printer. This editor exports the source."
                    : evalError ? `ERROR: ${evalError}` : renderedGcode}
                </pre>
              </div>
            </div>
          )}
        </main>

        <section className="panel preview-panel" aria-label="3D preview">
          <div className="panel-heading">
            <h2>3D preview</h2>
            <span className="profile-label">{profile.name}</span>
          </div>
          <div className="preview-stage">
            <PrinterViewport
              profile={profile}
              segments={simResult.segments}
              currentTime={currentTime}
              isPlaying={isPlaying}
              speed={speed}
              onTimeAdvance={handleTimeAdvance}
            />
            {activeSeg && (
              <div className="preview-readout">
                <strong>Line {activeSeg.lineNumber}: {activeSeg.gcode}</strong>
                {activeSeg.message && <span>{activeSeg.message}</span>}
              </div>
            )}
            {activeSeg && <div className="preview-temps">
              <span>Hotend <strong>{activeSeg.toolTemp}°C</strong></span>
              <span>Bed <strong>{activeSeg.bedTemp}°C</strong></span>
            </div>}
          </div>

          <div className="transport" data-tour-target="preview">
            <div className="transport-status">
              <span>{macroDoc.language === "python" ? "Playback unavailable for Python"
                : browserDemo ? (browserGcode === sampleGcode ? "Sample playback" : "Literal G-code playback")
                  : "Macro playback"}</span>
              <span className="timecode">{currentTime.toFixed(1)}s <span>/</span> {simResult.totalDuration.toFixed(1)}s</span>
            </div>
            <input
              aria-label="Playback timeline"
              type="range"
              min={0}
              max={Math.max(simResult.totalDuration, 0.01)}
              step={0.02}
              value={currentTime}
              onChange={(e) => {
                setIsPlaying(false);
                setCurrentTime(Number(e.target.value));
              }}
            />
            <div className="transport-buttons">
              <button
                className="primary-button play-button"
                type="button"
                disabled={simResult.totalDuration <= 0}
                onClick={() => {
                  if (currentTime >= simResult.totalDuration) setCurrentTime(0);
                  setIsPlaying((p) => !p);
                }}
              >
                <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span> {isPlaying ? "Pause" : "Play"}
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
              <select aria-label="Playback speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
                <option value={0.5}>0.5x</option>
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={5}>5x</option>
              </select>
            </div>
          </div>

          {/* Diagnostics / Errors */}
          {(evalError || simResult.issues.length > 0) && (
            <div className="diagnostics" aria-label="Preview diagnostics">
              {evalError && <div className="diagnostic diagnostic--error"><strong>Jinja2 error</strong> {evalError}</div>}
              {simResult.issues.map((iss, i) => (
                <div key={i} className={`diagnostic diagnostic--${iss.severity}`}>
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
