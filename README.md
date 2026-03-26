<div align="center">
  <img width="150" height="150" alt="logo-foxmayn" src="https://github.com/user-attachments/assets/fa9f3727-dd5c-4748-92e9-f527a740366a" />
</div>

# foxmayn-frappe-mcp

Connect AI agents to your Frappe/ERPNext site via the [Model Context Protocol](https://modelcontextprotocol.io).

This package configures [`ffc`](https://github.com/nasroykh/foxmayn_frappe_cli) as an MCP server, giving Claude Code, Cursor, VS Code Copilot, Codex CLI, and Gemini CLI direct, structured access to your Frappe ERP data — no custom API wrappers, no copy-pasting, no manual lookups.

---

## What is this?

`ffc` is a CLI for Frappe/ERPNext. It can already read and write documents, run reports, and call server methods. This package adds one thing: an `npx` command that writes the correct MCP config file for your AI client so it can use `ffc` as an MCP server.

When an AI agent is connected:

```
AI agent ↔ MCP protocol ↔ ffc mcp ↔ Frappe REST API ↔ ERPNext
```

The agent sees a set of tools (`get_doc`, `list_docs`, `create_doc`, etc.) and calls them naturally as part of conversation.

---

## Prerequisites

1. **`ffc` installed and configured**

   ```sh
   # Install ffc
   curl -fsSL https://raw.githubusercontent.com/nasroykh/foxmayn_frappe_cli/main/install.sh | sh

   # Configure a site
   ffc init
   ```

2. An AI client that supports MCP (Claude Code, Cursor, VS Code with Copilot, Codex CLI, or Gemini CLI).

---

## Quick Start

### Claude Code

```sh
npx foxmayn-frappe-mcp init --client claude
```

Restart Claude Code, then run `/mcp` to verify the `frappe` server appears.

### Cursor

```sh
npx foxmayn-frappe-mcp init --client cursor
```

Open Cursor Settings → MCP and enable the `frappe` server.

### VS Code (GitHub Copilot)

```sh
npx foxmayn-frappe-mcp init --client vscode
```

Open `.vscode/mcp.json` and click **Start** next to the `frappe` server.

### Codex CLI

```sh
npx foxmayn-frappe-mcp init --client codex
```

Prints the TOML snippet to add to `~/.codex/config.toml`.

### Gemini CLI

```sh
npx foxmayn-frappe-mcp init --client gemini
```

Writes `.gemini/settings.json` in the current directory.

---

## Options

```sh
npx foxmayn-frappe-mcp init [options]

Options:
  --client <name>    AI client: claude | cursor | vscode | codex | gemini
  --site <name>      ffc site name to use (default: "default")
  --ffc-path <path>  Path to ffc binary if not on PATH
  --read-only        Disable write tools (create_doc, update_doc, delete_doc)
```

### Examples

```sh
# Configure for a specific site
npx foxmayn-frappe-mcp init --client claude --site production

# Restrict to read-only on a production site
npx foxmayn-frappe-mcp init --client cursor --site production --read-only

# Use ffc from a custom path
npx foxmayn-frappe-mcp init --client vscode --ffc-path /usr/local/bin/ffc
```

---

## No npm? Shell script alternative

```sh
# Same as npx, no Node required
curl -fsSL https://raw.githubusercontent.com/nasroykh/foxmayn_frappe_mcp/main/install-mcp.sh | sh -s -- --client claude
curl -fsSL https://raw.githubusercontent.com/nasroykh/foxmayn_frappe_mcp/main/install-mcp.sh | sh -s -- --client cursor --site production
```

---

## Available Tools

The MCP server exposes these tools. All read operations are safe; write operations modify data on your Frappe site.

| Tool            | Description                                             |
| --------------- | ------------------------------------------------------- |
| `ping`          | Check connectivity. Always run this first.              |
| `get_doc`       | Retrieve a single document by DocType and name.         |
| `list_docs`     | List documents with filtering, sorting, and pagination. |
| `create_doc`    | Create a new document.                                  |
| `update_doc`    | Update fields on an existing document.                  |
| `delete_doc`    | Permanently delete a document.                          |
| `count_docs`    | Count documents matching a filter.                      |
| `get_schema`    | Get full field definitions for a DocType.               |
| `list_doctypes` | List all DocTypes on the site, optionally by module.    |
| `list_reports`  | List available reports, optionally by module.           |
| `run_report`    | Execute a query report and return columns + rows.       |
| `call_method`   | Call any whitelisted Frappe server method.              |

Use `--read-only` to start `ffc mcp` without `create_doc`, `update_doc`, and `delete_doc`. Recommended for production sites when you only need the agent to read and report.

---

## Example Prompts

Once connected, you can ask your AI agent things like:

- *"Show me all unpaid Sales Invoices from this month."*
- *"How many open Purchase Orders do we have?"*
- *"What fields does the Sales Invoice DocType have?"*
- *"Create a ToDo for john@example.com to review the Q1 report."*
- *"Run the General Ledger report for January 2026 and summarize it."*
- *"List all customers in the Retail segment."*
- *"Update Invoice SINV-00042 — set the status to Paid."*

---

## Manual Configuration

If you prefer to write the config yourself:

### Claude Code — `.mcp.json`

```json
{
  "mcpServers": {
    "frappe": {
      "command": "ffc",
      "args": ["mcp", "--site", "production"]
    }
  }
}
```

### Cursor — `.cursor/mcp.json`

Same structure as Claude Code.

### VS Code — `.vscode/mcp.json`

```json
{
  "servers": {
    "frappe": {
      "command": "ffc",
      "args": ["mcp", "--site", "production"]
    }
  }
}
```

### Codex CLI — `~/.codex/config.toml`

```toml
[mcp_servers.frappe]
command = "ffc"
args = ["mcp", "--site", "production"]
```

### Gemini CLI — `.gemini/settings.json`

```json
{
  "mcpServers": {
    "frappe": {
      "command": "ffc",
      "args": ["mcp", "--site", "production"]
    }
  }
}
```

### Read-only mode

Add `"--read-only"` to `args` in any config above:

```json
"args": ["mcp", "--site", "production", "--read-only"]
```

---

## How It Works

```
┌─────────────────┐       MCP stdio        ┌─────────────┐      HTTP/REST      ┌──────────────┐
│   AI Agent      │ ──── JSON-RPC 2.0 ───▶ │   ffc mcp   │ ──── Frappe API ──▶ │  ERPNext /   │
│ (Claude, Cursor │ ◀───────────────────── │             │ ◀────────────────── │  Frappe site │
│  VS Code, etc.) │                        └─────────────┘                     └──────────────┘
└─────────────────┘
```

`ffc mcp` is a stdio MCP server. The AI client starts it as a subprocess and communicates via newline-delimited JSON-RPC. Each tool call maps directly to a Frappe REST API call using the same credentials configured in `~/.config/ffc/config.yaml`.

No cloud intermediary. No data leaves your machine except to your own Frappe site.

---

## Multiple Sites

Run a separate `ffc mcp` instance per site. Each MCP server entry in your config gets its own name:

```json
{
  "mcpServers": {
    "frappe-prod": {
      "command": "ffc",
      "args": ["mcp", "--site", "production"]
    },
    "frappe-staging": {
      "command": "ffc",
      "args": ["mcp", "--site", "staging"]
    }
  }
}
```

---

## Security Notes

- API credentials are read from `~/.config/ffc/config.yaml` — never embedded in the MCP config.
- Use `--read-only` on production sites when agents only need to query data.
- Each tool call uses the same permissions as the configured API key. Create a read-only API key in Frappe for agents that should not modify data.

---

## Part of the Foxmayn Ecosystem

| Tool                                                    | Purpose                             |
| ------------------------------------------------------- | ----------------------------------- |
| [`ffc`](https://github.com/nasroykh/foxmayn_frappe_cli) | CLI for Frappe/ERPNext REST API     |
| `ffm`                                                   | Docker-based Frappe bench manager   |
| `foxmayn-frappe-mcp`                                    | AI agent integration (this package) |

---

## License

MIT
