import type { MacroBlock } from "./blockTypes";
import { commandDescriptions } from "./commandDescriptions";

export function describeBlock(block: MacroBlock): string {
  switch (block.type) {
    case "home":
      return !block.axes.length || block.axes.length === 3
        ? "Home all three axes."
        : `Home ${block.axes.join(", ")}.`;
    case "positioning": {
      const position = block.mode === "G90" ? "absolute coordinates" : "relative coordinates";
      const extrusion = block.extrudeMode === "M82" ? " and turn off forced relative extrusion"
        : block.extrudeMode === "M83" ? " and use relative extrusion" : "";
      return `Use ${position}${extrusion}.`;
    }
    case "move": {
      const fields = [
        ["X", block.x], ["Y", block.y], ["Z", block.z], ["E", block.e], ["F", block.f],
      ].flatMap(([axis, value]) => value?.trim() ? [`${axis}${value.trim()}`] : []);
      if (!fields.length) return "Enter a coordinate, extrusion amount, or feed rate.";
      return `${block.rapid ? "Rapid move" : "Linear move"} with ${fields.join(", ")}.`;
    }
    case "temp": {
      const heater = block.heater === "bed" ? "bed" : "hotend";
      const value = block.temp.trim();
      if (!value) return `Enter a target temperature for the ${heater}.`;
      const target = /^-?\d+(\.\d+)?$/.test(value) ? `${value}°C` : value;
      return block.wait ? `Set the ${heater} to ${target} and wait for it to settle.`
        : `Set the ${heater} target to ${target} and continue.`;
    }
    case "save_state":
      return `Save the current G-code settings as “${block.name || "macro_state"}”.`;
    case "restore_state":
      return `Restore “${block.name || "macro_state"}”${block.move ? " and move back to the saved position" : ""}.`;
    case "respond":
      return block.message.trim() ? `Send “${block.message.trim()}” to the console.` : "Send a message to the console.";
    case "set_var":
      return block.varName.trim() ? `Set ${block.varName.trim()} to ${block.expression.trim() || "0"}.`
        : "Name a variable to use in later expressions.";
    case "if_block": {
      const condition = block.condition.trim();
      if (!condition) return "Run the THEN blocks unconditionally.";
      if (/^(['"])xyz\1 not in printer\.toolhead\.homed_axes$/.test(condition)) {
        return "Run the THEN blocks if any of X, Y, or Z still needs homing.";
      }
      return `Run the THEN blocks when ${condition} is true${block.elseBlocks.length ? ", otherwise run the ELSE blocks" : ""}.`;
    }
    case "probe":
      return commandDescriptions[block.command] ?? `Run ${block.command} on the printer.`;
    case "raw_gcode": {
      const lines = block.code.split(/\r?\n/).map(line => line.trim())
        .filter(line => line && !line.startsWith(";") && !line.startsWith("#"));
      if (!lines.length) return "Enter G-code or a Jinja2 template.";
      if (lines.some(line => /[{}]/.test(line))) return "Render this Jinja2 snippet when the macro runs.";
      if (lines.length > 1) return `Run ${lines.length} lines of G-code in order.`;
      const command = lines[0].split(/[\s;#]+/)[0].toUpperCase();
      return commandDescriptions[command] ?? `Run ${command} on the printer.`;
    }
  }
}
