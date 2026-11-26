import React, { useState } from "react";
import { PrinterProfile, SimInitialState } from "../sim/types";
import { parseKlipperConfig, ParsedKlipperConfig } from "../config/klipperCfgParser";
import { syncFromMoonraker } from "../config/moonrakerSync";

interface Props {
  profile: PrinterProfile;
  initialState: SimInitialState;
  testParams: Record<string, string>;
  onProfileChange: (next: PrinterProfile) => void;
  onInitialStateChange: (next: SimInitialState) => void;
  onTestParamsChange: (next: Record<string, string>) => void;
  onConfigImported: (parsed: ParsedKlipperConfig) => void;
  onMoonrakerSynced: (settings: Record<string, Record<string, unknown>>) => void;
}

export function PrinterConfigPanel({
  profile,
  initialState,
  testParams,
  onProfileChange,
  onInitialStateChange,
  onTestParamsChange,
  onConfigImported,
  onMoonrakerSynced,
}: Props) {
  const [missingIncludes, setMissingIncludes] = useState<string[]>([]);
  const [newParamKey, setNewParamKey] = useState("");
  const [newParamVal, setNewParamVal] = useState("");
  const [moonrakerUrl, setMoonrakerUrl] = useState("192.168.1.152:7125");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const contents = await Promise.all(Array.from(fileList).map((f) => f.text()));
    const parsed = parseKlipperConfig(contents, profile);
    setMissingIncludes(parsed.includes);
    onProfileChange(parsed.profile);
    onConfigImported(parsed);
  };

  const handleMoonrakerSync = async () => {
    setSyncMsg("Syncing...");
    try {
      const res = await syncFromMoonraker(moonrakerUrl, profile.fixtures);
      onProfileChange(res.profile);
      onInitialStateChange(res.initialState);
      onMoonrakerSynced(res.configSettings);
      setSyncMsg("Synced from Moonraker!");
    } catch (err) {
      setSyncMsg(`Error: ${String(err)}`);
    }
  };

  const updateAxisMax = (axis: "x" | "y" | "z", val: number) =>
    onProfileChange({ ...profile, axisMax: { ...profile.axisMax, [axis]: val } });

  const addFixture = () =>
    onProfileChange({
      ...profile,
      fixtures: [
        ...profile.fixtures,
        {
          id: crypto.randomUUID().slice(0, 6),
          name: "Purge Bucket",
          min: { x: 0, y: Math.max(0, profile.axisMax.y - 20), z: 0 },
          max: { x: 35, y: profile.axisMax.y, z: 12 },
          color: "#eab308",
        },
      ],
    });

  const addTestParam = () => {
    const key = newParamKey.trim().toUpperCase();
    if (!key) return;
    onTestParamsChange({ ...testParams, [key]: newParamVal });
    setNewParamKey("");
    setNewParamVal("");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 12, fontSize: 13, overflowY: "auto", height: "100%" }}>
      {/* Moonraker Direct Sync */}
      <section style={{ padding: 10, border: "1px solid #334155", borderRadius: 8, background: "#0f172a" }}>
        <strong>Sync Live from Moonraker</strong>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input
            value={moonrakerUrl}
            onChange={(e) => setMoonrakerUrl(e.target.value)}
            placeholder="http://printer-ip:7125"
            style={{ flex: 1 }}
          />
          <button type="button" onClick={handleMoonrakerSync}>Sync</button>
        </div>
        {syncMsg && <div style={{ marginTop: 6, fontSize: 11, color: syncMsg.startsWith("Error") ? "#f87171" : "#4ade80" }}>{syncMsg}</div>}
      </section>

      {/* Config File Dropzone */}
      <section style={{ padding: 10, border: "1px dashed #475569", borderRadius: 8, background: "#0f172a" }}>
        <strong>Import Klipper Config (.cfg)</strong>
        <p style={{ margin: "4px 0 8px", color: "#94a3b8", fontSize: 11 }}>
          Select <code>printer.cfg</code> (and optionally <code>macros.cfg</code>).
        </p>
        <input type="file" accept=".cfg,.txt" multiple onChange={(e) => handleFiles(e.target.files)} style={{ width: "100%" }} />
        {missingIncludes.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 11, color: "#fbbf24" }}>
            Detected [include]: {missingIncludes.join(", ")}
          </div>
        )}
      </section>

      {/* Hardware Geometry */}
      <section>
        <strong>Build Volume &amp; Limits</strong>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6 }}>
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11, color: "#94a3b8" }}>Max {axis.toUpperCase()}</span>
              <input
                type="number"
                value={profile.axisMax[axis]}
                onChange={(e) => updateAxisMax(axis, Number(e.target.value))}
              />
            </label>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Min Extrude °C</span>
            <input
              type="number"
              value={profile.minExtrudeTemp}
              onChange={(e) => onProfileChange({ ...profile, minExtrudeTemp: Number(e.target.value) })}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Max Vel (mm/s)</span>
            <input
              type="number"
              value={profile.maxVelocity}
              onChange={(e) => onProfileChange({ ...profile, maxVelocity: Number(e.target.value) })}
            />
          </label>
        </div>
        <button type="button" onClick={addFixture} style={{ marginTop: 8, width: "100%" }}>
          + Add Purge Bucket / Wiper Fixture
        </button>
      </section>

      {/* Pre-Run Simulation State */}
      <section>
        <strong>Pre-Run Simulation State</strong>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 6 }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Homed Axes</span>
            <select
              value={initialState.homedAxes}
              onChange={(e) => onInitialStateChange({ ...initialState, homedAxes: e.target.value })}
            >
              <option value="xyz">XYZ Homed</option>
              <option value="xy">XY Only</option>
              <option value="">Not Homed</option>
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Hotend °C</span>
            <input
              type="number"
              value={initialState.toolTemp}
              onChange={(e) => onInitialStateChange({ ...initialState, toolTemp: Number(e.target.value) })}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>Bed °C</span>
            <input
              type="number"
              value={initialState.bedTemp}
              onChange={(e) => onInitialStateChange({ ...initialState, bedTemp: Number(e.target.value) })}
            />
          </label>
        </div>
      </section>

      {/* Test Macro Params */}
      <section>
        <strong>Test Macro Params</strong>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
          {Object.entries(testParams).map(([k, v]) => (
            <div key={k} style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <code style={{ minWidth: 80, fontSize: 11 }}>{k}</code>
              <input
                value={v}
                onChange={(e) => onTestParamsChange({ ...testParams, [k]: e.target.value })}
                style={{ flex: 1, width: 60 }}
              />
              <button
                type="button"
                onClick={() => {
                  const next = { ...testParams };
                  delete next[k];
                  onTestParamsChange(next);
                }}
              >
                ✕
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
            <input placeholder="PARAM" value={newParamKey} onChange={(e) => setNewParamKey(e.target.value)} style={{ flex: 1 }} />
            <input placeholder="220" value={newParamVal} onChange={(e) => setNewParamVal(e.target.value)} style={{ width: 60 }} />
            <button type="button" onClick={addTestParam}>Add</button>
          </div>
        </div>
      </section>
    </div>
  );
}
