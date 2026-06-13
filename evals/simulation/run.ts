import { readFileSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import {
  createAlwaysExecutePolicy,
  createStaticHumanReviewPolicy,
  createSuretyGuardPolicy,
  parseJsonlDataset,
  runSimulation,
  type DatasetProvenance,
} from './framework.js'
import { refundRules, createRefundScenario } from './refund-scenario.js'
import { renderSimulationReport } from './report.js'

const inputPath = argument('--input')
const requestedProvenance = argument('--provenance')
const provenance = parseProvenance(requestedProvenance)
const dataset = inputPath === undefined
  ? createRefundScenario()
  : parseJsonlDataset(readFileSync(inputPath, 'utf8'), {
      id: `refund-trace:${basename(inputPath)}`,
      name: `Refund trace: ${basename(inputPath)}`,
      description: 'Externally supplied labeled refund proposals replayed through comparative policies.',
      provenance,
    })

if (dataset.cases.some((testCase) => testCase.action.type !== 'payment.refund')) {
  throw new Error('the built-in simulation runner accepts only payment.refund traces')
}
const result = await runSimulation(dataset, [
  createAlwaysExecutePolicy(),
  createStaticHumanReviewPolicy({
    seed: 20260614,
    false_approve_rate: 0.03,
    false_reject_rate: 0.02,
    fatigue_after: 500,
    fatigue_error_increase: 0.12,
  }),
  createSuretyGuardPolicy(refundRules()),
])

writeFileSync('evals/SIMULATION_RESULTS.json', `${JSON.stringify(result, null, 2)}\n`)
writeFileSync('evals/SIMULATION_RESULTS.md', renderSimulationReport(result))

for (const { policy_name, metrics } of result.policies) {
  console.log(
    `${policy_name.padEnd(31)} unsafe executed ${String(metrics.unsafe_executed).padStart(4)} / ${metrics.unsafe}` +
    ` | safe blocked ${String(metrics.safe_blocked).padStart(4)} / ${metrics.safe}` +
    ` | reviewed ${String(metrics.reviewed).padStart(4)} / ${metrics.total}`
  )
}
console.log('\nFull reports written to evals/SIMULATION_RESULTS.md and evals/SIMULATION_RESULTS.json')

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name)
  if (index === -1) return undefined
  const value = process.argv[index + 1]
  if (value === undefined || value.startsWith('--')) throw new Error(`${name} requires a value`)
  return value
}

function parseProvenance(value: string | undefined): DatasetProvenance {
  if (value === undefined) return 'shadow'
  if (value === 'historical' || value === 'shadow' || value === 'field') return value
  throw new Error('--provenance must be historical, shadow, or field')
}
