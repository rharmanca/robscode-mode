# Code-Mode Setup Guide

**Status:** ✅ Working - 272 tools across 10 MCPs

## Quick Start

### 1. Build the Server
```bash
cd code-mode-mcp
npm install
npm run build
```

### 2. Configure OpenCode

Add to your `opencode.json` (project or global):

```json
{
  "mcp": {
    "code-mode": {
      "type": "local",
      "command": ["node", "/path/to/robscode-mode/code-mode-mcp/dist/index.js"],
      "enabled": true,
      "timeout": 60000,
      "environment": {
        "UTCP_CONFIG_FILE": "/path/to/robscode-mode/.utcp_config.json"
      }
    }
  }
}
```

**CRITICAL:** The `timeout: 60000` (60 seconds) is required! OpenCode defaults to 5 seconds, but code-mode needs 25-30 seconds to discover tools from all MCPs.

### 3. Configure MCPs

Edit `.utcp_config.json` to add your MCP servers:

```json
{
  "manual_call_templates": [{
    "name": "mcp-servers",
    "call_template_type": "mcp",
    "config": {
      "mcpServers": {
        "your-mcp": {
          "transport": "stdio",
          "command": "npx",
          "args": ["package-name"],
          "env": { "API_KEY": "value" }
        }
      }
    }
  }]
}
```

### 4. Restart OpenCode

After configuration, restart OpenCode. First startup takes 25-30 seconds for tool discovery.

### 5. Verify

```
mcp_code-mode_list_tools  // Should show all tools
```

## Available Tools

| Tool | Description |
|------|-------------|
| `mcp_code-mode_list_tools` | List all 272 tools across MCPs |
| `mcp_code-mode_search_tools` | Search tools by task description |
| `mcp_code-mode_tool_info` | Get TypeScript interface for a tool |
| `mcp_code-mode_call_tool_chain` | Execute multi-MCP workflows |

## Connected MCPs (Current)

| MCP | Tools | Purpose |
|-----|-------|---------|
| google_workspace | 100 | Gmail, Calendar, Drive, Docs, Sheets |
| n8n_mcp | 42 | Workflow automation |
| todoist | 35 | Task management |
| chrome_devtools | 26 | Browser automation |
| desktop_commander | 25 | System commands, file ops |
| git | 15 | Git operations |
| filesystem | 14 | File system access |
| memory | 9 | Persistent memory |
| tavily | 4 | Web search |
| ref | 2 | API documentation |

**Total: 272 tools**

## Troubleshooting

### Tools not loading
**Cause:** OpenCode's default 5-second timeout

**Fix:** Ensure `"timeout": 60000` in your opencode.json config

### Server works but OpenCode shows no tools
1. Check timeout setting (most common issue)
2. Verify paths in config are correct
3. Check UTCP_CONFIG_FILE environment variable
4. Restart OpenCode

### Test server directly
```bash
cd code-mode-mcp
UTCP_CONFIG_FILE="../.utcp_config.json" node dist/index.js
```

Should show tool discovery progress and "Successfully registered X tools"
