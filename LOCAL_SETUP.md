# Local Code-Mode Setup for OpenCode

**Last Updated:** January 12, 2026  
**Status:** Working - 6 MCPs connected, 180+ tools available

## Quick Reference

### Files

| File | Purpose |
|------|---------|
| `.utcp_config.json` | MCP server definitions (UTCP format) |
| `code-mode-mcp/dist/index.js` | Compiled MCP server |
| `~/.config/opencode/opencode.json` | OpenCode MCP registration |
| `~/.config/opencode/plugin/code-mode-router.ts` | Usage tracking plugin |

### Test the Server

```bash
cd /Volumes/Extreme\ SSD/Synced\ New\ Project\ Folders/OpenCode/robscode-mode/code-mode-mcp
UTCP_CONFIG_FILE="../.utcp_config.json" node dist/index.js
```

Expected output: Tool discovery from n8n-mcp, google-workspace, tavily, memory, desktop-commander, filesystem (180+ tools total).

## Connected MCP Servers

| Server | Tools | Status |
|--------|-------|--------|
| n8n-mcp | 42 | ✅ Working |
| google-workspace | 100 | ✅ Working |
| tavily | 4 | ✅ Working |
| memory | 9 | ✅ Working |
| desktop-commander | 25 | ✅ Working |
| filesystem | 11 | ✅ Working |

## OpenCode Tools Available

After restart, these tools are available:

- `mcp_code-mode_list_tools` - List all 180+ tools
- `mcp_code-mode_search_tools` - Search by task description
- `mcp_code-mode_tool_info` - Get TypeScript interface
- `mcp_code-mode_call_tool_chain` - Execute multi-MCP workflows

## Adding More MCP Servers

Edit `.utcp_config.json`:

```json
{
  "manual_call_templates": [{
    "name": "mcp-servers",
    "call_template_type": "mcp",
    "config": {
      "mcpServers": {
        "new-server": {
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

## Troubleshooting

### Server won't start
- Check UTCP config JSON syntax
- Verify `transport: "stdio"` is set
- Check MCP package names are correct

### Tools not appearing
- Restart OpenCode
- Check server logs for errors
- Verify UTCP_CONFIG_FILE path in opencode.json

## Documentation

- **Full Obsidian Docs:** `/Volumes/Extreme SSD/Obsidian/30-RESOURCES/34-Reference/Tech-Setup/MCP-Servers/Code-Mode-Integration.md`
- **CLAUDE.md:** `~/.claude/CLAUDE.md` (Code-Mode Usage section)
- **Original README:** See `README.md` in this directory
