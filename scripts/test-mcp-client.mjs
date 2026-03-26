#!/usr/bin/env node

/**
 * Test client for VidTempla MCP server.
 *
 * Usage:
 *   node scripts/test-mcp-client.mjs <api-key> [base-url]
 *
 * Examples:
 *   node scripts/test-mcp-client.mjs vtk_abc123
 *   node scripts/test-mcp-client.mjs vtk_abc123 https://vidtempla.com
 *
 * Claude Code config:
 *   claude mcp add --transport http vidtempla http://localhost:3000/api/mcp \
 *     --header "Authorization: Bearer vtk_your_key_here"
 */

const API_KEY = process.argv[2];
const BASE_URL = process.argv[3] || "http://localhost:3000";

if (!API_KEY) {
  console.error("Usage: node scripts/test-mcp-client.mjs <api-key> [base-url]");
  process.exit(1);
}

const MCP_URL = `${BASE_URL}/api/mcp/mcp`;

async function mcpRequest(method, params = {}) {
  const body = {
    jsonrpc: "2.0",
    id: Date.now(),
    method,
    params,
  };

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    console.error(`HTTP ${res.status}: ${await res.text()}`);
    return null;
  }

  const data = await res.json();
  if (data.error) {
    console.error("MCP Error:", JSON.stringify(data.error, null, 2));
    return null;
  }
  return data.result;
}

async function main() {
  console.log(`Testing VidTempla MCP at ${MCP_URL}\n`);

  // 1. Initialize
  console.log("--- initialize ---");
  const init = await mcpRequest("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "test-client", version: "1.0.0" },
  });
  console.log("Server:", init?.serverInfo?.name, init?.serverInfo?.version);
  console.log();

  // 2. List tools
  console.log("--- tools/list ---");
  const tools = await mcpRequest("tools/list");
  if (tools?.tools) {
    console.log(`Found ${tools.tools.length} tools:`);
    for (const tool of tools.tools) {
      console.log(`  - ${tool.name}: ${tool.description?.slice(0, 80)}`);
    }
  }
  console.log();

  // 3. Call list_channels
  console.log("--- tools/call: list_channels ---");
  const channelResult = await mcpRequest("tools/call", {
    name: "list_channels",
    arguments: {},
  });
  if (channelResult?.content?.[0]?.text) {
    const parsed = JSON.parse(channelResult.content[0].text);
    console.log(`Channels: ${Array.isArray(parsed) ? parsed.length : "error"}`);
    if (Array.isArray(parsed)) {
      for (const ch of parsed) {
        console.log(`  - ${ch.title} (${ch.channelId})`);
      }
    }
  }
  console.log();

  // 4. Call list_templates
  console.log("--- tools/call: list_templates ---");
  const templateResult = await mcpRequest("tools/call", {
    name: "list_templates",
    arguments: {},
  });
  if (templateResult?.content?.[0]?.text) {
    const parsed = JSON.parse(templateResult.content[0].text);
    console.log(`Templates: ${parsed.data?.length ?? "error"}`);
  }
  console.log();

  // 5. Call list_containers
  console.log("--- tools/call: list_containers ---");
  const containerResult = await mcpRequest("tools/call", {
    name: "list_containers",
    arguments: {},
  });
  if (containerResult?.content?.[0]?.text) {
    const parsed = JSON.parse(containerResult.content[0].text);
    console.log(`Containers: ${parsed.data?.length ?? "error"}`);
  }
  console.log();

  // 6. Call get_usage
  console.log("--- tools/call: get_usage ---");
  const usageResult = await mcpRequest("tools/call", {
    name: "get_usage",
    arguments: {},
  });
  if (usageResult?.content?.[0]?.text) {
    const parsed = JSON.parse(usageResult.content[0].text);
    console.log(`Total requests: ${parsed.totals?.requests}, quota: ${parsed.totals?.quotaUnits}`);
  }

  console.log("\nDone!");
}

main().catch(console.error);
