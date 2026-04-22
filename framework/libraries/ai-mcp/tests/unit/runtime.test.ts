import { describe, expect, it } from "bun:test";

import { defineAction, defineResource } from "@platform/schema";
import { z } from "zod";

import {
  createMcpRuntimeOrchestrator,
  createSchemaCacheEntry,
  createMcpRuntimeServer,
  dispatchMcpMessage,
  evaluateConnectorHealth,
  filterMcpTools,
  planMcpConnection,
  type McpSessionState
} from "../../src";

describe("ai-mcp runtime", () => {
  it("serves initialize, list, read, get, and call flows over JSON-RPC", async () => {
    const server = createMcpRuntimeServer({
      id: "platform-ai",
      label: "Platform AI",
      actions: [
        defineAction({
          id: "crm.contacts.lookup",
          input: z.object({ contactId: z.string() }),
          output: z.object({ ok: z.literal(true), contactId: z.string() }),
          permission: "crm.contacts.lookup",
          idempotent: true,
          audit: true,
          ai: {
            purpose: "Look up a CRM contact.",
            riskLevel: "moderate",
            approvalMode: "none"
          },
          handler: ({ input }) => ({
            ok: true as const,
            contactId: input.contactId
          })
        })
      ],
      resources: [
        defineResource({
          id: "crm.contacts",
          table: "contacts",
          contract: z.object({ id: z.string(), name: z.string() }),
          fields: {
            name: { label: "Name", searchable: true }
          },
          admin: {
            autoCrud: true,
            defaultColumns: ["name"]
          },
          portal: {
            enabled: false
          },
          ai: {
            curatedReadModel: true,
            purpose: "CRM contact read model"
          }
        })
      ],
      prompts: [
        {
          id: "prompt-version:crm-review:v1",
          title: "CRM Review",
          description: "Review a CRM record.",
          version: "v1",
          arguments: [{ name: "recordId", required: true }],
          body: "Review record {{recordId}} and summarize risk."
        }
      ]
    });
    const session: McpSessionState = {
      initialized: false,
      ready: false
    };

    const initialize = await dispatchMcpMessage(server, session, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: {
          name: "unit-test",
          version: "1.0.0"
        }
      }
    });
    await dispatchMcpMessage(server, session, {
      jsonrpc: "2.0",
      method: "notifications/initialized"
    });
    const tools = await dispatchMcpMessage(server, session, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/list"
    });
    const called = await dispatchMcpMessage(server, session, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "crm.contacts.lookup",
        arguments: {
          contactId: "contact-123"
        }
      }
    });
    const resources = await dispatchMcpMessage(server, session, {
      jsonrpc: "2.0",
      id: 4,
      method: "resources/list"
    });
    const resourceRead = await dispatchMcpMessage(server, session, {
      jsonrpc: "2.0",
      id: 5,
      method: "resources/read",
      params: {
        uri: "gutu://resource/crm.contacts"
      }
    });
    const prompts = await dispatchMcpMessage(server, session, {
      jsonrpc: "2.0",
      id: 6,
      method: "prompts/list"
    });
    const prompt = await dispatchMcpMessage(server, session, {
      jsonrpc: "2.0",
      id: 7,
      method: "prompts/get",
      params: {
        name: "prompt-version:crm-review:v1",
        arguments: {
          recordId: "contact-123"
        }
      }
    });

    expect(initialize && !Array.isArray(initialize) && "result" in initialize && initialize.result.protocolVersion).toBe("2025-03-26");
    expect(tools && !Array.isArray(tools) && "result" in tools && Array.isArray(tools.result.tools)).toBe(true);
    expect(called && !Array.isArray(called) && "result" in called && JSON.stringify(called.result)).toContain("contact-123");
    expect(resources && !Array.isArray(resources) && "result" in resources && JSON.stringify(resources.result)).toContain("gutu://resource/crm.contacts");
    expect(resourceRead && !Array.isArray(resourceRead) && "result" in resourceRead && JSON.stringify(resourceRead.result)).toContain("curatedReadModel");
    expect(prompts && !Array.isArray(prompts) && "result" in prompts && JSON.stringify(prompts.result)).toContain("prompt-version:crm-review:v1");
    expect(prompt && !Array.isArray(prompt) && "result" in prompt && JSON.stringify(prompt.result)).toContain("Review record contact-123");
  });

  it("filters multi-server tools and evaluates connector plans and schema cache health", () => {
    const orchestrator = createMcpRuntimeOrchestrator({
      connectors: [
        {
          id: "connector:crm",
          label: "CRM",
          endpoint: "https://crm.example.com/mcp",
          transport: "streamable-http",
          connectionMode: "on-demand",
          hostAllowlist: ["crm.example.com"],
          trustTier: "first-party",
          requiresApproval: true,
          serverIds: ["crm-server"],
          allowedToolIds: ["crm.contacts.lookup"],
          deniedToolIds: ["crm.contacts.delete"]
        }
      ],
      servers: [
        {
          id: "crm-server",
          label: "CRM Server",
          tools: [
            {
              id: "crm.contacts.lookup",
              title: "Lookup",
              description: "Lookup a contact",
              permission: "crm.contacts.lookup",
              inputSchema: { type: "object" },
              outputSchema: { type: "object" },
              riskLevel: "low",
              approvalMode: "none"
            },
            {
              id: "crm.contacts.delete",
              title: "Delete",
              description: "Delete a contact",
              permission: "crm.contacts.delete",
              inputSchema: { type: "object" },
              outputSchema: { type: "object" },
              riskLevel: "high",
              approvalMode: "required"
            }
          ],
          resources: [],
          prompts: []
        }
      ]
    });

    const visibleWithoutApproval = orchestrator.listVisibleTools("crm.example.com", false);
    const visibleWithApproval = orchestrator.listVisibleTools("crm.example.com", true);
    const cache = createSchemaCacheEntry({
      connectorId: "connector:crm",
      serverId: "crm-server",
      tools: visibleWithApproval,
      fetchedAt: "2026-04-22T12:00:00.000Z",
      ttlMinutes: 30
    });
    const healthy = evaluateConnectorHealth({
      connector: {
        id: "connector:crm",
        label: "CRM",
        endpoint: "https://crm.example.com/mcp",
        transport: "streamable-http",
        hostAllowlist: ["crm.example.com"],
        trustTier: "first-party",
        requiresApproval: false,
        allowedToolIds: ["crm.contacts.lookup"]
      },
      targetHost: "crm.example.com",
      schemaCache: cache,
      approvalGranted: true
    });
    const plan = planMcpConnection(
      {
        id: "connector:crm",
        label: "CRM",
        endpoint: "https://crm.example.com/mcp",
        transport: "streamable-http",
        hostAllowlist: ["crm.example.com"],
        trustTier: "first-party",
        requiresApproval: true
      },
      "crm.example.com",
      true
    );

    expect(visibleWithoutApproval).toEqual([]);
    expect(filterMcpTools(visibleWithApproval, { allowedToolIds: ["crm.contacts.lookup"], deniedToolIds: [] })).toHaveLength(1);
    expect(visibleWithApproval[0]?.id).toBe("crm.contacts.lookup");
    expect(plan.blocked).toBe(false);
    expect(healthy.status).toBe("ready");
    expect(cache.toolIds).toEqual(["crm.contacts.lookup"]);
  });
});
