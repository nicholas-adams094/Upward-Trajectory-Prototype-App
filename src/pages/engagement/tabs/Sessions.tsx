import { useState } from 'react'
import { useViewer } from '../../../auth/AuthContext'
import { useDb } from '../../../data/store'
import { logSession } from '../../../data/actions'
import { formatDate, relativeDays, todayIso } from '../../../lib/metrics'
import type { Engagement } from '../../../types'
import {
  Badge, Button, Card, CardBody, CardHeader, Field, Modal, StatusPill, inputClass,
} from '../../../components/ui/primitives'

export function Sessions({ engagement }: { engagement: Engagement }) {
  const db = useDb()
  const viewer = useViewer()
  const isCoach = viewer.role === 'coach'
  const [logging, setLogging] = useState(false)

  const sessions = db.sessions
    .filter((s) => s.engagementId === engagement.id)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
  const upcoming = sessions.filter((s) => s.status === 'scheduled' && s.date >= todayIso())
  const held = sessions.filter((s) => s.status !== 'scheduled')

  return (
    <div className="space-y-5">
      {upcoming.map((s) => (
        <Card key={s.id}>
          <CardHeader title="Next session" subtitle={`${formatDate(s.date)} · ${relativeDays(s.date)} · ${s.durationMin} minutes`} action={<StatusPill status="open" />} />
        </Card>
      ))}

      <Card>
        <CardHeader
          title="Session history"
          subtitle={isCoach ? 'Shared notes go to the client. Private notes never leave this screen.' : 'The shared summary from each of your coaching sessions.'}
          action={isCoach ? <Button size="sm" variant="primary" onClick={() => setLogging(true)}>Log a session</Button> : undefined}
        />
        <CardBody>
          <ol className="space-y-5">
            {held.map((s) => (
              <li key={s.id} className="border-l-2 border-hairline pl-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-[14px] font-semibold text-ink">{s.topic}</p>
                  <p className="text-[12px] text-muted">{formatDate(s.date)}</p>
                </div>
                <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{s.sharedNotes}</p>
                {isCoach && s.privateNotes && (
                  <div className="mt-2 rounded-lg border border-dashed border-hairline bg-surface-2 px-3 py-2.5">
                    <Badge tone="warning"><span aria-hidden="true">🔒</span> Private — coach only</Badge>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-2">{s.privateNotes}</p>
                  </div>
                )}
              </li>
            ))}
            {!held.length && <li className="text-[13px] text-ink-2">No sessions logged yet.</li>}
          </ol>
        </CardBody>
      </Card>

      {logging && <LogModal engagement={engagement} onClose={() => setLogging(false)} />}
    </div>
  )
}

function LogModal({ engagement, onClose }: { engagement: Engagement; onClose: () => void }) {
  const viewer = useViewer()
  const [date, setDate] = useState(todayIso())
  const [topic, setTopic] = useState('')
  const [sharedNotes, setShared] = useState('')
  const [privateNotes, setPrivate] = useState('')

  return (
    <Modal
      open
      title="Log a coaching session"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!topic.trim()}
            onClick={() => { logSession({ engagementId: engagement.id, date, topic: topic.trim(), sharedNotes, privateNotes }, viewer); onClose() }}
          >
            Save session
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Date"><input className={inputClass} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Topic"><input className={inputClass} value={topic} onChange={(e) => setTopic(e.target.value)} /></Field>
        <Field label="Shared notes" hint="The client sees these.">
          <textarea className={inputClass} rows={3} value={sharedNotes} onChange={(e) => setShared(e.target.value)} />
        </Field>
        <Field label="Private notes" hint="Coach only. Never shown to the client, the manager or HR.">
          <textarea className={inputClass} rows={3} value={privateNotes} onChange={(e) => setPrivate(e.target.value)} />
        </Field>
      </div>
    </Modal>
  )
}
