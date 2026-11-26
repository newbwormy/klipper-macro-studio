import React, { useState } from "react";
import { MacroBlock, MacroDocument } from "../builder/blockTypes";
import { getAvailableVariables, VariableChip } from "../builder/printerVariables";

const makeId = () => crypto.randomUUID().slice(0, 8);

const BLOCK_TEMPLATES: Record<string, () => MacroBlock> = {
  home: () => ({ id: makeId(), type: "home", axes: ["X", "Y", "Z"] }),
  positioning: () => ({ id: makeId(), type: "positioning", mode: "G90", extrudeMode: "M83" }),
  move: () => ({ id: makeId(), type: "move", rapid: false, x: "", y: "", z: "", e: "", f: "3000" }),
  temp: () => ({ id: makeId(), type: "temp", heater: "extruder", wait: true, temp: "210" }),
  save_state: () => ({ id: makeId(), type: "save_state", name: "custom_state" }),
  restore_state: () => ({ id: makeId(), type: "restore_state", name: "custom_state", move: true, moveSpeed: "100" }),
  respond: () => ({ id: makeId(), type: "respond", message: "Macro step complete" }),
  set_var: () => ({ id: makeId(), type: "set_var", varName: "center_x", expression: "printer.toolhead.axis_maximum.x / 2" }),
  if_block: () => ({
    id: makeId(),
    type: "if_block",
    condition: "'xyz' not in printer.toolhead.homed_axes",
    thenBlocks: [{ id: makeId(), type: "home", axes: ["X", "Y", "Z"] }],
    elseBlocks: [],
  }),
  raw_gcode: () => ({ id: makeId(), type: "raw_gcode", code: "M400 ; Wait for moves" }),
};

function ExprInput({
  label,
  value,
  onChange,
  vars,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  vars: VariableChip[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "relative", display: "inline-flex", flexDirection: "column", gap: 2 }}>
      <label style={{ fontSize: 11, color: "#94a3b8" }}>{label}</label>
      <div style={{ display: "flex", gap: 4 }}>
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 105 }}
        />
        <button
          type="button"
          title="Insert Printer Variable"
          onClick={() => setOpen((o) => !o)}
          style={{ padding: "2px 6px", color: "#38bdf8" }}
        >
          {"{x}"}
        </button>
      </div>
      {open && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 25,
            width: 230,
            maxHeight: 190,
            overflowY: "auto",
            background: "#1e293b",
            border: "1px solid #475569",
            borderRadius: 6,
            padding: 4,
          }}
        >
          {vars.map((v) => (
            <button
              key={`${v.category}-${v.label}`}
              type="button"
              onClick={() => {
                onChange(value ? `${value} ${v.expr}` : v.expr);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "4px 6px",
                background: "transparent",
                border: "none",
                fontSize: 12,
              }}
            >
              <strong>{v.label}</strong> <span style={{ color: "#64748b" }}>({v.category})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BlockList({
  blocks,
  onChange,
  vars,
}: {
  blocks: MacroBlock[];
  onChange: (next: MacroBlock[]) => void;
  vars: VariableChip[];
}) {
  const updateBlock = (idx: number, patch: Partial<MacroBlock>) => {
    const next = [...blocks];
    next[idx] = { ...next[idx], ...patch } as MacroBlock;
    onChange(next);
  };

  const moveBlock = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const removeBlock = (idx: number) => onChange(blocks.filter((_, i) => i !== idx));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {blocks.map((block, idx) => (
        <div
          key={block.id}
          style={{ padding: 10, background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <strong style={{ fontSize: 12, color: "#38bdf8", textTransform: "uppercase" }}>
              {block.type.replace("_", " ")}
            </strong>
            <div style={{ display: "flex", gap: 4 }}>
              <button type="button" onClick={() => moveBlock(idx, -1)}>↑</button>
              <button type="button" onClick={() => moveBlock(idx, 1)}>↓</button>
              <button type="button" onClick={() => removeBlock(idx)} style={{ color: "#f87171" }}>✕</button>
            </div>
          </div>

          {block.type === "move" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" }}>
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={block.rapid}
                  onChange={(e) => updateBlock(idx, { rapid: e.target.checked })}
                />{" "}
                Rapid (G0)
              </label>
              <ExprInput label="X" value={block.x ?? ""} onChange={(x) => updateBlock(idx, { x })} vars={vars} />
              <ExprInput label="Y" value={block.y ?? ""} onChange={(y) => updateBlock(idx, { y })} vars={vars} />
              <ExprInput label="Z" value={block.z ?? ""} onChange={(z) => updateBlock(idx, { z })} vars={vars} />
              <ExprInput label="E" value={block.e ?? ""} onChange={(e) => updateBlock(idx, { e })} vars={vars} />
              <ExprInput label="Feed (F)" value={block.f ?? ""} onChange={(f) => updateBlock(idx, { f })} vars={vars} />
            </div>
          )}

          {block.type === "temp" && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "end" }}>
              <select
                value={block.heater}
                onChange={(e) => updateBlock(idx, { heater: e.target.value as "extruder" | "bed" })}
              >
                <option value="extruder">Hotend</option>
                <option value="bed">Heated Bed</option>
              </select>
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={block.wait}
                  onChange={(e) => updateBlock(idx, { wait: e.target.checked })}
                />{" "}
                Wait for Temp
              </label>
              <ExprInput label="Target °C" value={block.temp} onChange={(temp) => updateBlock(idx, { temp })} vars={vars} />
            </div>
          )}

          {block.type === "home" && (
            <div style={{ display: "flex", gap: 10 }}>
              {(["X", "Y", "Z"] as const).map((axis) => (
                <label key={axis} style={{ fontSize: 12 }}>
                  <input
                    type="checkbox"
                    checked={block.axes.includes(axis)}
                    onChange={(e) => {
                      const axes = e.target.checked
                        ? [...block.axes, axis]
                        : block.axes.filter((a) => a !== axis);
                      updateBlock(idx, { axes });
                    }}
                  />{" "}
                  {axis}
                </label>
              ))}
            </div>
          )}

          {block.type === "positioning" && (
            <div style={{ display: "flex", gap: 8 }}>
              <select
                value={block.mode}
                onChange={(e) => updateBlock(idx, { mode: e.target.value as "G90" | "G91" })}
              >
                <option value="G90">G90 (Absolute XYZ)</option>
                <option value="G91">G91 (Relative XYZ)</option>
              </select>
              <select
                value={block.extrudeMode ?? ""}
                onChange={(e) =>
                  updateBlock(idx, { extrudeMode: (e.target.value || undefined) as "M82" | "M83" | undefined })
                }
              >
                <option value="">Keep Extruder Mode</option>
                <option value="M82">M82 (Absolute E)</option>
                <option value="M83">M83 (Relative E)</option>
              </select>
            </div>
          )}

          {block.type === "save_state" && (
            <input
              value={block.name}
              placeholder="State name"
              onChange={(e) => updateBlock(idx, { name: e.target.value })}
            />
          )}

          {block.type === "restore_state" && (
            <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
              <input
                value={block.name}
                placeholder="State name"
                onChange={(e) => updateBlock(idx, { name: e.target.value })}
              />
              <label style={{ fontSize: 12 }}>
                <input
                  type="checkbox"
                  checked={block.move}
                  onChange={(e) => updateBlock(idx, { move: e.target.checked })}
                />{" "}
                Move back
              </label>
              {block.move && (
                <ExprInput
                  label="Move Speed"
                  value={block.moveSpeed ?? "100"}
                  onChange={(moveSpeed) => updateBlock(idx, { moveSpeed })}
                  vars={vars}
                />
              )}
            </div>
          )}

          {block.type === "respond" && (
            <input
              value={block.message}
              onChange={(e) => updateBlock(idx, { message: e.target.value })}
              style={{ width: "100%" }}
            />
          )}

          {block.type === "set_var" && (
            <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
              <input
                value={block.varName}
                placeholder="var_name"
                onChange={(e) => updateBlock(idx, { varName: e.target.value })}
              />
              <ExprInput
                label="Expression"
                value={block.expression}
                onChange={(expression) => updateBlock(idx, { expression })}
                vars={vars}
              />
            </div>
          )}

          {block.type === "if_block" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <ExprInput
                label="Condition (Jinja2)"
                value={block.condition}
                onChange={(condition) => updateBlock(idx, { condition })}
                vars={vars}
              />
              <div style={{ borderLeft: "2px solid #38bdf8", paddingLeft: 10 }}>
                <div style={{ fontSize: 11, color: "#38bdf8", marginBottom: 4 }}>THEN:</div>
                <BlockList
                  blocks={block.thenBlocks}
                  onChange={(thenBlocks) => updateBlock(idx, { thenBlocks })}
                  vars={vars}
                />
                <button
                  type="button"
                  onClick={() => updateBlock(idx, { thenBlocks: [...block.thenBlocks, BLOCK_TEMPLATES.move()] })}
                  style={{ marginTop: 6, fontSize: 11 }}
                >
                  + Add Move to THEN
                </button>
              </div>
            </div>
          )}

          {block.type === "raw_gcode" && (
            <textarea
              rows={2}
              value={block.code}
              onChange={(e) => updateBlock(idx, { code: e.target.value })}
              style={{ width: "100%", fontFamily: "monospace" }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export function MacroBuilder({
  doc,
  onChange,
}: {
  doc: MacroDocument;
  onChange: (next: MacroDocument) => void;
}) {
  const vars = getAvailableVariables(doc);
  const addBlock = (key: keyof typeof BLOCK_TEMPLATES) =>
    onChange({ ...doc, blocks: [...doc.blocks, BLOCK_TEMPLATES[key]()] });

  return (
    <div style={{ display: "grid", gridTemplateColumns: "155px 1fr", height: "100%", overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 6,
          padding: 10,
          background: "#0f172a",
          borderRight: "1px solid #1e293b",
          overflowY: "auto",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8" }}>ADD BLOCK</div>
        {Object.keys(BLOCK_TEMPLATES).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => addBlock(key)}
            style={{ textAlign: "left" }}
          >
            + {key.replace("_", " ")}
          </button>
        ))}
      </div>

      <div style={{ padding: 12, overflowY: "auto" }}>
        <BlockList
          blocks={doc.blocks}
          onChange={(blocks) => onChange({ ...doc, blocks })}
          vars={vars}
        />
      </div>
    </div>
  );
}
