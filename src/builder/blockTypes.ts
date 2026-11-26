import type { ProbeCommand } from "./probeCommands";

export type ExprValue = string;

export interface MacroParamDef {
  name: string;
  defaultValue: string;
  type: "float" | "int" | "string";
}

export type MacroBlock =
  | { id: string; type: "home"; axes: ("X" | "Y" | "Z")[] }
  | { id: string; type: "positioning"; mode: "G90" | "G91"; extrudeMode?: "M82" | "M83" }
  | {
      id: string;
      type: "move";
      rapid: boolean;
      x?: ExprValue;
      y?: ExprValue;
      z?: ExprValue;
      e?: ExprValue;
      f?: ExprValue;
    }
  | {
      id: string;
      type: "temp";
      heater: "extruder" | "bed";
      wait: boolean;
      temp: ExprValue;
    }
  | { id: string; type: "save_state"; name: string }
  | { id: string; type: "restore_state"; name: string; move: boolean; moveSpeed?: ExprValue }
  | { id: string; type: "respond"; message: string }
  | { id: string; type: "set_var"; varName: string; expression: ExprValue }
  | {
      id: string;
      type: "if_block";
      condition: ExprValue;
      thenBlocks: MacroBlock[];
      elseBlocks: MacroBlock[];
    }
  | { id: string; type: "probe"; command: ProbeCommand; parameters: string }
  | { id: string; type: "raw_gcode"; code: string };

export interface MacroDocument {
  name: string;
  description: string;
  params: MacroParamDef[];
  blocks: MacroBlock[];
  language?: "jinja" | "python";
  python?: string;
}
