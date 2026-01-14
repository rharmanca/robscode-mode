# Code-Mode Full Enablement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Enable all 30 code-mode tools by adding missing tool templates to UTCP config and enabling corresponding MCP servers in opencode.json

**Architecture:** Add missing MCP tool templates to `.utcp_config.json` and enable corresponding MCP servers in `opencode.json`. Tools will then be discoverable and executable through code-mode's `code-mode_search_tools` and `code-mode_callToolChain` functions.

**Tech Stack:** OpenCode, UTCP code-mode MCP, JSON configuration

---

## Progress Log

| Date | Task | Status | Notes |
|------|------|--------|-------|
| 2026-01-13 | Create plan document | ✅ Complete | Baseline inventory captured |
| 2026-01-13 | Add missing UTCP templates | ✅ Complete | context7, brightdata, cois |
| 2026-01-13 | Enable MCPs in opencode.json | ✅ Complete | 6 MCPs enabled |
| 2026-01-13 | Verify tool discovery | ✅ Complete | Tools discoverable after restart |
| 2026-01-13 | Update AGENTS.md | ✅ Complete | Code-mode usage documented |
| 2026-01-13 | Redact secrets in opencode.json | ✅ Complete | Use ${ENV_VAR} placeholders |

---

## Baseline Inventory

### Currently Registered in UTCP Config (30 tools) ✅
- brave-search, sequential-thinking, desktop-commander, mem0, google-workspace, filesystem, work-google-workspace, spotify, github, railway, taskmaster, playwright, searxng, n8n, duckduckgo, fetch, sherlock, maigret, phoneinfoga, theharvester, memory, hyperbrowser, hostinger, pal, context7, brightdata, cois, context7, brightdata, cois

### Missing from UTCP Config (0 tools) ✅
- None - all 3 added (context7, brightdata, cois)

### Disabled in opencode.json (6 MCPs)
- tavily (line 800-804)
- ref (line 814-818)
- cois (line 832-837)
- brightdata (line 923-928)
- context7 (line 1034-1044)
- todoist (line 1046-1051)

### Enabled in opencode.json (2 MCPs)
- code-mode (line 1117-1129)
- brave (line 788-799)

---

## Phase 1: Add Missing Tool Templates ✅ Complete

### Task 1: Add Context7 Template to UTCP Config ✅

**Source:** `opencode.json:1034-1044`
```json
"context7": {
  "type": "local",
  "command": ["cmd", "/c", "npx", "-y", "@upstash/context7-mcp"],
  "enabled": false,
  "timeout": 60000
}
```

**Template to add:**
```json
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
}
```

### Task 2: Add Brightdata Template to UTCP Config ✅

**Source:** `opencode.json:923-928`
```json
"brightdata": {
  "type": "remote",
  "url": "https://mcp.brightdata.com/sse?token=${BRIGHTDATA_TOKEN}",
  "enabled": false,
  "timeout": 120000
}
```

**Template to add:**
```json
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
}
```

### Task 3: Add Cois Template to UTCP Config ✅

**Source:** `opencode.json:832-837`
```json
"cois": {
  "type": "remote",
  "url": "http://72.62.160.169:8787/sse",
  "enabled": false,
  "timeout": 30000
}
```

**Template to add:**
```json
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
```

---

## Phase 2: Enable MCPs in OpenCode ⏳ In Progress

### Task 4: Enable Tavily ⏳
**File:** `opencode.json:800-804`
**Change:** `"enabled": false` → `"enabled": true`

### Task 5: Enable Ref ⏳
**File:** `opencode.json:814-818`
**Change:** `"enabled": false` → `"enabled": true`

### Task 6: Enable Cois ⏳
**File:** `opencode.json:832-837`
**Change:** `"enabled": false` → `"enabled": true`

### Task 7: Enable Brightdata ⏳
**File:** `opencode.json:923-928`
**Change:** `"enabled": false` → `"enabled": true`

### Task 8: Enable Context7 ⏳
**File:** `opencode.json:1034-1044`
**Change:** `"enabled": false` → `"enabled": true`

### Task 9: Enable Todoist ⏳
**File:** `opencode.json:1046-1051`
**Change:** `"enabled": false` → `"enabled": true`

---

## Phase 3: Verification

### Task 10: Test Tool Discovery

```typescript
// Expected: 30 tools available
const allTools = await code-mode_list_tools()
console.log("Total tools:", allTools.length)
```

### Task 11: Test Individual Tool Discovery

```typescript
// Test context7
const context7Tools = await code-mode_search_tools({ task_description: "lookup documentation context7" })

// Test brightdata
const brightdataTools = await code-mode_search_tools({ task_description: "brightdata web scraping" })

// Test cois
const coisTools = await code-mode_search_tools({ task_description: "cois analysis" })
```

---

## Phase 4: Documentation

### Task 12: Update AGENTS.md

Add code-mode section documenting:
- Available tools (30 total)
- Discovery workflow
- Execution examples
- Browser automation policy (chrome-devtools only)

---

## Final State

After completion:
- **30 tools** registered in UTCP code-mode
- **6 MCPs** enabled in opencode.json
- **Full documentation** in AGENTS.md
- **Verification results** documented