import { invoke } from "@tauri-apps/api/core";
import type { ParsedMacroEntry } from "../config/klipperCfgParser";

export interface EvalResult {
  ok: boolean;
  gcode?: string;
  logs?: Array<{ level: string; message?: string }>;
  error?: string;
  missing_param?: string;
  warnings?: string[];
}

export async function evaluateKlipperMacro(
  gcode: string,
  printer: Record<string, unknown>,
  params: Record<string, string | number>,
  kalicoExtensions = false,
  macroName = "",
  importedMacros: ParsedMacroEntry[] = []
): Promise<EvalResult> {
  return invoke<EvalResult>("evaluate_macro", {
    payload: {
      gcode,
      printer,
      params,
      kalico_extensions: kalicoExtensions,
      macro_name: macroName,
      macros: Object.fromEntries(importedMacros.map(macro => [macro.name.toUpperCase(), {
        config_name: `gcode_macro ${macro.name}`,
        gcode: macro.gcode,
        variables: macro.variables,
        variable_literals: Object.fromEntries(Object.entries(macro.options)
          .filter(([key]) => key.startsWith("variable_"))
          .map(([key, value]) => [key.slice("variable_".length), value])),
        rename_existing: macro.options.rename_existing,
      }])),
    },
  });
}
