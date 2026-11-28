import { useRef, useState } from "react";
import { commandCatalog, jinjaHelpers, pythonHelpers } from "../builder/commandCatalog";

export function CommandLibrary({ python, imported, onInsert }: {
  python: boolean;
  imported: string[];
  onInsert: (code: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [source, setSource] = useState("Klipper");
  const [query, setQuery] = useState("");
  const sources = Object.keys(commandCatalog);
  const selected = source === "Imported macros" && !imported.length ? "Klipper" : source;
  const helpers = python ? pythonHelpers : jinjaHelpers;
  const catalog = commandCatalog[selected];
  const rows = selected === "Template helpers"
    ? Object.entries(helpers).map(([name, code]) => ({ name, code, group: python ? "Kalico Python" : "Jinja2" }))
    : Object.entries(catalog?.groups ?? { "Imported macros": [...new Set(imported)] }).flatMap(([group, commands]) =>
      commands.map((name) => ({ name, group, code: python ? `emit(${JSON.stringify(name)})` : name })));
  const terms = query.toLowerCase().trim().split(/\s+/);
  const matches = rows.filter(({ name, group }) => terms.every(term => `${name} ${group}`.toLowerCase().includes(term)));

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
            placeholder="Search name or module" />
        </div>
        {catalog && <p style={{ fontSize: 12 }}>
          <a href={catalog.reference} target="_blank" rel="noreferrer" style={{ color: "#7dd3fc" }}>
            {selected} command reference
          </a>
        </p>}
        <div className="command-results">
          {matches.map(({ name, code, group }) => (
            <button key={`${group}:${name}`} type="button" onClick={() => {
              onInsert(code);
              dialog.current?.close();
            }}>
              {name} <small style={{ color: "#94a3b8" }}>{group}</small>
            </button>
          ))}
          {!matches.length && <p>No matching commands.</p>}
        </div>
      </dialog>
    </>
  );
}
