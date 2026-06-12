/**
 * OpenAI Agents SDK adapter.
 *
 * Provides an input guardrail compatible with the OpenAI Agents SDK
 * (`@openai/agents`) that evaluates every function tool call through
 * a Surety guard before execution.
 *
 * @example
 * ```ts
 * import { Agent, run } from '@openai/agents'
 * import { createGuard, openaiGuardrail } from 'suretyai/adapters/openai'
 *
 * const guard = createGuard([noDeleteRule, spendCeiling])
 *
 * const agent = new Agent({
 *   name: 'billing-agent',
 *   inputGuardrails: [openaiGuardrail(guard)],
 *   tools: [sendEmailTool, issueRefundTool],
 * })
 * ```
 */

import type { Guard } from '../guard.js'
import type { AgentAction } from '../types.js'
import type { Pipeline } from '../pipeline.js'

export interface OpenAIGuardrailOutput {
  tripwireTriggered: boolean
  outputInfo?: {
    blocked_by: string[]
    reasons: string[]
    receipt_id: string
  }
}

export interface OpenAIGuardrailContext {
  toolName: string
  toolInput: Record<string, unknown>
}

export interface OpenAIGuardrail {
  runIfNeeded(ctx: OpenAIGuardrailContext): Promise<OpenAIGuardrailOutput>
}

/**
 * Synchronous OpenAI Agents SDK input guardrail backed by a Surety guard.
 *
 * When `tripwireTriggered` is true, the Agents SDK cancels the tool call
 * and raises a `GuardrailTripwireTriggered` exception that you can catch
 * to handle the block gracefully.
 */
export function openaiGuardrail(guard: Guard): OpenAIGuardrail {
  return {
    async runIfNeeded(ctx) {
      const action: AgentAction = { type: `tool.${ctx.toolName}`, payload: ctx.toolInput }
      const result = guard(action)
      if (!result.allowed) {
        return {
          tripwireTriggered: true,
          outputInfo: {
            blocked_by: result.failed_rules,
            reasons: result.reasons,
            receipt_id: result.receipt.id,
          },
        }
      }
      return { tripwireTriggered: false }
    },
  }
}

/**
 * Async OpenAI Agents SDK input guardrail backed by a full Surety Pipeline.
 * Use when you need graduated trust + human approval gates.
 */
export function openaiPipelineGuardrail(pipeline: Pipeline): OpenAIGuardrail {
  return {
    async runIfNeeded(ctx) {
      const action: AgentAction = { type: `tool.${ctx.toolName}`, payload: ctx.toolInput }
      const result = await pipeline.run(action)
      if (!result.allowed) {
        return {
          tripwireTriggered: true,
          outputInfo: {
            blocked_by: result.failed_rules,
            reasons: result.reasons,
            receipt_id: result.receipt.id,
          },
        }
      }
      return { tripwireTriggered: false }
    },
  }
}
