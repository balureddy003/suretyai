import type { PolicySimulationResult, SimulationResult } from './framework.js'

export function renderSimulationReport(result: SimulationResult): string {
  const policyTable = [
    '| Policy | Unsafe executed | Safe blocked | Human review | Realized loss | Prevented loss | Net value |',
    '|---|---:|---:|---:|---:|---:|---:|',
    ...result.policies.map(({ policy_name, metrics }) =>
      `| ${policy_name} | ${countRate(metrics.unsafe_executed, metrics.false_allow_rate)} | ${countRate(metrics.safe_blocked, metrics.false_block_rate)} | ${countRate(metrics.reviewed, metrics.review_rate)} | ${money(metrics.realized_loss_minor)} | ${money(metrics.prevented_loss_minor)} | ${money(metrics.net_value_minor)} |`
    ),
  ].join('\n')

  const surety = getPolicy(result, 'surety-guard')
  const unguarded = getPolicy(result, 'unguarded')
  const hitl = getPolicy(result, 'static-hitl')
  const lossReduction = reduction(surety.metrics.realized_loss_minor, unguarded.metrics.realized_loss_minor)
  const reviewReduction = reduction(surety.metrics.reviewed, hitl.metrics.reviewed)

  const residualRisk = Object.entries(surety.metrics.by_risk_class)
    .filter(([, metrics]) => metrics.unsafe_executed > 0)
    .sort(([, a], [, b]) => b.unsafe_executed - a.unsafe_executed)
    .map(([risk, metrics]) => `| ${risk} | ${metrics.unsafe_executed}/${metrics.unsafe} |`)
    .join('\n')
  const configurations = result.policies
    .map((policy) => {
      const values = Object.entries(policy.configuration ?? {})
        .map(([key, value]) => `\`${key}=${Array.isArray(value) ? value.join(',') : value}\``)
        .join(', ')
      return `- **${policy.policy_name}:** ${values || 'no configurable assumptions'}`
    })
    .join('\n')
  const labelSources = Object.entries(result.label_sources)
    .map(([source, count]) => `${source}=${count}`)
    .join(', ')

  return `# Surety Comparative Simulation Results

> Reproduce with \`npm run eval:simulation\`. Generated ${new Date().toISOString().slice(0, 10)}.

## Dataset

- **Name:** ${result.dataset.name}
- **Cases:** ${result.case_count.toLocaleString('en-US')}
- **Provenance:** ${result.dataset.provenance}
- **Label sources:** ${labelSources}
- **Seed:** ${result.dataset.seed ?? 'n/a'}
- **Description:** ${result.dataset.description}

## Comparative result

${policyTable}

Within this ${result.dataset.provenance} dataset, the Surety boundary reduced
realized loss by **${percent(lossReduction)}** relative to unguarded execution
and reduced human review by **${percent(reviewReduction)}** relative to static
HITL.

## Policy configuration

${configurations}

## Residual Surety risk

| Risk class | Unsafe actions executed |
|---|---:|
${residualRisk || '| none | 0 |'}

Residual risk is a required output, not a failed report. It identifies where
new evidence, clarification, forecasting, canaries, or human review are needed.

## Interpretation limit

This is a **${result.dataset.provenance}** comparative simulation. It proves
that the framework and configured controls behave as measured on this dataset.
Synthetic or historical replay does not prove future production effectiveness.
Use independently labeled shadow or field traces from your own execution
system before making field-performance claims.
`
}

function getPolicy(result: SimulationResult, id: string): PolicySimulationResult {
  const policy = result.policies.find((candidate) => candidate.policy_id === id)
  if (!policy) throw new Error(`missing required policy: ${id}`)
  return policy
}

function countRate(count: number, rate: number): string {
  return `${count.toLocaleString('en-US')} (${percent(rate)})`
}

function percent(value: number): string {
  return `${(value * 100).toFixed(1)}%`
}

function money(value: number): string {
  return `$${(value / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function reduction(value: number, baseline: number): number {
  return baseline === 0 ? 0 : 1 - value / baseline
}
