# Examples

All examples run locally in seconds with **no API keys** — agents and reviewers are simulated so the guard behavior is the star. Run any of them with:

```bash
npx tsx examples/<file>
```

| # | File | What it shows |
|---|---|---|
| 01 | [01-quickstart.ts](01-quickstart.ts) | Deterministic rules, bond limits, hash-chained receipts — and tamper detection catching a forged audit log |
| 02 | [02-earned-autonomy.ts](02-earned-autonomy.ts) | **The flagship demo.** An agent graduates SUPERVISED → BONDED over a clean track record, gets demoted on its first rejection, and the approval load drops ~75% vs static human-in-the-loop |
| 03 | [03-pocketos-incident.ts](03-pocketos-incident.ts) | The April 2026 database-deletion incident class replayed against Surety — three independent layers each stop it, and the receipts make forensics independent of the agent's "confession" |
| 04 | [04-claude-agent-hook.ts](04-claude-agent-hook.ts) | Guarding Claude tool calls with `claudePreToolUse` — three lines in any tool-use loop |
| 05 | [05-mcp-server-guard.ts](05-mcp-server-guard.ts) | Wrapping an MCP server's tool dispatcher with `wrapToolHandler` / `mcpGuard` |

Real-world dogfooding: this repo's own CI agent runs under a Surety guard via a Claude Code `PreToolUse` hook — see [scripts/surety-hook.mjs](../scripts/surety-hook.mjs).
