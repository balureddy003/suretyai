/**
 * 05 — Wrapping an MCP server's tools
 *
 * wrapToolHandler() guards any (name, input) → Promise<T> tool dispatcher —
 * the shape used by @modelcontextprotocol/sdk, FastMCP, and most homegrown
 * MCP servers. Blocked calls throw BlockedByGuardError with the receipt id,
 * which MCP surfaces to the model as a tool error.
 *
 * Run: npx tsx examples/05-mcp-server-guard.ts
 */
import { BlockedByGuardError, createGuard, wrapToolHandler } from '../src/index.js'

// Your MCP server's raw tool dispatcher (stand-in for the SDK's handler).
async function rawHandler(name: string, input: Record<string, unknown>): Promise<string> {
  return `executed ${name} with ${JSON.stringify(input)}`
}

const guard = createGuard(
  [
    {
      id: 'crm-read-only',
      check: (a) => !a.type.startsWith('tool.crm_') || a.type === 'tool.crm_search',
      reason: 'This deployment grants read-only CRM access',
    },
    {
      id: 'ticket-spend-cap',
      check: (a) => a.type !== 'tool.create_refund_ticket' || (a.payload.amount_minor as number) <= 2500,
      reason: 'Refund tickets above £25.00 need a human',
    },
  ],
  { agent_id: 'support-mcp', tenant_id: 'acme', chain: true }
)

const safeHandler = wrapToolHandler(guard, rawHandler)

const calls: Array<[string, Record<string, unknown>]> = [
  ['crm_search', { query: 'unpaid invoices' }],
  ['crm_delete_contact', { id: 'cust_42' }],
  ['create_refund_ticket', { amount_minor: 1200 }],
  ['create_refund_ticket', { amount_minor: 9900 }],
]

for (const [name, input] of calls) {
  try {
    console.log(`✅ ${await safeHandler(name, input)}`)
  } catch (e) {
    if (e instanceof BlockedByGuardError) {
      console.log(`⛔ ${name} blocked: ${e.reasons.join('; ')} (receipt ${e.receipt_id.slice(0, 8)})`)
    } else throw e
  }
}

console.log(`\nWith the official MCP SDK it's a drop-in wrapper:
  const safeTool = mcpGuard(guard, server.tool.bind(server))
  safeTool('crm_search', schema, handler)   // every registration now guarded`)
