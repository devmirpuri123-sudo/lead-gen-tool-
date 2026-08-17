#!/usr/bin/env python3
"""Validate .mcp.json: parseable, structurally sane, and free of literal credentials.

Run locally with: python3 .github/scripts/validate_mcp_config.py
Exits non-zero and prints every problem found, rather than stopping at the first.
"""

import json
import re
import sys
from pathlib import Path

CONFIG = Path(__file__).resolve().parents[2] / ".mcp.json"

# Env var names that must never carry a literal value in a committed file.
SECRETISH = re.compile(r"KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|AUTH", re.I)

# ${VAR} or ${VAR:-default}
PLACEHOLDER = re.compile(r"^\$\{[A-Za-z_][A-Za-z0-9_]*(?::-[^}]*)?\}$")

errors: list[str] = []


def check_env(server: str, env: dict) -> None:
    for key, value in env.items():
        where = f"mcpServers.{server}.env.{key}"

        if not isinstance(value, str):
            errors.append(f"{where}: must be a string, got {type(value).__name__}")
            continue

        # Catches credentials pasted in redacted display form ("a5b8…1389") or
        # with smart quotes. Non-ASCII bytes fail at the HTTP transport with an
        # opaque ByteString error, so reject them here where the message is clear.
        for index, char in enumerate(value):
            if ord(char) > 127:
                errors.append(
                    f"{where}: non-ASCII character {char!r} (U+{ord(char):04X}) "
                    f"at index {index} — a truncated or mis-pasted value?"
                )
                break

        if SECRETISH.search(key) and not PLACEHOLDER.match(value):
            errors.append(
                f"{where}: looks like a credential but is not an environment "
                f"reference. Use ${{VAR_NAME}} so no secret is committed."
            )


def check_server(name: str, server: object) -> None:
    if not isinstance(server, dict):
        errors.append(f"mcpServers.{name}: must be an object")
        return

    command = server.get("command")
    url = server.get("url")
    if not command and not url:
        errors.append(f"mcpServers.{name}: needs either 'command' (stdio) or 'url' (http/sse)")
    if command is not None and not (isinstance(command, str) and command.strip()):
        errors.append(f"mcpServers.{name}.command: must be a non-empty string")

    args = server.get("args")
    if args is not None:
        if not isinstance(args, list) or not all(isinstance(a, str) for a in args):
            errors.append(f"mcpServers.{name}.args: must be a list of strings")

    env = server.get("env")
    if env is not None:
        if not isinstance(env, dict):
            errors.append(f"mcpServers.{name}.env: must be an object")
        else:
            check_env(name, env)


def main() -> int:
    if not CONFIG.exists():
        print(f"No {CONFIG.name} at repo root — nothing to validate.")
        return 0

    raw = CONFIG.read_text(encoding="utf-8")
    try:
        config = json.loads(raw)
    except json.JSONDecodeError as exc:
        print(f"{CONFIG.name} is not valid JSON: {exc}")
        return 1

    servers = config.get("mcpServers")
    if not isinstance(servers, dict):
        print(f"{CONFIG.name}: top-level 'mcpServers' must be an object")
        return 1

    for name, server in servers.items():
        check_server(name, server)

    if errors:
        print(f"{CONFIG.name} failed validation:\n")
        for err in errors:
            print(f"  - {err}")
        return 1

    count = len(servers)
    print(f"{CONFIG.name} OK — {count} server{'s' if count != 1 else ''}: {', '.join(servers)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
