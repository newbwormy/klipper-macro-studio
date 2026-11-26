import { invoke } from "@tauri-apps/api/core";

export interface EvalResult {
  ok: boolean;
  gcode?: string;
  logs?: Array<{ level: string; message?: string }>;
  error?: string;
}

export async function evaluateKlipperMacro(
  gcode: string,
  printer: Record<string, unknown>,
  params: Record<string, string | number>,
  kalicoExtensions = false
): Promise<EvalResult> {
  return invoke<EvalResult>("evaluate_macro", {
    payload: {
      gcode,
      printer,
      params,
      kalico_extensions: kalicoExtensions,
    },
  });
}
