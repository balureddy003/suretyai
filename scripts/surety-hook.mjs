#!/usr/bin/env node
/**
 * Surety guards its own research agent — dogfooding.
 *
 * Claude Code PreToolUse hook: every tool call the research agent makes is
 * evaluated by suretyai's deterministic guard before it executes. Blocked
 * calls return exit code 2 (Claude sees the reason and adjusts). Every
 * decision — allowed or blocked — appends a hash-chained Action Receipt to
 * intel/receipts.jsonl, which the agent commits with its PR as a
 * tamper-evident audit trail of its own behavior.
 *
 * Wired up in .claude/settings.json. Requires `npm run build` (imports dist).
 */

import { appendFileSync, existsSync, readFileSync } from 'node:fs'

const RECEIPTS = 'intel/receipts.jsonl'
const MAX_ACTIONS_PER_RUN = 300

let guardLib
try {
  guardLib = await import('../dist/guard.js')
} catch {
  // Build missing (local dev without `npm run build`). Fail open, loudly —
  // CI always builds before the agent step, so enforcement holds there.
  console.error('[surety-hook] dist/ not built — guard NOT enforced for this call')
  process.exit(0)
}
const { createGuard, hashReceipt } = guardLib

const input = JSON.parse(readFileSync(0, 'utf8'))
const toolName = input.tool_name ?? 'unknown'
const payload = input.tool_input ?? {}
const text = JSON.stringify(payload)

const rules = [
  {
    id: 'no-workflow-self-edit',
    check: () => !text.includes('.github/workflows'),
    reason: 'Agents may not modify their own workflow definitions (privilege escalation)',
  },
  {
    id: 'no-push-main',
    check: () =>
      toolName !== 'Bash' ||
      !/git\s+push/.test(payload.command ?? '') ||
      (!/\bmain\b/.test(payload.command) && !/--force/.test(payload.command)),
    reason: 'Direct or forced pushes to main are blocked — open a PR instead',
  },
  {
    id: 'no-destructive-shell',
    check: () => toolName !== 'Bash' || !/\brm\s+-rf\b|\bgit\s+reset\s+--hard\b/.test(payload.command ?? ''),
    reason: 'Destructive shell commands are blocked',
  },
  {
    id: 'no-secret-files',
    check: () => !/\.env\b|secrets?\./i.test(payload.file_path ?? ''),
    reason: 'Reading or writing secret files is blocked',
  },
  {
    id: 'bond-limit-actions',
    check: () => countReceipts() < MAX_ACTIONS_PER_RUN,
    reason: `Run bond limit reached (${MAX_ACTIONS_PER_RUN} tool calls) — circuit breaker tripped`,
  },
]

function countReceipts() {
  if (!existsSync(RECEIPTS)) return 0
  return readFileSync(RECEIPTS, 'utf8').split('\n').filter(Boolean).length
}

function lastReceiptHash() {
  if (!existsSync(RECEIPTS)) return undefined
  const lines = readFileSync(RECEIPTS, 'utf8').split('\n').filter(Boolean)
  if (lines.length === 0) return undefined
  try {
    return hashReceipt(JSON.parse(lines[lines.length - 1]))
  } catch {
    return undefined
  }
}

const guard = createGuard(rules, { agent_id: 'research-agent' })
const result = guard({ type: `tool.${toolName}`, payload })

// Chain across hook invocations: each process is fresh, so we link
// receipts manually via the hash of the last persisted receipt.
const prev = lastReceiptHash()
const receipt = prev ? { ...result.receipt, prev_receipt_hash: prev } : result.receipt
appendFileSync(RECEIPTS, JSON.stringify(receipt) + '\n')

if (!result.allowed) {
  console.error(`[surety] BLOCKED ${toolName}: ${result.reasons.join('; ')} | receipt:${receipt.id}`)
  process.exit(2)
}
process.exit(0)
