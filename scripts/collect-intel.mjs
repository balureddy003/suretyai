#!/usr/bin/env node
/**
 * Competitive-intelligence collector for the Surety AI research agent.
 *
 * Deterministic data gathering — no LLM involved. Pulls live numbers from
 * the GitHub API, npm, and PyPI, then writes:
 *   intel/latest.json  — machine-readable snapshot (committed for history)
 *   intel/digest.md    — human/agent-readable digest the research agent reads
 *
 * Env: GITHUB_TOKEN (optional but recommended — raises API rate limits)
 */

import { mkdir, writeFile, readFile } from 'node:fs/promises'

const GITHUB_API = 'https://api.github.com'
const HEADERS = {
  Accept: 'application/vnd.github+json',
  'User-Agent': 'suretyai-intel-collector',
  ...(process.env.GITHUB_TOKEN && { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }),
}

/** The competitive landscape tracked in docs/RESEARCH.md §3. */
const TRACKED_REPOS = [
  // Content guardrails layer
  'guardrails-ai/guardrails',
  'NVIDIA-NeMo/Guardrails',
  'meta-llama/PurpleLlama',
  'protectai/llm-guard',
  'openai/openai-guardrails-python',
  // Authorization / governance layer
  'microsoft/agent-governance-toolkit',
  'invariantlabs-ai/invariant',
  'lasso-security/mcp-gateway',
  // Scanning
  'NVIDIA/garak',
  // Trust / HITL adjacency
  'humanlayer/humanlayer',
  // Distribution targets (agent frameworks)
  'langchain-ai/langgraph',
  'crewAIInc/crewAI',
  'pydantic/pydantic-ai',
]

/** Searches that surface NEW entrants in the trust/governance space. */
const DISCOVERY_QUERIES = [
  'agent guardrails created:>{{90d}} stars:>30',
  'agent governance pushed:>{{14d}} stars:>100',
  '"human in the loop" agent approval stars:>50 pushed:>{{30d}}',
]

function daysAgo(n) {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)
}

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) return { __error: `${res.status} ${res.statusText}` }
  return res.json()
}

async function repoStats(fullName) {
  const d = await getJson(`${GITHUB_API}/repos/${fullName}`)
  if (d.__error) return { repo: fullName, error: d.__error }
  return {
    repo: d.full_name,
    stars: d.stargazers_count,
    forks: d.forks_count,
    open_issues: d.open_issues_count,
    pushed_at: d.pushed_at,
    description: (d.description ?? '').slice(0, 120),
  }
}

async function discover(query, previouslySeen) {
  const q = query.replace('{{90d}}', daysAgo(90)).replace('{{14d}}', daysAgo(14)).replace('{{30d}}', daysAgo(30))
  const d = await getJson(`${GITHUB_API}/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=6`)
  if (d.__error || !d.items) return { query: q, error: d.__error ?? 'no items', items: [] }
  return {
    query: q,
    items: d.items
      .filter(
        (r) =>
          !TRACKED_REPOS.includes(r.full_name) &&
          r.full_name !== 'balureddy003/suretyai' &&
          !previouslySeen.has(r.full_name)
      )
      .map((r) => ({
        repo: r.full_name,
        stars: r.stargazers_count,
        created_at: r.created_at?.slice(0, 10),
        pushed_at: r.pushed_at?.slice(0, 10),
        description: (r.description ?? '').slice(0, 120),
      })),
  }
}

async function packageDownloads() {
  const out = {}
  const npm = await getJson('https://api.npmjs.org/downloads/point/last-week/suretyai')
  out.npm_weekly = npm.__error ? null : (npm.downloads ?? null)
  const pypi = await getJson('https://pypistats.org/api/packages/suretyai/recent')
  out.pypi_weekly = pypi.__error ? null : (pypi.data?.last_week ?? null)
  return out
}

async function previousSnapshot() {
  try {
    return JSON.parse(await readFile('intel/latest.json', 'utf8'))
  } catch {
    return null
  }
}

function starDelta(prev, repo, stars) {
  const old = prev?.tracked?.find((r) => r.repo === repo)?.stars
  if (old == null) return ''
  const d = stars - old
  return d === 0 ? ' (±0)' : d > 0 ? ` (+${d})` : ` (${d})`
}

const prev = await previousSnapshot()
const collected_at = new Date().toISOString()

const tracked = []
for (const repo of TRACKED_REPOS) tracked.push(await repoStats(repo))

// Suppress discoveries already surfaced in prior snapshots — the agent only
// needs to see each new entrant once. (Token optimization: smaller digest.)
const previouslySeen = new Set(
  [...(prev?.discovery ?? []).flatMap((d) => d.items.map((i) => i.repo)), ...(prev?.seen_discoveries ?? [])]
)
const discovery = []
for (const q of DISCOVERY_QUERIES) discovery.push(await discover(q, previouslySeen))

const seen_discoveries = [...new Set([...previouslySeen, ...discovery.flatMap((d) => d.items.map((i) => i.repo))])]

const downloads = await packageDownloads()
const self = await repoStats('balureddy003/suretyai')

// ---------------------------------------------------------------------------
// Materiality gate — deterministic decision on whether the (expensive) LLM
// analysis step should run at all this week. No deltas → no agent → no tokens.
// ---------------------------------------------------------------------------
const reasons = []
if (!prev) reasons.push('first run — no baseline snapshot')
for (const r of tracked) {
  if (r.error) continue
  const old = prev?.tracked?.find((p) => p.repo === r.repo)
  if (old?.stars != null && Math.abs(r.stars - old.stars) >= 200) {
    reasons.push(`${r.repo} star delta ${r.stars - old.stars >= 0 ? '+' : ''}${r.stars - old.stars}`)
  }
  const days = Math.round((Date.now() - new Date(r.pushed_at).getTime()) / 86_400_000)
  const oldDays = old ? Math.round((new Date(collected_at) - new Date(old.pushed_at)) / 86_400_000) : 0
  if (days > 90 && old && oldDays <= 90) reasons.push(`${r.repo} newly stale (${days}d)`)
}
for (const d of discovery) {
  for (const i of d.items) {
    if (i.stars >= 300) reasons.push(`new entrant ${i.repo} (${i.stars} stars)`)
  }
}
if (downloads.npm_weekly != null && prev?.downloads?.npm_weekly == null) reasons.push('npm package went live')
if (downloads.pypi_weekly != null && prev?.downloads?.pypi_weekly == null) reasons.push('PyPI package went live')
const material = reasons.length > 0

if (process.env.GITHUB_OUTPUT) {
  const { appendFileSync } = await import('node:fs')
  appendFileSync(process.env.GITHUB_OUTPUT, `material=${material}\nreasons=${reasons.join('; ').slice(0, 500)}\n`)
}

const snapshot = {
  collected_at,
  previous_collected_at: prev?.collected_at ?? null,
  material,
  material_reasons: reasons,
  self,
  downloads,
  tracked,
  discovery,
  seen_discoveries,
}

await mkdir('intel', { recursive: true })
await writeFile('intel/latest.json', JSON.stringify(snapshot, null, 2) + '\n')

const staleDays = (pushed) => Math.round((Date.now() - new Date(pushed).getTime()) / 86_400_000)

const digest = `# Intel Digest — ${collected_at.slice(0, 10)}

Auto-collected by scripts/collect-intel.mjs. Deltas are vs the previous snapshot${prev ? ` (${prev.collected_at.slice(0, 10)})` : ' (none — first run)'}.

## Materiality: ${material ? 'MATERIAL — analysis warranted' : 'nothing material — analysis skipped'}

${reasons.map((r) => `- ${r}`).join('\n') || '_No triggers fired._'}

## Surety AI itself

- Stars: ${self.stars ?? 'n/a'} · npm weekly downloads: ${downloads.npm_weekly ?? 'not published'} · PyPI weekly: ${downloads.pypi_weekly ?? 'not published'}

## Tracked landscape (docs/RESEARCH.md §3)

| Repo | Stars | Δ | Last push | Days stale |
|---|---|---|---|---|
${tracked
  .map((r) =>
    r.error
      ? `| ${r.repo} | ERROR | | ${r.error} | |`
      : `| ${r.repo} | ${r.stars} |${starDelta(prev, r.repo, r.stars) || ' new'} | ${r.pushed_at.slice(0, 10)} | ${staleDays(r.pushed_at)} |`
  )
  .join('\n')}

## Discovery — potential new entrants

${discovery
  .map(
    (d) => `### \`${d.query}\`

${d.items.length === 0 ? '_No new repos matched._' : d.items.map((i) => `- **${i.repo}** ⭐${i.stars} (created ${i.created_at}, pushed ${i.pushed_at}) — ${i.description}`).join('\n')}`
  )
  .join('\n\n')}

## Signals worth investigating

${[
  ...tracked.filter((r) => !r.error && staleDays(r.pushed_at) > 90).map((r) => `- **${r.repo}** has gone stale (${staleDays(r.pushed_at)} days since last push) — possible abandonment or pivot.`),
  ...discovery.flatMap((d) => d.items.filter((i) => i.stars > 500).map((i) => `- **${i.repo}** (⭐${i.stars}) is a fast riser in the discovery queries — assess overlap with Surety's lane.`)),
].join('\n') || '_No automatic flags this run._'}
`

await writeFile('intel/digest.md', digest)
console.log(`Wrote intel/latest.json and intel/digest.md (${tracked.length} tracked repos, ${discovery.reduce((n, d) => n + d.items.length, 0)} discovered)`)
