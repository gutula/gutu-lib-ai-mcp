# AI MCP

<p align="center">
  <img src="./docs/assets/gutu-mascot.png" alt="Gutu mascot" width="220" />
</p>

MCP descriptors and connectors derived from framework actions, resources, and prompts.

![Maturity: Hardened](https://img.shields.io/badge/Maturity-Hardened-2563eb) ![Verification: Build+Typecheck+Lint+Test](https://img.shields.io/badge/Verification-Build%2BTypecheck%2BLint%2BTest-6b7280) ![UI: Headless typed exports](https://img.shields.io/badge/UI-Headless%20typed%20exports-6b7280) ![Consumption: Imports + typed helpers](https://img.shields.io/badge/Consumption-Imports%20%2B%20typed%20helpers-2563eb)

## Part Of The Gutu Stack

| Aspect | Value |
| --- | --- |
| Repo kind | First-party library |
| Domain group | AI Foundation |
| Primary focus | MCP helpers, tool contracts, transport composition |
| Best when | You need reusable contracts or UI/runtime helpers with their own release cadence and docs. |
| Consumed through | Imports + typed helpers |

- Gutu libraries stay intentionally separate from apps and plugins so teams can version shared contracts, UI primitives, and runtime helpers without burying them in product code.
- This library should be consumed through explicit imports, providers, callbacks, and typed helpers rather than undocumented global extension points.

## What It Does Now

- Publishes 0 public modules from `@platform/ai-mcp`.
- Exports 20 named symbols through the public entrypoint, including `packageId`, `packageDisplayName`, `packageDescription`, `defineMcpServer`, `defineMcpClientConnector`, `deriveMcpToolDescriptor`, and more.
- Keeps the public surface headless and import-driven rather than requiring a UI runtime.
- Verification lanes present: Build+Typecheck+Lint+Test.

## Maturity

**Maturity Tier:** `Hardened`

Why this tier:
- Group: **AI Foundation**
- Public modules: 0
- Named exports: 20
- Test files: 2
- Contract lane: not present

## Verified API Summary

| Field | Value |
| --- | --- |
| Package ID | `ai-mcp` |
| Import Name | `@platform/ai-mcp` |
| UI Surface | Headless typed exports |
| Consumption Model | Imports + typed helpers |
| Verification | Build+Typecheck+Lint+Test |

## Dependency And Compatibility Summary

| Field | Value |
| --- | --- |
| Package Name | `@platform/ai-mcp` |
| Direct Dependencies | `@platform/ai`, `@platform/schema` |
| Peer Dependencies | None |
| React Runtime | No |
| Workspace Requirement | Compatible Gutu workspace required |

## Capability Matrix

| Capability | Count / Mode | Notes |
| --- | --- | --- |
| Public Modules | 0 | No module re-exports detected |
| Named Exports | 20 | `packageId`, `packageDisplayName`, `packageDescription`, `defineMcpServer`, `defineMcpClientConnector`, `deriveMcpToolDescriptor`, `deriveMcpResourceDescriptor`, `createMcpServerFromContracts` |
| UI Surface | Headless typed exports | Headless typed helpers |
| Tests | 2 | Build+Typecheck+Lint+Test |

## Quick Start For Integrators

Use this repo inside a **compatible Gutu workspace** or the **ecosystem certification workspace** so its `workspace:*` dependencies resolve honestly.

```bash
# from a compatible workspace that already includes this library's dependency graph
bun install
bun run build
bun run test
bun run docs:check
```

```ts
import { packageId, packageDisplayName, defineMcpServer } from "@platform/ai-mcp";

console.log(packageId, packageDisplayName, typeof defineMcpServer);
```

Use the root repo scripts for day-to-day work after the workspace is bootstrapped, or run the nested package directly from `framework/libraries/ai-mcp` if you need lower-level control.

## Current Test Coverage

- `bun run build`
- `bun run typecheck`
- `bun run lint`
- `bun run test`
- `bun run docs:check`
- `bun run test:unit`
- Unit files: 2
- Contract files: 0
- Integration files: 0
- Migration files: 0

## Known Boundaries And Non-Goals

- Not an end-user AI product or provider control plane on its own.
- Not a substitute for surrounding approval, audit, and budget governance.
- This library should be consumed through explicit imports, providers, callbacks, and typed helpers rather than undocumented global hooks.

## Recommended Next Milestones

- Promote heavily reused inference and evaluation seams into clearer contract tests.
- Expand cookbook-style integration guidance only where the exported surface is already stable.
- Add contract-focused tests around the most reused public modules and exported helpers.
- Keep compatibility examples current as more extracted repos consume this library through the workspace vendor model.

## More Docs

- [Developer Guide](./DEVELOPER.md)
- [TODO](./TODO.md)
- [Security](./SECURITY.md)
- [Contributing](./CONTRIBUTING.md)
