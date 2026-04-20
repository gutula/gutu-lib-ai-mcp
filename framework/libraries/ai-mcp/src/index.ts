import { createInterface } from "node:readline";

import type { ActionDefinition, ResourceDefinition } from "@platform/schema";
import { executeAction, toJsonSchema } from "@platform/schema";

import { createToolContract } from "@platform/ai";

export const packageId = "ai-mcp" as const;
export const packageDisplayName = "AI MCP" as const;
export const packageDescription = "MCP descriptors and connectors derived from framework actions, resources, and prompts." as const;

export type McpToolDescriptor = {
  id: string;
  title: string;
  description: string;
  permission: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  riskLevel: "low" | "moderate" | "high" | "critical";
  approvalMode: "none" | "required" | "conditional";
};

export type McpResourceDescriptor = {
  id: string;
  title: string;
  description: string;
  schema: Record<string, unknown>;
  curatedReadModel: boolean;
};

export type McpPromptDescriptor = {
  id: string;
  title: string;
  description: string;
  version: string;
  arguments?: Array<{ name: string; required: boolean }> | undefined;
};

export type McpPromptTemplate = McpPromptDescriptor & {
  body: string;
};

export type McpServerDefinition = {
  id: string;
  label: string;
  tools: McpToolDescriptor[];
  resources: McpResourceDescriptor[];
  prompts: McpPromptDescriptor[];
};

export type McpServerRuntime = {
  definition: McpServerDefinition;
  actions: Map<string, ActionDefinition>;
  resources: Map<string, { descriptor: McpResourceDescriptor; definition: ResourceDefinition }>;
  resourcesByUri: Map<string, { descriptor: McpResourceDescriptor; definition: ResourceDefinition }>;
  prompts: Map<string, McpPromptTemplate>;
  protocolVersions: string[];
  instructions?: string | undefined;
  serverVersion: string;
};

export type McpSessionState = {
  initialized: boolean;
  ready: boolean;
  negotiatedProtocolVersion?: string | undefined;
};

export type McpServerIo = {
  stdin: NodeJS.ReadableStream;
  stdout: NodeJS.WritableStream | { write(chunk: string): unknown };
  stderr?: NodeJS.WritableStream | { write(chunk: string): unknown } | undefined;
};

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id?: JsonRpcId | undefined;
  method: string;
  params?: Record<string, unknown> | undefined;
};

type JsonRpcSuccess = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result: Record<string, unknown>;
};

type JsonRpcError = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: Record<string, unknown> | undefined;
  };
};

export type McpClientConnector = {
  id: string;
  label: string;
  endpoint: string;
  hostAllowlist: string[];
  trustTier: "first-party" | "partner" | "unknown";
  secretRef?: string | undefined;
  requiresApproval: boolean;
  allowedToolIds?: string[] | undefined;
};

export function defineMcpServer(definition: McpServerDefinition): McpServerDefinition {
  return Object.freeze({
    ...definition,
    tools: [...definition.tools],
    resources: [...definition.resources],
    prompts: [...definition.prompts]
  });
}

export function defineMcpClientConnector(connector: McpClientConnector): McpClientConnector {
  return Object.freeze({
    ...connector,
    hostAllowlist: [...connector.hostAllowlist].sort((left, right) => left.localeCompare(right)),
    ...(connector.allowedToolIds ? { allowedToolIds: [...connector.allowedToolIds].sort((left, right) => left.localeCompare(right)) } : {})
  });
}

export function deriveMcpToolDescriptor(action: ActionDefinition, description = action.ai?.purpose ?? action.id): McpToolDescriptor {
  const tool = createToolContract(action, description);
  return {
    id: tool.id,
    title: action.id,
    description: tool.description,
    permission: tool.permission,
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema,
    riskLevel: tool.riskLevel,
    approvalMode: tool.approvalMode
  };
}

export function deriveMcpResourceDescriptor(
  resource: ResourceDefinition,
  description = resource.ai?.purpose ?? resource.id
): McpResourceDescriptor {
  return {
    id: resource.id,
    title: resource.id,
    description,
    schema: toJsonSchema(resource.contract),
    curatedReadModel: resource.ai?.curatedReadModel ?? false
  };
}

export function createMcpServerFromContracts(input: {
  id: string;
  label: string;
  actions: ActionDefinition[];
  resources: ResourceDefinition[];
  prompts?: McpPromptDescriptor[] | undefined;
}): McpServerDefinition {
  return defineMcpServer({
    id: input.id,
    label: input.label,
    tools: input.actions.map((action) => deriveMcpToolDescriptor(action)),
    resources: input.resources.map((resource) => deriveMcpResourceDescriptor(resource)),
    prompts: [...(input.prompts ?? [])]
  });
}

export function createMcpRuntimeServer(input: {
  id: string;
  label: string;
  actions: ActionDefinition[];
  resources: ResourceDefinition[];
  prompts?: McpPromptTemplate[] | undefined;
  instructions?: string | undefined;
  protocolVersions?: string[] | undefined;
  serverVersion?: string | undefined;
}): McpServerRuntime {
  const definition = createMcpServerFromContracts({
    id: input.id,
    label: input.label,
    actions: input.actions,
    resources: input.resources,
    prompts: (input.prompts ?? []).map((prompt) => ({
      id: prompt.id,
      title: prompt.title,
      description: prompt.description,
      version: prompt.version,
      arguments: prompt.arguments
    }))
  });

  const resources = new Map(
    input.resources.map((resource) => {
      const descriptor = deriveMcpResourceDescriptor(resource);
      return [resource.id, { descriptor, definition: resource }] as const;
    })
  );
  const resourcesByUri = new Map(
    [...resources.values()].map((entry) => [createResourceUri(entry.descriptor.id), entry] as const)
  );

  return {
    definition,
    actions: new Map(input.actions.map((action) => [action.id, action])),
    resources,
    resourcesByUri,
    prompts: new Map((input.prompts ?? []).map((prompt) => [prompt.id, prompt])),
    protocolVersions: input.protocolVersions && input.protocolVersions.length > 0 ? [...input.protocolVersions] : ["2025-03-26"],
    instructions: input.instructions,
    serverVersion: input.serverVersion ?? "0.1.0"
  };
}

export async function serveMcpStdio(server: McpServerRuntime, io: McpServerIo): Promise<void> {
  const session: McpSessionState = {
    initialized: false,
    ready: false
  };
  const reader = createInterface({
    input: io.stdin,
    crlfDelay: Infinity
  });

  for await (const rawLine of reader) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    let message: unknown;
    try {
      message = JSON.parse(line) as unknown;
    } catch (error) {
      writeStream(io.stderr, `Invalid MCP JSON received: ${error instanceof Error ? error.message : String(error)}\n`);
      continue;
    }

    const response = await dispatchMcpMessage(server, session, message);
    if (response === undefined) {
      continue;
    }

    const payload = Array.isArray(response) ? response : [response];
    for (const entry of payload) {
      writeStream(io.stdout, `${JSON.stringify(entry)}\n`);
    }
  }
}

export async function dispatchMcpMessage(
  server: McpServerRuntime,
  session: McpSessionState,
  message: unknown
): Promise<JsonRpcSuccess | JsonRpcError | Array<JsonRpcSuccess | JsonRpcError> | undefined> {
  if (Array.isArray(message)) {
    const responses: Array<JsonRpcSuccess | JsonRpcError> = [];
    for (const entry of message) {
      const response = await dispatchMcpMessage(server, session, entry);
      if (response === undefined) {
        continue;
      }
      if (Array.isArray(response)) {
        responses.push(...response);
        continue;
      }
      responses.push(response);
    }
    return responses.length > 0 ? responses : undefined;
  }

  if (!isJsonRpcRequest(message)) {
    return createErrorResponse(null, -32600, "Invalid JSON-RPC request.");
  }

  const isNotification = message.id === undefined;

  if (message.method === "notifications/initialized") {
    if (session.initialized) {
      session.ready = true;
    }
    return undefined;
  }

  if (!session.initialized && message.method !== "initialize" && message.method !== "ping") {
    return isNotification ? undefined : createErrorResponse(message.id ?? null, -32002, "Server has not been initialized.");
  }

  if (session.initialized && !session.ready && message.method !== "ping" && message.method !== "initialize") {
    return isNotification ? undefined : createErrorResponse(message.id ?? null, -32002, "Client has not acknowledged initialization.");
  }

  switch (message.method) {
    case "initialize": {
      if (session.initialized) {
        return isNotification ? undefined : createErrorResponse(message.id ?? null, -32600, "Server is already initialized.");
      }

      const requestedVersion = typeof message.params?.protocolVersion === "string" ? message.params.protocolVersion : null;
      const negotiatedVersion = requestedVersion && server.protocolVersions.includes(requestedVersion)
        ? requestedVersion
        : server.protocolVersions[0] ?? "2025-03-26";

      if (requestedVersion && !server.protocolVersions.includes(requestedVersion)) {
        return isNotification
          ? undefined
          : createErrorResponse(message.id ?? null, -32602, "Unsupported protocol version", {
              supported: server.protocolVersions,
              requested: requestedVersion
            });
      }

      session.initialized = true;
      session.ready = false;
      session.negotiatedProtocolVersion = negotiatedVersion;

      return isNotification
        ? undefined
        : createSuccessResponse(message.id ?? null, {
            protocolVersion: negotiatedVersion,
            capabilities: {
              prompts: { listChanged: false },
              resources: { listChanged: false },
              tools: { listChanged: false }
            },
            serverInfo: {
              name: server.definition.id,
              version: server.serverVersion
            },
            ...(server.instructions ? { instructions: server.instructions } : {})
          });
    }

    case "ping":
      return isNotification ? undefined : createSuccessResponse(message.id ?? null, {});

    case "tools/list":
      return isNotification
        ? undefined
        : createSuccessResponse(message.id ?? null, {
            tools: server.definition.tools.map((tool) => ({
              name: tool.id,
              description: tool.description,
              inputSchema: tool.inputSchema
            }))
          });

    case "tools/call": {
      const toolName = typeof message.params?.name === "string" ? message.params.name : "";
      const action = server.actions.get(toolName);
      if (!action) {
        return isNotification ? undefined : createErrorResponse(message.id ?? null, -32602, `Unknown tool: ${toolName}`);
      }

      try {
        const result = await executeAction(action, isRecord(message.params?.arguments) ? message.params.arguments : {});
        return isNotification
          ? undefined
          : createSuccessResponse(message.id ?? null, {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(result, null, 2)
                }
              ],
              isError: false
            });
      } catch (error) {
        if (error instanceof Error && error.name === "ValidationError") {
          return isNotification
            ? undefined
            : createErrorResponse(message.id ?? null, -32602, error.message);
        }

        return isNotification
          ? undefined
          : createSuccessResponse(message.id ?? null, {
              content: [
                {
                  type: "text",
                  text: error instanceof Error ? error.message : String(error)
                }
              ],
              isError: true
            });
      }
    }

    case "resources/list":
      return isNotification
        ? undefined
        : createSuccessResponse(message.id ?? null, {
            resources: server.definition.resources.map((resource) => ({
              uri: createResourceUri(resource.id),
              name: resource.id,
              title: resource.title,
              description: resource.description,
              mimeType: "application/json"
            }))
          });

    case "resources/read": {
      const uri = typeof message.params?.uri === "string" ? message.params.uri : "";
      const resource = server.resourcesByUri.get(uri);
      if (!resource) {
        return isNotification ? undefined : createErrorResponse(message.id ?? null, -32602, `Unknown resource: ${uri}`);
      }

      return isNotification
        ? undefined
        : createSuccessResponse(message.id ?? null, {
            contents: [
              {
                uri,
                mimeType: "application/json",
                text: JSON.stringify(
                  {
                    id: resource.descriptor.id,
                    description: resource.descriptor.description,
                    schema: resource.descriptor.schema,
                    curatedReadModel: resource.descriptor.curatedReadModel
                  },
                  null,
                  2
                )
              }
            ]
          });
    }

    case "resources/templates/list":
      return isNotification
        ? undefined
        : createSuccessResponse(message.id ?? null, {
            resourceTemplates: []
          });

    case "prompts/list":
      return isNotification
        ? undefined
        : createSuccessResponse(message.id ?? null, {
            prompts: [...server.prompts.values()].map((prompt) => ({
              name: prompt.id,
              title: prompt.title,
              description: prompt.description,
              arguments: prompt.arguments ?? []
            }))
          });

    case "prompts/get": {
      const promptName = typeof message.params?.name === "string" ? message.params.name : "";
      const prompt = server.prompts.get(promptName);
      if (!prompt) {
        return isNotification ? undefined : createErrorResponse(message.id ?? null, -32602, `Unknown prompt: ${promptName}`);
      }

      return isNotification
        ? undefined
        : createSuccessResponse(message.id ?? null, {
            description: prompt.description,
            messages: [
              {
                role: "user",
                content: {
                  type: "text",
                  text: renderPromptBody(prompt.body, isRecord(message.params?.arguments) ? message.params.arguments : {})
                }
              }
            ]
          });
    }

    default:
      return isNotification ? undefined : createErrorResponse(message.id ?? null, -32601, `Method not found: ${message.method}`);
  }
}

function createSuccessResponse(id: JsonRpcId, result: Record<string, unknown>): JsonRpcSuccess {
  return {
    jsonrpc: "2.0",
    id,
    result
  };
}

function createErrorResponse(
  id: JsonRpcId,
  code: number,
  message: string,
  data?: Record<string, unknown>
): JsonRpcError {
  return {
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
      ...(data ? { data } : {})
    }
  };
}

function createResourceUri(resourceId: string): string {
  return `gutu://resource/${encodeURIComponent(resourceId)}`;
}

function renderPromptBody(body: string, args: Record<string, unknown>): string {
  let rendered = body;
  const unusedArgs = new Set(Object.keys(args));

  for (const [key, value] of Object.entries(args)) {
    const placeholder = `{{${key}}}`;
    if (rendered.includes(placeholder)) {
      rendered = rendered.replaceAll(placeholder, stringifyPromptArg(value));
      unusedArgs.delete(key);
    }
  }

  if (unusedArgs.size === 0) {
    return rendered;
  }

  const appendix = [...unusedArgs].map((key) => `${key}: ${stringifyPromptArg(args[key])}`).join("\n");
  return `${rendered}\n\nArguments:\n${appendix}`;
}

function stringifyPromptArg(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function isJsonRpcRequest(value: unknown): value is JsonRpcRequest {
  return isRecord(value) && value.jsonrpc === "2.0" && typeof value.method === "string";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function writeStream(
  stream: NodeJS.WritableStream | { write(chunk: string): unknown } | undefined,
  chunk: string
): void {
  stream?.write(chunk);
}
