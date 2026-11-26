import sys
import json
import traceback
import jinja2


class KlipperMacroError(Exception):
    pass


def build_env(enable_extensions: bool = False) -> jinja2.Environment:
    extensions = ["jinja2.ext.do", "jinja2.ext.loopcontrols"] if enable_extensions else []
    return jinja2.Environment(
        block_start_string="{%",
        block_end_string="%}",
        variable_start_string="{",
        variable_end_string="}",
        extensions=extensions,
    )


def evaluate_macro(payload: dict) -> dict:
    macro_gcode = payload.get("gcode", "")
    printer_state = payload.get("printer", {})
    raw_params = payload.get("params", {})
    rawparams_str = payload.get("rawparams", "")
    kalico_mode = payload.get("kalico_extensions", False)

    logs = []

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
        "params": {str(k).upper(): str(v) for k, v in raw_params.items()},
        "rawparams": rawparams_str,
        "action_respond_info": action_respond_info,
        "action_raise_error": action_raise_error,
        "action_emergency_stop": action_emergency_stop,
        "action_call_remote_method": action_call_remote_method,
    }

    template = env.from_string(macro_gcode)
    rendered = template.render(context)
    return {"ok": True, "gcode": rendered, "logs": logs}


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
