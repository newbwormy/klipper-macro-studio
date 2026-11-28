import { useRef, useState } from "react";
import { commandCatalog, jinjaHelpers, pythonHelpers } from "../builder/commandCatalog";
import { commandDescriptions, helperDescriptions } from "../builder/commandDescriptions";
import type { ParsedMacroEntry } from "../config/klipperCfgParser";

type ImportedCommand = Pick<ParsedMacroEntry, "name" | "description">;

export function CommandLibrary({ python, imported, onInsert }: {
  python: boolean;
  imported: ImportedCommand[];
  onInsert: (code: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState("Klipper");
  const [query, setQuery] = useState("");
  const sources = Object.keys(commandCatalog);
  const selected = source === "Imported macros" && !imported.length ? "Klipper" : source;
  const helpers = python ? pythonHelpers : jinjaHelpers;
  const catalog = commandCatalog[selected];
  const commandCode = (name: string) => python ? `emit(${JSON.stringify(name)})` : name;
  const rows = selected === "Template helpers"
    ? Object.entries(helpers).map(([name, code]) => ({
      name, code, group: python ? "Kalico Python" : "Jinja2", description: helperDescriptions[name],
    }))
    : catalog
      ? Object.entries(catalog.groups).flatMap(([group, commands]) => commands.map((name) => ({
        name, group, code: commandCode(name),
        description: selected === "KAMP" && name === "BED_MESH_CALIBRATE"
          ? "Measure the bed only around the objects in the current print."
          : commandDescriptions[name],
      })))
      : Array.from(new Map(imported.map(macro => [macro.name, macro])).values(), ({ name, description }) => ({
        name, group: "Imported macros", code: commandCode(name),
        description: description.trim() || "Custom macro from your printer config. No description provided.",
      }));
  const terms = query.toLowerCase().trim().split(/\s+/);
  const matches = rows.filter(({ name, group, description }) => {
    const searchable = `${name} ${name.replace(/_/g, " ")} ${group} ${description ?? ""}`.toLowerCase();
    return terms.every(term => searchable.includes(term));
  });

  return (
    <>
      <button type="button" className="library-trigger" onClick={() => dialog.current?.showModal()}>Command library</button>
      <dialog ref={dialog} aria-labelledby="library-title" className="command-dialog">
        <div className="dialog-heading">
          <h2 id="library-title">Command library</h2>
          <button type="button" onClick={() => dialog.current?.close()} aria-label="Close command library">×</button>
        </div>
        <div className="command-filters">
          <label>
            Source{" "}
            <select value={selected} onChange={(e) => setSource(e.target.value)}>
              {sources.map(name => <option key={name}>{name}</option>)}
              {imported.length > 0 && <option>Imported macros</option>}
              <option>Template helpers</option>
            </select>
          </label>
          <input aria-label="Search commands" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search commands by name or purpose" />
        </div>
        {catalog && <p style={{ fontSize: 12 }}>
          <a href={catalog.reference} target="_blank" rel="noreferrer" style={{ color: "#7dd3fc" }}>
            {selected} command reference
          </a>
        </p>}
        <div className="command-results">
          {matches.map(({ name, code, group, description }) => (
            <button key={`${group}:${name}`} type="button" onClick={() => {
              onInsert(code);
              dialog.current?.close();
            }}>
              <span className="command-result-title"><span>{name}</span><small>{group}</small></span>
              <span className="command-result-description">{description || "See the command reference for its purpose."}</span>
            </button>
          ))}
          {!matches.length && <p>No matching commands.</p>}
        </div>
      </dialog>
    </>
  );
}
