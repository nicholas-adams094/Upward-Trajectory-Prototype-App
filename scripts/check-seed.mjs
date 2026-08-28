/**
 * Sanity-checks the seeded demo data.
 *
 * The seed is generated (dates are relative, ratings are jittered from a fixed
 * PRNG), so it is worth asserting that nothing lands in the future, every
 * foreign key resolves, and every rating is on the 1-5 scale.
 *
 *   npm run check:data
 */
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'seed-check-'))
const out = join(dir, 'seed.mjs')

try {
  execFileSync('npx', ['esbuild', 'src/data/seed.ts', '--bundle', '--format=esm', `--outfile=${out}`, '--log-level=error'], { stdio: 'inherit' })

  const { seedDatabase, TODAY } = await import(`file://${out}`)
  const db = seedDatabase()
  const today = TODAY.toISOString().slice(0, 10)
  const bad = []

  for (const a of db.actions) {
    if (a.status === 'done' && a.dueOn > today) bad.push(`action due in the future is marked done: ${a.id} (${a.dueOn})`)
    if (a.completedOn && a.completedOn > today) bad.push(`action completed in the future: ${a.id} (${a.completedOn})`)
    if (a.status === 'skipped' && a.dueOn > today) bad.push(`action due in the future is marked skipped: ${a.id}`)
  }
  for (const c of db.checkIns) {
    if (c.date > today) bad.push(`check-in dated in the future: ${c.id}`)
    if (c.rating < 1 || c.rating > 5) bad.push(`check-in rating off scale: ${c.id} = ${c.rating}`)
    if (!db.goals.some((g) => g.id === c.goalId)) bad.push(`check-in for unknown goal: ${c.id}`)
  }
  for (const r of db.responses) {
    for (const [k, v] of Object.entries(r.ratings)) {
      if (v < 1 || v > 5) bad.push(`response rating off scale: ${r.id} ${k} = ${v}`)
      if (!db.competencies.some((c) => c.id === k)) bad.push(`response rates unknown competency: ${r.id} ${k}`)
    }
  }
  for (const a of db.assessments) {
    if (a.status === 'complete' && !a.completedOn) bad.push(`complete assessment with no completion date: ${a.id}`)
    if (a.completedOn && a.completedOn > today) bad.push(`assessment completed in the future: ${a.id}`)
  }
  for (const r of db.respondents) {
    const hasResponse = db.responses.some((x) => x.respondentId === r.id)
    if (r.status === 'submitted' && !hasResponse) bad.push(`submitted respondent with no response: ${r.id}`)
    if (r.status !== 'submitted' && hasResponse) bad.push(`unsubmitted respondent with a response: ${r.id}`)
  }
  for (const g of db.goals) {
    if (!db.competencies.some((c) => c.id === g.competencyId)) bad.push(`goal targets unknown competency: ${g.id}`)
    if (g.target <= g.baseline) bad.push(`goal target is not above its baseline: ${g.id}`)
  }
  for (const e of db.engagements) {
    for (const [field, id] of [['clientId', e.clientId], ['coachId', e.coachId], ['managerId', e.managerId], ['hrPartnerId', e.hrPartnerId]]) {
      if (!db.users.some((u) => u.id === id)) bad.push(`engagement ${e.id}.${field} points at unknown user ${id}`)
    }
    if (!db.orgs.some((o) => o.id === e.orgId)) bad.push(`engagement ${e.id} points at unknown org ${e.orgId}`)
  }
  for (const [name, rows] of Object.entries(db)) {
    if (!Array.isArray(rows) || !rows[0]?.id) continue
    const seen = new Set()
    for (const row of rows) {
      if (seen.has(row.id)) bad.push(`duplicate ${name} id: ${row.id}`)
      seen.add(row.id)
    }
  }

  if (bad.length) {
    console.error(`✗ ${bad.length} problem${bad.length > 1 ? 's' : ''} in the seed data:\n` + bad.map((b) => `  - ${b}`).join('\n'))
    process.exit(1)
  }
  console.log('✓ seed data passes every invariant')
  console.log('  ' + Object.entries(db).map(([k, v]) => `${k} ${v.length}`).join(' · '))
} finally {
  rmSync(dir, { recursive: true, force: true })
}
