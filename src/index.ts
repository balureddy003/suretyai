/**
 * Surety AI — the open trust layer for autonomous agents.
 *
 * Every consequential action passes through deterministic gates,
 * earns or spends trust, stays inside hard budget breakers, and
 * leaves a tamper-evident receipt that links decision → cost → outcome.
 * https://github.com/balureddy003/suretyai
 */

// Core — deterministic guard
export { canonicalize } from './canonical.js'
export {
  SPEC_VERSION,
  createGuard,
  hashPayload,
  hashReceipt,
  verifyChain,
  type Guard,
  type GuardOptions,
} from './guard.js'

// Bond limits — hard daily circuit breakers
export { BondLimits, type BondLimitsConfig } from './limits.js'

// Graduated trust — agents earn autonomy through track record
export {
  TrustLedger,
  TrustLevel,
  TRUST_LEVEL_NAMES,
  type GraduationThresholds,
  type TrustEntry,
  type TrustLedgerOptions,
  type TrustLedgerState,
} from './trust.js'

// Approval gates — human-in-the-loop, pluggable channels
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

// Approval signal health — guards the guards
export {
  ApprovalSignalHealth,
  type ApprovalSignalHealthOptions,
  type HealthFlag,
  type HealthReport,
} from './health.js'

// Pipeline — orchestrates rules → trust → gate → receipt
export {
  createPipeline,
  type Decision,
  type EvaluationResult,
  type Pipeline,
  type PipelineOptions,
} from './pipeline.js'

// Types — Action Receipt v0.1 specification
export type {
  ActionReceipt,
  AgentAction,
  GuardResult,
  GuardRule,
  ReceiptOutcome,
} from './types.js'

// Adapters — framework integrations
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
