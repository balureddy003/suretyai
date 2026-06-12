/**
 * MCP (Model Context Protocol) middleware adapter.
 *
 * Wraps any MCP tool handler function in a Surety guard so every tool
 * call is evaluated before it executes. Framework-agnostic: works with
 * @modelcontextprotocol/sdk, FastMCP, or any library that exposes a
 * (name, input) → Promise<unknown> tool handler pattern.
 *
 * @example with @modelcontextprotocol/sdk
 * ```ts
 * import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
 * import { createGuard, mcpGuard } from 'suretyai'
 *
 * const guard = createGuard([noDeleteRule, spendCeiling])
 * const server = new McpServer({ name: 'my-server', version: '1.0.0' })
 *
 * // Wrap every tool registration
 * const safeHandle = mcpGuard(guard, server.tool.bind(server))
 *
 * safeHandle('send_email', schema, async (args) => { ... })
 * safeHandle('issue_refund', schema, async (args) => { ... })
 * ```
 */

import type { Guard } from '../guard.js'
import type { AgentAction } from '../types.js'

export class BlockedByGuardError extends Error {
  readonly failed_rules: string[]
  readonly reasons: string[]
  readonly receipt_id: string

  constructor(failed_rules: string[], reasons: string[], receipt_id: string) {
    super(`[surety] Action blocked: ${reasons.join('; ')}`)
    this.name = 'BlockedByGuardError'
    this.failed_rules = failed_rules
    this.reasons = reasons
    this.receipt_id = receipt_id
  }
}

/**
 * Wraps a raw tool handler `(name, input) → Promise<T>` with a Surety guard.
 * Throws BlockedByGuardError when the guard blocks the action.
 *
 * Maps `tool.${toolName}` as the action type, so rules can match on
 * `action.type === 'tool.send_email'` or prefix `action.type.startsWith('tool.')`.
 */
export function wrapToolHandler<T>(
  guard: Guard,
  handler: (name: string, input: Record<string, unknown>) => Promise<T>
): (name: string, input: Record<string, unknown>) => Promise<T> {
  return async (name: string, input: Record<string, unknown>): Promise<T> => {
    const action: AgentAction = { type: `tool.${name}`, payload: input }
    const result = guard(action)
    if (!result.allowed) {
      throw new BlockedByGuardError(result.failed_rules, result.reasons, result.receipt.id)
    }
    return handler(name, input)
  }
}

/**
 * Creates a guard-wrapped tool registration function compatible with the
 * MCP SDK's `server.tool(name, schema, handler)` pattern.
 *
 * Drop-in replacement: replace `server.tool` with `mcpGuard(guard, server.tool.bind(server))`.
 */
export function mcpGuard<Schema, Result>(
  guard: Guard,
  registerFn: (name: string, schema: Schema, handler: (args: Record<string, unknown>) => Promise<Result>) => void
): (name: string, schema: Schema, handler: (args: Record<string, unknown>) => Promise<Result>) => void {
  return (name, schema, handler) => {
    registerFn(name, schema, async (args) => {
      const action: AgentAction = { type: `tool.${name}`, payload: args }
      const result = guard(action)
      if (!result.allowed) {
        throw new BlockedByGuardError(result.failed_rules, result.reasons, result.receipt.id)
      }
      return handler(args)
    })
  }
}
