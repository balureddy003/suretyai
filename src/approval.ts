/**
 * Async human-in-the-loop approval gates.
 *
 * Approval gates are pluggable: swap Console for Webhook in production,
 * or Memory for tests — without changing the pipeline.
 */

import type { ActionReceipt, AgentAction } from './types.js'
import { TRUST_LEVEL_NAMES, type TrustLevel } from './trust.js'

export type ApprovalDecision = 'approved' | 'rejected' | 'timeout'

export interface ApprovalContext {
  receipt: ActionReceipt
  action: AgentAction
  trust_level: TrustLevel
}

/** Pluggable approval gate interface. Implement this to add Slack, email, SMS etc. */
export interface ApprovalGate {
  request(context: ApprovalContext): Promise<ApprovalDecision>
}

// ---------------------------------------------------------------------------
// ConsoleApprovalGate — interactive terminal prompt, good for development
// ---------------------------------------------------------------------------

export interface ConsoleApprovalGateOptions {
  /** Milliseconds to wait before timing out. Default 60 000 (1 minute). */
  timeout_ms?: number
}

/**
 * Prompts the operator at the terminal. Blocks until y/n is entered or timeout.
 *
 * @example
 * ```ts
 * const gate = new ConsoleApprovalGate({ timeout_ms: 30_000 })
 * ```
 */
export class ConsoleApprovalGate implements ApprovalGate {
  private timeout_ms: number

  constructor(options: ConsoleApprovalGateOptions = {}) {
    this.timeout_ms = options.timeout_ms ?? 60_000
  }

  async request(ctx: ApprovalContext): Promise<ApprovalDecision> {
    const { action, receipt, trust_level } = ctx
    const lines = [
      '',
      '┌─ Surety AI — Approval required ─────────────────────────────',
      `│  action   : ${action.type}`,
      `│  agent    : ${receipt.agent_id ?? 'unknown'}`,
      `│  trust    : ${TRUST_LEVEL_NAMES[trust_level]}`,
      `│  receipt  : ${receipt.id}`,
      `│  payload  : ${JSON.stringify(action.payload).slice(0, 80)}`,
      `│  timeout  : ${this.timeout_ms / 1000}s`,
      '└─────────────────────────────────────────────────────────────',
      'Approve? [y/n] ',
    ]
    process.stdout.write(lines.join('\n'))

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        process.stdout.write('\n[surety] Timed out — action blocked\n')
        cleanup()
        resolve('timeout')
      }, this.timeout_ms)

      const onData = (buf: Buffer) => {
        const answer = buf.toString().trim().toLowerCase()
        if (answer === 'y' || answer === 'yes') {
          cleanup()
          resolve('approved')
        } else if (answer === 'n' || answer === 'no') {
          cleanup()
          resolve('rejected')
        }
      }

      const cleanup = () => {
        clearTimeout(timer)
        process.stdin.removeListener('data', onData)
        if (process.stdin.isPaused()) process.stdin.resume()
        process.stdin.setRawMode?.(false)
      }

      process.stdin.resume()
      process.stdin.once('data', onData)
    })
  }
}

// ---------------------------------------------------------------------------
// WebhookApprovalGate — fires a POST, polls for decision
// ---------------------------------------------------------------------------

export interface WebhookApprovalGateOptions {
  /** URL to POST the approval request to. */
  url: string
  /** Milliseconds to wait before timing out. Default 300 000 (5 minutes). */
  timeout_ms?: number
  /** How often to poll for a decision. Default 3 000ms. */
  poll_interval_ms?: number
  /** Extra headers on every request (e.g. Authorization). */
  headers?: Record<string, string>
}

/**
 * Sends the action context to a webhook URL and polls for an approval decision.
 * The webhook must respond with `{ "decision": "approved" | "rejected" }`.
 *
 * @example
 * ```ts
 * const gate = new WebhookApprovalGate({
 *   url: 'https://approvals.example.com/review',
 *   headers: { Authorization: 'Bearer my-secret' },
 * })
 * ```
 */
export class WebhookApprovalGate implements ApprovalGate {
  private opts: Required<Omit<WebhookApprovalGateOptions, 'headers'>> & { headers: Record<string, string> }

  constructor(options: WebhookApprovalGateOptions) {
    this.opts = {
      url: options.url,
      timeout_ms: options.timeout_ms ?? 300_000,
      poll_interval_ms: options.poll_interval_ms ?? 3_000,
      headers: options.headers ?? {},
    }
  }

  async request(ctx: ApprovalContext): Promise<ApprovalDecision> {
    const body = {
      id: ctx.receipt.id,
      agent_id: ctx.receipt.agent_id,
      action_type: ctx.action.type,
      payload: ctx.action.payload,
      trust_level: TRUST_LEVEL_NAMES[ctx.trust_level],
      receipt: ctx.receipt,
    }

    let pollUrl: string | undefined

    try {
      const res = await fetch(this.opts.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.opts.headers },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { decision?: string; poll_url?: string }
      if (json.decision === 'approved' || json.decision === 'rejected') {
        return json.decision
      }
      pollUrl = json.poll_url
    } catch {
      return 'timeout'
    }

    if (!pollUrl) return 'timeout'

    const deadline = Date.now() + this.opts.timeout_ms
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, this.opts.poll_interval_ms))
      try {
        const res = await fetch(pollUrl, { headers: this.opts.headers })
        const json = (await res.json()) as { decision?: string }
        if (json.decision === 'approved' || json.decision === 'rejected') {
          return json.decision
        }
      } catch {
        // network blip — keep polling
      }
    }
    return 'timeout'
  }
}

// ---------------------------------------------------------------------------
// MemoryApprovalGate — pre-programmed decisions for tests
// ---------------------------------------------------------------------------

/**
 * Approval gate with pre-programmed decisions. Use in tests so they don't
 * block on human input.
 *
 * @example
 * ```ts
 * const gate = new MemoryApprovalGate(['approved', 'rejected', 'approved'])
 * // First call → 'approved', second → 'rejected', third → 'approved'
 * // Additional calls beyond the queue → 'timeout'
 * ```
 */
export class MemoryApprovalGate implements ApprovalGate {
  private queue: ApprovalDecision[]
  readonly calls: ApprovalContext[] = []

  constructor(decisions: ApprovalDecision[] = []) {
    this.queue = [...decisions]
  }

  async request(ctx: ApprovalContext): Promise<ApprovalDecision> {
    this.calls.push(ctx)
    return this.queue.shift() ?? 'timeout'
  }
}
