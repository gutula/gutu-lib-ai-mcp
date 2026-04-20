# AI MCP TODO

**Maturity Tier:** `Hardened`

## Shipped Now

- Publishes 0 public modules from `@platform/ai-mcp`.
- Exports 20 named symbols through the public entrypoint, including `packageId`, `packageDisplayName`, `packageDescription`, `defineMcpServer`, `defineMcpClientConnector`, `deriveMcpToolDescriptor`, and more.
- Keeps the public surface headless and import-driven rather than requiring a UI runtime.
- Verification lanes present: Build+Typecheck+Lint+Test.

## Current Gaps

- Broad public API surface still relies on unit coverage only; there is no separate contract lane yet.
- Standalone consumers still need a compatible Gutu workspace to resolve workspace-scoped dependencies honestly.

## Recommended Next

- Promote heavily reused inference and evaluation seams into clearer contract tests.
- Expand cookbook-style integration guidance only where the exported surface is already stable.
- Add contract-focused tests around the most reused public modules and exported helpers.
- Keep compatibility examples current as more extracted repos consume this library through the workspace vendor model.

## Later / Optional

- Provider-specific optimization guides and richer benchmark packs after the baseline contracts harden.
