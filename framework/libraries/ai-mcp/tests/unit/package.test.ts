import { describe, expect, it } from "bun:test";

import { defineAction, defineResource } from "@platform/schema";
import { z } from "zod";

import {
  createMcpServerFromContracts,
  defineMcpClientConnector,
  packageId
} from "../../src";

describe("ai-mcp", () => {
  it("exposes a stable package id", () => {
    expect(packageId).toBe("ai-mcp");
  });

  it("derives MCP descriptors from framework contracts", () => {
    const server = createMcpServerFromContracts({
      id: "platform-ai",
      label: "Platform AI",
      actions: [
        defineAction({
          id: "crm.contacts.lookup",
          input: z.object({ contactId: z.string() }),
          output: z.object({ ok: z.literal(true) }),
          permission: "crm.contacts.lookup",
          idempotent: true,
          audit: true,
          ai: {
            purpose: "Look up a CRM contact.",
            riskLevel: "moderate",
            approvalMode: "none"
          },
          handler: () => ({ ok: true as const })
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
      ]
    });

    const connector = defineMcpClientConnector({
      id: "partner-salesforce",
      label: "Partner Salesforce",
      endpoint: "https://partner.example.com/mcp",
      hostAllowlist: ["partner.example.com"],
      trustTier: "partner",
      requiresApproval: true
    });

    expect(server.tools[0]?.id).toBe("crm.contacts.lookup");
    expect(server.resources[0]?.curatedReadModel).toBe(true);
    expect(connector.requiresApproval).toBe(true);
  });
});
