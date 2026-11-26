import { MacroBlock, MacroDocument } from "./blockTypes";

const NUMBER_RE = /^-?\d+(\.\d+)?$/;

function formatExpr(val?: string): string {
  if (!val || !val.trim()) return "";
  const trimmed = val.trim();
  if (NUMBER_RE.test(trimmed)) return trimmed;
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  return `{${trimmed}}`;
}

function compileBlocks(blocks: MacroBlock[], indent = ""): string[] {
  const lines: string[] = [];

  for (const b of blocks) {
    switch (b.type) {
      case "home": {
        const axes = b.axes.length === 0 || b.axes.length === 3 ? "" : " " + b.axes.join(" ");
        lines.push(`${indent}G28${axes}`);
        break;
      }
      case "positioning": {
        lines.push(`${indent}${b.mode}`);
        if (b.extrudeMode) lines.push(`${indent}${b.extrudeMode}`);
        break;
      }
      case "move": {
        const parts = [b.rapid ? "G0" : "G1"];
        if (b.x?.trim()) parts.push(`X${formatExpr(b.x)}`);
        if (b.y?.trim()) parts.push(`Y${formatExpr(b.y)}`);
        if (b.z?.trim()) parts.push(`Z${formatExpr(b.z)}`);
        if (b.e?.trim()) parts.push(`E${formatExpr(b.e)}`);
        if (b.f?.trim()) parts.push(`F${formatExpr(b.f)}`);
        if (parts.length > 1) lines.push(`${indent}${parts.join(" ")}`);
        break;
      }
      case "temp": {
        const cmd =
          b.heater === "extruder"
            ? b.wait ? "M109" : "M104"
            : b.wait ? "M190" : "M140";
        lines.push(`${indent}${cmd} S${formatExpr(b.temp)}`);
        break;
      }
      case "save_state": {
        lines.push(`${indent}SAVE_GCODE_STATE NAME=${b.name || "macro_state"}`);
        break;
      }
      case "restore_state": {
        const movePart = b.move
          ? ` MOVE=1${b.moveSpeed?.trim() ? ` MOVE_SPEED=${formatExpr(b.moveSpeed)}` : ""}`
          : " MOVE=0";
        lines.push(`${indent}RESTORE_GCODE_STATE NAME=${b.name || "macro_state"}${movePart}`);
        break;
      }
      case "respond": {
        const escaped = b.message.replace(/"/g, '\\"');
        lines.push(`${indent}RESPOND MSG="${escaped}"`);
        break;
      }
      case "set_var": {
        if (b.varName.trim()) {
          lines.push(`${indent}{% set ${b.varName.trim()} = ${b.expression.trim() || "0"} %}`);
        }
        break;
      }
      case "if_block": {
        lines.push(`${indent}{% if ${b.condition.trim() || "True"} %}`);
        lines.push(...compileBlocks(b.thenBlocks, indent + "  "));
        if (b.elseBlocks.length > 0) {
          lines.push(`${indent}{% else %}`);
          lines.push(...compileBlocks(b.elseBlocks, indent + "  "));
        }
        lines.push(`${indent}{% endif %}`);
        break;
      }
      case "probe": {
        const parameters = b.parameters.trim();
        lines.push(parameters ? `${indent}${b.command} ${parameters}` : `${indent}${b.command}`);
        break;
      }
      case "raw_gcode": {
        for (const rawLine of b.code.split(/\r?\n/)) {
          lines.push(`${indent}${rawLine}`);
        }
        break;
      }
    }
  }

  return lines;
}

export function compileMacroBody(doc: MacroDocument): string {
  if (doc.language === "python") {
    return (doc.python ?? "").split(/\r?\n/).map(line => line.trim() ? `!${line}` : "").join("\n");
  }
  const paramLines = doc.params.map((p) => {
    const key = p.name.toUpperCase();
    const filter = p.type === "string" ? "" : `|${p.type}`;
    const def = p.type === "string" ? `"${p.defaultValue}"` : p.defaultValue;
    return `{% set ${key.toLowerCase()} = params.${key}|default(${def})${filter} %}`;
  });

  const bodyLines = compileBlocks(doc.blocks);
  return [...paramLines, ...(paramLines.length ? [""] : []), ...bodyLines].join("\n");
}

export function compileBrowserPreview(doc: MacroDocument): string {
  if (doc.language === "python") return "";
  const lines = doc.blocks.flatMap((block) => {
    const compiled = compileBlocks([block]);
    return compiled.some((line) => /[{}]/.test(line)) ? [] : compiled;
  });
  return lines.join("\n");
}

export function compileKlipperConfig(doc: MacroDocument): string {
  const body = compileMacroBody(doc)
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");

  const desc = doc.description ? `description: ${doc.description}\n` : "";
  return `[gcode_macro ${doc.name.toUpperCase()}]\n${desc}gcode:\n${body}\n`;
}
