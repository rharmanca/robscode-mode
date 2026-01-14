# code-mode-mcp

This directory contains the code-mode MCP server configuration.

## Overview

code-mode provides on-demand access to MCP tools registered in UTCP. Tools are NOT automatically exposed to OpenCode - they must be accessed through `code-mode_call_tool_chain` with TypeScript code.

## Core Principle

```
Need code-mode tool → code-mode_call_tool_chain with manual.toolName()
```

## Registered MCP Tools

| Name | Description |
|------|-------------|
| `openlibrary` | Open Library API for book search and metadata |
| `context7` | Context7 documentation search |
| `brightdata` | Web data extraction service |
| `cois` | COIS O&M document search |

## Installation

```bash
npm install
```

## Configuration

### Registering MCP Tools

Add MCP servers to your configuration by registering them in `manual_call_templates`:

```json
{
  "manual_call_templates": [
    {
      "name": "context7",
      "call_template_type": "mcp",
      "config": {
        "mcpServers": {
          "context7": {
            "transport": "stdio",
            "command": "cmd",
            "args": ["/c", "npx", "-y", "@upstash/context7-mcp"]
          }
        }
      }
    },
    {
      "name": "brightdata",
      "call_template_type": "mcp",
      "config": {
        "mcpServers": {
          "brightdata": {
            "transport": "sse",
            "url": "https://mcp.brightdata.com/sse?token=${BRIGHTDATA_TOKEN}"
          }
        }
      }
    },
    {
      "name": "cois",
      "call_template_type": "mcp",
      "config": {
        "mcpServers": {
          "cois": {
            "transport": "sse",
            "url": "http://72.62.160.169:8787/sse"
          }
        }
      }
    }
  ]
}
```

**Environment Variables:** Use placeholders like `${BRIGHTDATA_TOKEN}` in your URLs. Set the actual values in your `.env` file.

### Enabling CLI Support

**Important:** CLI protocol support is **disabled by default** for security reasons. To enable CLI tool execution, you need to explicitly register the CLI plugin in 'index.ts'.

```typescript
import { register as registerCli } from "@utcp/cli";

// Enable CLI support
registerCli();
```

**Security Note:** Only enable CLI if you trust the code that will be executed, as CLI tools can execute arbitrary commands on your system.

## Usage

### Example: Searching with Context7

```typescript
const docs = await manual.context7.search_documentation({ query: "react hooks" })
```

### Example: Extracting Data with Brightdata

```const data = await manual.brightdata.scrape({ url: "https://example.com" })
```

### Example: Searching COIS Documents

```typescript
const results = await manual.cois.search_oam_documents({ query: "HVAC maintenance" })
```

## Environment Variables

Copy `example.env` to `.env` and fill in your API keys:

```bash
cp example.env .env
```

Required environment variables:
- `BRIGHTDATA_TOKEN` - Token for brightdata MCP access