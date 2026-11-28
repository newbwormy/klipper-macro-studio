import { invoke } from "@tauri-apps/api/core";
import type { ParsedMacroEntry } from "../config/klipperCfgParser";

export interface EvalResult {
  ok: boolean;
  gcode?: string;
  logs?: Array<{ level: string; message?: string }>;
  error?: string;
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
        gcode: macro.gcode,
        variables: macro.variables,
        rename_existing: macro.options.rename_existing,
      }])),
    },
  });
}
