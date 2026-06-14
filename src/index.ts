/**
 * Surety AI — the open trust layer for autonomous agents.
 *
 * Every consequential action passes through deterministic gates,
 * earns or spends trust, stays inside hard budget breakers, and
 * leaves a tamper-evident receipt that links decision → cost → outcome.
 * https://github.com/balureddy003/suretyai
 */

/**
 * @module Surety AI
 * @description The open trust layer for autonomous AI agents.
 */

/**
 * Core — deterministic guard
 * @category Core
 */
export { canonicalize } from './canonical.js'
export {
  ReceiptChain,
  SPEC_VERSION,
  createGuard,
  hashPayload,
  hashReceipt,
  verifyChain,
  type Guard,
  type GuardOptions,
} from './guard.js'

/**
 * Bond limits — hard daily circuit breakers
 * @category Limits
 */
export { BondLimits, type BondLimitsConfig } from './limits.js'

/**
 * Graduated trust — agents earn autonomy through track record
 * @category Trust
 */
export {
  TrustLedger,
  TrustLevel,
  TRUST_LEVEL_NAMES,
  type GraduationThresholds,
  type RecordOptions,
  type TrustEntry,
  type TrustLedgerOptions,
  type TrustLedgerState,
} from './trust.js'

/**
 * Approval gates — human-in-the-loop, pluggable channels
 * @category Approval
 */
export {
  ConsoleApprovalGate,
  MemoryApprovalGate,
  WebhookApprovalGate,
  type ApprovalContext,
  type ApprovalDecision,
  type ApprovalGate,
  type ConsoleApprovalGateOptions,
  type WebhookApprovalGateOptions,
} from './approval.js'

/**
 * Approval signal health — guards the guards
 * @category Health
 */
export {
  ApprovalSignalHealth,
  type ApprovalSignalHealthOptions,
  type HealthFlag,
  type HealthReport,
} from './health.js'

/**
 * Pipeline — orchestrates rules → trust → gate → receipt
 * @category Pipeline
 */
export {
  createPipeline,
  type Decision,
  type EvaluationResult,
  type Pipeline,
  type PipelineOptions,
} from './pipeline.js'

/**
 * Types — Action Receipt v0.1 specification
 * @category Types
 */
export type {
  ActionReceipt,
  AgentAction,
  GuardResult,
  GuardRule,
  ReceiptOutcome,
} from './types.js'

/**
 * Adapters — framework integrations
 * @category Adapters
 */
export {
  BlockedByGuardError,
  mcpGuard,
  wrapToolHandler,
} from './adapters/mcp.js'
export {
  claudePreToolUse,
  claudePreToolUseAsync,
  type ClaudePreToolUseResult,
  type ClaudeToolUseEvent,
} from './adapters/claude.js'
export {
  openaiGuardrail,
  openaiPipelineGuardrail,
  type OpenAIGuardrail,
  type OpenAIGuardrailContext,
  type OpenAIGuardrailOutput,
} from './adapters/openai.js'
