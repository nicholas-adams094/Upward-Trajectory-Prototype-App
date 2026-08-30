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

  // Relational invariants — the class of bug that produced raters submitting
  // before they were invited, and 360s completed months before their responses.
  for (const r of db.respondents) {
    if (r.submittedOn && r.submittedOn < r.invitedOn) bad.push(`respondent submitted before being invited: ${r.id}`)
  }
  for (const a of db.assessments) {
    if (a.completedOn && a.completedOn < a.assignedOn) bad.push(`assessment completed before it was assigned: ${a.id}`)
    const latest = db.respondents
      .filter((r) => r.assessmentId === a.id && r.submittedOn)
      .map((r) => r.submittedOn)
      .sort()
      .pop()
    if (a.completedOn && latest && a.completedOn < latest) bad.push(`assessment ${a.id} completed before its last response arrived`)
  }
  for (const s of db.sessions) {
    if (s.status !== 'scheduled' && s.date > today) bad.push(`a ${s.status} session is dated in the future: ${s.id}`)
    if (s.status === 'scheduled' && s.date < today) bad.push(`a scheduled session is already in the past: ${s.id}`)
  }
  // Self-evaluations must use the same integer scale the rating control offers,
  // or a client reopening their own submission sees it as half-unanswered.
  for (const r of db.responses.filter((x) => x.relationship === 'self')) {
    for (const [k, v] of Object.entries(r.ratings)) {
      if (!Number.isInteger(v)) bad.push(`self-rating is not on the integer scale: ${r.id} ${k} = ${v}`)
    }
  }
  const selfTexts = db.responses.filter((r) => r.relationship === 'self').map((r) => r.keepDoing)
  if (new Set(selfTexts).size !== selfTexts.length) bad.push('two clients submitted the identical self-evaluation')
  // Nothing in a report released beyond the client may carry Enneagram content.
  for (const r of db.reports.filter((x) => x.status === 'published' && x.sharedWith.some((s) => s !== 'client'))) {
    const sponsorText = [r.headline, ...r.signatureStrengths, ...r.doMoreOf, ...r.watchOuts].join(' ')
    if (/enneagram|\dw\d|stress path/i.test(sponsorText)) bad.push(`report ${r.id} carries Enneagram content into sponsor-visible sections`)
  }
  for (const r of db.reports.filter((x) => x.status === 'published')) {
    if (!r.published) bad.push(`published report has no frozen snapshot: ${r.id}`)
    if (!r.publishedOn) bad.push(`published report has no publication date: ${r.id}`)
  }
  // Every foreign key, not just the four that were checked before.
  const has = (rows, id) => rows.some((x) => x.id === id)
  for (const a of db.actions) {
    if (!has(db.goals, a.goalId)) bad.push(`action points at unknown goal: ${a.id}`)
    if (!has(db.engagements, a.engagementId)) bad.push(`action points at unknown engagement: ${a.id}`)
  }
  for (const r of db.responses) {
    if (!has(db.assessments, r.assessmentId)) bad.push(`response points at unknown assessment: ${r.id}`)
    if (!has(db.respondents, r.respondentId)) bad.push(`response points at unknown respondent: ${r.id}`)
  }
  for (const r of db.respondents) if (!has(db.assessments, r.assessmentId)) bad.push(`respondent points at unknown assessment: ${r.id}`)
  for (const a of db.activity) if (!has(db.engagements, a.engagementId)) bad.push(`activity points at unknown engagement: ${a.id}`)
  for (const [name, rows] of [['clifton', db.clifton], ['enneagram', db.enneagram], ['report', db.reports]]) {
    for (const row of rows) if (!has(db.engagements, row.engagementId)) bad.push(`${name} points at unknown engagement: ${row.id}`)
  }
  for (const g of db.goals) {
    if (g.baseline < 1 || g.baseline > 5 || g.target < 1 || g.target > 5) bad.push(`goal baseline/target off the 1-5 scale: ${g.id}`)
    if (g.targetDate < g.createdOn) bad.push(`goal target date precedes its creation: ${g.id}`)
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
