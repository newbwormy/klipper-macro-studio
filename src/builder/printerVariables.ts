import { MacroDocument } from "./blockTypes";

export interface VariableChip {
  category: "Params" | "Toolhead" | "Heaters" | "Local Vars";
  label: string;
  expr: string;
}

export function getAvailableVariables(doc: MacroDocument): VariableChip[] {
  const chips: VariableChip[] = [
    { category: "Toolhead", label: "Max X", expr: "printer.toolhead.axis_maximum.x" },
    { category: "Toolhead", label: "Max Y", expr: "printer.toolhead.axis_maximum.y" },
    { category: "Toolhead", label: "Max Z", expr: "printer.toolhead.axis_maximum.z" },
    { category: "Toolhead", label: "Current X", expr: "printer.toolhead.position.x" },
    { category: "Toolhead", label: "Current Y", expr: "printer.toolhead.position.y" },
    { category: "Toolhead", label: "Current Z", expr: "printer.toolhead.position.z" },
    { category: "Toolhead", label: "Homed Axes", expr: "printer.toolhead.homed_axes" },
    { category: "Heaters", label: "Hotend Temp", expr: "printer.extruder.temperature" },
    { category: "Heaters", label: "Hotend Target", expr: "printer.extruder.target" },
    { category: "Heaters", label: "Bed Temp", expr: "printer.heater_bed.temperature" },
    { category: "Heaters", label: "Bed Target", expr: "printer.heater_bed.target" },
  ];

  for (const p of doc.params) {
    chips.push({
      category: "Params",
      label: p.name.toUpperCase(),
      expr: p.name.toLowerCase(),
    });
  }

  for (const b of doc.blocks) {
    if (b.type === "set_var" && b.varName.trim()) {
      chips.push({
        category: "Local Vars",
        label: b.varName,
        expr: b.varName,
      });
    }
  }

  return chips;
}
