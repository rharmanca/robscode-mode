# Changelog

All notable changes to the robscode-mode fork.

## [2026-01-12] - Migration Complete

### Added
- **Tool Discovery Wait Mechanism** (`code-mode-mcp/index.ts`)
  - `waitForToolDiscovery()` function polls until tools are stable
  - Uses stable count detection (3 consecutive polls with same count)
  - Configurable timeout (default 30 seconds)
  - Progress logging to stderr

- **Disk Caching** (`code-mode-mcp/index.ts`)
  - `.tool_cache.json` stores expected tool count
  - 1-hour cache TTL
  - Speeds up subsequent starts (~5 seconds vs ~25 seconds)

- **MCP Handler Fixes** (`code-mode-mcp/index.ts`)
  - `list_tools`, `search_tools`, `call_tool_chain` now wait for discovery
  - Ensures tools available even if handlers called early

- **Documentation**
  - `docs/SETUP.md` - Setup guide
  - `docs/CHANGELOG.md` - This file
  - `docs/ARCHITECTURE.md` - System architecture
  - `LOCAL_SETUP.md` - Quick reference
  - Updated `README.md` with fork modifications

### Configuration
- **UTCP Config** (`.utcp_config.json`)
  - 10 MCP servers configured
  - 272 tools total

- **OpenCode Integration**
  - Critical fix: `timeout: 60000` required (OpenCode defaults to 5 seconds)
  - All direct MCPs disabled, only code-mode enabled

### Fixed
- **OpenCode Timeout Issue** (ROOT CAUSE)
  - Problem: OpenCode defaults to 5-second MCP timeout
  - Solution: Set `timeout: 60000` in opencode.json
  - This was the reason code-mode appeared to work but tools never loaded

### MCPs Configured
| MCP | Tools |
|-----|-------|
| google_workspace | 100 |
| n8n_mcp | 42 |
| todoist | 35 |
| chrome_devtools | 26 |
| desktop_commander | 25 |
| git | 15 |
| filesystem | 14 |
| memory | 9 |
| tavily | 4 |
| ref | 2 |

### Removed
- obsidian, time, mem0 MCPs (npm packages don't exist)

## [Initial] - Fork Created

- Forked from https://github.com/universal-tool-calling-protocol/utcp-mcp
- Repository: https://github.com/rharmanca/robscode-mode
