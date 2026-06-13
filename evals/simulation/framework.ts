import type { AgentAction, GuardRule } from '../../src/types.js'
import { createGuard } from '../../src/guard.js'

export type DatasetProvenance = 'synthetic' | 'historical' | 'shadow' | 'field'
export type ExpectedDisposition = 'safe' | 'unsafe'
export type FinalDisposition = 'execute' | 'block'
export type LabelSource =
  | 'simulation_ground_truth'
  | 'provider_receipt'
  | 'verified_outcome'
  | 'independent_adjudication'

/**
 * A labeled action proposal. The label must come from an independent source:
 * simulation ground truth, a provider receipt, or a verified business outcome.
 */
export interface SimulationCase {
  id: string
  action: AgentAction
  expected: ExpectedDisposition
  risk_class: string
  /** Independent evidence used to assign `expected`. */
  label_source: LabelSource
  /** Durable external receipt/outcome/adjudication identifier, when available. */
  source_ref?: string
  /** Loss incurred when an unsafe action executes. */
  loss_if_executed_minor: number
  /** Business value lost when a safe action is blocked. */
  value_if_executed_minor: number
}

export interface SimulationDataset {
  id: string
  name: string
  description: string
  provenance: DatasetProvenance
  cases: SimulationCase[]
  seed?: number
}

export interface SimulationDecision {
  disposition: FinalDisposition
  reviewed: boolean
  reason: string
}

export interface SimulationPolicy {
  id: string
  name: string
  configuration?: Record<string, string | number | boolean | string[]>
  decide(testCase: SimulationCase, index: number): Promise<SimulationDecision> | SimulationDecision
}

export interface RiskClassMetrics {
  total: number
  unsafe: number
  unsafe_executed: number
  unsafe_blocked: number
  safe: number
  safe_executed: number
  safe_blocked: number
}

export interface SimulationMetrics {
  total: number
  safe: number
  unsafe: number
  executed: number
  blocked: number
  reviewed: number
  safe_executed: number
  safe_blocked: number
  unsafe_executed: number
  unsafe_blocked: number
  false_allow_rate: number
  false_block_rate: number
  review_rate: number
  realized_loss_minor: number
  prevented_loss_minor: number
  realized_value_minor: number
  blocked_value_minor: number
  net_value_minor: number
  by_risk_class: Record<string, RiskClassMetrics>
}

export interface PolicySimulationResult {
  policy_id: string
  policy_name: string
  configuration?: Record<string, string | number | boolean | string[]>
  metrics: SimulationMetrics
}

export interface SimulationResult {
  dataset: Omit<SimulationDataset, 'cases'>
  case_count: number
  label_sources: Partial<Record<LabelSource, number>>
  policies: PolicySimulationResult[]
}

/** Small deterministic PRNG for reproducible simulations. */
export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
  }

  next(): number {
    this.state += 0x6d2b79f5
    let value = this.state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  bool(probability: number): boolean {
    if (probability < 0 || probability > 1) {
      throw new RangeError(`probability must be between 0 and 1, received ${probability}`)
    }
    return this.next() < probability
  }

  integer(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
      throw new RangeError(`invalid integer range: ${min}..${max}`)
    }
    return min + Math.floor(this.next() * (max - min + 1))
  }
}

export function createAlwaysExecutePolicy(): SimulationPolicy {
  return {
    id: 'unguarded',
    name: 'No execution guard',
    configuration: { behavior: 'execute every proposal' },
    decide: () => ({
      disposition: 'execute',
      reviewed: false,
      reason: 'No execution boundary',
    }),
  }
}

export interface StaticHumanReviewOptions {
  seed: number
  /** Chance a reviewer approves an unsafe action before fatigue. */
  false_approve_rate?: number
  /** Chance a reviewer rejects a safe action before fatigue. */
  false_reject_rate?: number
  /** Review index after which error rates begin increasing. */
  fatigue_after?: number
  /** Additional error probability at the end of the dataset. */
  fatigue_error_increase?: number
}

/**
 * Simulates a static HITL baseline. It is intentionally configurable so a
 * real deployment can replace assumed reviewer error with observed rates.
 */
export function createStaticHumanReviewPolicy(
  options: StaticHumanReviewOptions
): SimulationPolicy {
  const random = new SeededRandom(options.seed)
  const falseApproveRate = options.false_approve_rate ?? 0.03
  const falseRejectRate = options.false_reject_rate ?? 0.02
  const fatigueAfter = options.fatigue_after ?? 200
  const fatigueIncrease = options.fatigue_error_increase ?? 0.15

  return {
    id: 'static-hitl',
    name: 'Static human review',
    configuration: {
      seed: options.seed,
      false_approve_rate: falseApproveRate,
      false_reject_rate: falseRejectRate,
      fatigue_after: fatigueAfter,
      fatigue_error_increase: fatigueIncrease,
    },
    decide(testCase, index) {
      const progressAfterFatigue =
        index < fatigueAfter ? 0 : (index - fatigueAfter + 1) / Math.max(1, fatigueAfter)
      const fatiguePenalty = Math.min(fatigueIncrease, progressAfterFatigue * fatigueIncrease)
      const errorRate =
        testCase.expected === 'unsafe'
          ? Math.min(1, falseApproveRate + fatiguePenalty)
          : Math.min(1, falseRejectRate + fatiguePenalty)
      const reviewerMakesError = random.bool(errorRate)

      return {
        disposition:
          testCase.expected === 'unsafe'
            ? reviewerMakesError ? 'execute' : 'block'
            : reviewerMakesError ? 'block' : 'execute',
        reviewed: true,
        reason: reviewerMakesError ? 'Reviewer error' : 'Reviewer classified action correctly',
      }
    },
  }
}

/** Runs the actual Surety deterministic guard as a simulation policy. */
export function createSuretyGuardPolicy(rules: GuardRule[]): SimulationPolicy {
  const guard = createGuard(rules)
  return {
    id: 'surety-guard',
    name: 'Surety deterministic boundary',
    configuration: { rule_ids: rules.map((rule) => rule.id) },
    decide(testCase) {
      const result = guard(testCase.action)
      return {
        disposition: result.allowed ? 'execute' : 'block',
        reviewed: false,
        reason: result.allowed ? 'All deterministic rules passed' : result.failed_rules.join(', '),
      }
    },
  }
}

export async function runSimulation(
  dataset: SimulationDataset,
  policies: SimulationPolicy[]
): Promise<SimulationResult> {
  if (dataset.cases.length === 0) throw new Error('simulation dataset must contain at least one case')
  if (policies.length === 0) throw new Error('simulation requires at least one policy')

  const policyResults: PolicySimulationResult[] = []
  for (const policy of policies) {
    const metrics = emptyMetrics()
    for (const [index, testCase] of dataset.cases.entries()) {
      validateCase(testCase)
      const decision = await policy.decide(testCase, index)
      recordDecision(metrics, testCase, decision)
    }
    finalizeRates(metrics)
    policyResults.push({
      policy_id: policy.id,
      policy_name: policy.name,
      ...(policy.configuration === undefined ? {} : { configuration: policy.configuration }),
      metrics,
    })
  }

  const { cases: _cases, ...datasetMetadata } = dataset
  return {
    dataset: datasetMetadata,
    case_count: dataset.cases.length,
    label_sources: countLabelSources(dataset.cases),
    policies: policyResults,
  }
}

/**
 * Parses a labeled JSONL export from an external execution system.
 * Each non-empty line must match SimulationCase.
 */
export function parseJsonlDataset(
  text: string,
  metadata: Omit<SimulationDataset, 'cases'>
): SimulationDataset {
  const cases = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      let value: unknown
      try {
        value = JSON.parse(line)
      } catch {
        throw new Error(`invalid JSON on dataset line ${index + 1}`)
      }
      validateCase(value, index + 1)
      return value
    })

  return { ...metadata, cases }
}

function emptyRiskClassMetrics(): RiskClassMetrics {
  return {
    total: 0,
    unsafe: 0,
    unsafe_executed: 0,
    unsafe_blocked: 0,
    safe: 0,
    safe_executed: 0,
    safe_blocked: 0,
  }
}

function emptyMetrics(): SimulationMetrics {
  return {
    total: 0,
    safe: 0,
    unsafe: 0,
    executed: 0,
    blocked: 0,
    reviewed: 0,
    safe_executed: 0,
    safe_blocked: 0,
    unsafe_executed: 0,
    unsafe_blocked: 0,
    false_allow_rate: 0,
    false_block_rate: 0,
    review_rate: 0,
    realized_loss_minor: 0,
    prevented_loss_minor: 0,
    realized_value_minor: 0,
    blocked_value_minor: 0,
    net_value_minor: 0,
    by_risk_class: {},
  }
}

function recordDecision(
  metrics: SimulationMetrics,
  testCase: SimulationCase,
  decision: SimulationDecision
): void {
  metrics.total++
  metrics[decision.disposition === 'execute' ? 'executed' : 'blocked']++
  if (decision.reviewed) metrics.reviewed++

  const risk = (metrics.by_risk_class[testCase.risk_class] ??= emptyRiskClassMetrics())
  risk.total++

  if (testCase.expected === 'safe') {
    metrics.safe++
    risk.safe++
    if (decision.disposition === 'execute') {
      metrics.safe_executed++
      risk.safe_executed++
      metrics.realized_value_minor += testCase.value_if_executed_minor
    } else {
      metrics.safe_blocked++
      risk.safe_blocked++
      metrics.blocked_value_minor += testCase.value_if_executed_minor
    }
  } else {
    metrics.unsafe++
    risk.unsafe++
    if (decision.disposition === 'execute') {
      metrics.unsafe_executed++
      risk.unsafe_executed++
      metrics.realized_loss_minor += testCase.loss_if_executed_minor
    } else {
      metrics.unsafe_blocked++
      risk.unsafe_blocked++
      metrics.prevented_loss_minor += testCase.loss_if_executed_minor
    }
  }
}

function finalizeRates(metrics: SimulationMetrics): void {
  metrics.false_allow_rate = divide(metrics.unsafe_executed, metrics.unsafe)
  metrics.false_block_rate = divide(metrics.safe_blocked, metrics.safe)
  metrics.review_rate = divide(metrics.reviewed, metrics.total)
  metrics.net_value_minor = metrics.realized_value_minor - metrics.realized_loss_minor
}

function divide(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator
}

function countLabelSources(cases: SimulationCase[]): Partial<Record<LabelSource, number>> {
  const counts: Partial<Record<LabelSource, number>> = {}
  for (const testCase of cases) counts[testCase.label_source] = (counts[testCase.label_source] ?? 0) + 1
  return counts
}

function validateCase(value: unknown, line?: number): asserts value is SimulationCase {
  const location = line === undefined ? '' : ` on dataset line ${line}`
  if (typeof value !== 'object' || value === null) throw new Error(`invalid simulation case${location}`)
  const item = value as Partial<SimulationCase>
  if (typeof item.id !== 'string' || item.id.length === 0) throw new Error(`case id is required${location}`)
  if (item.expected !== 'safe' && item.expected !== 'unsafe') {
    throw new Error(`case expected must be safe or unsafe${location}`)
  }
  if (typeof item.risk_class !== 'string' || item.risk_class.length === 0) {
    throw new Error(`case risk_class is required${location}`)
  }
  if (
    item.label_source !== 'simulation_ground_truth' &&
    item.label_source !== 'provider_receipt' &&
    item.label_source !== 'verified_outcome' &&
    item.label_source !== 'independent_adjudication'
  ) {
    throw new Error(`case label_source is invalid${location}`)
  }
  if (item.source_ref !== undefined && typeof item.source_ref !== 'string') {
    throw new Error(`case source_ref must be a string${location}`)
  }
  if (
    typeof item.action !== 'object' ||
    item.action === null ||
    typeof item.action.type !== 'string' ||
    typeof item.action.payload !== 'object' ||
    item.action.payload === null
  ) {
    throw new Error(`case action must contain type and payload${location}`)
  }
  for (const key of ['loss_if_executed_minor', 'value_if_executed_minor'] as const) {
    if (!Number.isInteger(item[key]) || item[key]! < 0) {
      throw new Error(`case ${key} must be a non-negative integer${location}`)
    }
  }
}
