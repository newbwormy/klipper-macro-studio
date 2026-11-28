import React, { useState } from "react";
import { PrinterProfile, SimInitialState } from "../sim/types";
import { parseKlipperConfig, type ParsedKlipperConfig, type ParsedMacroEntry } from "../config/klipperCfgParser";
import { syncFromMoonraker, type MoonrakerSyncResult } from "../config/moonrakerSync";

interface Props {
  profile: PrinterProfile;
  initialState: SimInitialState;
  testParams: Record<string, string>;
  onProfileChange: (next: PrinterProfile) => void;
  onInitialStateChange: (next: SimInitialState) => void;
  onTestParamsChange: (next: Record<string, string>) => void;
  importedMacros: ParsedMacroEntry[];
  onOpenMacro: (macro: ParsedMacroEntry | null) => void;
  onConfigImported: (parsed: ParsedKlipperConfig, source: string) => void;
  onMoonrakerSynced: (result: MoonrakerSyncResult) => void;
}

export function PrinterConfigPanel({
  profile,
  initialState,
  testParams,
  onProfileChange,
  onInitialStateChange,
  onTestParamsChange,
  importedMacros,
  onOpenMacro,
  onConfigImported,
  onMoonrakerSynced,
}: Props) {
  const [missingIncludes, setMissingIncludes] = useState<string[]>([]);
  const [newParamKey, setNewParamKey] = useState("");
  const [newParamVal, setNewParamVal] = useState("");
  const [moonrakerUrl, setMoonrakerUrl] = useState("192.168.1.152:7125");
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selection, setSelection] = useState("");
  const sortedMacros = [...importedMacros].sort((a, b) => a.name.localeCompare(b.name));
  const selectedMacro = sortedMacros.find(macro => macro.name === selection);

  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || busy) return;
    const files = Array.from(fileList);
    setBusy(true);
    setFileError(null);
    try {
      const contents = await Promise.all(files.map((file) => file.text()));
      const parsed = parseKlipperConfig(contents, profile);
      setMissingIncludes(parsed.includes);
      setSelection("");
      setSyncMsg(null);
      onProfileChange(parsed.profile);
      onConfigImported(parsed, "files:" + JSON.stringify(files.map(file => file.name).sort()));
    } catch (err) {
      setFileError(String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleMoonrakerSync = async () => {
    if (busy || !moonrakerUrl.trim()) return;
    setBusy(true);
    setSyncMsg("Syncing...");
    try {
      const res = await syncFromMoonraker(moonrakerUrl, profile.fixtures);
      onProfileChange(res.profile);
      onInitialStateChange(res.initialState);
      onMoonrakerSynced(res);
      setSelection("");
      setMissingIncludes([]);
      setSyncMsg(res.macros.length
        ? `Imported ${res.macros.length} ${res.macros.length === 1 ? "macro" : "macros"} from Moonraker.`
        : "Synced printer settings. Moonraker returned no macro definitions.");
    } catch (err) {
      setSyncMsg(`Error: ${String(err)}`);
    } finally {
      setBusy(false);
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
    <div className="printer-settings">
      {/* Moonraker Direct Sync */}
      <section>
        <strong>Sync Live from Moonraker</strong>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <input
            aria-label="Moonraker address"
            value={moonrakerUrl}
            onChange={(e) => setMoonrakerUrl(e.target.value)}
            placeholder="http://printer-ip:7125"
            style={{ flex: 1 }}
          />
          <button type="button" disabled={busy || !moonrakerUrl.trim()} onClick={handleMoonrakerSync}>Sync</button>
        </div>
        {syncMsg && <div role="status" style={{ marginTop: 6, fontSize: 11, color: syncMsg.startsWith("Error") ? "#f87171" : "#4ade80" }}>{syncMsg}</div>}
      </section>

      {importedMacros.length > 0 && <section className="imported-macro-picker">
        <label htmlFor="imported-macro">Open macro</label>
        <select id="imported-macro" value={selectedMacro?.name ?? ""} onChange={e => setSelection(e.target.value)}>
          <option value="">Sample macro</option>
          {sortedMacros.map(macro => <option key={macro.name}>{macro.name}</option>)}
        </select>
        {selectedMacro?.description && <p>{selectedMacro.description}</p>}
        <button type="button" disabled={busy} onClick={() => onOpenMacro(selectedMacro ?? null)}>Open in editor</button>
        <small>Draft edits stay in this session. Export .cfg to save a copy.</small>
      </section>}

      {/* Config File Dropzone */}
      <section>
        <strong>Import Klipper Config (.cfg)</strong>
        <p style={{ margin: "4px 0 8px", color: "#94a3b8", fontSize: 11 }}>
          Select <code>printer.cfg</code> (and optionally <code>macros.cfg</code>).
        </p>
        <input type="file" aria-label="Klipper config files" accept=".cfg,.txt" multiple disabled={busy}
          onChange={(e) => { void handleFiles(e.target.files); e.target.value = ""; }} style={{ width: "100%" }} />
        {fileError && <p role="alert">{fileError}</p>}
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
