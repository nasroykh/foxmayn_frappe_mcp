---
name: foxmayn-frappe-mcp
description: How to connect AI agents to Frappe/ERPNext via MCP using the foxmayn-frappe-mcp package and the ffc CLI. Use this skill whenever the user mentions Frappe, ERPNext, ffc, DocTypes, Frappe documents, Frappe reports, Frappe REST API, or wants to query, create, update, or delete data on a Frappe site — even if they don't explicitly mention MCP. Also use it when the user asks about configuring MCP servers for AI clients (Claude Code, Cursor, VS Code Copilot, Codex CLI, Gemini CLI) to talk to an ERP system, or when they want to run financial reports, manage purchase/sales orders, invoices, or any ERPNext workflow through an AI agent.
---

# foxmayn-frappe-mcp

Connect AI agents to Frappe/ERPNext sites via the Model Context Protocol (MCP).

This package configures [`ffc`](https://github.com/nasroykh/foxmayn_frappe_cli) as a stdio MCP server, giving AI agents structured access to Frappe ERP data — no custom API wrappers, no copy-pasting, no manual lookups.

```
AI agent  ←→  MCP (JSON-RPC 2.0 over stdio)  ←→  ffc mcp  ←→  Frappe REST API  ←→  ERPNext
```

No cloud intermediary. Data only flows between the local machine and the user's own Frappe site.

---

## Setup

### Prerequisites

1. **`ffc` installed and configured** with at least one site:
   ```sh
   curl -fsSL https://raw.githubusercontent.com/nasroykh/foxmayn_frappe_cli/main/install.sh | sh
   ffc init
   ```
2. An AI client that supports MCP.

### Configuring the MCP Server

Run the init command for the target AI client:

```sh
# Claude Code
npx foxmayn-frappe-mcp init --client claude

# Cursor
npx foxmayn-frappe-mcp init --client cursor

# VS Code (GitHub Copilot)
npx foxmayn-frappe-mcp init --client vscode

# Codex CLI
npx foxmayn-frappe-mcp init --client codex

# Gemini CLI
npx foxmayn-frappe-mcp init --client gemini
```

After running, restart or refresh the AI client. The `frappe` MCP server should appear in the client's MCP settings.

### Options

| Flag | Description |
|---|---|
| `--client <name>` | AI client: `claude`, `cursor`, `vscode`, `codex`, `gemini` |
| `--site <name>` | ffc site name (default: `"default"`) |
| `--ffc-path <path>` | Custom path to `ffc` binary if not on PATH |
| `--read-only` | Disable write tools (`create_doc`, `update_doc`, `delete_doc`) |

Use `--read-only` on production sites when the agent only needs to query data.

### No npm? Shell script alternative

```sh
curl -fsSL https://raw.githubusercontent.com/nasroykh/foxmayn_frappe_mcp/main/install-mcp.sh | sh -s -- --client claude
```

### Multiple sites

Run a separate `ffc mcp` instance per site with different server names:

```json
{
  "mcpServers": {
    "frappe-prod": { "command": "ffc", "args": ["mcp", "--site", "production"] },
    "frappe-staging": { "command": "ffc", "args": ["mcp", "--site", "staging"] }
  }
}
```

---

## Available MCP Tools

Once the server is connected, these tools are available to the AI agent:

| Tool | Description | Safe? |
|---|---|---|
| `ping` | Check connectivity to the Frappe site. Always run first. | ✅ |
| `get_doc` | Retrieve a single document by DocType and name. | ✅ |
| `list_docs` | List documents with filtering, sorting, pagination. | ✅ |
| `count_docs` | Count documents matching a filter. | ✅ |
| `get_schema` | Get full field definitions for a DocType. | ✅ |
| `list_doctypes` | List all DocTypes on the site, optionally by module. | ✅ |
| `list_reports` | List available reports, optionally by module. | ✅ |
| `run_report` | Execute a query report and return columns + rows. | ✅ |
| `call_method` | Call any whitelisted Frappe server method. | ⚠️ |
| `create_doc` | Create a new document. | ❌ Write |
| `update_doc` | Update fields on an existing document. | ❌ Write |
| `delete_doc` | Permanently delete a document. | ❌ Write |

Write tools (`create_doc`, `update_doc`, `delete_doc`) are disabled when `--read-only` is used.

---

## Common Workflows

### Querying data

```
User: "Show me all unpaid Sales Invoices from this month"
→ Agent calls list_docs with doctype="Sales Invoice", filters for status and date
```

```
User: "How many open Purchase Orders do we have?"
→ Agent calls count_docs with doctype="Purchase Order", filters for status
```

### Understanding schema

```
User: "What fields does the Sales Invoice DocType have?"
→ Agent calls get_schema with doctype="Sales Invoice"
```

This is often the essential first step before creating or updating documents — the agent needs to know what fields exist and which are required.

### Running reports

```
User: "Run the General Ledger report for January 2026"
→ Agent calls run_report with the report name and date filters
```

```
User: "Show me the Profit and Loss Statement for Q4"
→ Agent calls run_report with "Profit and Loss Statement" and period filters
```

### Creating and modifying data

```
User: "Create a ToDo for john@example.com to review the Q1 report"
→ Agent calls get_schema to learn required fields, then create_doc

User: "Update Invoice SINV-00042 — set the status to Paid"
→ Agent calls update_doc with doctype, name, and field values
```

### Discovery

```
User: "What DocTypes are available in the Accounts module?"
→ Agent calls list_doctypes with module="Accounts"

User: "What reports can I run?"
→ Agent calls list_reports
```

---

## Best Practices

1. **Always `ping` first** — verify the connection before doing anything else.
2. **Always `get_schema` before writing** — understand required fields and field types before calling `create_doc` or `update_doc`.
3. **Use `--read-only` on production** — prevent accidental writes.
4. **Use named sites for multi-site setups** — never guess which site is `"default"`.
5. **Check tool permissions** — some Frappe methods require specific user roles. The agent operates with the same permissions as the API key configured in `~/.config/ffc/config.yaml`.

---

## Config File Locations

| Client | Config path | Key structure |
|---|---|---|
| Claude Code | `.mcp.json` | `mcpServers.frappe` |
| Cursor | `.cursor/mcp.json` | `mcpServers.frappe` |
| VS Code | `.vscode/mcp.json` | `servers.frappe` |
| Codex CLI | `~/.codex/config.toml` | `[mcp_servers.frappe]` |
| Gemini CLI | `.gemini/settings.json` | `mcpServers.frappe` |

Note the key difference: VS Code uses `servers` instead of `mcpServers`.

---

## Troubleshooting

### "ffc not found"
`ffc` is not installed or not on PATH. Install it:
```sh
curl -fsSL https://raw.githubusercontent.com/nasroykh/foxmayn_frappe_cli/main/install.sh | sh
```
Or point to the binary with `--ffc-path`.

### MCP server not appearing in the AI client
- Check that the config file was written to the correct location.
- Restart the AI client after running `init`.
- For Claude Code: run `/mcp` to list servers.
- For Cursor: check Settings → MCP.
- For VS Code: open `.vscode/mcp.json` and click **Start**.

### Connection errors / ping fails
- Verify `ffc` can reach the site: run `ffc ping` directly in the terminal.
- Check credentials in `~/.config/ffc/config.yaml`.
- Ensure the Frappe site is reachable from the machine.

### Permission errors on write operations
The MCP server uses the same API key permissions as `ffc`. Check the API key's role in Frappe's user settings.

---

## Security Notes

- API credentials live in `~/.config/ffc/config.yaml` — never embedded in MCP config files.
- Each tool call uses the same permissions as the configured API key.
- Create a restricted API key in Frappe for agents that should not modify data.
- No data leaves the local machine except to the user's own Frappe site.

---

## Part of the Foxmayn Ecosystem

| Tool | Purpose |
|---|---|
| [`ffc`](https://github.com/nasroykh/foxmayn_frappe_cli) | CLI for Frappe/ERPNext REST API |
| `ffm` | Docker-based Frappe bench manager |
| [`foxmayn-frappe-mcp`](https://github.com/nasroykh/foxmayn_frappe_mcp) | AI agent MCP integration (this package) |
