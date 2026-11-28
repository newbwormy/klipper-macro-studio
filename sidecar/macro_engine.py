import ast
import sys
import json
import traceback
import shlex
import jinja2
from jinja2.sandbox import SandboxedEnvironment


class KlipperMacroError(Exception):
    pass


class MissingPreviewArgument(jinja2.UndefinedError):
    pass


class PreviewArguments(dict):
    pass


class PreviewUndefined(jinja2.Undefined):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if isinstance(self._undefined_obj, PreviewArguments):
            self._undefined_exception = MissingPreviewArgument
            self._undefined_hint = str(self._undefined_name)

    def __str__(self):
        if self._undefined_exception is MissingPreviewArgument:
            self._fail_with_undefined_error()
        return super().__str__()


def build_env(enable_extensions: bool = False) -> jinja2.Environment:
    extensions = ["jinja2.ext.do", "jinja2.ext.loopcontrols"] if enable_extensions else []
    return SandboxedEnvironment(
        block_start_string="{%",
        block_end_string="%}",
        variable_start_string="{",
        variable_end_string="}",
        extensions=extensions,
        undefined=PreviewUndefined,
    )


def evaluate_macro(payload: dict) -> dict:
    macro_gcode = payload.get("gcode", "")
    printer_state = dict(payload.get("printer", {}))
    raw_params = payload.get("params", {})
    rawparams_str = payload.get("rawparams", " ".join(
        f"{key}={shlex.quote(str(value))}" for key, value in raw_params.items()
    ))
    kalico_mode = payload.get("kalico_extensions", False)
    macro_name = payload.get("macro_name", "").upper()
    macros = payload.get("macros", {})
    macro_variables = {}
    for name, macro in macros.items():
        variables = dict(macro.get("variables", {}))
        # Klipper stores variable_* config values as Python literals.
        for key, raw_value in macro.get("variable_literals", {}).items():
            try:
                variables[key] = ast.literal_eval(raw_value.strip())
            except (ValueError, SyntaxError):
                continue
        macro_variables[name] = variables
        if config_name := macro.get("config_name"):
            printer_state[config_name] = {**printer_state.get(config_name, {}), **variables}
    native_aliases = {
        macro["rename_existing"].upper(): name
        for name, macro in macros.items()
        if macro.get("rename_existing")
    }

    logs = []
    warnings = []

    def action_respond_info(msg):
        logs.append({"level": "info", "message": str(msg)})
        return ""

    def action_raise_error(msg):
        raise KlipperMacroError(str(msg))

    def action_emergency_stop(msg="Shutdown due to macro"):
        raise KlipperMacroError(f"EMERGENCY STOP: {msg}")

    def action_call_remote_method(method, **kwargs):
        logs.append({"level": "remote", "method": method, "args": kwargs})
        return ""

    env = build_env(enable_extensions=kalico_mode)
    context = {
        "printer": printer_state,
        "action_respond_info": action_respond_info,
        "action_raise_error": action_raise_error,
        "action_emergency_stop": action_emergency_stop,
        "action_call_remote_method": action_call_remote_method,
    }
    if kalico_mode:
        def action_log(msg):
            logs.append({"level": "info", "message": str(msg)})
            return ""

        context["action_log"] = action_log

    call_count = 0

    def render(gcode, name, params, rawparams, stack):
        nonlocal call_count
        call_count += 1
        label = name or "this macro"
        if name in stack:
            raise KlipperMacroError(f"Recursive macro call: {' → '.join((*stack, name))}")
        if len(stack) >= 16 or call_count > 128:
            raise KlipperMacroError("The preview reached its imported macro expansion limit.")
        if gcode.lstrip().startswith("!"):
            warnings.append(f"{label} uses Kalico Python or an external include. The preview skipped it.")
            return []
        variables = macro_variables.get(name, {})
        try:
            rendered = env.from_string(gcode).render({
                **variables,
                **context,
                "params": PreviewArguments({str(key).upper(): str(value) for key, value in params.items()}),
                "rawparams": rawparams,
            })
        except MissingPreviewArgument as exc:
            if stack:
                raise KlipperMacroError(f"{label} needs the {exc} argument in its macro call.") from exc
            raise
        except (jinja2.TemplateError, KlipperMacroError) as exc:
            raise KlipperMacroError(f"{label}: {exc}") from exc
        output = []
        for line in rendered.split("\n"):
            tokens = line.partition(";")[0].strip().split(maxsplit=1)
            command = tokens[0].upper() if tokens else ""
            args = tokens[1] if len(tokens) > 1 else ""
            if command in native_aliases:
                output.append(" ".join(part for part in (native_aliases[command], args) if part))
            elif command in macros:
                try:
                    pairs = (arg.split("=", 1) for arg in shlex.split(args))
                    child_params = {arg[0]: arg[1] for arg in pairs if len(arg) == 2}
                except ValueError as exc:
                    raise KlipperMacroError(f"{command}: could not read macro arguments: {exc}") from exc
                output.extend(render(macros[command]["gcode"], command, child_params, args, (*stack, label)))
            else:
                output.append(line)
        return output

    try:
        rendered = "\n".join(render(macro_gcode, macro_name, raw_params, rawparams_str, ()))
    except MissingPreviewArgument as exc:
        return {
            "ok": False,
            "error": f"{macro_name or 'This macro'} needs a preview value for {exc}.",
            "missing_param": str(exc),
        }
    result = {"ok": True, "gcode": rendered, "logs": logs}
    if warnings:
        result["warnings"] = warnings
    return result


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            action = req.get("action")
            if action == "evaluate":
                result = evaluate_macro(req.get("payload", {}))
            elif action == "ping":
                result = {"ok": True, "status": "ready"}
            else:
                result = {"ok": False, "error": f"Unknown action: {action}"}
        except (jinja2.TemplateError, KlipperMacroError) as exc:
            result = {"ok": False, "error": str(exc)}
        except Exception as exc:
            result = {"ok": False, "error": str(exc), "trace": traceback.format_exc()}

        sys.stdout.write(json.dumps(result) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
