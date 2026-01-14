# OpenCode Configuration Repository

## Browser Automation - MANDATORY

**CRITICAL: Use ONLY Chrome DevTools MCP - Never open new browsers**

**Forbidden:** Playwright, Puppeteer, headless browsers, new browser windows, isolated sessions

**Required:** Use chrome-devtools_* tools, connect to existing Edge at http://localhost:9222, preserve logged-in sessions

**Tools:**
- Navigation: chrome-devtools_new_page, chrome-devtools_navigate_page, chrome-devtools_list_pages
- Interaction: chrome-devtools_click, chrome-devtools_fill, chrome-devtools_hover, chrome-devtools_press_key
- Content: chrome-devtools_take_screenshot, chrome-devtools_take_snapshot, chrome-devtools_evaluate_script
- Debugging: chrome-devtools_list_console_messages, chrome-devtools_list_network_requests

**If tools fail:** Tell user "Edge needs to be running with remote debugging. Please start Edge using the 'Edge (with DevTools)' desktop shortcut, then try again."

## Code-Mode Tools

30 MCP tools available through UTCP code-mode for on-demand access.

**Available tools:**
- **brave-search** - Web search (MCP: brave-search)
- **context7** - Documentation lookup (MCP: context7)
- **tavily** - Web research (MCP: tavily)
- **github** - Repository operations (MCP: github)
- **google-workspace** - Gmail, Calendar, Sheets (MCP: google-workspace)
- **work-google-workspace** - Work Gmail, Calendar, Drive (MCP: work-google-workspace)
- **n8n** - Workflow automation (MCP: n8n)
- **playwright** - Browser automation (MCP: playwright)
- **spotify** - Music control (MCP: spotify)
- **taskmaster** - Project management (MCP: taskmaster)
- **ref** - Documentation search (MCP: ref)
- **brightdata** - Data extraction (MCP: brightdata)
- **todoist** - Task management (MCP: todoist)
- **cois** - Analysis (MCP: cois)
- **+17 more tools** - desktop-commander, duckduckgo, fetch, filesystem, hostinger, hyperbrowser, maigret, mem0, memory, pal, phoneinfoga, railway, searxng, sequential-thinking, sherlock, theharvester

**Usage workflow:**
1. Search for relevant tools: `code-mode_search_tools task_description="your task"`
2. Get tool details: `code-mode_get_required_keys_forTool tool_name="manual.function"`
3. Execute with TypeScript: `code-mode_callToolChain` with `manual.braveSearch.search({ query: "..." })`

**Manual naming:** Use camelCase (e.g., `manual.braveSearch`, `manual.googleWorkspace`, `manual.context7`)

**Environment variables:** Auto-configured in UTCP config. Never ask user for credentials.

**Note:** Playwright is registered but browser automation should use chrome-devtools tools only (see Browser Automation section above).

## Build/Test/Lint

No build/test/lint scripts. Configuration repository only.

```bash
npm install  # Install dependencies
npm update   # Update dependencies

# Custom scripts
node scripts/sync-nanogpt-models.mjs [--dry-run] [--test]  # Sync models
node scripts/reset-nanogpt-models.mjs                       # Reset to defaults
```

## Code Style

### TypeScript (tool/*.ts)

**Formatting:** 2 spaces, double quotes, optional semicolons, no trailing commas

**Naming:**
- Files: kebab-case (n8n.ts, sshpass.ts)
- Variables/Functions: camelCase (baseUrl, execute, apiKey)
- Environment Variables: UPPER_SNAKE_CASE (API_KEY, BASE_URL)
- Types/Interfaces: PascalCase (ToolConfig, RequestInit)

**Imports:**
```typescript
import { tool } from "@opencode-ai/plugin"
import { execSync } from "child_process"
import { readFile } from "fs/promises"
import { join } from "path"
```

**Type annotations:**
```typescript
async execute(args: { method: string; endpoint: string; body?: string })
const options: RequestInit = { method: args.method, headers: {...} }
```

**Error handling - return strings, never throw:**
```typescript
try {
  const response = await fetch(url, options)
  if (!response.ok) {
    const data = await response.text()
    return `Error ${response.status}: ${data}`
  }
  return data
} catch (error) {
  return `Request failed: ${error}`
}
```

**Tool template:**
```typescript
import { tool } from "@opencode-ai/plugin"

export default tool({
  description: `Clear description`,
  args: {
    param1: tool.schema.string().describe("What this does"),
    param2: tool.schema.number().optional().describe("Optional param")
  },
  async execute(args) {
    const apiKey = process.env.API_KEY || "default"
    try {
      return result
    } catch (error) {
      return `Error: ${error}`
    }
  }
})
```

### JavaScript (scripts/*.mjs)

**Imports:**
```javascript
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
const __dirname = path.dirname(fileURLToPath(import.meta.url))
```

**JSDoc header:**
```javascript
#!/usr/bin/env node
/**
 * Script description
 * Usage: node scripts/script.mjs
 * Environment: API_KEY - Required API key
 */
```

**Error handling:**
```javascript
try {
  await main()
} catch (error) {
  console.error(`Failed: ${error.message}`)
  process.exit(1)
}
```

### JSON/JSONC
- 2 spaces indentation
- All keys quoted
- No trailing commas
- Group related configs (providers, mcp, agents, tools)

### Environment Variables
Store secrets in .env, reference with `process.env.VARIABLE_NAME`

Common: BRAVE_API_KEY, N8N_API_KEY, MEM0_API_KEY, NANOGPT_API_KEY

Configure in opencode.json mcp.*.environment for MCP servers

## Architecture Patterns

**No TypeScript compilation:** Tools execute directly via Node.js. No tsc or build commands.

**MCP-first:** Check if MCP server exists before creating custom tools.

**Tool return values:** Custom tools MUST return strings. Return errors as strings, never throw.

**Agent specialization:**
- Code changes: build agent
- Planning/analysis: plan agent
- Web research: websearch agent
- Browser automation: browser agent

## Repository Structure

```
opencode.json      # Main configuration
.env               # Environment variables (gitignored)
tool/              # Custom OpenCode tools (TypeScript)
skills/            # Project-specific skills
superpowers/       # Shared skills
agent/             # Agent configuration files
command/           # Custom slash commands
contexts/          # Context definitions
themes/            # UI themes
plugins/           # MCP plugin configurations
docs/              # Documentation
```