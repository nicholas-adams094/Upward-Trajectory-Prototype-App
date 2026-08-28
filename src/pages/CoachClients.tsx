import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useViewer } from '../auth/AuthContext'
import { useDb } from '../data/store'
import { visibleEngagements } from '../lib/permissions'
import { commitmentStats, engagementScore, formatDate, goalsFor, userById } from '../lib/metrics'
import type { Database } from '../types'
import { PHASES } from '../types'
import { Avatar, Badge, Card, CardBody, PageHeader, inputClass } from '../components/ui/primitives'

const hasReinforcement = (db: Database, engagementId: string) =>
  commitmentStats(db.actions.filter((a) => a.engagementId === engagementId), 'manager').due > 0

export function CoachClients() {
  const db = useDb()
  const viewer = useViewer()
  const [q, setQ] = useState('')
  const [phase, setPhase] = useState('all')

  const rows = visibleEngagements(db, viewer)
    .map((e) => ({ e, client: userById(db, e.clientId)!, org: db.orgs.find((o) => o.id === e.orgId)!, score: engagementScore(db, e) }))
    .filter(({ e, client, org }) => {
      const matches = `${client.name} ${client.title} ${org.name}`.toLowerCase().includes(q.toLowerCase())
      return matches && (phase === 'all' || e.phase === phase)
    })

  return (
    <>
      <PageHeader eyebrow="Upward Trajectory" title="Clients" subtitle="Every engagement in the practice." />

      <div className="mb-4 flex flex-wrap gap-3">
        <input className={`${inputClass} max-w-xs`} placeholder="Search by name, title or organisation" value={q} onChange={(e) => setQ(e.target.value)} />
        <select className={`${inputClass} max-w-[200px]`} value={phase} onChange={(e) => setPhase(e.target.value)}>
          <option value="all">All phases</option>
          {PHASES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </div>

      <Card>
        <CardBody className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead>
              <tr className="border-b border-hairline text-[11.5px] uppercase tracking-wide text-muted">
                <th className="py-2 pr-4 font-medium">Client</th>
                <th className="py-2 pr-4 font-medium">Phase</th>
                <th className="py-2 pr-4 font-medium">Goals</th>
                <th className="py-2 pr-4 text-right font-medium">Progress</th>
                <th className="py-2 pr-4 text-right font-medium">Reinforcement</th>
                <th className="py-2 pr-4 font-medium">Started</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ e, client, org, score }) => (
                <tr key={e.id} className="border-b border-hairline/60 last:border-0">
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-3">
                      <Avatar name={client.name} accent={client.accent} size={32} />
                      <div className="leading-tight">
                        <Link to={`/engagements/${e.id}`} className="text-[13.5px] font-medium text-ink hover:text-accent">{client.name}</Link>
                        <p className="text-[11.5px] text-muted">{client.title} · {org.name}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 pr-4"><Badge tone="accent">{PHASES.find((p) => p.id === e.phase)!.label}</Badge></td>
                  <td className="py-3 pr-4 text-[13px] text-ink-2">{goalsFor(db, e.id).length || '—'}</td>
                  <td className="tabular py-3 pr-4 text-right text-[13px] font-medium text-ink">{score.overall}%</td>
                  <td className="tabular py-3 pr-4 text-right text-[13px] font-medium">
                    {hasReinforcement(db, e.id)
                      ? <span className={score.reinforcement < 60 ? 'text-[#a12d2d]' : 'text-ink'}>{score.reinforcement}%</span>
                      : <span className="text-muted">—</span>}
                  </td>
                  <td className="py-3 pr-4 text-[12.5px] text-ink-2">{formatDate(e.startedOn)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={6} className="py-6 text-center text-[13px] text-ink-2">No clients match that filter.</td></tr>
              )}
            </tbody>
          </table>
        </CardBody>
      </Card>
    </>
  )
}
