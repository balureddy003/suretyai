/**
 * 04 — Guarding Claude tool calls (Claude Agent SDK / any tool-use loop)
 *
 * claudePreToolUse() returns a hook you call with every tool_use block
 * before executing it. Synchronous and deterministic — zero added latency.
 * The async variant routes through a full pipeline (trust + human gates).
 *
 * This example simulates the message loop so it runs without an API key;
 * the hook usage is exactly what you'd write in a real @anthropic-ai/sdk loop.
 *
 * Run: npx tsx examples/04-claude-agent-hook.ts
 */
import { BondLimits, claudePreToolUse, createGuard } from '../src/index.js'

const limits = new BondLimits({ max_actions_per_day: 50 })

const guard = createGuard(
  [
    limits.rule(),
    {
      id: 'no-shell-rm',
      check: (a) => a.type !== 'tool.bash' || !/\brm\s+-rf\b/.test(String(a.payload.command)),
      reason: 'Recursive deletes are blocked',
    },
    {
      id: 'sendable-domains',
      check: (a) => a.type !== 'tool.send_email' || String(a.payload.to).endsWith('@example.com'),
      reason: 'This agent may only email @example.com addresses',
    },
  ],
  { agent_id: 'claude-assistant', chain: true }
)

const hook = claudePreToolUse(guard)

// ── In a real loop this block comes from client.messages.create() ──────────
const simulatedToolUses = [
  { type: 'tool_use' as const, id: 'tu_1', name: 'bash', input: { command: 'ls -la' } },
  { type: 'tool_use' as const, id: 'tu_2', name: 'bash', input: { command: 'rm -rf /tmp/cache' } },
  { type: 'tool_use' as const, id: 'tu_3', name: 'send_email', input: { to: 'ceo@bigcorp.com', body: 'hi' } },
  { type: 'tool_use' as const, id: 'tu_4', name: 'send_email', input: { to: 'ops@example.com', body: 'done' } },
]

for (const block of simulatedToolUses) {
  const decision = hook({ tool_use: block })

  if (decision.type === 'continue') {
    console.log(`✅ ${block.name}(${JSON.stringify(block.input).slice(0, 40)}…) → executing`)
    // const result = await executeTool(block.name, block.input)
    limits.record({ type: `tool.${block.name}`, payload: block.input })
  } else {
    // Return the message as a tool_result error — the model sees WHY and adapts.
    console.log(`⛔ ${block.name} → tool_result error: "${decision.message}"`)
  }
}

console.log(`\nIn your real loop, the integration is three lines:
  const hook = claudePreToolUse(guard)
  const decision = hook({ tool_use: block })
  if (decision.type === 'block') return toolResultError(decision.message)`)
