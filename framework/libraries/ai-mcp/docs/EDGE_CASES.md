# AI MCP Edge Cases

## Known failure modes

- _Document validation failures, stale state, race conditions, retries, and external dependency failures._

## Data anomalies

- Describe partial imports, duplicate records, missing references, stale approvals, and replay hazards.
- Document what the system should do when upstream data is delayed or contradictory.

## Recovery expectations

- Document whether operators should retry, reopen, reconcile manually, or escalate.
- Document the audit trail, notification, or compensation step expected after failures.