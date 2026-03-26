#!/usr/bin/env sh
# install-mcp.sh — Configure a Frappe MCP server for your AI client.
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/nasroykh/foxmayn_frappe_mcp/main/install-mcp.sh | sh -s -- --client claude
#   curl -fsSL ... | sh -s -- --client cursor --site production
#   curl -fsSL ... | sh -s -- --client vscode --site staging --read-only
#
# Options:
#   --client <name>    claude | cursor | vscode | codex | gemini  (required)
#   --site <name>      ffc site name (default: "default")
#   --ffc-path <path>  Path to ffc binary (default: auto-detect)
#   --read-only        Disable write tools (create, update, delete)

set -e

# ─── Defaults ─────────────────────────────────────────────────────────────────

CLIENT=""
SITE="default"
FFC_BIN="ffc"
READ_ONLY=0

# ─── Parse args ───────────────────────────────────────────────────────────────

while [ $# -gt 0 ]; do
  case "$1" in
    --client)    CLIENT="$2";   shift 2 ;;
    --site)      SITE="$2";     shift 2 ;;
    --ffc-path)  FFC_BIN="$2";  shift 2 ;;
    --read-only) READ_ONLY=1;   shift   ;;
    *)           echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

# ─── Validation ───────────────────────────────────────────────────────────────

if [ -z "$CLIENT" ]; then
  echo "Error: --client is required." >&2
  echo "Usage: sh install-mcp.sh --client <claude|cursor|vscode|codex|gemini> [--site <name>]" >&2
  exit 1
fi

case "$CLIENT" in
  claude|cursor|vscode|codex|gemini) ;;
  *)
    echo "Error: unknown client '$CLIENT'. Choose: claude | cursor | vscode | codex | gemini" >&2
    exit 1
    ;;
esac

if ! command -v "$FFC_BIN" >/dev/null 2>&1; then
  echo "Error: '$FFC_BIN' not found." >&2
  echo "Install ffc: curl -fsSL https://raw.githubusercontent.com/nasroykh/foxmayn_frappe_cli/main/install.sh | sh" >&2
  echo "Then configure: ffc init" >&2
  exit 1
fi

# ─── Build args string ────────────────────────────────────────────────────────

build_args_json() {
  # Outputs a JSON array string for the ffc mcp command args
  if [ "$SITE" != "default" ] && [ $READ_ONLY -eq 1 ]; then
    printf '["mcp","--site","%s","--read-only"]' "$SITE"
  elif [ "$SITE" != "default" ]; then
    printf '["mcp","--site","%s"]' "$SITE"
  elif [ $READ_ONLY -eq 1 ]; then
    printf '["mcp","--read-only"]'
  else
    printf '["mcp"]'
  fi
}

build_args_toml() {
  if [ "$SITE" != "default" ] && [ $READ_ONLY -eq 1 ]; then
    printf '"mcp", "--site", "%s", "--read-only"' "$SITE"
  elif [ "$SITE" != "default" ]; then
    printf '"mcp", "--site", "%s"' "$SITE"
  elif [ $READ_ONLY -eq 1 ]; then
    printf '"mcp", "--read-only"'
  else
    printf '"mcp"'
  fi
}

# ─── JSON merge helper (POSIX sh, no jq required) ────────────────────────────
# Inserts or replaces the "frappe" server entry in an existing JSON config.
# Uses Python if available (fast path), otherwise falls back to awk.

merge_mcp_json_mcpservers() {
  # Usage: merge_mcp_json_mcpservers <file> <ffc_bin> <args_json>
  FILE="$1"; BIN="$2"; ARGS="$3"

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$FILE" "$BIN" "$ARGS" <<'PYEOF'
import sys, json, os

path, bin_, args_json = sys.argv[1], sys.argv[2], sys.argv[3]
data = {}
if os.path.exists(path):
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        pass

data.setdefault("mcpServers", {})
data["mcpServers"]["frappe"] = {"command": bin_, "args": json.loads(args_json)}

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PYEOF
  else
    # Fallback: just write a fresh file (won't preserve other servers)
    printf '{\n  "mcpServers": {\n    "frappe": {\n      "command": "%s",\n      "args": %s\n    }\n  }\n}\n' \
      "$BIN" "$ARGS" > "$FILE"
  fi
}

merge_vscode_json() {
  FILE="$1"; BIN="$2"; ARGS="$3"

  if command -v python3 >/dev/null 2>&1; then
    python3 - "$FILE" "$BIN" "$ARGS" <<'PYEOF'
import sys, json, os

path, bin_, args_json = sys.argv[1], sys.argv[2], sys.argv[3]
data = {}
if os.path.exists(path):
    try:
        with open(path) as f:
            data = json.load(f)
    except Exception:
        pass

data.setdefault("servers", {})
data["servers"]["frappe"] = {"command": bin_, "args": json.loads(args_json)}

with open(path, "w") as f:
    json.dump(data, f, indent=2)
    f.write("\n")
PYEOF
  else
    printf '{\n  "servers": {\n    "frappe": {\n      "command": "%s",\n      "args": %s\n    }\n  }\n}\n' \
      "$BIN" "$ARGS" > "$FILE"
  fi
}

# ─── Per-client logic ─────────────────────────────────────────────────────────

ARGS_JSON=$(build_args_json)

case "$CLIENT" in
  claude)
    CONFIG=".mcp.json"
    merge_mcp_json_mcpservers "$CONFIG" "$FFC_BIN" "$ARGS_JSON"
    echo ""
    echo "Written: $CONFIG"
    echo "  → Restart Claude Code, then run /mcp to verify the frappe server is listed."
    ;;

  cursor)
    mkdir -p .cursor
    CONFIG=".cursor/mcp.json"
    merge_mcp_json_mcpservers "$CONFIG" "$FFC_BIN" "$ARGS_JSON"
    echo ""
    echo "Written: $CONFIG"
    echo "  → Open Cursor Settings → MCP and enable the 'frappe' server."
    ;;

  vscode)
    mkdir -p .vscode
    CONFIG=".vscode/mcp.json"
    merge_vscode_json "$CONFIG" "$FFC_BIN" "$ARGS_JSON"
    echo ""
    echo "Written: $CONFIG"
    echo "  → Open .vscode/mcp.json in VS Code and click 'Start' next to the frappe server."
    ;;

  codex)
    ARGS_TOML=$(build_args_toml)
    echo ""
    echo "Add the following to ~/.codex/config.toml:"
    echo ""
    echo "[mcp_servers.frappe]"
    echo "command = \"$FFC_BIN\""
    echo "args = [$ARGS_TOML]"
    echo ""
    ;;

  gemini)
    mkdir -p .gemini
    CONFIG=".gemini/settings.json"
    merge_mcp_json_mcpservers "$CONFIG" "$FFC_BIN" "$ARGS_JSON"
    echo ""
    echo "Written: $CONFIG"
    echo "  → Gemini CLI will pick up the MCP server on next run."
    ;;
esac
