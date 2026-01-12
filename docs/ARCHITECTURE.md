# Code-Mode Architecture

## Overview

Code-mode is a UTCP-based MCP orchestration server that provides unified access to multiple MCP servers through a single interface.

```
┌─────────────────────────────────────────────────────────────┐
│                     OpenCode CLI                             │
│                                                              │
│  Available Tools:                                            │
│  - mcp_code-mode_list_tools                                  │
│  - mcp_code-mode_search_tools                                │
│  - mcp_code-mode_call_tool_chain                             │
│  - mcp_code-mode_tool_info                                   │
├─────────────────────────────────────────────────────────────┤
│                    Code-Mode MCP Server                      │
│                    (UTCP Orchestrator)                       │
│                                                              │
│  - Tool discovery with wait mechanism                        │
│  - Disk caching for faster starts                            │
│  - TypeScript execution for workflows                        │
├─────────────────────────────────────────────────────────────┤
│                    UTCP Client Layer                         │
│                    (.utcp_config.json)                       │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┬─────┤
│google│ n8n  │todo- │chrome│desk- │ git  │file- │memory│ ... │
│work- │ mcp  │ ist  │ dev  │ top  │      │system│      │     │
│space │      │      │tools │ cmd  │      │      │      │     │
│(100) │ (42) │ (35) │ (26) │ (25) │ (15) │ (14) │  (9) │     │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┴─────┘
                    Total: 272 tools
```

## Components

### 1. Code-Mode MCP Server (`code-mode-mcp/`)

The main entry point that OpenCode connects to.

**Key Files:**
- `index.ts` - Main server, tool handlers, discovery logic
- `dist/index.js` - Compiled JavaScript

**Features:**
- Registers MCP tools: `list_tools`, `search_tools`, `tool_info`, `call_tool_chain`
- Manages UTCP client lifecycle
- Implements tool discovery wait mechanism
- Caches tool count for faster subsequent starts

### 2. UTCP Client (`@utcp/code-mode`)

Handles connections to individual MCP servers.

**Configuration:** `.utcp_config.json`

```json
{
  "manual_call_templates": [{
    "name": "mcp-servers",
    "call_template_type": "mcp",
    "config": {
      "mcpServers": {
        "server-name": {
          "transport": "stdio",
          "command": "npx",
          "args": ["package-name"],
          "env": { ... }
        }
      }
    }
  }]
}
```

### 3. OpenCode Integration

**Configuration:** `opencode.json`

```json
{
  "mcp": {
    "code-mode": {
      "type": "local",
      "command": ["node", ".../dist/index.js"],
      "enabled": true,
      "timeout": 60000,  // CRITICAL
      "environment": {
        "UTCP_CONFIG_FILE": ".../.utcp_config.json"
      }
    }
  }
}
```

## Data Flow

### Tool Discovery (Startup)

```
1. OpenCode starts code-mode MCP server
2. Server loads UTCP config
3. UTCP client connects to each MCP server
4. Each MCP server reports its tools
5. waitForToolDiscovery() polls until stable
6. Tools registered with OpenCode
7. Server ready for queries
```

### Tool Execution

```
1. User calls mcp_code-mode_call_tool_chain({ code: "..." })
2. Code-mode parses TypeScript code
3. Tool calls extracted (e.g., mcp_servers.google_workspace_*)
4. UTCP client routes to appropriate MCP server
5. Results aggregated and returned
```

## Key Design Decisions

### Why Wait for Tool Discovery?

MCP servers connect asynchronously. Without waiting:
- `list_tools` returns empty
- OpenCode shows no tools
- User thinks it's broken

Solution: Poll until tool count stabilizes (3 consecutive polls with same count).

### Why Disk Caching?

First startup: 25-30 seconds (all MCPs connecting)
Cached startup: ~5 seconds (knows expected count, exits early)

Cache file: `.tool_cache.json`
TTL: 1 hour

### Why 60-Second Timeout?

OpenCode defaults to 5 seconds. Code-mode needs 25-30 seconds.
Without explicit timeout, OpenCode gives up before tools load.

## File Structure

```
robscode-mode/
├── .utcp_config.json      # MCP server definitions
├── .tool_cache.json       # Tool count cache (generated)
├── code-mode-mcp/
│   ├── index.ts           # Main server source
│   ├── dist/              # Compiled output
│   ├── package.json
│   └── node_modules/
├── docs/
│   ├── SETUP.md           # Setup guide
│   ├── CHANGELOG.md       # Change history
│   └── ARCHITECTURE.md    # This file
├── LOCAL_SETUP.md         # Quick reference
└── README.md              # Project overview
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `UTCP_CONFIG_FILE` | Path to .utcp_config.json |

## Ports & Protocols

- **OpenCode ↔ Code-Mode:** MCP protocol over stdio
- **Code-Mode ↔ MCPs:** MCP protocol over stdio (per server)
