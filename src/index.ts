/**
 * Surety AI — the open trust layer for autonomous agents.
 *
 * Every consequential action passes through deterministic gates,
 * stays inside hard budget breakers, and leaves a tamper-evident
 * receipt. https://github.com/balureddy003/suretyai
 */
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
export { BondLimits, type BondLimitsConfig } from './limits.js'
export type {
  ActionReceipt,
  AgentAction,
  GuardResult,
  GuardRule,
  ReceiptOutcome,
} from './types.js'
