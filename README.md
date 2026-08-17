# lead-gen-tool-
Help with B2B lead generation

## MCP servers

This repo ships a project-scoped MCP config in [`.mcp.json`](.mcp.json). Anyone
who clones it gets the same servers, but each person supplies their own
credentials via environment variables — no keys are committed.

### magic (`@21st-dev/magic`)

UI component generation from [21st.dev](https://21st.dev).

**Setup:**

1. Get an API key at https://21st.dev/mcp
2. Export it before launching Claude Code:

   ```bash
   export MAGIC_API_KEY="your-key-here"
   ```

   Add it to your shell profile (`~/.zshrc`, `~/.bashrc`) to make it stick, or
   put it in a local `.env` — both `.env` and `.claude/settings.local.json` are
   gitignored.

3. Run `claude` and approve the server when prompted. Project-scoped servers
   from `.mcp.json` require a one-time per-user approval before they load.

**Verify:**

```bash
claude mcp get magic
```

Expected once the key is set and the server approved: `Status: ✓ Connected`.

Common failure modes:

| Message | Cause |
| --- | --- |
| `Missing environment variables: MAGIC_API_KEY` | Var not exported in the shell that launched Claude Code |
| `-32001 Not authenticated` | Key is set but invalid or reset — get a fresh one |
| `Pending approval` | Run `claude` interactively and approve the server |

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) validates `.mcp.json` on
every push to `main` and every pull request. It checks that the file parses,
that each server declares a `command` or `url`, that credential-shaped env keys
hold a `${VAR}` reference rather than a literal secret, and that no env value
contains non-ASCII characters — which is how a truncated or mis-pasted key
sneaks in and fails later with an opaque transport error.

Run the same check locally:

```bash
python3 .github/scripts/validate_mcp_config.py
```

