#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { execSync, spawnSync } from "child_process";
import { createInterface } from "readline";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = join(__dirname, "..", "templates");

const CLIENTS = ["claude", "cursor", "vscode", "codex", "gemini"];
const VERSION = JSON.parse(
  readFileSync(join(__dirname, "..", "package.json"), "utf8")
).version;

// ─── Arg parsing ─────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const next = argv[i + 1];
      flags[key] = next && !next.startsWith("--") ? (i++, next) : true;
    }
  }
  return flags;
}

const args = process.argv.slice(2);
const command = args[0];
const flags = parseArgs(args.slice(1));

if (command === "--version" || command === "-v") {
  console.log(VERSION);
  process.exit(0);
}

if (!command || command === "--help" || command === "-h" || command !== "init") {
  console.log(`foxmayn-frappe-mcp v${VERSION}

Usage:
  npx foxmayn-frappe-mcp init [options]

Options:
  --client <name>    AI client to configure: claude | cursor | vscode | codex | gemini
  --site <name>      ffc site name (default: "default")
  --ffc-path <path>  Path to ffc binary (default: auto-detect from PATH)
  --read-only        Disable write tools (create, update, delete)

Examples:
  npx foxmayn-frappe-mcp init
  npx foxmayn-frappe-mcp init --client claude
  npx foxmayn-frappe-mcp init --client cursor --site production
  npx foxmayn-frappe-mcp init --client vscode --site staging --read-only
`);
  process.exit(command && command !== "--help" && command !== "-h" ? 1 : 0);
}

// ─── Interactive client picker ────────────────────────────────────────────────

async function promptClient() {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    console.log("\nSelect an AI client to configure:\n");
    CLIENTS.forEach((c, i) => console.log(`  ${i + 1}. ${c}`));
    console.log();
    rl.question("Enter number or client name: ", (answer) => {
      rl.close();
      const num = parseInt(answer, 10);
      if (num >= 1 && num <= CLIENTS.length) {
        resolve(CLIENTS[num - 1]);
      } else if (CLIENTS.includes(answer.trim().toLowerCase())) {
        resolve(answer.trim().toLowerCase());
      } else {
        console.error(`\nUnknown client: "${answer}". Choose one of: ${CLIENTS.join(", ")}`);
        process.exit(1);
      }
    });
  });
}

// ─── ffc detection ───────────────────────────────────────────────────────────

function findFfc(ffcPath) {
  const bin = ffcPath || "ffc";
  const result = spawnSync(bin, ["--version"], { encoding: "utf8" });
  if (result.status === 0) return bin;
  return null;
}

// ─── JSON config helpers ──────────────────────────────────────────────────────

function readJSON(filePath) {
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch {
    console.warn(`Warning: could not parse existing ${filePath}, it will be overwritten.`);
    return {};
  }
}

function writeJSON(filePath, data) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function buildServerEntry(ffcBin, site, readOnly) {
  const mcpArgs = ["mcp"];
  if (site && site !== "default") mcpArgs.push("--site", site);
  if (readOnly) mcpArgs.push("--read-only");
  return { command: ffcBin, args: mcpArgs };
}

// ─── Per-client init logic ────────────────────────────────────────────────────

function initClaude(ffcBin, site, readOnly) {
  const configPath = join(process.cwd(), ".mcp.json");
  const config = readJSON(configPath);
  config.mcpServers = config.mcpServers || {};
  config.mcpServers.frappe = buildServerEntry(ffcBin, site, readOnly);
  writeJSON(configPath, config);
  console.log(`\nWrote .mcp.json`);
  console.log("  → Restart Claude Code, then run /mcp to verify the frappe server is listed.\n");
}

function initCursor(ffcBin, site, readOnly) {
  const configPath = join(process.cwd(), ".cursor", "mcp.json");
  const config = readJSON(configPath);
  config.mcpServers = config.mcpServers || {};
  config.mcpServers.frappe = buildServerEntry(ffcBin, site, readOnly);
  writeJSON(configPath, config);
  console.log(`\nWrote .cursor/mcp.json`);
  console.log("  → Open Cursor Settings → MCP and enable the 'frappe' server.\n");
}

function initVscode(ffcBin, site, readOnly) {
  const configPath = join(process.cwd(), ".vscode", "mcp.json");
  const config = readJSON(configPath);
  config.servers = config.servers || {};
  config.servers.frappe = buildServerEntry(ffcBin, site, readOnly);
  writeJSON(configPath, config);
  console.log(`\nWrote .vscode/mcp.json`);
  console.log("  → Open .vscode/mcp.json in VS Code and click 'Start' next to the frappe server.\n");
}

function initCodex(ffcBin, site, readOnly) {
  const entry = buildServerEntry(ffcBin, site, readOnly);
  const argsStr = entry.args.map((a) => `"${a}"`).join(", ");
  console.log(`
Add this to your ~/.codex/config.toml:

[mcp_servers.frappe]
command = "${entry.command}"
args = [${argsStr}]
`);
}

function initGemini(ffcBin, site, readOnly) {
  const geminiDir = join(process.cwd(), ".gemini");
  const configPath = join(geminiDir, "settings.json");
  const config = readJSON(configPath);
  config.mcpServers = config.mcpServers || {};
  config.mcpServers.frappe = buildServerEntry(ffcBin, site, readOnly);
  writeJSON(configPath, config);
  console.log(`\nWrote .gemini/settings.json`);
  console.log("  → Gemini CLI will pick up the MCP server on next run.\n");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const ffcBin = findFfc(flags["ffc-path"]);
if (!ffcBin) {
  const path = flags["ffc-path"] || "ffc";
  console.error(`\nError: '${path}' not found or not executable.`);
  console.error(
    "Install ffc: curl -fsSL https://raw.githubusercontent.com/nasroykh/foxmayn_frappe_cli/main/install.sh | sh"
  );
  console.error("Then run: ffc init\n");
  process.exit(1);
}

const client = flags.client || (await promptClient());
const site = flags.site || "default";
const readOnly = Boolean(flags["read-only"]);

if (!CLIENTS.includes(client)) {
  console.error(`\nUnknown client: "${client}". Choose one of: ${CLIENTS.join(", ")}\n`);
  process.exit(1);
}

console.log(`\nConfiguring MCP for ${client}${site !== "default" ? ` (site: ${site})` : ""}${readOnly ? " [read-only]" : ""}...`);

switch (client) {
  case "claude":  initClaude(ffcBin, site, readOnly);  break;
  case "cursor":  initCursor(ffcBin, site, readOnly);  break;
  case "vscode":  initVscode(ffcBin, site, readOnly);  break;
  case "codex":   initCodex(ffcBin, site, readOnly);   break;
  case "gemini":  initGemini(ffcBin, site, readOnly);  break;
}
