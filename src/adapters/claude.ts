/**
 * Claude Agent SDK adapter.
 *
 * Provides a PreToolUse hook for the Anthropic Claude Agent SDK and
 * Claude Code that evaluates every tool call through a Surety guard
 * before the SDK executes it.
 *
 * The hook is synchronous — Surety's deterministic guard never calls an
 * LLM so there is no latency penalty on the happy path.
 *
 * @example with the Claude Agent SDK
 * ```ts
 * import Anthropic from '@anthropic-ai/sdk'
 * import { createGuard, claudePreToolUse } from 'suretyai/adapters/claude'
 *
 * const guard = createGuard([noDeleteRule, spendCeiling])
 * const hook = claudePreToolUse(guard)
 *
 * const client = new Anthropic()
 * // Pass the hook when constructing your agent loop:
 * // hook is called with every tool_use block before execution
 * ```
 *
 * @example in a Claude Code hook (settings.json → hooks → PreToolUse)
 * See https://github.com/balureddy003/suretyai/tree/main/examples/claude-code-hook.ts
 */

import type { Guard } from '../guard.js'
import type { AgentAction } from '../types.js'
import type { Pipeline } from '../pipeline.js'

export type ClaudePreToolUseResult =
  | { type: 'continue' }
  | { type: 'block'; message: string }

export interface ClaudeToolUseEvent {
  tool_use: {
    id?: string
    name: string
    input: Record<string, unknown>
  }
}

/**
 * Returns a synchronous PreToolUse hook that guards every Claude tool call.
 *
 * On block, returns `{ type: 'block', message }` — the SDK will surface
 * the message to the model as a tool_result error, so the model can
 * inform the user rather than silently failing.
 *
 * @example
 * ```ts
 * const hook = claudePreToolUse(guard, { agent_id: 'claude-billing' })
 *
 * // In your message loop:
 * for (const block of message.content) {
 *   if (block.type === 'tool_use') {
 *     const hookResult = hook({ tool_use: block })
 *     if (hookResult.type === 'block') {
 *       // return tool_result with error to model
 *     } else {
 *       // execute the tool
 *     }
 *   }
 * }
 * ```
 */
export function claudePreToolUse(
  guard: Guard,
  options: { agent_id?: string } = {}
): (event: ClaudeToolUseEvent) => ClaudePreToolUseResult {
  return (event) => {
    const action: AgentAction = {
      type: `tool.${event.tool_use.name}`,
      payload: event.tool_use.input,
    }
    const result = guard(action)
    if (!result.allowed) {
      const msg = `[surety] ${result.reasons.join('; ')} | receipt:${result.receipt.id}`
      return { type: 'block', message: msg }
    }
    return { type: 'continue' }
  }
}

/**
 * Async variant that runs an action through a full Pipeline (trust + approval gate).
 * Use this when you need graduated trust and human-in-the-loop for Claude tool calls.
 *
 * @example
 * ```ts
 * const hook = claudePreToolUseAsync(pipeline)
 *
 * for (const block of message.content) {
 *   if (block.type === 'tool_use') {
 *     const result = await hook({ tool_use: block })
 *     if (result.type === 'block') { ... }
 *   }
 * }
 * ```
 */
export function claudePreToolUseAsync(
  pipeline: Pipeline
): (event: ClaudeToolUseEvent) => Promise<ClaudePreToolUseResult> {
  return async (event) => {
    const action: AgentAction = {
      type: `tool.${event.tool_use.name}`,
      payload: event.tool_use.input,
    }
    const result = await pipeline.run(action)
    if (!result.allowed) {
      const reason = result.reasons.length > 0
        ? result.reasons.join('; ')
        : `Decision: ${result.decision}`
      return { type: 'block', message: `[surety] ${reason} | receipt:${result.receipt.id}` }
    }
    return { type: 'continue' }
  }
}
