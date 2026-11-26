import React, { useState } from "react";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { MacroDocument } from "../builder/blockTypes";
import { compileKlipperConfig } from "../builder/compiler";

export function ExportToolbar({ doc }: { doc: MacroDocument }) {
  const [status, setStatus] = useState<string | null>(null);

  const handleCopy = async () => {
    const cfgText = compileKlipperConfig(doc);
    await navigator.clipboard.writeText(cfgText);
    setStatus("Copied!");
    setTimeout(() => setStatus(null), 2000);
  };

  const handleSaveCfg = async () => {
    const cfgText = compileKlipperConfig(doc);
    const defaultName = `${doc.name.toLowerCase() || "custom_macro"}.cfg`;

    const filePath = await save({
      defaultPath: defaultName,
      filters: [{ name: "Klipper Config", extensions: ["cfg"] }],
    });

    if (!filePath) return;
    await writeTextFile(filePath, cfgText);
    setStatus(`Saved ${filePath.split(/[\\/]/).pop()}`);
    setTimeout(() => setStatus(null), 3000);
  };

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button type="button" onClick={handleCopy}>Copy Macro</button>
      <button type="button" onClick={handleSaveCfg}>Export .cfg</button>
      {status && <span style={{ fontSize: 12, color: "#4ade80" }}>{status}</span>}
    </div>
  );
}
