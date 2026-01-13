#!/usr/bin/env node

// UTCP-MCP Bridge Entry Point
// This is the main entry point for the npx @utcp/mcp-bridge command

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import path from "path";
import { promises as fs } from "fs";
import { parse as parseDotEnv } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import "@utcp/http";
import "@utcp/text";
import "@utcp/mcp";
import "@utcp/cli";
import "@utcp/dotenv-loader"
import "@utcp/file"

import {
    UtcpClient,
    CallTemplateSchema,
    InMemConcurrentToolRepository,
    TagSearchStrategy,
    DefaultVariableSubstitutor,
    ensureCorePluginsInitialized,
    UtcpClientConfigSerializer
} from "@utcp/sdk";
import type { UtcpClientConfig } from "@utcp/sdk";
import { CodeModeUtcpClient } from "@utcp/code-mode";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

ensureCorePluginsInitialized();

let utcpClient: CodeModeUtcpClient | null = null;

async function main() {
    setupMcpTools();
    
    // Initialize UTCP client and wait for tool discovery BEFORE connecting MCP transport
    // This ensures tools are available when OpenCode queries the server
    console.error("[code-mode] Starting UTCP client initialization...");
    utcpClient = await initializeUtcpClient();
    console.error("[code-mode] UTCP client ready, connecting MCP transport...");
    
    const transport = new StdioServerTransport();
    await mcp.connect(transport);
    console.error("[code-mode] MCP transport connected, server ready.");
}

const mcp = new McpServer({
    name: "CodeMode-MCP",
    version: "1.0.0",
});

/**
 * Sanitizes an identifier to be a valid TypeScript identifier.
 */
function sanitizeIdentifier(name: string): string {
    return name
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^[0-9]/, '_$&');
}

/**
 * Converts a UTCP tool name to its TypeScript interface name.
 */
function utcpNameToTsInterfaceName(utcpName: string): string {
    if (utcpName.includes('.')) {
        const parts = utcpName.split('.');
        const manualName = parts[0]!;
        const toolParts = parts.slice(1);
        const sanitizedManualName = sanitizeIdentifier(manualName);
        const toolName = toolParts.map(part => sanitizeIdentifier(part)).join('_');
        return `${sanitizedManualName}.${toolName}`;
    } else {
        return sanitizeIdentifier(utcpName);
    }
}

/**
 * Finds a tool by either UTCP name or TypeScript interface name.
 */
async function findToolByName(client: CodeModeUtcpClient, name: string): Promise<{ tool: any, utcpName: string } | null> {
    // First, try direct lookup by UTCP name
    const directTool = await client.config.tool_repository.getTool(name);
    if (directTool) {
        return { tool: directTool, utcpName: name };
    }
    
    // If not found, search through all tools to find one whose TS interface name matches
    const allTools = await client.config.tool_repository.getTools();
    for (const tool of allTools) {
        if (utcpNameToTsInterfaceName(tool.name) === name) {
            return { tool, utcpName: tool.name };
        }
    }
    
    return null;
}

function setupMcpTools() {
    // Register MCP prompt for using the code mode server
    mcp.registerPrompt("utcp_codemode_usage", {
        title: "UTCP Code Mode Usage Guide",
        description: "Comprehensive guide on how to use the UTCP Code Mode MCP server for executing TypeScript code with tool access."
    }, async () => {
        const codeInstructions = `# UTCP Code Mode MCP Server Usage Guide

You have access to a powerful UTCP Code Mode MCP server that allows you to execute TypeScript code with direct access to registered tools.

## Workflow: Always Follow This Pattern

### 1. 🔍 DISCOVER TOOLS FIRST
**Always start by searching for relevant tools before writing code:**
- Use \`search_tools\` with a description of your task to find relevant tools
- This returns tools with their TypeScript interfaces - study these carefully
- Use \`tool_info\` to get detailed interface information for specific tools if needed

${CodeModeUtcpClient.AGENT_PROMPT_TEMPLATE}

- in the call_tool_chain code, return the result that you want to see, your code will be wrapped in an async function and executed

Remember: The power of this system comes from combining multiple tools in sophisticated TypeScript code execution workflows.`;

        return {
            messages: [{
                role: "user",
                content: {
                    type: "text",
                    text: codeInstructions
                }
            }]
        };
    });

    mcp.registerTool("register_manual", {
        title: "Register a UTCP Manual",
        description: "Registers a new tool provider by providing its call template.",
        inputSchema: { manual_call_template: CallTemplateSchema.describe("The call template for the UTCP Manual endpoint.") },
    }, async (input) => {
        const client = await initializeUtcpClient();
        try {
            const result = await client.registerManual(input.manual_call_template as any);
            return { content: [{ type: "text", text: JSON.stringify(result) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: JSON.stringify({ success: false, error: e.message }) }] };
        }
    });

    mcp.registerTool("deregister_manual", {
        title: "Deregister a UTCP Manual",
        description: "Deregisters a tool provider from the UTCP client.",
        inputSchema: { manual_name: z.string().describe("The name of the manual to deregister.") },
    }, async (input) => {
        const client = await initializeUtcpClient();
        try {
            const success = await client.deregisterManual(input.manual_name);
            const message = success ? `Manual '${input.manual_name}' deregistered.` : `Manual '${input.manual_name}' not found.`;
            return { content: [{ type: "text", text: JSON.stringify({ success, message }) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: JSON.stringify({ success: false, error: e.message }) }] };
        }
    });

    mcp.registerTool("search_tools", {
        title: "Search for UTCP Tools",
        description: "Searches for relevant tools based on a task description. Uses both semantic search and fuzzy keyword matching for better results.",
        inputSchema: {
            task_description: z.string().describe("A natural language description of the task."),
            limit: z.number().optional().default(10),
        },
    }, async (input) => {
        const client = await initializeUtcpClient();
        
        // Wait for tool discovery to complete if not already done
        if (!toolDiscoveryComplete && toolDiscoveryPromise) {
            await toolDiscoveryPromise;
        }
        
        try {
            // Get results from both semantic search and fuzzy matching
            const semanticTools = await client.searchTools(input.task_description, input.limit * 2);
            const allTools = await client.config.tool_repository.getTools();
            const fuzzyTools = fuzzyMatchTools(allTools, input.task_description).slice(0, input.limit * 2);
            
            // Merge results, prioritizing semantic matches but including fuzzy matches
            const seenNames = new Set<string>();
            const mergedTools: any[] = [];
            
            // Add semantic results first
            for (const tool of semanticTools) {
                if (!seenNames.has(tool.name)) {
                    seenNames.add(tool.name);
                    mergedTools.push(tool);
                }
            }
            
            // Add fuzzy results that weren't in semantic
            for (const tool of fuzzyTools) {
                if (!seenNames.has(tool.name) && mergedTools.length < input.limit) {
                    seenNames.add(tool.name);
                    mergedTools.push(tool);
                }
            }
            
            const toolsWithInterfaces = mergedTools.slice(0, input.limit).map(t => ({
                name: utcpNameToTsInterfaceName(t.name),
                description: t.description,
                typescript_interface: client.toolToTypeScriptInterface(t)
            }));
            return { content: [{ type: "text", text: JSON.stringify({ tools: toolsWithInterfaces }) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: JSON.stringify({ success: false, error: e.message }) }] };
        }
    });

    mcp.registerTool("list_tools", {
        title: "List All Registered UTCP Tools",
        description: "Returns a list of all tool names currently registered.",
        inputSchema: {},
    }, async () => {
        const client = await initializeUtcpClient();
        
        // Wait for tool discovery to complete if not already done
        if (!toolDiscoveryComplete && toolDiscoveryPromise) {
            await toolDiscoveryPromise;
        }
        
        try {
            const tools = await client.config.tool_repository.getTools();
            const toolNames = tools.map(t => utcpNameToTsInterfaceName(t.name));
            return { content: [{ type: "text", text: JSON.stringify({ tools: toolNames }) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: JSON.stringify({ success: false, error: e.message }) }] };
        }
    });

    mcp.registerTool("get_required_keys_for_tool", {
        title: "Get Required Variables for Tool",
        description: "Get required environment variables for a registered tool.",
        inputSchema: {
            tool_name: z.string().describe("Name of the tool to get required variables for."),
        },
    }, async (input) => {
        const client = await initializeUtcpClient();
        try {
            const found = await findToolByName(client, input.tool_name);
            if (!found) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, tool_name: input.tool_name, error: `Tool '${input.tool_name}' not found` }) }] };
            }
            const variables = await client.getRequiredVariablesForRegisteredTool(found.utcpName);
            return { content: [{ type: "text", text: JSON.stringify({ success: true, tool_name: input.tool_name, required_variables: variables }) }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: JSON.stringify({ success: false, tool_name: input.tool_name, error: e.message }) }] };
        }
    });

    mcp.registerTool("tool_info", {
        title: "Get Tool Information with TypeScript Interface",
        description: "Get complete information about a specific tool including TypeScript interface definition.",
        inputSchema: {
            tool_name: z.string().describe("Name of the tool to get complete information for."),
        },
    }, async (input) => {
        const client = await initializeUtcpClient();
        try {
            const found = await findToolByName(client, input.tool_name);
            if (!found) {
                return { content: [{ type: "text", text: JSON.stringify({ success: false, error: `Tool '${input.tool_name}' not found` }) }] };
            }
            const typescript_interface = client.toolToTypeScriptInterface(found.tool);
            return { content: [{ type: "text", text: typescript_interface }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: JSON.stringify({ success: false, error: e.message }) }] };
        }
    });

    // Code Mode specific tools
    mcp.registerTool("call_tool_chain", {
        title: "Execute TypeScript Code with Tool Access",
        description: "Execute TypeScript code with direct access to all registered tools as hierarchical functions (e.g., manual.tool()).",
        inputSchema: {
            code: z.string().describe("TypeScript code to execute with access to all registered tools."),
            timeout: z.number().optional().default(30000).describe("Optional timeout in milliseconds (default: 30000)."),
            max_output_size: z.number().optional().default(200000).describe("Optional maximum output size in characters (default: 200000)."),
        },
    }, async (input) => {
        const client = await initializeUtcpClient();
        
        // Wait for tool discovery to complete if not already done
        if (!toolDiscoveryComplete && toolDiscoveryPromise) {
            await toolDiscoveryPromise;
        }
        
        try {
            const { result, logs } = await client.callToolChain(input.code, input.timeout);
            const content = JSON.stringify({ success: true, result, logs })
            if (content.length > input.max_output_size) {
                return { content: [{ type: "text", text: content.slice(0, input.max_output_size) + "...\nmax_output_size exceeded" }] };
            }
            return { content: [{ type: "text", text: content }] };
        } catch (e: any) {
            return { content: [{ type: "text", text: JSON.stringify({ success: false, error: e.message }) }] };
        }
    });

    // Get available workflow templates
    mcp.registerTool("get_workflow_templates", {
        title: "List Available Workflow Templates",
        description: "Returns a list of pre-built workflow templates for common multi-MCP tasks.",
        inputSchema: {},
    }, async () => {
        return {
            content: [{
                type: "text",
                text: JSON.stringify(getWorkflowTemplates(), null, 2)
            }]
        };
    });

    // Execute a pre-built workflow template
    mcp.registerTool("execute_workflow", {
        title: "Execute Workflow Template",
        description: "Execute a pre-built workflow template with the given parameters.",
        inputSchema: {
            template: z.string().describe("Name of the workflow template to execute"),
            parameters: z.record(z.any()).optional().describe("Parameters to substitute in the workflow template")
        },
    }, async (input) => {
        const client = await initializeUtcpClient();
        
        // Wait for tool discovery to complete if not already done
        if (!toolDiscoveryComplete && toolDiscoveryPromise) {
            await toolDiscoveryPromise;
        }
        
        try {
            const workflowCode = getWorkflowCode(input.template, input.parameters || {});
            if (!workflowCode) {
                return {
                    content: [{
                        type: "text",
                        text: JSON.stringify({ success: false, error: `Workflow template '${input.template}' not found` }, null, 2)
                    }]
                };
            }
            const { result, logs } = await client.callToolChain(workflowCode, 30000);
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({ success: true, result, logs }, null, 2)
                }]
            };
        } catch (e: any) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({ success: false, error: e.message }, null, 2)
                }]
            };
        }
    });

}

// Track if initial tool discovery is complete
let toolDiscoveryComplete = false;
let toolDiscoveryPromise: Promise<void> | null = null;

// Cache file for tool discovery (speeds up subsequent starts)
const TOOL_CACHE_FILE = path.join(__dirname, '.tool_cache.json');
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour cache TTL

// Discovery configuration - optimized for faster startup
const DISCOVERY_CONFIG = {
    pollIntervalMs: 250,        // Reduced from 500ms for faster detection
    stableThreshold: 2,         // Reduced from 3 - faster completion
    timeoutMs: 30000,           // 30 second timeout
    earlyExitThreshold: 0.95,   // Exit early if we have 95% of expected tools
    minToolsForEarlyExit: 100,  // Only early exit if we expect many tools
};

// Track MCP connection status for error reporting
interface McpStatus {
    name: string;
    connected: boolean;
    toolCount: number;
    error?: string;
    lastAttempt: number;
}
const mcpConnectionStatus: Map<string, McpStatus> = new Map();

async function initializeUtcpClient(): Promise<CodeModeUtcpClient> {
    if (utcpClient) {
        // Wait for tool discovery if not complete
        if (!toolDiscoveryComplete && toolDiscoveryPromise) {
            await toolDiscoveryPromise;
        }
        return utcpClient;
    }

    // Look for config file: 1) Environment variable, 2) Current working directory, 3) Package directory
    const cwd = process.cwd();
    const packageDir = __dirname;
    
    let configPath: string;
    let scriptDir: string;
    
    // Check if UTCP_CONFIG_FILE environment variable is set
    if (process.env.UTCP_CONFIG_FILE) {
        configPath = path.resolve(process.env.UTCP_CONFIG_FILE);
        scriptDir = path.dirname(configPath);
        
        try {
            await fs.access(configPath);
        } catch {
            console.warn(`UTCP config file specified in UTCP_CONFIG_FILE not found: ${configPath}`);
        }
    } else {
        // Fall back to current working directory first, then package directory
        configPath = path.resolve(cwd, '.utcp_config.json');
        scriptDir = cwd;
        
        try {
            await fs.access(configPath);
        } catch {
            configPath = path.resolve(packageDir, '.utcp_config.json');
            scriptDir = packageDir;
        }
    }

    let rawConfig: any = {};
    try {
        const configFileContent = await fs.readFile(configPath, 'utf-8');
        rawConfig = JSON.parse(configFileContent);
    } catch (e: any) {
        if (e.code !== 'ENOENT') {
            console.warn(`Could not read or parse .utcp_config.json. Error: ${e.message}`);
        }
    }

    const clientConfig = new UtcpClientConfigSerializer().validateDict(rawConfig);

    const newClient = await CodeModeUtcpClient.create(scriptDir, clientConfig);

    utcpClient = newClient;
    
    // Start tool discovery wait in background
    toolDiscoveryPromise = waitForToolDiscovery(newClient);
    await toolDiscoveryPromise;
    
    return utcpClient;
}

/**
 * Load cached tool count to estimate expected tools
 */
async function loadToolCache(): Promise<{ toolCount: number; timestamp: number } | null> {
    try {
        const cacheContent = await fs.readFile(TOOL_CACHE_FILE, 'utf-8');
        const cache = JSON.parse(cacheContent);
        if (Date.now() - cache.timestamp < CACHE_TTL_MS) {
            return cache;
        }
    } catch (e) {
        // Cache doesn't exist or is invalid
    }
    return null;
}

/**
 * Save tool count to cache for faster subsequent starts
 */
async function saveToolCache(toolCount: number): Promise<void> {
    try {
        await fs.writeFile(TOOL_CACHE_FILE, JSON.stringify({
            toolCount,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.error(`[code-mode] Failed to save tool cache: ${e}`);
    }
}

/**
 * Wait for MCP servers to connect and discover tools.
 * Optimized for faster startup with early exit conditions.
 */
async function waitForToolDiscovery(client: CodeModeUtcpClient, timeoutMs?: number, pollIntervalMs?: number): Promise<void> {
    const config = DISCOVERY_CONFIG;
    const timeout = timeoutMs ?? config.timeoutMs;
    const pollInterval = pollIntervalMs ?? config.pollIntervalMs;
    
    const startTime = Date.now();
    let lastToolCount = 0;
    let stableCount = 0;
    let lastLogTime = 0;
    
    // Load cache to get expected tool count
    const cache = await loadToolCache();
    const expectedTools = cache?.toolCount || 0;
    
    if (expectedTools > 0) {
        console.error(`[code-mode] Expecting ~${expectedTools} tools based on cache...`);
    }
    
    console.error(`[code-mode] Waiting for tool discovery (timeout: ${timeout}ms, poll: ${pollInterval}ms)...`);
    
    while (Date.now() - startTime < timeout) {
        try {
            const tools = await client.config.tool_repository.getTools();
            const currentCount = tools.length;
            
            if (currentCount > 0) {
                // Early exit: If we have cache and reached expected count
                if (expectedTools > 0 && currentCount >= expectedTools) {
                    const elapsed = Date.now() - startTime;
                    console.error(`[code-mode] Tool discovery complete: ${currentCount} tools in ${elapsed}ms (reached expected count)`);
                    toolDiscoveryComplete = true;
                    await saveToolCache(currentCount);
                    return;
                }
                
                // Early exit: If we have 95%+ of expected tools (for large tool sets)
                if (expectedTools >= config.minToolsForEarlyExit && 
                    currentCount >= expectedTools * config.earlyExitThreshold) {
                    const elapsed = Date.now() - startTime;
                    console.error(`[code-mode] Tool discovery complete: ${currentCount} tools in ${elapsed}ms (early exit at ${Math.round(currentCount/expectedTools*100)}%)`);
                    toolDiscoveryComplete = true;
                    await saveToolCache(currentCount);
                    return;
                }
                
                // Stability check
                if (currentCount === lastToolCount) {
                    stableCount++;
                    if (stableCount >= config.stableThreshold) {
                        const elapsed = Date.now() - startTime;
                        console.error(`[code-mode] Tool discovery complete: ${currentCount} tools in ${elapsed}ms`);
                        toolDiscoveryComplete = true;
                        await saveToolCache(currentCount);
                        return;
                    }
                } else {
                    stableCount = 0;
                    // Log progress every 2 seconds to reduce noise
                    if (Date.now() - lastLogTime > 2000) {
                        console.error(`[code-mode] Discovered ${currentCount} tools so far...`);
                        lastLogTime = Date.now();
                    }
                }
                lastToolCount = currentCount;
            }
        } catch (e) {
            // Log errors but continue polling
            console.error(`[code-mode] Discovery poll error: ${e}`);
        }
        
        await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    // Timeout reached
    const tools = await client.config.tool_repository.getTools();
    const elapsed = Date.now() - startTime;
    console.error(`[code-mode] Tool discovery timeout after ${elapsed}ms. Found ${tools.length} tools.`);
    toolDiscoveryComplete = true;
    if (tools.length > 0) {
        await saveToolCache(tools.length);
    }
}

/**
 * Enhanced tool search with fuzzy matching and keyword support
 */
function fuzzyMatchTools(tools: any[], query: string): any[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
    
    return tools
        .map(tool => {
            const nameLower = tool.name.toLowerCase();
            const descLower = (tool.description || '').toLowerCase();
            
            let score = 0;
            
            // Exact match in name (highest priority)
            if (nameLower.includes(queryLower)) {
                score += 100;
            }
            
            // Exact match in description
            if (descLower.includes(queryLower)) {
                score += 50;
            }
            
            // Word matches
            for (const word of queryWords) {
                if (nameLower.includes(word)) score += 20;
                if (descLower.includes(word)) score += 10;
            }
            
            // Boost for shorter names (more specific tools)
            if (score > 0 && nameLower.length < 30) {
                score += 5;
            }
            
            return { tool, score };
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .map(item => item.tool);
}

/**
 * Get MCP connection status for debugging
 */
function getMcpStatus(): McpStatus[] {
    return Array.from(mcpConnectionStatus.values());
}

/**
 * Auto-retry wrapper with exponential backoff
 */
async function withRetry<T>(
    fn: () => Promise<T>,
    options: { maxRetries?: number; initialDelayMs?: number; maxDelayMs?: number } = {}
): Promise<T> {
    const { maxRetries = 3, initialDelayMs = 1000, maxDelayMs = 10000 } = options;
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (e: any) {
            lastError = e;
            if (attempt < maxRetries) {
                const delay = Math.min(initialDelayMs * Math.pow(2, attempt), maxDelayMs);
                console.error(`[code-mode] Retry ${attempt + 1}/${maxRetries} after ${delay}ms: ${e.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}

/**
 * Pre-built workflow templates for common multi-MCP tasks
 */
const WORKFLOW_TEMPLATES = {
    // Email to Task: Search emails and create tasks from them
    email_to_task: `
// Search for important emails and create tasks
const emails = await mcp_servers.google_workspace_search_gmail_messages({
    query: "is:unread is:important",
    user_google_email: "{{email}}",
    page_size: 5
});
const tasks = [];
for (const email of emails.messages || []) {
    const task = await mcp_servers.todoist_create_task({
        content: "Review: " + (email.subject || "Email"),
        priority: 3
    });
    tasks.push(task);
}
return { emails_found: emails.messages?.length || 0, tasks_created: tasks.length };
`,

    // Calendar to Workflow: Get upcoming events and create n8n workflow
    calendar_summary: `
// Get today's calendar events
const now = new Date();
const endOfDay = new Date(now);
endOfDay.setHours(23, 59, 59);
const events = await mcp_servers.google_workspace_get_events({
    user_google_email: "{{email}}",
    calendar_id: "primary",
    time_min: now.toISOString(),
    time_max: endOfDay.toISOString()
});
return { 
    date: now.toDateString(),
    event_count: events.items?.length || 0,
    events: (events.items || []).map(e => ({ summary: e.summary, start: e.start }))
};
`,

    // Web Research: Search web and save to memory
    web_research: `
// Search the web and store findings in memory
const results = await mcp_servers.tavily_tavily_search({
    query: "{{query}}",
    max_results: 5
});
const entities = (results.results || []).map((r, i) => ({
    name: "research_" + i,
    entityType: "WebResult",
    observations: [r.title, r.url, r.content?.substring(0, 200)]
}));
if (entities.length > 0) {
    await mcp_servers.memory_create_entities({ entities });
}
return { results_found: results.results?.length || 0, saved_to_memory: entities.length };
`,

    // Health Check: Test all MCP connections
    health_check: `
// Test all 10 MCP connections
const results = {};
const tests = [
    { name: "google_workspace", fn: () => mcp_servers.google_workspace_list_calendars({ user_google_email: "{{email}}" }) },
    { name: "n8n_mcp", fn: () => mcp_servers.n8n_mcp_n8n_health_check() },
    { name: "todoist", fn: () => mcp_servers.todoist_get_projects_list() },
    { name: "chrome_devtools", fn: () => mcp_servers.chrome_devtools_list_pages() },
    { name: "desktop_commander", fn: () => mcp_servers.desktop_commander_get_config() },
    { name: "git", fn: () => mcp_servers.git_git_status({ repo_path: "/Users/rharman" }) },
    { name: "filesystem", fn: () => mcp_servers.filesystem_list_allowed_directories() },
    { name: "memory", fn: () => mcp_servers.memory_read_graph() },
    { name: "tavily", fn: () => mcp_servers.tavily_tavily_search({ query: "test", max_results: 1 }) },
    { name: "ref", fn: () => mcp_servers.ref_ref_search_documentation({ query: "js", limit: 1 }) }
];
for (const test of tests) {
    try {
        await test.fn();
        results[test.name] = "✅ OK";
    } catch (e) {
        results[test.name] = "❌ " + e.message;
    }
}
const working = Object.values(results).filter(r => r.includes("OK")).length;
return { summary: working + "/10 MCPs working", results };
`
};

/**
 * Get available workflow templates
 */
function getWorkflowTemplates(): { name: string; description: string }[] {
    return [
        { name: "email_to_task", description: "Search emails and create Todoist tasks from them" },
        { name: "calendar_summary", description: "Get today's calendar events summary" },
        { name: "web_research", description: "Search web with Tavily and save to memory" },
        { name: "health_check", description: "Test all 10 MCP connections" }
    ];
}

/**
 * Execute a workflow template with variable substitution
 */
function getWorkflowCode(templateName: string, variables: Record<string, string> = {}): string | null {
    const template = WORKFLOW_TEMPLATES[templateName as keyof typeof WORKFLOW_TEMPLATES];
    if (!template) return null;
    
    let code = template;
    for (const [key, value] of Object.entries(variables)) {
        code = code.replace(new RegExp(`{{${key}}}`, 'g'), value);
    }
    return code;
}

main().catch(err => {
    console.error("Failed to start UTCP-MCP Bridge:", err);
    process.exit(1);
});
