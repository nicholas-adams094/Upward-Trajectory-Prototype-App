import { Link } from 'react-router-dom'
import { useViewer } from '../auth/AuthContext'
import { useDb } from '../data/store'
import { reportFor, visibleEngagements } from '../lib/permissions'
import { commitmentStats, engagementScore, formatDate, goalsFor, userById } from '../lib/metrics'
import { PHASES } from '../types'
import { Avatar, Badge, Card, CardBody, PageHeader, StatusPill } from '../components/ui/primitives'

export function HrPeople() {
  const db = useDb()
  const viewer = useViewer()
  const engagements = visibleEngagements(db, viewer)

  return (
    <>
      <PageHeader
        eyebrow="Talent"
        title="People in coaching"
        subtitle="Engagement status, plan progress and manager reinforcement for everyone you sponsor. Content stays with the coach."
      />
      <Card>
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-hairline text-[11.5px] uppercase tracking-wide text-muted">
                <th className="py-2 pr-4 font-medium">Person</th>
                <th className="py-2 pr-4 font-medium">Manager</th>
                <th className="py-2 pr-4 font-medium">Phase</th>
                <th className="py-2 pr-4 font-medium">Report</th>
                <th className="py-2 pr-4 text-right font-medium">Goals</th>
                <th className="py-2 pr-4 text-right font-medium">Progress</th>
                <th className="py-2 pr-4 text-right font-medium">Reinforcement</th>
                <th className="py-2 pr-4 font-medium">Closes</th>
              </tr>
            </thead>
            <tbody>
              {engagements.map((e) => {
                const client = userById(db, e.clientId)!
                const manager = userById(db, e.managerId)!
                const score = engagementScore(db, e)
                const goals = goalsFor(db, e.id)
                const report = reportFor(db, e.id)
                const stats = commitmentStats(db.actions.filter((a) => a.engagementId === e.id), 'manager')
                const releasedToHr = report?.status === 'published' && report.sharedWith.includes('hr')
                return (
                  <tr key={e.id} className="border-b border-hairline/60 last:border-0">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <Avatar name={client.name} accent={client.accent} size={32} />
                        <div className="leading-tight">
                          <Link to={`/engagements/${e.id}`} className="text-[13.5px] font-medium text-ink hover:text-accent">{client.name}</Link>
                          <p className="text-[11.5px] text-muted">{client.title}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-[13px] text-ink-2">{manager.name}</td>
                    <td className="py-3 pr-4"><Badge tone="accent">{PHASES.find((p) => p.id === e.phase)!.label}</Badge></td>
                    <td className="py-3 pr-4">
                      {releasedToHr ? <StatusPill status="published" /> : report ? <Badge>Not released to you</Badge> : <Badge>Not written</Badge>}
                    </td>
                    <td className="tabular py-3 pr-4 text-right text-[13px] text-ink-2">{goals.length || '—'}</td>
                    <td className="tabular py-3 pr-4 text-right text-[13px] font-medium text-ink">{score.overall}%</td>
                    <td className={`tabular py-3 pr-4 text-right text-[13px] font-medium ${stats.due >= 4 && stats.rate < 0.6 ? 'text-[#a12d2d]' : 'text-ink'}`}>
                      {stats.due ? `${Math.round(stats.rate * 100)}%` : <span className="text-muted">—</span>}
                    </td>
                    <td className="py-3 pr-4 text-[12.5px] text-ink-2">{formatDate(e.targetEndOn)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  )
}
